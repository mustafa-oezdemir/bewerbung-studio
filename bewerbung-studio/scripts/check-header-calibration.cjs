const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('tmp/calib');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { sandbox: true } });
  const rows = [];
  const only = process.argv.slice(2).filter((a) => !a.includes('calib'));
  for (const f of JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((f) => !only.length || only.includes(f.id))) {
    await w.loadFile(path.join(out, f.file + '.html'));
    const r = await w.webContents.executeJavaScript(`(() => {
      const mm = (px) => Math.round(px * 25.4 / 96 * 100) / 100;
      const sheet = document.querySelector('.cv-sheet');
      const top = sheet.getBoundingClientRect().top;
      const sections = [...sheet.querySelectorAll('[data-managed-section]')].filter((n) => !n.closest('header'));
      const main = sections.filter((n) => !n.closest('aside')).map((n) => n.getBoundingClientRect().top);
      const side = sections.filter((n) => n.closest('aside')).map((n) => n.getBoundingClientRect().top);
      const header = sheet.querySelector('header');
      return { main: main.length ? mm(Math.min(...main) - top) : null, side: side.length ? mm(Math.min(...side) - top) : null, header: header ? mm(header.getBoundingClientRect().bottom - top) : null, pages: document.querySelectorAll('.cv-sheet').length };
    })()`);
    rows.push({ ...f, ...r });
  }
  fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(rows));
  console.log('measured', rows.length);
  app.exit(0);
});
