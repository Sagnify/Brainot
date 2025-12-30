import { MyEvent } from '../types';

declare global {
  interface Window {
    gapi: any;
  }
}

class GoogleCalendarService {
  private isInitialized = false;
  private isSignedIn = false;

  async initialize() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client:auth2', async () => {
          try {
            await window.gapi.client.init({
              apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
              clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
              scope: 'https://www.googleapis.com/auth/calendar'
            });
            
            this.isInitialized = true;
            this.isSignedIn = window.gapi.auth2.getAuthInstance().isSignedIn.get();
            resolve(true);
          } catch (error) {
            console.error('Google API initialization failed:', error);
            reject(new Error('Google Calendar API not properly configured. Please check your API key and client ID.'));
          }
        });
      };
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    });
  }

  async signIn() {
    if (!this.isInitialized) await this.initialize();
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
      this.isSignedIn = true;
    }
    return this.isSignedIn;
  }

  async signOut() {
    if (!this.isInitialized) return;
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    if (authInstance.isSignedIn.get()) {
      await authInstance.signOut();
      this.isSignedIn = false;
    }
  }

  isAuthenticated() {
    return this.isSignedIn;
  }

  private convertToGoogleEvent(event: MyEvent) {
    const googleEvent: any = {
      summary: event.title,
      description: event.resource?.description || event.resource?.content || '',
      start: {
        dateTime: event.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    if (event.allDay) {
      googleEvent.start = { date: event.start.toISOString().split('T')[0] };
      googleEvent.end = { date: event.end.toISOString().split('T')[0] };
    }

    return googleEvent;
  }

  private convertFromGoogleEvent(googleEvent: any): MyEvent {
    const start = googleEvent.start.dateTime 
      ? new Date(googleEvent.start.dateTime)
      : new Date(googleEvent.start.date + 'T00:00:00');
    
    const end = googleEvent.end.dateTime
      ? new Date(googleEvent.end.dateTime)
      : new Date(googleEvent.end.date + 'T23:59:59');

    return {
      id: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      start,
      end,
      allDay: !googleEvent.start.dateTime,
      resource: {
        isNote: false,
        content: googleEvent.description || '',
        googleEventId: googleEvent.id,
        syncedToGoogle: true
      }
    };
  }

  async createEvent(event: MyEvent): Promise<string> {
    if (!this.isSignedIn) throw new Error('Not authenticated');

    const googleEvent = this.convertToGoogleEvent(event);
    const response = await window.gapi.client.request({
      path: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      method: 'POST',
      body: googleEvent
    });

    return response.result.id;
  }

  async updateEvent(eventId: string, event: MyEvent): Promise<void> {
    if (!this.isSignedIn) throw new Error('Not authenticated');

    const googleEvent = this.convertToGoogleEvent(event);
    await window.gapi.client.request({
      path: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      method: 'PUT',
      body: googleEvent
    });
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.isSignedIn) throw new Error('Not authenticated');

    await window.gapi.client.request({
      path: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      method: 'DELETE'
    });
  }

  async getEvents(startDate: Date, endDate: Date): Promise<MyEvent[]> {
    if (!this.isSignedIn) throw new Error('Not authenticated');

    const response = await window.gapi.client.request({
      path: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      method: 'GET',
      params: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      }
    });

    return response.result.items.map((item: any) => this.convertFromGoogleEvent(item));
  }

  async syncEvents(localEvents: MyEvent[]): Promise<MyEvent[]> {
    if (!this.isSignedIn) throw new Error('Not authenticated');

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 2);

    const googleEvents = await this.getEvents(startDate, endDate);
    const syncedEvents: MyEvent[] = [];

    for (const localEvent of localEvents) {
      if (localEvent.resource?.isNote) {
        syncedEvents.push(localEvent);
        continue;
      }

      try {
        if (localEvent.resource?.googleEventId) {
          await this.updateEvent(localEvent.resource.googleEventId, localEvent);
          syncedEvents.push({
            ...localEvent,
            resource: { ...localEvent.resource, googleEventId: localEvent.resource.googleEventId }
          });
        } else {
          const googleEventId = await this.createEvent(localEvent);
          syncedEvents.push({
            ...localEvent,
            resource: { ...localEvent.resource, googleEventId }
          });
        }
      } catch (error) {
        console.error('Error syncing event:', error);
        syncedEvents.push(localEvent);
      }
    }

    for (const googleEvent of googleEvents) {
      const existsLocally = syncedEvents.some(
        local => local.resource?.googleEventId === googleEvent.resource?.googleEventId
      );
      
      if (!existsLocally) {
        syncedEvents.push(googleEvent);
      }
    }

    return syncedEvents;
  }
}

export const googleCalendarService = new GoogleCalendarService();