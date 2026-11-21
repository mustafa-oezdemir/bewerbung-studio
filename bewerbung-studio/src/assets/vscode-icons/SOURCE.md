# vscode-icons asset source

Artwork: vscode-icons contributors · [upstream project and contributors](https://github.com/vscode-icons/vscode-icons/graphs/contributors).
License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
The included SVG artwork is copied from upstream. The app namespaces SVG IDs when rendering and can apply an optional
palette to the Lebenslauf output. Adapted artwork remains subject to the same CC BY-SA 4.0 terms. The application's
Apache-2.0 license is separate. The upstream code MIT license does not license branded SVG artwork.

## Source snapshot

- Upstream package version `13.0.0`, on the [2026-11-20 source commit `9e482fbb342849f4fefa20746657f97b88acc4ec`](https://github.com/vscode-icons/vscode-icons/tree/9e482fbb342849f4fefa20746657f97b88acc4ec), after the v13.0.0 release tag. [Upstream artwork license statement](https://github.com/vscode-icons/vscode-icons/blob/9e482fbb342849f4fefa20746657f97b88acc4ec/README.md#license).
- [ListOfFiles](https://github.com/vscode-icons/vscode-icons/wiki/ListOfFiles) and [ListOfFolders](https://github.com/vscode-icons/vscode-icons/wiki/ListOfFolders) from wiki commit `c6b602591adf87eeb130141021d79633600a8066`.
- Wiki SHA-256, normalized to LF: files `0a446d4955844d0a56fa0513b3961c7702d5961cc4be9dcec1d39bdc927feaea`, folders `25329b314747e5c8a2a9f712c3d663d5c18d247c0e0e603d31f08876f150ea84`.
- Source manifests: `src/iconsManifest/supportedExtensions.ts` and `src/iconsManifest/supportedFolders.ts`. Both agree with the wiki on the icon names. The manifests declare 57 light variants omitted from the wiki. These variants were checked against the tracked SVGs before being recorded.

| Kind | Wiki and manifest IDs | Selectable IDs | Artwork rights unverified |
| --- | ---: | ---: | ---: |
| File | 1,095 | 69 | 1,026 |
| Folder | 211 | 64 | 147 |
| Total | 1,306 | 133 | 1,173 |

All 1,713 manifest SVG variants exist upstream. The package includes 210 original SVGs from the reviewed generic set.
Compared with the previous local catalog, 45 file IDs and 3 folder IDs became selectable. The 59 new SVG files include
the light variants for the already selectable `js` and `yaml` IDs. Both `component` folder SVGs were updated. The other
149 previously bundled SVGs were left byte-for-byte as checked out.

The per-ID inventory in `src/shared/vscodeIconCatalog.generated.ts` records the name, kind and upstream filenames. A
current entry with `available: false` has artwork whose separate redistribution rights have not been verified. This
includes branded variants such as `git2` and `simple_icons`. A retired ID, `vscode:file:svglint`, is still recognized with
its previous fallback. Upstream now associates `.svglintrc` with `simple_icons`, a different drawing.

To reproduce the comparison and import, check out the two pinned commits and run
`node scripts/import-vscode-icons.mjs <upstream-checkout> <wiki-checkout>` from `bewerbung-studio`. The script validates the
manifest and wiki names, local SVG filenames and render safety before copying changed assets. The import has no effect
on other icon catalogs.
