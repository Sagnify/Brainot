import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { MyEvent, ViewType } from '../types';
import EventCard from './EventCard';

interface CalendarPanelProps {
  events: MyEvent[];
  currentDate: Date;
  view: ViewType;
  onDateChange: (date: Date) => void;
  onEventSelect: (event: MyEvent) => void;
  onSlotSelect: (date: Date) => void;
  onEventDelete: (eventId: string, isNote: boolean) => void;
  onViewChange: (view: ViewType) => void;
}

const CalendarPanel: React.FC<CalendarPanelProps> = ({
  events,
  currentDate,
  view,
  onDateChange,
  onEventSelect,
  onSlotSelect,
  onEventDelete,
  onViewChange
}) => {
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    onDateChange(newDate);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    onDateChange(newDate);
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (event.allDay) {
        // For all-day events, check if the date falls within the event's date range
        const eventStart = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
        const eventEnd = new Date(event.end.getFullYear(), event.end.getMonth(), event.end.getDate());
        const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return checkDate >= eventStart && checkDate <= eventEnd;
      } else {
        // For timed events, check if they start on this date
        return isSameDay(event.start, date);
      }
    });
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const selectedDateEvents = useMemo(() => {
    return getEventsForDate(currentDate);
  }, [events, currentDate]);

  const handleDateClick = (date: Date) => {
    onDateChange(date);
    if (view === 'month') {
      onViewChange('day');
    }
  };

  const renderMonthView = () => (
    <div className="p-4 pb-8">
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
            {day}
          </div>
        ))}
        {monthDays.map(day => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = isSameDay(day, currentDate);
          const isDayToday = isToday(day);
          const hasEvents = dayEvents.length > 0;
          const eventCount = dayEvents.length;
          const noteCount = dayEvents.filter(e => e.resource?.isNote).length;
          const realEventCount = dayEvents.filter(e => !e.resource?.isNote).length;

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`h-20 p-2 border border-gray-100 rounded-lg cursor-pointer transition-all duration-200 flex flex-col ${
                isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 text-gray-400'
              } ${
                isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : ''
              } ${
                isDayToday ? 'border-primary-300' : ''
              }`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isDayToday ? 'text-primary-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {format(day, 'd')}
              </div>
              
              {hasEvents && (
                <div className="flex-1 flex flex-wrap gap-1 justify-center items-center">
                  {dayEvents.map(event => {
                    const priority = event.resource?.priority || 'medium';
                    const isNote = event.resource?.isNote;
                    const dotColor = isNote 
                      ? 'bg-purple-500' 
                      : priority === 'high' 
                        ? 'bg-red-500' 
                        : priority === 'medium' 
                          ? 'bg-blue-500' 
                          : 'bg-green-500';
                    
                    return (
                      <div
                        key={event.id}
                        className={`w-2 h-2 rounded-full ${dotColor}`}
                        title={event.title}
                      />
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDayView = () => {
    const isDayToday = isToday(currentDate);
    const dayEvents = selectedDateEvents.filter(e => !e.resource?.isNote);
    const dayNotes = selectedDateEvents.filter(e => e.resource?.isNote);
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <button onClick={() => navigateDay('prev')} className="p-1 rounded hover:bg-gray-200">←</button>
              <h2 className={`text-lg font-semibold ${isDayToday ? 'text-primary-700' : 'text-gray-900'}`}>
                {format(currentDate, 'EEEE, MMM d')}
              </h2>
              <button onClick={() => navigateDay('next')} className="p-1 rounded hover:bg-gray-200">→</button>
            </div>
            {isDayToday && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium">Today</span>
            )}
          </div>
          <button
            onClick={() => onSlotSelect(currentDate)}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <span className="text-sm font-medium">+ Add event or note</span>
          </button>
        </div>
        
        {dayNotes.length > 0 && (
          <div className="border-b border-gray-200 bg-purple-25 relative z-50">
            <div className="p-3">
              <h3 className="text-sm font-medium text-purple-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Notes ({dayNotes.length})
              </h3>
              <div className="flex space-x-3 overflow-x-auto pb-2" style={{ overflow: 'visible' }}>
                {dayNotes.map((note) => (
                  <div key={note.id} className="flex-shrink-0 w-64 relative">
                    <EventCard event={note} onClick={() => onEventSelect(note)} onDelete={() => onEventDelete(note.id!, true)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto relative z-0">
          <div className="relative">
            {/* All Day Events - Redesigned */}
            {dayEvents.some(e => e.allDay) && (
              <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 relative z-10">
                <div className="p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">All Day</div>
                  <div className="space-y-2">
                    {dayEvents.filter(e => e.allDay).map(event => {
                      const priority = event.resource?.priority || 'medium';
                      const priorityConfig = {
                        high: { bg: 'bg-red-500', text: 'text-white', hover: 'hover:bg-red-600' },
                        medium: { bg: 'bg-blue-500', text: 'text-white', hover: 'hover:bg-blue-600' },
                        low: { bg: 'bg-green-500', text: 'text-white', hover: 'hover:bg-green-600' }
                      }[priority];
                      
                      return (
                        <div key={event.id} className="group relative">
                          <div className={`${priorityConfig.bg} ${priorityConfig.text} ${priorityConfig.hover} rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center justify-between`}>
                            <div 
                              className="flex-1 cursor-pointer select-none"
                              onClick={() => onEventSelect(event)}
                            >
                              {event.title}
                            </div>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const menu = e.currentTarget.nextElementSibling as HTMLElement;
                                  // Close all other menus first
                                  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
                                  menu.classList.toggle('hidden');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white hover:bg-opacity-20 transition-all duration-200 ml-2"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              <div className="dropdown-menu hidden absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[9999] min-w-[120px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEventSelect(event);
                                    (e.currentTarget.parentElement as HTMLElement).classList.add('hidden');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEventDelete(event.id!, false);
                                    (e.currentTarget.parentElement as HTMLElement).classList.add('hidden');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            <div className="relative overflow-hidden">
              {(() => {
                const timedEvents = dayEvents.filter(e => !e.allDay);
                
                return timedEvents.map((event, index) => {
                  const startHour = event.start.getHours();
                  const startMinute = event.start.getMinutes();
                  const endHour = event.end.getHours();
                  const endMinute = event.end.getMinutes();
                  
                  const topPosition = startHour * 64 + (startMinute / 60) * 64;
                  const endPosition = endHour * 64 + (endMinute / 60) * 64;
                  const height = Math.max(endPosition - topPosition, 32);
                  
                  // Stack overlapping events with left border offset
                  const overlappingEvents = timedEvents.filter((other, otherIndex) => {
                    if (index === otherIndex) return false;
                    return event.start < other.end && event.end > other.start;
                  });
                  
                  const overlapIndex = overlappingEvents.filter((_, i) => i < index).length;
                  
                  const width = 'calc(100% - 76px)';
                  const leftOffset = `${68 + (overlapIndex * 8)}px`; // 8px offset for each overlap
                  
                  const priority = event.resource?.priority || 'medium';
                  const priorityColors = {
                    high: 'bg-red-100 border-red-500 text-red-900 hover:bg-red-200',
                    medium: 'bg-blue-100 border-blue-500 text-blue-900 hover:bg-blue-200', 
                    low: 'bg-green-100 border-green-500 text-green-900 hover:bg-green-200'
                  };
                  
                  return (
                    <div
                      key={event.id}
                      className={`absolute border-l-4 rounded p-2 cursor-pointer transition-colors z-10 group ${priorityColors[priority]}`}
                      style={{ 
                        top: `${topPosition}px`, 
                        height: `${height}px`,
                        left: leftOffset,
                        width: width,
                        zIndex: 10 + index
                      }}
                      onClick={() => onEventSelect(event)}
                    >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{event.title}</div>
                        <div className="text-xs opacity-75">
                          {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                        </div>
                      </div>
                      <div className="relative ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const menu = e.currentTarget.nextElementSibling as HTMLElement;
                            menu.classList.toggle('hidden');
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black hover:bg-opacity-10 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        <div className="hidden absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[9999] min-w-[120px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventSelect(event);
                              (e.currentTarget.parentElement as HTMLElement).classList.add('hidden');
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventDelete(event.id!, false);
                              (e.currentTarget.parentElement as HTMLElement).classList.add('hidden');
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
              
              {hours.map(hour => (
                <div key={hour} className="flex border-b border-gray-100 h-16 relative">
                  <div className="w-16 flex-shrink-0 p-2 text-right border-r border-gray-200">
                    <span className="text-xs text-gray-500">{String(hour).padStart(2, '0')}:00</span>
                  </div>
                  <div className="flex-1 relative">
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getNavigationHandler = () => {
    return view === 'month' ? navigateMonth : navigateDay;
  };

  const getDateFormat = () => {
    return view === 'month' ? 'MMMM yyyy' : 'MMMM yyyy';
  };

  const navigate = getNavigationHandler();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex space-x-1">
          <button
            onClick={() => onViewChange('day')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              view === 'day'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Day
          </button>
          <button
            onClick={() => onViewChange('month')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              view === 'month'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Month
          </button>
        </div>
      </div>
      
      {view === 'month' && (
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <button
            onClick={() => navigate('prev')}
            className="p-1 rounded hover:bg-gray-100"
          >
            ←
          </button>
          
          <h3 className="text-lg font-semibold text-gray-900">
            {format(currentDate, getDateFormat())}
          </h3>
          
          <button
            onClick={() => navigate('next')}
            className="p-1 rounded hover:bg-gray-100"
          >
            →
          </button>
        </div>
      )}
      
      <div className="flex-1 overflow-hidden">
        {view === 'month' ? renderMonthView() : renderDayView()}
      </div>
    </div>
  );
};

export default CalendarPanel;