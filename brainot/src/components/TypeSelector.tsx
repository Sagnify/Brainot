import React from 'react';

interface TypeSelectorProps {
  onSelect: (type: 'event' | 'note') => void;
  onCancel: () => void;
}

const TypeSelector: React.FC<TypeSelectorProps> = ({ onSelect, onCancel }) => {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-2">What would you like to create?</h3>
        <p className="text-gray-500 text-sm mb-8">Choose the type of item you want to add</p>
        
        <div className="space-y-3">
          <button
            onClick={() => onSelect('event')}
            className="w-full flex items-center justify-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4v10a2 2 0 002 2h4a2 2 0 002 2V11M8 7h8" />
            </svg>
            <div className="text-left">
              <div className="font-semibold">Event</div>
              <div className="text-xs opacity-75">Scheduled activities with time</div>
            </div>
          </button>
          
          <button
            onClick={() => onSelect('note')}
            className="w-full flex items-center justify-center space-x-3 p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-left">
              <div className="font-semibold">Note</div>
              <div className="text-xs opacity-75">Quick thoughts and reminders</div>
            </div>
          </button>
          
          <button
            onClick={onCancel}
            className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TypeSelector;