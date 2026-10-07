import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
// Klassisch page QA (fictional data only): every scenario × Seitenränder (native, PAGE_MARGINS=mm,mm) as the PDF HTML
// (buildDocumentHtml, the exporter's markup), the preview HTML (ManagedResumePreview + app CSS) and plan.json (page plan,
// expected bullets per experience). Check with `npx electron scripts/check-klassisch-page-qa.cjs` (real printToPDF).
//   [RANDOM=n SEED=s] [PAGE_MARGINS=18,10] [ATS=1] node scripts/klassisch-page-qa.mjs
const out = resolve('tmp/klassisch-page-qa');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { getTemplate, getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const { resolveExperience } = await vite.ssrLoadModule('/src/shared/resumeCareer.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { KlassischResume } = await vite.ssrLoadModule('/src/components/resume/templates/klassisch/index.ts');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const template = getTemplate('klassisch');
  const now = '2026-10-07T10:00:00.000Z';
  const uid = (n) => `7c000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const words = ['Planung', 'und', 'Steuerung', 'von', 'Projekten', 'mit', 'internen', 'Fachabteilungen', 'sowie', 'externen', 'Partnern',
    'Einführung', 'eines', 'Kennzahlensystems', 'für', 'die', 'Qualitätssicherung', 'Abstimmung', 'Anforderungen', 'Dokumentation', 'Betrieb', 'Schulung'];
  let seed = Number(process.env.SEED || 7);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const sentence = (n) => Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]).join(' ');
  const base = (extra = {}) => ({
    id: uid(1), isDefault: true, updatedAt: now, firstName: 'Lena', lastName: 'Hoffmann', title: 'Projektmanagerin Digitalisierung',
    street: 'Beispielweg 4', postalCode: '35037', city: 'Marburg', phone: '+49 151 2345678', email: 'lena.hoffmann@example.org',
    linkedin: 'https://www.linkedin.com/in/lena-hoffmann-beispiel', portfolio: 'https://lena-hoffmann.example.org', birthDate: '1991-04-12', birthPlace: 'Kassel',
    summary: 'Projektmanagerin mit acht Jahren Erfahrung in der Digitalisierung von Verwaltungs- und Produktionsprozessen. Strukturiert, kommunikationsstark und gewohnt, Teams über Abteilungsgrenzen hinweg zu führen.',
    strengths: [
      { id: uid(2), title: 'Organisation', description: 'Projekte termingerecht steuern' },
      { id: uid(3), title: 'Kommunikation', description: 'Fachabteilungen zusammenbringen' },
      { id: uid(4), title: 'Analyse', description: 'Prozesse messbar verbessern' },
    ],
    experiences: [],
    education: [
      { id: uid(20), from: '10/2010', to: '09/2014', degree: 'Bachelor of Science Wirtschaftsinformatik', institution: 'Philipps-Universität Marburg', city: 'Marburg',
        fieldOfStudy: 'Wirtschaftsinformatik', grade: '1,9', description: 'Schwerpunkt Prozessmanagement. Abschlussarbeit über die Einführung digitaler Freigabeprozesse in mittelständischen Unternehmen. Tutorin für Grundlagen der Programmierung.' },
      { id: uid(21), from: '08/2001', to: '06/2010', degree: 'Allgemeine Hochschulreife', institution: 'Gymnasium am Beispielpark', city: 'Kassel' },
    ],
    skills: ['Projektmanagement', 'Scrum', 'Jira', 'Confluence', 'SQL', 'Power BI', 'Prozessmodellierung (BPMN)', 'MS Office'],
    languages: ['Deutsch – Muttersprache', 'Englisch – C1', 'Französisch – B1'],
    certifications: ['2023 · Certified ScrumMaster · Scrum Alliance', '2021 · PRINCE2 Foundation · Axelos'],
    ...extra,
  });
  const station = (n, bullets, extra = {}) => ({
    id: uid(10 + n), from: `0${1 + (n % 8)}/20${10 + n}`, to: `0${2 + (n % 7)}/20${11 + n}`, role: `Projektleiterin Prozessdigitalisierung ${n + 1}`,
    company: `Beispiel Werke ${n + 1}`, legalForm: 'GmbH', city: 'Frankfurt am Main', achievements: bullets, ...extra,
  });
  const longBullets = Array.from({ length: 26 }, (_, i) => `Punkt ${String(i + 1).padStart(2, '0')}: ${sentence(8 + (i * 7) % 17)}.`);
  const scenarios = {
    // One career entry that is far too long for page one: it must break between bullets and go on on page two.
    'long-entry': () => base({ photoPath: photo, experiences: [station(0, longBullets), station(1, ['Einführung eines digitalen Rechnungsworkflows für 40 Standorte.', 'Reduktion der Durchlaufzeit um 35 Prozent.'])] }),
    'long-entry-nophoto': () => base({ experiences: [station(0, longBullets), station(1, ['Einführung eines digitalen Rechnungsworkflows für 40 Standorte.'])] }),
    'three-pages': () => base({ photoPath: photo, experiences: Array.from({ length: 7 }, (_, n) => station(n, Array.from({ length: 5 }, (_, i) => `Ergebnis ${n + 1}.${i + 1}: ${sentence(10 + (n + i * 3) % 12)}.`))) }),
    'one-page': () => base({ photoPath: photo, experiences: [station(0, ['Einführung eines digitalen Rechnungsworkflows.', 'Leitung eines Teams von sechs Personen.'])] }),
  };
  for (let k = 0; k < Number(process.env.RANDOM || 0); k++) {
    scenarios[`rand${k}`] = () => base({
      photoPath: rnd() < 0.7 ? photo : '', title: sentence(2 + Math.floor(rnd() * 6)),
      summary: sentence(15 + Math.floor(rnd() * 40)),
      experiences: Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, n) => station(n, Array.from({ length: Math.floor(rnd() * 8) }, () => `${sentence(5 + Math.floor(rnd() * 22))}.`))),
      education: Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, n) => ({ id: uid(30 + n), from: '2008', to: '2012', degree: `Abschluss ${n + 1} ${sentence(1 + Math.floor(rnd() * 4))}`, institution: 'Hochschule Beispielstadt', description: rnd() < 0.6 ? `${sentence(8 + Math.floor(rnd() * 30))}.` : '' })),
    });
  }
  const margins = [undefined, ...(process.env.PAGE_MARGINS ?? '18').split(',').filter(Boolean).map(Number)];
  const manifest = [];
  for (const [name, make] of Object.entries(scenarios)) {
    const parsed = profileSchema.parse(make());
    const profile = parsed.photoPath ? setResumePhotoVisible(parsed, true) : parsed;
    for (const margin of margins) for (const ats of process.env.ATS ? [false, true] : [false]) {
      const settings = { ...getTemplateDocumentDesignDefaults('klassisch'), resumeOutputMode: ats ? 'ats' : 'visual',
        ...(margin !== undefined ? { cvOverrides: { spacing: { pageMarginMm: margin } } } : {}) };
      const application = applicationSchema.parse({
        schemaVersion: 1, id: uid(90), folderName: 'QA', company: { name: 'Beispiel AG', city: 'Berlin' }, contact: {}, job: { title: 'Projektleitung' },
        status: 'Entwurf', templateId: 'klassisch', accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings,
        applicationDate: '2026-10-07', documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
      });
      const file = `${name}${margin !== undefined ? `-m${margin}` : ''}${ats ? '-ats' : ''}`;
      await writeFile(resolve(out, `${file}.html`), buildDocumentHtml(application, profile, 'lebenslauf'));
      const resolved = resolveCvDocument({ profile, templateId: 'klassisch', settings, application });
      const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, { designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId: 'klassisch', pageNumber: index + 1, totalPages: resolved.pagePlan.length },
        h(KlassischResume, { profile: resolved.profile, name: `${profile.firstName} ${profile.lastName}`, atsMode: ats, plan, totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary,
          photoSource: resolved.profile.photoPath || null, resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: settings.backgroundId }))));
      const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
        .map(([key, value]) => `${key}:${value}`).join(';').replaceAll('"', '&quot;');
      const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
      await writeFile(resolve(out, `${file}-preview.html`), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources.klassisch} @page{size:A4;margin:0} body{margin:0;background:white} .document-paper{break-after:page}</style></head><body>${pages.map(paper).join('')}</body></html>`);
      const expected = profile.experiences.map((entry) => ({ id: entry.id, role: resolveExperience(entry).role, bullets: resolveExperience(entry).bullets }));
      await writeFile(resolve(out, `${file}.plan.json`), JSON.stringify({ pagePlan: resolved.pagePlan, expected, margin: margin ?? null, ats }, null, 1));
      manifest.push({ file, scenario: name, margin: margin ?? null, ats, pages: resolved.pagePlan.length });
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(manifest.map((entry) => `${entry.file}: ${entry.pages} p`).join('\n'));
} finally { await vite.close(); }
