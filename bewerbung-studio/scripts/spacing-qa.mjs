import { createServer } from 'vite';
import { parseHTML } from 'linkedom';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('tmp/spacing-qa');
await fs.mkdir(output, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
  const { applyResumeSpacingOutput, getPageMarginAdjustment, resumeSpacingCss } = await vite.ssrLoadModule('/src/shared/resumeSpacing.ts');
  const { resolveTemplateCvDesign } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { resumeSectionStyleSources } = await vite.ssrLoadModule('/src/shared/resumeSectionStyleInheritance.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { defaultDocumentDesign } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const settings = { ...defaultDocumentDesign, cvOverrides: { spacing: {
    pageMarginMm: 18, innerPaddingMm: 4, sectionGapMm: 7, entryGapMm: 3,
    sectionTitleGapMm: 2.5, entryContentGapMm: 1.5, columnGapMm: 8,
  }, typography: { lineHeight: 1.3 } } };
  let count = 0;
  const expected = {};
  for (const { id } of templates) for (const surface of ['preview', 'pdf']) {
    const source = await fs.readFile(`tmp/section-inheritance-qa/${id}-visual-${surface}.html`, 'utf8');
    const { document } = parseHTML(source);
    const entrySelector = resumeSectionStyleSources[surface][id][6];
    const entry = Array.from(document.querySelectorAll(entrySelector)).find(node =>
      node.closest('[data-managed-section]')?.getAttribute('data-managed-section') === 'experience');
    if (entry) entry.parentElement.appendChild(entry.cloneNode(true));
    const page = surface === 'pdf' ? document.querySelector('.cv-sheet') : document.querySelector('.managed-resume-preview');
    applyResumeSpacingOutput(page, id, surface, settings);
    const style = document.createElement('style');
    style.textContent = resumeSpacingCss;
    document.head.appendChild(style);
    // A chosen page margin moves the template's own margin: the QA checks that adjustment, not a raw padding.
    // Gepflegt and Kompakt move the column edges themselves (resolveGepflegtGeometry / resolveKompaktGeometry): no
    // text shift inside the sections.
    const ownGeometry = ['gepflegt', 'kompakt'].includes(id);
    expected[id] = { ...getPageMarginAdjustment(id, settings.cvOverrides.spacing.pageMarginMm), ...(ownGeometry ? { shiftMm: 0 } : {}),
      innerShiftMm: settings.cvOverrides.spacing.innerPaddingMm - resolveTemplateCvDesign(id).spacing.innerPaddingMm };
    await fs.writeFile(path.join(output, `${id}-${surface}.html`), document.toString());
    count++;
  }
  await fs.writeFile(path.join(output, 'expected-margin.json'), JSON.stringify(expected, null, 1));
  console.log({ count });
} finally {
  await vite.close();
}
