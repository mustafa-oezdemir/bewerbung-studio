// Pagination flow QA: résumés with a long sidebar × the two-column templates, written as PDF HTML and preview HTML into
// tmp/pagination-flow-qa, plus the page plan of each document. Scenarios: `dense` (a fixed résumé like a real, full one:
// six strengths, three languages, ten knowledge items, three stations, four education entries) and RANDOM=<n> seeded
// random ones (SEED=<n>). Every text carries a unique token, so the checker can see lost and doubled content.
//   node scripts/pagination-flow-qa.mjs [templateId…]   (env: KNOWLEDGE, STRENGTHS, STATIONS, LANGUAGES, LANG_DISPLAY=dots,level,description, SURFACES=1, RANDOM, SEED)
// Check the result with check-pagination-flow-qa.cjs (real Chromium).
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/pagination-flow-qa');
await mkdir(out, { recursive: true });
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const { resolveCvDocument } = await vite.ssrLoadModule('/src/shared/resolveCvDocument.ts');
  const { getManagerSections } = await vite.ssrLoadModule('/src/features/resume-sections/resume-manager.ts');
  const { ManagedResumePreview } = await vite.ssrLoadModule('/src/components/resume/ManagedResumePreview.tsx');
  const { resumeTemplateStyleSources } = await vite.ssrLoadModule('/src/components/resume/resumeTemplateStyleSources.ts');
  const { getReadableTextColor } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getDocumentDesignVariables } = await vite.ssrLoadModule('/src/shared/documentDesign.ts');
  const { supportsSidebarContinuation } = await vite.ssrLoadModule('/src/shared/resumeSectionPresentation.ts');
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const preflight = await readFile('node_modules/tailwindcss/preflight.css', 'utf8');
  const appCss = (await readFile('src/app.css', 'utf8')).replace('@import "tailwindcss";', '');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const now = new Date().toISOString();
  const uid = (n) => `9b000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const names = { einspaltig: 'Einspaltig', 'ivy-league': 'IvyLeague', zeitgenoessisch: 'Zeitgenoessisch' };
  const componentOf = async (id) => {
    const dir = id.startsWith('pehlione_') ? 'pehlione' : id;
    const name = id.startsWith('pehlione_') ? 'Pehlione' : names[id] ?? id[0].toUpperCase() + id.slice(1);
    return (await vite.ssrLoadModule(`/src/components/resume/templates/${dir}/index.ts`))[`${name}Resume`];
  };

  let seed = Number(process.env.SEED || 5);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const pool = 'Prozess Analyse Planung Steuerung Qualität Fertigung Digitalisierung Koordination Dokumentation Betrieb Auswertung Schnittstelle Wartung Beratung Schulung Abstimmung Optimierung Messtechnik Instandhaltung Logistik Datenbank Projekt Anforderung Entwicklung Plattform Sicherheit Berichtswesen'.split(' ');
  /** A text of about `length` characters, ended by a unique token (`tag`). */
  const text = (length, tag) => {
    let value = '';
    while (value.length < length) value += (value ? ' ' : '') + pick(pool);
    return `${value} ${tag}`;
  };

  const knowledgeNames = ['MS-Office (Excel, Word, PowerPoint)', 'Grafana und Monitoring', 'SQL und Datenbanken', 'Python Grundlagen', 'Sichtkontrolle und Qualitätssicherung', 'Prozessplanung und Produktionssteuerung', 'Prozessanalyse und Digitalisierung', 'Fertigungsplanung', 'Lean Management', 'Instandhaltungskoordination', 'SAP Grundkenntnisse', 'Arbeitssicherheit', 'Projektkoordination', 'Dokumentation nach DIN', 'Schichtplanung', 'Reklamationsbearbeitung'];
  const strengthNames = ['Analytisches Denkvermögen', 'Strukturierte Problemlösungsfähigkeit', 'Schnelle Auffassungsgabe', 'Selbstständige und systematische Arbeitsweise', 'Priorisierungs- und Organisationsfähigkeit', 'Verantwortungsbewusstsein', 'Kommunikationsstärke', 'Lösungsorientierung'];
  const bulletPool = ['Entwicklung und Implementierung eines Datasource-Plugins für Monitoring-Daten', 'Anbindung einer Programmierschnittstelle zur Abfrage und Verarbeitung von Sensordaten', 'Implementierung einer sicheren Authentifizierung für die Schnittstellenkommunikation', 'Optimierung von Datenabfragen für eine performante Darstellung', 'Koordination laufender Produktionsprozesse und beteiligter Mitarbeiter', 'Auswertung von Produktionsdaten zur Unterstützung der Prozesssteuerung', 'Strukturierte und prozessorientierte Planung operativer Abläufe'];
  const educationTexts = ['Ausbildung zur Fachinformatikerin für Anwendungsentwicklung. Erfolgreich bestandene Abschlussprüfung bei der Kammer. Schwerpunkt auf Softwareentwicklung und der praktischen Umsetzung technischer Anwendungen.', 'Vierjähriges Hochschulstudium im Bereich Industrieingenieurwesen. Der ausländische Hochschulabschluss wurde durch die Zentralstelle für ausländisches Bildungswesen als einem deutschen Hochschulabschluss auf Bachelor-Ebene entsprechend bewertet.', 'Fachrichtung: Pilotenausbildung / Transportfliegerei. Schwerpunkt auf sicherheitskritischen Prozessen, Einsatzplanung und verantwortungsbewusster Entscheidungsfindung.', ''];

  /** The fixed `dense` résumé, or a seeded random one. */
  const buildProfile = (random) => {
    const counts = random
      ? { strengths: int(0, 7), knowledge: int(0, 34), stations: int(1, 5), education: int(1, 4), languages: int(1, 6), certifications: int(0, 6), specials: int(0, 2) }
      : { strengths: Number(process.env.STRENGTHS ?? 6), knowledge: Number(process.env.KNOWLEDGE ?? 10), stations: Number(process.env.STATIONS ?? 3), education: Number(process.env.EDUCATION ?? 4), languages: Number(process.env.LANGUAGES ?? 3), certifications: Number(process.env.CERTIFICATIONS ?? 0), specials: 0 };
    const tokens = { knowledge: [], bullets: [], education: [], strengths: [], languages: [], certifications: [], specials: [] };
    const knowledgeItems = Array.from({ length: counts.knowledge }, (_, index) => {
      const token = `K${String(index).padStart(2, '0')}`;
      const name = random ? text(int(8, 72), token) : `${knowledgeNames[index % knowledgeNames.length]} ${token}`;
      tokens.knowledge.push(token);
      return { id: uid(100 + index), name, level: ['advanced', 'good', 'expert'][index % 3], yearsOfExperience: 1 + (index % 5), lastUsedYear: 2025, description: '', isVisible: true, sortOrder: index };
    });
    const categoryCount = counts.knowledge === 0 ? 0 : random ? int(1, 3) : 2;
    const categories = Array.from({ length: categoryCount }, (_, category) => {
      const from = Math.floor((knowledgeItems.length * category) / categoryCount);
      const to = Math.floor((knowledgeItems.length * (category + 1)) / categoryCount);
      return { id: uid(50 + category), title: ['IT-Kenntnisse', 'Fachliche Kenntnisse', 'Methoden'][category], type: ['it', 'engineering', 'business'][category], displayMode: 'comma-separated', showLevels: false, showYearsOfExperience: false, isVisible: true, sortOrder: category, subcategories: [], items: knowledgeItems.slice(from, to).map((item, order) => ({ ...item, sortOrder: order })) };
    }).filter((category) => category.items.length);
    const strengths = Array.from({ length: counts.strengths }, (_, index) => {
      const token = `S${index}`;
      const title = random ? text(int(10, 60), token) : `${strengthNames[index % strengthNames.length]} ${token}`;
      tokens.strengths.push(token);
      return { id: uid(10 + index), title, description: random && rnd() < 0.3 ? text(int(30, 110), `d${index}`) : '' };
    });
    const languageNames = ['Deutsch', 'Englisch', 'Türkisch', 'Französisch', 'Spanisch', 'Italienisch'];
    const languages = languageNames.slice(0, counts.languages).map((name, index) => { tokens.languages.push(name); return `${name} – ${['C1', 'B2', 'C2', 'A2', 'B1', 'C1'][index]}`; });
    const certifications = Array.from({ length: counts.certifications }, (_, index) => { tokens.certifications.push(`X${index}`); return process.env.SHORT_CERTS ? `Fiktives Zertifikat ${index + 1} X${index}` : text(int(20, 90), `X${index}`); });
    const specialSections = Array.from({ length: counts.specials }, (_, index) => ({
      id: uid(400 + index), kind: 'custom', title: ['Interessen', 'Projekte'][index], isVisible: true, contentType: 'list',
      entries: Array.from({ length: int(2, 6) }, (_, entry) => { tokens.specials.push(`P${index}${entry}`); return { id: uid(420 + index * 10 + entry), title: text(int(12, 60), `P${index}${entry}`), description: '', bullets: [] }; }),
    }));
    const experiences = Array.from({ length: counts.stations }, (_, index) => ({
      id: uid(200 + index), from: `0${(index % 9) + 1}/20${15 + index * 2}`, to: `0${(index % 8) + 2}/20${17 + index * 2}`, role: ['Praktikum Softwareentwicklung', 'Prozessplanerin', 'Transportpilotin', 'Produktionskoordination', 'Qualitätssicherung'][index % 5],
      company: ['Universitätsstadt Muster', 'Beispiel Tekstil AG', 'Muster Luftfahrtbereich', 'Beispiel Werke', 'Muster Qualität'][index % 5], city: 'Musterstadt',
      tasks: Array.from({ length: random ? int(0, 7) : Number(process.env.BULLETS ?? 5 + (index % 3)) }, (_, bullet) => {
        const token = `B${index}_${String(bullet).padStart(3, '0')}`;
        tokens.bullets.push(token);
        return random ? text(int(30, 130), token) : `${bulletPool[bullet % bulletPool.length]} ${token}`;
      }),
      achievements: [],
    }));
    const education = Array.from({ length: counts.education }, (_, index) => {
      tokens.education.push(`E${index}`);
      return { id: uid(300 + index), from: `0${index + 1}/200${index}`, to: `0${index + 2}/200${index + 4}`, degree: `${['Fachinformatikerin für Anwendungsentwicklung', 'Hochschulabschluss in Industrieingenieurwesen', 'Pilotenausbildung', 'Allgemeine Hochschulreife'][index % 4]} E${index}`, institution: ['Muster Akademie GmbH', 'Beispiel Universität', 'Militärisches Ausbildungszentrum', 'Beispiel Gymnasium'][index % 4], city: 'Musterstadt', country: 'Germany', description: random ? (rnd() < 0.6 ? text(int(40, 240), 'ed') : '') : educationTexts[index % 4] };
    });
    return {
      input: {
        id: uid(1), isDefault: true, updatedAt: now, firstName: 'Mina', lastName: 'Kaya',
        title: random ? text(int(10, 90), 'T').replace(' T', '') : 'Industrieingenieurin | Prozessplanung & Produktionskoordination',
        street: 'Musterstraße 12', postalCode: '12345', city: 'Musterstadt', country: 'Germany',
        phone: '+49 170 12345678', email: 'mina.kaya@example.com',
        linkedin: 'https://www.linkedin.com/in/mina-kaya/', github: 'https://github.com/mina-kaya', portfolio: 'https://example.com/',
        summary: random ? text(int(80, 420), 'Z').replace(' Z', '') : process.env.SUMMARY_LENGTH ? text(Number(process.env.SUMMARY_LENGTH), 'Z') : 'Industrieingenieurin mit Erfahrung in Prozessanalyse, Produktionssteuerung und der strukturierten Bearbeitung technischer Aufgabenstellungen. Praxis in der Auswertung technischer Daten und der Optimierung von Prozessen im Monitoring-Umfeld.',
        strengths, languages, certifications, specialSections, experiences, education,
        // Lebenslauf → Sprachen: Punkte / Niveau / Beschreibung (random in RANDOM runs, LANG_DISPLAY=dots,level,description otherwise)
        resumeLanguageDisplay: random
          ? { dots: rnd() < 0.7, level: rnd() < 0.7, description: rnd() < 0.7 }
          : process.env.LANG_DISPLAY ? Object.fromEntries(['dots', 'level', 'description'].map((key) => [key, process.env.LANG_DISPLAY.split(',').includes(key)])) : undefined,
        knowledgeSection: { title: 'Besondere Kenntnisse', isVisible: true, categories },
        resumeClosing: { showPlace: true, showDate: true, showSignature: false },
      },
      tokens,
      zones: random ? { knowledge: rnd() < 0.85 ? 'sidebar' : 'main', certifications: rnd() < 0.5 ? 'sidebar' : 'main', special: rnd() < 0.5 ? 'sidebar' : 'main' } : { knowledge: 'sidebar', certifications: 'sidebar', special: 'sidebar' },
    };
  };

  const randomCount = Number(process.env.RANDOM || 0);
  const scenarios = randomCount ? Array.from({ length: randomCount }, (_, index) => ({ name: `rand${index}`, random: true })) : [{ name: 'dense', random: false }];
  const manifest = [];
  const ids = only.length ? only : ['zeitgenoessisch'];
  for (const scenario of scenarios) {
    const built = buildProfile(scenario.random);
    for (const template of templates.filter((entry) => ids.includes(entry.id))) {
      const id = template.id;
      const base = profileSchema.parse({ ...built.input, photoPath: photo });
      // The user assigned sections to the Seitenspalte: a hand-arranged layout names every zone.
      const arranged = getManagerSections(base, id).filter((entry) => !entry.fixed).map((entry) => ({
        id: entry.id,
        zone: process.env.REORDER && id === 'elegant' && (entry.id === 'summary' || entry.id === 'knowledge') ? 'main'
          : entry.id === 'knowledge' ? built.zones.knowledge : entry.id === 'certifications' ? built.zones.certifications : entry.id.startsWith('special:') ? built.zones.special : entry.zone,
      }));
      if (process.env.REORDER && id === 'elegant') {
        const order = ['experience', 'summary', 'education', 'knowledge', 'languages', 'strengths', 'certifications'];
        arranged.sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
      }
      const profile = setResumePhotoVisible(profileSchema.parse({ ...built.input, photoPath: photo, resumeManagerLayouts: { [id]: arranged } }), true);
      // SURFACES=1: the user colours both columns (Hintergrundfarbe der Haupt- und der Seitenspalte).
      const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: 'visual', ...(process.env.PAGE_MARGIN ? { cvOverrides: { spacing: { pageMarginMm: Number(process.env.PAGE_MARGIN) } } } : {}), ...(process.env.SURFACES ? { resumeAppearance: { sidebarBackgroundColor: '#cfe8d5', mainBackgroundColor: '#f1f6f2' } } : {}) };
      const application = applicationSchema.parse({
        schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
        status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
      });
      const file = `${scenario.name}-${id}`;
      await writeFile(resolve(out, file + '.html'), buildDocumentHtml(application, profile, 'lebenslauf'));
      const resolved = resolveCvDocument({ profile, templateId: id, settings, application });
      const component = await componentOf(id);
      const pages = resolved.pagePlan.map((plan, index) => renderToStaticMarkup(h(ManagedResumePreview, { designSettings: settings, resolvedCv: resolved, profile: resolved.profile, templateId: id, pageNumber: index + 1, totalPages: resolved.pagePlan.length },
        h(component, { profile: resolved.profile, templateId: id, name: `${profile.firstName} ${profile.lastName}`, atsMode: false, plan, totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary,
          photoSource: resolved.profile.photoPath ?? null, resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: settings.backgroundId, closingDate: resolved.closingDate,
          ...(id === 'gepflegt' ? { designVariables: resolved.gepflegtVariables } : {}) }))));
      const paperStyle = Object.entries({ '--doc-accent': template.accent, '--doc-secondary': template.secondary, '--doc-on-secondary': getReadableTextColor(template.secondary), ...getDocumentDesignVariables(settings) })
        .map(([key, value]) => `${key}:${value}`).join(';').replaceAll('"', '&quot;');
      const paper = (page) => `<div class="document-paper document-lebenslauf layout-${template.layout} column-${settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} print-background" style="${paperStyle}">${page}</div>`;
      await writeFile(resolve(out, file + '-preview.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${preflight}${appCss}${resumeTemplateStyleSources[id]} body{margin:0;background:white}</style></head><body>${pages.map(paper).join('')}</body></html>`);
      await writeFile(resolve(out, file + '-plan.json'), JSON.stringify(resolved.pagePlan, null, 1));
      manifest.push({ file, id, scenario: scenario.name,
        zones: process.env.REORDER && id === 'elegant' ? { ...built.zones, knowledge: 'main' } : built.zones,
        tokens: built.tokens, sidebarLane: supportsSidebarContinuation(id) });
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log('fixtures', manifest.length);
} catch (error) { console.error(error); process.exitCode = 1; } finally { await vite.close(); process.exit(process.exitCode ?? 0); }
