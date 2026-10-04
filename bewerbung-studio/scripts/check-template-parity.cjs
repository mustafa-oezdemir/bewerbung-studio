// Preview vs PDF geometry of tmp/template-qa: the same sections at the same place, size and font, on the same page.
// Preview vs PDF geometry: the same sections at the same place, in the same size, on the same page.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('tmp/template-qa');
const only = process.argv.slice(2).filter((a) => !a.includes('parity'));
const measure = (rootSelector) => {
  const mm = (px) => Math.round(px * 25.4 / 96 * 10) / 10;
  return [...document.querySelectorAll(rootSelector)].map((page, index) => {
    const box = page.getBoundingClientRect();
    const sections = {};
    for (const node of page.querySelectorAll('[data-managed-section]')) {
      const id = node.getAttribute('data-managed-section');
      if (sections[id]) continue;
      const r = node.getBoundingClientRect();
      const pick = (sel) => [...node.querySelectorAll(sel)].find((n) => n.textContent.trim() && !n.querySelector('li,p'));
      const text = pick('li') || pick('.managed-item-text') || pick('p');
      sections[id] = { top: mm(r.top - box.top), left: mm(r.left - box.left), width: mm(r.width), height: mm(r.height), font: text ? Math.round(parseFloat(getComputedStyle(text).fontSize) * 7.5) / 10 : null };
    }
    const header = page.querySelector('header');
    return { page: index + 1, header: header ? mm(header.getBoundingClientRect().height) : null, sections };
  });
};
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true } });
  const report = [];
  for (const f of JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((f) => !f.ats && (!only.length || only.some((o) => f.file.includes(o))))) {
    await w.loadFile(path.join(out, f.file + '.html'));
    const pdf = await w.webContents.executeJavaScript(`(${measure.toString()})('.cv-sheet')`);
    await w.loadFile(path.join(out, f.file + '-preview.html'));
    const preview = await w.webContents.executeJavaScript(`(${measure.toString()})('.document-paper')`);
    const diffs = [];
    if (pdf.length !== preview.length) diffs.push(`pages pdf ${pdf.length} / preview ${preview.length}`);
    pdf.forEach((page, i) => {
      const other = preview[i];
      if (!other) return;
      if (page.header !== null && other.header !== null && Math.abs(page.header - other.header) > 1.5) diffs.push(`p${i + 1} header ${page.header} / ${other.header}`);
      for (const [id, a] of Object.entries(page.sections)) {
        const b = other.sections[id];
        if (!b) { diffs.push(`p${i + 1} ${id} missing in preview`); continue; }
        for (const key of ['top', 'left', 'width', 'height']) if (Math.abs(a[key] - b[key]) > 2) diffs.push(`p${i + 1} ${id}.${key} ${a[key]} / ${b[key]}`);
        if (a.font && b.font && Math.abs(a.font - b.font) > 0.3) diffs.push(`p${i + 1} ${id}.font ${a.font} / ${b.font}`);
      }
      for (const id of Object.keys(other.sections)) if (!page.sections[id]) diffs.push(`p${i + 1} ${id} missing in pdf`);
    });
    report.push({ file: f.file, diffs });
  }
  fs.writeFileSync(path.join(out, 'parity.json'), JSON.stringify(report, null, 1));
  console.log(report.map((r) => `${r.file}: ${r.diffs.length ? r.diffs.slice(0, 8).join(' | ') : 'ok'}`).join('\n'));
  app.exit(0);
});
