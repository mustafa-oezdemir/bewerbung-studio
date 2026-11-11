# Shared CV design: work in progress

## Scope and sequence

Sources: `.lebenslauf/todo/task.md`, `view.md`, `todo_1.md`, `spalte.md` and `app_todo.md`
(27 September 2026). The sequence in `task.md` governs the work: shared foundations, template
corrections, then a custom designer and application features. Each completed step is verified and
pushed separately.

## Step 0: Architecture and Baseline

Starting commit: `1ce2cc8`. No visual change in this step.

| Area | Existing implementation | Implication |
| --- | --- | --- |
| Data and validation | `src/shared/schema.ts`, Zod | Keep profiles and applications compatible. |
| Templates | `src/shared/templates.ts`, `src/components/resume/templates/*` | Extend existing defaults; avoid a second template registry. |
| Design | `src/shared/documentDesign.ts` | Extend existing color, font, spacing, and CSS variables. |
| Design state | `src/shared/documentEditorState.ts`, `templateDesigns` in Application | Template changes can inherit undefined settings; reset did not restore colors. |
| Storage | `electron/storage.ts` (DataStore), `src/store/useAppStore.ts`, IPC | Reuse Zod-validated JSON, atomic writes, and backups. |
| Preview | `src/views/DocumentsView.tsx`, React templates, `ManagedResumePreview.tsx` | Resolve shared settings before rendering. |
| PDF | `electron/documents.ts`, HTML/CSS, Chromium | Standalone markup already has a shared projection through `resumeManagedOutput.ts`. |
| Word | `electron/templates/*`, placeholders in `electron/storage.ts` | Keep the existing engine; bundled DOCX files were missing at baseline. |
| Custom sections | `specialSections`, `ResumeSpecialSections.tsx`, `resumeManagedOutput.ts` | React uses template classes in some places; PDF emits generic `managed-extra` blocks. |
| Order, visibility, columns | `features/resume-sections/resume-manager.ts`, `resume-section-system.ts` | Reuse existing metadata and organizer. |
| Profile and design separation | Presentation fields partly live in profiles; `resume-editor-settings.ts` protects drafts | Use compatible adapters without destructive migration. |
| Density and pages | `documentPagination.ts`, `resumeSectionLayout.ts`, template CSS | Preserve template defaults and separate section spacing from entry spacing. |
| Icons and strengths | `technologyBrand.ts`, `strengthSymbols.ts`, `resumeSectionLayout.ts` | Automatic and manual icons and 1–4 columns already exist (commit `86ba317`). |
| Closing block | `resumeClosing`, profile signature; Pehlione has separate switches | Unify behavior across templates. |
| Application shell | `src/App.tsx`, settings theme | Light/dark support is partial; the local toggle is not fully persisted, and ToDo/notes were missing. |

Active templates: Pehlione White, Pehlione White Blue, Zweispaltig, Gepflegt, Tabellarisch, Modern,
Elegant, Zeitgenössisch, Kreativ, Ivy League, Stilvoll, Kompakt, Einspaltig, Klassisch. Old template
definitions remain readable for saved applications. Alias `einfach` refers to `einspaltig`.

Baseline on 27/09/2026:

- Type check: successful.
- Tests: 461 successful, 6 existing errors in `electron/templates/template.service.test.ts`.
- Cause of the six errors: missing `public/templates` directory with bundled DOCX templates; no new renderer errors.
- Production build: successful, with existing bundle and Vite warnings.
- Last visual check: Einspaltig preview and a real A4 PDF, including a custom section, bottom line, and dashed entry separators.

The missing Word files were an open baseline issue. A full quality gate could only be reported as
passing after those files were restored and checked.

## Further steps

