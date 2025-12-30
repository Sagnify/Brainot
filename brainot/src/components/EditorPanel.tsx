import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MyEvent, User } from '../types';
import { googleCalendarService } from '../services/googleCalendarService';
import { geminiService } from '../services/geminiService';
import toast from 'react-hot-toast';
import TypeSelector from './TypeSelector';

interface EditorPanelProps {
  user: User;
  event?: MyEvent | null;
  selectedDate?: Date | null;
  onClose: () => void;
  isMobile?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({ user, event, selectedDate, onClose, isMobile = false }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [isNote, setIsNote] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializing = useRef(false);

  const hasContent = event || selectedDate;
  const isEditing = !!event;

  // Cleanup function
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Hide toolbar on unmount
      setShowToolbar(false);
    };
  }, []);

  useEffect(() => {
    if (event) {
      isInitializing.current = true;
      // Editing existing item - determine type and lock it
      setTitle(event.title);
      const eventContent = event.resource?.content || '';
      setContent(eventContent);
      setStartDate(format(event.start, 'yyyy-MM-dd'));
      setStartTime(format(event.start, 'HH:mm'));
      setEndDate(format(event.end, 'yyyy-MM-dd'));
      setEndTime(format(event.end, 'HH:mm'));
      setAllDay(event.allDay || false);
      setIsNote(event.resource?.isNote || false);
      setPriority(event.resource?.priority || 'medium');
      setShowTypeSelector(false);
      setShowToolbar(false);
      
      // Set content directly when editing existing content
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = eventContent;
          // Place cursor at the end of content
          if (eventContent) {
            editorRef.current.focus();
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editorRef.current);
            range.collapse(false); // false means collapse to end
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
        isInitializing.current = false;
      }, 0);
    } else if (selectedDate) {
      isInitializing.current = true;
      // Creating new item - show type selector first
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setStartDate(dateStr);
      setEndDate(dateStr);
      setStartTime('09:00');
      setEndTime('10:00');
      setTitle('');
      setContent('');
      setAllDay(false);
      setIsNote(false);
      setPriority('medium');
      setShowTypeSelector(true);
      setShowToolbar(false);
      
      // Clear editor for new content
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
          editorRef.current.focus();
        }
        isInitializing.current = false;
      }, 0);
    } else {
      setShowTypeSelector(false);
      setShowToolbar(false);
    }
  }, [event, selectedDate]);

  const handleTypeSelect = (type: 'event' | 'note') => {
    setIsNote(type === 'note');
    if (type === 'note') {
      // For notes, always use current date and time but don't use allDay concept
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const currentTime = format(now, 'HH:mm');
      setStartDate(today);
      setEndDate(today);
      setStartTime(currentTime);
      setEndTime(currentTime);
      setAllDay(false); // Notes don't use allDay
    }
    setShowTypeSelector(false);
  };

  const validateEventTimes = useCallback(() => {
    if (allDay) return true;
    
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    
    if (end <= start) {
      toast.error('End time must be after start time');
      return false;
    }
    
    return true;
  }, [startDate, startTime, endDate, endTime, allDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!isNote && !validateEventTimes()) {
      return;
    }

    // Get current content from editor for notes
    let currentContent = content;
    if (isNote && editorRef.current) {
      currentContent = editorRef.current.innerHTML || '';
    }

    setIsLoading(true);
    try {
      let startDateTime, endDateTime;
      
      if (isNote) {
        // For notes, use current timestamp
        const now = new Date();
        startDateTime = now;
        endDateTime = now;
      } else {
        // For events, use the selected dates/times
        startDateTime = allDay 
          ? new Date(startDate + 'T00:00:00')
          : new Date(startDate + 'T' + startTime);
        
        endDateTime = allDay
          ? new Date(endDate + 'T23:59:59')
          : new Date(endDate + 'T' + endTime);
      }

      const eventData = {
        title: title.trim(),
        start: Timestamp.fromDate(startDateTime),
        end: Timestamp.fromDate(endDateTime),
        ...(currentContent.trim() && { content: currentContent.trim() }),
        ...(isNote && { isNote: true }),
        ...(!isNote && { allDay, priority }),
        // Preserve Google Event ID for events
        ...(!isNote && event?.resource?.googleEventId && { googleEventId: event.resource.googleEventId })
      };

      if (event?.id) {
        const collectionName = isNote ? 'notes' : 'events';
        await updateDoc(doc(db, 'users', user.uid, collectionName, event.id), eventData);
        
        // Sync updates to Google Calendar for events
        if (!isNote && event.resource?.googleEventId) {
          try {
            const updatedEvent: MyEvent = {
              id: event.id!,
              title: title.trim(),
              start: startDateTime,
              end: endDateTime,
              allDay,
              resource: { 
                isNote: false,
                content: currentContent.trim(), 
                priority,
                googleEventId: event.resource.googleEventId
              }
            };
            await googleCalendarService.updateEvent(updatedEvent);
            console.log('Google Calendar event updated successfully');
          } catch (error) {
            console.log('Google Calendar update failed:', error);
          }
        }
        
        toast.success(`${isNote ? 'Note' : 'Event'} updated successfully`);
      } else {
        const collectionName = isNote ? 'notes' : 'events';
        const docRef = await addDoc(collection(db, 'users', user.uid, collectionName), eventData);
        
        // Try Google Calendar sync with captured access token
        if (!isNote) {
          try {
            const googleEventId = await googleCalendarService.syncEvent({
              id: docRef.id,
              title: title.trim(),
              start: startDateTime,
              end: endDateTime,
              allDay,
              resource: { isNote: false, content: currentContent.trim(), priority }
            });
            
            // Store the Google Calendar event ID in Firebase
            if (googleEventId) {
              await updateDoc(docRef, {
                googleEventId: googleEventId
              });
              console.log('Stored Google Calendar ID:', googleEventId);
            }
          } catch (error) {
            console.log('Google Calendar sync failed:', error);
          }
        }
        toast.success(`${isNote ? 'Note' : 'Event'} created successfully`);
      }

      // Only close editor on mobile for events, keep open for notes and desktop
      if (isMobile && !isNote) {
        handleClear();
      } else {
        // Keep editor open but reset to empty state for new creation
        if (!event?.id) {
          setTitle('');
          setContent('');
          if (editorRef.current) {
            editorRef.current.innerHTML = '';
          }
          if (!isNote) {
            setAllDay(false);
            setPriority('medium');
          }
        }
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = useCallback(() => {
    setTitle('');
    setContent('');
    setAllDay(false);
    setIsNote(false);
    setPriority('medium');
    setShowTypeSelector(false);
    setShowToolbar(false);
    
    // Clear editor content
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    
    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (isMobile) {
      onClose();
    } else {
      onClose();
    }
  }, [isMobile, onClose]);

  const handleCancel = useCallback(() => {
    handleClear();
  }, [handleClear]);

  const handleTextSelection = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
        setShowToolbar(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        // Calculate position relative to viewport
        const viewportWidth = window.innerWidth;
        const toolbarWidth = 200; // Approximate toolbar width
        
        let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);
        let top = rect.top - 60;
        
        // Keep toolbar within viewport bounds
        if (left < 10) left = 10;
        if (left + toolbarWidth > viewportWidth - 10) left = viewportWidth - toolbarWidth - 10;
        if (top < 10) top = rect.bottom + 10;
        
        setToolbarPosition({ top, left });
        setShowToolbar(true);
      }
    }, 10);
  }, []);

  const applyFormat = useCallback((format: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Save current selection
    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;
    
    try {
      // Apply formatting
      document.execCommand(format, false, '');
      
      // Update content without resetting cursor
      if (editorRef.current) {
        setContent(editorRef.current.innerHTML);
      }
      
      // Restore selection if possible
      setTimeout(() => {
        try {
          const newRange = document.createRange();
          newRange.setStart(startContainer, startOffset);
          newRange.setEnd(endContainer, endOffset);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } catch (e) {
          // If restoration fails, just focus the editor
          editorRef.current?.focus();
        }
      }, 0);
    } catch (error) {
      console.warn('Format command failed:', error);
    }
    
    setShowToolbar(false);
  }, []);

  const handleAiAction = useCallback(async (action: string) => {
    if (!editorRef.current || aiLoading) return;
    
    const currentContent = editorRef.current.innerText || '';
    if (!currentContent.trim()) {
      toast.error('Please add some content first');
      return;
    }

    setAiLoading(true);
    setShowAiMenu(false);
    
    try {
      let result = '';
      
      switch (action) {
        case 'summarize':
          result = await geminiService.summarize(currentContent);
          break;
        case 'grammar':
          result = await geminiService.fixGrammar(currentContent);
          break;
        case 'improve':
          result = await geminiService.improveWriting(currentContent);
          break;
        case 'expand':
          result = await geminiService.expandText(currentContent);
          break;
        case 'professional':
          result = await geminiService.makeItProfessional(currentContent);
          break;
        default:
          throw new Error('Unknown AI action');
      }
      
      // Convert markdown formatting to HTML
      const htmlResult = result
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<u>$1</u>')
        .replace(/\n/g, '<br>');
      
      // Update editor content
      editorRef.current.innerHTML = htmlResult;
      setContent(htmlResult);
      toast.success('AI processing completed!');
      
    } catch (error) {
      console.error('AI processing failed:', error);
      toast.error('AI processing failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading]);

  const renderEmptyState = () => (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Create or Edit</h3>
        <p className="text-gray-500 text-sm leading-relaxed">
          Select a date from the calendar or click on an existing event to start creating or editing your notes and events.
        </p>
      </div>
    </div>
  );

  const renderNoteEditor = () => (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 to-white">
      {/* Modern Header */}
      <div className="p-6 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isMobile && (
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-purple-100 transition-colors">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Note' : 'New Note'}
              </h2>
              <p className="text-sm text-purple-600">
                {isEditing ? `Created ${format(new Date(startDate), 'MMM d, yyyy')}` : `Today, ${format(new Date(), 'MMM d, yyyy')}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* AI Button */}
            <div className="relative">
              <button
                onClick={() => setShowAiMenu(!showAiMenu)}
                disabled={aiLoading}
                className="p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center space-x-2"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-sm font-medium">AI</span>
                  </>
                )}
              </button>
              
              {showAiMenu && (
                <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50 min-w-[180px]">
                  <button
                    onClick={() => handleAiAction('summarize')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Summarize</span>
                  </button>
                  <button
                    onClick={() => handleAiAction('grammar')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Fix Grammar</span>
                  </button>
                  <button
                    onClick={() => handleAiAction('improve')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Improve Writing</span>
                  </button>
                  <button
                    onClick={() => handleAiAction('expand')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span>Expand Text</span>
                  </button>
                  <button
                    onClick={() => handleAiAction('professional')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
                    </svg>
                    <span>Make Professional</span>
                  </button>
                </div>
              )}
            </div>
            
            {!isMobile && (
              <button onClick={handleClear} className="p-2 rounded-xl hover:bg-purple-100 text-purple-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modern Editor */}
      <div className="flex-1 flex flex-col p-6 space-y-6">
        <style jsx>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}</style>
        {/* Title Input */}
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-2xl font-bold text-gray-900 placeholder-gray-400 border-none outline-none bg-transparent resize-none"
            placeholder="Note title..."
            required
          />
          <div className="h-px bg-gradient-to-r from-purple-200 to-transparent"></div>
        </div>

        {/* Content Editor */}
        <div className="flex-1 relative">
          <div
            ref={editorRef}
            contentEditable
            onInput={(e) => {
              if (!isInitializing.current) {
                const newContent = e.currentTarget.innerHTML;
                setContent(newContent);
              }
            }}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            onBlur={() => {
              // Hide toolbar when editor loses focus
              setTimeout(() => setShowToolbar(false), 100);
            }}
            className="absolute inset-0 text-gray-700 border-none outline-none bg-transparent resize-none leading-relaxed focus:outline-none p-4 overflow-y-auto"
            suppressContentEditableWarning={true}
          />
          {(!content || content === '') && (
            <div className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none">
              Start writing your note...
            </div>
          )}
        </div>
      </div>

      {/* Modern Actions */}
      <div className="p-6 border-t border-purple-100 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{title.length} characters</span>
            <span>•</span>
            <span>{content.split('\n').length} lines</span>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClear}
              className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              {isMobile ? 'Cancel' : 'Clear'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !title.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-xl hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{isEditing ? 'Update' : 'Save'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {renderInlineToolbar()}
    </div>
  );

  const renderInlineToolbar = () => {
    if (!showToolbar) return null;

    return (
      <div 
        className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-1 flex space-x-1 transform transition-all duration-200 ease-out scale-95 opacity-0 animate-in"
        style={{ 
          top: toolbarPosition.top, 
          left: toolbarPosition.left,
          animation: 'slideInUp 0.2s ease-out forwards'
        }}
      >
        <button
          onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
          className="p-2.5 hover:bg-purple-50 rounded-lg transition-colors group"
          title="Bold"
        >
          <svg className="w-4 h-4 text-gray-600 group-hover:text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4h4.5a3.5 3.5 0 013.5 3.5v0a3.5 3.5 0 01-3.5 3.5H3V4zM3 11h5a4 4 0 014 4v0a4 4 0 01-4 4H3v-8z" />
          </svg>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
          className="p-2.5 hover:bg-purple-50 rounded-lg transition-colors group"
          title="Italic"
        >
          <svg className="w-4 h-4 text-gray-600 group-hover:text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 4h8v2h-2.5l-3 8H13v2H5v-2h2.5l3-8H8V4z" />
          </svg>
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }}
          className="p-2.5 hover:bg-purple-50 rounded-lg transition-colors group"
          title="Underline"
        >
          <svg className="w-4 h-4 text-gray-600 group-hover:text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 18h12v2H4v-2zM6 4v6a4 4 0 008 0V4h2v6a6 6 0 01-12 0V4h2z" />
          </svg>
        </button>
      </div>
    );
  };

  const renderEventEditor = () => (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-white">
      {/* Modern Header */}
      <div className="p-6 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isMobile && (
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-blue-100 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002 2V11M8 7h8" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Event' : 'New Event'}
              </h2>
              <p className="text-sm text-blue-600">
                {format(new Date(startDate || new Date()), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          {!isMobile && (
            <button onClick={handleClear} className="p-2 rounded-xl hover:bg-blue-100 text-blue-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        {/* Modern Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title Input */}
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-2xl font-bold text-gray-900 placeholder-gray-400 border-none outline-none bg-transparent"
              placeholder="Event title..."
              required
            />
            <div className="h-px bg-gradient-to-r from-blue-200 to-transparent"></div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Description</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none bg-white/50"
              placeholder="Add event description (optional)..."
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-gray-200">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">All day event</p>
                <p className="text-sm text-gray-500">Event lasts the entire day</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Date & Time Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002 2V11M8 7h8" />
                  </svg>
                  <span>Start Date</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002 2V11M8 7h8" />
                  </svg>
                  <span>End Date</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                  required
                />
              </div>
            </div>

            {!allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Start Time</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>End Time</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Priority Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Priority</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
                    priority === p
                      ? p === 'high'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : p === 'medium'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white/50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${
                    p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-blue-500' : 'bg-green-500'
                  }`} />
                  <span className="font-medium capitalize">{p}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modern Actions */}
        <div className="p-6 border-t border-blue-100 bg-white/50 backdrop-blur-sm">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              {isMobile ? 'Cancel' : 'Clear'}
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{isEditing ? 'Update Event' : 'Create Event'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return (
    <div className="h-full bg-white">
      {!hasContent ? (
        renderEmptyState()
      ) : showTypeSelector ? (
        <TypeSelector 
          onSelect={handleTypeSelect} 
          onCancel={handleCancel}
        />
      ) : isNote ? (
        renderNoteEditor()
      ) : (
        renderEventEditor()
      )}
    </div>
  );
};

export default EditorPanel;