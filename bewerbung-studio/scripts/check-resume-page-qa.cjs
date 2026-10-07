// One-column DIN template page QA in real Chromium (tmp/<TEMPLATE>-page-qa from `node scripts/resume-page-qa.mjs`): measures the
// preview HTML and the PDF HTML side by side (content edges, header, sections, every career bullet, footer, free space
// below the flow), prints both with the exporter's printToPDF options to <file>.pdf / <file>-preview.pdf and writes
// measure.json. Rasterise / extract the PDFs with scripts/check-resume-page-pdf.py.
//   [TEMPLATE=einspaltig] npx electron scripts/check-resume-page-qa.cjs [filter…]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve(`tmp/${process.env.TEMPLATE || 'klassisch'}-page-qa`);
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-') && !arg.includes('check-resume'));

const probe = (surface) => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 100) / 100;
  const sheets = [...document.querySelectorAll(surface === 'pdf' ? '.cv-sheet' : '.document-paper')];
  return sheets.map((sheet, index) => {
    const box = sheet.getBoundingClientRect();
    const rel = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return { left: mm(r.left - box.left), right: mm(r.right - box.left), top: mm(r.top - box.top), bottom: mm(r.bottom - box.top) }; };
    const root = sheet.querySelector(surface === 'pdf' ? '.page-content' : '[data-template]');
    const content = sheet.querySelector('.klassisch-pdf-content,.klassisch-content,.klassisch-ats,.einfach-pdf-inner,.einfach-content,.einfach-ats')
      ?? (root?.matches('.klassisch-pdf-ats,.managed-pdf-ats') ? root : null);
    const contentStyle = content && getComputedStyle(content);
    const contentBox = content && (() => { const r = content.getBoundingClientRect(); return {
      left: mm(r.left - box.left + parseFloat(contentStyle.paddingLeft)), right: mm(r.right - box.left - parseFloat(contentStyle.paddingRight)),
      top: mm(r.top - box.top + parseFloat(contentStyle.paddingTop)), bottom: mm(r.bottom - box.top - parseFloat(contentStyle.paddingBottom)) }; })();
    const footer = sheet.querySelector('.klassisch-pdf-footer,.klassisch-footer,.managed-pdf-footer,.einfach-footer');
    const header = sheet.querySelector('header');
    const textRects = (scope) => {
      const rects = [];
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || node.parentElement.closest('style,script,svg,footer')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 0.5) rects.push(r);
      }
      return rects;
    };
    const rects = content ? textRects(content) : [];
    const sections = [...sheet.querySelectorAll('[data-managed-section]')].map((node) => ({ id: node.getAttribute('data-managed-section'), ...rel(node),
      heading: (node.querySelector('.cv-heading,h2,h3')?.textContent ?? '').trim() }));
    const entries = [...sheet.querySelectorAll('[data-managed-section="experience"] article,[data-managed-section="education"] article')].map((article) => ({
      section: article.closest('[data-managed-section]').getAttribute('data-managed-section'),
      title: (article.querySelector('h3')?.textContent ?? '').trim(),
      ...rel(article),
      bullets: [...article.querySelectorAll('li')].map((li) => ({ text: li.textContent.trim(), ...rel(li) })),
      details: [...article.querySelectorAll('p,li')].filter((node) => !node.closest('[class*="meta"]')).map((node) => node.textContent.trim()),
    }));
    const flow = [...sheet.querySelectorAll('[data-managed-section],[data-resume-closing]')].map((node) => node.getBoundingClientRect());
    // The first unit of the page: what the page before would have needed to take one more step (a continued entry's next
    // bullet, else a new entry's head with its first bullet, else the whole first block).
    const firstSection = sheet.querySelector('[data-managed-section]');
    const career = /^(experience|education)$/.test(firstSection?.getAttribute('data-managed-section') ?? '');
    const firstArticle = career ? firstSection.querySelector('article') : null;
    // A section that starts on this page (no "Fortsetzung") also needs the gap above it and its heading.
    const heading = firstSection?.querySelector('.cv-heading,h2,h3');
    const opening = heading && !/Fortsetzung/.test(heading.textContent) ? 6 + mm(heading.getBoundingClientRect().height) + 2.5 : 0;
    const firstLi = firstArticle?.querySelector('li');
    const height = (node) => (node ? mm(node.getBoundingClientRect().height) : 0);
    const continued = /Fortsetzung/.test(firstArticle?.querySelector('h3')?.textContent ?? '');
    // Widow/orphan rule of the planner (MIN_SPLIT_LINES): a new entry needs its head and the first bullets up to 2 lines
    // (education 1) on the page before, and must leave 2 lines behind; otherwise it moves whole.
    const lineMm = 11 * 25.4 / 72 * 1.2;
    const firstUnit = !firstSection ? null : firstArticle
      ? (continued ? { kind: 'bullet', mm: Math.round((height(firstLi) + 0.6) * 100) / 100 }
        : (() => {
          const items = [...firstArticle.querySelectorAll('li')];
          const lines = items.map((li) => Math.round(height(li) / lineMm));
          const total = lines.reduce((sum, value) => sum + value, 0);
          const before = firstSection.getAttribute('data-managed-section') === 'education' ? 1 : 2;
          let taken = 0; let count = 0;
          while (count < items.length && taken < before) { taken += lines[count]; count += 1; }
          const partial = count && total - taken >= 2 ? mm(items[count - 1].getBoundingClientRect().bottom - firstArticle.getBoundingClientRect().top) : height(firstArticle);
          return { kind: 'entry', mm: Math.round((opening + (opening ? 0 : 4) + (items.length ? partial : height(firstArticle))) * 100) / 100 };
        })())
      : { kind: firstSection.getAttribute('data-managed-section'), mm: Math.round((6 + height(firstSection)) * 100) / 100 };
    const style = (selector) => { const node = sheet.querySelector(selector); if (!node) return null; const s = getComputedStyle(node); return { font: s.fontFamily, size: Math.round(parseFloat(s.fontSize) * 72 / 96 * 100) / 100, lineHeight: s.lineHeight === 'normal' ? 'normal' : Math.round(parseFloat(s.lineHeight) / parseFloat(s.fontSize) * 1000) / 1000, weight: s.fontWeight }; };
    return {
      page: index + 1,
      content: contentBox,
      textLeft: rects.length ? mm(Math.min(...rects.map((r) => r.left)) - box.left) : null,
      textRight: rects.length ? mm(Math.max(...rects.map((r) => r.right)) - box.left) : null,
      textBottom: rects.length ? mm(Math.max(...rects.map((r) => r.bottom)) - box.top) : null,
      flowBottom: flow.length ? mm(Math.max(...flow.map((r) => r.bottom)) - box.top) : null,
      sectionBottom: (() => { const nodes = [...sheet.querySelectorAll('[data-managed-section]')]; return nodes.length ? mm(Math.max(...nodes.map((n) => n.getBoundingClientRect().bottom)) - box.top) : null; })(),
      firstUnit,
      header: rel(header), name: rel(header?.querySelector('h1')), photo: rel(sheet.querySelector('.klassisch-pdf-photo,.klassisch-header figure,.einfach-pdf-photo,.einfach-header figure')),
      firstSection: sections[0] ?? null, sections, entries,
      footer: rel(footer), footerText: (footer?.textContent ?? '').trim(),
      styles: { body: style('[data-managed-section="experience"] li'), summary: style('[data-managed-section="summary"] p'), section: style('[data-managed-section] > .cv-heading, [data-managed-section] > h2, [data-managed-section] > h3'),
        entry: style('[data-managed-section="experience"] article h3'), name: style('header h1'), title: style('header h2') },
    };
  });
};

