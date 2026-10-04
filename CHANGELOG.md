# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

Die Datumsangaben stammen aus den Git-Tags. Die Tags `v0.1.44` bis `v0.1.56`
wurden nachträglich am selben Tag angelegt und geben deshalb nicht den jeweiligen
Veröffentlichungszeitpunkt wieder.

## [Unreleased]

## [0.1.60] - 2026-10-04

### Hinzugefügt
- Neue Ressource **Aufgabe** für CalDAV-`VTODO`, les- und schreibbar. Damit sind
  die Aufgaben-Kalender von Nextcloud Tasks, Deck-Boards und geteilten
  Aufgaben-Kalendern nutzbar.
  - Operationen: *Aufgaben suchen*, *Alle Aufgaben anzeigen*, *Aufgabe anzeigen*,
    *Aufgabe erstellen*, *Aufgabe ändern*, *Aufgabe löschen*
  - Felder: Titel, Beschreibung, Status (`NEEDS-ACTION`, `IN-PROCESS`, `COMPLETED`,
    `CANCELLED`), Fortschritt in Prozent, Priorität, Kategorien, Fälligkeit (`DUE`),
    Start (`DTSTART`), Zeitzone sowie Option für Datumswerte ohne Uhrzeit
  - Filter für *Suchen* und *Alle Aufgaben*: Status, Fälligkeitszeitraum, Anzahl
- Aktualisieren einer Aufgabe ersetzt nur die gewünschten Properties, statt das
  iCal-Objekt neu zu erzeugen. Dadurch bleiben serverseitige und app-spezifische
  Properties erhalten, die der Node nicht kennt (etwa `X-OC-DECK-*`).
- Statuswechsel halten RFC 5545 ein: *Erledigt* setzt `PERCENT-COMPLETE:100` und
  einen `COMPLETED`-Zeitstempel, das Wiederöffnen entfernt `COMPLETED` und setzt
  den Fortschritt auf 0.
- Leer gebliebene Felder entfernen beim Ändern nichts. Zum Entfernen gibt es die
  Option *Felder entfernen* in den Update-Feldern.
- iCal-Helfer für Datumswerte (`helpers/datetime.ts`) aus dem Event-Modul
  herausgelöst, damit Termine und Aufgaben dieselbe Formatierung verwenden.
- Beim Erzeugen und Ändern werden die Regeln für iCalendar-Dateien eingehalten:
  - Zeilenfaltung nach RFC 5545 (75 Oktett), ohne mehrsprachige Texte in der
    Mitte eines Zeichens umzubrechen
  - Maskierung von TEXT-Werten; escapte Kommas in `CATEGORIES` (`\,`) gelten
    nicht als Trennzeichen
  - Wechselt eine Aufgabe zwischen Datum und Datum mit Uhrzeit, wird das
    Gegenstück (`DUE`/`DTSTART`) mitgezogen, weil RFC 5545 für beide Properties
    denselben Werttyp verlangt
  - `SEQUENCE` wird beim Ändern erhöht und `DTSTAMP` erneuert

## [0.1.59] - 2026-09-27

### Behoben
- Die Tool-Variante des Node-Typs (`...nextcloudCalendarTool`) wird als Alias
  registriert, damit bestehende Workflows mit dieser Schreibweise aufgelöst
  werden.

## [0.1.58] - 2026-09-27

### Behoben
- Der alte Paketname `n8n-nodes-nextcloud-calendar` wird als Alias für den
  Node-Typ registriert. Durch die Umbenennung des Pakets könnten bestehende
  Workflows sonst nicht mehr aufgelöst werden.

## [0.1.57] - 2026-09-27

### Behoben
- `npm audit`: 14 gemeldete Schwachstellen in Abhängigkeiten auf 0 reduziert.

## [0.1.56] - 2025-09-25

### Hinzugefügt
- *Termin anzeigen* liefert dieselben erweiterten ICS-Felder wie *Alle Termine*:
  `TZID`, `DTSTAMP`, `SEQUENCE`, `TRANSP`, `CATEGORIES`, `CLASS`, `RRULE`,
  `RECURRENCE-ID`, `EXDATE`/`RDATE`, `PRIORITY`, `DURATION`, `GEO` sowie
  `rawProperties` für nicht verstandene Properties.

## [0.1.55] - 2025-09-25

### Hinzugefügt
- Der Parser liest die erweiterten ICS-Felder `TZID`, `DTSTAMP`, `SEQUENCE`,
  `TRANSP`, `CATEGORIES`, `CLASS`, `RRULE`, `RECURRENCE-ID`, `EXDATE`/`RDATE`,
  `PRIORITY`, `DURATION` und `GEO` und stellt sie in Responses bereit.
