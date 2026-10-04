const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const electron = require('electron');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (root, phase) => new Promise((resolve, reject) => {
  const child = spawn(electron, [path.resolve('scripts/electron-e2e-main.cjs')], {
    cwd: process.cwd(),
    env: { ...process.env, BM_E2E_ROOT: root, BM_E2E_PHASE: phase },
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
    env: { ...process.env, BM_E2E_ROOT: root, BM_E2E_PHASE: 'hold' },
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
    await run(root, 'create');
    await run(root, 'reopen');
    const workspaceFile = path.join(settings, 'workspace.json');
    await verifySecondInstance(root, workspaceFile);
    const saved = JSON.parse(await fs.readFile(workspaceFile, 'utf8'));
    if (saved.applications[0]?.status !== 'Beworben' || saved.settings.theme !== 'dark')
      throw new Error('on-disk state disagrees with Electron E2E');
    passed = true;
  } finally {
    const resolved = path.resolve(root);
    if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`) ||
        !path.basename(resolved).startsWith('bm-electron-e2e-'))
      throw new Error('Unexpected Electron E2E test directory');
    if (passed || process.env.BM_E2E_KEEP !== '1')
      await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    else console.error(`E2E diagnostic fixture: ${root}`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
