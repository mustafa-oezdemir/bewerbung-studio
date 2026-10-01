# Gemeinsames Lebenslauf-Design: Arbeitsstand

## Auftrag und Reihenfolge

Quellen: `.lebenslauf/todo/task.md`, `view.md`, `todo_1.md`, `spalte.md` und
`app_todo.md` (27.09.2026). Die Reihenfolge aus `task.md` ist maßgeblich:
gemeinsame Grundlagen, danach Vorlagenkorrekturen, anschließend eigener Designer
und App-Funktionen. Jeder abgeschlossene Schritt wird geprüft und separat gepusht.

## Schritt 0: Architektur und Baseline

Ausgangscommit: `1ce2cc8`. Keine visuelle Änderung in diesem Schritt.

| Bereich                          | Bestehende Implementierung                                                                | Folgerung                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Daten und Validierung            | `src/shared/schema.ts`, Zod                                                             | Profile und Bewerbungen bleiben kompatibel.                                                               |
| Vorlagen                         | `src/shared/templates.ts`, `src/components/resume/templates/*`                        | Bestehende Defaults erweitern, keine zweite Vorlagenregistrierung.                                        |
| Design                           | `src/shared/documentDesign.ts`                                                          | Vorhandene Farben, Schrift-, Abstands- und CSS-Variablen erweitern.                                       |
| Designzustand                    | `src/shared/documentEditorState.ts`, `templateDesigns` in Application                 | Vorlagenwechsel kann nicht definierte Einstellungen übernehmen; Reset setzt Farben bisher nicht zurück. |
| Speicherung                      | `electron/storage.ts` (DataStore), `src/store/useAppStore.ts`, IPC                    | Zod-validierte JSON-Dateien, atomare Speicherung und Sicherungen weiterverwenden.                         |
| Vorschau                         | `src/views/DocumentsView.tsx`, React-Vorlagen, `ManagedResumePreview.tsx`             | Gemeinsame Auflösung vor der Ausgabe einbinden.                                                          |
| PDF                              | `electron/documents.ts`, HTML/CSS und Chromium                                          | Eigenständiges Markup; gemeinsame Projektion über`resumeManagedOutput.ts` bereits vorhanden.          |
| Word                             | `electron/templates/*`, Platzhalter in `electron/storage.ts`                          | Bestehende Engine beibehalten; gebündelte DOCX-Dateien fehlen derzeit.                                   |
| Eigene Abschnitte                | `specialSections`, `ResumeSpecialSections.tsx`, `resumeManagedOutput.ts`            | React verwendet teilweise Vorlagenklassen, PDF erzeugt generische`managed-extra`-Blöcke.               |
| Reihenfolge/Sichtbarkeit/Spalten | `features/resume-sections/resume-manager.ts`, `resume-section-system.ts`              | Vorhandene Metadaten und Organizer weiterverwenden.                                                       |
| Profil/Design-Trennung           | Präsentationsfelder teilweise im Profil;`resume-editor-settings.ts` schützt Entwürfe | Keine destruktive Migration; kompatible Adapter notwendig.                                                |
| Dichte/Seiten                    | `documentPagination.ts`, `resumeSectionLayout.ts`, Vorlagen-CSS                       | Vorlagenspezifische Ausgangswerte erhalten; Abschnitts- und Eintragsabstände getrennt behandeln.         |
| Icons/Stärken                   | `technologyBrand.ts`, `strengthSymbols.ts`, `resumeSectionLayout.ts`                | Auto-/manuelle Icons und 1–4 Spalten existieren bereits (Commit`86ba317`).                             |
| Abschluss                        | `resumeClosing`, Profil-Unterschrift; Pehlione unterstützt einzelne Schalter           | Für alle Vorlagen vereinheitlichen.                                                                      |
| App-Shell                        | `src/App.tsx`, Settings-Theme                                                           | Hell/Dunkel existiert teilweise, lokaler Toggle ist nicht vollständig persistiert; ToDo/Notizen fehlen.  |

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

- [X] 0: Architektur und Baseline dokumentieren.
- [X] 1: Gemeinsame semantische Designauflösung, ohne Defaultansichten zu verändern.
- [X] 2: Vorlagenbezogene Overrides und vollständiger Reset.
- [X] 3: Profildaten und Darstellung kompatibel trennen.
- [X] 4: Eigene Abschnitte normalisieren.
- [X] 5: Vorlagenstile für eigene Abschnitte vererben.
- [X] 6–7: Gemeinsame Spalten, Platzierung, Reihenfolge und Sichtbarkeit.
- [X] 8–9: Abstände und Metadatenlayout.
- [X] 10–11: Bestehende Stärken-/Icon-Lösung gegen gemeinsame Anforderungen prüfen.
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

