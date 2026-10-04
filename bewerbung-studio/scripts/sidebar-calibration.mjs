// Sidebar item calibration (see `items` in src/shared/resumePaginationGeometry.ts): probe résumés whose Stärken / Besondere
// Kenntnisse stand in the sidebar, written as PDF HTML into tmp/sidebar-calib. Measure and fit with
// check-sidebar-calibration.cjs (real Chromium).
//   node scripts/sidebar-calibration.mjs <templateId>
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/sidebar-calib');
await mkdir(out, { recursive: true });
const templateId = process.argv[2] ?? 'zeitgenoessisch';
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { getManagerSections } = await vite.ssrLoadModule('/src/features/resume-sections/resume-manager.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const now = new Date().toISOString();
  const uid = (n) => `9c000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const template = templates.find((entry) => entry.id === templateId);
  const words = 'Prozess Analyse Planung Steuerung Qualität Fertigung Digitalisierung Koordination Dokumentation Betrieb Auswertung Schnittstelle Wartung Beratung Schulung Abstimmung Optimierung Messtechnik Instandhaltung Logistik'.split(' ');
  const text = (length, seed) => {
    let value = '';
    let index = seed;
    while (value.length < length) { value += (value ? ' ' : '') + words[index % words.length]; index += 7; }
    return value.slice(0, length).replace(/\s+\S*$/, (tail) => (tail.length < 3 ? '' : tail)).trim() || words[seed % words.length];
  };
  const base = {
    id: uid(1), isDefault: true, updatedAt: now, firstName: 'Mina', lastName: 'Kaya', title: 'Ingenieurin',
    phone: '+49 170 12345678', email: 'mina.kaya@example.com', summary: 'Kurzprofil.',
    experiences: [{ id: uid(200), from: '01/2020', to: '01/2022', role: 'Ingenieurin', company: 'Beispiel AG', city: 'Musterstadt', tasks: ['Aufgabe'], achievements: [] }],
    education: [{ id: uid(300), from: '2016', to: '2019', degree: 'Abschluss', institution: 'Schule' }],
    languages: [], certifications: [], strengths: [],
  };
  const lengths = [8, 14, 20, 26, 32, 38, 44, 52, 60, 72, 84, 100];
  const probes = [];
  // Strengths: one title per length (+ a second probe with a description under every title).
  for (const withDescription of [false, true]) {
    probes.push({
      name: `strengths${withDescription ? '-desc' : ''}`, kind: 'strengths',
      profile: { strengths: lengths.map((length, index) => ({ id: uid(10 + index), title: text(length, index), description: withDescription ? text(46 + index * 9, index + 3) : '' })) },
    });
  }
  // Knowledge: three items of one length per probe (the plan hosts such a short list on page one).
  for (const length of [10, 20, 30, 40, 55, 75]) {
    probes.push({
      name: `knowledge-${length}`, kind: 'knowledge',
      profile: {
        knowledgeSection: {
          title: 'Besondere Kenntnisse', isVisible: true,
          categories: [{
            id: uid(50), title: 'IT-Kenntnisse', type: 'it', displayMode: 'comma-separated', showLevels: false, showYearsOfExperience: false, isVisible: true, sortOrder: 0, subcategories: [],
            items: [0, 1, 2].map((index) => ({ id: uid(60 + index), name: text(length, index * 3), level: 'good', yearsOfExperience: 2, lastUsedYear: 2025, description: '', isVisible: true, sortOrder: index })),
          }],
        },
      },
    });
  }
  const manifest = [];
  for (const probe of probes) {
    const input = { ...base, ...probe.profile };
    const first = profileSchema.parse({ ...input, photoPath: photo });
    const arranged = getManagerSections(first, templateId).filter((entry) => !entry.fixed).map((entry) => ({ id: entry.id, zone: entry.id === 'knowledge' || entry.id === 'strengths' ? 'sidebar' : entry.zone }));
    const profile = setResumePhotoVisible(profileSchema.parse({ ...input, photoPath: photo, resumeManagerLayouts: { [templateId]: arranged } }), true);
    const settings = { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: 'visual' };
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
      status: 'Entwurf', templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    await writeFile(resolve(out, `${templateId}-${probe.name}.html`), buildDocumentHtml(application, profile, 'lebenslauf'));
    manifest.push({ file: `${templateId}-${probe.name}`, kind: probe.kind, name: probe.name });
  }
  await writeFile(resolve(out, `${templateId}-manifest.json`), JSON.stringify(manifest));
  console.log('probes', manifest.length);
} catch (error) { console.error(error); process.exitCode = 1; } finally { await vite.close(); process.exit(process.exitCode ?? 0); }