- [X] 0: Document architecture and baseline.
- [X] 1: Common semantic design resolution without changing default views.
- [X] 2: Template related overrides and full reset.
- [X] 3: Separate profile data from presentation while retaining compatibility.
- [X] 4: Normalize custom sections.
- [X] 5: Inherit template styles for custom sections.
- [X] 6–7: Common columns, placement, order and visibility.
- [X] 8–9: Spacing and metadata layout.
- [X] 10–11: Review existing strengths/icon solution against common requirements.
- [ ] 12–13: Closing block and common preview/PDF resolution.
- [ ] 14–24: Check and correct templates individually based on their references.
- [ ] 25–28: Design panel, custom designs, Word integration, and editor.
- [ ] 29–32: Todo, notes, notifications, persistent app theme.
- [ ] 33–35: Full regression, PDF checks and final quality gate.

Einspaltig's duplicate heading line was corrected in `1ce2cc8` before this sequence. The later
shared style review is still required.

## Step 1: Design foundation

`cvDesignSchema.ts` defines twelve semantic colors and separate typography and spacing values with
validated bounds. `cvDesign.ts` resolves native template values and explicit overrides only;
overrides equal to defaults are removed before saving. Missing or explicitly undefined values
inherit their defaults.

The existing twelve `*.defaults.ts` modules are now below `src/shared/cvTemplateDefaults`; previous
React import paths continue to export the same constants. `cvTemplateTokens.ts` adapts these
constants as well as Pehlione's CSS values. The tokens describe the normal visual template; existing
ATS/density variants are taken into account in the later renderer connection.

This step provides the common resolution and CSS units. It changes no style sheets, no renderer
output, and no saved data. Persistence follows in step 2, semantic style mapping and output adapters
in step 5 and 13, respectively. The new foundation alone is not yet a finished design panel.

Verification: 204 resolver, preview, and PDF tests passed. All active templates are covered; tests
check colors, units, bounds, aliases, isolated defaults, and sparse overrides. Existing renderers
remain unchanged.

## Step 2: Template switching, storage, and reset

`documentEditorState.ts` now initializes a new template exclusively with its defaults. Inactive
templates only store deviations; historical full snapshots will continue to be read. The active
`designSettings` object remains complete for compatibility reasons. New semantic values are
optionally and partially below `cvOverrides`; the existing DataStore takes over the persistence.

Validation separates complete settings from partial overrides so Zod does not add global defaults
when loading an empty override. The design reset in `DocumentsView.tsx` also resets accent/secondary
color and removes semantic overrides. Other templates, profile data and content will be retained.
Single-field reset is available as a shared state helper; the new semantic controls and their
output connection will follow in later steps.

Check: Typecheck and Production Build successful. 538 tests successful, only the six documented Word
baseline errors remain. New tests check all 14 templates for isolation, exact PDF-HTML equality
after reset, old snapshots, alias compatibility as well as save/restart/reset via the real
DataStore. In addition, a real Einspaltig-A4 PDF was generated and rendered after reset: template
colors, background, custom header and dashed separator correct; preview and PDF have the same
calculated header frames.

### Phase 3 – Content and presentation

New changes to visibility, section titles, order, column mapping, contact fields, and closing block
options are saved as sparse `resumePresentation` in the template-specific document settings.
Existing profiles remain compatible; a common projection provides preview and PDF with their
previous profile structure. The editor saves the content separately and retains unsaved content
changes when changing templates. Reset removes the new overrides without deleting profile content.

Validation: Typecheck successful; complete run 542 passed and the six known errors due to missing
Word assets. Subsequently, 14 additional PDF regressions were added for all active templates:
targeted run 149 passed. These also check that CV settings do not change the cover letter.

### Phase 4 – Custom Section Normalization

`specialSections` remains the existing data model and receives an optional `contentType` (text,
list, entries, skills, timeline). Both profile editors offer this selection. Without explicit
selection, the common normalizer resolves old data based on its content and metadata, without
rewriting stored data or treating headings as special cases. Main sections and subsections are
semantically separated; simple content is no longer rendered as a title.

React preview and Electron PDF use the same escaped content output. Custom sections are matched by
ID, so sections with identical headings remain distinct. Empty entries do not create empty sections.
Existing metadata, description, details, and URLs are preserved with each type selection.

Validation: Build including Typecheck successful. 578 tests passed; still six known Word asset
errors. The new regression checks all five content types in all 14 active templates for identical
preview/PDF markup and unique IDs. Visual style inheritance and template-specific spacing will
follow in Phase 5.

