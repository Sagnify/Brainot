import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MyEvent, User, ViewType } from '../types';
import { googleCalendarService } from '../services/googleCalendarService';
import Header from './Header';
import CalendarPanel from './CalendarPanel';
import EditorPanel from './EditorPanel';
import toast from 'react-hot-toast';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<ViewType>('day');
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MyEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const eventsCollection = collection(db, 'users', user.uid, 'events');
    const notesCollection = collection(db, 'users', user.uid, 'notes');

    const unsubscribeEvents = onSnapshot(eventsCollection, (snapshot) => {
      const eventsList = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data.start && data.end && data.start.toDate && data.end.toDate;
        })
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled Event',
            start: data.start.toDate(),
            end: data.end.toDate(),
            allDay: data.allDay || false,
            resource: {
              isNote: false,
              content: data.content || '',
              priority: data.priority || 'medium',
              googleEventId: data.googleEventId || null
            }
          } as MyEvent;
        });
      
      setEvents(prev => [
        ...prev.filter(e => e.resource?.isNote),
        ...eventsList
      ]);
    });

    const unsubscribeNotes = onSnapshot(notesCollection, (snapshot) => {
      console.log('Notes snapshot:', snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
      const notesList = snapshot.docs
        .filter(doc => {
          const data = doc.data();
          // Handle both 'start' and 'date' fields for backward compatibility
          return (data.start && data.start.toDate) || (data.date && data.date.toDate);
        })
        .map(doc => {
          const data = doc.data();
          // Use 'start' if available, otherwise use 'date' for backward compatibility
          const startDate = data.start ? data.start.toDate() : data.date.toDate();
          return {
            id: doc.id,
            title: data.title || 'Untitled Note',
            start: startDate,
            end: data.end ? data.end.toDate() : startDate,
            allDay: data.allDay !== undefined ? data.allDay : true,
            resource: {
              isNote: true,
              content: data.content || ''
            }
          } as MyEvent;
        });
      
      setEvents(prev => [
        ...prev.filter(e => !e.resource?.isNote),
        ...notesList
      ]);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeNotes();
    };
  }, [user]);

  const handleEventSelect = (event: MyEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setIsMobileEditorOpen(true);
  };

  const handleSlotSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsMobileEditorOpen(true);
  };

  const handleEventDelete = async (eventId: string, isNote: boolean) => {
    try {
      // Find the event to get Google Calendar ID before deleting
      const eventToDelete = events.find(e => e.id === eventId);
      
      const collectionName = isNote ? 'notes' : 'events';
      await deleteDoc(doc(db, 'users', user.uid, collectionName, eventId));
      
      // Delete from Google Calendar if it's an event with Google ID
      if (!isNote && eventToDelete?.resource?.googleEventId) {
        try {
          await googleCalendarService.deleteEvent(eventToDelete.resource.googleEventId);
          console.log('Deleted from Google Calendar:', eventToDelete.resource.googleEventId);
        } catch (error) {
          console.log('Google Calendar delete failed:', error);
        }
      }
      
      toast.success(`${isNote ? 'Note' : 'Event'} deleted successfully`);
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const handleCloseEditor = () => {
    setSelectedEvent(null);
    setSelectedDate(null);
    setIsMobileEditorOpen(false);
  };

  const handleSyncCalendar = async () => {
    console.log('=== Dashboard Sync Handler ===');
    try {
      console.log('Events to sync:', events.filter(e => !e.resource?.isNote));
      // Sync each event individually
      const eventsToSync = events.filter(e => !e.resource?.isNote);
      for (const event of eventsToSync) {
        await googleCalendarService.syncEvent(event);
      }
      console.log('All events synced successfully');
      toast.success('Calendar synced successfully');
    } catch (error) {
      console.error('Dashboard sync failed:', error);
      toast.error('Calendar sync failed');
    }
  };

  const handleViewChange = (view: string) => {
    setCurrentView(view as ViewType);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header user={user} onSyncCalendar={handleSyncCalendar} />
      
      <div className="flex-1 flex overflow-hidden">
        <div className={`${
          isMobileEditorOpen ? 'hidden' : 'flex'
        } lg:flex flex-col w-full lg:w-1/2 xl:w-2/5 border-r border-gray-200 bg-white`}>
          <CalendarPanel
            events={events}
            currentDate={currentDate}
            view={currentView}
            onDateChange={setCurrentDate}
            onEventSelect={handleEventSelect}
            onSlotSelect={handleSlotSelect}
            onEventDelete={handleEventDelete}
            onViewChange={setCurrentView}
          />
        </div>

        <div className={`${
          isMobileEditorOpen ? 'flex' : 'hidden'
        } lg:flex flex-col w-full lg:w-1/2 xl:w-3/5 bg-gray-50`}>
          <EditorPanel
            user={user}
            event={selectedEvent}
            selectedDate={selectedDate}
            onClose={handleCloseEditor}
            isMobile={isMobileEditorOpen}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;