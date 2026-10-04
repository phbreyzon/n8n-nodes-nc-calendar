import { IExecuteFunctions } from 'n8n-workflow';
import { initClient } from '../helpers/client';
import { IEventCreate, IEventUpdate, IEventResponse } from '../interfaces/event';
import { findCalendar } from './calendar';
import { parseICalEvent } from '../helpers/parser';
import { buildDateProperty, isValidTimeZone } from '../helpers/datetime';

interface IAttendeeICal {
    displayName?: string;
    role?: string;
    rsvp?: boolean;
    email?: string;
}

interface IEventICal {
    uid?: string;
    title?: string;
    start?: string | Date;
    end?: string | Date;
    description?: string;
    location?: string;
    attendees?: IAttendeeICal[];
    credentials?: { username?: string; email?: string };
    timeZone?: string;
}

export async function getEvents(
    context: IExecuteFunctions,
    calendarName: string,
    start: string,
    end: string,
) {
    const client = await initClient(context);
    const calendar = await findCalendar(context, client, calendarName);

    const response = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
            start: start,
            end: end,
        },
    });

    return response.map(parseICalEvent);
}

export async function getEvent(
    context: IExecuteFunctions,
    calendarName: string,
    eventId: string,
): Promise<IEventResponse> {
    const client = await initClient(context);
    const calendar = await findCalendar(context, client, calendarName);

    const events = await client.fetchCalendarObjects({
        calendar,
        filters: [{
            'comp-filter': {
                _attributes: {
                    name: 'VCALENDAR',
                },
                'comp-filter': {
                    _attributes: {
                        name: 'VEVENT',
                        test: 'allof',
                    },
                    'prop-filter': {
                        _attributes: {
                            name: 'UID',
                            test: 'equals',
                        },
                        'text-match': {
                            _attributes: {
                                'match-type': 'equals',
                            },
                            _text: eventId,
                        },
                    },
                },
            },
        }],
    });

    if (!events || events.length === 0) {
        throw new Error(`Event with ID "${eventId}" not found`);
    }

    return parseICalEvent(events[0]);
}

export async function createEvent(
    context: IExecuteFunctions,
    data: IEventCreate,
) {
    const client = await initClient(context);
    const calendar = await findCalendar(context, client, data.calendarName);
    const credentials = await context.getCredentials('nextcloudCalendarApi');

    const event = {
        ...data,
        uid: `n8n-${Date.now()}@nextcloud-calendar`,
        credentials: credentials,
    };

        console.log(`Erstelle Termin mit UID: ${event.uid}`);

    const iCalString = generateICalString(event);
    console.log(`iCal-String: ${iCalString}`);

    // Verwende die funktionierende Methode aus Version 0.1.36: Keine Header
    const response = await client.createCalendarObject({
        calendar,
        filename: `${event.uid}.ics`,
        iCalString: iCalString,
    });

    console.log(`Response von createCalendarObject:`, response);

    // Prüfe, ob der Termin tatsächlich erstellt wurde
    try {
        const createdEvent = await getEvent(context, data.calendarName, event.uid);
        console.log(`Termin erfolgreich erstellt und gefunden:`, createdEvent);
    } catch (error) {
        console.log(`Warnung: Erstellter Termin konnte nicht gefunden werden:`, error.message);
    }

    // Verbesserte Rückgabe als eigenes Objekt
    const result = {
        success: true,
        message: 'Termin erfolgreich erstellt',
        uid: event.uid,
        details: {
            title: event.title,
            start: event.start,
            end: event.end,
            attendeesCount: event.attendees?.length || 0,
        }
    };

    if (response && typeof response === 'object') {
        if ('url' in response) {
            (result as { url?: string; etag?: string }).url = (response as { url?: string }).url;
        }
        if ('etag' in response) {
            const etagValue = (response as { etag?: unknown }).etag;
            (result as { url?: string; etag?: string }).etag = typeof etagValue === 'string' ? etagValue : String(etagValue);
        }
    }

    return result;
}

