const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Measures the fixtures of scripts/design-system-qa.mjs in Chromium.
//  - native PDF: the typed native design of every template equals what is drawn (sizes, weights, capitals, gaps, margin)
//  - shared layer: its values reach preview and PDF of every template alike, and a chosen page margin moves the left
//    edge of the content by exactly the difference to the template's own margin
const dir = path.resolve('tmp/design-system-qa');
const { sharedValues, entries } = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

const probe = () => {
  const mm = (px) => px * 25.4 / 96;
  const root = document.querySelector('.cv-sheet') || document.querySelector('.document-paper') || document.body;
  const base = root.getBoundingClientRect();
  const rel = (element) => { const r = element.getBoundingClientRect(); return { l: mm(r.left - base.left), t: mm(r.top - base.top), b: mm(r.bottom - base.top) }; };
  const sections = Array.from(root.querySelectorAll('[data-managed-section]')).map((element) => ({
    element, id: element.getAttribute('data-managed-section'), box: rel(element),
    side: Boolean(element.closest('aside') || element.closest('[data-cv-zone="sidebar"]')),
  }));
  const main = sections.filter((section) => !section.side).sort((first, second) => first.box.t - second.box.t);
  const column = main.filter((section) => Math.abs(section.box.l - main[0].box.l) < 1);
  const heading = (section) => section.element.querySelector('[data-cv-heading]') || section.element.querySelector('h2,h3');
  const label = (element) => element.querySelector('.cv-heading__label') || element;
  const first = heading(main[0]);
  const style = getComputedStyle(label(first));
  const experienceItem = root.querySelector("[data-managed-section='experience'] li") || root.querySelector('[data-managed-section] li');
  const item = getComputedStyle(experienceItem);
  const pt = (px) => Math.round(px * 72 / 96 * 100) / 100;
  return {
    left: Math.min(...sections.map((section) => section.box.l)),
    sectionGap: column.length > 1 ? column[1].box.t - column[0].box.b : null,
    titleGap: first.nextElementSibling ? rel(first.nextElementSibling).t - rel(first).b : null,
    itemSize: pt(parseFloat(item.fontSize)), itemLine: parseFloat(item.lineHeight) / parseFloat(item.fontSize),
    headingSize: pt(parseFloat(style.fontSize)), headingWeight: Number(style.fontWeight), headingUpper: style.textTransform === 'uppercase',
    headingAlign: style.textAlign,
  };
};

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1300 });
  const measured = {};
  for (const entry of entries) {
    await window.loadURL(require('node:url').pathToFileURL(path.join(dir, `${entry.file}.html`)).href);
    measured[`${entry.id}|${entry.surface}|${entry.variant}`] = await window.webContents.executeJavaScript(`(${probe.toString()})()`);
  }
  const failures = [];
  const near = (value, expected, tolerance) => value !== null && Math.abs(value - expected) <= tolerance;
  const check = (id, surface, variant, name, ok, detail) => { if (!ok) failures.push({ id, surface, variant, name, detail }); };
  let checks = 0;
  const ids = [...new Set(entries.map((entry) => entry.id))];
  for (const id of ids) {
    const { native } = entries.find((entry) => entry.id === id);
    const { typography, spacing } = native;
    // The typed native design equals the printed PDF.
    const printed = measured[`${id}|pdf|native`];
    for (const [name, ok, detail] of [
      ['body size', near(printed.itemSize, typography.bodySizePt, 0.15), [printed.itemSize, typography.bodySizePt]],
      ['line height', near(printed.itemLine, typography.lineHeight, 0.04), [printed.itemLine, typography.lineHeight]],
      ['section title size', near(printed.headingSize, typography.sectionHeadingSizePt, 0.15), [printed.headingSize, typography.sectionHeadingSizePt]],
      ['section title weight', printed.headingWeight === typography.sectionHeadingWeight, [printed.headingWeight, typography.sectionHeadingWeight]],
      ['section title capitals', printed.headingUpper === typography.sectionHeadingUppercase, [printed.headingUpper, typography.sectionHeadingUppercase]],
      ['section gap', near(printed.sectionGap, spacing.sectionGapMm, 0.35), [printed.sectionGap, spacing.sectionGapMm]],
      ['title gap', near(printed.titleGap, spacing.sectionTitleGapMm, 0.35), [printed.titleGap, spacing.sectionTitleGapMm]],
      ['page margin', near(printed.left, spacing.pageMarginMm, 0.35), [printed.left, spacing.pageMarginMm]],
    ]) { checks++; check(id, 'pdf', 'native', name, ok, detail); }
    // The shared layer reaches both outputs.
    for (const surface of ['preview', 'pdf']) {
      const own = measured[`${id}|${surface}|native`];
      const shared = measured[`${id}|${surface}|shared`];
      for (const [name, ok, detail] of [
        ['body size', near(shared.itemSize, sharedValues.bodySizePt, 0.05), [shared.itemSize, sharedValues.bodySizePt]],
        ['line height', near(shared.itemLine, sharedValues.lineHeight, 0.03), [shared.itemLine, sharedValues.lineHeight]],
        ['section title size', near(shared.headingSize, sharedValues.sectionHeadingSizePt, 0.05), [shared.headingSize, sharedValues.sectionHeadingSizePt]],
        ['section title weight', shared.headingWeight === sharedValues.sectionHeadingWeight, [shared.headingWeight]],
        ['section title alignment', shared.headingAlign === 'center', [shared.headingAlign]],
        ['section gap', near(shared.sectionGap, sharedValues.sectionGapMm, 0.35), [shared.sectionGap, sharedValues.sectionGapMm]],
        ['title gap', near(shared.titleGap, sharedValues.sectionTitleGapMm, 0.35), [shared.titleGap, sharedValues.sectionTitleGapMm]],
        ['page margin shift', near(shared.left - own.left, sharedValues.marginShiftMm, 0.35), [shared.left - own.left, sharedValues.marginShiftMm]],
      ]) { checks++; check(id, surface, 'shared', name, ok, detail); }
    }
  }
  console.log(JSON.stringify({ templates: ids.length, checks, failures }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch((error) => { console.error(error); app.exit(1); });
