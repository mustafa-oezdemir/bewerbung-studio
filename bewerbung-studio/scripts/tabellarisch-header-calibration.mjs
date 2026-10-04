// Tabellarisch header calibration (see src/shared/resumeHeaderGeometry.ts). Writes the PDF HTML of
//  - every single Kontaktdaten checkbox switched off from "everything on" (with and without photo),
//  - every pair of the link contacts,
//  - seeded random contact subsets with random lengths, titles and names
// into tmp/tabellarisch-header-calib; measure with check-tabellarisch-header-calibration.cjs (real Chromium) and
// compare with the model with `node scripts/evaluate-tabellarisch-header.mjs`.
//   env: RANDOM=<n> (default 120), SEED=<n>
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const out = resolve('tmp/tabellarisch-header-calib');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { getTemplate } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const templateId = 'tabellarisch';
  const now = '2026-10-03T10:00:00.000Z';
  let seed = Number(process.env.SEED || 11);
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];

  const checkboxes = ['address', 'phone', 'email', 'linkedin', 'github', 'website', 'onlineProfiles', 'birthDate', 'birthPlace', 'nationality', 'familyStatus', 'children', 'xing'];
  const allOn = Object.fromEntries([...checkboxes, 'drivingLicense'].map((key) => [key, true]));
  const base = {
    firstName: 'Mina', lastName: 'Beispiel', title: 'Technisch und prozessorientierter Quereinsteiger mit Erfahrung im Produktionsumfeld',
    phone: '+49 176 12345678', email: 'mina.beispiel1408@example.com', linkedin: 'https://www.linkedin.com/in/mina-beispiel-k/',
    github: 'https://github.com/mina-beispiel-gh', portfolio: 'https://pehlione.com/',
    street: 'Beispielallee 20', postalCode: '35039', city: 'Marburg', country: 'Deutschland',
    birthDate: '1990-11-25', birthPlace: 'Musterdorf', nationality: 'deutsch', familyStatus: 'verheiratet', children: '2 Kinder',
    onlineProfiles: [
      { id: '9e000000-0000-4000-8000-000000000002', label: 'Xing', url: 'https://www.xing.com/profile/Mina_Beispiel' },
      { id: '9e000000-0000-4000-8000-000000000003', label: 'GitLab', url: 'https://gitlab.com/mina-beispiel' },
    ],
  };
  const variants = [];
  const add = (name, fields, visibility, hasPhoto) => variants.push({ name, fields: { ...base, ...fields }, visibility: { ...allOn, ...visibility }, photo: hasPhoto });

  for (const hasPhoto of [false, true]) {
    const tag = hasPhoto ? 'photo' : 'plain';
    add(`${tag}-all-on`, {}, {}, hasPhoto);
    for (const key of checkboxes) add(`${tag}-off-${key}`, {}, { [key]: false }, hasPhoto);
    // the user's header: phone, e-mail, LinkedIn, address, GitHub (+ Website)
    const user = { birthDate: false, birthPlace: false, nationality: false, familyStatus: false, children: false, onlineProfiles: false, xing: false };
    add(`${tag}-user-website-off`, {}, { ...user, website: false }, hasPhoto);
    add(`${tag}-user-website-on`, {}, { ...user, website: true }, hasPhoto);
    for (const links of [['linkedin', 'github'], ['linkedin', 'website'], ['github', 'website'], ['linkedin', 'github', 'website']])
      add(`${tag}-links-${links.join('+')}`, {}, { ...user, linkedin: links.includes('linkedin'), github: links.includes('github'), website: links.includes('website') }, hasPhoto);
    add(`${tag}-long-website`, { portfolio: 'https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung' }, user, hasPhoto);
    add(`${tag}-long-email`, { email: 'mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com' }, user, hasPhoto);
    add(`${tag}-long-linkedin`, { linkedin: 'https://www.linkedin.com/in/mina-beispiel-senior-entwicklerin-prozessplanung-123456789/' }, user, hasPhoto);
    add(`${tag}-long-title`, { title: 'Technisch und prozessorientierter Quereinsteiger mit langjähriger Erfahrung im Produktionsumfeld sowie in der Prozessplanung und Digitalisierung' }, user, hasPhoto);
    add(`${tag}-long-name`, { firstName: 'Mina-Alexandra', lastName: 'Beispiel-Schmidt-Wolkenstein' }, user, hasPhoto);
    add(`${tag}-no-title`, { title: '' }, user, hasPhoto);
  }
  const words = 'Senior Softwareentwickler Fachinformatiker für Anwendungsentwicklung Plattformen Projektleitung Prozessplanung Digitalisierung Industrieingenieur Datenanalyse'.split(' ');
  const titleOf = (n) => { let t = ''; while (t.length < n) t += (t ? ' ' : '') + pick(words); return t; };
  const total = Number(process.env.RANDOM || 120);
  for (let i = 0; i < total; i += 1) {
    const hasPhoto = rnd() < 0.5;
    const visibility = Object.fromEntries(checkboxes.map((key) => [key, rnd() < 0.55]));
    const fields = {
      firstName: pick(['Mina', 'Mustafa', 'Mustafa-Alexander']), lastName: pick(['Kaya', 'Özdemir', 'Özdemir-Schmidt-Wolkenstein']), title: titleOf(pick([0, 25, 45, 65, 90, 120, 150])),
      email: pick(['mina@example.com', 'mina.beispiel1408@example.com', 'mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com']),
      linkedin: pick(['https://linkedin.com/in/mina', 'https://www.linkedin.com/in/mina-beispiel-k/', 'https://www.linkedin.com/in/mina-beispiel-senior-entwicklerin-prozessplanung-123456789/']),
      github: pick(['https://github.com/mina', 'https://github.com/mina-beispiel-gh']),
      portfolio: pick(['https://mina.de', 'https://pehlione.com/', 'https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung']),
      street: pick(['', 'Beispielallee 20', 'Musterweg Nummer 120 b']), country: pick(['', 'Deutschland']), birthPlace: pick(['', 'Musterdorf']),
    };
    add(`random-${i}`, fields, visibility, hasPhoto);
  }

  const manifest = [];
  for (const [index, variant] of variants.entries()) {
    const parsed = profileSchema.parse({
      id: '9e000000-0000-4000-8000-000000000001', isDefault: true, updatedAt: now, ...variant.fields, photoPath: variant.photo ? photo : '',
      summary: 'Kurzer Überblick.', resumePersonalFieldVisibility: variant.visibility,
      experiences: [{ id: '9e000000-0000-4000-8000-000000000010', from: '2020', to: '2022', role: 'Assistentin', company: 'Beispiel AG', achievements: ['Ein Erfolg'] }],
      education: [{ id: '9e000000-0000-4000-8000-000000000020', from: '2016', to: '2019', degree: 'Abschluss', institution: 'Schule' }],
      languages: ['Deutsch – C1'], strengths: [{ id: '9e000000-0000-4000-8000-000000000030', title: 'Teamarbeit', description: '' }],
    });
    const profile = variant.photo ? setResumePhotoVisible(parsed, true) : parsed;
    const template = getTemplate(templateId);
    const settings = { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: 'visual' };
    const application = applicationSchema.parse({
      schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
      status: 'Entwurf', templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    const file = `c${String(index).padStart(3, '0')}-${variant.name}`;
    await writeFile(resolve(out, `${file}.html`), buildDocumentHtml(application, profile, 'lebenslauf'));
    // the profile without the photo data (the evaluation rebuilds it)
    manifest.push({ file, name: variant.name, photo: variant.photo, fields: variant.fields, visibility: variant.visibility });
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log('fixtures', manifest.length);
} finally { await vite.close(); }