export async function updateEvent(
    context: IExecuteFunctions,
    data: IEventUpdate,
) {
    const client = await initClient(context);
    const calendar = await findCalendar(context, client, data.calendarName);

    const existingEvent = await getEvent(context, data.calendarName, data.eventId);

    const events = await client.fetchCalendarObjects({
        calendar,
        filters: [{
            'comp-filter': {
                _attributes: {
                    name: 'VCALENDAR',
                },
                'comp-filter': {
                    _attributes: {
                        name: 'VEVENT',
                        test: 'allof',
                    },
                    'prop-filter': {
                        _attributes: {
                            name: 'UID',
                            test: 'equals',
                        },
                        'text-match': {
                            _attributes: {
                                'match-type': 'equals',
                            },
                            _text: data.eventId,
                        },
                    },
                },
            },
        }],
    });

    if (!events || events.length === 0) {
        throw new Error(`Event with ID "${data.eventId}" not found`);
    }

    // Zeitzone: explizite Auswahl des Nutzers, sonst die Zeitzone des bestehenden Termins
    // übernehmen, damit beim Ändern keine Zeitzonen-Verschiebung entsteht.
    // Nicht von Intl unterstützte Zeitzonen (z. B. eigene VTIMEZONE-Definitionen) werden ignoriert.
    const requestedTimeZone = typeof data.timeZone === 'string' ? data.timeZone.trim() : '';
    const fallbackTimeZone = (existingEvent.tzidStart ?? '').trim();
    const candidateTimeZone = requestedTimeZone || fallbackTimeZone;
    const timeZone = isValidTimeZone(candidateTimeZone) ? candidateTimeZone : '';

    // Nur Felder übernehmen, die tatsächlich gesetzt wurden. Undefinierte Felder dürfen
    // die bestehenden Werte des Termins nicht überschreiben.
    const updatedEvent: IEventICal = {
        uid: existingEvent.uid || data.eventId,
        title: data.title ?? existingEvent.title,
        description: data.description ?? existingEvent.description,
        location: data.location ?? existingEvent.location,
        attendees: data.attendees ?? existingEvent.attendees,
        timeZone,
    };

    if (data.start) {
        updatedEvent.start = data.start;
    }
    if (data.end) {
        updatedEvent.end = data.end;
    }

    // Unveränderte Start-/Endzeit exakt so übernehmen, wie sie im Termin hinterlegt ist
    // (inklusive ursprünglichem TZID). Andernfalls würde die Zeit verschoben.
    const options: IICalOptions = {};
    if (!data.start && existingEvent.rawDTStart) {
        options.startLine = existingEvent.rawDTStart;
    }
    if (!data.end && existingEvent.rawDTEnd) {
        options.endLine = existingEvent.rawDTEnd;
    }

    // Spezielle Header für Einladungen
    const headers: Record<string, string> = {};
    if (data.attendees && data.attendees.length > 0) {
        headers['X-Requested-With'] = 'XMLHttpRequest';
        headers['Schedule-Reply'] = 'true';
        headers['Prefer'] = 'return=representation';
    }

    const response = await client.updateCalendarObject({
        calendarObject: {
            ...events[0],
            data: generateICalString(updatedEvent, options),
        },
        headers: headers,
    });

    // Verbesserte Rückgabe
    const result = {
        success: true,
        message: 'Termin erfolgreich aktualisiert',
        uid: data.eventId,
        timeZone: timeZone || 'UTC',
        details: {
            title: updatedEvent.title,
            start: updatedEvent.start,
            end: updatedEvent.end,
            attendeesCount: updatedEvent.attendees?.length || 0,
        }
    };

    if (response && typeof response === 'object') {
        if ('url' in response) {
            (result as { url?: string; etag?: string }).url = (response as { url?: string }).url;
        }
        if ('etag' in response) {
            const etagValue = (response as { etag?: unknown }).etag;
            (result as { url?: string; etag?: string }).etag = typeof etagValue === 'string' ? etagValue : String(etagValue);
        }
    }

    return result;
}

export async function deleteEvent(
    context: IExecuteFunctions,
    calendarName: string,
    eventId: string,
) {
    const client = await initClient(context);
    const calendar = await findCalendar(context, client, calendarName);

    const events = await client.fetchCalendarObjects({
        calendar,
        filters: [{
            'comp-filter': {
                _attributes: {
                    name: 'VCALENDAR',
                },
                'comp-filter': {
                    _attributes: {
                        name: 'VEVENT',
                        test: 'allof',
                    },
                    'prop-filter': {
                        _attributes: {
                            name: 'UID',
                            test: 'equals',
                        },
                        'text-match': {
                            _attributes: {
                                'match-type': 'equals',
                            },
                            _text: eventId,
                        },
                    },
                },
            },
        }],
    });

    if (!events || events.length === 0) {
        throw new Error(`Event with ID "${eventId}" not found`);
    }

    await client.deleteCalendarObject({
        calendarObject: events[0],
    });

    return { success: true };
}

