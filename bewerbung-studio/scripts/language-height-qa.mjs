// Sprachen height QA (Lebenslauf → Sprachen: Punkte, Niveau, Beschreibung): one PDF HTML per template, checkbox combination
// and number of languages, written into tmp/language-qa. Measure with check-language-height-qa.cjs (real Chromium):
// the languages section of every page, so the page planner's language height can be compared with what is drawn.
//   node scripts/language-height-qa.mjs [templateId…]
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/language-qa');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const only = process.argv.slice(2);
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates, getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeComponents } = await vite.ssrLoadModule('/src/components/resume/__parityHarness.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const now = new Date().toISOString();
  const uid = (n) => `9d000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const allLanguages = ['Deutsch – C1', 'Englisch – B2', 'Türkisch – C2', 'Französisch – A2', 'Spanisch – B1', 'Italienisch – C1'];
  const combos = [
    ['dots-level-desc', { dots: true, level: true, description: true }],
    ['dots-level', { dots: true, level: true, description: false }],
    ['dots-desc', { dots: true, level: false, description: true }],
    ['dots', { dots: true, level: false, description: false }],
    ['text-level-desc', { dots: false, level: true, description: true }],
    ['text-level', { dots: false, level: true, description: false }],
    ['text-desc', { dots: false, level: false, description: true }],
    ['text-none', { dots: false, level: false, description: false }],
  ];
  const manifest = [];
  for (const template of templates.filter((entry) => !only.length || only.includes(entry.id))) {
    for (const [combo, display] of combos) {
      for (const count of [1, 4, 6]) {
        const input = {
          id: uid(1), isDefault: true, updatedAt: now, firstName: 'Mina', lastName: 'Kaya', title: 'Ingenieurin',
          phone: '+49 170 12345678', email: 'mina.kaya@example.com', summary: 'Kurzprofil.',
          experiences: [{ id: uid(200), from: '01/2020', to: '01/2022', role: 'Ingenieurin', company: 'Beispiel AG', city: 'Musterstadt', tasks: ['Aufgabe'], achievements: [] }],
          education: [{ id: uid(300), from: '2016', to: '2019', degree: 'Abschluss', institution: 'Schule' }],
          certifications: [], strengths: [], languages: allLanguages.slice(0, count), resumeLanguageDisplay: display, photoPath: photo,
        };
        const profile = setResumePhotoVisible(profileSchema.parse(input), true);
        for (const ats of [false, true]) {
          if (ats && count !== 4) continue;
          const settings = { ...getTemplateDocumentDesignDefaults(template.id), resumeOutputMode: ats ? 'ats' : 'visual' };
          const application = applicationSchema.parse({
            schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
            status: 'Entwurf', templateId: template.id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
          });
          const file = `${template.id}-${combo}-${count}${ats ? '-ats' : ''}`;
          globalThis.__langLog = [];
          await writeFile(resolve(out, `${file}.html`), buildDocumentHtml(application, profile, 'lebenslauf'));
          // A focused real-PDF parity fixture: every visual template with four languages in its default dots-only view.
          if (!ats && combo === 'dots' && count === 4) {
            const resolved = resolveCvDocument({ profile, templateId: template.id, settings, application });
            const Resume = resumeComponents[template.id];
            const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, {
              designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId: template.id,
              pageNumber: index + 1, totalPages: resolved.pagePlan.length,
            }, h(Resume, {
              profile: resolved.profile, templateId: template.id, name: `${profile.firstName} ${profile.lastName}`,
              atsMode: false, plan, totalPages: resolved.pagePlan.length, accentColor: template.accent,
              secondaryColor: template.secondary, photoSource: resolved.profile.photoPath || null,
              resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: 'white', closingDate: resolved.closingDate,
              design: resolved.design, designSettings: resolved.settings, designVariables: resolved.zweispaltigVariables,
            }))));
            const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary,
              '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
              .map(([key, value]) => `${key}:${value}`).join(';').replaceAll('"', '&quot;');
            const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
            await writeFile(resolve(out, `${file}-preview.html`), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[template.id]} @page{size:A4;margin:0} body{margin:0;background:white} .document-paper{break-after:page}</style></head><body>${pages.map(paper).join('')}</body></html>`);
          }
          manifest.push({ file, template: template.id, combo, count, ats, planned: globalThis.__langLog });
        }
      }
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log('probes', manifest.length);
} catch (error) { console.error(error); process.exitCode = 1; } finally { await vite.close(); process.exit(process.exitCode ?? 0); }
