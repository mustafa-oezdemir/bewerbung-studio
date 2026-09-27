import { createServer } from 'vite';
import { parseHTML } from 'linkedom';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('tmp/spacing-qa');
await fs.mkdir(output, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
  const { applyResumeSpacingOutput, resumeSpacingCss } = await vite.ssrLoadModule('/src/shared/resumeSpacing.ts');
  const { resumeSectionStyleSources } = await vite.ssrLoadModule('/src/shared/resumeSectionStyleInheritance.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { defaultDocumentDesign } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const settings = { ...defaultDocumentDesign, cvOverrides: { spacing: {
    pageMarginMm: 18, innerPaddingMm: 4, sectionGapMm: 7, entryGapMm: 3,
    sectionTitleGapMm: 2.5, entryContentGapMm: 1.5, columnGapMm: 8,
  }, typography: { lineHeight: 1.3 } } };
  let count = 0;
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
    await fs.writeFile(path.join(output, `${id}-${surface}.html`), document.toString());
    count++;
  }
  console.log({ count });
} finally {
  await vite.close();
}