### Phase 8 – Semantisches Abstandssystem (27.09.2026)

Das vorhandene CV-Tokenmodell steuert nun auch die tatsächliche Lebenslauf-
Ausgabe: Seitenrand, Innenabstand, Abschnittsabstand, Eintragsabstand,
Abstand nach Abschnitts-/Eintragstitel, Spaltenabstand und Zeilenhöhe sind
getrennte Werte. Insbesondere ändert Eintragsabstand nur aufeinanderfolgende
Karriereeinträge, während Abschnittsabstand zwischen Hauptbereichen wirkt.
Vorhandene native CSS-Werte bleiben ohne Override unverändert.

Im Designpanel stehen „Kompakt“, „Standard“ und „Groß“ sowie begrenzte
mm-/Zeilenhöhenfelder bereit. „Standard“ entfernt semantische Abstandsoverrides
und stellt auch die alten Regler auf die Vorgaben der ausgewählten Vorlage
zurück. Alte gespeicherte Reglerwerte bleiben lesbar und werden im Editor
angezeigt, bis der jeweilige semantische Wert explizit gesetzt wird.
Overrides sind sparsam und vorlagenbezogen gespeichert; Preview und PDF
verwenden denselben HTML-/CSS-Adapter.

Validierung: `npm run release:check`; 28 Electron-Geometrieprüfungen
(14 Vorlagen × Vorschau/PDF) für Abschnitts-, Titel- und Eintragsabstand,
Seitenrand sowie gemeinsame Innen-/Spalten-/Zeilenvariablen.

### Phase 9 – Gemeinsames Metadatenlayout (27.09.2026)

Für Berufserfahrung und Ausbildung kann das Designpanel Position/Abschluss,
Firma/Institution, Zeitraum und Ort nun „Nebeneinander“ oder „Untereinander“
anordnen. Bei nebeneinanderstehenden Angaben ist auch „Datum links“ wählbar.
Ohne Auswahl bleiben die nativen Vorlagenlayouts erhalten. Der gemeinsame
HTML-Adapter verwendet in Vorschau und PDF dieselben Daten und lässt
Leistungslisten bestehen. Die Einstellung wird je Vorlage sparsam gespeichert;
„Template-Standard“ bzw. Design-Reset entfernt die Anpassung.

Validierung: HTML-Regressionen für 14 Vorlagen × Vorschau/PDF × drei
Anordnungen und 84 Chromium-Geometrieprüfungen für Zeilen-/Spaltenpositionen.

### Phase 11 – Automatische Technologie-Icons (28.09.2026)

Ein gemeinsamer Resolver wählt zuerst ein gültiges manuelles Symbol oder
Devicon, danach ein automatisch erkanntes Technologie-Icon und zuletzt ein
escaptes Textsymbol. Häufige Schreibweisen für Go, JavaScript, TypeScript,
React, Spring, Python, PHP, Docker und GitHub werden auf dieselbe Identität
abgebildet. Stärken und Kenntnisse nutzen denselben Resolver in Vorschau und
PDF; die bestehende Farbanpassung bleibt erhalten. Tests prüfen manuelle
Priorität, Aliase und sichere Fallbacks.

### Phase 12 – Ort, Datum und Unterschrift (28.09.2026)

Die drei Bestandteile des Lebenslauf-Abschlusses lassen sich unabhängig
ein-/ausblenden. Die Unterschrift wird ausschließlich aus dem validierten
Profilbild geladen. Platzierung (Footer/Hauptspalte) und Ausrichtung
(links/mitte/rechts/verteilt) liegen als vorlagenbezogene Präsentationswerte
vor; ein Design-Reset stellt die native Vorlage wieder her. Unveränderte
Pehlione-Vorlagen behalten ihren bisherigen Abschluss. Andere Vorlagen
verwenden bei vorhandenen Abschlussdaten den gemeinsamen Block; reine
Seitenzahlen-Footer bleiben auch beim Ausblenden des Abschlusses erhalten.

Vorschau und PDF verwenden denselben Adapter. Validierung umfasst HTML-
Regressionen für alle 14 Vorlagen und 112 Chromium-Geometrieprüfungen der
beiden Positionen und vier Ausrichtungen, ohne Seitenüberlauf oder Überlappung.

### Phase 13 – Gemeinsame CV-Auflösung (28.09.2026)

