import { auth, googleProvider } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { MyEvent } from '../types';

class GoogleCalendarService {
  private async ensureValidToken(): Promise<boolean> {
    try {
      let token = localStorage.getItem('googleAccessToken');
      const refreshToken = localStorage.getItem('googleRefreshToken');
      
      if (!token && !refreshToken) {
        // No tokens at all, need fresh auth
        return await this.requestNewTokens();
      }
      
      if (token) {
        // Test if current token is valid
        const testResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (testResponse.ok) {
          return true;
        }
      }
      
      // Token invalid/expired, try refresh
      if (refreshToken) {
        return await this.refreshAccessToken(refreshToken);
      }
      
      // No refresh token, need fresh auth
      return await this.requestNewTokens();
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
  
  private async refreshAccessToken(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: import.meta.env.VITE_FIREBASE_API_KEY,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('googleAccessToken', data.access_token);
        console.log('✅ Google token refreshed automatically');
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    
    // Refresh failed, clear tokens and request new ones
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleRefreshToken');
    return await this.requestNewTokens();
  }
  
  private async requestNewTokens(): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;
      
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        localStorage.setItem('googleAccessToken', credential.accessToken);
        // Note: Firebase doesn't provide refresh tokens directly
        // In production, you'd implement server-side token management
        console.log('✅ New Google tokens obtained');
        return true;
      }
    } catch (error) {
      console.error('New token request failed:', error);
    }
    
    return false;
  }
  private async getAccessToken(): Promise<string> {
    // Check both storage locations
    let token = localStorage.getItem('googleAccessToken') || sessionStorage.getItem('google_access_token');
    
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
        // Token expired, clear both storage locations
        localStorage.removeItem('googleAccessToken');
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
    if (!(await this.ensureValidToken())) {
      console.error('❌ Google Calendar delete failed: Not connected');
      throw new Error('Google Calendar not connected');
    }
    try {
      await this.makeRequest(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: 'DELETE'
        }
      );
      console.log('✅ Google Calendar delete successful:', googleEventId);
    } catch (error) {
      console.error('❌ Google Calendar delete failed:', error);
      throw error;
    }
  }

  async updateEvent(event: MyEvent): Promise<void> {
    if (!(await this.ensureValidToken())) {
      console.error('❌ Google Calendar update failed: Not connected');
      throw new Error('Google Calendar not connected');
    }
    const googleEventId = event.resource?.googleEventId;
    if (!googleEventId) {
      console.error('❌ Google Calendar update failed: No Google Event ID');
      throw new Error('No Google Event ID found to update');
    }

    try {
      const googleEvent = this.convertToGoogleEvent(event);
      await this.makeRequest(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(googleEvent)
        }
      );
      console.log('✅ Google Calendar update successful:', googleEventId);
    } catch (error) {
      console.error('❌ Google Calendar update failed:', error);
      throw error;
    }
  }

  async syncEvent(event: MyEvent): Promise<string | null> {
    if (!(await this.ensureValidToken())) {
      console.error('❌ Google Calendar sync failed: Not connected');
      throw new Error('Google Calendar not connected');
    }
    try {
      if (!event.resource?.googleEventId) {
        // Create new event
        const googleEventId = await this.createEvent(event);
        console.log('✅ Google Calendar sync successful: Created event', googleEventId);
        return googleEventId;
      } else {
        // Update existing event
        await this.updateEvent(event);
        console.log('✅ Google Calendar sync successful: Updated event', event.resource.googleEventId);
        return event.resource.googleEventId;
      }
    } catch (error) {
      console.error('❌ Google Calendar sync failed:', error);
      return null;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();