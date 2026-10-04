// Overflow, clipping and overlap of every page of tmp/template-qa (from scripts/template-qa.mjs), on the real PDF:
//   npx electron scripts/check-template-qa.cjs [--no-shots] [filter…]   (--no-shots: no printToPDF files)
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('tmp/template-qa');
const only = process.argv.slice(2).filter((a) => !a.startsWith('-') && !a.includes('template-qa'));
const noShots = process.argv.includes('--no-shots');

const probe = () => {
  const sheets = [...document.querySelectorAll('.cv-sheet')];
  return sheets.map((sheet, i) => {
    const box = sheet.getBoundingClientRect();
    const problems = [];
    const label = (n) => `${n.tagName}.${String(n.className).slice(0, 40)}:${(n.textContent || '').trim().slice(0, 32)}`;
    const nodes = [...sheet.querySelectorAll('*')].filter((n) => !['STYLE', 'SCRIPT'].includes(n.tagName) && !(n instanceof SVGElement) && n.getBoundingClientRect().width > 0);
    for (const n of nodes) {
      const own = [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if (r.right > box.right + 1 || r.left < box.left - 1) problems.push(`h-outside ${label(n)}`);
      if (r.bottom > box.bottom + 1) problems.push(`v-outside ${label(n)}`);
      if (cs.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 2) problems.push(`ellipsis ${label(n)}`);
      else if (/hidden|clip/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2) problems.push(`clipped-x ${label(n)} ${n.scrollWidth}>${n.clientWidth}`);
      if (/hidden|clip/.test(cs.overflowY) && n.clientHeight > 0 && n.scrollHeight > n.clientHeight + 2) problems.push(`clipped-y ${label(n)} ${n.scrollHeight}>${n.clientHeight}`);
    }
    // text boxes of siblings that overlap each other
    const texts = nodes.filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
    const rects = texts.map((n) => ({ n, r: n.getBoundingClientRect() }));
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const x = rects[a], y = rects[b];
      if (x.n.contains(y.n) || y.n.contains(x.n)) continue;
      // Links that wrap inside one paragraph have overlapping boxes but no overlapping text.
      if (getComputedStyle(x.n).display === 'inline' && getComputedStyle(y.n).display === 'inline') continue;
      const ox = Math.min(x.r.right, y.r.right) - Math.max(x.r.left, y.r.left);
      const oy = Math.min(x.r.bottom, y.r.bottom) - Math.max(x.r.top, y.r.top);
      if (ox > 3 && oy > 3) problems.push(`overlap ${label(x.n)} / ${label(y.n)}`);
    }
    return { page: i + 1, problems: [...new Set(problems)].slice(0, 10) };
  });
};

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, useContentSize: true, width: 900, height: 1200, webPreferences: { sandbox: true, offscreen: false } });
  const report = [];
  const files = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((f) => !only.length || only.some((o) => f.file.includes(o)));
  for (const f of files) {
    await w.loadFile(path.join(out, f.file + '.html'));
    await new Promise((r) => setTimeout(r, 120));
    const info = await w.webContents.executeJavaScript(`(${probe.toString()})()`);
    report.push({ file: f.file, pages: info });
    if (noShots) continue;
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', preferCSSPageSize: true, printBackground: true, margins: { marginType: 'none' } });
    fs.writeFileSync(path.join(out, `${f.file}.pdf`), pdf);
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.flatMap((r) => r.pages.filter((p) => p.problems.length).map((p) => `${r.file} p${p.page}: ${p.problems.join(' | ')}`));
  console.log(`${report.length} docs, ${report.reduce((n, r) => n + r.pages.length, 0)} pages`);
  console.log(bad.join('\n'));
  app.exit(0);
});
