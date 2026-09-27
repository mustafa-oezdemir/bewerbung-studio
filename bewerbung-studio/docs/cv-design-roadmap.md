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
- [ ] 4–5: Eigene Abschnitte normalisieren und Vorlagenstile vererben.
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
