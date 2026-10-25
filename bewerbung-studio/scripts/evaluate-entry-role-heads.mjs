import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Compares the planner's entry-role model with Chromium: for every entry of tmp/entry-role-qa (after check-entry-role-qa.cjs)
// the measured change of its height against the native fixture, and what the planner adds for it. A model that adds less than
// the page grows lets text run under the footer; one that adds much more leaves pages emptier than needed.
//   node scripts/evaluate-entry-role-heads.mjs [variant=large] [surface=pdf] [vis|ats]
const [variant = 'large', surface = 'pdf', mode = 'vis'] = process.argv.slice(2);
const dir = resolve('tmp/entry-role-qa');
const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8'));
const measured = JSON.parse(await readFile(resolve(dir, 'measured.json'), 'utf8'));
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { middlewareMode: true } });
try {
  const rows = [];
  for (const entry of manifest.filter((item) => item.variant === variant && item.ats === (mode === 'ats'))) {
    const base = manifest.find((item) => item.id === entry.id && item.variant === 'native' && item.dense === entry.dense && item.ats === entry.ats);
    const now = measured[`${entry.file}|${surface}`]?.heads ?? [];
    const before = measured[`${base.file}|${surface}`]?.heads ?? [];
    for (const kind of ['experience', 'education', 'projects', 'interests']) {
      const a = before.filter((head) => head.kind === kind);
      const b = now.filter((head) => head.kind === kind);
      if (!a.length || a.length !== b.length) continue;
      const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
      const planned = (item) => (item.planned ?? []).filter((part) => part.kind === kind).reduce((total, part) => total + part.weight, 0);
      rows.push({ id: entry.id, dense: entry.dense, kind, n: a.length, head: +(sum(b, 'head') - sum(a, 'head')).toFixed(2), height: +(sum(b, 'height') - sum(a, 'height')).toFixed(2),
        plan: ['experience', 'education'].includes(kind) ? +(planned(entry) - planned(base)).toFixed(2) : null });
    }
  }
  for (const row of rows) console.log(`${row.id.padEnd(20)} ${row.dense ? 'dense' : '     '} ${row.kind.padEnd(10)} n=${row.n} Δhead=${row.head} Δheight=${row.height}${row.plan === null ? '' : ` Δplan=${row.plan} short=${(row.height - row.plan).toFixed(2)}`}`);
} finally { await vite.close(); }