Vorschau und PDF beziehen Profilprojektion, sichtbare Abschnitte,
Knowledge-Gruppen, Layout, Designwerte und Seitenplan aus `resolveCvDocument`.
Die vorlagenspezifischen Kapazitäten für die Paginierung sind einmalig dort
zugeordnet. Der gemeinsame HTML-Adapter erhält bereits aufgelöste Abschnitte,
Spalten und Abstandswerte. Der Pehlione-Kurzprofil-Fallback verwendet in
beiden Ausgaben dieselbe Reihenfolge: Dokumenttext, passende Deckblatt-Aussage,
Profilzusammenfassung. Die Vorlagen behalten ihre eigenen Renderer und ihre
nativen Standards ohne Override.

Validierung: Regressionen für alle 14 Vorlagen mit mehrseitigem Lebenslauf,
Abschnitts- und Layout-Overrides; vollständiger Release-Check.

### Phase 14 – Pehlione White Blue (28.09.2026)

Die Karrierezeilen ordnen Zeitraum und Position/Abschluss in einer gemeinsamen
Zeile mit gleicher Schriftgröße an; Ort und Organisation stehen direkt darunter
in den jeweils zugehörigen Spalten. Die Werte stammen ausschließlich aus dem
Profil. Ohne Profil-Berufsbezeichnung erscheint kein Ersatz aus der Bewerbung.
Neue Projekt- und Interessenabschnitte erhalten denselben Abschnittskopf wie
die nativen Bereiche; ein eigener Projektabschnitt ersetzt die abgeleitete
Projekt-Darstellung, damit der Inhalt nicht doppelt erscheint. Die Fotozeichnung
ist zwischen Vorschau und PDF angeglichen.

Das Designpanel bietet sparsame, vorlagenbezogene Overrides für Titel- und
Abschnittsfarben, Spaltenhintergründe und Seitenspalten-Text, Linienfarbe,
Linienbreite und Sichtbarkeit sowie Foto-Dekorfarbe und Sichtbarkeit. Fehlen
diese Werte, bleibt das ursprüngliche Pehlione-Design bestehen. Sichtbarkeit,
Reihenfolge und Spaltenplatzierung verwenden weiterhin den gemeinsamen
Section-Manager; Abstand und Metadatenlayout bleiben in den gemeinsamen
Systemen. Design-Reset entfernt die neuen Overrides.

Validierung: HTML-Regressionen für Vorschau/PDF, Persistenz-Roundtrip,
Chromium-Geometrieprüfung von Datum, Titel, Ort, Institution sowie der beiden
Sonderabschnitte und Sichtprüfung eines einseitigen A4-PDFs.

PDF-Nachbesserung: In die Seitenspalte verschobene Hauptabschnitte hatten
dort gleichzeitig eine äußere und eine innere Überschriftenlinie. Die äußere
Linie entfällt; Zusammenfassung und Zertifikate zeigen wieder je eine Linie.
Die Kontaktlinie behält ohne Override das Weiß der Vorschau und besitzt eine
eigene vorlagenbezogene Farbeinstellung. Kontaktüberschrift, Symbole und
Kontaktdaten übernehmen die gewählte Textfarbe der Seitenspalte. Der native Abschluss bleibt nach
dem Verschieben anderer Abschnitte in der Hauptspalte. Der Fehler wurde mit
den gespeicherten Einstellungen eines echten Pehlione-White-Blue-Dokuments
reproduziert und anhand eines einseitigen A4-PDFs geprüft.

Seitenspalten-Abschnittstitel besitzen nun eine eigene, vorlagenbezogene
Farbeinstellung in allen CV-Vorlagen. Ohne eigene Überschriftenfarbe verwenden
sie eine gewählte Seitenspalten-Textfarbe; ohne beide Overrides bleiben die
jeweiligen Vorlagenfarben erhalten. Vorschau und PDF nutzen dieselbe
Abschnittsprojektion. Die Kontaktlinie bleibt separat einstellbar.

Die Designoberfläche nutzt für Akzent, Fläche und weitere Farbwerte ein
gemeinsames kompaktes Color-Card-Control. Das Vorlagenpanel hat vier Karten
pro breite Zeile und bricht bei geringerer Panelbreite auf zwei bzw. eine
Spalte um. Der PDF-Hinweis steht oberhalb des Panels; der Abschnittsorganizer
folgt danach. Abschnittstitelfarben werden anhand der semantischen Haupt- oder
Seitenspalte auf Standard- und eigene Abschnitte angewendet, unabhängig davon,
ob die Seitenspalte links oder rechts steht.