app.whenReady().then(async () => {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).filter((entry) => !only.length || only.some((name) => entry.file.includes(name)));
    const win = new BrowserWindow({ show: false, width: 900, height: 1400, webPreferences: { sandbox: true } });
    const report = [];
    for (const entry of manifest) {
      const result = { ...entry };
      for (const [surface, name] of [['pdf', `${entry.file}.html`], ['preview', `${entry.file}-preview.html`]]) {
        await win.loadFile(path.join(out, name));
        await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
        result[surface] = await win.webContents.executeJavaScript(`(${probe.toString()})(${JSON.stringify(surface)})`);
        const pdf = await win.webContents.printToPDF({ pageSize: 'A4', preferCSSPageSize: true, printBackground: true, margins: { top: 0, right: 0, bottom: 0, left: 0 } });
        fs.writeFileSync(path.join(out, surface === 'pdf' ? `${entry.file}.pdf` : `${entry.file}-preview.pdf`), pdf);
      }
      report.push(result);
    }
    fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(report, null, 1));
    const v = (value) => (value === null || value === undefined ? '-' : value);
    // Free space below the flow of every page but the last, beside the first unit of the next page: `spare` > 0 means the
    // unit would have fitted (more than a line of reserve the planner kept), < 0 that it could not.
    const limit = 297 - 20;
    const fill = [];
    for (const result of report) for (const [index, page] of result.pdf.entries()) {
      const next = result.pdf[index + 1];
      if (!next) continue;
      const free = Math.round((limit - page.sectionBottom) * 10) / 10;
      fill.push({ file: result.file, page: page.page, free, next: next.firstUnit?.kind, unit: next.firstUnit?.mm, spare: Math.round((free - (next.firstUnit?.mm ?? 0)) * 10) / 10 });
    }
    fs.writeFileSync(path.join(out, 'fill.json'), JSON.stringify(fill, null, 1));
    for (const row of fill) console.log(`  fill ${row.file} p${row.page}: free ${row.free} mm, next ${row.next} ${row.unit} mm, spare ${row.spare}`);
    for (const result of report) {
      console.log(`\n== ${result.file} (${result.pages} planned)`);
      for (const surface of ['pdf', 'preview']) for (const page of result[surface]) {
        console.log(`  ${surface.padEnd(7)} p${page.page} box ${v(page.content?.left)}/${v(page.content?.right)} top ${v(page.content?.top)} bottom ${v(page.content?.bottom)} | text ${v(page.textLeft)}-${v(page.textRight)} bottom ${v(page.textBottom)} flow ${v(page.flowBottom)} | header ${v(page.header?.top)}-${v(page.header?.bottom)} first ${v(page.firstSection?.top)} | footer ${v(page.footer?.left)}-${v(page.footer?.right)} ${v(page.footer?.top)}-${v(page.footer?.bottom)}`);
      }
    }
  } catch (error) { console.error(error); }
  app.exit(0);
});
