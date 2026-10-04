/**
 * Hilfsfunktionen zur Erzeugung von iCalendar-Datumswerten.
 *
 * Extrahert aus dem Event-Modul, damit Termine und Aufgaben (VTODO)
 * dieselbe Formatierung verwenden.
 */

/** Formatiert ein Datum als echten UTC-Zeitstempel (DTSTART:20250101T120000Z) */
export function formatUtcDateTime(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** Prüft, ob die Zeitzone von Intl unterstützt wird */
export function isValidTimeZone(timeZone: string): boolean {
    if (!timeZone) {
        return false;
    }
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

/**
 * Formatiert den Zeitpunkt als lokale Wandzeit der angegebenen Zeitzone
 * (DTSTART;TZID=Europe/Berlin:20250101T120000).
 *
 * Wichtig: Es wird die Wandzeit der Ziel-Zeitzone verwendet, nicht die Serverzeit.
 * Sonst entstehen Verschiebungen, sobald die gewählte Zeitzone nicht der Systemzeitzone entspricht.
 */
export function formatDateTimeInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);

    const get = (type: string, fallback = '00'): string =>
        parts.find((part) => part.type === type)?.value ?? fallback;

    return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

/** Formatiert ein Datum als reines Datum (VALUE=DATE:20250101) */
export function formatDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const get = (type: string, fallback = '01'): string =>
        parts.find((part) => part.type === type)?.value ?? fallback;

    return `${get('year')}${get('month')}${get('day')}`;
}

/**
 * Zerlegt eine iCal-Datumszeile in Name, Parameter und Wert.
 * Beispiel: `DUE;TZID=Europe/Berlin:20250101T120000`
 */
export function splitICalLine(line: string): { name: string; params: Record<string, string>; value: string } {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
        return { name: line.trim(), params: {}, value: '' };
    }
    const keyWithParams = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const [name, ...paramParts] = keyWithParams.split(';');
    const params: Record<string, string> = {};
    for (const part of paramParts) {
        const idx = part.indexOf('=');
        if (idx > -1) {
            params[part.slice(0, idx).toUpperCase()] = part.slice(idx + 1);
        }
    }
    return { name: name.trim().toUpperCase(), params, value };
}

/**
 * Wandelt einen iCal-Datumswert in ein JS-Datum um.
 * Berücksichtigt `VALUE=DATE` sowie UTC-Werte (trailing `Z`).
 * Werte mit TZID werden als lokale Wandzeit interpretiert und als UTC interpretiert,
 * damit sie beim Vergleich nicht durch die Serverzeitzone verschoben werden.
 */
export function parseICalDateValue(value: string): Date | undefined {
    const raw = value.trim();
    const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
    if (!match) {
        const fallback = new Date(raw);
        return isNaN(fallback.getTime()) ? undefined : fallback;
    }

    const [, year, month, day, hour, minute, second] = match;
    return new Date(
        Date.UTC(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            hour ? parseInt(hour, 10) : 0,
            minute ? parseInt(minute, 10) : 0,
            second ? parseInt(second, 10) : 0,
        ),
    );
}

/**
 * Erzeugt eine Datumszeile.
 * Mit Zeitzone als lokale Wandzeit mit TZID, ohne Zeitzone als echter UTC-Zeit,
 * als `dateOnly` als reines Datum mit VALUE=DATE.
 */
export function buildDateProperty(
    name: 'DTSTART' | 'DTEND' | 'DUE',
    value: string | Date | undefined,
    options: { timeZone?: string; dateOnly?: boolean; fallback?: Date } = {},
): string {
    const { timeZone = '', dateOnly = false, fallback } = options;

    let date: Date;
    if (value === undefined || value === null || value === '') {
        date = fallback ?? new Date();
    } else {
        date = value instanceof Date ? value : parseICalDateValue(String(value)) ?? new Date(String(value));
    }
    if (isNaN(date.getTime())) {
        date = fallback ?? new Date();
    }

    if (dateOnly) {
        return `${name};VALUE=DATE:${formatDate(date)}`;
    }

    return timeZone && isValidTimeZone(timeZone)
        ? `${name};TZID=${timeZone}:${formatDateTimeInTimeZone(date, timeZone)}`
        : `${name}:${formatUtcDateTime(date)}`;
}