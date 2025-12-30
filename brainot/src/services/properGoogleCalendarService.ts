import { google } from 'googleapis';
import { auth } from '../firebase';
import { MyEvent } from '../types';

class ProperGoogleCalendarService {
  private calendar = google.calendar('v3');

  private async getAuthClient() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Get the access token from Firebase Auth
    const token = await user.getIdToken();
    
    // Create OAuth2 client with the token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: token
    });

    return oauth2Client;
  }

  private convertToGoogleEvent(event: MyEvent) {
    return {
      summary: event.title,
      description: event.resource?.content || '',
      start: event.allDay 
        ? { date: event.start.toISOString().split('T')[0] }
        : { 
            dateTime: event.start.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
      end: event.allDay
        ? { date: event.end.toISOString().split('T')[0] }
        : {
            dateTime: event.end.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
    };
  }

  async createEvent(event: MyEvent): Promise<string> {
    const auth = await this.getAuthClient();
    const googleEvent = this.convertToGoogleEvent(event);
    
    const result = await this.calendar.events.insert({
      auth,
      calendarId: 'primary',
      requestBody: googleEvent
    });
    
    return result.data.id!;
  }

  async syncEvent(event: MyEvent): Promise<void> {
    try {
      if (!event.resource?.googleEventId) {
        const googleEventId = await this.createEvent(event);
        console.log('Synced to Google Calendar:', googleEventId);
      }
    } catch (error) {
      console.log('Google Calendar sync failed:', error);
    }
  }
}

export const properGoogleCalendarService = new ProperGoogleCalendarService();