### Phase 5 – Shared section style inheritance (27 September 2026)

All 14 active templates use common semantic roles for main section, entry title, supporting
organization/accent text, and metadata. The shared adapter generates CSS aliases from native
stylesheets, scoped to custom sections. Font, color, divider, inner/outer spacing,
entry spacing as well as density, ATS and wrapping rules remain bound to the respective template. No
global replacement defaults and no profile migration will be introduced.

Preview and PDF use the same content and style adapter. Existing nested headings will retain their
label/icon structure; new sections will be in front of the closing block. Subsections use their
renderer's native heading element type, which is why their HTML tags are allowed to diverge between
preview and PDF; content, IDs, and semantic roles remain the same. Career column geometry is not
copied to free entries. Existing persistence and template-related reset are retained.

The PostCSS dependency is integrated externally in Electron: Node loads the CommonJS package itself,
so that the ESM build no longer fails on `require("path")`. The renderer will continue to use the
browser build of the library.

Validation:

- `npm run release:check`: type check, 65 test files / 604 tests, and production build passed.
- `node scripts/section-inheritance-qa.mjs` and `npx electron scripts/check-section-inheritance.cjs`:
  56 computed style checks (14 templates × visual/ATS × preview/PDF) found no deviations. The shared
  keep-with-next rule may also prevent an orphaned heading.
- Fourteen real A4 PDFs were generated, rendered with Poppler, and visually checked.
- `npx electron scripts/electron-startup-smoke.cjs`: main process, preload, and React loaded.
- Missing Word test assets under `public/templates` were restored with the existing
  `create-*-lebenslauf.py` generators, resolving the six baseline failures.
- Existing bundle size and Vite deprecation warnings did not fail the build.

QA output is under `tmp/section-inheritance-qa`. Template-specific redesigns are not part of this
phase.

### Phase 6 – Common Layout Engine (27/09/2026)

The shared layout resolver supports one- and two-column CVs, side columns on the left or right, and
safe ratios from 20/80 to 40/60 in increments of five. Without a saved layout selection, the native layout of each
template, including its own width, remains unchanged. One choice in the design panel is saved per
application; "Template" removes mode, side, and width overrides and restores the native template.
Existing Pehlione profile widths are retained when only the side changes.

The shared DOM adapter is applied after section management in React preview and Electron PDF. For
originally single-column templates, it creates main and side columns with a header spanning both columns.
In the case of native two-column templates, it rearranges the existing areas without duplicating
their content. The automatic width of the knowledge/strength grid follows the selected main column.
ATS outputs retain their single-column representation.

Validation: `npm run release:check` with 66 test files / 623 tests and build successful; Electron
start successful. `node scripts/layout-engine-qa.mjs` generates 84 preview/PDF combinations from the
Phase 5 fixtures; `npx electron scripts/check-layout-engine.cjs` confirms the calculated column
width, order and common grid row for all 84.

### Phase 7 – Section Placement, Order and Visibility (27/09/2026)

The existing section manager is the central processing point for visibility, order and assignment to
the main or side column. All content sections including work experience, education, project
highlight and dedicated areas may be moved to both columns. Header, personal details, photo and
conclusion remain fixed structural elements. The organizer offers drag & drop with marked target as
well as focusable handles: arrow up/down changes the order, left/right the column. Eye switches and
position selection are retained as direct alternatives.

The assignment is stored as a sparse, application-related `resumePresentation.sections` override.
Old profiles and unchanged templates retain their original appearance. In the case of single-column
output, the groups are arranged in one column; when switching to two columns, the assignment is
retained. Section-Save also preserves the layout overrides from phase 6. React-Preview and
Electron-PDF use the same section projection.

Validation: `npm run release:check` and the Electron start test; regressions check the assignment
and visibility for all 14 templates in preview and PDF, the single-column group flow and the
persistence roundtrip.

### Phase 8 - Semantic spacing system (27 September 2026)

