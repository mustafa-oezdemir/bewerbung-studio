// Compares the page planner's language block height (src/shared/languageBlockHeight.ts) with what Chromium drew
// (tmp/language-qa/report.json from scripts/check-language-height-qa.cjs) for every template and checkbox combination.
//   node scripts/language-height-qa.mjs && npx electron scripts/check-language-height-qa.cjs && node scripts/language-height-compare.mjs [template…]
// Exit code 1 when the planner under-estimates a block by more than 0.5 mm.
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const only = process.argv.slice(2);
const report = JSON.parse(await readFile('tmp/language-qa/report.json', 'utf8'));
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { resolveLanguagePresentation } = await vite.ssrLoadModule('/src/features/languages/language-levels.ts');
  const { languageBlockHeight } = await vite.ssrLoadModule('/src/shared/languageBlockHeight.ts');
  const allLanguages = ['Deutsch – C1', 'Englisch – B2', 'Türkisch – C2', 'Französisch – A2', 'Spanisch – B1', 'Italienisch – C1'];
  const displays = {
    'dots-level-desc': { dots: true, level: true, description: true }, 'dots-level': { dots: true, level: true, description: false },
    'dots-desc': { dots: true, level: false, description: true }, dots: { dots: true, level: false, description: false },
    'text-level-desc': { dots: false, level: true, description: true }, 'text-level': { dots: false, level: true, description: false },
    'text-desc': { dots: false, level: false, description: true }, 'text-none': { dots: false, level: false, description: false },
  };
  let under = 0;
  let over = 0;
  let worstUnder = 0;
  let worstOver = 0;
  let checked = 0;
  const perTemplate = {};
  for (const row of report) {
    if (row.ats || !row.pages[0] || (only.length && !only.includes(row.template))) continue;
    let from = 0;
    for (const page of row.pages) {
      const rows = allLanguages.slice(from, from + page.languageCount)
        .map((raw) => resolveLanguagePresentation(raw, displays[row.combo], { dots: true }));
      from += page.languageCount;
      // The planner passes the actual column and resolved grid count. A continuation page measures only its own rows.
      const planned = languageBlockHeight(row.template, rows, {
        column: page.width, columns: page.columns, zone: page.zone, font: 1, textHeight: 1,
      });
      const diff = Math.round((planned - page.height) * 100) / 100;
      checked += 1;
      if (diff < -0.5) { under += 1; console.log(`UNDER ${row.file}/p${page.page}: planned ${planned.toFixed(2)} drawn ${page.height} (${diff})`); }
      if (diff > 3.5) { over += 1; console.log(`OVER ${row.file}/p${page.page}: planned ${planned.toFixed(2)} drawn ${page.height} (+${diff})`); }
      worstUnder = Math.min(worstUnder, diff);
      worstOver = Math.max(worstOver, diff);
      const entry = (perTemplate[row.template] ??= { min: 0, max: 0 });
      entry.min = Math.min(entry.min, diff);
      entry.max = Math.max(entry.max, diff);
    }
    if (from !== row.count) throw new Error(`${row.file}: measured ${from} languages of ${row.count}`);
  }
  for (const [template, entry] of Object.entries(perTemplate)) console.log(`${template.padEnd(22)} planned − drawn: ${entry.min} … +${entry.max} mm`);
  console.log(`${checked} blocks, ${under} under-estimated (>0.5 mm), ${over} over-estimated (>3.5 mm), worst ${worstUnder} / +${worstOver} mm`);
  process.exitCode = under ? 1 : 0;
} finally { await vite.close(); process.exit(process.exitCode ?? 0); }
