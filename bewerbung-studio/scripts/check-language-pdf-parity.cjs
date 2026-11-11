// Real Electron printToPDF check of the default dots-only languages, using the same fixture on both surfaces.
// Run after language-height-qa.mjs: npx electron scripts/check-language-pdf-parity.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/language-qa');
const probe = (surface) => {
  const mm = (px) => Math.round(px * 25.4 / 96 * 100) / 100;
  const sheets = [...document.querySelectorAll(surface === 'pdf' ? '.cv-sheet' : '.document-paper')];
  return sheets.map((sheet, index) => {
    const section = sheet.querySelector('[data-managed-section="languages"]');
    if (!section) return { page: index + 1, languages: null };
    const sheetBox = sheet.getBoundingClientRect();
    const box = section.getBoundingClientRect();
    const grid = section.querySelector('.resume-language-grid');
    const cards = [...(grid?.children ?? [])];
    const overflow = [...section.querySelectorAll('*')].filter((node) =>
      node.scrollWidth > node.clientWidth + 1 || node.getBoundingClientRect().right > sheetBox.right + .5).length;
    return {
      page: index + 1, languages: {
        top: mm(box.top - sheetBox.top), left: mm(box.left - sheetBox.left), width: mm(box.width), height: mm(box.height),
        columns: Number(grid?.getAttribute('data-columns') ?? 0), overflow,
        cards: cards.map((card) => ({
          name: card.querySelector('.resume-language-primary strong')?.textContent?.trim() ?? '',
          dots: card.querySelectorAll('[data-resume-language-dots] > *').length,
          filled: card.querySelectorAll('[data-resume-language-dots] > .filled').length,
          compact: card.classList.contains('resume-language-item--compact'),
          text: (card.textContent ?? '').replace(/\s+/g, ' ').trim(),
          filledColor: getComputedStyle(card.querySelector('[data-resume-language-dots] > .filled')).backgroundColor,
          emptyColor: card.querySelector('[data-resume-language-dots] > :not(.filled)')
            ? getComputedStyle(card.querySelector('[data-resume-language-dots] > :not(.filled)')).backgroundColor : null,
        })),
      },
    };
  });
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 900, height: 1400, webPreferences: { sandbox: true } });
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))
      .filter((entry) => !entry.ats && entry.combo === 'dots' && entry.count === 4);
    const report = [];
    for (const entry of manifest) {
      const result = { file: entry.file, template: entry.template };
      for (const [surface, name] of [['pdf', `${entry.file}.html`], ['preview', `${entry.file}-preview.html`]]) {
        await win.loadFile(path.join(out, name));
        await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
        result[surface] = await win.webContents.executeJavaScript(`(${probe.toString()})(${JSON.stringify(surface)})`);
        const pdf = await win.webContents.printToPDF({
          pageSize: 'A4', preferCSSPageSize: true, printBackground: true,
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        fs.writeFileSync(path.join(out, surface === 'pdf' ? `${entry.file}.pdf` : `${entry.file}-preview.pdf`), pdf);
      }
      report.push(result);
      const a = result.pdf.find((page) => page.languages)?.languages;
      const b = result.preview.find((page) => page.languages)?.languages;
      assert.equal(result.pdf.length, result.preview.length, `${entry.template}: page count`);
      assert.ok(a && b, `${entry.template}: languages section`);
      assert.equal(a.columns, b.columns, `${entry.template}: columns`);
      assert.equal(a.overflow + b.overflow, 0, `${entry.template}: overflowing content`);
      assert.ok(Math.abs(a.height - b.height) <= 1.2, `${entry.template}: section height`);
      assert.ok(Math.abs(a.top - b.top) <= .3 && Math.abs(a.left - b.left) <= .3, `${entry.template}: section position`);
      assert.deepEqual(a.cards, b.cards, `${entry.template}: language cards`);
      assert.deepEqual(a.cards.map((card) => [card.name, card.filled, card.dots, card.compact]),
        [['Deutsch', 5, 6, true], ['Englisch', 4, 6, true], ['Türkisch', 6, 6, true], ['Französisch', 2, 6, true]],
        `${entry.template}: scores`);
      for (const card of a.cards) if (card.emptyColor) assert.notEqual(card.filledColor, card.emptyColor, `${entry.template}: visible score`);
      if (entry.template === 'tuerkis-profil') assert.equal(a.cards[0].filledColor, 'rgb(36, 169, 225)', 'Türkis filled dot colour');
      console.log(`${entry.template}: ${result.pdf.length}/${result.preview.length} pages, languages ${a?.columns}/${b?.columns} columns, ${a?.height}/${b?.height} mm, overflow ${a?.overflow}/${b?.overflow}`);
    }
    fs.writeFileSync(path.join(out, 'pdf-parity-report.json'), JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.exit(process.exitCode ?? 0);
  }
});