The existing CV token model now also controls the actual CV output: page margin, internal spacing,
section spacing, entry spacing, spacing after section and entry titles, column spacing and line height are
separate values. In particular, entry spacing changes only consecutive career entries, while section
spacing acts between main areas. Existing native CSS values remain unchanged without override.

"Kompakt", "Standard", and "Groß" (compact, standard, and large), plus bounded mm and line-height
fields, are available in the design panel. "Standard" removes semantic spacing overrides and restores older sliders to
the defaults of the selected template. Old stored slider values remain readable and are
displayed in the editor until the respective semantic value is explicitly set. Overrides are saved
sparingly and template-related; Preview and PDF use the same HTML/CSS adapter.

Validation: `npm run release:check`; 28 Electron geometry checks (14 templates × Preview/PDF) for
section, title and entry spacing, page margin and common interior/column/row variables.

### Phase 9 - Common metadata layout (27.09.2026)

For work experience and education, the design panel can arrange position/degree,
company/institution, period, and location side by side or stacked. In side-by-side mode, the date
can be placed on the left. Without a selection, native template layouts remain. The shared HTML
adapter uses the same data in preview and PDF and preserves achievement lists. The setting is saved
as sparse overrides for each template;
"Template-Standard" or Design-Reset removes the adjustment.

Validation: HTML regressions for 14 templates × Preview/PDF × three arrangements and 84 Chromium
geometry checks for row/column positions.

### Phase 11 - Automatic Technology Icons (28.09.2026)

A common resolver first selects a valid manual symbol or devicon, then an automatically recognized
technology icon and finally an escaped text symbol. Common spellings for Go, JavaScript, TypeScript,
React, Spring, Python, PHP, Docker and GitHub are mapped to the same identity. Strengths and skills
use the same resolver in preview and PDF; the existing color adjustment is retained. Tests check
manual priority, aliases and secure fallbacks.

### Phase 12 - Place, date and signature (28.09.2026)

The three components of the CV closing block can be shown or hidden independently. The signature is
loaded exclusively from the validated profile image. Placement (footer/main column) and alignment
(left/center/right/distributed) are available as template-related presentation values; a design
reset restores the native template. Unchanged Pehlione templates retain their previous closing
block. Other templates use the shared block when closing data is present; page-number-only footers
remain when the closing block is hidden.

Preview and PDF use the same adapter. Validation includes HTML regressions for all 14 templates and
112 chromium geometry checks of the two positions and four alignments, with no page overflow or
overlap.

### Phase 13 - Common CV Resolution (28.09.2026)

Preview and PDF get profile projection, visible sections, knowledge groups, layout, design values
and page layout from `resolveCvDocument`. The template-specific capacities for pagination are
assigned there once. The common HTML adapter receives already resolved sections, columns and
spacing values. The Pehlione short profile fallback uses the same order in both outputs: document
text, matching cover page statement, profile summary. The templates keep their own renderers and
their native standards without override.

Validation: Regressions for all 14 templates with multi-page resume, section and layout overrides;
full release check.

### Phase 14 - Pehlione White Blue (28.09.2026)

Career rows place the period and position/degree on one line at the same font size, with location and organization directly below in their respective columns. These values come only from the profile. If the profile has no job title, the application does not supply a substitute. New project and interest sections inherit the native section heading. A custom project section replaces the derived project display to avoid duplicate content. Photo rendering is aligned between preview and PDF.

The design panel offers sparse, template-specific overrides for title and section colors, column backgrounds, side-column text, line color, width, and visibility, and photo decoration color and visibility. Without these values, the original Pehlione design remains. Visibility, order, and column placement still use the shared section manager; spacing and metadata layout use the shared systems. Design reset removes the new overrides.

Validation: HTML regressions for preview/PDF, persistence roundtrip, chromium geometry check of
date, title, location, institution as well as the two special sections and visual check of a
one-page A4 PDF.

PDF rework: Main sections moved to the side column had an outer and an inner heading line there at
the same time. The outer line is omitted; summary and certificates again show one line each. The
contact line retains the white of the preview without override and has its own template-related
color setting. The contact heading, symbols and contact details take over the selected text color of
the side column. The native closure remains in the main column after moving other sections. The
error was reproduced with the saved settings of a real Pehlione white-blue document and checked
using a one-page A4 PDF.

