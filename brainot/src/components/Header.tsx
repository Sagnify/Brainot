import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { User } from '../types';
import { googleCalendarService } from '../services/googleCalendarService';
import toast from 'react-hot-toast';

interface HeaderProps {
  user: User;
  onSyncCalendar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onSyncCalendar }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCalendarAccess, setHasCalendarAccess] = useState(true); // Assume true initially

  // Check calendar permission on mount
  useEffect(() => {
    const checkCalendarPermission = async () => {
      // Hide sync button for now - Google OAuth needs proper setup
      setHasCalendarAccess(true);
    };
    checkCalendarPermission();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed');
    }
  };

  const handleGoogleCalendarSync = async () => {
    console.log('=== Working Google Calendar Sync Started ===');
    setIsSyncing(true);
    try {
      // Check if user has Google Calendar access token
      const hasToken = localStorage.getItem('googleAccessToken');
      if (!hasToken) {
        throw new Error('Google Calendar not connected');
      }
      
      if (onSyncCalendar) {
        console.log('3. Starting calendar sync...');
        await onSyncCalendar();
        console.log('4. Calendar sync completed');
      }
      
      console.log('=== Sync Success ===');
      toast.success('Calendar synced successfully');
      setHasCalendarAccess(true);
    } catch (error: any) {
      console.error('=== Sync Error ===');
      console.error('Error:', error);
      toast.error(error.message || 'Failed to sync with Google Calendar');
    } finally {
      setIsSyncing(false);
      console.log('=== Sync Process Ended ===');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002 2V11M8 7h8" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">BrainNot</h1>
          </div>

          <div className="flex items-center space-x-4">
            {!hasCalendarAccess && (
              <button
                onClick={handleGoogleCalendarSync}
                disabled={isSyncing}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 bg-blue-100 text-blue-700 hover:bg-blue-200 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSyncing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002 2V11M8 7h8" />
                  </svg>
                )}
                <span className="hidden sm:inline">
                  {isSyncing ? 'Syncing...' : 'Connect Google Calendar'}
                </span>
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-300 rounded-full" />
                )}
                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {user.displayName}
                </span>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;