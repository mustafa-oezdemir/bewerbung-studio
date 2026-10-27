const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const electron = require('electron');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true,
  env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();
const gitEnvironment = (root) => ({ ...process.env, BM_E2E_ROOT: root,
  BEWERBUNG_GIT_SYNC_TEST_REMOTE: path.join(root, 'remote.git'), GIT_CONFIG_NOSYSTEM: '1' });

const run = (root, phase) => new Promise((resolve, reject) => {
  const child = spawn(electron, [path.resolve('scripts/electron-e2e-main.cjs')], {
    cwd: process.cwd(),
    env: { ...gitEnvironment(root), BM_E2E_PHASE: phase },
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (data) => { output += data.toString(); });
  child.stderr.on('data', (data) => { output += data.toString(); });
  const timer = setTimeout(() => child.kill(), 70_000);
  child.on('error', (error) => { clearTimeout(timer); reject(error); });
  child.on('exit', (code) => {
    clearTimeout(timer);
    if (code === 0) { process.stdout.write(output); resolve(); }
    else reject(new Error(`Electron E2E ${phase} failed (exit ${code}):\n${output}`));
  });
});

const verifySecondInstance = async (root, workspaceFile) => {
  const holder = spawn(electron, [path.resolve('scripts/electron-e2e-main.cjs')], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...gitEnvironment(root), BM_E2E_PHASE: 'hold' },
  });
  let holderOutput = '';
  holder.stdout.on('data', (data) => { holderOutput += data.toString(); });
  holder.stderr.on('data', (data) => { holderOutput += data.toString(); });
  const holderExit = new Promise((resolve, reject) => {
    holder.once('error', reject);
    holder.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Holder exited ${code}: ${holderOutput}`)));
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      ready = await fs.stat(path.join(root, 'holder-ready')).then(() => true, () => false);
      if (ready) break;
      if (holder.exitCode !== null) throw new Error(`Holder exited before ready: ${holderOutput}`);
      await delay(100);
    }
    if (!ready) throw new Error('First Electron instance did not become ready');
    const before = await fs.readFile(workspaceFile);
    await run(root, 'second');
    if (!(await fs.readFile(workspaceFile)).equals(before))
      throw new Error('Second Electron instance changed the workspace');
    console.log('Electron E2E: simultaneous second instance did not write');
  } finally {
    await fs.writeFile(path.join(root, 'holder-stop'), 'stop');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { holder.kill(); reject(new Error('Holder did not stop')); }, 10_000);
      holderExit.then(() => { clearTimeout(timer); resolve(); },
        (error) => { clearTimeout(timer); reject(error); });
    });
  }
};

/** Vorstellungsgespräch – Fragen & Antworten: files on disk, in Git and after a restart and a new interview date. */
const verifyInterviewNotes = async (root, local, remote) => {
  await run(root, 'interview');
  const interviews = path.join(local, 'data', 'Vorstellungsgespräch');
  const folder = path.join(interviews, 'Seidel_GmbH_&_Co._KG_2026-10-22');
  const names = (await fs.readdir(folder)).sort();
  if (names.join() !== 'Vorstellungsgespräch_Seidel.md,Vorstellungsgespräch_Seidel_1.md') throw new Error(`interview folder: ${names}`);
  const first = await fs.readFile(path.join(folder, 'Vorstellungsgespräch_Seidel.md'));
  const firstText = first.toString('utf8');
  if (!firstText.startsWith('# Vorstellungsgespräch\n\n## Frage 1: Erste Frage 1 – Größe & Übung?\n\n### Erklärung\n') ||
      (firstText.match(/^## Frage \d+:/gm) ?? []).length !== 10 || !firstText.includes('\n---\n'))
    throw new Error('first Markdown file has the wrong structure');
  const pathspec = (name) => `main:data/Vorstellungsgespräch/Seidel_GmbH_&_Co._KG_2026-10-22/${name}`;
  if (git(remote, '-c', 'core.quotePath=false', 'show', pathspec('Vorstellungsgespräch_Seidel_1.md')).split('## Frage').length !== 4)
    throw new Error('second interview file did not reach the remote');
  const subjects = git(remote, 'log', '--format=%s', 'main');
  for (const name of ['Vorstellungsgespräch_Seidel.md', 'Vorstellungsgespräch_Seidel_1.md'])
    if (!subjects.includes(`Vorstellungsgespräch vorbereitet: Seidel GmbH & Co. KG – Fachinformatiker – ${name} angelegt`))
      throw new Error(`interview commits are not identifiable: ${subjects}`);
  await run(root, 'interview-reopen');
  const moved = path.join(interviews, 'Seidel_GmbH_&_Co._KG_2026-10-23');
  if ((await fs.readdir(interviews)).join() !== 'Seidel_GmbH_&_Co._KG_2026-10-23')
    throw new Error(`interview folders after the date change: ${await fs.readdir(interviews)}`);
  if (!(await fs.readFile(path.join(moved, 'Vorstellungsgespräch_Seidel.md'))).equals(first))
    throw new Error('the first interview file changed');
  const edited = await fs.readFile(path.join(moved, 'Vorstellungsgespräch_Seidel_1.md'), 'utf8');
  if (!edited.includes('Geänderte Antwort 3') || (await fs.readdir(moved)).length !== 2)
    throw new Error('the edited file was not updated in place');
  if (!git(remote, 'log', '--format=%s', 'main').includes(
    'Vorstellungsgespräch vorbereitet: Seidel GmbH & Co. KG – Fachinformatiker – Vorstellungsgespräch_Seidel_1.md geändert'))
    throw new Error('the edit was not committed as interview preparation');
  const leftovers = git(local, 'status', '--porcelain', '--untracked-files=all', '--', 'data').split('\n')
    .filter((line) => line && !/new-application-draft\.json|Setting\/(Logs|CrashDumps|ElectronSession|cache)\//.test(line));
  if (leftovers.length) throw new Error(`interview notes left unsynchronised changes: ${leftovers.join(', ')}`);
  if (git(local, 'rev-parse', 'HEAD') !== git(remote, 'rev-parse', 'main'))
    throw new Error('the interview changes did not reach the remote');
  console.log('Electron E2E: interview notes verified on disk and in the remote');
};

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bm-electron-e2e-'));
  let passed = false;
  try {
    const settings = path.join(root, 'workspace', 'data', 'Setting', 'Settings');
    await fs.mkdir(settings, { recursive: true });
    await fs.mkdir(path.join(root, 'workspace', 'data', 'Bewerbungen'), { recursive: true });
    await fs.mkdir(path.join(root, 'userData'), { recursive: true });
    await fs.writeFile(path.join(settings, 'workspace.json'), JSON.stringify({
      schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
      settings: {
        followUpDays: null, notificationsEnabled: false, theme: 'system',
        archiveAccepted: false, language: 'de',
      }, updatedAt: new Date().toISOString(),
    }));
    await fs.writeFile(path.join(settings, 'security-choice.json'), JSON.stringify({ completed: true }));
    const local = path.join(root, 'workspace');
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '--quiet', '--bare', '--initial-branch=main', remote);
    git(local, 'init', '--quiet', '--initial-branch=main');
    git(local, 'config', 'user.name', 'E2E Test');
    git(local, 'config', 'user.email', 'e2e@example.invalid');
    git(local, 'remote', 'add', 'origin', remote);
    git(local, 'add', '--', 'data');
    git(local, 'commit', '--quiet', '-m', 'Initialer Testdatenbestand');
    git(local, 'push', '--quiet', '-u', 'origin', 'main');
    await run(root, 'create');
    const afterCreate = JSON.parse(git(remote, 'show', 'main:data/Setting/Settings/workspace.json'));
    const createdApplication = afterCreate.applications[0] &&
      JSON.parse(git(remote, 'show', `main:${afterCreate.applications[0].path}`));
    if (afterCreate.applications.length !== 1 || !createdApplication?.documents.coverMainBody)
      throw new Error('Electron application and document changes were not pushed');
    const message = git(remote, 'log', '-1', '--format=%B', 'main');
    const history = git(remote, 'log', '--format=%B', 'main');
    if (!history.includes('Anschreiben aktualisiert') || !history.includes('Lebenslauf aktualisiert'))
      throw new Error('Electron commit message did not name document changes');
    if (!message.startsWith('Termin aktualisiert: E2E Beispiel GmbH – Softwareentwickler – Vorstellungsgespräch'))
      throw new Error('Electron commit message did not name the moved appointment');
    if (git(remote, 'log', '-p', 'main').includes('E2E Entwurf GmbH'))
      throw new Error('the unsaved application draft was pushed');
    await run(root, 'reopen');
    const afterStatus = JSON.parse(git(remote, 'show', 'main:data/Setting/Settings/workspace.json'));
    const statusApplication = JSON.parse(git(remote, 'show', `main:${afterStatus.applications[0].path}`));
    if (statusApplication.status !== 'Beworben' ||
        git(local, 'rev-parse', 'HEAD') !== git(remote, 'rev-parse', 'main'))
      throw new Error('Electron status change did not reach the bare remote');
    const workspaceFile = path.join(settings, 'workspace.json');
    await verifySecondInstance(root, workspaceFile);
    // Two more starts (holder, second instance) leave nothing behind but the unsaved draft: no rewritten timestamps,
    // no Deckblatt regenerated because its name ("Bäcker") was looked up in another spelling.
    const leftovers = git(local, 'status', '--porcelain', '--untracked-files=all', '--', 'data').split('\n')
      .filter((line) => line && !/new-application-draft\.json|Setting\/(Logs|CrashDumps|ElectronSession|cache)\//.test(line));
    if (leftovers.length) throw new Error(`Electron left unsynchronised changes: ${leftovers.join(', ')}`);
    const saved = JSON.parse(await fs.readFile(workspaceFile, 'utf8'));
    const savedApplication = JSON.parse(await fs.readFile(path.join(local, saved.applications[0].path), 'utf8'));
    if (savedApplication.status !== 'Beworben' || saved.settings.theme !== 'dark')
      throw new Error('on-disk state disagrees with Electron E2E');
    await verifyInterviewNotes(root, local, remote);
    await run(root, 'profiles');
    await run(root, 'profiles-reopen');
    const profilePdfs = JSON.parse(await fs.readFile(path.join(root, 'profile-pdfs.json'), 'utf8'));
    for (const file of [profilePdfs.alpha, profilePdfs.beta]) {
      const bytes = await fs.readFile(file);
      if (bytes.length < 1000 || bytes.subarray(0, 4).toString() !== '%PDF')
        throw new Error('Application profile PDF was not generated');
    }
    console.log('Electron E2E: two real Chromium PDFs verified');
    passed = true;
  } finally {
    const resolved = path.resolve(root);
    if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`) ||
        !path.basename(resolved).startsWith('bm-electron-e2e-'))
      throw new Error('Unexpected Electron E2E test directory');
    if (process.env.BM_E2E_KEEP !== '1')
      await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    else console.log(`E2E diagnostic fixture: ${root}`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