- `IEventResponse` um diese Felder erweitert.

## [0.1.54] - 2025-09-25

### Behoben
- Der Parser beschränkt sich auf `VEVENT` und wertet `DTSTART`/`DTEND` mit
  Parametern wie `TZID` aus, damit Start und Ende beim Abruf wieder vorhanden sind.

## [0.1.53] - 2025-09-25

### Hinzugefügt
- Benutzerfreundliche Zeitzonenauswahl als `resourceLocator` mit Suche
  (z. B. `Europe/Berlin`) statt freier Eingabe.
- Dynamische Zeitzone im erzeugten ICS.

## [0.1.52] - 2025-09-25

### Geändert
- Arbeitsstand auf den Commit `1dc6f73` zurückgesetzt. Die danach folgende Arbeit
  an ICS-Erzeugung und Parser (aus 0.1.44) wurde dabei verworfen und in 0.1.53
  erneut aufgegriffen.

## [0.1.51] - 2025-09-25

### Behoben
- `Content-Type: text/calendar` wird beim Anlegen und Ändern gesetzt; der
  Auth-Header wird weiterhin vom tsdav-Client gesetzt.

## [0.1.50] - 2025-09-25

### Behoben
- Beim Anlegen eines Termins werden keine manuellen Header mehr gesendet, damit
  der tsdav-Client die Basic-Authentifizierung korrekt setzt.

## [0.1.49] - 2025-09-25

### Geändert
- Die Prüfung nach dem Anlegen vereinfacht: Suche über ein Zeitfenster statt
  eines separaten Abrufs.

## [0.1.48] - 2025-09-25

### Geändert
- Die Kalender-URL wird als Wert der Kalenderauswahl verwendet und in der
  Auflösung bevorzugt. Die Prüfung nach dem Anlegen nutzt ebenfalls die URL.

## [0.1.47] - 2025-09-25

### Hinzugefügt
- Prüfung nach dem Anlegen und Ändern mit klarer Fehlermeldung, wenn der
  Server-Rückabruf fehlschlägt.
- Termineinladungen: `REQUEST` mit `ORGANIZER`/`ATTENDEE` beim Anlegen und
  Ändern, optionales `CANCEL` beim Löschen sowie eine UI-Option dafür.

## [0.1.46] - 2025-09-25

### Behoben
- Robustere Kalenderauflösung nach Name oder URL.
- Sicherere Rückabprüfung nach dem Anlegen.

## [0.1.45] - 2025-09-25

### Hinzugefügt
- Zeitzonen-Auswahl mit durchsuchbarer Liste und robust Normalisierung.
- `METHOD:PUBLISH` und `X-WR-TIMEZONE` im erzeugten ICS.
- `If-None-Match` beim Anlegen.

## [0.1.44] - 2025-09-25

### Hinzugefügt
- Zeitzone im UI und in den Typen konfigurierbar, Felder erweitert.
- Stabilere ICS-Erzeugung: CRLF, `TZID`/UTC, Header sowie `STATUS` und `SEQUENCE`.

### Geändert
- Abhängigkeiten modernisiert, TypeScript- und ESLint-Setup überarbeitet, Build
  repariert, `npm audit` bereinigt und README aktualisiert.

## [0.1.43] - 2025-05-27

### Behoben
- Zeitzone der Termine: Ortszeitformatierung statt UTC, damit Termine nicht um
  die UTC-Verschiebung zu spät erscheinen.

[Unreleased]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.60...HEAD
[0.1.60]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.59...v0.1.60
[0.1.59]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.58...v0.1.59
[0.1.58]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.57...v0.1.58
[0.1.57]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.56...v0.1.57
[0.1.56]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.55...v0.1.56
[0.1.55]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.54...v0.1.55
[0.1.54]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.53...v0.1.54
[0.1.53]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.52...v0.1.53
[0.1.52]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.51...v0.1.52
[0.1.51]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.50...v0.1.51
[0.1.50]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.49...v0.1.50
[0.1.49]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.48...v0.1.49
[0.1.48]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.47...v0.1.48
[0.1.47]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.46...v0.1.47
[0.1.46]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.45...v0.1.46
[0.1.45]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.44...v0.1.45
[0.1.44]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/compare/v0.1.43...v0.1.44
[0.1.43]: https://github.com/phbreyzon/n8n-nodes-nc-calendar/releases/tag/v0.1.43