// Zweispaltig career-entry calibration: seeded random résumés (one short experience + three education entries with a
// random title, institution, field, grade and description) as PDF HTML into tmp/education-calibration, with the page plan.
// Measure with check-education-calibration.cjs (the real height of every entry on its page), then compare with the planner:
//   node scripts/education-calibration.mjs            (env: RANDOM=<n> résumés, SEED=<n>, TEMPLATE=<id>, KIND=experience for the experience entries)
//   npx electron scripts/check-education-calibration.cjs
//   node scripts/evaluate-education-calibration.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/education-calibration');
await mkdir(out, { recursive: true });
const templateId = process.env.TEMPLATE || 'zweispaltig';
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { getTemplate } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const now = '2026-10-03T10:00:00.000Z';
  let seed = Number(process.env.SEED || 5);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const words = 'Ausbildung Anwendungsentwicklung Programmierung Datenbanken Netzwerke Prozessplanung Qualitätssicherung Industrieingenieurwesen Produktionssteuerung Zusammenarbeit strukturierte Bearbeitung praktische Umsetzung technischer Anforderungen erfolgreich bestandene Abschlussprüfung Schwerpunkt Projektarbeit Fachbereiche Verantwortung Dokumentation'.split(' ');
  const text = (chars) => { let t = ''; while (t.length < chars) t += (t ? ' ' : '') + pick(words); return t; };
  const sentence = (chars) => `${text(chars)[0].toUpperCase()}${text(chars).slice(1)}.`;
  const uid = (n) => `9f000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const manifest = [];
  const total = Number(process.env.RANDOM || 40);
  for (let i = 0; i < total; i += 1) {
    const education = Array.from({ length: 3 }, (_, index) => {
      const sentences = int(0, 4);
      return {
        id: uid(30 + index), from: `${2000 + index}`, to: `${2003 + index}`, degree: text(int(20, 75)), institution: text(int(10, 50)), city: pick(['Marburg', 'Musterstadt', '']), country: pick(['Deutschland', '']),
        fieldOfStudy: pick(['', text(int(10, 40))]), grade: pick(['', '2,3', '1,7']),
        description: Array.from({ length: sentences }, () => sentence(int(60, 230))).join(' '),
      };
    });
    const profile = profileSchema.parse({
      id: uid(1), isDefault: true, updatedAt: now, firstName: 'Mina', lastName: 'Kaya', title: 'Ingenieurin', city: 'Musterstadt', email: 'mina@example.com', phone: '+49 170 12345678',
      summary: 'Kurzprofil.', strengths: [{ id: uid(2), title: 'Teamarbeit', description: '' }], languages: ['Deutsch – C1'],
      experiences: process.env.KIND === 'experience'
        ? Array.from({ length: 3 }, (_, index) => ({ id: uid(10 + index), from: `${2010 + index}`, to: `${2012 + index}`, role: text(int(15, 60)), company: text(int(10, 40)), city: pick(['Marburg', '']), tasks: [], achievements: Array.from({ length: int(0, 8) }, () => text(int(30, 240))) }))
        : [{ id: uid(10), from: '2015', to: '2017', role: 'Praktikum', company: 'Beispiel AG', city: 'Musterstadt', tasks: [], achievements: ['Ein Ergebnis'] }],
      education: process.env.KIND === 'experience' ? [] : education,
      resumePersonalFieldVisibility: { address: true, phone: true, email: true, linkedin: true, github: true, website: true, onlineProfiles: true, birthDate: false, birthPlace: false, nationality: false, familyStatus: false, children: false, drivingLicense: false, xing: false },
    });
    const template = getTemplate(templateId);
    const settings = { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: 'visual' };
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
      status: 'Entwurf', templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    const resolved = resolveCvDocument({ profile, templateId, settings, application });
    const file = `edu-${String(i).padStart(3, '0')}`;
    await writeFile(resolve(out, `${file}.html`), buildDocumentHtml(application, profile, 'lebenslauf'));
    await writeFile(resolve(out, `${file}-plan.json`), JSON.stringify(resolved.pagePlan));
    await writeFile(resolve(out, `${file}-profile.json`), JSON.stringify(profile.education));
    manifest.push({ file });
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log('fixtures', manifest.length);
} finally { await vite.close(); }
