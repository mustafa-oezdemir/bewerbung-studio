import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const out = resolve('tmp/section-inheritance-qa');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { createResumePagePlan } = await vite.ssrLoadModule('/src/shared/documentPagination.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { resumeSectionStyleSources } = await vite.ssrLoadModule('/src/shared/resumeSectionStyleInheritance.ts');
  const now = new Date().toISOString();
  const uuid = () => crypto.randomUUID();
  const profile = profileSchema.parse({ id: uuid(), isDefault: true, firstName: 'Mina', lastName: 'Kaya', updatedAt: now,
    title: 'Softwareentwicklerin', city: 'Berlin', email: 'mina@example.com', summary: 'Entwicklung barrierefreier Anwendungen.',
    experiences: [{ id: uuid(), from: '2023', to: '2025', role: 'Softwareentwicklerin', company: 'Beispiel GmbH', city: 'Berlin', achievements: ['Anwendungen entwickelt.'] }],
    education: [{ id: uuid(), from: '2020', to: '2023', degree: 'Fachinformatikerin', institution: 'Bildungsinstitut' }],
    specialSections: [ { id: uuid(), kind: 'custom', title: 'Eigene Projekte', contentType: 'entries', entries: [{ id: uuid(), title: 'Fachinformatiker für Anwendungsentwicklung', subtitle: 'IAD GmbH', date: '07/2023 – 11/2025', description: 'Ein eigener Abschnitt mit denselben semantischen Stilen.' }] }, { id: uuid(), kind: 'custom', title: 'Hobbys & Interessen', contentType: 'text', entries: [{ id: uuid(), title: 'Wandern und Fotografie' }] } ] });
  const names = { einspaltig: 'Einspaltig', 'ivy-league': 'IvyLeague', zeitgenoessisch: 'Zeitgenoessisch' };
  const manifest = [];
  for (const template of templates) {
    const id = template.id;
    const dir = id.startsWith('pehlione_') ? 'pehlione' : id;
    const name = id.startsWith('pehlione_') ? 'Pehlione' : names[id] ?? id[0].toUpperCase() + id.slice(1);
    const component = (await vite.ssrLoadModule(`/src/components/resume/templates/${dir}/index.ts`))[`${name}Resume`];
    for (const atsMode of [false, true]) {
      const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: atsMode ? 'ats' : 'visual' };
      const application = applicationSchema.parse({ schemaVersion: 1, id: uuid(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' }, status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
      const plan = createResumePagePlan(profile, profile.summary, settings, id)[0];
      const child = h(component, { profile, templateId: id, name: 'Mina Kaya', atsMode, plan, totalPages: 1, accentColor: template.accent, secondaryColor: template.secondary, photoSource: null, resumeProfile: profile.summary, sections: profile.resumeSections, backgroundId: 'white' });
      const preview = renderToStaticMarkup(h(ManagedResumePreview, { profile, templateId: id, pageNumber: 1, totalPages: 1, designSettings: settings }, child));
      for (const [surface, html] of [['preview', `<!doctype html><html><head><meta charset="utf-8"><style>${await readFile('src/app.css', 'utf8')}${resumeTemplateStyleSources[id]} body{margin:0;background:white}.managed-resume-preview{width:210mm}</style></head><body>${preview}</body></html>`], ['pdf', buildDocumentHtml(application, profile, 'lebenslauf')]]) {
        const file = `${id}-${atsMode ? 'ats' : 'visual'}-${surface}`;
        await writeFile(resolve(out, file + '.html'), html);
        manifest.push({ file, id, surface, sources: resumeSectionStyleSources[surface][id].map((source, i) => id === 'tabellarisch' && atsMode && i === 4 ? (surface === 'preview' ? '.tabellarisch-timeline-entry__ats-meta' : '.tabellarisch-pdf-ats-meta') : source) });
      }
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Created ${manifest.length} QA fixtures in ${out}`);
} finally { await vite.close(); }
