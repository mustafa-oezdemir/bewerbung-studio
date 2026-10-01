import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Renders every Lebenslauf template natively and with the workspace's shared Lebenslauf design, as preview and as PDF,
// so that scripts/check-design-system-qa.cjs can measure the result in Chromium: the typed native values against the
// pixels, and the shared layer against its effect.
const out = resolve('tmp/design-system-qa');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates, getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const { getPageMarginAdjustment } = await vite.ssrLoadModule('/src/shared/resumeSpacing.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const now = new Date().toISOString();
  const uuid = () => crypto.randomUUID();
  const profile = profileSchema.parse({
    id: uuid(), isDefault: true, firstName: 'Mina', lastName: 'Kaya', updatedAt: now, title: 'Softwareentwicklerin', city: 'Berlin',
    email: 'mina@example.com', summary: 'Entwicklung barrierefreier Anwendungen.', skills: ['TypeScript'], languages: ['Deutsch'],
    experiences: [1, 2].map((n) => ({ id: uuid(), from: `0${n}/2020`, to: 'Heute', role: `Rolle ${n}`, company: `Firma ${n}`, city: 'Berlin', achievements: ['Anwendungen entwickelt.', 'Team geleitet.'] })),
    education: [{ id: uuid(), from: '2012', to: '2016', degree: 'B.Sc.', institution: 'Hochschule' }],
  });
  const names = { einspaltig: 'Einspaltig', 'ivy-league': 'IvyLeague', zeitgenoessisch: 'Zeitgenoessisch' };
  const sharedValues = { sectionGapMm: 8, sectionTitleGapMm: 4, bodySizePt: 10.5, lineHeight: 1.3, sectionHeadingSizePt: 15, sectionHeadingWeight: 800, marginShiftMm: 4 };
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const manifest = [];
  for (const template of templates) {
    const id = template.id;
    const dir = id.startsWith('pehlione_') ? 'pehlione' : id;
    const name = id.startsWith('pehlione_') ? 'Pehlione' : names[id] ?? id[0].toUpperCase() + id.slice(1);
    const component = (await vite.ssrLoadModule(`/src/components/resume/templates/${dir}/index.ts`))[`${name}Resume`];
    const native = resolveTemplateCvDesign(id);
    const layer = {
      cvOverrides: {
        spacing: { sectionGapMm: sharedValues.sectionGapMm, sectionTitleGapMm: sharedValues.sectionTitleGapMm, pageMarginMm: native.spacing.pageMarginMm + sharedValues.marginShiftMm },
        typography: { bodySizePt: sharedValues.bodySizePt, lineHeight: sharedValues.lineHeight, sectionHeadingSizePt: sharedValues.sectionHeadingSizePt, sectionHeadingWeight: sharedValues.sectionHeadingWeight },
      },
      resumeAppearance: { sectionHeadingAlignment: 'center' },
    };
    const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: 'visual' };
    const application = applicationSchema.parse({ schemaVersion: 1, id: uuid(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' }, status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
    for (const variant of ['native', 'shared']) {
      const globalDesign = variant === 'shared' ? layer : undefined;
      const resolved = resolveCvDocument({ profile, templateId: id, settings, globalDesign });
      const plan = resolved.pagePlan[0];
      const child = h(component, { profile: resolved.profile, templateId: id, name: 'Mina Kaya', atsMode: false, plan, totalPages: 1, accentColor: template.accent, secondaryColor: template.secondary, photoSource: null, resumeProfile: '', sections: resolved.sections, backgroundId: settings.backgroundId });
      const preview = renderToStaticMarkup(h(ManagedResumePreview, { profile: resolved.profile, templateId: id, pageNumber: 1, totalPages: 1, designSettings: resolved.settings, resolvedCv: resolved }, child));
      const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
        .map(([key, value]) => `${key}:${value}`).join(';').replaceAll('"', '&quot;');
      const previewPage = `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[id]} body{margin:0;background:white}</style></head><body><div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${preview}</div></body></html>`;
      const pdf = buildDocumentHtml(application, profile, 'lebenslauf', [], globalDesign);
      for (const [surface, html] of [['preview', previewPage], ['pdf', pdf]]) {
        const file = `${id}-${variant}-${surface}`;
        await writeFile(resolve(out, `${file}.html`), html);
        manifest.push({
          file, id, surface, variant, native,
          marginAdjustment: getPageMarginAdjustment(id, native.spacing.pageMarginMm + sharedValues.marginShiftMm),
        });
      }
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify({ sharedValues, entries: manifest }));
  console.log(`Created ${manifest.length} design-system QA fixtures in ${out}`);
} finally { await vite.close(); }
