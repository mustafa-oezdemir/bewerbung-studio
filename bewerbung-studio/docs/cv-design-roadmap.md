# Gemeinsames Lebenslauf-Design: Arbeitsstand

## Auftrag und Reihenfolge

Quellen: `.lebenslauf/todo/task.md`, `view.md`, `todo_1.md`, `spalte.md` und
`app_todo.md` (27.09.2026). Die Reihenfolge aus `task.md` ist maßgeblich:
gemeinsame Grundlagen, danach Vorlagenkorrekturen, anschließend eigener Designer
und App-Funktionen. Jeder abgeschlossene Schritt wird geprüft und separat gepusht.

## Schritt 0: Architektur und Baseline

Ausgangscommit: `1ce2cc8`. Keine visuelle Änderung in diesem Schritt.

| Bereich | Bestehende Implementierung | Folgerung |
| --- | --- | --- |
| Daten und Validierung | `src/shared/schema.ts`, Zod | Profile und Bewerbungen bleiben kompatibel. |
| Vorlagen | `src/shared/templates.ts`, `src/components/resume/templates/*` | Bestehende Defaults erweitern, keine zweite Vorlagenregistrierung. |
| Design | `src/shared/documentDesign.ts` | Vorhandene Farben, Schrift-, Abstands- und CSS-Variablen erweitern. |
| Designzustand | `src/shared/documentEditorState.ts`, `templateDesigns` in Application | Vorlagenwechsel kann nicht definierte Einstellungen übernehmen; Reset setzt Farben bisher nicht zurück. |
| Speicherung | `electron/storage.ts` (DataStore), `src/store/useAppStore.ts`, IPC | Zod-validierte JSON-Dateien, atomare Speicherung und Sicherungen weiterverwenden. |
| Vorschau | `src/views/DocumentsView.tsx`, React-Vorlagen, `ManagedResumePreview.tsx` | Gemeinsame Auflösung vor der Ausgabe einbinden. |
| PDF | `electron/documents.ts`, HTML/CSS und Chromium | Eigenständiges Markup; gemeinsame Projektion über `resumeManagedOutput.ts` bereits vorhanden. |
| Word | `electron/templates/*`, Platzhalter in `electron/storage.ts` | Bestehende Engine beibehalten; gebündelte DOCX-Dateien fehlen derzeit. |
| Eigene Abschnitte | `specialSections`, `ResumeSpecialSections.tsx`, `resumeManagedOutput.ts` | React verwendet teilweise Vorlagenklassen, PDF erzeugt generische `managed-extra`-Blöcke. |
| Reihenfolge/Sichtbarkeit/Spalten | `features/resume-sections/resume-manager.ts`, `resume-section-system.ts` | Vorhandene Metadaten und Organizer weiterverwenden. |
| Profil/Design-Trennung | Präsentationsfelder teilweise im Profil; `resume-editor-settings.ts` schützt Entwürfe | Keine destruktive Migration; kompatible Adapter notwendig. |
| Dichte/Seiten | `documentPagination.ts`, `resumeSectionLayout.ts`, Vorlagen-CSS | Vorlagenspezifische Ausgangswerte erhalten; Abschnitts- und Eintragsabstände getrennt behandeln. |
| Icons/Stärken | `technologyBrand.ts`, `strengthSymbols.ts`, `resumeSectionLayout.ts` | Auto-/manuelle Icons und 1–4 Spalten existieren bereits (Commit `86ba317`). |
| Abschluss | `resumeClosing`, Profil-Unterschrift; Pehlione unterstützt einzelne Schalter | Für alle Vorlagen vereinheitlichen. |
| App-Shell | `src/App.tsx`, Settings-Theme | Hell/Dunkel existiert teilweise, lokaler Toggle ist nicht vollständig persistiert; ToDo/Notizen fehlen. |

Aktive Vorlagen: Pehlione White, Pehlione White Blue, Zweispaltig, Gepflegt,
Tabellarisch, Modern, Elegant, Zeitgenössisch, Kreativ, Ivy League, Stilvoll,
Kompakt, Einspaltig, Klassisch. Alte Vorlagendefinitionen bleiben für gespeicherte
Bewerbungen lesbar. Alias `einfach` verweist auf `einspaltig`.

Baseline am 27.09.2026:

- Typecheck: erfolgreich.
- Tests: 461 erfolgreich, 6 bestehende Fehler in `electron/templates/template.service.test.ts`.
- Ursache der sechs Fehler: fehlendes Verzeichnis `public/templates` mit gebündelten DOCX-Vorlagen; keine neuen Rendererfehler.
- Production Build: erfolgreich; bestehende Bundle-/Vite-Warnungen.
- Letzte visuelle Prüfung: Einspaltig-Vorschau und echte A4-PDF einschließlich eigenem Abschnitt, unterer Linie und gestrichelter Eintragstrennung.