export async function searchEvents(
    context: IExecuteFunctions,
    calendarName: string,
    searchTerm: string,
    start: string,
    end: string,
): Promise<IEventResponse[]> {
    const events = await getEvents(context, calendarName, start, end);

    return events.filter(event => {
        const searchString = searchTerm.toLowerCase();
        return (
            (event.title && event.title.toLowerCase().includes(searchString)) ||
            (event.description && event.description.toLowerCase().includes(searchString)) ||
            (event.location && event.location.toLowerCase().includes(searchString))
        );
    });
}

interface IICalOptions {
    timeZone?: string;
    startLine?: string;
    endLine?: string;
}

/**
 * Erzeugt die DTSTART-/DTEND-Zeile.
 * Mit Zeitzone als lokale Wandzeit mit TZID, ohne Zeitzone als echter UTC-Zeit.
 */
function buildDateTimeProperty(
    name: 'DTSTART' | 'DTEND',
    value: string | Date | undefined,
    timeZone: string,
    fallback: Date,
): string {
    return buildDateProperty(name, value, { timeZone, fallback });
}

function generateICalString(event: IEventICal, options: IICalOptions = {}) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const now = new Date();
    const startDate = event.start ? new Date(event.start) : now;
    const endFallback = new Date(startDate.getTime() + 60 * 60 * 1000);

    const rawTimeZone = options.timeZone ?? event.timeZone;
    const requestedTimeZone = typeof rawTimeZone === 'string' ? rawTimeZone.trim() : '';
    const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone) ? requestedTimeZone : '';

    if (requestedTimeZone && !timeZone) {
        console.warn(`Unbekannte Zeitzone "${requestedTimeZone}" - es wird UTC verwendet.`);
    }

    const startLine =
        options.startLine ?? buildDateTimeProperty('DTSTART', event.start, timeZone, now);
    const endLine =
        options.endLine ?? buildDateTimeProperty('DTEND', event.end, timeZone, endFallback);

    // iCal-String: mit TZID wenn gesetzt, sonst UTC-Zeitstempel
    let iCalString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//n8n//Nextcloud Calendar Node//EN
BEGIN:VEVENT
UID:${event.uid}
DTSTAMP:${timestamp}
${startLine}
${endLine}
SUMMARY:${event.title || 'Unbenannter Termin'}
`;

    if (event.description) {
        iCalString += `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}\n`;
    }

    if (event.location) {
        iCalString += `LOCATION:${event.location}\n`;
    }

    // Temporär: ORGANIZER komplett deaktiviert für Debugging
    console.log(`ORGANIZER wird temporär NICHT gesetzt (Debugging)`);
    // const credentials = event.credentials || {};
    // const username = typeof credentials.username === 'string' ? credentials.username : 'n8n';
    // let organizerEmail = `${username}@localhost`;
    // if (typeof credentials.email === 'string' && credentials.email.includes('@')) {
    //     organizerEmail = credentials.email;
    // }
    // console.log(`ORGANIZER wird gesetzt: CN=${username}, Email=${organizerEmail}`);
    // iCalString += `ORGANIZER;CN=${username}:mailto:${organizerEmail}\n`;

    // ATTENDEES temporär deaktiviert für Debugging
    if (event.attendees && event.attendees.length > 0) {
        console.log(`WARNUNG: ${event.attendees.length} Teilnehmer werden temporär ignoriert (Debugging)`);
        // Kommentiert aus für Debugging:
        // event.attendees.forEach((attendee) => {
        //     if (typeof attendee.email === 'string' && attendee.email.includes('@')) {
        //         let attendeeString = 'ATTENDEE';
        //         if (typeof attendee.displayName === 'string') {
        //             attendeeString += `;CN=${attendee.displayName}`;
        //         }
        //         attendeeString += `;ROLE=${attendee.role || 'REQ-PARTICIPANT'}`;
        //         attendeeString += ';PARTSTAT=NEEDS-ACTION';
        //         attendeeString += `:mailto:${attendee.email}\n`;
        //         iCalString += attendeeString;
        //     }
        // });
    }

    iCalString += `END:VEVENT
END:VCALENDAR`;

    return iCalString;
}