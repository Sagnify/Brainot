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

export const highlightDatesInHTML = (html: string, detectedDates: DetectedDate[]): string => {
  let result = html;
  let offset = 0;

  detectedDates.forEach(detected => {
    const beforeDate = result.substring(0, detected.startIndex + offset);
    const afterDate = result.substring(detected.endIndex + offset);
    
    const highlightedDate = `<span class="detected-date" data-date="${detected.date.toISOString()}" style="text-decoration: underline; text-decoration-color: #3b82f6; cursor: pointer;">${detected.text}</span>`;
    
    result = beforeDate + highlightedDate + afterDate;
    offset += highlightedDate.length - detected.text.length;
  });

  return result;
};