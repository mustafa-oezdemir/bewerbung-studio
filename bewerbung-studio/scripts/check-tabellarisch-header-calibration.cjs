// Measures tmp/tabellarisch-header-calib (scripts/tabellarisch-header-calibration.mjs) in real Chromium: the bottom of the
// header, the top of the first section (what the page planner models), the cell (row, column) of every contact and the
// lines of the name and the title. Output: tmp/tabellarisch-header-calib/measure.json
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/tabellarisch-header-calib');
const only = process.argv.slice(2).filter((arg) => !arg.includes('check-tabellarisch'));

const probe = () => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 100) / 100;
  const sheet = document.querySelector('.cv-sheet');
  const top = sheet.getBoundingClientRect().top;
  const header = sheet.querySelector('header');
  const sections = [...sheet.querySelectorAll('[data-managed-section]')].filter((node) => !node.closest('header'));
  const rel = (node) => { const r = node.getBoundingClientRect(); return { top: mm(r.top - top), bottom: mm(r.bottom - top), left: mm(r.left), height: mm(r.height), width: mm(r.width) }; };
  const contacts = [...header.querySelectorAll('[data-contact-kind]')].map((node) => {
    const box = rel(node);
    const text = node.lastElementChild || node;
    const range = document.createRange();
    range.selectNodeContents(text);
    const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    return { kind: node.getAttribute('data-contact-kind'), top: box.top, left: box.left, height: box.height, width: box.width, lines, text: (text.textContent || '').trim() };
  });
  const rows = [];
  for (const contact of contacts) if (!rows.some((value) => Math.abs(value - contact.top) < 0.5)) rows.push(contact.top);
  const name = header.querySelector('h1');
  const title = header.querySelector('h2');
  const block = header.querySelector('address');
  return {
    headerBottom: rel(header).bottom,
    firstSection: sections.length ? Math.min(...sections.map((node) => rel(node).top)) : null,
    contacts,
    rows: rows.length,
    contactsBox: block ? rel(block) : null,
    name: name ? rel(name) : null,
    title: title ? rel(title) : null,
    pages: document.querySelectorAll('.cv-sheet').length,
  };
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true } });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((entry) => !only.length || only.some((name) => entry.file.includes(name)));
    const rows = [];
    for (const entry of manifest) {
      await win.loadFile(path.join(out, `${entry.file}.html`));
      rows.push({ file: entry.file, name: entry.name, photo: entry.photo, ...(await win.webContents.executeJavaScript(`(${probe.toString()})()`)) });
    }
    fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(rows));
    console.log('measured', rows.length);
  } catch (error) { console.error(error); }
  app.exit(0);
});
