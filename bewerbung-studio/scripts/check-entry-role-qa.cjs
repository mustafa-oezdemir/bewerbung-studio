const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Measures the fixtures of scripts/entry-role-qa.mjs in Chromium (the PDF HTML is the markup printToPDF prints):
//  - native: every role text of a template looks the same in the preview and the PDF (colour, size, weight), and the typed
//    native design names what the PDF draws (tmp/entry-role-qa/native.json lists the measured values)
//  - roles: every overridden role reaches every one of its texts on both surfaces, and nothing else changes colour or size
//  - every page: no text beyond the sheet, no overlapping text lines (also with the large and small sizes), the same page
//    count in the preview and the PDF
//   node node_modules/electron/cli.js scripts/check-entry-role-qa.cjs [filter…]
const dir = path.resolve('tmp/entry-role-qa');
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-') && !arg.includes('entry-role-qa'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).filter((entry) => !only.length || only.some((filter) => entry.file.includes(filter)));

const probe = () => {
  const pt = (px) => Math.round(parseFloat(px) * 72 / 96 * 100) / 100;
  const hex = (color) => {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return color;
    const [r, g, b] = match[1].split(',').map((part) => Math.round(parseFloat(part)));
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  };
  // The PDF prints `.cv-sheet` pages; the preview draws every page in its own `.document-paper`.
  const sheets = Array.from(document.querySelectorAll('.cv-sheet'));
  const papers = Array.from(document.querySelectorAll('.document-paper'));
  const pages = sheets.length ? sheets : papers.length ? papers : [document.body];
  const kindOf = (node) => {
    const section = node.closest('[data-managed-section]');
    const id = section?.getAttribute('data-managed-section') ?? '';
    if (id === 'experience' || id === 'education') return id;
    const kind = section?.querySelector('[data-custom-kind]')?.getAttribute('data-custom-kind') ?? section?.getAttribute('data-custom-kind');
    if (kind) return kind;
    return node.closest('.pehlione-project,.pehlione-pdf-project') ? 'highlight' : id || 'other';
  };
  const roles = [];
  pages.forEach((page, index) => {
    for (const node of page.querySelectorAll('[data-cv-role]')) {
      const style = getComputedStyle(node);
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const link = node.querySelector('a');
      roles.push({ page: index + 1, role: node.getAttribute('data-cv-role'), kind: kindOf(node), text: text.slice(0, 48),
        color: hex(style.color), size: pt(style.fontSize), weight: Number(style.fontWeight),
        lineRatio: style.lineHeight === 'normal' ? 'normal' : Math.round(parseFloat(style.lineHeight) / parseFloat(style.fontSize) * 100) / 100,
        ...(link ? { linkColor: hex(getComputedStyle(link).color) } : {}) });
    }
  });
  // The head of every entry (from its top to the lowest role text): the planner's head model is checked against it.
  const heads = [];
  pages.forEach((page, index) => {
    for (const title of page.querySelectorAll('[data-cv-role="entry-title"]')) {
      const entry = title.closest('article') || title.closest('li');
      if (!entry) continue;
      const top = entry.getBoundingClientRect().top;
      const bottom = Math.max(...Array.from(entry.querySelectorAll('[data-cv-role]')).filter((node) => node.getAttribute('data-cv-role') !== 'description')
        .map((node) => node.getBoundingClientRect().bottom));
      heads.push({ page: index + 1, kind: kindOf(title), text: (title.textContent || '').trim().slice(0, 48), head: Math.round((bottom - top) * 25.4 / 96 * 100) / 100,
        height: Math.round(entry.getBoundingClientRect().height * 25.4 / 96 * 100) / 100 });
    }
  });
  // Text that is not a role: its colour and size must not move when only roles change.
  const others = [];
  pages.forEach((page, index) => {
    for (const node of page.querySelectorAll('h1,h2,li,[data-managed-section="summary"] p')) {
      if (node.closest('[data-cv-role]') || node.querySelector('[data-cv-role]')) continue;
      const style = getComputedStyle(node);
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) others.push({ page: index + 1, tag: node.tagName, text: text.slice(0, 32), color: hex(style.color), size: pt(style.fontSize) });
    }
  });
  const problems = [];
  pages.forEach((page, index) => {
    const box = page.getBoundingClientRect();
    const label = (n) => `${n.tagName}.${String(n.className).slice(0, 30)}:${(n.textContent || '').trim().slice(0, 28)}`;
    const nodes = Array.from(page.querySelectorAll('*')).filter((n) => !['STYLE', 'SCRIPT'].includes(n.tagName) && !(n instanceof SVGElement)
      && n.getBoundingClientRect().width > 0 && Array.from(n.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim()));
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (r.bottom > box.bottom + 1 || r.right > box.right + 1 || r.left < box.left - 1) problems.push(`p${index + 1} outside ${label(n)}`);
    }
    // An inline text's content area may stand out of a tight line box; its line box is what the reader sees.
    const lineBox = (n) => {
      const r = n.getBoundingClientRect();
      if (getComputedStyle(n).display !== 'inline') return r;
      let block = n.parentElement;
      while (block && getComputedStyle(block).display === 'inline') block = block.parentElement;
      const outer = block?.getBoundingClientRect() ?? r;
      return { left: r.left, right: r.right, top: Math.max(r.top, outer.top), bottom: Math.min(r.bottom, outer.bottom) };
    };
    const rects = nodes.map((n) => ({ n, r: lineBox(n) }));
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const x = rects[a], y = rects[b];
      if (x.n.contains(y.n) || y.n.contains(x.n)) continue;
      if (getComputedStyle(x.n).display === 'inline' && getComputedStyle(y.n).display === 'inline') continue;
      const ox = Math.min(x.r.right, y.r.right) - Math.max(x.r.left, y.r.left);
      const oy = Math.min(x.r.bottom, y.r.bottom) - Math.max(x.r.top, y.r.top);
      if (ox > 2 && oy > 2) problems.push(`p${index + 1} overlap ${label(x.n)} / ${label(y.n)}`);
    }
  });
  return { pages: pages.length, roles, heads, others, problems: [...new Set(problems)] };
};

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1300 });
  const measured = {};
  for (const entry of manifest) for (const surface of ['preview', 'pdf']) {
    await window.loadFile(path.join(dir, `${entry.file}-${surface}.html`));
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    await new Promise((done) => setTimeout(done, 60));
    measured[`${entry.file}|${surface}`] = await window.webContents.executeJavaScript(`(${probe.toString()})()`);
  }
  const failures = [];
  let checks = 0;
  const check = (file, name, ok, detail) => { checks++; if (!ok) failures.push({ file, name, detail }); };
  const key = (item) => `${item.kind}:${item.role}`;
  const summary = (items) => {
    const groups = {};
    for (const item of items) (groups[key(item)] ??= new Set()).add(`${item.color} ${item.size}pt ${item.weight} lh ${item.lineRatio}${item.linkColor ? ` link ${item.linkColor}` : ''}`);
    return Object.fromEntries(Object.entries(groups).map(([name, values]) => [name, [...values]]));
  };
  const native = {};
  const roleToken = { 'entry-title': ['entryHeading', 'entryHeadingSizePt'], period: ['date', 'dateSizePt'], organization: ['organization', 'organizationSizePt'],
    location: ['location', 'locationSizePt'], technologies: ['accent', 'projectTechnologiesSizePt'], description: ['paragraph', 'projectDescriptionSizePt'] };
  for (const entry of manifest) {
    const preview = measured[`${entry.file}|preview`];
    const pdf = measured[`${entry.file}|pdf`];
    if (entry.variant === 'native' && !entry.dense) native[`${entry.id}|${entry.ats ? 'ats' : 'vis'}`] = { pdf: summary(pdf.roles), preview: summary(preview.roles) };
    check(entry.file, 'same page count', preview.pages === pdf.pages, [preview.pages, pdf.pages]);
    for (const surface of ['preview', 'pdf']) {
      const result = measured[`${entry.file}|${surface}`];
      check(`${entry.file}|${surface}`, 'no text outside the sheet, no overlap', !result.problems.length, result.problems.slice(0, 6));
    }
    // Preview = PDF for every role text (in reading order: the same texts carry the same look).
    const pdfByText = new Map(pdf.roles.map((item) => [`${key(item)}|${item.text}`, item]));
    for (const item of preview.roles) {
      const twin = pdfByText.get(`${key(item)}|${item.text}`);
      if (!twin) continue;
      check(entry.file, `preview = pdf ${key(item)}`, twin.color === item.color && Math.abs(twin.size - item.size) <= 0.1 && twin.weight === item.weight,
        { text: item.text, preview: [item.color, item.size, item.weight], pdf: [twin.color, twin.size, twin.weight] });
    }
    if (!entry.overrides) continue;
    // Every overridden role reaches every text of that role on both surfaces.
    for (const surface of ['preview', 'pdf']) {
      const result = measured[`${entry.file}|${surface}`];
      for (const item of result.roles) {
        const [colorKey, sizeKey] = roleToken[item.role];
        const color = entry.overrides.colors?.[colorKey];
        const size = entry.overrides.typography?.[sizeKey];
        if (color) check(`${entry.file}|${surface}`, `${key(item)} colour`, item.color === color.toUpperCase(), { text: item.text, got: item.color, want: color });
        if (size !== undefined) check(`${entry.file}|${surface}`, `${key(item)} size`, Math.abs(item.size - size) <= 0.05, { text: item.text, got: item.size, want: size });
      }
      // Changing Hervorhebungsfarbe leaves every organisation at its own resolved native colour.
      if (entry.variant === 'accent') for (const item of result.roles) {
        if (item.role !== 'organization' || !['experience', 'education'].includes(item.kind)) continue;
        check(`${entry.file}|${surface}`, `${key(item)} independent colour`, item.color === entry.colors.organization.toUpperCase(), { text: item.text, got: item.color, want: entry.colors.organization });
      }
      const base = measured[`${entry.file.replace(entry.variant, 'native')}|${surface}`];
      // One role changed: every other role keeps its native colour and size.
      const single = { date: 'period', organization: 'organization', location: 'location', technologies: 'technologies', description: 'description' }[entry.variant];
      if (single && base && base.pages === result.pages) {
        const before = new Map(base.roles.map((item) => [`${key(item)}|${item.page}|${item.text}`, item]));
        for (const item of result.roles) {
          const was = before.get(`${key(item)}|${item.page}|${item.text}`);
          if (was && item.role !== single) check(`${entry.file}|${surface}`, `other role unchanged ${key(item)}`, was.color === item.color && was.size === item.size,
            { text: item.text, before: [was.color, was.size], after: [item.color, item.size] });
        }
      }
      // Texts without a role keep the native look while only roles change.
      if (['roles', 'date', 'organization', 'location', 'technologies', 'description'].includes(entry.variant) && base && base.pages === result.pages) {
        const byText = new Map(base.others.map((item) => [`${item.page}|${item.tag}|${item.text}`, item]));
        for (const item of result.others) {
          const before = byText.get(`${item.page}|${item.tag}|${item.text}`);
          if (before) check(`${entry.file}|${surface}`, `other text unchanged ${item.tag}`, before.color === item.color && before.size === item.size,
            { text: item.text, before: [before.color, before.size], after: [item.color, item.size] });
        }
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'native.json'), JSON.stringify(native, null, 2));
  fs.writeFileSync(path.join(dir, 'failures.json'), JSON.stringify(failures, null, 2));
  fs.writeFileSync(path.join(dir, 'measured.json'), JSON.stringify(Object.fromEntries(Object.entries(measured).map(([name, value]) => [name, { pages: value.pages, heads: value.heads }]))));
  const grouped = {};
  for (const failure of failures) (grouped[`${failure.name}`] ??= []).push(failure);
  console.log(JSON.stringify({ fixtures: manifest.length, checks, failures: failures.length,
    byCheck: Object.fromEntries(Object.entries(grouped).map(([name, list]) => [name, { count: list.length, first: list.slice(0, 3) }])) }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch((error) => { console.error(error); app.exit(1); });
