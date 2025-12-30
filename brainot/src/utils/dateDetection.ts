import { parse, isValid, format } from 'date-fns';

export interface DetectedDate {
  text: string;
  date: Date;
  startIndex: number;
  endIndex: number;
}

const datePatterns = [
  // MM/DD/YYYY, MM-DD-YYYY
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
  // Month DD, YYYY
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  // Mon DD, YYYY
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  // Ordinal dates with year FIRST (longer patterns first): 1st January 2024
  /\b(\d{1,2})(st|nd|rd|th)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
  // Short ordinal with year: 1st Jan 2024
  /\b(\d{1,2})(st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/gi,
  // Ordinal dates without year: 1st January, 2nd March
  /\b(\d{1,2})(st|nd|rd|th)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
  // Short ordinal without year: 1st Jan, 2nd Mar
  /\b(\d{1,2})(st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi,
  // Today, Tomorrow, Yesterday
  /\b(today|tomorrow|yesterday)\b/gi,
  // Next/This Monday, Tuesday, etc.
  /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
];

export const detectDatesInText = (text: string): DetectedDate[] => {
  const detectedDates: DetectedDate[] = [];

  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const matchText = match[0];
      let parsedDate: Date | null = null;

      if (matchText.toLowerCase() === 'today') {
        parsedDate = new Date();
      } else if (matchText.toLowerCase() === 'tomorrow') {
        parsedDate = new Date();
        parsedDate.setDate(parsedDate.getDate() + 1);
      } else if (matchText.toLowerCase() === 'yesterday') {
        parsedDate = new Date();
        parsedDate.setDate(parsedDate.getDate() - 1);
      } else if (matchText.toLowerCase().includes('next') || matchText.toLowerCase().includes('this')) {
        const dayName = match[2];
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dayName.toLowerCase());
        if (targetDay !== -1) {
          parsedDate = new Date();
          const currentDay = parsedDate.getDay();
          const daysUntilTarget = (targetDay - currentDay + 7) % 7;
          if (matchText.toLowerCase().includes('next') || daysUntilTarget === 0) {
            parsedDate.setDate(parsedDate.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
          } else {
            parsedDate.setDate(parsedDate.getDate() + daysUntilTarget);
          }
        }
      } else {
        // Handle ordinal dates
        if (matchText.match(/\d+(st|nd|rd|th)/)) {
          const day = matchText.match(/\d+/)?.[0];
          const monthMatch = matchText.match(/(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
          const yearMatch = matchText.match(/\d{4}/);
          
          if (day && monthMatch) {
            const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
            const dateStr = `${monthMatch[0]} ${day}, ${year}`;
            
            const formats = ['MMMM dd, yyyy', 'MMM dd, yyyy'];
            for (const formatStr of formats) {
              try {
                const parsed = parse(dateStr, formatStr, new Date());
                if (isValid(parsed)) {
                  parsedDate = parsed;
                  break;
                }
              } catch (e) {
                // Continue to next format
              }
            }
          }
        } else {
          // Regular date parsing
          const formats = ['MM/dd/yyyy', 'MM-dd-yyyy', 'MMMM dd, yyyy', 'MMM dd, yyyy'];
          for (const formatStr of formats) {
            try {
              const parsed = parse(matchText, formatStr, new Date());
              if (isValid(parsed)) {
                parsedDate = parsed;
                break;
              }
            } catch (e) {
              // Continue to next format
            }
          }
        }
      }

      if (parsedDate && isValid(parsedDate)) {
        detectedDates.push({
          text: matchText,
          date: parsedDate,
          startIndex: match.index!,
          endIndex: match.index! + matchText.length
        });
      }
    }
  });

  return detectedDates
    .filter((date, index, arr) => 
      arr.findIndex(d => d.startIndex === date.startIndex) === index
    )
    .sort((a, b) => a.startIndex - b.startIndex);
};

export const highlightDatesInHTML = (plainText: string, detectedDates: DetectedDate[]): string => {
  let result = plainText;
  
  // Sort dates by position in reverse order to avoid index shifting
  const sortedDates = [...detectedDates].sort((a, b) => b.startIndex - a.startIndex);
  
  sortedDates.forEach(detected => {
    const beforeDate = result.substring(0, detected.startIndex);
    const afterDate = result.substring(detected.endIndex);
    
    const highlightedDate = `<span class="detected-date" data-date="${detected.date.toISOString()}" style="text-decoration: underline; text-decoration-color: #3b82f6; cursor: pointer;">${detected.text}</span>`;
    
    result = beforeDate + highlightedDate + afterDate;
  });

  return result;
};