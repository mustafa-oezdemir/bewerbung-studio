const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Measures the fixtures of scripts/design-system-qa.mjs in Chromium.
//  - native PDF: the typed native design of every template equals what is drawn (sizes, weights, capitals, gaps, margin)
//  - shared layer: its values reach preview and PDF of every template alike, and a chosen page margin moves the left
//    edge of the content by exactly the difference to the template's own margin
//  - page margin and inner padding are independent: the content edge (the text, i.e. the sections' content boxes) moves by
//    the margin's difference plus the padding, whichever of the two is set, and the padding insets both sides alike
const dir = path.resolve('tmp/design-system-qa');
const { sharedValues, entries } = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

const probe = () => {
  const mm = (px) => px * 25.4 / 96;
  const root = document.querySelector('.cv-sheet') || document.querySelector('.document-paper') || document.body;
  const base = root.getBoundingClientRect();
  // Measure native section boxes separately from the text children moved by an override.
  const rel = (element) => {
    const r = element.getBoundingClientRect(); const style = getComputedStyle(element);
    return {
      l: mm(r.left - base.left) + mm(parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth)),
      r: mm(r.right - base.left) - mm(parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)),
      t: mm(r.top - base.top), b: mm(r.bottom - base.top),
    };
  };
  const sections = Array.from(root.querySelectorAll('[data-managed-section]')).map((element) => ({
    element, id: element.getAttribute('data-managed-section'), box: rel(element),
    textBox: rel(element.querySelector(':scope > :not([data-resume-background-layer])') || element),
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
  const sidebarList = root.querySelector('[data-cv-zone="sidebar"][data-managed-section="languages"] ul');
  const sidebarItem = sidebarList?.querySelector('li');
  const contactHeading = root.querySelector('.pehlione-contacts h3 span');
  const contactText = root.querySelector('.pehlione-contacts li div');
  const sidebarHeading = root.querySelector('[data-cv-zone="sidebar"][data-managed-section="languages"] .cv-heading__label');
  const left = (element) => element ? mm(element.getBoundingClientRect().left - base.left) : null;
  const pt = (px) => Math.round(px * 72 / 96 * 100) / 100;
  return {
    left: Math.min(...sections.map((section) => section.textBox.l)),
    right: Math.max(...sections.map((section) => section.textBox.r)),
    nativeLeft: Math.min(...sections.map((section) => section.box.l)),
    nativeRight: Math.max(...sections.map((section) => section.box.r)),
    sectionGap: column.length > 1 ? column[1].box.t - column[0].box.b : null,
    titleGap: first.nextElementSibling ? rel(first.nextElementSibling).t - rel(first).b : null,
    itemSize: pt(parseFloat(item.fontSize)), itemLine: parseFloat(item.lineHeight) / parseFloat(item.fontSize),
    headingSize: pt(parseFloat(style.fontSize)), headingWeight: Number(style.fontWeight), headingUpper: style.textTransform === 'uppercase',
    headingAlign: style.textAlign,
    sidebarListIndent: sidebarItem ? mm(sidebarItem.getBoundingClientRect().left - sidebarList.getBoundingClientRect().left) : null,
    sidebarHeadingVsContact: sidebarHeading && contactHeading ? left(sidebarHeading) - left(contactHeading) : null,
    sidebarTextVsContact: sidebarItem && contactText ? left(sidebarItem) - left(contactText) : null,
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
      ['page margin', near(printed.nativeLeft, spacing.pageMarginMm, 0.35), [printed.nativeLeft, spacing.pageMarginMm]],
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
      // Page margin and inner padding: each moves the content edge by its own amount and by nothing else.
      for (const variant of ['margin', 'smaller', 'inner', 'both', 'smallerBoth']) {
        const changed = measured[`${id}|${surface}|${variant}`];
        const { spacing: chosen } = entries.find((entry) => entry.id === id && entry.surface === surface && entry.variant === variant);
        const marginShift = chosen.pageMarginMm === undefined ? 0 : chosen.pageMarginMm - spacing.pageMarginMm;
        const innerShift = chosen.innerPaddingMm === undefined ? 0 : chosen.innerPaddingMm - spacing.innerPaddingMm;
        const expected = marginShift + innerShift;
        checks++;
        check(id, surface, variant, 'content edge = margin difference + inner padding', near(changed.left - own.left, expected, 0.35), [changed.left - own.left, expected]);
        // The padding insets the right side as well; the page margin's right side is the template's own business.
        if (chosen.pageMarginMm === undefined) {
          checks++;
          check(id, surface, variant, 'right edge = inner padding difference', near(own.right - changed.right, innerShift, 0.35), [own.right - changed.right, innerShift]);
        }
      }
      if (id === 'pehlione_white') for (const variant of ['native', 'shared', 'margin', 'smaller', 'inner', 'both', 'smallerBoth']) {
        const aligned = measured[`${id}|${surface}|${variant}`];
        for (const [name, value, expected] of [
          ['sidebar list uses the contact text column', aligned.sidebarTextVsContact, 0],
          ['sidebar heading uses the contact heading column', aligned.sidebarHeadingVsContact, 0],
          ['sidebar list keeps its typed indent', aligned.sidebarListIndent, 6.5],
        ]) {
          checks++;
          check(id, surface, variant, name, near(value, expected, 0.15), [value, expected]);
        }
      }
    }
  }
  console.log(JSON.stringify({ templates: ids.length, checks, failures }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch((error) => { console.error(error); app.exit(1); });