Pehlione White Blue: Der Abschnitt „Sprachen“ zeigt in Vorschau und PDF ein
Sprachen-Symbol im gleichen Akzent-Iconfeld wie andere ikontragende
Abschnittstitel. Die Überschriftenfarbe und Abschnittslinie folgen weiterhin
den gespeicherten Designwerten.

## Phase 15: Pehlione White

Pehlione White verwendet dieselbe Abschnitts- und Designprojektion wie White
Blue mit vorlageneigenen Standardfarben und Hintergründen. Die bestehenden
Renderer bleiben gemeinsam; eigene Abschnitte erhalten auch in White die
Pehlione-Überschrift samt Symbol. Designfarben und Sichtbarkeit können für
White im gleichen Vorlagenpanel überschrieben und zurückgesetzt werden.

In die Seitenspalte verschobene Zertifikate und Projekt-Highlights zeigen im
PDF nur noch eine Überschriftenlinie. Der lange Untertitel bleibt in Vorschau
und PDF innerhalb der Hauptspalte mit rechtem Abstand. Geprüft mit den
gespeicherten White-Daten als einseitiges A4-PDF sowie 756 Tests und Build.

Pehlione White: Das Symbol der Kontaktüberschrift verwendet die Akzentfarbe.
Ihre Linie folgt wie die übrigen Abschnittslinien der gemeinsamen
Linienfarbe. Die separate Kontaktlinien-Farbkarte entfällt für White; ältere
gespeicherte Kontaktlinienwerte werden dort nicht mehr ausgewertet.

Die gemeinsame Seitenspalten-Farbprojektion färbt nun auch SVG-Symbole der
Abschnittsüberschriften. Ein eigener Wert für „Seitenspalte Abschnittstitel“
hat bei Text und Symbol Vorrang vor der Akzentfarbe; ohne diesen Wert bleibt
die Akzentdarstellung der Vorlage erhalten. Das gilt für Vorschau und PDF
aller Vorlagen mit solchen Abschnittssymbolen.

Beim Verschieben eines Hauptabschnitts in die Seitenspalte wird seine
Überschrift nicht mehr zwangsweise auf die Seitenspalten-Textfarbe gesetzt.
Damit behalten etwa Zertifikate und Projekt-Highlight zunächst die Akzentfarbe
und folgen einer ausdrücklich gewählten Seitenspalten-Überschriftenfarbe.

Pehlione White PDF: In die Seitenspalte verschobene Abschnitte übernehmen nun
die vorhandene White-Seitenspalten-Überschrift. Die Symbole stehen ohne
farbige Kachel wie in der Vorschau, und die Linie beginnt erst am Text.
Zertifikate verwenden auch im PDF das Graduationssymbol der Vorschau.

## Phase 16: Zweispaltig und gemeinsame Gestaltung

Zweispaltig behält ohne gespeicherte Overrides sein 62/38-Layout und die
nativen Farben. Die vorhandenen gemeinsamen Systeme für Metadaten,
Abschnittsreihenfolge, Spaltenposition und -breite, Sonderabschnitte sowie
Ort/Datum/Unterschrift werden in Vorschau und PDF verwendet. Die beiden
Metadatenmodi und eine 35/65-Variante wurden mit Projekt-Highlight und
Hobbys & Interesses auf beiden Ausgaben geprüft. Beide Beispiel-PDFs blieben
einseitige A4-Dokumente.

„Farben und Dekoration“ ist jetzt ein gemeinsames Panel für alle
Lebenslauf-Vorlagen. Hintergrund, Seitenspalten-Text, Abschnittslinien und
Fotodekoration werden für andere Vorlagen über denselben HTML-Projektionspfad
auf Vorschau und PDF angewendet. Fehlende Werte lassen das native
Vorlagendesign unverändert; der Panel-Reset entfernt die gespeicherten
Dekorations-Overrides. Für Pehlione bleibt die vorhandene Projektion aktiv.

Seitenspalten-Textfarbe steuert auch die Einträge unter „Zertifikate“.
Abschnittstitel und Symbole behalten ihre getrennte Farbpriorität; der
Pehlione-Theme-Hintergrund bleibt durch diese Textanpassung unberührt.

## Phase 17: Zeitgenössisch

Nachträglich hinzugefügte Abschnitte übernehmen in Vorschau und PDF die
vorhandene Zeitgenössisch-Überschrift mit Icon-Kachel, Schrift und Abstand.
Stärken erhalten auch dann dieses Layout, wenn der Block erst vom gemeinsamen
Section-Manager erzeugt wird. Für Interessen und Projekte werden passende
Symbole anhand des gespeicherten Abschnittstyps gewählt; frei benannte
Abschnitte nutzen ein neutrales Symbol. Bestehende native Abschnitte und
Profilinhalte bleiben unverändert.

