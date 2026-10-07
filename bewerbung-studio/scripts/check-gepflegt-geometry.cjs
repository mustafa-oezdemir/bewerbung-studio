// Gepflegt page geometry in real Chromium, PDF and preview side by side (tmp/template-qa from
// `ONLY=gepflegt [PAGE_MARGIN=mm] node scripts/template-qa.mjs`): the coloured sidebar lane, the text edges of both
// columns, name/photo/first section/footer positions in mm, and whether text of one column reaches into the other.
//   npx electron scripts/check-gepflegt-geometry.cjs [filter…]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/template-qa');
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-') && !arg.includes('check-gepflegt'));

const probe = (surface) => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 10) / 10;
  const sheets = [...document.querySelectorAll(surface === 'pdf' ? '.cv-sheet' : '.document-paper')];
  const q = (root, pdf, preview) => root.querySelector(surface === 'pdf' ? pdf : preview);
  return sheets.map((sheet, index) => {
    const box = sheet.getBoundingClientRect();
    const rel = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return { left: mm(r.left - box.left), right: mm(r.right - box.left), top: mm(r.top - box.top), bottom: mm(r.bottom - box.top) }; };
    const inner = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const s = getComputedStyle(node);
      return { left: mm(r.left - box.left + parseFloat(s.paddingLeft)), right: mm(r.right - box.left - parseFloat(s.paddingRight)), top: mm(r.top - box.top + parseFloat(s.paddingTop)), bottom: mm(r.bottom - box.top - parseFloat(s.paddingBottom)) };
    };
    const aside = q(sheet, '.gepflegt-pdf-sidebar', '.gepflegt-sidebar');
    const content = q(sheet, '.gepflegt-pdf-content', '.gepflegt-content');
    const leaves = (root) => root ? [...root.querySelectorAll('*')].filter((node) => !node.children.length && (node.textContent || '').trim()).map((node) => node.getBoundingClientRect()) : [];
    const asideLeaves = leaves(aside);
    const mainLeaves = leaves(content);
    const band = aside?.getBoundingClientRect();
    const sideText = inner(aside);
    const mainText = inner(content);
    const firstOf = (root) => root?.querySelector('[data-managed-section]');
    return {
      page: index + 1,
      band: rel(aside), sideText, mainText,
      name: rel(q(sheet, '.gepflegt-pdf-header h1', '.gepflegt-header__name')),
      photo: rel(q(sheet, '.gepflegt-pdf-photo', '.gepflegt-sidebar__photo')),
      firstMain: rel(firstOf(content)), firstSide: rel(firstOf(aside)),
      footer: rel(q(sheet, '.gepflegt-pdf-footer', '.gepflegt-footer')),
      // text that leaves its column (mm, > 0 = problem): sidebar text beyond its right text edge or the lane, main text
      // left of its text edge (into the lane) or right of its text edge.
      sideOverflow: band && sideText ? Math.max(0, ...asideLeaves.map((r) => mm(r.right - box.left) - sideText.right)) : 0,
      mainIntoSide: band ? Math.max(0, ...mainLeaves.map((r) => mm(band.right - r.left))) : 0,
      mainOverflow: mainText ? Math.max(0, ...mainLeaves.map((r) => mm(r.right - box.left) - mainText.right)) : 0,
    };
  });
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { sandbox: true } });
    const files = fs.readdirSync(out).filter((file) => /-gepflegt-vis(-m\d+)?\.html$/.test(file) && (!only.length || only.some((name) => file.includes(name))));
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
    fs.writeFileSync(path.join(out, 'gepflegt-geometry.json'), JSON.stringify(report, null, 1));
    const edge = (value) => (value === null || value === undefined ? '-' : value);
    for (const result of report) {
      console.log(`\n== ${result.file}`);
      for (const surface of ['pdf', 'preview']) for (const page of result[surface] ?? []) {
        console.log(`  ${surface.padEnd(7)} p${page.page} lane 0-${edge(page.band?.right)} | side text ${edge(page.sideText?.left)}-${edge(page.sideText?.right)} top ${edge(page.sideText?.top)} | main text ${edge(page.mainText?.left)}-${edge(page.mainText?.right)} (R ${page.mainText ? Math.round((210 - page.mainText.right) * 10) / 10 : '-'}) top ${edge(page.mainText?.top)} | name ${edge(page.name?.top)} photo ${edge(page.photo?.top)}/${edge(page.photo?.left)} | first main ${edge(page.firstMain?.top)} side ${edge(page.firstSide?.top)} | footer ${edge(page.footer?.left)}-${edge(page.footer?.right)} bottom ${edge(page.footer?.bottom)} | cross ${page.mainIntoSide} overflow ${page.mainOverflow}/${page.sideOverflow}`);
      }
    }
  } catch (error) { console.error(error); }
  app.exit(0);
});
