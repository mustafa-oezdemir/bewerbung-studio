import { createServer } from 'vite';
import { parseHTML } from 'linkedom';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('tmp/metadata-qa');
await fs.mkdir(output, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
  const { applyResumeMetadataLayout, resumeMetadataCss } = await vite.ssrLoadModule('/src/shared/resumeMetadataLayout.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { defaultDocumentDesign } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const profile = { experiences: [{ role: 'Softwareentwicklerin', company: 'Beispiel GmbH', city: 'Berlin', from: '2023', to: '2025' }],
    education: [{ degree: 'Fachinformatikerin', institution: 'Bildungsinstitut', from: '2020', to: '2023' }] };
  let count = 0;
  for (const { id } of templates) for (const surface of ['preview', 'pdf']) for (const [layout, order, suffix] of [
    ['side-by-side', 'details-first', 'right'], ['side-by-side', 'dates-first', 'left'], ['stacked', 'details-first', 'stacked'],
  ]) {
    const source = await fs.readFile(`tmp/section-inheritance-qa/${id}-visual-${surface}.html`, 'utf8');
    const { document } = parseHTML(source);
    const page = surface === 'pdf' ? document.querySelector('.cv-sheet') : document.querySelector('.managed-resume-preview');
    applyResumeMetadataLayout(page, profile, id, surface, { ...defaultDocumentDesign, metadataLayout: layout, metadataOrder: order });
    const style = document.createElement('style');
    style.textContent = resumeMetadataCss;
    document.head.appendChild(style);
    await fs.writeFile(path.join(output, `${id}-${surface}-${suffix}.html`), document.toString());
    count++;
  }
  console.log({ count });
} finally { await vite.close(); }
