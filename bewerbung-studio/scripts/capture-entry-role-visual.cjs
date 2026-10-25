const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// The visual half of the entry-role QA (scripts/entry-role-qa.mjs): the real Electron PDF of a fixture (printToPDF, as the
// export prints it) and screenshots of its preview pages, for scripts/compare-entry-role-visual.py to put side by side.
//   node node_modules/electron/cli.js scripts/capture-entry-role-visual.cjs <fixture name>…
//   e.g. zweispaltig-roles-vis tuerkis-profil-native-vis
const dir = path.resolve('tmp/entry-role-qa');
const out = path.join(dir, 'visual');
const names = process.argv.slice(2).filter((arg) => !arg.startsWith('-') && !arg.endsWith('.cjs'));

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  // 210 mm at 96 px per inch: the preview paper is drawn at its real size.
  const window = new BrowserWindow({ show: false, width: 1100, height: 1600, useContentSize: true, webPreferences: { sandbox: true } });
  for (const name of names) {
    for (const file of fs.readdirSync(out)) {
      if (file.startsWith(`${name}-preview-`) || file.startsWith(`${name}-side-`)) fs.unlinkSync(path.join(out, file));
    }
    await window.loadFile(path.join(dir, `${name}-pdf.html`));
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    const pdf = await window.webContents.printToPDF({ pageSize: 'A4', preferCSSPageSize: true, printBackground: true, margins: { marginType: 'none' } });
    fs.writeFileSync(path.join(out, `${name}.pdf`), pdf);
    await window.loadFile(path.join(dir, `${name}-preview.html`));
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    await new Promise((done) => setTimeout(done, 150));
    const boxes = await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.document-paper')).map((page) => {
      const box = page.getBoundingClientRect(); return { x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height };
    })`);
    for (const [index, box] of boxes.entries()) {
      // The window cannot be taller than the screen: the page is captured in slices the comparison puts together again.
      const slice = 500;
      for (let offset = 0, part = 1; offset < box.height - 0.5; offset += slice, part++) {
        await window.webContents.executeJavaScript(`scrollTo(0, ${box.y + offset})`);
        await new Promise((done) => setTimeout(done, 60));
        const top = await window.webContents.executeJavaScript(`document.querySelectorAll('.document-paper')[${index}].getBoundingClientRect().top + ${offset}`);
        const rect = { x: Math.round(box.x), y: Math.round(top), width: Math.round(box.width), height: Math.round(Math.min(slice, box.height - offset)) };
        const image = await window.webContents.capturePage(rect);
        fs.writeFileSync(path.join(out, `${name}-preview-${index + 1}-${String(part).padStart(2, '0')}.png`), image.toPNG());
      }
    }
    console.log(name, 'pages', boxes.length);
  }
  window.destroy();
  app.exit(0);
}).catch((error) => { console.error(error); app.exit(1); });