Side-column section headings now have a template-specific color setting in all CV templates. If no heading color is set, they use a selected side-column text color. Without either override, native template colors remain. Preview and PDF use the same section projection. The contact line remains separately adjustable.

The design surface uses a common compact color card control for accent, area and other color values.
The template panel has four cards per wide row and collapses to two or one column if the panel width
is smaller. The PDF note is above the panel; the section organizer follows after that. Section title
colors are applied to standard and custom sections based on the main or side semantic column,
regardless of whether the side column is on the left or on the right.

Pehlione White Blue: The "Languages" section shows a language icon in the same accent icon field as
other icon-bearing section titles in preview and PDF. The heading color and section line continue to
follow the saved design values.

## Phase 15: Pehlione White

Pehlione White uses the same section and design projection as White Blue, with its own default colors and backgrounds. The renderers remain shared; custom sections in White also receive Pehlione headings and icons. Colors and visibility can be overridden and reset in the same template panel.

Certificates and project highlights moved to the side column show only one heading line in the PDF.
The long subtitle remains in preview and PDF within the main column with right spacing. Checked with
the saved Pehlione White data in a single-page A4 PDF, plus 756 tests and a build.

Pehlione White: The contact heading's icon uses the accent color. Its line, like the rest of
the section lines, follows the common line color. The separate contact line color control is omitted
for White; older stored contact line values are no longer evaluated there.

The shared side-column color projection also colors SVG icons in section headings. A specific “Seitenspalte Abschnittstitel” (side-column section heading) value takes precedence over the accent color for both text and icon; otherwise the template's accent appearance remains. This applies to preview and PDF in every template with section icons.

When moving a main section to the side column, its heading is no longer forcibly set to the side
column text color. This means that certificates and project highlights, for example, initially
retain the accent color and follow an explicitly selected side-column heading color.

Pehlione White PDF: Sections moved to the side column use White's native side-column heading. As in the preview, icons have no colored tile and the line begins after the icon, at the text. Certificates also use the preview's graduation icon in PDF.

## Phase 16: Zweispaltig and shared design

Zweispaltig retains its 62/38 layout and native colors without saved overrides. The existing common
systems for metadata, section order, column position and width, special sections and
location/date/signature are used in Preview and PDF. The two metadata modes and a 35/65 variant were
checked with project highlights and hobbies and interests in both outputs. Both sample PDFs remained
single-page A4 documents.

"Colors and Decoration" is now a shared panel for all CV templates. Background, side-column
text, section lines and photo decoration are applied to preview and PDF for other templates via the
same HTML projection path. Missing values leave the native template design unchanged; the panel
reset removes the saved decoration overrides. For Pehlione, the existing projection remains active.

Side-column text color also controls entries under "Certificates". Section titles and icons
retain their separate color priority; the Pehlione theme background remains unaffected by this text
customization.

## Phase 17: Zeitgenössisch

Sections added later take over the existing Zeitgenössisch heading with icon tile, font and spacing
in preview and PDF. Strengths also receive this layout even if the block is only created by the
common section manager. Suitable symbols for interests and projects are selected based on the saved
section type; freely named sections use a neutral symbol. Existing native sections and profile
content will remain unchanged.

## Phase 18: Kreativ

Kreativ uses the same template values for the spacing under the header area, between sections and
between work experience entries for preview and PDF. The space in front of the footer is defined as
its own template value. Sections added later are in the main column and retain their normal heading
and content type; project highlights and hobbies and interests render separately from education.
The visibility of phone, email, LinkedIn, GitHub, website, address and photo will still follow the
resolved profile.

## Phase 19: Stilvoll

