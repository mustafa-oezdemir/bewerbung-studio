import { createServer } from 'vite';
import { parseHTML } from 'linkedom';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('tmp/closing-qa');
await fs.mkdir(output, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
  const { applyResumeClosingOutput, resumeClosingCss } = await vite.ssrLoadModule('/src/shared/resumeClosing.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { defaultDocumentDesign } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const profile = { firstName: 'Mina', lastName: 'Kaya', city: 'Berlin', applicationPlace: 'Marburg', applicationDate: '2026-09-28',
    signaturePath: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    resumeClosing: { showPlace: true, showDate: true, showSignature: true } };
  let count = 0;
  for (const { id } of templates) for (const surface of ['preview', 'pdf']) for (const [placement, alignment] of [
    ['footer', 'distributed'], ['footer', 'center'], ['main', 'left'], ['main', 'right'],
  ]) {
    const source = await fs.readFile(`tmp/section-inheritance-qa/${id}-visual-${surface}.html`, 'utf8');
    const { document } = parseHTML(source);
    const page = surface === 'pdf' ? document.querySelector('.cv-sheet') : document.querySelector('.managed-resume-preview');
    // Fixtures already contain their own closing. Exercise only the one created for this QA case.
    page.querySelectorAll('[data-resume-closing],footer.pehlione-closing,footer.pehlione-pdf-closing').forEach(node => node.remove());
    const main = page.querySelector('.pehlione-main,.pehlione-pdf-main,.elegant-main,.elegant-pdf-main,.modern-resume-left-column,.modern-pdf-left,.zweispaltig-main,.zweispaltig-pdf-main,.zeitgenoessisch-main,.zeit-pdf-main,.kreativ-main,.kreativ-pdf-main,.gepflegt-main,.gepflegt-pdf-main,.kompakt-left,.kompakt-pdf-columns>main,main')
      ?? page.querySelector('[data-managed-section="experience"]')?.parentElement ?? page;
    const settings = { ...defaultDocumentDesign, resumePresentation: { closing: { placement, alignment } } };
    applyResumeClosingOutput(page, main, profile, id, settings, true, true);
    const style = document.createElement('style');
    style.textContent = resumeClosingCss;
    document.head.appendChild(style);
    await fs.writeFile(path.join(output, `${id}-${surface}-${placement}-${alignment}.html`), document.toString());
    count++;
  }
  console.log({ count });
} finally { await vite.close(); }
