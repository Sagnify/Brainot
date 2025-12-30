import { auth } from '../firebase';
import { MyEvent } from '../types';

class FirebaseCalendarService {
  private async getGoogleAccessToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if user signed in with Google
    const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
    if (!googleProvider) {
      throw new Error('Please sign in with Google to access calendar');
    }

    // Get the access token from Firebase Auth
    // This should include calendar scope if it was requested during login
    const result = await user.getIdTokenResult();
    
    // For Firebase Auth with Google, we need to get the access token differently
    // Let's try to get it from the credential
    const credential = await user.getIdToken();
    return credential;
  }

  private async makeCalendarRequest(url: string, options: RequestInit = {}): Promise<any> {
    // Try using the API key directly for read operations
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    
    const urlWithKey = url.includes('?') 
      ? `${url}&key=${apiKey}`
      : `${url}?key=${apiKey}`;

    const response = await fetch(urlWithKey, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API Error:', response.status, errorText);
      
      // If API key doesn't work, try with auth token
      if (response.status === 401 || response.status === 403) {
        return this.makeAuthenticatedRequest(url, options);
      }
      
      throw new Error(`Calendar API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getGoogleAccessToken();
    
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
      console.error('Authenticated Calendar API Error:', response.status, errorText);
      throw new Error(`Calendar API Error: ${response.status} ${response.statusText}`);
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
    
    const result = await this.makeAuthenticatedRequest(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
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
      orderBy: 'startTime'
    });

    const result = await this.makeCalendarRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
    );

    const events = result.items?.map((item: any) => this.convertFromGoogleEvent(item)) || [];
    console.log('Fetched', events.length, 'Google Calendar events');
    return events;
  }

  async syncEvents(localEvents: MyEvent[]): Promise<MyEvent[]> {
    console.log('Starting Firebase Calendar sync with', localEvents.length, 'local events');
    
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);

      const googleEvents = await this.getEvents(startDate, endDate);
      const syncedEvents: MyEvent[] = [];

      for (const localEvent of localEvents) {
        try {
          if (!localEvent.resource?.googleEventId) {
            const googleEventId = await this.createEvent(localEvent);
            syncedEvents.push({
              ...localEvent,
              resource: { ...localEvent.resource, googleEventId, syncedToGoogle: true }
            });
          } else {
            syncedEvents.push(localEvent);
          }
        } catch (error) {
          console.error('Error syncing event:', localEvent.title, error);
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

      console.log('Sync completed. Total events:', syncedEvents.length);
      return syncedEvents;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  async hasCalendarPermission(): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;
      
      // Check if user signed in with Google
      const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
      if (!googleProvider) return false;
      
      // Since calendar scope is configured in Firebase and user is logged in with Google,
      // assume they have calendar access. The sync button will only show if sync fails.
      return true;
    } catch (error) {
      return false;
    }
  }

  isAuthenticated(): boolean {
    return !!auth.currentUser;
  }
}

export const firebaseCalendarService = new FirebaseCalendarService();