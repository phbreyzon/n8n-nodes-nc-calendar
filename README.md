# n8n-nodes-nc-calendar

Dieser n8n-Community-Node ermöglicht die Integration mit dem Nextcloud-Kalender (CalDAV).

> **Hinweis zur Herkunft:** Dieses Paket ist ein Community-Fork von
> [`n8n-nodes-nextcloud-calendar`](https://www.npmjs.com/package/n8n-nodes-nextcloud-calendar)
> von Niko Terschawetz und steht wie das Original unter der MIT-Lizenz
> (siehe [LICENSE.md](LICENSE.md) für den urheberrechtlichen Hinweis).
> Das Original wird als `upstream` Remote weiterverfolgt.

## Features

- Vollständige Integration mit dem Nextcloud-Kalendersystem
- Unterstützung für Kalender- und Terminverwaltung
- Korrekte Zeitzonenbehandlung für Erstellen und Ändern von Terminen
- Nextcloud-spezifische Funktionen wie Einladungen und Benachrichtigungen
- Optimiert für die deutsche Benutzeroberfläche

## Voraussetzungen

- Node.js >= 18 (empfohlen Node 20/22)
- npm >= 10
- Nextcloud mit aktivierter Calendar-App

## Installation

1. Öffnen Sie Ihre n8n-Installation
2. Gehen Sie zu "Einstellungen" > "Community-Nodes"
3. Wählen Sie "Installieren"
4. Geben Sie `n8n-nodes-nc-calendar` ein
5. Klicken Sie auf "Installieren"

Alternativ manuell auf einer selbst gehosteten Instanz:

```bash
mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm i n8n-nodes-nc-calendar
# n8n danach neu starten
```

## Konfiguration

Zugangsdaten in Nextcloud unter *Einstellungen > Sicherheit > App-Passwörter* erzeugen
und in den Credentials **Nextcloud Calendar API** eintragen:

| Feld | Wert |
| --- | --- |
| Nextcloud URL | `https://cloud.example.com` (ohne `/remote.php/dav`) |
| Benutzername | Ihr Nextcloud-Benutzername |
| Passwort | App-Passwort (empfohlen) |

## Zeitzonen

Für die Operationen *Termin Erstellen* und *Termin Ändern* kann eine IANA-Zeitzone
(z. B. `Europe/Berlin`) gewählt werden:

- Ohne Zeitzone werden die Zeiten als echte UTC-Zeitstempel gespeichert.
- Mit Zeitzone wird `DTSTART`/`DTEND` als lokale Zeit der gewählten Zone mit `TZID` geschrieben.
- Beim *Ändern* wird die Zeitzone des bestehenden Termins übernommen, solange das Feld leer bleibt,
  und unveränderte Zeiten bleiben unverändert.

## Unterstützte Operationen

### Kalender
- Kalender erstellen
- Kalender löschen
- Alle Kalender abrufen

### Termine
- Termin erstellen
- Termin aktualisieren
- Termin löschen
- Termin abrufen
- Alle Termine abrufen
- Termine suchen

### Aufgaben (VTODO)
Aufgaben werden als CalDAV-`VTODO` gelesen und geschrieben. Das funktioniert
grundsätzlich in jedem Kalender, der `VTODO` unterstützt - also in der
Nextcloud-App *Tasks*, in *Deck* (Spalten eines Boards) sowie in geteilten
Aufgaben-Kalendern.

- Aufgabe erstellen
- Aufgabe aktualisieren
- Aufgabe löschen
- Aufgabe abrufen
- Alle Aufgaben abrufen
- Aufgaben suchen

Felder einer Aufgabe: Titel, Beschreibung, Status (`NEEDS-ACTION`,
`IN-PROCESS`, `COMPLETED`, `CANCELLED`), Fortschritt in Prozent, Priorität,
Kategorien, Fälligkeit (`DUE`), Start (`DTSTART`) und Zeitzone.

Besonderheiten:

- **Suchen** durchsucht Titel und Beschreibung. Status-, Fälligkeits- und
  Mengenfilter sind für *Suchen* und *Alle Aufgaben* verfügbar.
- **Aktualisieren** ersetzt nur die gewünschten Properties. Alle übrigen Zeilen
  der Kalenderdatei bleiben unangetastet, sodass Properties erhalten bleiben,
  die der Node nicht kennt (etwa die von Nextcloud/Deck gesetzten `X-`-Properties).
  Leere Eingabefelder entfernen nichts - zum Entfernen dient *Felder entfernen*
  in den Update-Feldern.
- **Statuswechsel**: *Erledigt* setzt automatisch `PERCENT-COMPLETE:100` und den
  Zeitpunkt `COMPLETED`. Wird eine erledigte Aufgabe wieder geöffnet, entfernt
  der Node `COMPLETED` und setzt den Fortschritt auf 0.
- **Fälligkeit ohne Uhrzeit**: mit *Nur Datum ohne Uhrzeit* wird `VALUE=DATE`
  geschrieben. Ohne diese Angabe übernimmt der Node den Werttyp der bestehenden
  Aufgabe. Da RFC 5545 für `DUE` und `DTSTART` denselben Werttyp verlangt, wird
  das Gegenstück bei einem Wechsel zwischen Datum und Datum-mit-Uhrzeit
  mitgezogen.

## Entwicklung / Build

- Abhängigkeiten installieren: `npm install`
- Build erzeugen: `npm run build` (kompiliert TypeScript und kopiert Icons)
- Lint prüfen: `npm run lint`
- Code formatieren: `npm run format`

## Bekannte Einschränkungen

Beim *Ändern* eines Termins wird das iCal-Objekt neu erzeugt. Dabei werden
Wiederholungen (`RRULE`, `EXDATE`), Erinnerungen (`VALARM`) und Teilnehmer
(`ATTENDEE`) derzeit nicht in das neue Objekt übernommen.

Beim Ändern von Aufgaben werden dagegen nur einzelne Properties ersetzt, damit
app-spezifische Properties erhalten bleiben. Nicht unterstützt sind wiederholende
Aufgaben (`RRULE`) und das Anlegen verknüpfter Aufgaben (`RELATED-TO`); beide
Properties bleiben beim Ändern erhalten, lassen sich aber nicht setzen.

Datumswerte mit `TZID` werden als Wandzeit der Zeitzone gelesen, also nicht in
den UTC-Zeitpunkt umgerechnet. Das entspricht dem Verhalten der Termin-Operationen;
die ursprüngliche Zeile steht zusätzlich in `rawDUE` bzw. `rawDTStart`.

## Lizenz

[MIT](LICENSE.md)
