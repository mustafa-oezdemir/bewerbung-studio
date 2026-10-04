// Education flow + central spacing QA: a Lebenslauf like the reported Zweispaltig one (photo, contacts, three stations with
// 7 / 5 / 6 bullets, three education entries with a grade and long descriptions, Kurzprofil / Stärken / Sprachen) written
// as PDF HTML and preview HTML plus the page plan, for check-education-flow-qa.cjs (real Chromium: where every section
// stands on every page, the free room at the bottom of page one, the gaps between sections, entries and titles).
//   node scripts/education-flow-qa.mjs
//   env: TEMPLATE=<id> (default zweispaltig), CASES=<name,name> (default all), BULLETS=7,5,6 (bullets of the three stations),
//        EDUCATION_DETAILS=<n> (more description sentences)
// Cases: native (no override), section-4 / section-6.5 / section-10 (Abschnittsabstand), title-gap-6, entry-gap-8, content-gap-4,
// column-gap-18, long-education (three or more pages of education).
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/education-flow-qa');
await mkdir(out, { recursive: true });
const templateId = process.env.TEMPLATE || 'zweispaltig';
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { getTemplate, getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const harness = await vite.ssrLoadModule('/src/components/resume/__parityHarness.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const now = '2026-10-03T10:00:00.000Z';
  const uid = (n) => `9f000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  const bullet = (station, index) => [
    `Entwicklung und Implementierung eines Datasource-Plugins für Monitoring-Daten (${station} ${index + 1})`,
    `Anbindung einer Programmierschnittstelle zur Abfrage und Verarbeitung von Sensordaten (${station} ${index + 1})`,
    `Implementierung einer sicheren Authentifizierung für die Schnittstellenkommunikation (${station} ${index + 1})`,
    `Optimierung von Datenabfragen für eine performante Darstellung großer Zeitreihen (${station} ${index + 1})`,
    `Koordination laufender Produktionsprozesse und beteiligter Mitarbeiter im Schichtbetrieb (${station} ${index + 1})`,
  ][index % 5];
  const stations = (count) => (station) => Array.from({ length: count }, (_, index) => bullet(station, index));
  const description = (n) => Array.from({ length: n }, (_, index) =>
    `Ausbildung ${index + 1}: Erfolgreich bestandene Abschlussprüfung mit Schwerpunkt auf der praktischen Umsetzung technischer Anforderungen und der strukturierten Bearbeitung von Aufgabenstellungen im Team.`).join(' ');

  const bullets = (process.env.BULLETS || '7,5,6').split(',').map(Number);
  const makeProfile = (options = {}) => {
    const extraEducation = Number(process.env.EDUCATION_DETAILS || 0);
    const education = options.education ?? [
      { id: uid(20), from: '07/2023', to: '2026', degree: 'Fachinformatiker für Anwendungsentwicklung', institution: 'IAD – Informationsverarbeitung GmbH', city: 'Marburg', country: 'Deutschland', fieldOfStudy: 'Anwendungsentwicklung', grade: '3', description: description(2 + extraEducation) },
      { id: uid(21), from: '2001', to: '2005', degree: 'Hochschulabschluss in Industrieingenieurwesen', institution: 'Beispiel Universität', city: 'Musterstadt', country: 'Deutschland', description: description(3 + extraEducation) },
      { id: uid(22), from: '2003', to: '2007', degree: 'Pilotenausbildung', institution: 'Militärisches Ausbildungszentrum', city: 'Musterstadt', country: 'Deutschland', fieldOfStudy: 'Flugführung', description: description(2 + extraEducation) },
    ];
    const input = {
      id: uid(1), isDefault: true, updatedAt: now, firstName: 'Mina', lastName: 'Kaya', title: 'Industrieingenieurin | Prozessplanung & Produktionskoordination',
      phone: '+49 170 12345678', email: 'mina.kaya@example.com', linkedin: 'https://www.linkedin.com/in/mina-kaya/', github: 'https://github.com/mina-kaya',
      street: 'Musterstraße 12', postalCode: '12345', city: 'Musterstadt', country: 'Germany',
      summary: 'Industrieingenieurin mit Erfahrung in Prozessanalyse, Produktionssteuerung und der strukturierten Bearbeitung technischer Aufgabenstellungen. Praxis in der Auswertung technischer Daten und der Optimierung von Prozessen im Monitoring-Umfeld.',
      strengths: ['Analytisches Denken', 'Strukturierte Problemlösungsfähigkeit', 'Schnelle Auffassungsgabe', 'Selbstständige und systematische Arbeitsweise', 'Verantwortungsbewusstsein'].map((title, index) => ({ id: uid(2 + index), title, description: '' })),
      experiences: [
        { id: uid(10), from: '01/2015', to: '02/2017', role: 'Praktikum im Bereich Softwareentwicklung', company: 'Universitätsstadt Muster', city: 'Musterstadt', tasks: [], achievements: stations(bullets[0])('A') },
        { id: uid(11), from: '02/2017', to: '03/2019', role: 'Prozessplaner', company: 'Beispiel Textil AG', city: 'Musterstadt', tasks: [], achievements: stations(bullets[1])('B') },
        { id: uid(12), from: '03/2019', to: '04/2021', role: 'Transportpilot', company: 'Muster Luftfahrtbereich', city: 'Musterstadt', tasks: [], achievements: stations(bullets[2])('C') },
      ],
      education,
      languages: ['Deutsch – C1', 'Englisch – B2', 'Türkisch – C2'],
      resumePersonalFieldVisibility: { address: true, phone: true, email: true, linkedin: true, github: true, website: true, onlineProfiles: true, birthDate: false, birthPlace: false, nationality: false, familyStatus: false, children: false, drivingLicense: false, xing: false },
    };
    return setResumePhotoVisible(profileSchema.parse({ ...input, photoPath: photo }), true);
  };

  const cases = {
    native: {},
    'section-4': { spacing: { sectionGapMm: 4 } },
    'section-6.5': { spacing: { sectionGapMm: 6.5 } },
    'section-10': { spacing: { sectionGapMm: 10 } },
    'title-gap-6': { spacing: { sectionTitleGapMm: 6 } },
    'entry-gap-8': { spacing: { entryGapMm: 8 } },
    'content-gap-4': { spacing: { entryContentGapMm: 4 } },
    'column-gap-18': { spacing: { columnGapMm: 18 } },
    'long-education': { longEducation: true },
  };
  const wanted = (process.env.CASES || Object.keys(cases).join(',')).split(',');
  const manifest = [];
  for (const key of wanted) {
    const spec = cases[key];
    const education = spec.longEducation ? Array.from({ length: 6 }, (_, index) => ({
      id: uid(30 + index), from: `${2000 + index}`, to: `${2002 + index}`, degree: `Abschluss ${index + 1} im Bereich Technik`, institution: `Beispiel Institut ${index + 1}`, city: 'Musterstadt', country: 'Deutschland',
      fieldOfStudy: 'Anwendungsentwicklung', grade: '2,3', description: description(5),
    })) : undefined;
    const profile = makeProfile({ education });
    const template = getTemplate(templateId);
    const settings = { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: 'visual', ...(spec.spacing ? { cvOverrides: { spacing: spec.spacing } } : {}) };
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
      status: 'Entwurf', templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    const resolved = resolveCvDocument({ profile, templateId, settings: application.designSettings, application });
    const pdf = buildDocumentHtml(application, profile, 'lebenslauf');
    const component = harness.resumeComponents[templateId];
    const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, {
      designSettings: application.designSettings, resolvedCv: resolved, profile: resolved.profile, templateId, pageNumber: index + 1, totalPages: resolved.pagePlan.length,
    }, h(component, {
      profile: resolved.profile, templateId, name: `${profile.firstName} ${profile.lastName}`, atsMode: false, plan, totalPages: resolved.pagePlan.length,
      accentColor: template.accent, secondaryColor: template.secondary, photoSource: resolved.profile.photoPath || null, resumeProfile: resolved.summary, sections: resolved.sections,
      backgroundId: application.designSettings.backgroundId, closingDate: resolved.closingDate,
    }))));
    const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(application.designSettings) })
      .map(([name, value]) => `${name}:${value}`).join(';').replaceAll('"', '&quot;');
    const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${application.designSettings.columnLayout} background-${application.designSettings.backgroundId} background-scope-${application.designSettings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
    await writeFile(resolve(out, `${key}.html`), pdf);
    await writeFile(resolve(out, `${key}-preview.html`), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[templateId]} body{margin:0;background:white}</style></head><body>${pages.map(paper).join('')}</body></html>`);
    await writeFile(resolve(out, `${key}-plan.json`), JSON.stringify(resolved.pagePlan));
    const shape = resolved.pagePlan.map((page) => page.items.map((item) => `${item.kind === 'experience' ? 'X' : 'E'}${item.id.slice(-2)}${item.bullets ? `[${item.bullets.from}-${item.bullets.to}/${item.bullets.total}]` : ''}`).join(',')).join(' | ');
    manifest.push({ file: key, spacing: spec.spacing ?? null, plan: shape });
    console.log(key.padEnd(16), shape);
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
} finally { await vite.close(); }
