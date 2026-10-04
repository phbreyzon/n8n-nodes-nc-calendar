import { IExecuteFunctions } from 'n8n-workflow';
import { DAVCalendar, DAVCalendarObject, DAVClient } from 'tsdav';
import { initClient } from '../helpers/client';
import { findCalendar } from './calendar';
import {
    buildTodoEdits,
    generateTodoICal,
    mergeTodoICal,
    parseTodo,
    parseTodoICal,
} from '../helpers/todo';
import { ITodoCreate, ITodoResponse, ITodoUpdate } from '../interfaces/todo';

export interface ITodoQuery {
    /** Nur Aufgaben mit diesem Status zurückgeben. */
    status?: string;
    /** Nur Aufgaben, deren Fälligkeit in diesem Zeitraum liegt. */
    dueFrom?: string;
    dueUntil?: string;
    /** Obergrenze der zurückgegebenen Aufgaben. */
    limit?: number;
}

/** Angelegter CalDAV-Zugang und aufgelöster Kalender für eine Operation. */
interface ITodoContext {
    client: DAVClient;
    calendar: DAVCalendar;
}

/**
 * CalDAV-Query für VTODO.
 *
 * Anders als bei VEVENT gibt es für VTODO keinen sinnvollen Zeitraumfilter:
 * Fälligkeit und Startzeit sind beide optional, und Aufgaben ohne DUE fallen bei
 * einem time-range-Filter vollständig heraus. Deshalb wird ohne Zeitraum gefiltert
 * und anschließend lokal nach Fälligkeit eingegrenzt.
 */
async function fetchTodoObjects(
    todoContext: ITodoContext,
    uid?: string,
): Promise<DAVCalendarObject[]> {
    const innerCompFilter: Record<string, unknown> = {
        _attributes: {
            name: 'VTODO',
        },
    };

    if (uid) {
        innerCompFilter['prop-filter'] = {
            _attributes: {
                name: 'UID',
                test: 'equals',
            },
            'text-match': {
                _attributes: {
                    'match-type': 'equals',
                },
                _text: uid,
            },
        };
    }

    return todoContext.client.fetchCalendarObjects({
        calendar: todoContext.calendar,
        filters: [
            {
                'comp-filter': {
                    _attributes: {
                        name: 'VCALENDAR',
                    },
                    'comp-filter': innerCompFilter,
                },
            },
        ],
    });
}

/**
 * Baut Client und Kalender einmalig auf.
 * Jede Operation meldet sich nur einmal an, statt pro Aufruf erneut.
 */
async function createTodoContext(
    context: IExecuteFunctions,
    calendarName: string,
): Promise<ITodoContext> {
    const client = await initClient(context);
    const calendar = await findCalendar(context, client, calendarName);
    return { client, calendar };
}

/** Lädt alle Aufgaben eines Kalenders und filtert sie optional. */
export async function getTodos(
    context: IExecuteFunctions,
    calendarName: string,
    query: ITodoQuery = {},
): Promise<ITodoResponse[]> {
    const todoContext = await createTodoContext(context, calendarName);
    const objects = await fetchTodoObjects(todoContext);
    return applyQuery(objects.map(parseTodo), query);
}

/** Holt eine einzelne Aufgabe über ihre UID. */
export async function getTodo(
    context: IExecuteFunctions,
    calendarName: string,
    todoId: string,
): Promise<ITodoResponse> {
    const todoContext = await createTodoContext(context, calendarName);
    const objects = await fetchTodoObjects(todoContext, todoId);

    if (!objects || objects.length === 0) {
        throw new Error(`Aufgabe mit ID "${todoId}" nicht gefunden`);
    }

    return parseTodo(objects[0]);
}

/** Sucht Aufgaben nach Begriff in Titel und Beschreibung. */
export async function searchTodos(
    context: IExecuteFunctions,
    calendarName: string,
    searchTerm: string,
    query: ITodoQuery = {},
): Promise<ITodoResponse[]> {
    const todos = await getTodos(context, calendarName, { ...query, limit: undefined });
    const needle = searchTerm.trim().toLowerCase();

    if (!needle) {
        return todos;
    }

    return todos.filter((todo) => {
        const title = (todo.title ?? '').toLowerCase();
        const description = (todo.description ?? '').toLowerCase();
        return title.includes(needle) || description.includes(needle);
    });
}

/** Legt eine neue Aufgabe an. */
export async function createTodo(
    context: IExecuteFunctions,
    data: ITodoCreate,
) {
    const todoContext = await createTodoContext(context, data.calendarName);

    const uid = `n8n-${Date.now()}@nextcloud-calendar`;
    const iCalString = generateTodoICal(data, uid);

    const response = await todoContext.client.createCalendarObject({
        calendar: todoContext.calendar,
        filename: `${uid}.ics`,
        iCalString,
    });

    const result: Record<string, unknown> = {
        success: true,
        message: 'Aufgabe erfolgreich erstellt',
        uid,
        details: {
            title: data.title,
            due: data.due,
            status: data.status ?? 'NEEDS-ACTION',
        },
    };

    appendResponseMetadata(result, response);

    return result;
}

