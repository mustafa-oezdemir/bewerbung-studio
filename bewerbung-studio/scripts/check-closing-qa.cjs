const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('tmp/closing-qa');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1250, webPreferences: { sandbox: true } });
  const failures = [];
  const beyondA4 = [];
  const overlaps = [];
  let checked = 0;
  for (const file of fs.readdirSync(output).filter(name => name.endsWith('.html'))) {
    await window.loadFile(path.join(output, file));
    if (['modern-preview-footer-distributed.html', 'pehlione_white-preview-main-right.html'].includes(file)) {
      if (file.startsWith('modern')) await window.webContents.executeJavaScript('window.scrollTo(0, 700)');
      fs.writeFileSync(path.join(output, file.replace('.html', '.png')), (await window.webContents.capturePage()).toPNG());
    }
    const result = await window.webContents.executeJavaScript(`(() => {
      const block = document.querySelector('[data-resume-closing]');
      const page = document.querySelector('.cv-sheet') || document.querySelector('.managed-resume-preview > *');
      const box = block?.getBoundingClientRect(), pageBox = page?.getBoundingClientRect();
      return { place: block?.querySelector('[data-resume-closing-place]')?.textContent,
        date: block?.querySelector('[data-resume-closing-date]')?.textContent,
        signature: Boolean(block?.querySelector('[data-resume-closing-signature] img')),
        justify: block ? getComputedStyle(block).justifyContent : null,
        x: box?.x, right: box?.right, pageX: pageBox?.x, pageRight: pageBox?.right,
        bottomMm: box && pageBox ? (box.bottom - pageBox.top) / (96 / 25.4) : null,
        overlaps: box ? Array.from(document.querySelectorAll('[data-managed-section],footer')).filter(node => !node.contains(block)).some(node => {
          const other = node.getBoundingClientRect();
          return other.width > 0 && other.height > 0 && other.left < box.right && other.right > box.left && other.top < box.bottom && other.bottom > box.top;
        }) : false,
        parent: block?.parentElement?.className || '',
        placement: block?.getAttribute('data-resume-closing-placement'), alignment: block?.getAttribute('data-resume-closing-align') };
    })()`);
    checked++;
    const placement = file.includes('-main-') ? 'main' : 'footer';
    const alignment = file.match(/-(left|right|center|distributed)\.html$/)?.[1];
    const justify = { left: 'flex-start', right: 'flex-end', center: 'center', distributed: 'space-between' }[alignment];
    if (result.place !== 'Marburg' || result.date !== '28.09.2026' || !result.signature
      || result.justify !== justify || result.placement !== placement || result.alignment !== alignment
      || result.x < result.pageX - 2 || result.right > result.pageRight + 2) failures.push({ file, result });
    if (result.bottomMm > 298) beyondA4.push({ file, bottomMm: Math.round(result.bottomMm * 10) / 10 });
    if (result.overlaps && placement === 'footer') overlaps.push(file);
  }
  console.log(JSON.stringify({ checked, failures, beyondA4, overlaps }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
