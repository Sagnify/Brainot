import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { MyEvent } from '../types';

interface EventCardProps {
  event: MyEvent;
  onClick: () => void;
  onDelete: () => void;
  compact?: boolean;
  detailed?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ event, onClick, onDelete, compact = false, detailed = false }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isNote = event.resource?.isNote;
  const priority = event.resource?.priority || 'medium';
  
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4, // Position below the button
        left: rect.right - 80
      });
    }
  }, [showMenu]);
  
  const getPriorityColor = () => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50 text-red-700';
      case 'medium': return 'border-yellow-200 bg-yellow-50 text-yellow-700';
      case 'low': return 'border-green-200 bg-green-50 text-green-700';
      default: return 'border-gray-200 bg-gray-50 text-gray-700';
    }
  };

  const getEventColor = () => {
    if (isNote) return 'border-purple-200 bg-purple-50 text-purple-700';
    return 'border-blue-200 bg-blue-50 text-blue-700';
  };

  if (compact) {
    return (
      <div
        data-note-id={event.id}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`group p-2 rounded text-xs cursor-pointer transition-all duration-200 border hover:shadow-sm relative ${
          isNote ? getEventColor() : getPriorityColor()
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="truncate flex-1 font-medium">{event.title}</span>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="ml-1 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              ⋯
            </button>
            {showMenu && (
              <div className="absolute right-0 bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[80px]" style={{ zIndex: 999999 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onClick();
                  }}
                  className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-1 text-xs hover:bg-gray-100 text-red-600"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {!isNote && !event.allDay && (
          <div className="text-xs opacity-75 mt-1">
            {format(event.start, 'HH:mm')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 border shadow-sm hover:shadow-md relative ${
        isNote ? getEventColor() : getPriorityColor()
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{event.title}</h3>
          
          {detailed && event.resource?.content && (
            <p className="text-sm opacity-75 mt-1 line-clamp-2">
              {event.resource.content}
            </p>
          )}
          
          <div className="flex items-center space-x-2 mt-1 text-xs opacity-75">
            {!isNote && !event.allDay && (
              <span>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
            )}
            {!isNote && event.allDay && <span>All day</span>}
            {priority !== 'medium' && !isNote && (
              <span className="capitalize">• {priority} priority</span>
            )}
            {isNote && (
              <span>Note</span>
            )}
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-200"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[9999] min-w-[100px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onClick();
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;