Stilvoll uses common native values in Preview and PDF for the spacing between header and content (6
mm), between sections (6 mm) and between work experience and education entries (3.8 mm). The existing
settings "Kompakt", "Standard", and "Groß" (compact, standard, and large), plus separate entry
spacing, remain available for saved CVs. The old section-spacing slider still applies. Project
highlights and hobbies and interests inherit the Stilvoll heading and follow the saved column
position. Preview and printed A4 PDF were compared with profile and additional sections; the
existing two-column design is preserved.

## Phase 20: Kompakt

Kompakt retains its wide main column (108 mm) and narrow side column (66 mm); the common ratio
setting now matches this native division. Default entry spacing is 3.2 mm and remains separate from
section spacing (3.5 mm) and title spacing. Compact, standard, and large modes
have the same effect on work experience and education entries in preview and PDF; stored values of the
older section-spacing slider remain effective.

Additional sections such as project highlights and hobbies and interests are available as independent
sections in the selected column. Long contact values break within the side column. The orange line
graphic uses the secondary color and the same fine line thickness in both outputs. Kompakt now
declares its existing photo display as a supported template feature; hidden contact details
do not leave an empty section in the PDF. On a continuation page, work experience and education
headings render only if entries are present. The preview was compared with a printed A4 PDF and a
two-page stress sample.

## Phase 22: Klassisch

The existing single-column shape with the light blue waves is preserved. Preview and PDF use the
same gray section heading again; general document rules no longer override the template color. Title
spacing (2.2 mm), entry spacing (3.2 mm), and spacing within an entry (0.8 mm) have separate defaults.
Education entries are slightly closer at 2.8 mm. Existing section spacing and the user-selected line
height remain independently adjustable; compact, standard, and large modes continue to
use the common designer settings.

Project highlights, hobbies and interests, and other custom sections appear as normal Klassisch
sections. Certificate lists use the same spacing in both outputs. Profile-based visibility is
maintained. A printed A4 page and a two-page sample were checked for equal sections,
breaks and distance to the footer.

## Phase 23: CV design system (1 October 2026)

CV design values now have one typed source and a fixed precedence order. With no changes, each template keeps its previous appearance. Preview and PDF resolve values through the same system.

**Template values.** Each active template has a complete `NativeResumeDesign` (tokens and appearance) alongside its other constants in `cvTemplateDefaults/*.defaults.ts`; Pehlione has a new `pehlione.defaults.ts` module. `cvTemplateTokens.ts` only registers them. Values were measured in rendered PDFs at standard density: font sizes, weights, capitalization, line height, section, entry and title spacing, and page margins. The old generic fallback values in `resolveTemplateCvDesign()` were removed. Only templates rendered exclusively by the legacy generic renderer derive their design from document settings (`legacyGeneric.defaults.ts`). Section-title tokens and Pehlione appearance CSS use the same values.

**Precedence** (`resumeDesignSystem.ts`), from lowest to highest: template → legacy document sliders and font levels, only when they differ from template defaults → shared workspace CV settings (`settings.resumeDesign`) → sparse application overrides (`designSettings.cvOverrides` / `resumeAppearance`, including inactive template snapshots in `templateDesigns`). Each layer stores differences only; missing values are inherited. `applyGlobalResumeDesign` incorporates the shared layer before `resolveCvDocument` runs. Preview (`DocumentsView`), PDF (`buildDocumentHtml(..., resumeDesign)` with `workspace.settings.resumeDesign`), the page planner, and the spacing adapter read the resolved result. Cover letters, cover sheets, and email are unaffected.

**Saving.** The shared layer is a draft like other design settings: preview updates with each input, and `saveSettings` writes it when the user chooses “Texte speichern” (save text) or before PDF export. Application values are compared with what the document would inherit without them (template plus shared layer); shared values are never compared with just one template. “Vorlagenwerte wiederherstellen” (restore template values) removes the shared layer and the open application's overrides. Other applications retain their overrides. Old workspaces load unchanged.

**Panel.** `ResumeDesignPanel` replaces three separate blocks with one configuration for all templates: colors and decoration (colors, columns, section headings, lines, photo), detailed typography, and advanced spacing. Each field displays its effective value, template value, and source (template, global, or application). Scope can be switched between all CVs and the current application. Duplicate controls were removed: line height appears only under typography, and “Abstand danach” is the same setting as “Abstand nach Abschnittstitel.” Older sliders, fonts, and colors for cover letters and cover sheets are grouped under “Dokumentweit.” These German labels identify controls in the application.

