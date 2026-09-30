# BewerbungsManager

Lokale Desktop-Anwendung zur Verwaltung deutscher Bewerbungsverfahren und zur
Erstellung eines konsistenten Sets aus Deckblatt, Anschreiben und Lebenslauf.

## Technik

- Electron Main Process für Dateisystem, Dialoge, PDF-Export und Benachrichtigungen
- React + TypeScript (Strict Mode) für die Oberfläche
- Vite für Entwicklung und Build
- Zustand für den zentralen UI-Zustand
- Zod für IPC- und JSON-Validierung
- Tailwind CSS 4 als CSS-Toolchain
- Vitest für Schema- und Validierungstests

## Sicherheitsmodell

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- ausschließlich freigegebene, typisierte IPC-Methoden im Preload
- keine freien Dateipfade aus dem Renderer
- Dateinamen werden normalisiert und bereinigt
- externe Links sind auf HTTP/HTTPS beschränkt
- Nutzereingaben werden für Dokument-HTML maskiert
- JSON wird in eine temporäre Datei geschrieben, synchronisiert und mit
  Sicherung ersetzt

## Datenablage

Beim ersten Start wählen Sie einen Bewerbungsordner. Die Anwendung speichert
dessen Pfad in `bootstrap.json` im plattformüblichen Electron-`userData`-Ordner.
Vorhandene Installationen mit `D:\bewerbung_mustafa\data\Settings\workspace.json`
werden automatisch übernommen. `BEWERBUNG_ROOT_PATH` bleibt als Override für
Entwicklung und Tests erhalten. Den Ordner können Sie später unter
**Einstellungen → Speicherort / Bewerbungsordner** ändern. Vor einem Wechsel
wird eine vollständige Sicherung mit Manifest erstellt und die kopierten Dateien
werden geprüft. Der alte Ordner bleibt als zusätzliche Wiederherstellungskopie
erhalten.

```text
<gewählter Bewerbungsordner>
└── data
    ├── Bewerbungen
    │   └── Firma_JJJJ-MM-TT
    │       └── Stellenbezeichnung
    │           ├── Anschreiben
    │           ├── Lebenslauf
    │           ├── Deckblatt
    │           ├── Email
    │           ├── Stellenanzeige
    │           └── Bewerbungsunterlagen
    ├── Zeugnisse
    ├── Zertifikate
    ├── Absagen
    └── Setting
        ├── Settings        (workspace.json)
        ├── Profile
        ├── Backups
        └── Muster
```

`data/Setting/Settings/workspace.json` ist der zentrale, versionierte Datensatz. Aktive
Bewerbungen, Gespräche und Absagen sind gefilterte Ansichten dieses Datensatzes
und keine separaten Kopien.

Das Feld `sentAt` ist die zentrale Quelle des Bewerbungsdatums; bei Entwürfen
wird bis zur Auswahl eines Datums `createdAt` verwendet. Der Firmenordner heißt
`Firma_JJJJ-MM-TT`; zwei Stellen derselben Firma am selben Tag teilen sich ihn und
bekommen je einen Unterordner mit der Stellenbezeichnung. Datum in Anschreiben,
Word-Inhalt und E-Mail-Dateien steht im Format `TT.MM.JJJJ`. Eine Datumsänderung
verschiebt die vorhandenen Anwendungsordner kollisionssicher.

Zeugnisse und Zertifikate bleiben in ihren zentralen Archivordnern. Eine
Bewerbung speichert nur die relative Verknüpfung; die Datei wird nicht pro
Bewerbung kopiert. Bei einer Absage werden firmenspezifische Anschreiben und
Lebensläufe unter `Absagen` verschoben, der Datensatz bleibt
erhalten.

Bestehende Daten können in den Einstellungen über **Bisherigen data-Ordner
migrieren** übernommen werden. Vor dem Kopieren zeigt die Anwendung eine
Vorschau und verlangt eine ausdrückliche Bestätigung. Quelldateien werden nicht
gelöscht und vorhandene Zieldateien nicht überschrieben.

## Befehle

```powershell
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm start
npm run dist:win
```

Für eine reine Renderer-Vorschau ohne Electron:

```powershell
$env:VITE_RENDERER_ONLY="1"
npm run dev
```

`npm run dist:win` prüft den Quellcode und erzeugt unter `windows-release/` einen
Windows-Installer, eine portable Ausgabe und `SHA256SUMS.txt`. Die vollständige
Release-Checkliste steht in [RELEASE.md](./RELEASE.md). Öffentliche Builds
sollten vor der Weitergabe mit einem Windows-Code-Signing-Zertifikat signiert
werden.

## Enthaltene Funktionen

- ToDo mit automatischer Bewerbungsfrist-Aufgabe, getrennt von eigenen Aufgaben
- Dashboard mit Statuszahlen, Erfolgsquote, Fristen und fälligen Aufgaben
- zentrale Bewerbungslisten mit Suche und Statusfiltern
- automatische Übergänge für Absage, Gespräch, Zusage und Archiv
- Monatskalender und Agenda
- automatische Termine aus Bewerbungs-, Gesprächs- und Vertragsdaten
- Follow-up nach 7, 10, 14 oder 21 Tagen
- native Desktop-Benachrichtigungen
- Bewerbungswizard mit Validierung
- Lebenslauf-Vorlagen (u. a. Pehlione, Modern, Zweispaltig, Kreativ) und drei Deckblatt-Designs
- editierbare Anschreiben-, Lebenslauf- und Deckblatttexte
- PDF-Ausgabe einzelner Dokumente oder der Bewerbungsmappe
- sichere PDF-Ablage für Zeugnisse und Zertifikate
- editierbare Dokumentmetadaten, Kategorien und Bewerbungsmappe-Reihenfolge
- Vorschau, Ein-/Ausschluss und sicheres Löschen verwalteter PDF-Kopien
- echte PDF-Zusammenführung in der Reihenfolge Deckblatt, Anschreiben,
  Lebenslauf, Zeugnisse und Zertifikate
- automatisch erzeugtes und bei Bewerbungs-, Profil- oder Anlagenänderungen
  aktualisiertes, einseitiges Deckblatt als editierbare DOCX
- Profile, Theme-Einstellungen und JSON-Sicherung
- tägliche automatische JSON-Sicherungen mit einstellbarer Aufbewahrung
- validierte Wiederherstellung kompletter Sicherungen mit Notfallsicherung
- separater Export und Import der Programmeinstellungen
- lokal zwischengespeicherter Bewerbungswizard mit automatischer Wiederherstellung
- strukturierter Lebenslauf-Editor für Berufserfahrung und Ausbildung
- Drag-and-drop sowie barrierearme Auf/Ab-Sortierung der Stationen
- ein- und ausblendbare Lebenslauf-Abschnitte
- Stellenanzeigen-Matching gegen die tatsächlich hinterlegten Kenntnisse
