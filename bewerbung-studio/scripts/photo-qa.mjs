// Renders every Lebenslauf template with a Bewerbungsfoto (preview and PDF HTML, three sizes) into tmp/photo-qa.
// scripts/check-photo-qa.cjs measures the real photo boxes of these files in Electron.
//
//   node scripts/photo-qa.mjs [baseline]
//
// "baseline" writes only the default size: use it before touching photo CSS to record the native geometry.
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { createServer } from 'vite';

const out = resolve('tmp/photo-qa');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const baseline = process.argv.includes('baseline');

// A small non-square PNG (portrait 3:4) so that cropping and aspect ratio are visible in the measurements.
const png = (width, height) => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4); check.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) { row[1 + x * 3] = (x * 255 / width) | 0; row[2 + x * 3] = (y * 255 / height) | 0; row[3 + x * 3] = 150; }
    rows.push(row);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
};
const photo = `data:image/png;base64,${png(60, 80).toString('base64')}`;

const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const now = new Date().toISOString();
  const uuid = () => crypto.randomUUID();
  const names = { einspaltig: 'Einspaltig', 'ivy-league': 'IvyLeague', zeitgenoessisch: 'Zeitgenoessisch' };
  const sizes = baseline ? ['medium'] : ['small', 'medium', 'large'];
  const manifest = [];
  for (const template of templates) {
    const id = template.id;
    const dir = id.startsWith('pehlione_') ? 'pehlione' : id;
    const name = id.startsWith('pehlione_') ? 'Pehlione' : names[id] ?? id[0].toUpperCase() + id.slice(1);
    const component = (await vite.ssrLoadModule(`/src/components/resume/templates/${dir}/index.ts`))[`${name}Resume`];
    for (const size of sizes) {
      const profile = profileSchema.parse({
        id: uuid(), isDefault: true, firstName: 'Mustafa', lastName: 'Özdemir', title: 'Fachinformatiker für Anwendungsentwicklung',
        street: 'Musterstraße 10', postalCode: '12345', city: 'Stuttgart', country: 'Deutschland', phone: '+49 170 1234567', email: 'mustafa@example.com',
        linkedin: 'linkedin.com/in/test', github: 'github.com/test', photoPath: photo, updatedAt: now,
        summary: 'Entwicklung barrierefreier Anwendungen mit Schwerpunkt auf verlässlichen Abläufen.',
        skills: ['TypeScript', 'React', 'Node.js'], languages: ['Deutsch – C1', 'Englisch – B2'],
        strengths: [{ id: uuid(), title: 'Analytisches Denken' }],
        experiences: [{ id: uuid(), from: '2023', to: '2025', role: 'Softwareentwickler', company: 'Beispiel GmbH', city: 'Berlin', achievements: ['Anwendungen entwickelt.'] }],
        education: [{ id: uuid(), from: '2020', to: '2023', degree: 'Fachinformatiker', institution: 'Bildungsinstitut' }],
        resumeSemanticSections: [{ semanticType: 'photo', customTitle: '', visible: true, enabled: true, order: 2 }],
        ...(baseline ? {} : { resumePhotoSize: size }),
      });
      for (const atsMode of [false, true]) {
        const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: atsMode ? 'ats' : 'visual' };
        const application = applicationSchema.parse({ schemaVersion: 1, id: uuid(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' }, status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
        const resolved = resolveCvDocument({ profile, templateId: id, settings, resumeProfile: profile.summary });
        const plan = resolved.pagePlan[0];
        const child = h(component, { profile: resolved.profile, templateId: id, name: 'Mustafa Özdemir', atsMode, plan, totalPages: 1, accentColor: template.accent, secondaryColor: template.secondary, photoSource: resolved.profile?.photoPath || null, resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: 'white' });
        const preview = renderToStaticMarkup(h(ManagedResumePreview, { designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId: id, pageNumber: 1, totalPages: 1 }, child));
        const css = `${await readFile('src/app.css', 'utf8')}${resumeTemplateStyleSources[id]}`;
        for (const [surface, html] of [['preview', `<!doctype html><html><head><meta charset="utf-8"><style>${css} body{margin:0;background:white}.managed-resume-preview{width:210mm}</style></head><body>${preview}</body></html>`], ['pdf', buildDocumentHtml(application, profile, 'lebenslauf')]]) {
          const file = `${id}-${atsMode ? 'ats' : 'visual'}-${surface}-${size}`;
          await writeFile(resolve(out, `${file}.html`), html);
          manifest.push({ file, id, surface, size, ats: atsMode });
        }
      }
    }
  }
  // The planner's growth table: check-photo-qa.cjs fails when a real layout moves further than the table says.
  const { resumePhotoLargeGrowthMm } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  await writeFile(resolve(out, 'growth.json'), JSON.stringify(resumePhotoLargeGrowthMm));
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Created ${manifest.length} photo QA fixtures in ${out}`);
} finally { await vite.close(); }
