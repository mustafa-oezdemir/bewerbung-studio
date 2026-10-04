// Real Chromium measurement of tmp/tabellarisch-website-qa (from scripts/tabellarisch-website-qa.mjs): the header of the
// first page (rows of the contact grid, bottom), the top of the first section, the usable bottom of page one, the last
// bullet of every page, overflow, the footer, the continuation markers and every career bullet (lost / doubled).
//   npx electron scripts/check-tabellarisch-website-qa.cjs [--json] [--shots] [filter…]   (--shots: the PDF of every case)
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/tabellarisch-website-qa');
const args = process.argv.slice(2);
const only = args.filter((arg) => !arg.startsWith('-') && !arg.includes('check-tabellarisch'));

/** Runs in the page: one entry per sheet. */
const probe = (sheetSelector) => {
  const mm = (px) => Math.round((px * 25.4) / 96 * 100) / 100;
  return [...document.querySelectorAll(sheetSelector)].map((sheet, index) => {
    const box = sheet.getBoundingClientRect();
    const rel = (node) => { const r = node.getBoundingClientRect(); return { top: mm(r.top - box.top), bottom: mm(r.bottom - box.top), left: mm(r.left - box.left), right: mm(r.right - box.left) }; };
    const header = sheet.querySelector('header');
    const contacts = [...sheet.querySelectorAll('header [data-contact-kind]')].map((node) => ({ kind: node.getAttribute('data-contact-kind'), ...rel(node), text: (node.textContent || '').trim() }));
    // distinct rows of the contact grid (a row = one top value, 0.3 mm tolerance)
    const rows = [];
    for (const contact of contacts) if (!rows.some((top) => Math.abs(top - contact.top) < 0.5)) rows.push(contact.top);
    const sections = [...sheet.querySelectorAll('[data-managed-section]')].filter((node) => !node.closest('header')).map((node) => ({ id: node.getAttribute('data-managed-section'), ...rel(node) }));
    const leaves = [...sheet.querySelectorAll('li,p,h1,h2,h3,h4,span,strong,div')]
      .filter((node) => node.children.length === 0 && (node.textContent || '').trim() && node.getBoundingClientRect().width > 0 && !node.closest('style,script'));
    const bullets = [...sheet.querySelectorAll('li')].map((node) => ({ text: (node.textContent || '').replace(/\s+/g, ' ').trim(), ...rel(node) }));
    const footer = sheet.querySelector('footer,[class*="footer"]');
    const photo = sheet.querySelector('header img');
    return {
      page: index + 1,
      height: mm(box.height),
      headerBottom: header ? rel(header).bottom : null,
      contactRows: rows.length,
      contacts: contacts.map((contact) => `${contact.kind}@${contact.top}/c${contact.left < 105 ? 1 : 2}`),
      photoBottom: photo ? rel(photo).bottom : null,
      sections,
      bullets,
      footerTop: footer ? rel(footer).top : null,
      footerText: footer ? (footer.textContent || '').replace(/\s+/g, ' ').trim() : '',
      lastTextBottom: Math.max(0, ...leaves.filter((node) => !node.closest('footer,[class*="footer"],header')).map((node) => rel(node).bottom)),
      overflow: leaves.filter((node) => rel(node).bottom > mm(box.height) + 0.5 || rel(node).right > 210.5).length,
      text: (sheet.textContent || '').replace(/\s+/g, ' '),
      markers: [...sheet.querySelectorAll('h1,h2,h3,h4,[data-resume-entry-marker],small,span,em')].map((node) => (node.textContent || '').trim()).filter((text) => /Fortsetzung/i.test(text)),
    };
  });
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ show: false, useContentSize: true, width: 900, height: 1200, webPreferences: { sandbox: true } });
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))).filter((entry) => !only.length || only.some((name) => entry.file.includes(name)));
    const report = [];
    for (const entry of manifest) {
      const result = { file: entry.file, website: entry.website, plan: entry.plan };
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
        const first = result[surface][0];
        const experience = first.sections.find((section) => section.id === 'experience');
        console.log(`  ${surface.padEnd(7)} p1 header bottom ${first.headerBottom}  contact rows ${first.contactRows} [${first.contacts.join(' ')}]  experience top ${experience?.top}  text bottom ${first.lastTextBottom}  footer ${first.footerTop}  overflow ${first.overflow}`);
        for (const page of result[surface]) {
          const pilot = page.bullets.filter((bullet) => /Priorisierung operativer|Übernahme von Teamverantwortung|Planung und Koordination operativer|Vorbereitung von Einsatzbriefings/.test(bullet.text));
          console.log(`    p${page.page}: pilot bullets ${pilot.length}${pilot.length ? ` (last bottom ${Math.max(...pilot.map((bullet) => bullet.bottom))})` : ''}  markers ${JSON.stringify(page.markers)}  footer "${page.footerText.slice(0, 60)}"  bottom ${page.lastTextBottom}`);
        }
      }
    }
  } catch (error) { console.error(error); }
  app.exit(0);
});