Die fehlenden Word-Dateien sind ein offener Baseline-Mangel. Ein grüner vollständiger
Quality Gate darf erst nach Wiederherstellung und Prüfung dieser Dateien gemeldet werden.

## Weitere Schritte

- [x] 0: Architektur und Baseline dokumentieren.
- [x] 1: Gemeinsame semantische Designauflösung, ohne Defaultansichten zu verändern.
- [x] 2: Vorlagenbezogene Overrides und vollständiger Reset.
- [x] 3: Profildaten und Darstellung kompatibel trennen.
- [x] 4: Eigene Abschnitte normalisieren.
- [x] 5: Vorlagenstile für eigene Abschnitte vererben.
- [ ] 6–7: Gemeinsame Spalten, Platzierung, Reihenfolge und Sichtbarkeit.
- [ ] 8–9: Abstände und Metadatenlayout.
- [ ] 10–11: Bestehende Stärken-/Icon-Lösung gegen gemeinsame Anforderungen prüfen.
- [ ] 12–13: Abschlussblock und gemeinsame Vorschau-/PDF-Auflösung.
- [ ] 14–24: Vorlagen einzeln anhand ihrer Referenzen prüfen und korrigieren.
- [ ] 25–28: Designpanel, eigene Designs, Word-Anbindung und Editor.
- [ ] 29–32: ToDo, Notizen, Benachrichtigungen, persistiertes App-Theme.
- [ ] 33–35: Vollständige Regression, PDF-Prüfungen und finaler Quality Gate.

Einspaltigs doppelte Überschriftslinie wurde vor dieser Reihenfolge bereits mit
`1ce2cc8` korrigiert. Das ersetzt nicht die spätere gemeinsame Stilprüfung.

## Schritt 1: Designgrundlage

`cvDesignSchema.ts` definiert zwölf semantische Farben sowie getrennte Typografie-
und Abstandswerte mit validierten Grenzen. `cvDesign.ts` löst native Vorlagenwerte
und ausschließlich explizite Overrides auf; gleiche Werte werden vor dem Speichern
entfernt. Fehlende und explizit undefinierte Werte erben ihren Default.

Die vorhandenen zwölf `*.defaults.ts`-Module liegen nun unter
`src/shared/cvTemplateDefaults`; bisherige React-Importpfade exportieren dieselben
Konstanten weiter. `cvTemplateTokens.ts` adaptiert diese Konstanten sowie Pehliones
CSS-Werte. Die Tokens beschreiben die normale visuelle Vorlage; bestehende
ATS-/Dichtevarianten werden in der späteren Renderer-Anbindung berücksichtigt.

Dieser Schritt stellt die gemeinsame Auflösung und CSS-Einheiten bereit. Er
ändert keine Stylesheets, keine Rendererausgabe und keine gespeicherten Daten.
Persistenz folgt in Schritt 2, semantische Stilzuordnung und Ausgabeadapter in
Schritt 5 bzw. 13. Die neue Grundlage allein ist noch kein fertiges Designpanel.

Prüfung: 204 Resolver-/Preview-/PDF-Tests erfolgreich. Alle aktiven Vorlagen sind
abgedeckt; Farben, Einheiten, Grenzen, Alias, isolierte Defaults und sparse
Overrides werden geprüft. Vorhandene Vorschau-/PDF-Renderer bleiben unverändert.

## Schritt 2: Vorlagenwechsel, Speicherung und Reset

`documentEditorState.ts` initialisiert eine neue Vorlage jetzt ausschließlich mit
deren Defaults. Inaktive Vorlagen speichern nur Abweichungen; historische volle
Snapshots werden weiterhin gelesen. Das aktive `designSettings`-Objekt bleibt aus
Kompatibilitätsgründen vollständig. Neue semantische Werte liegen darin optional
und partiell unter `cvOverrides`; der bestehende DataStore übernimmt die Persistenz.

Die Validierung trennt vollständige Einstellungen von partiellen Overrides, damit
Zod beim Laden eines leeren Overrides keine globalen Defaults ergänzt. Der
Design-Reset in `DocumentsView.tsx` setzt auch Akzent-/Sekundärfarbe zurück und
entfernt semantische Overrides. Andere Vorlagen, Profildaten und Inhalte bleiben
erhalten. Einzelfeld-Reset steht als gemeinsamer Zustandshelfer bereit; die neuen
semantischen Bedienelemente und ihre Ausgabeanbindung folgen in späteren Schritten.