## Phase 18: Kreativ

Kreativ verwendet für Vorschau und PDF dieselben Vorlagenwerte für den
Abstand unter dem Kopfbereich, zwischen Abschnitten und zwischen
Berufserfahrungs-Einträgen. Der Abstand vor der Fußzeile ist als eigener
Vorlagenwert definiert. Nachträglich hinzugefügte Abschnitte stehen in der
Hauptspalte und behalten ihre normale Überschrift und ihren Inhaltstyp;
Projekt-Highlight und Hobbys & Interesses werden getrennt von Ausbildung
ausgegeben. Die Sichtbarkeit von Telefon, E-Mail, LinkedIn, GitHub, Website,
Adresse und Foto folgt weiterhin dem aufgelösten Profil.

## Phase 19: Stilvoll

Stilvoll verwendet in Vorschau und PDF gemeinsame native Werte für den Abstand
zwischen Kopf und Inhalt (6 mm), zwischen Abschnitten (6 mm) und zwischen
Berufs- und Ausbildungs-Einträgen (3,8 mm). Die vorhandenen Einstellungen
„Kompakt“, „Standard“ und „Groß“ sowie der getrennte Eintragsabstand bleiben
für gespeicherte Lebensläufe verfügbar. Der alte Abschnittsabstand-Regler wird
weiterhin berücksichtigt. Projekt-Highlight und Hobbys & Interesses übernehmen
die normale Stilvoll-Überschrift und folgen der gespeicherten Spaltenposition.
Vorschau und gedrucktes A4-PDF wurden mit Profil- und Zusatzabschnitten
verglichen; der vorhandene zweispaltige Entwurf bleibt erhalten.

## Phase 20: Kompakt

Kompakt behält seine breite Hauptspalte (108 mm) und schmale Seitenspalte
(66 mm); die gemeinsame Verhältnisvorgabe entspricht nun dieser nativen
Aufteilung. Der Standard-Eintragsabstand beträgt 3,2 mm und bleibt vom
Abschnittsabstand (3,5 mm) und Titelabstand getrennt. Kompakt, Standard und
Groß wirken auf Berufs- und Ausbildungs-Einträge in Vorschau und PDF gleich;
gespeicherte Werte des älteren Abschnittsabstand-Reglers bleiben wirksam.

Zusatzabschnitte wie Projekt-Highlight und Hobbys & Interesses stehen als
eigenständige Abschnitte in der gewählten Spalte. Lange Kontaktwerte umbrechen
innerhalb der Seitenspalte. Die orangefarbene Liniengrafik verwendet die
Sekundärfarbe und dieselbe feine Strichstärke auf beiden Ausgaben. Kompakt
meldet seine bereits vorhandene Fotodarstellung nun auch als unterstützte
Vorlagenfunktion; ausgeblendete Kontaktdaten hinterlassen im PDF keinen leeren
Abschnitt. Auf einer Fortsetzungsseite werden Berufs- und Ausbildungs-Titel
nur ausgegeben, wenn dort auch Einträge stehen. Die Vorschau wurde mit einem
gedruckten A4-PDF und einem zweiseitigen Belastungsbeispiel verglichen.

## Phase 22: Klassisch

Die bestehende einspaltige Form mit den hellblauen Wellen bleibt erhalten.
Vorschau und PDF verwenden wieder dieselbe graue Abschnittsüberschrift;
allgemeine Dokumentregeln überschreiben die Vorlagenfarbe nicht mehr.
Titelabstand (2,2 mm), Eintragsabstand (3,2 mm) und Abstand innerhalb eines
Eintrags (0,8 mm) haben getrennte Standardwerte. Ausbildungs-Einträge stehen
mit 2,8 mm etwas enger. Der bestehende Abschnittsabstand und die vom Benutzer
gewählte Zeilenhöhe bleiben unabhängig einstellbar; Kompakt, Standard und Groß
nutzen weiterhin die gemeinsamen Designer-Einstellungen.

Projekt-Highlight, Hobbys & Interesses und weitere eigene Abschnitte stehen
als normale Klassisch-Abschnitte im Inhaltsfluss. Zertifikatslisten folgen in
beiden Ausgaben denselben Abständen. Die Profil-Sichtbarkeit bleibt erhalten.
Eine gedruckte A4-Seite und ein zweiseitiges Beispiel wurden auf gleiche
Abschnitte, Umbrüche und Abstand zum Footer geprüft.
