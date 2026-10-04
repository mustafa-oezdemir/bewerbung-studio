// Compares the planner's height of every career entry (weights of tmp/education-calibration/*-plan.json) with the real
// height Chromium drew (measure.json of check-education-calibration.cjs): node scripts/evaluate-education-calibration.mjs
import { readFile } from 'node:fs/promises';
const dir = 'tmp/education-calibration';
const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
const measured = JSON.parse(await readFile(`${dir}/measure.json`, 'utf8'));
const by = Object.fromEntries(measured.map((row) => [row.file, row]));
const stats = { education: [], experience: [] };
for (const { file } of manifest) {
  const plan = JSON.parse(await readFile(`${dir}/${file}-plan.json`, 'utf8'));
  const pages = by[file].pages;
  plan.forEach((page, index) => {
    for (const kind of ['education', 'experience']) {
      const planned = page.items.filter((item) => item.kind === kind);
      const real = pages[index]?.[kind] ?? [];
      if (planned.length !== real.length) { console.log(`${file} p${index + 1} ${kind}: ${planned.length} planned, ${real.length} drawn`); continue; }
      planned.forEach((item, position) => stats[kind].push({ file, page: index + 1, planned: item.weight, real: real[position].height, text: real[position].text, split: Boolean(item.bullets) }));
    }
  });
}
for (const kind of ['education', 'experience']) {
  const list = stats[kind];
  if (!list.length) continue;
  const diff = list.map((x) => x.planned - x.real);
  const under = list.filter((x) => x.planned < x.real - 0.3);
  console.log(`${kind}: ${list.length} entries; planned - real: mean ${(diff.reduce((a, b) => a + b, 0) / diff.length).toFixed(2)} mm, min ${Math.min(...diff).toFixed(2)}, max ${Math.max(...diff).toFixed(2)}; under-estimated ${under.length} (worst ${under.length ? Math.min(...under.map((x) => x.planned - x.real)).toFixed(2) : 0})`);
  const bucket = {};
  for (const x of list) { const key = Math.floor(x.real / 15) * 15; (bucket[key] ??= []).push(x.planned - x.real); }
  console.log('  by real height: ' + Object.entries(bucket).map(([k, v]) => `${k}-${+k + 15}mm: ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)} (n${v.length})`).join(' | '));
}
