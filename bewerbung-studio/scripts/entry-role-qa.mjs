import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Entry text roles (Eintragstitel, Datum / Zeitraum, Unternehmen / Einrichtung, Ort / Standort, Projekttechnologien,
// Projektbeschreibung): every active template as preview and as PDF, visual and plain (ATS), natively and with the
// Lebenslauf-Design overrides of scripts/check-entry-role-qa.cjs. The checker measures the computed colour and size of every
// `[data-cv-role]` text in Chromium, preview against PDF, and the pages for text beyond the sheet and overlapping lines.
//   [ONLY=<id,id>] [VARIANTS=native,roles,accent,date,organization,location,technologies,description,body,general,large,small] node scripts/entry-role-qa.mjs && node node_modules/electron/cli.js scripts/check-entry-role-qa.cjs
const out = resolve('tmp/entry-role-qa');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates, getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const names = { einspaltig: 'Einspaltig', 'ivy-league': 'IvyLeague', zeitgenoessisch: 'Zeitgenoessisch', 'tuerkis-profil': 'TuerkisProfil' };
  const componentOf = async (id) => {
    const dir = id.startsWith('pehlione_') ? 'pehlione' : id;
    const name = id.startsWith('pehlione_') ? 'Pehlione' : names[id] ?? id[0].toUpperCase() + id.slice(1);
    return (await vite.ssrLoadModule(`/src/components/resume/templates/${dir}/index.ts`))[`${name}Resume`];
  };
  const now = new Date().toISOString();
  const uid = (n) => `9b000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const project = (n, title, technologies) => ({
    id: uid(300 + n), title, technologies, url: `https://github.com/example/projekt-${n}`,
    description: `${title}: Demoanwendung mit ${technologies.join(', ')} und automatisierten Tests für den Betrieb.`, bullets: [],
  });
  // The example of the request: Werdegang, Bildungsweg, Projekte and Hobbys with every role filled.
  const baseProfile = (dense) => profileSchema.parse({
    id: uid(1), isDefault: true, updatedAt: now, firstName: 'Lena', lastName: 'Beispiel', title: 'Fachinformatikerin für Anwendungsentwicklung',
    email: 'lena.beispiel@example.test', phone: '+49 151 23456789', city: 'Marburg', summary: 'Anwendungsentwicklerin mit Schwerpunkt Backend und Monitoring.',
    skills: ['Java', 'TypeScript'], languages: ['Deutsch – Muttersprache', 'Englisch – B2'],
    experiences: [
      { id: uid(10), from: '11/2024', to: '06/2025', role: 'Praktikum als Anwendungsentwickler', company: 'Universitätsstadt Marburg', city: 'Marburg',
        achievements: ['Entwicklung eines Grafana-Datasource-Plugins für PRTG', 'Konzeption und Implementierung zentraler Funktionen', 'Dokumentation und Open-Source-Veröffentlichung auf GitHub'] },
      ...(dense ? [2, 3, 4, 5].map((n) => ({ id: uid(10 + n), from: `0${n}/20${14 + n}`, to: `0${n + 1}/20${15 + n}`, role: `Softwareentwickler ${n}`, company: `Beispiel Softwarehaus ${n} GmbH`, city: 'Frankfurt am Main',
        achievements: ['Entwicklung von Schnittstellen und Datenmodellen für interne Plattformen mit hohen Anforderungen', 'Abstimmung mit Fachabteilungen und Dokumentation der Ergebnisse', 'Betrieb und Monitoring der Anwendungen'] })) : []),
    ],
    education: [
      { id: uid(20), from: '07/2023', to: '06/2025', degree: 'Fachinformatiker für Anwendungsentwicklung', institution: 'IAD GmbH', city: 'Marburg', description: 'Abschlussprojekt: Monitoring-Plattform' },
      { id: uid(21), from: '2008', to: '2012', degree: 'Bachelor Informatik', institution: 'Universität Istanbul', city: 'Istanbul', country: 'Türkei' },
    ],
    specialSections: [
      { id: uid(30), kind: 'projects', title: 'Projekte', isVisible: true, entries: [
        project(1, 'Spring Boot E-Commerce Shop mit Kafka', ['Spring Boot', 'Kafka', 'RabbitMQ', 'MySQL', 'Prometheus', 'Grafana']),
        project(2, 'Go Microservice Plattform', ['Go', 'Gin', 'GORM', 'MySQL', 'Docker Compose']),
        ...(dense ? [project(3, 'C# / .NET E-Commerce & Operations Platform', ['ASP.NET Core MVC', 'MySQL', 'Entity Framework Core', 'Razor', 'Identity', 'JWT'])] : []),
      ] },
      { id: uid(40), kind: 'interests', title: 'Hobbys & Interessen', isVisible: true, contentType: 'entries', entries: [
        { id: uid(41), title: 'Gartenarbeit', subtitle: 'Interkultureller Garten Marburg', location: 'Marburg', date: 'seit 2023', description: 'Aktives Mitglied im Gemeinschaftsgarten.', bullets: [] },
        { id: uid(42), title: 'Code', description: 'Verschiedene Weiterbildungen', bullets: [] },
      ] },
    ],
  });
  // `roles` names every new value at once (reach, independence, parity); `large`/`small` stress the page planner.
  const variants = {
    native: undefined,
    // Only the entry roles: every other text must keep its look.
    roles: { colors: { date: '#B4232C', organization: '#1F6F43', location: '#2347A8' },
      typography: { entryHeadingSizePt: 12.5, dateSizePt: 9.5, organizationSizePt: 10.5, locationSizePt: 8.5, projectTechnologiesSizePt: 9.5, projectDescriptionSizePt: 9.8 } },
    // Eintragstitel, Hervorhebungsfarbe and Absatztext reach titles, technologies and descriptions independently;
    // an organisation keeps its native colour unless Unternehmen / Einrichtung was chosen explicitly.
    accent: { colors: { entryHeading: '#7A1F5C', accent: '#A04A00', paragraph: '#2B2B2B' } },
    // One role at a time: the other roles keep their colour and size.
    date: { colors: { date: '#B4232C' }, typography: { dateSizePt: 11 } },
    organization: { colors: { organization: '#1F6F43' }, typography: { organizationSizePt: 12 } },
    location: { colors: { location: '#2347A8' }, typography: { locationSizePt: 11 } },
    technologies: { typography: { projectTechnologiesSizePt: 11 } },
    description: { typography: { projectDescriptionSizePt: 11.5 } },
    // The existing Lesetext and Zeilenhöhe reach the role texts alike on both surfaces; a description follows the Lesetext.
    body: { typography: { bodySizePt: 12, lineHeight: 1.4 } },
    // The general colours (visual and ATS alike): dates and places follow the Sekundärtext, descriptions the Absatztext.
    general: { colors: { text: '#5A1E1E', muted: '#178EDE', paragraph: '#202020' } },
    large: { typography: { entryHeadingSizePt: 15, dateSizePt: 12, organizationSizePt: 13, locationSizePt: 12, projectTechnologiesSizePt: 12, projectDescriptionSizePt: 12 } },
    small: { typography: { entryHeadingSizePt: 8, dateSizePt: 6.5, organizationSizePt: 7, locationSizePt: 6.5, projectTechnologiesSizePt: 6.5, projectDescriptionSizePt: 7 } },
  };
  const manifest = [];
  const only = process.env.ONLY?.split(',');
  for (const template of templates.filter((candidate) => !only || only.includes(candidate.id))) {
    const id = template.id;
    const component = await componentOf(id);
    for (const [variant, cvOverrides] of Object.entries(variants)) for (const dense of [false, true]) for (const ats of [false, true]) {
      if (dense && !['native', 'large', 'small'].includes(variant) || process.env.VARIANTS && !process.env.VARIANTS.split(',').includes(variant)) continue;
      const profile = baseProfile(dense);
      const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: ats ? 'ats' : 'visual', ...(cvOverrides ? { cvOverrides } : {}) };
      const application = applicationSchema.parse({ schemaVersion: 1, id: uid(900), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' }, status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
      const resolved = resolveCvDocument({ profile, templateId: id, settings, application });
      const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, { designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId: id, pageNumber: index + 1, totalPages: resolved.pagePlan.length },
        h(component, { profile: resolved.profile, templateId: id, name: 'Lena Beispiel', atsMode: ats, plan, totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary,
          photoSource: null, resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: settings.backgroundId, closingDate: resolved.closingDate,
          design: resolved.design, designSettings: resolved.settings, designVariables: resolved.zweispaltigVariables }))));
      const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
        .map(([key, value]) => `${key}:${value}`).join(';').replaceAll('"', '&quot;');
      const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
      const file = `${id}-${variant}${dense ? '-dense' : ''}-${ats ? 'ats' : 'vis'}`;
      await writeFile(resolve(out, `${file}-preview.html`), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[id]} body{margin:0;background:white}</style></head><body>${pages.map(paper).join('')}</body></html>`);
      await writeFile(resolve(out, `${file}-pdf.html`), buildDocumentHtml(application, profile, 'lebenslauf'));
      manifest.push({ file, id, variant, dense, ats, pages: resolved.pagePlan.length, overrides: cvOverrides ?? null, colors: resolved.design.colors, typography: resolved.design.typography, employer: resolved.zweispaltigVariables?.['--zweispaltig-employer'] ?? null,
        planned: resolved.pagePlan.flatMap((page) => page.items.map((item) => ({ page: page.pageNumber, kind: item.kind, id: item.id, weight: item.weight }))) });
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Created ${manifest.length} entry-role QA fixtures in ${out}`);
} finally { await vite.close(); }
