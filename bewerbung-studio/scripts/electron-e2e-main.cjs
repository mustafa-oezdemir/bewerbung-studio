const { app, BrowserWindow, dialog } = require('electron');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.BM_E2E_ROOT;
const phase = process.env.BM_E2E_PHASE;
if (!root || !['create', 'reopen', 'hold', 'second'].includes(phase))
  throw new Error('Isolated E2E fixture is required');
app.setPath('userData', path.join(root, 'userData'));
process.env.BEWERBUNG_ROOT_PATH = path.join(root, 'workspace');
BrowserWindow.prototype.show = function () {};

let finished = false;
const fail = (error) => {
  if (finished) return;
  finished = true;
  console.error(error);
  app.exit(1);
};
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
dialog.showErrorBox = (title, content) => fail(new Error(`${title}: ${content}`));
setTimeout(() => fail(new Error(`Electron E2E ${phase} timed out`)), 60_000).unref();

const createScenario = `(async () => {
  const api = window.bewerbungsManager;
  if (!api) throw new Error('preload API is missing');
  const initial = await api.workspace.get();
  if (initial.applications.length !== 0) throw new Error('fixture was not empty');
  let rejected = false;
  let rejection = '';
  try { await api.applications.create({}); }
  catch (error) { rejected = true; rejection = String(error?.message); }
  const afterInvalid = await api.workspace.get();
  if (!rejected || !rejection.startsWith('Die eingegebenen Daten sind ungültig.') ||
      afterInvalid.applications.length !== 0)
    throw new Error('invalid IPC input was not rejected without side effects');
  const profileId = crypto.randomUUID();
  await api.profiles.save({ id: profileId, isDefault: true, firstName: 'Erika',
    lastName: 'Beispiel', email: 'erika@example.test', updatedAt: new Date().toISOString() });
  const created = await api.applications.create({
    company: { name: 'E2E Beispiel GmbH', city: 'Berlin' },
    contact: {}, job: { title: 'Softwareentwickler' },
    templateId: 'classic-professional', accentColor: '#155e58', profileId,
    notes: 'synthetic E2E data',
  });
  if (created.applications.length !== 1) throw new Error('application was not created');
  await api.settings.save({ ...created.settings, theme: 'dark' });
  const now = new Date().toISOString();
  await api.todos.save({ id: crypto.randomUUID(), title: 'E2E Nachverfolgung',
    priority: 'high', completed: false, createdAt: now, updatedAt: now });
  const saved = await api.workspace.get();
  if (saved.settings.theme !== 'dark' || saved.todos.length !== 1 ||
      saved.profiles.length !== 1 || saved.applications.length !== 1)
    throw new Error('multi-step IPC changes were not persisted');
  return saved.applications[0].id;
})()`;

const verifyScenario = `(async () => {
  const api = window.bewerbungsManager;
  if (!api) throw new Error('preload API is missing after restart');
  const workspace = await api.workspace.get();
  if (workspace.applications.length !== 1 || workspace.todos.length !== 1 ||
      workspace.settings.theme !== 'dark' ||
      workspace.applications[0].company.name !== 'E2E Beispiel GmbH' ||
      workspace.applications[0].profileId !== workspace.profiles[0]?.id)
    throw new Error('saved data was not restored after process restart');
  const active = document.querySelector('button.nav-item[title="Aktive Bewerbungen"]');
  const todo = document.querySelector('button.nav-item[title="ToDo"]');
  if (!active || !todo) throw new Error('application and todo navigation are missing');
  active.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!document.body.innerText.includes('E2E Beispiel GmbH'))
    throw new Error('application did not render after navigation');
  todo.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!document.body.innerText.includes('E2E Nachverfolgung'))
    throw new Error('todo did not render after navigation');
  await api.applications.changeStatus(workspace.applications[0].id, 'Beworben');
  return workspace.applications[0].id;
})()`;

const verifyReloadScenario = `(async () => {
  const workspace = await window.bewerbungsManager.workspace.get();
  if (workspace.applications.length !== 1 || workspace.applications[0].status !== 'Beworben' ||
      workspace.todos[0].title !== 'E2E Nachverfolgung')
    throw new Error('status or todo was lost after renderer reload');
  return true;
})()`;

let reloadPending = false;
app.on('browser-window-created', (_, window) => {
  if (phase === 'second') { fail(new Error('Second Electron instance opened a window')); return; }
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') fail(new Error(event.message));
  });
  window.webContents.on('preload-error', (_, _preloadPath, error) => fail(error));
  window.webContents.on('render-process-gone', (_, details) => fail(new Error(JSON.stringify(details))));
  window.webContents.on('did-fail-load', (_, code, description) => fail(new Error(`${description}: ${code}`)));
  window.webContents.on('did-finish-load', async () => {
    if (finished) return;
    try {
      let mounted = false;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        mounted = await window.webContents.executeJavaScript(
          "Boolean(document.querySelector('button.nav-item[title=\"Aktive Bewerbungen\"]'))",
        );
        if (mounted) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!mounted) throw new Error('React workspace did not mount');
      if (phase === 'hold') {
        fs.writeFileSync(path.join(root, 'holder-ready'), 'ready');
        const watch = setInterval(() => {
          if (fs.existsSync(path.join(root, 'holder-stop'))) {
            clearInterval(watch);
            finished = true;
            app.exit(0);
          }
        }, 100);
        return;
      }
      if (phase === 'create') {
        await window.webContents.executeJavaScript(createScenario);
        console.log('Electron E2E: create, validation, settings and todo passed');
      } else if (!reloadPending) {
        await window.webContents.executeJavaScript(verifyScenario);
        reloadPending = true;
        window.webContents.reload();
        return;
      } else {
        await window.webContents.executeJavaScript(verifyReloadScenario);
        console.log('Electron E2E: process restart and renderer reload passed');
      }
      finished = true;
      app.exit(0);
    } catch (error) { fail(error); }
  });
});

import(pathToFileURL(path.resolve('dist-electron/main.js')).href).catch(fail);
