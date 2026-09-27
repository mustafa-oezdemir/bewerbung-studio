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
- [ ] 1: Gemeinsame semantische Designauflösung, ohne Defaultansichten zu verändern.
- [ ] 2: Vorlagenbezogene Overrides und vollständiger Reset.
- [ ] 3: Profildaten und Darstellung kompatibel trennen.
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
