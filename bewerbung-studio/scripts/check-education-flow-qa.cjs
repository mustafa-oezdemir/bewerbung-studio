// Real Chromium measurement of tmp/education-flow-qa (scripts/education-flow-qa.mjs), PDF and preview: which sections stand
// on which page, the room left at the bottom of the main column of every page, the gaps between sections, between a section
// title and its content, between entries and between an entry title and its content (what the central spacing controls).
//   npx electron scripts/check-education-flow-qa.cjs [--json] [--shots] [filter…]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/education-flow-qa');
const args = process.argv.slice(2);
const only = args.filter((arg) => !arg.startsWith('-') && !arg.includes('check-education'));

const probe = (sheetSelector) => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 100) / 100;
  return [...document.querySelectorAll(sheetSelector)].map((sheet, index) => {
    const box = sheet.getBoundingClientRect();
    const rel = (node) => { const r = node.getBoundingClientRect(); return { top: mm(r.top - box.top), bottom: mm(r.bottom - box.top), left: mm(r.left - box.left), right: mm(r.right - box.left) }; };
    const inAside = (node) => Boolean(node.closest('aside'));
    const sections = [...sheet.querySelectorAll('[data-managed-section]')].filter((node) => !node.closest('header')).map((node) => ({ id: node.getAttribute('data-managed-section'), aside: inAside(node), ...rel(node) }));
    const main = sections.filter((section) => !section.aside).sort((a, b) => a.top - b.top);
    const gaps = main.slice(1).map((section, i) => ({ from: main[i].id, to: section.id, gap: Math.round((section.top - main[i].bottom) * 100) / 100 }));
    // title -> first content, entry -> entry, entry title -> its content, on the first career section of the page
    const first = (selector, root) => root.querySelector(selector);
    const detail = [];
    for (const section of sheet.querySelectorAll('[data-managed-section="experience"],[data-managed-section="education"]')) {
      const heading = section.querySelector('h2,h3');
      const entries = [...section.querySelectorAll('article,li[class*="entry"],[class*="career-entry"]')].filter((node) => !node.parentElement.closest('article,[class*="career-entry"]'));
      const firstEntry = entries[0];
      const titleGap = heading && firstEntry ? Math.round((rel(firstEntry).top - rel(heading).bottom) * 100) / 100 : null;
      const entryGaps = entries.slice(1).map((entry, i) => Math.round((rel(entry).top - rel(entries[i]).bottom) * 100) / 100);
      const entryTitle = firstEntry?.querySelector('h3,h4');
      const afterTitle = entryTitle ? entryTitle.nextElementSibling : null;
      const contentGap = entryTitle && afterTitle ? Math.round((rel(afterTitle).top - rel(entryTitle).bottom) * 100) / 100 : null;
      detail.push({ id: section.getAttribute('data-managed-section'), titleGap, entryGaps, contentGap, entries: entries.length });
    }
    const footer = sheet.querySelector('footer,[class*="footer"]');
    const leaves = [...sheet.querySelectorAll('li,p,h1,h2,h3,h4,span,small,strong')].filter((node) => node.children.length === 0 && (node.textContent || '').trim() && node.getBoundingClientRect().width > 0 && !node.closest('footer,[class*="footer"],header,style'));
    const bottomOf = (filter) => Math.max(0, ...leaves.filter(filter).map((node) => rel(node).bottom));
    const closing = sheet.querySelector('[data-resume-closing]');
    return {
      page: index + 1,
      sections: sections.map((section) => `${section.aside ? 'A:' : ''}${section.id}@${section.top}-${section.bottom}`),
      mainBottom: bottomOf((node) => !inAside(node) && !node.closest('[data-resume-closing]')),
      sidebarBottom: bottomOf(inAside),
      footerTop: footer ? rel(footer).top : null,
      closing: closing ? rel(closing) : null,
      gaps, detail,
      overflow: leaves.filter((node) => rel(node).bottom > mm(box.height) + 0.5 || rel(node).right > 210.5).length,
      markers: [...sheet.querySelectorAll('[data-resume-entry-marker]')].map((node) => (node.parentElement?.textContent || '').replace(/\s+/g, ' ').trim()),
      text: (sheet.textContent || '').replace(/\s+/g, ' '),
    };
  });
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, useContentSize: true, width: 900, height: 1200, webPreferences: { sandbox: true } });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((entry) => !only.length || only.some((name) => entry.file === name));
    const report = [];
    for (const entry of manifest) {
      const result = { file: entry.file, plan: entry.plan };
      for (const [surface, suffix, selector] of [['pdf', '', '.cv-sheet'], ['preview', '-preview', '.document-paper']]) {
        await win.loadFile(path.join(out, `${entry.file}${suffix}.html`));
        await new Promise((resolve) => setTimeout(resolve, 150));
        result[surface] = await win.webContents.executeJavaScript(`(${probe.toString()})(${JSON.stringify(selector)})`);
        if (args.includes('--shots') && surface === 'pdf') fs.writeFileSync(path.join(out, `${entry.file}.pdf`), await win.webContents.printToPDF({ pageSize: 'A4', preferCSSPageSize: true, printBackground: true, margins: { marginType: 'none' } }));
      }
      report.push(result);
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
    if (args.includes('--json')) console.log(JSON.stringify(report));
    else for (const result of report) {
      console.log(`\n== ${result.file}   plan: ${result.plan}`);
      for (const surface of ['pdf', 'preview']) {
        for (const page of result[surface]) {
          console.log(`  ${surface.padEnd(7)} p${page.page}: main bottom ${page.mainBottom} (footer ${page.footerTop}, free ${page.footerTop ? Math.round((page.footerTop - page.mainBottom) * 10) / 10 : '-'}) overflow ${page.overflow} closing ${page.closing ? page.closing.top : '-'}  [${page.sections.filter((s) => !s.startsWith('A:')).join(' ')}]`);
          for (const d of page.detail) console.log(`      ${surface} ${d.id}: titleGap ${d.titleGap} entryGaps ${JSON.stringify(d.entryGaps)} contentGap ${d.contentGap}`);
          if (page.gaps.length) console.log(`      ${surface} section gaps ${JSON.stringify(page.gaps.map((g) => `${g.from}->${g.to} ${g.gap}`))}`);
          if (page.markers.length) console.log(`      markers ${JSON.stringify(page.markers)}`);
        }
      }
    }
  } catch (error) { console.error(error); }
  app.exit(0);
});
