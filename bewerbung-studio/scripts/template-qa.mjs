import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
// Template QA: every active Lebenslauf template × scenarios (maximal, long, minimal, RANDOM=n seeded random, REAL=<workspace.json>
// read only) as PDF HTML and preview HTML in tmp/template-qa. Check with check-template-qa.cjs (overflow, clipping,
// overlap; PDF via printToPDF) and check-template-parity.cjs (preview vs PDF geometry). ONLY=<id,id> limits the templates.
const out = resolve('tmp/template-qa');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { maximalProfileInput } = await vite.ssrLoadModule('/src/components/resume/__parityFixture.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const { getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const names = { einspaltig: 'Einspaltig', 'ivy-league': 'IvyLeague', zeitgenoessisch: 'Zeitgenoessisch' };
  const componentOf = async (id) => {
    const dir = id.startsWith('pehlione_') ? 'pehlione' : id;
    const name = id.startsWith('pehlione_') ? 'Pehlione' : names[id] ?? id[0].toUpperCase() + id.slice(1);
    return (await vite.ssrLoadModule(`/src/components/resume/templates/${dir}/index.ts`))[`${name}Resume`];
  };
  const now = new Date().toISOString();
  const extraStation = (p, i) => ({
    ...p.experiences[0], id: `9a000000-0000-4000-8000-0000000001${i}0`, isCurrent: false, from: `0${i}/20${15 + i}`, to: `0${i + 1}/20${16 + i}`,
    role: `Softwareentwickler ${i}`, projects: [`Projekt Migration ${i}`], achievements: ['Durchlaufzeit nachweislich verkürzt', 'Fehlerquote deutlich gesenkt'],
    tasks: ['Entwicklung von Schnittstellen und Datenmodellen für interne Plattformen mit hohen Anforderungen an Verfügbarkeit', 'Zusammenarbeit mit mehreren Fachabteilungen bei der Anforderungsanalyse und Priorisierung'],
  });
  const scenarios = {
    max: (p) => ({ ...p, photoPath: photo }),
    long: (p) => ({
      ...p, photoPath: photo, firstName: 'Mustafa-Alexander', lastName: 'Özdemir-Schmidt-Wolkenstein',
      title: 'Senior Softwareentwickler und Fachinformatiker für Anwendungsentwicklung mit Schwerpunkt Plattformen',
      linkedin: 'https://www.linkedin.com/in/mustafa-alexander-oezdemir-schmidt-wolkenstein-1234567890',
      portfolio: 'https://www.mustafa-alexander-oezdemir-portfolio-und-projekte.example.org/projekte/open-source',
      languages: ['Englisch – C1', 'Deutsch – Muttersprache', 'Türkisch – Muttersprache', 'Französisch – Grundkenntnisse in Wort und Schrift', 'Bosnisch-Kroatisch-Serbisch – C1'],
      experiences: [...p.experiences, ...[3, 4, 5, 6].map((i) => extraStation(p, i))],
    }),
    min: () => ({
      id: '9a000000-0000-4000-8000-000000000001', isDefault: true, updatedAt: now, firstName: 'Mina', lastName: 'Kaya',
      experiences: [{ id: '9a000000-0000-4000-8000-000000000010', from: '2020', to: '2022', role: 'Assistentin', company: 'Beispiel AG', achievements: [] }],
    }),
  };
  let seed = Number(process.env.SEED || 11);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const sentence = (n) => Array.from({ length: n }, () => pick(['Entwicklung', 'von', 'Schnittstellen', 'für', 'interne', 'Plattformen', 'mit', 'hohen', 'Anforderungen', 'Abstimmung', 'Fachabteilungen', 'Dokumentation', 'Betrieb'])).join(' ');
  for (let k = 0; k < Number(process.env.RANDOM || 0); k++) {
    scenarios[`rand${k}`] = (p) => {
      const stations = 1 + Math.floor(rnd() * 6);
      return {
        ...p, photoPath: rnd() < 0.8 ? photo : '', title: sentence(2 + Math.floor(rnd() * 10)),
        onlineProfiles: rnd() < 0.5 ? p.onlineProfiles : [],
        resumePersonalFieldVisibility: Object.fromEntries(Object.keys(p.resumePersonalFieldVisibility).map((key) => [key, rnd() < 0.7])),
        experiences: Array.from({ length: stations }, (_, i) => ({ ...p.experiences[i % 2], id: `9a000000-0000-4000-8000-0000000002${String(i).padStart(2, '0')}`,
          tasks: Array.from({ length: Math.floor(rnd() * 5) }, () => sentence(4 + Math.floor(rnd() * 14))),
          achievements: Array.from({ length: Math.floor(rnd() * 4) }, () => sentence(4 + Math.floor(rnd() * 10))) })),
        education: Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, i) => ({ ...p.education[0], id: `9a000000-0000-4000-8000-0000000003${String(i).padStart(2, '0')}`, description: sentence(Math.floor(rnd() * 20)) })),
        languages: ['Englisch – C1', 'Deutsch – Muttersprache', 'Türkisch – Muttersprache', 'Französisch – A2'].slice(0, 1 + Math.floor(rnd() * 4)),
        summary: sentence(10 + Math.floor(rnd() * 50)),
      };
    };
  }
  if (process.env.REAL) {
    // The user's own profiles, read only (never written back).
    const workspace = JSON.parse(await readFile(process.env.REAL, 'utf8'));
    workspace.profiles.forEach((real, index) => { scenarios[`real${index}`] = () => real; });
    for (const key of Object.keys(scenarios)) if (!key.startsWith('real')) delete scenarios[key];
  }
  const manifest = [];
  for (const [name, make] of Object.entries(scenarios)) {
    const parsed = profileSchema.parse(make(maximalProfileInput()));
    const profile = parsed.photoPath && !name.startsWith('real') ? setResumePhotoVisible(parsed, true) : parsed;
    for (const template of templates.filter((candidate) => !process.env.ONLY || process.env.ONLY.split(',').includes(candidate.id))) for (const atsMode of [false, true]) {
      if (name !== 'max' && !name.startsWith('rand') && !name.startsWith('real') && atsMode) continue;
      const id = template.id;
      const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: atsMode ? 'ats' : 'visual',
        ...(process.env.LANGUAGE_COLUMNS ? { languagesColumns: process.env.LANGUAGE_COLUMNS === 'auto' ? 'auto' : Number(process.env.LANGUAGE_COLUMNS) } : {}) };
      const application = applicationSchema.parse({
        schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
        status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
      });
      const file = `${name}-${id}-${atsMode ? 'ats' : 'vis'}`;
      await writeFile(resolve(out, file + '.html'), buildDocumentHtml(application, profile, 'lebenslauf'));
      if (!atsMode) {
        const resolved = resolveCvDocument({ profile, templateId: id, settings, application });
        const component = await componentOf(id);
        const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, { designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId: id, pageNumber: index + 1, totalPages: resolved.pagePlan.length },
          h(component, { profile: resolved.profile, templateId: id, name: `${profile.firstName} ${profile.lastName}`, atsMode: false, plan, totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary,
            photoSource: profile.photoPath && resolved.profile.photoPath ? resolved.profile.photoPath : null, resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: settings.backgroundId, closingDate: resolved.closingDate }))));
        const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
          .map(([key, value]) => `${key}:${value}`).join(';').replaceAll('"', '&quot;');
        const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
        await writeFile(resolve(out, file + '-preview.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[id]} body{margin:0;background:white}</style></head><body>${pages.map(paper).join('')}</body></html>`);
      }
      manifest.push({ file, scenario: name, id, ats: atsMode });
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log('fixtures', manifest.length);
} finally { await vite.close(); }
