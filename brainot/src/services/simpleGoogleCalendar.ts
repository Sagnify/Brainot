import { MyEvent } from '../types';

class SimpleGoogleCalendarService {
  private accessToken: string | null = null;

  async authenticate(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Use Google OAuth2 popup
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = window.location.origin;
      const scope = 'https://www.googleapis.com/auth/calendar';
      
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}&` +
        `response_type=token&` +
        `include_granted_scopes=true`;

      const popup = window.open(authUrl, 'google-auth', 'width=500,height=600');
      
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          reject(new Error('Authentication cancelled'));
        }
      }, 1000);

      // Listen for the token in the popup URL
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          this.accessToken = event.data.token;
          clearInterval(checkClosed);
          popup?.close();
          window.removeEventListener('message', messageListener);
          resolve(true);
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          clearInterval(checkClosed);
          popup?.close();
          window.removeEventListener('message', messageListener);
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', messageListener);
    });
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
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
    const googleEvent = this.convertToGoogleEvent(event);
    const result = await this.makeRequest(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        body: JSON.stringify(googleEvent)
      }
    );
    return result.id;
  }

  async getEvents(startDate: Date, endDate: Date): Promise<MyEvent[]> {
    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    const result = await this.makeRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
    );

    return result.items?.map((item: any) => this.convertFromGoogleEvent(item)) || [];
  }

  async syncEvents(localEvents: MyEvent[]): Promise<MyEvent[]> {
    console.log('Starting sync with', localEvents.length, 'local events');
    
    // Get Google Calendar events for the next 3 months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 2);

    const googleEvents = await this.getEvents(startDate, endDate);
    console.log('Found', googleEvents.length, 'Google Calendar events');

    const syncedEvents: MyEvent[] = [];

    // Sync local events to Google Calendar
    for (const localEvent of localEvents) {
      try {
        if (!localEvent.resource?.googleEventId) {
          // Create new Google event
          console.log('Creating new Google event:', localEvent.title);
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

    return syncedEvents;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

export const simpleGoogleCalendarService = new SimpleGoogleCalendarService();