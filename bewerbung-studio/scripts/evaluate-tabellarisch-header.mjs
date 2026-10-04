// Compares the Tabellarisch header model (src/shared/resumeHeaderGeometry.ts) with the real Chromium measurement of
// tmp/tabellarisch-header-calib (scripts/tabellarisch-header-calibration.mjs + check-tabellarisch-header-calibration.cjs):
//   node scripts/evaluate-tabellarisch-header.mjs
// Reports, for every header, the estimate of the first-section top against the measured one (never below it), and
// whether the model puts every contact in the cell and row the browser drew.
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
  const { estimateResumeHeaderTop, getTabellarischHeaderContacts, tabellarischContactRows } = await vite.ssrLoadModule('/src/shared/resumeHeaderGeometry.ts');
  const { profileSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { getResumeDisplayProfile } = await vite.ssrLoadModule('/src/shared/resumeDisplayProfile.ts');
  const dir = 'tmp/tabellarisch-header-calib';
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
  const measured = JSON.parse(await readFile(`${dir}/measure.json`, 'utf8'));
  const by = Object.fromEntries(measured.map((row) => [row.file, row]));
  let under = 0, worstUnder = 0, over = 0, worstOver = 0, rowMismatch = 0, count = 0, sumOver = 0;
  const problems = [];
  for (const entry of manifest) {
    const real = by[entry.file];
    const profile = profileSchema.parse({
      id: '9e000000-0000-4000-8000-000000000001', isDefault: true, updatedAt: '2026-10-03T10:00:00.000Z', ...entry.fields, photoPath: '',
      resumePersonalFieldVisibility: entry.visibility,
    });
    const display = getResumeDisplayProfile(profile);
    const raw = estimateResumeHeaderTop('tabellarisch', display, 'main', 0, true, entry.photo) - 1; // minus the margin
    const diff = raw - real.firstSection;
    count += 1; sumOver += Math.max(0, diff);
    if (diff < -0.05) { under += 1; worstUnder = Math.min(worstUnder, diff); problems.push(`${entry.file}: estimate ${raw.toFixed(2)} < measured ${real.firstSection} (${diff.toFixed(2)})`); }
    if (diff > 0.05) { over += 1; worstOver = Math.max(worstOver, diff); if (diff > 1.5) problems.push(`${entry.file}: estimate ${raw.toFixed(2)} > measured ${real.firstSection} (+${diff.toFixed(2)})`); }
    // the rows the model puts the contacts in against the rows of the browser
    const rows = tabellarischContactRows(getTabellarischHeaderContacts(display));
    if (rows.length !== real.rows) { rowMismatch += 1; problems.push(`${entry.file}: model ${rows.length} rows, browser ${real.rows}`); }
  }
  console.log(`${count} headers: ${under} under-estimated (worst ${worstUnder.toFixed(2)} mm), ${over} over-estimated (worst ${worstOver.toFixed(2)} mm, mean over ${(sumOver / count).toFixed(2)} mm), ${rowMismatch} row-count mismatches`);
  for (const line of problems.slice(0, 40)) console.log('  ' + line);
} finally { await vite.close(); }