Prüfung: Typecheck und Production Build erfolgreich. 538 Tests erfolgreich, nur
die sechs dokumentierten Word-Baselinefehler verbleiben. Neue Tests prüfen alle
14 Vorlagen auf Isolation, exakte PDF-HTML-Gleichheit nach Reset, alte Snapshots,
Alias-Kompatibilität sowie Speichern/Neustart/Reset über den realen DataStore.
Zusätzlich wurde eine echte Einspaltig-A4-PDF nach Reset erzeugt und gerendert:
Vorlagenfarben, Hintergrund, eigene Überschrift und gestrichelte Trenner korrekt;
Vorschau und PDF haben dieselben berechneten Überschriftsrahmen.

### Phase 3 – Inhalt und Darstellung

Neue Änderungen an Sichtbarkeit, Abschnittstiteln, Reihenfolge, Spaltenzuordnung,
Kontaktfeldern und Abschlussoptionen werden als sparse `resumePresentation` in den
vorlagenspezifischen Dokumenteinstellungen gespeichert. Bestehende Profile bleiben
kompatibel; eine gemeinsame Projektion versorgt Vorschau und PDF mit ihrer bisherigen
Profilstruktur. Der Editor speichert den Inhalt getrennt und behält ungespeicherte
Inhaltsänderungen beim Vorlagenwechsel. Zurücksetzen entfernt die neuen Overrides,
ohne Profilinhalte zu löschen.

Validierung: Typecheck erfolgreich; vollständiger Lauf 542 bestanden und die sechs
bekannten Fehler wegen fehlender Word-Assets. Anschließend 14 zusätzliche
PDF-Regressionen für alle aktiven Vorlagen ergänzt: gezielter Lauf 149 bestanden.
Diese prüfen auch, dass CV-Einstellungen das Anschreiben nicht verändern.

### Phase 4 – Custom Section Normalization

`specialSections` bleibt das bestehende Datenmodell und erhält einen optionalen
`contentType` (Text, Liste, Einträge, Skills, Timeline). Beide Profileditoren bieten
diese Auswahl an. Ohne explizite Auswahl löst der gemeinsame Normalizer alte Daten
anhand ihrer Inhalte und Metadaten auf, ohne gespeicherte Daten umzuschreiben oder
Überschriften als Sonderfälle zu behandeln. Hauptabschnitte und Unterabschnitte
werden semantisch getrennt; einfache Inhalte werden nicht mehr als Titel gerendert.

React-Vorschau und Electron-PDF nutzen dieselbe escaped Inhaltsausgabe. Eigene
Abschnitte werden anhand ihrer ID zugeordnet, sodass gleiche Überschriften nicht
zusammenfallen. Leere Einträge erzeugen keine leeren Abschnitte. Vorhandene Metadaten,
Beschreibung, Details und URLs bleiben bei jeder Typauswahl erhalten.

Validierung: Build inklusive Typecheck erfolgreich. 578 Tests bestanden; weiterhin
sechs bekannte Word-Asset-Fehler. Die neue Regression prüft alle fünf Inhaltstypen in
allen 14 aktiven Vorlagen auf identisches Preview-/PDF-Markup und eindeutige IDs.
Visuelle Stil-Vererbung und vorlagenspezifische Abstände folgen in Phase 5.

### Phase 5 – Gemeinsame Section Style Inheritance (27.09.2026)

Alle 14 aktiven Vorlagen verwenden gemeinsame semantische Rollen für Hauptabschnitt,
Eintragstitel, unterstützenden Organisations-/Akzenttext und Metadaten. Der gemeinsame
Adapter erzeugt ausschließlich auf eigene Abschnitte begrenzte CSS-Aliase aus den
nativen Stylesheets. Font, Farbe, Divider, Innen-/Außenabstand, Eintragsabstand sowie
Dichte-, ATS- und Umbruchregeln bleiben dadurch an die jeweilige Vorlage gebunden.
Es werden keine globalen Ersatz-Defaults und keine Profilmigration eingeführt.

Preview und PDF verwenden denselben Inhalts- und Stiladapter. Bestehende verschachtelte
Überschriften behalten ihre Label-/Icon-Struktur; neue Abschnitte stehen vor dem
Abschlussblock. Unterabschnitte verwenden die native Überschriftenelementart ihres
Renderers, weshalb ihre HTML-Tags zwischen Vorschau und PDF abweichen dürfen; Inhalt,
IDs und semantische Rollen bleiben gleich. Karriere-Spaltengeometrie wird nicht auf
freie Einträge kopiert. Bestehende Persistenz und vorlagenbezogener Reset bleiben erhalten.

Die PostCSS-Abhängigkeit ist in Electron extern eingebunden: Node lädt das CommonJS-
Paket selbst, sodass der ESM-Build nicht mehr an `require("path")` scheitert. Der
Renderer verwendet weiterhin den Browser-Build der Bibliothek.

