import { auth } from '../firebase';
import { MyEvent } from '../types';

class GoogleCalendarService {
  private async getAccessToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Get the stored Google Access Token
    const token = sessionStorage.getItem('google_access_token');
    
    if (!token) {
      throw new Error('Google Access Token missing. Please re-login for Calendar sync.');
    }

    return token;
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
      if (response.status === 401) {
        // Token expired, clear it
        sessionStorage.removeItem('google_access_token');
        throw new Error('Google Calendar access expired. Please re-login.');
      }
      
      const errorText = await response.text();
      console.error('Google Calendar API Error:', response.status, errorText);
      throw new Error(`Google Calendar API Error: ${response.status}`);
    }

    return response.json();
  }

  private convertToGoogleEvent(event: MyEvent) {
    const colorMap = {
      'low': '2',      // Green
      'medium': '9',   // Blue  
      'high': '11'     // Red
    };
    
    const googleEvent: any = {
      summary: event.title,
      description: event.resource?.content || '',
      colorId: colorMap[event.resource?.priority || 'medium']
    };

    if (event.allDay) {
      // For all-day events, use date format (not dateTime) and avoid timezone issues
      const startDate = new Date(event.start.getTime() - (event.start.getTimezoneOffset() * 60000))
        .toISOString().split('T')[0];
      
      // For all-day events, Google Calendar expects end date to be the day AFTER the last day
      const endDateObj = new Date(event.end);
      endDateObj.setDate(endDateObj.getDate() + 1);
      const endDate = new Date(endDateObj.getTime() - (endDateObj.getTimezoneOffset() * 60000))
        .toISOString().split('T')[0];
      
      googleEvent.start = { date: startDate };
      googleEvent.end = { date: endDate };
    } else {
      // For timed events, use dateTime format
      googleEvent.start = {
        dateTime: event.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      googleEvent.end = {
        dateTime: event.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
    
    return googleEvent;
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

  async deleteEvent(googleEventId: string): Promise<void> {
    await this.makeRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: 'DELETE'
      }
    );
  }

  async updateEvent(event: MyEvent): Promise<void> {
    const googleEventId = event.resource?.googleEventId;
    if (!googleEventId) throw new Error('No Google Event ID found to update');

    const googleEvent = this.convertToGoogleEvent(event);

    await this.makeRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(googleEvent)
      }
    );
  }

  async syncEvent(event: MyEvent): Promise<string | null> {
    try {
      if (!event.resource?.googleEventId) {
        // Create new event
        const googleEventId = await this.createEvent(event);
        console.log('Synced to Google Calendar:', googleEventId);
        return googleEventId;
      } else {
        // Update existing event
        await this.updateEvent(event);
        console.log('Updated Google Calendar event:', event.resource.googleEventId);
        return event.resource.googleEventId;
      }
    } catch (error) {
      console.log('Google Calendar sync skipped:', error);
      return null;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();