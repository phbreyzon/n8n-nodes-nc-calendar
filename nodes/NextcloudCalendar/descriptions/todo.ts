import { INodeProperties } from 'n8n-workflow';
import { TODO_STATUSES } from '../interfaces/todo';

// Aufgaben-Operationen
export const todoOperations: INodeProperties[] = [
    {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
            show: {
                resource: ['todo'],
            },
        },
        options: [
            {
                name: 'Aufgaben Suchen',
                value: 'search',
                description: 'Sucht nach Aufgaben anhand von Titel und Beschreibung',
                action: 'Search for tasks',
            },
            {
                name: 'Alle Aufgaben Anzeigen',
                value: 'getAll',
                description: 'Lädt alle Aufgaben eines Kalenders',
                action: 'Get many tasks',
            },
            {
                name: 'Aufgabe Anzeigen',
                value: 'get',
                description: 'Zeigt eine einzelne Aufgabe an',
                action: 'Display a task',
            },
            {
                name: 'Aufgabe Erstellen',
                value: 'create',
                description: 'Erstellt eine neue Aufgabe',
                action: 'Create a new task',
            },
            {
                name: 'Aufgabe Ändern',
                value: 'update',
                description: 'Ändert eine bestehende Aufgabe',
                action: 'Update an existing task',
            },
            {
                name: 'Aufgabe Löschen',
                value: 'delete',
                description: 'Löscht eine Aufgabe',
                action: 'Delete a task',
            },
        ],
        default: 'getAll',
    },
];

const statusOptions = [
    {
        name: 'Offen (nicht erledigt und nicht abgebrochen)',
        value: 'OPEN',
    },
    {
        name: 'Alle',
        value: 'ALL',
    },
    ...TODO_STATUSES.map((status) => ({
        name:
            status === 'NEEDS-ACTION'
                ? 'Zu erledigen'
                : status === 'IN-PROCESS'
                    ? 'In Bearbeitung'
                    : status === 'COMPLETED'
                        ? 'Erledigt'
                        : 'Abgebrochen',
        value: status as string,
    })),
];

