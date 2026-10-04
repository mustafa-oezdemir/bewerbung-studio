// Measures the real Bewerbungsfoto of every template in the fixtures of scripts/photo-qa.mjs (run it first).
//
//   npx electron scripts/check-photo-qa.cjs            check the three sizes against tmp/photo-qa-baseline.json
//   npx electron scripts/check-photo-qa.cjs baseline   record the native geometry (default size) as the baseline
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve('tmp/photo-qa');
const baselineFile = path.resolve('tmp/photo-qa-baseline.json');
const recordBaseline = process.argv.includes('baseline');
const TOLERANCE_MM = 0.05;

const measure = () => {
  const mm = (px) => Math.round((px / (96 / 25.4)) * 100) / 100;
  const box = (element) => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { x: mm(r.left), y: mm(r.top), w: mm(r.width), h: mm(r.height) };
  };
  const visible = (element) => {
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const page = document.querySelector('.cv-sheet') || document.querySelector('.managed-resume-preview')?.firstElementChild;
  const photos = [...document.querySelectorAll('img')].filter((image) => image.src.startsWith('data:image/png') && visible(image));
  const photo = photos[0] ?? null;
  // The frame is the outermost element that still has the photo's own size (figure, composition, wrapper).
  const decoration = photo
    ? [...(photo.parentElement?.parentElement ?? document).querySelectorAll('[class*="photo-"],[class*="hero"] > i,[class*="hero"] > span,[class*="blueprint"]')]
        .filter((node) => node !== photo && visible(node)).map(box)
    : [];
  const text = [...document.querySelectorAll('header h1, header h2, header address, header .kicker, .pehlione-contacts, aside h2')].filter(visible).map((node) => ({ tag: node.tagName, ...box(node) }));
  const sidebar = photo ? box(photo.parentElement?.closest('aside, [class*="sidebar"], [class*="hero"]')) : null;
  const header = box(document.querySelector('header'));
  // Where the first section of page one starts, in the main column and in a sidebar: what the page planner models.
  const sections = [...document.querySelectorAll('[data-managed-section]')].filter(visible);
  const top = (list) => (list.length ? Math.min(...list.map((node) => box(node).y)) : null);
  const mainTop = top(sections.filter((node) => !node.closest('aside, [class*="sidebar"]')));
  const sideTop = top(sections.filter((node) => node.closest('aside, [class*="sidebar"]')));
  const main = box(document.querySelector('main, [class*="content"], [class*="main"]'));
  return { page: box(page), photo: box(photo), frame: photo ? box(photo.parentElement) : null, photoCount: photos.length, objectFit: photo ? getComputedStyle(photo).objectFit : null,
    radius: photo ? getComputedStyle(photo.parentElement.tagName === 'FIGURE' ? photo.parentElement : photo).borderRadius : null,
    decoration, text, sidebar, header, main, mainTop, sideTop, scale: page ? getComputedStyle(page).getPropertyValue('--resume-photo-scale').trim() : '' };
};