/**
 * Aktualisiert eine Aufgabe.
 *
 * Die bestehende Datei wird nicht neu aufgebaut, sondern es werden nur die
 * gewünschten Properties ersetzt. So bleiben serverseitige Properties erhalten,
 * die der Node nicht kennt (etwa die von Nextcloud/Deck gesetzten X-Properties).
 */
export async function updateTodo(
    context: IExecuteFunctions,
    data: ITodoUpdate,
) {
    const todoContext = await createTodoContext(context, data.calendarName);

    const objects = await fetchTodoObjects(todoContext, data.todoId);

    if (!objects || objects.length === 0) {
        throw new Error(`Aufgabe mit ID "${data.todoId}" nicht gefunden`);
    }

    const calendarObject = objects[0];
    const existing = parseTodoICal(calendarObject.data);
    const edits = buildTodoEdits(data, existing);
    const iCalString = mergeTodoICal(calendarObject.data, edits);

    const response = await todoContext.client.updateCalendarObject({
        calendarObject: {
            ...calendarObject,
            data: iCalString,
        },
    });

    const updated = parseTodoICal(iCalString);

    const result: Record<string, unknown> = {
        success: true,
        message: 'Aufgabe erfolgreich aktualisiert',
        uid: updated.uid || data.todoId,
        details: {
            title: updated.summary,
            due: updated.due,
            status: updated.status,
            percentComplete: updated.percentComplete,
            changedProperties: edits.filter((edit) => edit.line !== undefined).map((edit) => edit.name),
        },
    };

    appendResponseMetadata(result, response);

    return result;
}

/** Löscht eine Aufgabe über ihre UID. */
export async function deleteTodo(
    context: IExecuteFunctions,
    calendarName: string,
    todoId: string,
) {
    const todoContext = await createTodoContext(context, calendarName);

    const objects = await fetchTodoObjects(todoContext, todoId);

    if (!objects || objects.length === 0) {
        throw new Error(`Aufgabe mit ID "${todoId}" nicht gefunden`);
    }

    await todoContext.client.deleteCalendarObject({
        calendarObject: objects[0],
    });

    return { success: true };
}

/** Wendet Status-, Fälligkeits- und Mengenfilter auf eine Aufgabenliste an. */
function applyQuery(todos: ITodoResponse[], query: ITodoQuery): ITodoResponse[] {
    let result = sortTodos(todos);

    if (query.status && query.status !== 'ALL') {
        const status = query.status.toUpperCase();
        if (status === 'OPEN') {
            result = result.filter((todo) => todo.status !== 'COMPLETED' && todo.status !== 'CANCELLED');
        } else {
            result = result.filter((todo) => (todo.status ?? 'NEEDS-ACTION').toUpperCase() === status);
        }
    }

    if (query.dueFrom || query.dueUntil) {
        const from = query.dueFrom ? new Date(query.dueFrom).getTime() : undefined;
        const until = query.dueUntil ? new Date(query.dueUntil).getTime() : undefined;

        result = result.filter((todo) => {
            if (!todo.due) {
                // Aufgaben ohne Fälligkeitsdatum fallen aus einem Zeitraumfilter heraus
                return false;
            }
            const due = new Date(todo.due).getTime();
            if (isNaN(due)) {
                return false;
            }
            if (from !== undefined && due < from) {
                return false;
            }
            if (until !== undefined && due > until) {
                return false;
            }
            return true;
        });
    }

    if (query.limit && query.limit > 0) {
        result = result.slice(0, query.limit);
    }

    return result;
}

/**
 * Sortiert nach Fälligkeit, Aufgaben ohne Fälligkeit ans Ende.
 * Ohne feste Reihenfolge wäre die Ausgabe des Servers von der jeweiligen
 * Antwort abhängig, was in Workflows schwer nachvollziehbar ist.
 */
function sortTodos(todos: ITodoResponse[]): ITodoResponse[] {
    return [...todos].sort((a, b) => {
        if (a.due === b.due) {
            return (a.title ?? '').localeCompare(b.title ?? '', 'de');
        }
        if (!a.due) {
            return 1;
        }
        if (!b.due) {
            return -1;
        }
        return new Date(a.due).getTime() - new Date(b.due).getTime();
    });
}

/** Hängt URL und ETag der Serverantwort an, sofern vorhanden. */
function appendResponseMetadata(result: Record<string, unknown>, response: unknown): void {
    if (!response || typeof response !== 'object') {
        return;
    }

    const asRecord = response as { url?: unknown; etag?: unknown };
    if (asRecord.url !== undefined) {
        result.url = asRecord.url;
    }
    if (asRecord.etag !== undefined) {
        result.etag = String(asRecord.etag);
    }
}