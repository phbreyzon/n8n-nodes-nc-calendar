import { IDataObject } from 'n8n-workflow';

/**
 * Statuswerte eines VTODO nach RFC 5545. Nextcloud/Deck nutzen davon die
 * ersten vier, "IN-PROCESS" wird von Nextcloud als "In Bearbeitung" angezeigt.
 */
export const TODO_STATUSES = [
    'NEEDS-ACTION',
    'IN-PROCESS',
    'COMPLETED',
    'CANCELLED',
] as const;

export type ITodoStatus = (typeof TODO_STATUSES)[number];

export interface ITodoBase {
    title: string;
    description?: string;
    /** Fälligkeitszeitpunkt als ISO-8601-String oder reines Datum (YYYY-MM-DD). */
    due?: string;
    /** Startzeitpunkt als ISO-8601-String oder reines Datum (YYYY-MM-DD). */
    start?: string;
    status?: ITodoStatus;
    /** 0-100. Wird bei Status COMPLETED auf 100 gesetzt, bei NEEDS-ACTION auf 0. */
    percentComplete?: number;
    /** 1 (hoch) bis 9 (niedrig), 0 = undefiniert. */
    priority?: number;
    /** Kommagetrennte Liste von Kategorien. */
    categories?: string;
    timeZone?: string;
    /** Reines Datum (YYYY-MM-DD) statt Datum mit Uhrzeit für DUE/DTSTART verwenden. */
    dateOnly?: boolean;
}

export interface ITodoCreate extends ITodoBase {
    calendarName: string;
}

export interface ITodoUpdate extends Partial<ITodoBase> {
    calendarName: string;
    todoId: string;
}

export interface ITodoResponse extends IDataObject {
    uid: string;
    url?: string;
    etag?: string;
    title?: string;
    description?: string;
    due?: string;
    rawDUE?: string;
    start?: string;
    rawDTStart?: string;
    tzidDue?: string;
    tzidStart?: string;
    completed?: string;
    status?: ITodoStatus | string;
    percentComplete?: number;
    priority?: number;
    categories?: string[];
    class?: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL' | string;
    created?: string;
    lastModified?: string;
    dtstamp?: string;
    sequence?: number;
    organizer?: {
        email: string;
        displayName?: string;
    };
    /** UID eines über RELATED-TO verknüpften Eintrags. */
    relatedTo?: string;
    /** Alle nicht verstandenen Properties, damit nichts verlorengeht. */
    rawProperties?: Record<string, string | string[]>;
}