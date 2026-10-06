// Kompakt page geometry in real Chromium, PDF and preview side by side (tmp/template-qa from
// `ONLY=kompakt [PAGE_MARGIN=mm] node scripts/template-qa.mjs`): header/name/photo/column/footer edges in mm and whether
// the content of one column reaches into the other.  npx electron scripts/check-kompakt-geometry.cjs [filter…]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/template-qa');
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-') && !arg.includes('check-kompakt'));

const probe = (surface) => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 10) / 10;
  const sheets = [...document.querySelectorAll(surface === 'pdf' ? '.cv-sheet' : '.document-paper')];
  const q = (root, pdf, preview) => root.querySelector(surface === 'pdf' ? pdf : preview);
  return sheets.map((sheet, index) => {
    const box = sheet.getBoundingClientRect();
    const rel = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return { left: mm(r.left - box.left), right: mm(r.right - box.left), top: mm(r.top - box.top), bottom: mm(r.bottom - box.top) }; };
    const header = q(sheet, '.kompakt-pdf-header', '.kompakt-header');
    const style = header ? getComputedStyle(header) : null;
    const main = q(sheet, '.kompakt-pdf-columns>main', '.kompakt-content>.kompakt-left');
    const aside = q(sheet, '.kompakt-pdf-columns>aside', '.kompakt-content>.kompakt-right');
    const leaves = (root) => root ? [...root.querySelectorAll('*')].filter((node) => !node.children.length && (node.textContent || '').trim()).map((node) => node.getBoundingClientRect()) : [];
    const mainLeaves = leaves(main);
    const asideLeaves = leaves(aside);
    const mainBox = main?.getBoundingClientRect();
    const asideBox = aside?.getBoundingClientRect();
    return {
      page: index + 1,
      headerContent: header ? { left: mm(header.getBoundingClientRect().left - box.left + parseFloat(style.paddingLeft)), right: mm(box.right - header.getBoundingClientRect().right + parseFloat(style.paddingRight)), top: mm(parseFloat(style.paddingTop)) } : null,
      name: rel(header?.querySelector('h1')),
      photo: rel(q(sheet, '.kompakt-pdf-photo', '.kompakt-header__photo')),
      main: rel(main), aside: rel(aside),
      gap: mainBox && asideBox ? mm(asideBox.left - mainBox.right) : null,
      // content that crosses into the other column (mm, > 0 = overlap)
      mainIntoAside: mainBox && asideBox ? Math.max(0, ...mainLeaves.map((r) => mm(r.right - asideBox.left))) : 0,
      asideIntoMain: mainBox && asideBox ? Math.max(0, ...asideLeaves.map((r) => mm(mainBox.right - r.left))) : 0,
      mainOverflow: mainBox ? Math.max(0, ...mainLeaves.map((r) => mm(r.right - mainBox.right))) : 0,
      asideOverflow: asideBox ? Math.max(0, ...asideLeaves.map((r) => mm(r.right - asideBox.right))) : 0,
      footer: rel(q(sheet, '.managed-pdf-footer', '.kompakt-footer')),
    };
  });
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { sandbox: true } });
    const files = fs.readdirSync(out).filter((file) => /-kompakt-vis(-m\d+)?\.html$/.test(file) && (!only.length || only.some((name) => file.includes(name))));
    const report = [];
    for (const file of files) {
      const result = { file };
      for (const [surface, name] of [['pdf', file], ['preview', file.replace('.html', '-preview.html')]]) {
        if (!fs.existsSync(path.join(out, name))) continue;
        await win.loadFile(path.join(out, name));
        await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
        result[surface] = await win.webContents.executeJavaScript(`(${probe.toString()})(${JSON.stringify(surface)})`);
      }
      report.push(result);
    }
    fs.writeFileSync(path.join(out, 'kompakt-geometry.json'), JSON.stringify(report, null, 1));
    for (const result of report) {
      console.log(`\n== ${result.file}`);
      for (const surface of ['pdf', 'preview']) for (const page of result[surface] ?? []) {
        console.log(`  ${surface.padEnd(7)} p${page.page} header L${page.headerContent?.left} R${page.headerContent?.right} T${page.headerContent?.top} | name top ${page.name?.top} left ${page.name?.left} | photo top ${page.photo?.top} right ${page.photo ? Math.round((210 - page.photo.right) * 10) / 10 : '-'} | main ${page.main?.left}-${page.main?.right} aside ${page.aside?.left}-${page.aside?.right} gap ${page.gap} | cross ${page.mainIntoAside}/${page.asideIntoMain} overflow ${page.mainOverflow}/${page.asideOverflow} | footer ${page.footer?.left}-${page.footer ? Math.round((210 - page.footer.right) * 10) / 10 : '-'}`);
      }
    }
  } catch (error) { console.error(error); }
  app.exit(0);
});
