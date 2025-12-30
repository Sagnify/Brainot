import { auth } from '../firebase';
import { MyEvent } from '../types';

class FirebaseGoogleCalendarService {
  private async getAccessToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the Google access token from Firebase Auth
    // This requires the user to have signed in with Google provider
    const providerData = user.providerData.find(p => p.providerId === 'google.com');
    if (!providerData) {
      throw new Error('User did not sign in with Google. Please sign in with Google to sync calendar.');
    }

    // For Firebase Auth with Google, we need to get a fresh token with calendar scope
    // This is a limitation - Firebase ID tokens don't include calendar scope
    throw new Error('Calendar sync requires additional Google permissions. Please enable Google Calendar API with proper OAuth setup.');
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private convertToGoogleEvent(event: MyEvent) {
    const googleEvent: any = {
      summary: event.title,
      description: event.resource?.content || '',
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
    console.log('Creating Google Calendar event:', event.title);
    const googleEvent = this.convertToGoogleEvent(event);
    
    const result = await this.makeRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?key=${import.meta.env.VITE_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        body: JSON.stringify(googleEvent)
      }
    );
    
    console.log('Created event with ID:', result.id);
    return result.id;
  }

  async getEvents(startDate: Date, endDate: Date): Promise<MyEvent[]> {
    console.log('Fetching Google Calendar events...');
    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      key: import.meta.env.VITE_FIREBASE_API_KEY
    });

    const result = await this.makeRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
    );

    const events = result.items?.map((item: any) => this.convertFromGoogleEvent(item)) || [];
    console.log('Fetched', events.length, 'Google Calendar events');
    return events;
  }

  async syncEvents(localEvents: MyEvent[]): Promise<MyEvent[]> {
    console.log('Starting Firebase Google Calendar sync with', localEvents.length, 'local events');
    
    try {
      // Get Google Calendar events for the next 3 months
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);

      const googleEvents = await this.getEvents(startDate, endDate);
      const syncedEvents: MyEvent[] = [];

      // Sync local events to Google Calendar
      for (const localEvent of localEvents) {
        try {
          if (!localEvent.resource?.googleEventId) {
            // Create new Google event
            const googleEventId = await this.createEvent(localEvent);
            syncedEvents.push({
              ...localEvent,
              resource: { ...localEvent.resource, googleEventId, syncedToGoogle: true }
            });
          } else {
            // Event already synced
            syncedEvents.push(localEvent);
          }
        } catch (error) {
          console.error('Error syncing event:', localEvent.title, error);
          syncedEvents.push(localEvent); // Keep local event even if sync fails
        }
      }

      // Add Google events that don't exist locally
      for (const googleEvent of googleEvents) {
        const existsLocally = syncedEvents.some(
          local => local.resource?.googleEventId === googleEvent.resource?.googleEventId
        );
        
        if (!existsLocally) {
          syncedEvents.push(googleEvent);
        }
      }

      console.log('Sync completed. Total events:', syncedEvents.length);
      return syncedEvents;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!auth.currentUser;
  }
}

export const firebaseGoogleCalendarService = new FirebaseGoogleCalendarService();