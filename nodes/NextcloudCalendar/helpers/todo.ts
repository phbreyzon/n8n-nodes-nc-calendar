import { DAVCalendarObject } from 'tsdav';
import { ITodoBase, ITodoCreate, ITodoResponse, ITodoStatus } from '../interfaces/todo';
import {
    buildDateProperty,
    formatUtcDateTime,
    isValidTimeZone,
    parseICalDateValue,
    splitICalLine,
} from './datetime';

const PRODID = '-//n8n//Nextcloud Calendar Node//EN';

// ---------------------------------------------------------------------------
// iCalendar-Syntax-Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Entfaltet umgebrochene Zeilen. Zeilen, die mit Leerzeichen oder Tab beginnen,
 * sind Fortsetzungen der vorherigen Zeile (RFC 5545, Zeilenfaltung).
 */
export function unfoldICalLines(ics: string): string[] {
    const rawLines = ics.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
    const lines: string[] = [];

    for (const rawLine of rawLines) {
        if ((rawLine.startsWith(' ') || rawLine.startsWith('\t')) && lines.length > 0) {
            lines[lines.length - 1] += rawLine.slice(1);
            continue;
        }
        lines.push(rawLine);
    }

    return lines.filter((line) => line.trim().length > 0);
}

/**
 * Faltet eine Zeile auf 75 Oktett. Fortsetzungszeilen beginnen mit einem
 * Leerzeichen, das selbst mitzählt, daher stehen dort nur 74 Oktett zur Verfügung.
 */
export function foldICalLine(line: string): string {
    const bytes = Buffer.from(line, 'utf8');
    if (bytes.length <= 75) {
        return line;
    }

    const chunks: string[] = [];
    let start = 0;
    let limit = 75;

    while (start < bytes.length) {
        let end = Math.min(start + limit, bytes.length);
        // Mehrbyte-Zeichen nicht in der Mitte umbrechen
        while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
            end--;
        }
        chunks.push(bytes.subarray(start, end).toString('utf8'));
        start = end;
        limit = 74;
    }

    return chunks.join('\r\n ');
}

/** Maskiert einen TEXT-Wert nach RFC 5545 (Backslash zuerst, dann Semikolon, Komma, Zeilenumbrüche). */
export function escapeICalText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

/** Löst die Maskierung eines TEXT-Werts wieder auf. */
export function unescapeICalText(value: string): string {
    let result = '';
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (char === '\\' && i + 1 < value.length) {
            const next = value[i + 1];
            result += next === 'n' || next === 'N' ? '\n' : next;
            i++;
            continue;
        }
        result += char;
    }
    return result;
}

/**
 * Teilt eine kommagetrennte Property (CATEGORIES) in Einzelwerte.
 * Escapte Kommas (`\,`) dürfen keine Trennzeichen sein, sonst entstehen
 * Einträge wie "roadmap\" mit hängendem Backslash.
 */
