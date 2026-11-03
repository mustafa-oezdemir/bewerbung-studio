# Local SVG icon catalogs

Implemented on `codex/icon-catalogs`, 2026-11-03. Existing Devicon, Go-framework and symbol IDs remain supported. No user data migration is performed.

## Sources and scope

| Source | Pinned source | Catalog IDs | Packaged SVG files | Selectable IDs |
| --- | --- | ---: | ---: | ---: |
| Material Icon Theme | v5.40.0, `045291ff033062a25441dd297fd51546326866f2` | 859 | 908 | 859 |
| vscode-icons | `f0a0c40aeae5eba2917ada14ad59b7e7f729e396` | 1,298 (1,088 file, 210 folder) | 151 | 85 |

Material's MIT license is in `src/assets/material-icons/LICENSE`. The pinned vscode-icons README links its artwork license to **CC BY-SA 4.0**; its code MIT license does not cover all branded artwork. The generic allowlist in `scripts/import-vscode-icons.mjs` is the approved redistribution scope. The remaining 1,213 IDs retain their original names and variant metadata but are disabled, with no SVG distributed, because their individual artwork/brand permissions were not cleared in this audit. This is an explicit exclusion, not a missing upstream file. Every excluded ID is identifiable by `available: false` in `vscodeIconCatalog.generated.ts` and in the comparison report.

The Oracle Coffee Cup with Java wordmark requested separately is excluded: Oracle's [branding guidance](https://www.oracle.com/a/ocom/docs/java-licensing-logo-guidelines-1908204.pdf) requires a written commercial trademark license and prohibits modified versions. Existing Java choices remain available.

Upstream sources: [Material](https://github.com/material-extensions/vscode-material-icon-theme/tree/v5.40.0), [vscode-icons README](https://github.com/vscode-icons/vscode-icons/tree/f0a0c40aeae5eba2917ada14ad59b7e7f729e396#license), [files](https://github.com/vscode-icons/vscode-icons/wiki/ListOfFiles), [folders](https://github.com/vscode-icons/vscode-icons/wiki/ListOfFolders).

## Comparison and behavior

`src/shared/iconComparison.generated.json` records 423 common entries, 440 Material-only entries and 875 vscode-only entries. It identifies 226 matches with association evidence, 7 reviewed aliases and 190 matches based on the published name/kind only; these last matches are not presented as a visual equivalence audit. All available source alternatives remain selectable, including 42 common vscode alternatives. No shared artwork is deleted based on this comparison.

The picker has independent source/type filters, search, original names, selected previews and 48-entry pagination. Searching JavaScript finds Material `javascript` and vscode `js`. Filters do not write an icon selection. Source/kind/name form the stored ID; Material folder names retain their upstream `folder-` prefix.

Original files are preserved. A DOM-based SVG renderer validates local references, namespaces IDs and applies original or themed paint. Deckblatt uses original paint; CV uses the resolved icon color. Local SVG modules load on demand in the renderer. PDF export waits for the same packaged modules before producing HTML. Tests alone use synchronous source loading.

## Changed implementation files

- Catalog metadata, renderer and loaders: `src/shared/{materialIconCatalog*,vscodeIconCatalog*,iconComparison.generated.json,localSvg*,technologyBrand.ts,deviconCatalog.ts}`.
- Source assets and attribution: `src/assets/material-icons/`, `src/assets/vscode-icons/`.
- Picker/preview: `TechnologyIconPicker.tsx`, `TechnologyBrandIcon.tsx`, `ManagedResumePreview.tsx`, `useLocalSvgCatalog.ts`, the relevant `DocumentsView.tsx` and `app.css` hunks.
- Document integration: `src/shared/deckblatt.ts`, `deckblattDesigns.ts`, `electron/documents.ts`, `electron/main.ts`.
- Import/verification: `scripts/build-material-icon-catalog.mjs`, `import-vscode-icons.mjs`, `icon-offline-e2e.mjs`, extended Electron E2E fixtures, catalog/picker/document regression tests and `vite.config.ts`.

Unrelated existing pagination, Kompakt and email preview edits are excluded from the icon commit.

## Verification

- TypeScript and production builds passed. The renderer emits separate local SVG chunks instead of embedding their contents into its main chunk.
- Catalog, manual priority, source/type/search combinations, two CV colors, original Deckblatt colors, SVG safety and document regression checks passed.
- Real Electron profile save/restart and PDF phases passed for both sources; four Chromium PDFs were generated (two CVs, two three-page Mappen). Rendered Deckblatt/CV pages were inspected for source paint, themed shape and clipping. DOM preview source IDs and resolved colors were checked. Pixel-perfect screenshot parity across every template is not claimed.
- An actual Windows unpacked package was built. `icon-offline-e2e.mjs` blocked HTTP/HTTPS in its renderer and verified both source icons and CV paint from local packaged modules.
- The general Electron E2E stopped before the icon phases because migration backups appeared as untracked files in its synthetic Git workspace. Its profile/PDF phases were run independently and passed. No security guard was relaxed.
- The encryption subprocess test can exceed its 30-second child timeout during unrestricted parallel runs; it passed independently. The final release check with `VITEST_MAX_WORKERS=2` passed all 5,004 tests, with 41 existing skips; typecheck and production builds passed.

No new dependency or dependency upgrade was needed. No push or remote merge is performed.