Validierung:

- `npm run release:check`: Typecheck, 65 Testdateien / 604 Tests und Production Build erfolgreich.
- `node scripts/section-inheritance-qa.mjs` und `npx electron scripts/check-section-inheritance.cjs`:
  56 berechnete Stilprüfungen (14 Vorlagen × visuell/ATS × Vorschau/PDF), keine Abweichungen.
  Der gemeinsame Keep-with-next-Schutz darf zusätzlich einen alleinstehenden Titel verhindern.
- 14 echte A4-PDFs erzeugt, mit Poppler gerendert und visuell geprüft.
- `npx electron scripts/electron-startup-smoke.cjs`: Hauptprozess, Preload und React erfolgreich geladen.
- Fehlende Word-Testassets unter `public/templates` mit den bestehenden `create-*-lebenslauf.py`
  Generatoren wiederhergestellt; die sechs bisherigen Baselinefehler sind damit behoben.
- Bestehende Bundle-Größen-/Vite-Deprecation-Warnungen bleiben ohne Buildfehler.

Die QA-Ausgaben liegen unter `tmp/section-inheritance-qa`. Vorlagenspezifische
Redesigns sind nicht Bestandteil dieser Phase.

### Phase 6 – Gemeinsame Layout Engine (27.09.2026)

Die gemeinsame Layoutauflösung unterstützt ein- und zweispaltige Lebensläufe,
Seitenspalten links/rechts und die sicheren Verhältnisse 20/80 bis 40/60 in
Fünferschritten. Ohne gespeicherte Layoutauswahl bleibt das native Layout jeder
Vorlage samt eigener Breite unverändert. Eine Wahl im Designpanel wird pro
Bewerbung gespeichert; „Vorlage“ entfernt Modus-, Seiten- und Breiten-Overrides
und stellt die ursprüngliche Vorlage wieder her. Bestehende Pehlione-Profilbreiten
bleiben bei einem reinen Seitenwechsel erhalten.

Der gemeinsame DOM-Adapter wird nach dem Section-Management in React-Vorschau
und Electron-PDF angewendet. Bei ursprünglich einspaltigen Vorlagen erzeugt er
Haupt- und Seitenspalte mit einem seitenübergreifenden Kopfbereich. Bei nativen
Zweispaltenvorlagen ordnet er die vorhandenen Bereiche um, ohne deren Inhalt zu
duplizieren. Die automatische Breite der Wissens-/Stärkenraster folgt der
gewählten Hauptspalte. ATS-Ausgaben behalten ihre einspaltige Darstellung.

Validierung: `npm run release:check` mit 66 Testdateien / 623 Tests und Build
erfolgreich; Electron-Start erfolgreich. `node scripts/layout-engine-qa.mjs`
erzeugt 84 Preview-/PDF-Kombinationen aus den Phase-5-Fixtures;
`npx electron scripts/check-layout-engine.cjs` bestätigt für alle 84 die
berechnete Spaltenbreite, Reihenfolge und gemeinsame Grid-Zeile.

### Phase 7 – Section Placement, Order und Visibility (27.09.2026)

Der vorhandene Abschnittsmanager ist die zentrale Bearbeitungsstelle für
Sichtbarkeit, Reihenfolge und Zuordnung zur Haupt- oder Seitenspalte. Alle
Inhaltsabschnitte einschließlich Berufserfahrung, Ausbildung, Projekt-Highlight
und eigenen Bereichen dürfen in beide Spalten verschoben werden. Kopf,
persönliche Angaben, Foto und Abschluss bleiben feste Strukturelemente.
Der Organizer bietet Drag & Drop mit markiertem Ziel sowie fokussierbare
Griffe: Pfeil hoch/runter ändert die Reihenfolge, links/rechts die Spalte.
Augenschalter und Positionsauswahl bleiben als direkte Alternativen erhalten.

Die Zuordnung wird als sparse, bewerbungsbezogener `resumePresentation.sections`
Override gespeichert. Alte Profile und unveränderte Vorlagen behalten ihr
ursprüngliches Erscheinungsbild. Bei einspaltiger Ausgabe werden die Gruppen
in einer Spalte angeordnet; beim Wechsel zu zwei Spalten bleibt die Zuordnung
erhalten. Section-Speichern bewahrt zugleich die Layout-Overrides aus Phase 6.
React-Vorschau und Electron-PDF verwenden dieselbe Abschnittsprojektion.

Validierung: `npm run release:check` und der Electron-Starttest; Regressionen
prüfen die Zuordnung und Sichtbarkeit für alle 14 Vorlagen in Vorschau und PDF,
den einspaltigen Gruppenfluss sowie den Persistenz-Roundtrip.
