// Page filling, sidebar persistence, column surfaces and lost/duplicated content of tmp/pagination-flow-qa (from
// scripts/pagination-flow-qa.mjs), measured in real Chromium on the PDF HTML and on the preview HTML:
//   npx electron scripts/check-pagination-flow-qa.cjs [--shots] [--quiet] [filter…]
//   --shots: write the PDF of every document; --quiet: only the problems (for RANDOM runs)
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/pagination-flow-qa');
const args = process.argv.slice(2);
const only = args.filter((arg) => !arg.startsWith('-') && !arg.includes('check-pagination'));
const shots = args.includes('--shots');
const quiet = args.includes('--quiet');
const PARITY_MM = Number(process.env.PARITY_MM || 12);

/** Runs in the page: one entry per sheet. */
const probe = (sheetSelector, tokens) => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 10) / 10;
  const solid = (color) => color && color !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(color) && !/^rgba?\(255, 255, 255(, 1)?\)$/.test(color);
  return [...document.querySelectorAll(sheetSelector)].map((sheet, index) => {
    const box = sheet.getBoundingClientRect();
    const rel = (node) => {
      const r = node.getBoundingClientRect();
      return { top: mm(r.top - box.top), bottom: mm(r.bottom - box.top), left: mm(r.left - box.left), right: mm(r.right - box.left) };
    };
    const inSidebar = (node) => Boolean(node.closest('aside,[data-cv-zone="sidebar"],.modern-resume-right-column,.modern-pdf-right,.kompakt-right'));
    const sections = [...sheet.querySelectorAll('[data-managed-section]')].map((node) => ({ id: node.getAttribute('data-managed-section'), zone: node.getAttribute('data-cv-zone') || (inSidebar(node) ? 'sidebar' : 'main'), ...rel(node) }));
    const leaves = [...sheet.querySelectorAll('li,p,h3,h4,h5,span,strong,small,div')]
      .filter((node) => node.children.length === 0 && (node.textContent || '').trim() && node.getBoundingClientRect().width > 0 && !node.closest('footer,[class*="footer"],header,style'));
    const bottomOf = (filter) => Math.max(0, ...leaves.filter(filter).map((node) => rel(node).bottom));
    const asides = [...sheet.querySelectorAll('aside,.modern-resume-right-column,.modern-pdf-right,.kompakt-right')].map((node) => ({ cls: String(node.className).slice(0, 40), ...rel(node) }));
    const surfaces = [...sheet.querySelectorAll('aside,main,[data-resume-columns]>*')]
      .map((node) => ({ cls: String(node.className).slice(0, 40), bg: getComputedStyle(node).backgroundColor, ...rel(node) }))
      .filter((entry) => solid(entry.bg) && entry.right - entry.left > 30 && entry.bottom - entry.top > 20);
    // Elements that carry text of their own (a heading with a small level label inside is no leaf).
    const owners = [...sheet.querySelectorAll('*')].filter((node) => !node.closest('footer,[class*="footer"],header,style,script') && [...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim()));
    const found = {};
    for (const [key, list] of Object.entries(tokens)) {
      found[key] = {};
      for (const token of list) {
        const node = owners.find((candidate) => [...candidate.childNodes].some((child) => child.nodeType === 3 && child.textContent.includes(token)));
        if (node) found[key][token] = inSidebar(node) ? 'sidebar' : 'main';
      }
    }
    const footer = sheet.querySelector('footer,[class*="footer"]');
    return {
      page: index + 1,
      height: mm(box.height),
      asides,
      sidebarBottom: bottomOf(inSidebar),
      mainBottom: bottomOf((node) => !inSidebar(node)),
      footerTop: footer ? rel(footer).top : null,
      sections,
      surfaces,
      found,
      overflow: leaves.filter((node) => rel(node).bottom > mm(box.height) + 0.5 || rel(node).right > 210.5).length,
    };
  });
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, useContentSize: true, width: 900, height: 1200, webPreferences: { sandbox: true } });
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((entry) => !only.length || only.some((name) => entry.file.includes(name)));
  const report = [];
  const problems = [];
  for (const entry of manifest) {
    const plan = JSON.parse(fs.readFileSync(path.join(out, `${entry.file}-plan.json`), 'utf8'));
    const result = { file: entry.file, plan: plan.map((page) => ({ n: page.pageNumber, sidebar: page.sidebar, blocks: page.blocks, ranges: page.blockRanges, fill: page.fill, density: page.density, items: page.items.map((item) => `${item.kind[0]}:${item.id.slice(-3)}${item.bullets ? `[${item.bullets.from}-${item.bullets.to}]` : ''}`) })) };
    for (const [surface, suffix, selector] of [['pdf', '', '.cv-sheet'], ['preview', '-preview', '.document-paper']]) {
      await win.loadFile(path.join(out, `${entry.file}${suffix}.html`));
      await new Promise((resolve) => setTimeout(resolve, 120));
      result[surface] = await win.webContents.executeJavaScript(`(${probe.toString()})(${JSON.stringify(selector)}, ${JSON.stringify(entry.tokens)})`);
      if (shots && surface === 'pdf') {
        const pdf = await win.webContents.printToPDF({ pageSize: 'A4', preferCSSPageSize: true, printBackground: true, margins: { marginType: 'none' } });
        fs.writeFileSync(path.join(out, `${entry.file}.pdf`), pdf);
      }
    }
    // --- verdicts ---
    const issue = (message) => problems.push(`${entry.file}: ${message}`);
    if (result.pdf.length !== result.preview.length) issue(`pages pdf ${result.pdf.length} / preview ${result.preview.length}`);
    if (result.pdf.length !== plan.length) issue(`plan ${plan.length} pages, pdf ${result.pdf.length}`);
    for (const surface of ['pdf', 'preview']) {
      // A page one whose fixed sidebar blocks alone overflow by the planner's own estimate cannot be fixed by the flow.
      result[surface].forEach((page) => { if (page.overflow && !(page.page === 1 && (plan[0].fill?.sidebar ?? 0) > 1)) issue(`${surface} p${page.page}: ${page.overflow} text box(es) beyond the sheet`); });
      // Only the knowledge section is held to the user's column here: a template may draw certificates or special sections in its own column.
      const zoneOf = { knowledge: entry.zones.knowledge };
      for (const [key, list] of Object.entries(entry.tokens)) {
        for (const token of list) {
          const hits = result[surface].filter((page) => page.found[key][token] !== undefined);
          if (!hits.length) issue(`${surface}: ${key} "${token}" lost`);
          // The title of an education entry that goes on is repeated by design (like the header of a continued experience).
          else if (hits.length > 1 && !(key === 'education' && plan.some((page) => page.items.some((item) => item.kind === 'education' && item.bullets)))) issue(`${surface}: ${key} "${token}" on ${hits.length} pages`);
          else if (zoneOf[key] && hits[0].found[key][token] !== zoneOf[key] && entry.sidebarLane) issue(`${surface}: ${key} "${token}" is in the ${hits[0].found[key][token]}, expected ${zoneOf[key]}`);
        }
      }
    }
    // preview ↔ PDF: the same sections in the same column of every page (heights may differ by the template's own CSS)
    result.pdf.forEach((page, index) => {
      const other = result.preview[index];
      if (!other) return;
      const signature = (sheet) => sheet.sections.map((section) => `${section.id}:${section.zone[0]}`).sort().join(',');
      if (signature(page) !== signature(other)) issue(`p${page.page} sections pdf [${signature(page)}] / preview [${signature(other)}]`);
      if (Math.abs(page.sidebarBottom - other.sidebarBottom) > PARITY_MM) issue(`p${page.page} sidebar bottom pdf ${page.sidebarBottom} / preview ${other.sidebarBottom}`);
      result.parityDelta = Math.max(result.parityDelta ?? 0, Math.abs(page.sidebarBottom - other.sidebarBottom), Math.abs(page.mainBottom - other.mainBottom));
    });
    result.maxSidebarBottom = Math.max(...result.pdf.map((page) => page.sidebarBottom));
    report.push(result);
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  if (!quiet) for (const result of report) {
    console.log(`\n== ${result.file}`);
    result.plan.forEach((page) => console.log(`  plan p${page.n}: sidebar=${page.sidebar} blocks=${JSON.stringify(page.blocks)} ranges=${JSON.stringify(page.ranges ?? {})} fill=${JSON.stringify(page.fill && { m: +page.fill.main.toFixed(2), s: +page.fill.sidebar.toFixed(2) })} items=${page.items.join(',')}`));
    for (const surface of ['pdf', 'preview']) {
      console.log(`  ${surface}: ${result[surface].length} pages`);
      result[surface].forEach((page) => console.log(`    p${page.page}: asides=${page.asides.length} sidebarBottom=${page.sidebarBottom} mainBottom=${page.mainBottom} footerTop=${page.footerTop} overflow=${page.overflow} sidebar=[${page.sections.filter((s) => s.zone === 'sidebar').map((s) => s.id)}] main=[${page.sections.filter((s) => s.zone !== 'sidebar').map((s) => s.id)}]`));
    }
  }
  const byTemplate = {};
  for (const result of report) {
    const id = result.file.replace(/^[a-z0-9]+-/, '');
    const entry = (byTemplate[id] ??= { docs: 0, maxSidebar: 0, parity: 0, spill: 0 });
    entry.docs += 1;
    entry.maxSidebar = Math.max(entry.maxSidebar, result.maxSidebarBottom);
    entry.parity = Math.max(entry.parity, result.parityDelta ?? 0);
    if (result.plan.slice(1).some((page) => page.sidebar)) entry.spill += 1;
  }
  console.log(Object.entries(byTemplate).map(([id, e]) => `${id}: ${e.docs} docs, ${e.spill} with a continued sidebar, lowest sidebar text ${e.maxSidebar} mm, preview-pdf delta ${e.parity} mm`).join('\n'));
  console.log(`\n${report.length} documents, ${problems.length} problem(s)`);
  console.log(problems.slice(0, 80).join('\n'));
  app.exit(0);
});
