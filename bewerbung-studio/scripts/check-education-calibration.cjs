// Measures the real height of every career entry (experience and education) on every page of tmp/education-calibration
// (scripts/education-calibration.mjs): tmp/education-calibration/measure.json
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('tmp/education-calibration');

const probe = () => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 100) / 100;
  return [...document.querySelectorAll('.cv-sheet')].map((sheet, index) => {
    const entries = (kind) => [...sheet.querySelectorAll(`[data-managed-section="${kind}"] .zweispaltig-career-entry,[data-managed-section="${kind}"] .zweispaltig-pdf-entry`)].map((entry) => {
      const r = entry.getBoundingClientRect();
      const cs = getComputedStyle(entry);
      // the entry without its own padding and border below (what the planner counts; the gap belongs to the list)
      const part = (selector) => { const node = entry.querySelector(selector); return node ? mm(node.getBoundingClientRect().height) : 0; };
      const list = entry.querySelector('ul');
      const items = list ? [...list.children].map((li) => ({ h: mm(li.getBoundingClientRect().height), chars: (li.textContent || '').length })) : [];
      return {
        height: mm(r.height - parseFloat(cs.paddingBottom) - parseFloat(cs.borderBottomWidth)), top: mm(r.top), text: (entry.textContent || '').length,
        title: part('h3'), titleChars: (entry.querySelector('h3')?.textContent || '').length, org: part('p:nth-of-type(1)'), orgChars: (entry.querySelector('p')?.textContent || '').length,
        meta: part('p:nth-of-type(2)'), list: list ? mm(list.getBoundingClientRect().height) : 0, items,
      };
    });
    const heading = sheet.querySelector('[data-managed-section="education"] h2');
    return { page: index + 1, experience: entries('experience'), education: entries('education'), headingHeight: heading ? mm(heading.getBoundingClientRect().height) : null };
  });
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true } });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')));
    const rows = [];
    for (const entry of manifest) {
      await win.loadFile(path.join(out, `${entry.file}.html`));
      rows.push({ file: entry.file, pages: await win.webContents.executeJavaScript(`(${probe.toString()})()`) });
    }
    fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(rows));
    console.log('measured', rows.length);
  } catch (error) { console.error(error); }
  app.exit(0);
});