**Output adapter corrections.** Measuring template values revealed that “Lesetext (pt)” (body text size) affected lists only in Einspaltig; page margins were added to native margins (up to 25 mm too much); and section spacing was added to native column spacing in Gepflegt and Modern. A selected page margin now moves the actual template margin to the exact value, and the page planner uses the same difference.

**Verification.** New tests cover `cvTemplateDesigns`, `resumeDesignSystem`, `resumeDesignEditing`, `resumeDesignOutput`, `ResumeDesignPanel`, and `resumeDesignStorage` (a real DataStore round trip). `node scripts/design-system-qa.mjs` and `npx electron scripts/check-design-system-qa.cjs` made 336 Chromium measurements across 14 templates. Typed template values matched printed PDFs, and the shared layer affected preview and PDF with the entered values. `check-spacing-qa.cjs` checked the margin adjustment.

**Known issues outside this phase.** The deviations in `check-section-inheritance.cjs` and `check-closing-qa.cjs` existed before this phase. In Elegant, Gepflegt, and Tabellarisch previews, `.document-paper h2` overrides template colors for names and titles; PDFs use the template colors. Pehlione and the other stylesheets still contain their own numeric values. A test checks that Pehlione's palette agrees with the typed module.

## Phase 24: Separate page margin and inner padding (1 October 2026)

“Seitenränder (mm)” (page margins) and “Innenabstand (mm)” (inner padding) are independent settings. Each has its own override (`pageMarginMm` / `innerPaddingMm`), source (template, global, or application), reset control, and sparse stored entry. State, resolver, and panel layers already treated them separately; the output adapter conflated them.

**Cause.** `applyResumeSpacingOutput` set inner padding as `padding-inline` on the layout host or columns, replacing their native padding. In most templates, that native padding is the page margin: host padding in Einspaltig, Klassisch, Tabellarisch, and Ivy League; column padding in Elegant, Gepflegt, and Pehlione. Setting inner padding therefore overrode the page margin. In Einspaltig, a 10 mm margin plus 2.5 mm inner padding drew text at −2.5 mm, outside the page; a 16 mm margin placed it at 3.5 mm.

**Model.** Page margin is the distance from page edge to content; inner padding adds space within columns. Padding native to a template counts as its page margin, so every template's native inner padding is now 0 (previously 13, 10, and 7 mm in Elegant, Gepflegt, and Pehlione). A chosen inner padding is added separately. `getPageMarginAdjustment` still moves the page scope. Inner padding marks columns, or the host for a single-column template, with `data-resume-spacing-inner`. The `resumeSpacingCss` rule `[data-resume-spacing-inner]>*{padding-inline:var(--doc-inner-padding)!important}` indents their children while preserving host and column padding. The left content edge is therefore at: native margin + (chosen page margin − native margin) + inner padding. Inner padding moves content inward on both sides. The panel explains both fields.

**Verification.** `resumeDesignEditing` covers changes in both directions and scopes, shared margins with application-specific inner padding and vice versa, per-field reset, and legacy slider levels. `ResumeDesignPanel` checks that displayed values and sources match the resolver and that editing or resetting one field does not change the other. `resumeSpacing` checks that host padding remains intact. `resumeDesignOutput` checks that preview and PDF use the same values across all 14 templates without overwriting template padding, and that shared and application values render identically. `design-system-qa` adds 504 measurements for margin alone, a smaller margin, inner padding alone, and both together. `check-spacing-qa.cjs` checks the column or host marker.

**Known issues outside this phase.** With fixed column widths, the right content edge in Stilvoll, Kompakt, Elegant, and Modern does not follow a changed page margin symmetrically; the left edge is exact. In templates whose header is outside the columns (Zweispaltig, Zeitgenössisch, Kreativ, Stilvoll, Kompakt, Modern), inner padding indents the columns but not the header.