const overlaps = (a, b) => a && b && a.x < b.x + b.w - TOLERANCE_MM && b.x < a.x + a.w - TOLERANCE_MM && a.y < b.y + b.h - TOLERANCE_MM && b.y < a.y + a.h - TOLERANCE_MM;

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1250, webPreferences: { sandbox: true } });
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  const results = {};
  for (const fixture of manifest) {
    await window.loadFile(path.join(out, `${fixture.file}.html`));
    results[fixture.file] = { ...fixture, ...(await window.webContents.executeJavaScript(`(${measure.toString()})()`)) };
  }
  if (recordBaseline) {
    fs.writeFileSync(baselineFile, JSON.stringify(results, null, 1));
    const rows = Object.values(results).filter((r) => !r.ats).map((r) => `${r.id.padEnd(20)} ${r.surface.padEnd(8)} photo ${r.photo ? `${r.photo.w}x${r.photo.h}` : '—'}`);
    console.log(rows.join('\n'));
    window.destroy(); app.exit(0); return;
  }

  const growthTable = JSON.parse(fs.readFileSync(path.join(out, 'growth.json'), 'utf8'));
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : {};
  const failures = [];
  const summary = [];
  const templates = [...new Set(manifest.map((fixture) => fixture.id))];
  for (const id of templates) for (const surface of ['preview', 'pdf']) {
    const small = results[`${id}-visual-${surface}-small`];
    const medium = results[`${id}-visual-${surface}-medium`];
    const large = results[`${id}-visual-${surface}-large`];
    const native = baseline[`${id}-visual-${surface}-medium`];
    const label = `${id} ${surface}`;
    const grow = (key) => (large[key] !== null && medium[key] !== null ? Math.round((large[key] - medium[key]) * 100) / 100 : '—');
    const shrink = (key) => (small[key] !== null && medium[key] !== null ? Math.round((small[key] - medium[key]) * 100) / 100 : '—');
    summary.push(`${label.padEnd(30)} ${[small, medium, large].map((r) => (r.photo ? `${r.photo.w}x${r.photo.h}` : '—').padEnd(11)).join(' ')} first section top: main ${shrink('mainTop')}/${grow('mainTop')}  side ${shrink('sideTop')}/${grow('sideTop')} ${medium.photo ? '' : '(no photo)'}`);
    if (!medium.photo) {
      // A template without a photo stays without one at every size.
      if (small.photo || large.photo) failures.push({ label, error: 'photo appears for a template that shows none' });
      continue;
    }
    // Mittel is the template's own native photo: same box, frame and decorations as before the feature.
    if (native && native.photo) {
      // (The old baseline measured the preview "sidebar" of Pehlione as the photo itself: not comparable.)
      for (const key of ['photo', 'frame', 'header', 'sidebar']) for (const axis of ['x', 'y', 'w', 'h'])
        if (native[key] && !(key === 'sidebar' && native.sidebar.w === native.photo.w && native.sidebar.h === native.photo.h) && Math.abs(native[key][axis] - medium[key][axis]) > TOLERANCE_MM) failures.push({ label, error: `medium ${key}.${axis} ${medium[key][axis]} differs from native ${native[key][axis]}` });
      if (JSON.stringify(native.decoration) !== JSON.stringify(medium.decoration)) failures.push({ label, error: 'medium decoration geometry differs from native' });
      if (medium.scale && medium.scale !== '1') failures.push({ label, error: `medium sets a photo scale (${medium.scale})` });
    }
    if (!(small.photo.w < medium.photo.w - TOLERANCE_MM && medium.photo.w < large.photo.w - TOLERANCE_MM)) failures.push({ label, error: `widths not small < medium < large: ${small.photo.w} ${medium.photo.w} ${large.photo.w}` });
    if (!(small.photo.h < medium.photo.h - TOLERANCE_MM && medium.photo.h < large.photo.h - TOLERANCE_MM)) failures.push({ label, error: `heights not small < medium < large: ${small.photo.h} ${medium.photo.h} ${large.photo.h}` });
    // The page planner reserves the growth of "Groß": the first sections may not move further than that.
    const reserved = growthTable[id] ?? { main: 0, side: 0 };
    for (const [key, limit] of [['mainTop', reserved.main], ['sideTop', reserved.side]])
      if (large[key] !== null && medium[key] !== null && large[key] - medium[key] > limit + 0.15)
        failures.push({ label, error: `${key} grows ${Math.round((large[key] - medium[key]) * 100) / 100} mm at "Groß", the planner reserves ${limit} mm` });
    for (const result of [small, medium, large]) {
      const where = `${label} ${result.size}`;
      const ratio = result.photo.w / result.photo.h;
      const nativeRatio = medium.photo.w / medium.photo.h;
      if (Math.abs(ratio - nativeRatio) > 0.01) failures.push({ label: where, error: `aspect ratio ${ratio.toFixed(3)} differs from ${nativeRatio.toFixed(3)}` });
      if (result.objectFit !== medium.objectFit || result.radius !== medium.radius) failures.push({ label: where, error: `shape/crop changed (${result.objectFit} ${result.radius})` });
      const { photo, page } = result;
      if (photo.x < page.x - TOLERANCE_MM || photo.y < page.y - TOLERANCE_MM || photo.x + photo.w > page.x + page.w + TOLERANCE_MM || photo.y + photo.h > page.y + page.h + TOLERANCE_MM)
        failures.push({ label: where, error: 'photo leaves the page' });
      if (result.sidebar && !result.sidebar.hero && (photo.x < result.sidebar.x - TOLERANCE_MM || photo.x + photo.w > result.sidebar.x + result.sidebar.w + TOLERANCE_MM))
        failures.push({ label: where, error: 'photo leaves its sidebar' });
      for (const text of result.text) if (overlaps(photo, text) && !(native && native.text && native.text.some((item) => overlaps(native.photo, item) && item.tag === text.tag)))
        failures.push({ label: where, error: `photo covers ${text.tag} (${text.x},${text.y} ${text.w}x${text.h})` });
    }
  }
  // The plain (ATS) layout shows no photo at any size.
  for (const fixture of manifest.filter((item) => item.ats)) {
    if (results[fixture.file].photo) failures.push({ label: fixture.file, error: 'ATS layout shows a photo' });
  }
  console.log(summary.join('\n'));
  console.log(JSON.stringify({ checked: summary.length, failures }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch((error) => { console.error(error); app.exit(1); });
