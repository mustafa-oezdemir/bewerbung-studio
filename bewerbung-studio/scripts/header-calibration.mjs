// Header calibration fixtures (see src/shared/resumeHeaderGeometry.ts): measure with check-header-calibration.cjs, fit with fit-header-model.py.
// Calibration fixtures for the header growth model: many profiles × every template (visual), written as HTML.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const out = resolve('tmp/calib');
await mkdir(out, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, server: { middlewareMode: true } });
try {
  const { buildDocumentHtml } = await vite.ssrLoadModule('/electron/documents.ts');
  const { profileSchema, applicationSchema } = await vite.ssrLoadModule('/src/shared/schema.ts');
  const { templates } = await vite.ssrLoadModule('/src/shared/templates.ts');
  const { getTemplateDocumentDesignDefaults } = await vite.ssrLoadModule('/src/shared/cvDesign.ts');
  const { getResumeHeaderContactTexts } = await vite.ssrLoadModule('/src/shared/resumePersonalData.ts');
  const { getResumeDisplayProfile } = await vite.ssrLoadModule('/src/shared/resumeDisplayProfile.ts');
  const { setResumePhotoVisible } = await vite.ssrLoadModule('/src/shared/resumePhoto.ts');
  const photo = (await readFile('scripts/fixtures/qa-photo.b64', 'utf8')).trim();
  const now = new Date().toISOString();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const words = 'Senior Softwareentwickler Fachinformatiker für Anwendungsentwicklung Plattformen Projektleitung Prozessplanung Digitalisierung Industrieingenieur Datenanalyse'.split(' ');
  const title = (n) => { let t = ''; while (t.length < n) t += (t ? ' ' : '') + pick(words) + (rnd() < 0.2 ? ' |' : ''); return t.replace(/\s\|$/, ''); };
  const keys = ['phone', 'email', 'linkedin', 'github', 'website', 'address', 'birth', 'nationality', 'familyStatus', 'children', 'xing', 'gitlab'];
  const variants = [];
  for (let i = 0; i < 46; i++) {
    const count = i < 2 ? (i === 0 ? 0 : 12) : Math.floor(rnd() * 13);
    const chosen = new Set([...keys].sort(() => rnd() - 0.5).slice(0, count));
    const long = rnd() < 0.4;
    const titleLen = pick([0, 25, 45, 65, 90, 120, 150]);
    const name = pick([['Mina', 'Kaya'], ['Mustafa', 'Özdemir'], ['Mustafa-Alexander', 'Özdemir-Schmidt-Wolkenstein']]);
    variants.push({
      firstName: name[0], lastName: name[1], title: title(titleLen),
      phone: chosen.has('phone') ? '+49 170 1234567' : '', email: chosen.has('email') ? (long ? 'mustafa.alexander.oezdemir1990@example-mail.com' : 'mina@example.com') : '',
      linkedin: chosen.has('linkedin') ? (long ? 'https://www.linkedin.com/in/mustafa-alexander-oezdemir-schmidt-123456' : 'https://linkedin.com/in/mina') : '',
      github: chosen.has('github') ? 'https://github.com/mustafa-oezdemir' : '',
      portfolio: chosen.has('website') ? (long ? 'https://www.mustafa-oezdemir-portfolio.example.org/projekte' : 'https://mina.de') : '',
      street: chosen.has('address') && rnd() < 0.7 ? 'Am Richtsberg 20' : '', postalCode: chosen.has('address') ? '35039' : '', city: chosen.has('address') ? 'Marburg' : '',
      country: chosen.has('address') ? 'Deutschland' : '',
      birthDate: chosen.has('birth') ? '1990-11-25' : '', birthPlace: chosen.has('birth') && rnd() < 0.6 ? 'Gerze' : '',
      nationality: chosen.has('nationality') ? 'deutsch' : '', familyStatus: chosen.has('familyStatus') ? 'verheiratet' : '', children: chosen.has('children') ? '2 Kinder' : '',
      onlineProfiles: [
        ...(chosen.has('xing') ? [{ id: '9a000000-0000-4000-8000-000000000002', label: 'Xing', url: 'https://www.xing.com/profile/Mustafa_Oezdemir' }] : []),
        ...(chosen.has('gitlab') ? [{ id: '9a000000-0000-4000-8000-000000000003', label: 'GitLab', url: 'https://gitlab.com/mustafa' }] : []),
      ],
    });
  }
  const allVisible = Object.fromEntries(['address', 'phone', 'email', 'linkedin', 'github', 'website', 'onlineProfiles', 'birthDate', 'birthPlace', 'nationality', 'familyStatus', 'children', 'drivingLicense', 'xing'].map((k) => [k, true]));
  const manifest = [];
  for (const [index, base] of [...variants, ...variants.map((v) => ({ ...v, photo: true }))].entries()) {
    const v = { photo: false, ...base };
    const parsed = profileSchema.parse({
      id: '9a000000-0000-4000-8000-000000000001', isDefault: true, updatedAt: now, ...v, photoPath: v.photo ? photo : '',
      summary: 'Kurzer Überblick.', resumePersonalFieldVisibility: allVisible,
      experiences: [{ id: '9a000000-0000-4000-8000-000000000010', from: '2020', to: '2022', role: 'Assistentin', company: 'Beispiel AG', achievements: ['Ein Erfolg'] }],
      education: [{ id: '9a000000-0000-4000-8000-000000000020', from: '2016', to: '2019', degree: 'Abschluss', institution: 'Schule' }],
      languages: ['Deutsch – C1'], strengths: [{ id: '9a000000-0000-4000-8000-000000000030', title: 'Teamarbeit', description: '' }],
    });
    const profile = v.photo ? setResumePhotoVisible(parsed, true) : parsed;
    const contacts = getResumeHeaderContactTexts(getResumeDisplayProfile(profile));
    for (const template of templates) {
      const id = template.id;
      const settings = { ...getTemplateDocumentDesignDefaults(id), resumeOutputMode: 'visual' };
      const application = applicationSchema.parse({
        schemaVersion: 1, id: crypto.randomUUID(), folderName: 'QA', company: { name: 'QA', city: 'Berlin' }, contact: {}, job: { title: 'Entwicklung' },
        status: 'Entwurf', templateId: id, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
      });
      const file = `${id}-${index}`;
      await writeFile(resolve(out, file + '.html'), buildDocumentHtml(application, profile, 'lebenslauf'));
      manifest.push({ file, id, index, photo: v.photo, contacts: contacts.map((c) => c.length), title: profile.title.length, name: `${profile.firstName} ${profile.lastName}`.length });
    }
  }
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
  console.log('fixtures', manifest.length);
} finally { await vite.close(); }