export const todoFields: INodeProperties[] = [
    // Kalender-Auswahl für alle Aufgaben-Operationen
    {
        displayName: 'Kalender',
        name: 'calendarName',
        type: 'resourceLocator',
        default: '',
        required: true,
        description: 'Wählen Sie einen Kalender aus der Liste oder geben Sie dessen ID an',
        modes: [
            {
                displayName: 'Liste',
                name: 'list',
                type: 'list',
                typeOptions: {
                    searchListMethod: 'getCalendars',
                    searchable: true,
                    searchFilterRequired: false,
                },
            },
            {
                displayName: 'ID',
                name: 'id',
                type: 'string',
                placeholder: 'Kalender-ID',
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: '^.+$',
                            errorMessage: 'Bitte eine gültige Kalender-ID eingeben',
                        },
                    },
                ],
            },
        ],
        displayOptions: {
            show: {
                resource: ['todo'],
            },
        },
        // @ts-expect-error: AIEnabled ist kein Standardfeld, wird aber von n8n AI genutzt
        AIEnabled: true,
    },

    // Aufgaben-ID
    {
        displayName: 'Aufgaben ID',
        name: 'todoId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['delete', 'get', 'update'],
            },
        },
        description: 'UID der Aufgabe, wie sie von den Lese-Operationen zurückgegeben wird',
    },

    // Felder zum Anlegen einer Aufgabe
    {
        displayName: 'Titel',
        name: 'title',
        type: 'string',
        required: true,
        default: '',
        typeOptions: {
            canBeExpression: true,
            AIEnabled: true,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Titel der Aufgabe',
    },
    {
        displayName: 'Beschreibung',
        name: 'description',
        type: 'string',
        default: '',
        typeOptions: {
            canBeExpression: true,
            AIEnabled: true,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Beschreibung der Aufgabe',
    },
    {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        options: [
            {
                name: 'Zu erledigen',
                value: 'NEEDS-ACTION',
            },
            {
                name: 'In Bearbeitung',
                value: 'IN-PROCESS',
            },
            {
                name: 'Erledigt',
                value: 'COMPLETED',
            },
            {
                name: 'Abgebrochen',
                value: 'CANCELLED',
            },
        ],
        default: 'NEEDS-ACTION',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Status der Aufgabe',
    },
    {
        displayName: 'Fortschritt in Prozent',
        name: 'percentComplete',
        type: 'number',
        default: 0,
        typeOptions: {
            minValue: 0,
            maxValue: 100,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Fortschritt in Prozent. Wird bei Status "Erledigt" automatisch auf 100 gesetzt.',
    },
    {
        displayName: 'Priorität',
        name: 'priority',
        type: 'number',
        default: 0,
        typeOptions: {
            minValue: 0,
            maxValue: 9,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: '1 = höchste Priorität, 9 = niedrigste Priorität, 0 = keine Priorität',
    },
    {
        displayName: 'Kategorien',
        name: 'categories',
        type: 'string',
        default: '',
        typeOptions: {
            canBeExpression: true,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Kommagetrennte Liste von Kategorien, z. B. " privat, dringend"',
    },
    {
        displayName: 'Fällig am',
        name: 'due',
        type: 'dateTime',
        default: '',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Wann die Aufgabe fällig ist',
    },
    {
        displayName: 'Start',
        name: 'start',
        type: 'dateTime',
        default: '',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Wann mit der Aufgabe begonnen wird',
    },
    {
        displayName: 'Nur Datum ohne Uhrzeit',
        name: 'dateOnly',
        type: 'boolean',
        default: false,
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description: 'Fälligkeit und Start als reines Datum (VALUE=DATE) statt mit Uhrzeit schreiben',
    },
    {
        displayName: 'Zeitzone',
        name: 'timeZone',
        type: 'resourceLocator',
        default: '',
        placeholder: 'Europe/Berlin (empfohlen) oder leer für UTC',
        modes: [
            {
                displayName: 'Liste',
                name: 'list',
                type: 'list',
                typeOptions: {
                    searchListMethod: 'getTimeZones',
                    searchable: true,
                    searchFilterRequired: false,
                },
            },
            {
                displayName: 'ID',
                name: 'id',
                type: 'string',
                placeholder: 'IANA-Zeitzone, z. B. Europe/Berlin',
                validation: [
                    {
                        type: 'regex',
                        properties: {
                            regex: '^[A-Za-z_]+\/[A-Za-z0-9_\-+]+$',
                            errorMessage: 'Bitte eine gültige IANA-Zeitzone eingeben (z. B. Europe/Berlin)',
                        },
                    },
                ],
            },
        ],
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['create'],
            },
        },
        description:
            'Wird nur benötigt, wenn Fälligkeit oder Start als Datum mit Uhrzeit geschrieben werden. Leer lassen für UTC.',
        // @ts-expect-error: AIEnabled ist kein Standardfeld, wird aber von n8n AI genutzt
        AIEnabled: true,
    },

    // Felder zum Ändern einer Aufgabe
    {
        displayName: 'Update Fields',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Feld aktualisieren',
        default: {},
        options: [
            {
                displayName: 'Titel',
                name: 'title',
                type: 'string',
                default: '',
                typeOptions: {
                    canBeExpression: true,
                    AIEnabled: true,
                },
                description: 'Neuer Titel der Aufgabe',
            },
            {
                displayName: 'Beschreibung',
                name: 'description',
                type: 'string',
                default: '',
                typeOptions: {
                    canBeExpression: true,
                    AIEnabled: true,
                },
                description: 'Neue Beschreibung der Aufgabe',
            },
            {
                displayName: 'Status',
                name: 'status',
                type: 'options',
                options: [
                    {
                        name: 'Unverändert',
                        value: '',
                    },
                    ...statusOptions
                        .filter((option) => option.value !== 'ALL' && option.value !== 'OPEN')
                        .map((option) => ({
                            name: option.name,
                            value: option.value,
                        })),
                ],
                default: '',
                description: 'Neuer Status der Aufgabe',
            },
            {
                displayName: 'Fortschritt in Prozent',
                name: 'percentComplete',
                type: 'number',
                default: 0,
                typeOptions: {
                    minValue: 0,
                    maxValue: 100,
                },
                description: 'Neuer Fortschritt in Prozent. 0 entfernt die Property.',
            },
            {
                displayName: 'Priorität',
                name: 'priority',
                type: 'number',
                default: 0,
                typeOptions: {
                    minValue: 0,
                    maxValue: 9,
                },
                description: 'Neue Priorität (1-9). 0 lässt die Priorität unverändert.',
            },
            {
                displayName: 'Kategorien',
                name: 'categories',
                type: 'string',
                default: '',
                typeOptions: {
                    canBeExpression: true,
                },
                description: 'Neue Kategorien, kommagetrennt',
            },
            {
                displayName: 'Fällig am',
                name: 'due',
                type: 'dateTime',
                default: '',
                description: 'Neue Fälligkeit. Zum Entfernen unten "Felder entfernen" verwenden.',
            },
            {
                displayName: 'Start',
                name: 'start',
                type: 'dateTime',
                default: '',
                description: 'Neuer Startzeitpunkt. Zum Entfernen unten "Felder entfernen" verwenden.',
            },
            {
                displayName: 'Nur Datum ohne Uhrzeit',
                name: 'dateOnly',
                type: 'boolean',
                default: false,
                description:
                    'Fälligkeit und Start als reines Datum (VALUE=DATE) schreiben. Ohne Angabe wird das Format der bestehenden Aufgabe übernommen.',
            },
            {
                displayName: 'Zeitzone',
                name: 'timeZone',
                type: 'resourceLocator',
                default: '',
                placeholder: 'leer für UTC oder die Zeitzone der Aufgabe',
                modes: [
                    {
                        displayName: 'Liste',
                        name: 'list',
                        type: 'list',
                        typeOptions: {
                            searchListMethod: 'getTimeZones',
                            searchable: true,
                            searchFilterRequired: false,
                        },
                    },
                    {
                        displayName: 'ID',
                        name: 'id',
                        type: 'string',
                        placeholder: 'IANA-Zeitzone, z. B. Europe/Berlin',
                    },
                ],
                description: 'Leer lassen, um die Zeitzone der bestehenden Aufgabe zu übernehmen. Eine gewählte Zeitzone schreibt Fälligkeit und Start mit Uhrzeit.',
            },
            {
                displayName: 'Felder entfernen',
                name: 'clearFields',
                type: 'multiOptions',
                options: [
                    {
                        name: 'Fälligkeit (DUE)',
                        value: 'DUE',
                    },
                    {
                        name: 'Start (DTSTART)',
                        value: 'DTSTART',
                    },
                    {
                        name: 'Beschreibung (DESCRIPTION)',
                        value: 'DESCRIPTION',
                    },
                    {
                        name: 'Kategorien (CATEGORIES)',
                        value: 'CATEGORIES',
                    },
                    {
                        name: 'Priorität (PRIORITY)',
                        value: 'PRIORITY',
                    },
                    {
                        name: 'Fortschritt (PERCENT-COMPLETE)',
                        value: 'PERCENT-COMPLETE',
                    },
                ],
                default: [],
                description:
                    'Entfernt die gewählten Properties aus der Aufgabe. Ein leeres Feld allein entfernt nichts, damit unbeabsichtigte Änderungen ausbleiben.',
            },
        ],
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['update'],
            },
        },
    },

    // Filter für getAll und search
    {
        displayName: 'Status',
        name: 'statusFilter',
        type: 'options',
        options: statusOptions,
        default: 'ALL',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['getAll', 'search'],
            },
        },
        description: 'Aufgaben auf diesen Status einschränken',
    },
    {
        displayName: 'Fällig ab',
        name: 'dueFrom',
        type: 'dateTime',
        default: '',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['getAll', 'search'],
            },
        },
        description: 'Nur Aufgaben, die ab diesem Zeitpunkt fällig sind. Leer lassen für keine Grenze.',
    },
    {
        displayName: 'Fällig bis',
        name: 'dueUntil',
        type: 'dateTime',
        default: '',
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['getAll', 'search'],
            },
        },
        description: 'Nur Aufgaben, die bis zu diesem Zeitpunkt fällig sind. Leer lassen für keine Grenze.',
    },
    {
        displayName: 'Max. Anzahl Aufgaben',
        name: 'limit',
        type: 'number',
        default: 0,
        typeOptions: {
            minValue: 0,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['getAll', 'search'],
            },
        },
        description: 'Begrenzt die Anzahl der zurückgegebenen Aufgaben. 0 bedeutet keine Begrenzung.',
    },

    // Suchbegriff
    {
        displayName: 'Suchbegriff',
        name: 'searchTerm',
        type: 'string',
        required: true,
        default: '',
        typeOptions: {
            canBeExpression: true,
            AIEnabled: true,
        },
        displayOptions: {
            show: {
                resource: ['todo'],
                operation: ['search'],
            },
        },
        description: 'Suchbegriff für Titel und Beschreibung der Aufgaben',
    },
];