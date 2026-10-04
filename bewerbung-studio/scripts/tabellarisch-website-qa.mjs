// Tabellarisch header geometry QA: a Lebenslauf with a photo and the Website switch off / on (and more header
// variants), written as PDF HTML and preview HTML plus the page plan, for check-tabellarisch-website-qa.cjs
// (real Chromium: header bottom, first section top, last bullet bottom, page overflow, markers).
//   node scripts/tabellarisch-website-qa.mjs            fixtures into tmp/tabellarisch-website-qa
//   env: TEMPLATE=<id> (default tabellarisch), FIND=1 (search the bullet counts at which the Website switch moves a bullet)
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/tabellarisch-website-qa');
await mkdir(out, { recursive: true });
const templateId = process.env.TEMPLATE || 'tabellarisch';
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { getTemplate } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const harness = await vite.ssrLoadModule('/src/components/resume/__parityHarness.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const { estimateResumeHeaderTop } = await vite.ssrLoadModule('/src/shared/resumeHeaderGeometry.ts');
  const { getResumeHeaderContactTexts } = await vite.ssrLoadModule('/src/shared/resumePersonalData.ts');
  const { getResumeDisplayProfile } = await vite.ssrLoadModule('/src/shared/resumeDisplayProfile.ts');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const now = '2026-10-03T10:00:00.000Z';
  const uid = (n) => `9e000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  /** A profile like the reported one: photo, the usual contacts, three stations (the last one is Transportpilot). */
  const makeProfile = (options = {}) => {
    const {
      website = 'https://pehlione.com/', github = 'https://github.com/mina-beispiel-gh', linkedin = 'https://www.linkedin.com/in/mina-beispiel-k/',
      email = 'mina.beispiel1408@example.com', title = 'Technisch und prozessorientierter Quereinsteiger mit Erfahrung im Produktionsumfeld',
      name = ['Mina', 'Beispiel'], bullets = [5, 7], showWebsite = true, showGithub = true, showLinkedin = true, photoShown = true, extra = {},
    } = options;
    const pilot = [
      'Planung und Koordination operativer Einsätze in einem sicherheitskritischen Umfeld unter Einhaltung standardisierter Abläufe',
      'Vorbereitung von Einsatzbriefings sowie Koordination der Zusammenarbeit beteiligter Personen',
      'Priorisierung operativer Aufgaben und präzise, sicherheitsorientierte Entscheidungsfindung unter Zeitdruck',
      'Übernahme von Teamverantwortung sowie Sicherstellung der zuverlässigen Durchführung operativer Prozesse',
    ];
    const filler = (station, count) => Array.from({ length: count }, (_, index) => `Station ${station}: Aufgabe ${index + 1} mit nachvollziehbarem Ergebnis in der Zusammenarbeit der Fachbereiche und der beteiligten Teams`);
    const input = {
      id: uid(1), isDefault: true, updatedAt: now, firstName: name[0], lastName: name[1], title,
      phone: '+49 176 12345678', email, linkedin, github, portfolio: website,
      street: 'Beispielallee 20', postalCode: '35039', city: 'Marburg', country: 'Deutschland',
      summary: 'Technisch versierter Quereinsteiger mit Erfahrung in Produktion und Prozessplanung.',
      strengths: [{ id: uid(2), title: 'Analytisches Denken', description: '' }],
      experiences: [
        { id: uid(10), from: '01/2015', to: '02/2017', role: 'Praktikum als Softwareentwickler', company: 'Beispiel Software GmbH', city: 'Marburg', tasks: [], achievements: filler(1, bullets[0]) },
        { id: uid(11), from: '02/2017', to: '03/2019', role: 'Prozessplaner', company: 'Beispiel Textil AG', city: 'Marburg', tasks: [], achievements: filler(2, bullets[1]) },
        { id: uid(12), from: '03/2019', to: '04/2021', role: 'Transportpilot', company: 'Luftfahrtbereich', city: 'Marburg', tasks: [], achievements: pilot },
      ],
      education: [{ id: uid(20), from: '2008', to: '2011', degree: 'Ausbildung', institution: 'Beispielschule', description: '' }],
      languages: ['Deutsch – C2', 'Englisch – B2'], certifications: [], skills: [],
      resumePersonalFieldVisibility: {
        address: true, phone: true, email: true, linkedin: showLinkedin, github: showGithub, website: showWebsite, onlineProfiles: true,
        birthDate: false, birthPlace: false, nationality: false, familyStatus: false, children: false, drivingLicense: false, xing: false,
      },
      ...extra,
    };
    const parsed = profileSchema.parse({ ...input, photoPath: photoShown ? photo : '' });
    return photoShown ? setResumePhotoVisible(parsed, true) : parsed;
  };

  const application = (profile) => {
    const template = getTemplate(templateId);
    return applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
      status: 'Entwurf', templateId, accentColor: template.accent, secondaryColor: template.secondary,
      designSettings: { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: 'visual' }, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
  };
  const planOf = (profile) => {
    const app = application(profile);
    return resolveCvDocument({ profile, templateId, settings: app.designSettings, application: app });
  };
  const summary = (plan) => plan.map((page) => page.items.map((item) => `${item.kind === 'experience' ? 'X' : 'E'}:${item.id.slice(-2)}${item.bullets ? `[${item.bullets.from}-${item.bullets.to}/${item.bullets.total}]` : ''}`).join(',')).join(' | ');

  if (process.env.FIND) {
    // Which bullet counts of the two stations before the Transportpilot make the Website switch move a bullet?
    const hits = [];
    for (let a = 3; a <= 14; a += 1) for (let b = 3; b <= 14; b += 1) {
      const off = summary(planOf(makeProfile({ bullets: [a, b], showWebsite: false })).pagePlan);
      const on = summary(planOf(makeProfile({ bullets: [a, b], showWebsite: true })).pagePlan);
      if (off !== on) hits.push({ a, b, off, on });
    }
    console.log(hits.length, 'bullet counts where the Website switch changes the page plan');
    for (const hit of hits.slice(0, 20)) console.log(`  bullets ${hit.a}/${hit.b}\n    off ${hit.off}\n    on  ${hit.on}`);
  } else {
    const bullets = (process.env.BULLETS || '5,7').split(',').map(Number);
    const cases = {
      'website-off': { bullets, showWebsite: false },
      'website-on': { bullets, showWebsite: true },
      'github-off-website-off': { bullets, showWebsite: false, showGithub: false },
      'github-off-website-on': { bullets, showWebsite: true, showGithub: false },
      'long-website': { bullets, website: 'https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung', showWebsite: true },
      'long-website-github-off': { bullets, website: 'https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung', showWebsite: true, showGithub: false },
      'no-photo-website-off': { bullets, showWebsite: false, photoShown: false },
      'no-photo-website-on': { bullets, showWebsite: true, photoShown: false },
      'long-email-website-on': { bullets, showWebsite: true, email: 'mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com' },
      'long-linkedin-website-on': { bullets, showWebsite: true, linkedin: 'https://www.linkedin.com/in/mina-beispiel-senior-entwicklerin-prozessplanung-123456789/' },
      'long-title-website-on': { bullets, showWebsite: true, title: 'Technisch und prozessorientierter Quereinsteiger mit langjähriger Erfahrung im Produktionsumfeld sowie in der Prozessplanung und Digitalisierung' },
      'long-name-website-on': { bullets, showWebsite: true, name: ['Mina-Alexandra', 'Beispiel-Schmidt-Wolkenstein'] },
      'no-linkedin-website-on': { bullets, showWebsite: true, showLinkedin: false },
    };
    const manifest = [];
    for (const [key, options] of Object.entries(cases)) {
      const profile = makeProfile(options);
      const app = application(profile);
      const resolved = planOf(profile);
      const pdf = buildDocumentHtml(app, profile, 'lebenslauf');
      const settings = app.designSettings;
      const template = getTemplate(templateId);
      const component = harness.resumeComponents[templateId];
      const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, {
        designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId, pageNumber: index + 1, totalPages: resolved.pagePlan.length,
      }, h(component, {
        profile: resolved.profile, templateId, name: `${profile.firstName} ${profile.lastName}`, atsMode: false, plan, totalPages: resolved.pagePlan.length,
        accentColor: template.accent, secondaryColor: template.secondary, photoSource: resolved.profile.photoPath || null, resumeProfile: resolved.summary, sections: resolved.sections,
        backgroundId: settings.backgroundId, closingDate: resolved.closingDate,
      }))));
      const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
        .map(([name, value]) => `${name}:${value}`).join(';').replaceAll('"', '&quot;');
      const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
      await writeFile(resolve(out, `${key}.html`), pdf);
      await writeFile(resolve(out, `${key}-preview.html`), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[templateId]} body{margin:0;background:white}</style></head><body>${pages.map(paper).join('')}</body></html>`);
      await writeFile(resolve(out, `${key}-plan.json`), JSON.stringify(resolved.pagePlan));
      manifest.push({ file: key, website: options.website ?? 'https://pehlione.com/', pages: resolved.pagePlan.length, plan: summary(resolved.pagePlan) });
      const display = getResumeDisplayProfile(profile);
      const texts = getResumeHeaderContactTexts(display);
      const estimate = estimateResumeHeaderTop(templateId, display, 'main', 0, true, Boolean(display.photoPath));
      console.log(key.padEnd(26), `est ${estimate?.toFixed(1)} contacts ${JSON.stringify(texts.map((text) => text.length))}`.padEnd(48), summary(resolved.pagePlan));
    }
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  }
} finally { await vite.close(); }