export function splitICalList(value: string): string[] {
    const items: string[] = [];
    let current = '';

    for (let i = 0; i < value.length; i++) {
        const char = value[i];

        if (char === '\\' && i + 1 < value.length) {
            current += char + value[i + 1];
            i++;
            continue;
        }
        if (char === ',') {
            items.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    items.push(current);

    return items.map((item) => unescapeICalText(item.trim())).filter(Boolean);
}

// ---------------------------------------------------------------------------
// VTODO parsen
// ---------------------------------------------------------------------------

export interface ITodoICal {
    uid?: string;
    summary?: string;
    description?: string;
    due?: string;
    rawDUE?: string;
    tzidDue?: string;
    dueDateOnly?: boolean;
    start?: string;
    rawDTStart?: string;
    tzidStart?: string;
    startDateOnly?: boolean;
    completed?: string;
    status?: ITodoStatus | string;
    percentComplete?: number;
    priority?: number;
    categories?: string[];
    class?: string;
    created?: string;
    lastModified?: string;
    dtstamp?: string;
    sequence?: number;
    organizer?: { email: string; displayName?: string };
    relatedTo?: string;
    raw?: Record<string, string | string[]>;
}

/** Parst den VTODO-Block eines iCal-Strings. Wirft, wenn kein VTODO enthalten ist. */
export function parseTodoICal(ics: string): ITodoICal {
    const lines = unfoldICalLines(ics);
    const todo: ITodoICal = {};

    let inTodo = false;
    let found = false;

    for (const line of lines) {
        const { name, params, value } = splitICalLine(line);

        if (name === 'BEGIN' && value.toUpperCase() === 'VTODO') {
            inTodo = true;
            found = true;
            continue;
        }
        if (name === 'END' && value.toUpperCase() === 'VTODO') {
            break;
        }
        if (!inTodo) {
            continue;
        }

        switch (name) {
            case 'UID':
                todo.uid = value;
                break;
            case 'SUMMARY':
                todo.summary = unescapeICalText(value);
                break;
            case 'DESCRIPTION':
                todo.description = unescapeICalText(value);
                break;
            case 'DUE':
            case 'DTSTART': {
                const parsedDate = parseICalDateValue(value);
                const isoValue = parsedDate ? parsedDate.toISOString() : undefined;
                const isDateOnly = params.VALUE?.toUpperCase() === 'DATE' || !value.includes('T');
                if (name === 'DUE') {
                    todo.due = isoValue;
                    todo.rawDUE = line;
                    todo.tzidDue = params.TZID;
                    todo.dueDateOnly = isDateOnly;
                } else {
                    todo.start = isoValue;
                    todo.rawDTStart = line;
                    todo.tzidStart = params.TZID;
                    todo.startDateOnly = isDateOnly;
                }
                break;
            }
            case 'COMPLETED':
                todo.completed = parseICalDateValue(value)?.toISOString();
                break;
            case 'STATUS':
                todo.status = value.toUpperCase();
                break;
            case 'PERCENT-COMPLETE': {
                const percent = Number(value);
                todo.percentComplete = isNaN(percent) ? undefined : percent;
                break;
            }
            case 'PRIORITY': {
                const priority = Number(value);
                todo.priority = isNaN(priority) ? undefined : priority;
                break;
            }
            case 'CATEGORIES':
                todo.categories = splitICalList(value);
                break;
            case 'CLASS':
                todo.class = value.toUpperCase();
                break;
            case 'CREATED':
                todo.created = parseICalDateValue(value)?.toISOString();
                break;
            case 'LAST-MODIFIED':
                todo.lastModified = parseICalDateValue(value)?.toISOString();
                break;
            case 'DTSTAMP':
                todo.dtstamp = parseICalDateValue(value)?.toISOString();
                break;
            case 'SEQUENCE': {
                const sequence = Number(value);
                todo.sequence = isNaN(sequence) ? undefined : sequence;
                break;
            }
            case 'ORGANIZER':
                todo.organizer = {
                    email: value.replace(/^mailto:/i, ''),
                    displayName: params.CN,
                };
                break;
            case 'RELATED-TO':
                todo.relatedTo = value.replace(/^mailto:/i, '');
                break;
            default:
                if (!todo.raw) {
                    todo.raw = {};
                }
                const existing = todo.raw[name];
                if (existing) {
                    if (Array.isArray(existing)) {
                        existing.push(value);
                    } else {
                        todo.raw[name] = [existing, value];
                    }
                } else {
                    todo.raw[name] = value;
                }
                break;
        }
    }

    if (!found) {
        throw new Error('Kein VTODO in der Kalenderdatei gefunden');
    }

    return todo;
}

/** Wandelt ein CalDAV-Objekt in eine lesbare Aufgaben-Antwort um. */
export function parseTodo(calendarObject: DAVCalendarObject): ITodoResponse {
    const todo = parseTodoICal(calendarObject.data);

    return {
        uid: todo.uid ?? '',
        url: calendarObject.url ?? '',
        etag: calendarObject.etag ?? '',
        title: todo.summary ?? '',
        description: todo.description ?? '',
        due: todo.due,
        rawDUE: todo.rawDUE,
        tzidDue: todo.tzidDue,
        start: todo.start,
        rawDTStart: todo.rawDTStart,
        tzidStart: todo.tzidStart,
        completed: todo.completed,
        status: todo.status,
        percentComplete: todo.percentComplete,
        priority: todo.priority,
        categories: todo.categories,
        class: todo.class,
        created: todo.created,
        lastModified: todo.lastModified,
        dtstamp: todo.dtstamp,
        sequence: todo.sequence,
        organizer: todo.organizer,
        relatedTo: todo.relatedTo,
        rawProperties: todo.raw,
    };
}

// ---------------------------------------------------------------------------
// VTODO erzeugen
// ---------------------------------------------------------------------------

function resolveTimeZone(requested?: string, ...fallbacks: Array<string | undefined>): string {
    const candidates = [requested, ...fallbacks];
    for (const candidate of candidates) {
        const value = typeof candidate === 'string' ? candidate.trim() : '';
        if (isValidTimeZone(value)) {
            return value;
        }
    }
    return '';
}

/**
 * Erzeugt den iCal-String für eine neue Aufgabe.
 * DTSTART und DUE werden bewusst im gleichen Format geschrieben (RFC 5545
 * verlangt für beide Properties denselben Werttyp).
 */
export function generateTodoICal(data: ITodoCreate, uid: string): string {
    const timestamp = formatUtcDateTime(new Date());
    const timeZone = resolveTimeZone(data.timeZone);
    const dateOnly = data.dateOnly === true;

    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:${PRODID}`,
        'CALSCALE:GREGORIAN',
        'BEGIN:VTODO',
        `UID:${uid}`,
        `DTSTAMP:${timestamp}`,
        `CREATED:${timestamp}`,
        `SUMMARY:${escapeICalText(data.title)}`,
    ];

    if (data.description) {
        lines.push(`DESCRIPTION:${escapeICalText(data.description)}`);
    }

    const status = data.status ?? 'NEEDS-ACTION';
    lines.push(`STATUS:${status}`);

    const percent = resolvePercentComplete(status, data.percentComplete);
    if (percent !== undefined) {
        lines.push(`PERCENT-COMPLETE:${percent}`);
    }

    if (status === 'COMPLETED') {
        lines.push(`COMPLETED:${timestamp}`);
    }

    if (data.priority !== undefined && data.priority !== null) {
        lines.push(`PRIORITY:${data.priority}`);
    }

    if (data.start) {
        lines.push(buildDateProperty('DTSTART', data.start, { timeZone, dateOnly }));
    }
    if (data.due) {
        lines.push(buildDateProperty('DUE', data.due, { timeZone, dateOnly }));
    }

    if (data.categories) {
        lines.push(`CATEGORIES:${data.categories.split(',').map((c) => escapeICalText(c.trim())).filter(Boolean).join(',')}`);
    }

    lines.push('END:VTODO', 'END:VCALENDAR');

    return lines.map(foldICalLine).join('\r\n');
}

/**
 * STATUS und PERCENT-COMPLETE müssen zusammenpassen.
 * Erzwungener Abschluss liefert 100, "neu" liefert 0.
 */
function resolvePercentComplete(status: string, percent?: number): number | undefined {
    if (typeof percent === 'number' && !isNaN(percent)) {
        return Math.min(100, Math.max(0, Math.round(percent)));
    }
    if (status === 'COMPLETED') {
        return 100;
    }
    if (status === 'NEEDS-ACTION') {
        return 0;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// VTODO aktualisieren
// ---------------------------------------------------------------------------

/** Eine Änderung an einer Property: `line` undefined entfernt die Property. */
export interface ITodoPropertyEdit {
    name: string;
    line?: string;
}

/**
 * Übersetzt die gewünschten Änderungen in einzelne Property-Änderungen.
 * Unveränderte Properties bleiben unangetastet, damit serverseitige oder
 * app-spezifische Properties (z. B. von Nextcloud/Deck) nicht verloren gehen.
 */
export function buildTodoEdits(changes: Partial<ITodoBase>, existing: ITodoICal): ITodoPropertyEdit[] {
    const edits: ITodoPropertyEdit[] = [];

    if (changes.title !== undefined) {
        edits.push({ name: 'SUMMARY', line: `SUMMARY:${escapeICalText(changes.title)}` });
    }

    if (changes.description !== undefined) {
        edits.push({
            name: 'DESCRIPTION',
            line: changes.description === '' ? undefined : `DESCRIPTION:${escapeICalText(changes.description)}`,
        });
    }

    if (changes.status !== undefined) {
        const status = changes.status;
        edits.push({ name: 'STATUS', line: `STATUS:${status}` });

        if (status === 'COMPLETED') {
            // Zeitpunkt des Abschlusses nur setzen, wenn die Aufgabe nicht schon erledigt war
            if (existing.status !== 'COMPLETED') {
                edits.push({ name: 'COMPLETED', line: `COMPLETED:${formatUtcDateTime(new Date())}` });
            }
        } else {
            // Eine erledigte Aufgabe, die wieder offen wird, darf kein COMPLETED behalten
            edits.push({ name: 'COMPLETED', line: undefined });
        }

        const percent = resolvePercentComplete(status, changes.percentComplete);
        if (percent !== undefined) {
            edits.push({ name: 'PERCENT-COMPLETE', line: `PERCENT-COMPLETE:${percent}` });
        }
    } else if (changes.percentComplete !== undefined) {
        // 0 entfernt die Property, alles andere setzt den Fortschritt
        if (changes.percentComplete === 0) {
            edits.push({ name: 'PERCENT-COMPLETE', line: undefined });
        } else {
            const percent = resolvePercentComplete('IN-PROCESS', changes.percentComplete);
            if (percent !== undefined) {
                edits.push({ name: 'PERCENT-COMPLETE', line: `PERCENT-COMPLETE:${percent}` });
            }
        }
    }

    if (changes.priority !== undefined) {
        edits.push({
            name: 'PRIORITY',
            line: changes.priority === null || changes.priority === 0 ? undefined : `PRIORITY:${changes.priority}`,
        });
    }

    if (changes.categories !== undefined) {
        const categories = changes.categories
            .split(',')
            .map((category) => category.trim())
            .filter(Boolean);
        edits.push({
            name: 'CATEGORIES',
            line: categories.length
                ? `CATEGORIES:${categories.map((category) => escapeICalText(category)).join(',')}`
                : undefined,
        });
    }

    edits.push(...buildDateEdits(changes, existing));

    return edits;
}

/**
 * Baut die Änderungen für DUE/DTSTART.
 * Werttyp und Zeitzone des Gegenstücks werden angeglichen, weil RFC 5545 für
 * DUE und DTSTART denselben Werttyp innerhalb einer Komponente verlangt.
 */
function buildDateEdits(changes: Partial<ITodoBase>, existing: ITodoICal): ITodoPropertyEdit[] {
    const isSet = (value?: string): boolean => value !== undefined && value !== '';
    const isCleared = (value?: string): boolean => value === '';

    const dueSet = isSet(changes.due);
    const startSet = isSet(changes.start);
    const dueCleared = isCleared(changes.due);
    const startCleared = isCleared(changes.start);

    if (!dueSet && !startSet && !dueCleared && !startCleared) {
        return [];
    }

    // Werttyp bestimmen: explizite Angabe hat Vorrang, eine gewählte Zeitzone
    // bedeutet "mit Uhrzeit", sonst wird der Werttyp der bestehenden Aufgabe übernommen.
    const existingDateOnly = existing.dueDateOnly || existing.startDateOnly;
    const hasRequestedTimeZone = typeof changes.timeZone === 'string' && changes.timeZone.trim().length > 0;
    const dateOnly = changes.dateOnly !== undefined
        ? changes.dateOnly
        : hasRequestedTimeZone
            ? false
            : !!existingDateOnly;
    const timeZone = resolveTimeZone(changes.timeZone, existing.tzidDue, existing.tzidStart);

    const edits: ITodoPropertyEdit[] = [];

    if (dueSet) {
        edits.push({ name: 'DUE', line: buildDateProperty('DUE', changes.due, { timeZone, dateOnly }) });
    } else if (dueCleared) {
        edits.push({ name: 'DUE', line: undefined });
    }

    if (startSet) {
        edits.push({ name: 'DTSTART', line: buildDateProperty('DTSTART', changes.start, { timeZone, dateOnly }) });
    } else if (startCleared) {
        edits.push({ name: 'DTSTART', line: undefined });
    }

    // Das nicht angefasste Gegenstück auf denselben Werttyp bringen (RFC 5545).
    // Eine bestehende Zeitzone wird dabei nicht angetastet, sonst verschiebt sich die Uhrzeit.
    const dueEdited = edits.some((edit) => edit.name === 'DUE');
    const startEdited = edits.some((edit) => edit.name === 'DTSTART');

    if (!dueEdited && existing.due && existing.dueDateOnly !== dateOnly) {
        edits.push({ name: 'DUE', line: buildDateProperty('DUE', existing.due, { timeZone, dateOnly }) });
    }
    if (!startEdited && existing.start && existing.startDateOnly !== dateOnly) {
        edits.push({ name: 'DTSTART', line: buildDateProperty('DTSTART', existing.start, { timeZone, dateOnly }) });
    }

    return edits;
}

/**
 * Wendet Property-Änderungen auf einen bestehenden iCal-String an.
 * Unbeteiligte Zeilen (inklusive fremder Properties) bleiben unverändert.
 */
export function mergeTodoICal(
    existingIcs: string,
    edits: ITodoPropertyEdit[],
    options: { incrementSequence?: boolean } = {},
): string {
    const lines = unfoldICalLines(existingIcs);

    const beginIdx = lines.findIndex((line) => {
        const { name, value } = splitICalLine(line);
        return name === 'BEGIN' && value.toUpperCase() === 'VTODO';
    });
    const endIdx = lines.findIndex((line, index) => {
        if (index <= beginIdx) {
            return false;
        }
        const { name, value } = splitICalLine(line);
        return name === 'END' && value.toUpperCase() === 'VTODO';
    });

    if (beginIdx === -1 || endIdx === -1) {
        throw new Error('Kein VTODO in der Kalenderdatei gefunden');
    }

    const timestamp = formatUtcDateTime(new Date());
    const allEdits: ITodoPropertyEdit[] = [
        ...edits,
        { name: 'DTSTAMP', line: `DTSTAMP:${timestamp}` },
    ];

    if (options.incrementSequence !== false) {
        const sequenceLine = lines
            .slice(beginIdx + 1, endIdx)
            .find((line) => splitICalLine(line).name === 'SEQUENCE');
        const currentSequence = sequenceLine ? Number(splitICalLine(sequenceLine).value) : 0;
        const nextSequence = (isNaN(currentSequence) ? 0 : currentSequence) + 1;
        allEdits.push({ name: 'SEQUENCE', line: `SEQUENCE:${nextSequence}` });
    }

    const editsByName = new Map<string, ITodoPropertyEdit>();
    for (const edit of allEdits) {
        if (!editsByName.has(edit.name)) {
            editsByName.set(edit.name, edit);
        }
    }

    const applied = new Set<string>();
    const result: string[] = lines.slice(0, beginIdx + 1);

    for (let i = beginIdx + 1; i < endIdx; i++) {
        const line = lines[i];
        const { name } = splitICalLine(line);
        const edit = editsByName.get(name);

        if (!edit) {
            result.push(line);
            continue;
        }

        // Mehrfache Vorkommen: nur die erste ersetzen, den Rest entfernen
        if (applied.has(name)) {
            continue;
        }
        applied.add(name);
        if (edit.line !== undefined) {
            result.push(edit.line);
        }
    }

    // Neue Properties vor END:VTODO einfügen
    for (const edit of editsByName.values()) {
        if (!applied.has(edit.name) && edit.line !== undefined) {
            result.push(edit.line);
        }
    }

    result.push(...lines.slice(endIdx));

    return result.map(foldICalLine).join('\r\n');
}