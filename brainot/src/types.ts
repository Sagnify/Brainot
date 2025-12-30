export interface MyEvent {
    id?: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: {
        isNote?: boolean;
        content?: string;
        color?: string;
        priority?: 'low' | 'medium' | 'high';
        googleEventId?: string;
        syncedToGoogle?: boolean;
    };
}

export interface User {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
}

export type ViewType = 'day' | 'week' | 'month' | 'agenda';
