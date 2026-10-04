import { INodeProperties } from 'n8n-workflow';

// Ressourcendefinition: Kalender oder Termin
export const resources: INodeProperties[] = [
    {
        displayName: 'Ressource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
            {
                name: 'Kalender',
                value: 'calendar',
                description: 'Kalender erstellen und verwalten'
            },
            {
                name: 'Termin',
                value: 'event',
                description: 'Termine planen und organisieren'
            },
            {
                name: 'Aufgabe',
                value: 'todo',
                description: 'Aufgaben (VTODO) suchen, anlegen, ändern und löschen'
            }
        ],
        default: 'calendar',
        required: true,
    },
]; 