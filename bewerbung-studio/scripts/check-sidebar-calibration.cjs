// Measures the probes of tmp/sidebar-calib (scripts/sidebar-calibration.mjs) in real Chromium and prints the item model
// of src/shared/resumePaginationGeometry.ts that fits them (never underestimating a wrapped line):
//   npx electron scripts/check-sidebar-calibration.cjs <templateId>
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/sidebar-calib');
const templateId = process.argv.slice(2).find((arg) => !arg.startsWith('-') && !arg.includes('check-sidebar')) ?? 'zeitgenoessisch';

const probe = (kind) => {
  const mm = (px) => px * 25.4 / 96;
  const section = document.querySelector(`[data-managed-section="${kind}"]`);
  if (!section) return null;
  const sectionBox = section.getBoundingClientRect();
  const itemSelector = kind === 'strengths' ? '.managed-strength-card' : '.managed-item';
  const items = [...section.querySelectorAll(itemSelector)].map((item) => {
    const title = kind === 'strengths' ? item.querySelector('strong') : item.querySelector('.managed-item-text');
    const description = kind === 'strengths' ? item.querySelector('p') : null;
    const box = item.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const style = getComputedStyle(title);
    const lineHeight = style.lineHeight === 'normal' ? parseFloat(style.fontSize) * 1.2 : parseFloat(style.lineHeight);
    const range = document.createRange();
    range.selectNodeContents(title);
    const own = [...range.getClientRects()];
    const lines = new Set(own.map((rect) => Math.round(rect.top))).size;
    const text = (title.textContent || '').replace(/\s+/g, ' ').trim();
    const result = {
      chars: text.length, lines, titleHeight: mm(titleBox.height), cardHeight: mm(box.height), top: mm(box.top - sectionBox.top), bottom: mm(box.bottom - sectionBox.top),
      width: mm(titleBox.width), fontMm: mm(parseFloat(style.fontSize)), lineMm: mm(lineHeight),
    };
    if (description) {
      const descriptionStyle = getComputedStyle(description);
      const descriptionRange = document.createRange();
      descriptionRange.selectNodeContents(description);
      result.description = {
        chars: (description.textContent || '').trim().length,
        lines: new Set([...descriptionRange.getClientRects()].map((rect) => Math.round(rect.top))).size,
        fontMm: mm(parseFloat(descriptionStyle.fontSize)),
        lineMm: mm(parseFloat(descriptionStyle.lineHeight)),
        width: mm(description.getBoundingClientRect().width),
        height: mm(description.getBoundingClientRect().height),
      };
    }
    return result;
  });
  const category = section.querySelector('.managed-knowledge-category h4');
  return { sectionHeight: mm(sectionBox.height), heading: mm(section.querySelector('h3,h2')?.getBoundingClientRect().height ?? 0), categoryTitle: category ? mm(category.getBoundingClientRect().height) : 0, items };
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, useContentSize: true, width: 900, height: 1200, webPreferences: { sandbox: true } });
  const manifest = JSON.parse(fs.readFileSync(path.join(out, `${templateId}-manifest.json`), 'utf8'));
  const rows = [];
  for (const entry of manifest) {
    await win.loadFile(path.join(out, `${entry.file}.html`));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const data = await win.webContents.executeJavaScript(`(${probe.toString()})(${JSON.stringify(entry.kind)})`);
    rows.push({ ...entry, data });
  }
  fs.writeFileSync(path.join(out, `${templateId}-measured.json`), JSON.stringify(rows, null, 1));
  const round = (value) => Math.round(value * 100) / 100;
  for (const kind of ['strengths', 'knowledge']) {
    const probes = rows.filter((row) => row.kind === kind && row.data);
    if (!probes.length) continue;
    const items = probes.flatMap((row) => row.data.items);
    const gaps = probes.flatMap((row) => row.data.items.slice(1).map((item, index) => item.top - row.data.items[index].bottom));
    const head = probes.map((row) => row.data.items[0].top);
    const lower = Math.max(...items.filter((item) => item.chars > 0).map((item) => (item.lines - 1) * item.width / item.chars));
    const upper = Math.min(...items.filter((item) => item.chars > 0).map((item) => item.lines * item.width / item.chars));
    const font = items[0].fontMm;
    const pitch = items[0].lineMm;
    const pad = items.map((item) => item.cardHeight - item.lines * item.lineMm);
    console.log(`\n== ${templateId} ${kind}`);
    console.log(`width ${round(items[0].width)} font ${round(font)} pitch ${round(pitch)} pad ${round(Math.min(...pad))}..${round(Math.max(...pad))} gap ${round(Math.min(...gaps))}..${round(Math.max(...gaps))} head ${round(Math.min(...head))}..${round(Math.max(...head))}`);
    console.log(`effective glyph advance (mm): at least ${round(lower)}, at most ${round(upper)} → cw = ${round(lower / font)}..${round(upper / font)}`);
    console.log(`items: ${items.map((item) => `${item.chars}c/${item.lines}l`).join(' ')}`);
    const descriptions = items.filter((item) => item.description);
    if (descriptions.length) {
      const d = descriptions[0].description;
      const dl = Math.max(...descriptions.map((item) => (item.description.lines - 1) * item.description.width / item.description.chars));
      console.log(`description font ${round(d.fontMm)} (x${round(d.fontMm / font)}) pitch ${round(d.lineMm)} (x${round(d.lineMm / pitch)}) width ${round(d.width)} advance>=${round(dl)} (cw ${round(dl / d.fontMm)}); card extra over title: ${descriptions.map((item) => round(item.cardHeight - item.titleHeight)).join(' ')}`);
    }
    for (const row of probes) console.log(`  ${row.name}: section ${round(row.data.sectionHeight)} heading ${round(row.data.heading)} categoryTitle ${round(row.data.categoryTitle)}`);
  }
  app.exit(0);
});
