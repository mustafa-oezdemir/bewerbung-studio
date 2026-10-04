// Real Chromium measurement of tmp/language-qa (scripts/language-height-qa.mjs): the languages section of every page – its
// height, the text of every language and whether a language overflows its column.
//   npx electron scripts/check-language-height-qa.cjs [--json] [template…]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/language-qa');
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-') && !arg.includes('check-language'));

const probe = () => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 100) / 100;
  const sheets = [...document.querySelectorAll('.cv-sheet')];
  const pages = [];
  sheets.forEach((sheet, index) => {
    const section = sheet.querySelector('[data-managed-section="languages"]');
    if (!section) return;
    const box = section.getBoundingClientRect();
    const sheetBox = sheet.getBoundingClientRect();
    const dots = section.querySelectorAll('[class*="dots"],[role="img"]').length;
    // the widest horizontal extent of any text leaf against the section / the sheet
    const leaves = [...section.querySelectorAll('*')].filter((node) => node.children.length === 0 && (node.textContent || '').trim());
    const overflow = leaves.filter((node) => node.getBoundingClientRect().right > box.right + 0.5 || node.scrollWidth > node.clientWidth + 1).length;
    pages.push({
      page: index + 1,
      height: mm(box.height),
      top: mm(box.top - sheetBox.top),
      width: mm(box.width),
      dots,
      overflow,
      text: [...section.querySelectorAll('article,li,p.language,.gepflegt-pdf-language,.klassisch-pdf-language')].map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()),
      // one entry per language row: the first line's characters and lines, widths and heights in mm
      rows: (section.querySelector('[class$="-pdf-language"]') ? [...section.querySelectorAll('[class$="-pdf-language"]')] : [...section.querySelectorAll('li')]).map((row) => {
        const first = row.firstElementChild;
        const name = row.matches('p,li') ? (first && first.tagName === 'SPAN' ? first : row) : row.querySelector('strong,h4,h3');
        const range = document.createRange();
        range.selectNodeContents(name);
        const rects = [...range.getClientRects()];
        const dotsNode = row.querySelector('[class*="dots"]');
        const desc = row.querySelector('.resume-language-description');
        return {
          text: (name.textContent || '').trim(),
          chars: (name.textContent || '').trim().length,
          lines: Math.max(1, Math.round(name.getBoundingClientRect().height / (parseFloat(getComputedStyle(name).lineHeight) || parseFloat(getComputedStyle(name).fontSize) * 1.2))),
          lineH: mm(parseFloat(getComputedStyle(name).lineHeight) || parseFloat(getComputedStyle(name).fontSize) * 1.2),
          textW: mm(Math.max(0, ...rects.map((rect) => rect.width))),
          // the width the first line would have without any wrap
          naturalW: (() => {
            const saved = name.style.cssText;
            name.style.cssText += ';white-space:nowrap;display:inline-block;width:max-content;max-width:none';
            const width = name.getBoundingClientRect().width;
            name.style.cssText = saved;
            return mm(width);
          })(),
          nameBoxW: mm(name.getBoundingClientRect().width),
          dotsW: dotsNode ? mm(dotsNode.getBoundingClientRect().width) : 0,
          rowH: mm(row.getBoundingClientRect().height),
          rowW: mm(row.getBoundingClientRect().width),
          rowFull: mm(row.getBoundingClientRect().width),
          nameH: mm(name.getBoundingClientRect().height),
          descH: desc ? mm(desc.getBoundingClientRect().height) : 0,
        };
      }),
    });
  });
  return pages;
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, useContentSize: true, width: 900, height: 1200, webPreferences: { sandbox: true } });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((entry) => !only.length || only.includes(entry.template));
    const report = [];
    for (const entry of manifest) {
      await win.loadFile(path.join(out, `${entry.file}.html`));
      await new Promise((resolve) => setTimeout(resolve, 60));
      const pages = await win.webContents.executeJavaScript(`(${probe.toString()})()`);
      report.push({ ...entry, pages });
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
    if (process.argv.includes('--shots')) {
      for (const entry of manifest.filter((item) => !item.ats && item.count === 4 && (!process.env.COMBOS || process.env.COMBOS.split(',').includes(item.combo)))) {
        await win.loadFile(path.join(out, `${entry.file}.html`));
        await new Promise((resolve) => setTimeout(resolve, 80));
        const rect = await win.webContents.executeJavaScript(`(() => { const s = document.querySelector('[data-managed-section="languages"]'); if (!s) return null; const r = s.getBoundingClientRect(); return { x: Math.max(0, Math.floor(r.left - 6)), y: Math.max(0, Math.floor(r.top - 6)), width: Math.ceil(r.width + 12), height: Math.ceil(r.height + 12) }; })()`);
        if (!rect) continue;
        const image = await win.webContents.capturePage(rect);
        fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
        fs.writeFileSync(path.join(out, 'shots', `${entry.file}.png`), image.toPNG());
      }
    }
    if (process.argv.includes('--json')) console.log(JSON.stringify(report));
    else for (const row of report) console.log(`${row.file.padEnd(46)} ${row.pages.map((page) => `p${page.page} h${page.height} w${page.width} dots${page.dots} ovf${page.overflow}`).join('  ')}`);
  } catch (error) { console.error(error); }
  app.exit(0);
});
