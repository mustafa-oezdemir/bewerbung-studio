const { app, BrowserWindow, dialog } = require('electron');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.BM_E2E_ROOT;
const phase = process.env.BM_E2E_PHASE;
if (!root || !['create', 'reopen', 'hold', 'second', 'interview', 'interview-reopen', 'profiles', 'profiles-reopen'].includes(phase))
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
if (phase === 'profiles-reopen')
  dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: options.defaultPath });
setTimeout(() => fail(new Error(`Electron E2E ${phase} timed out`)), 60_000).unref();

const createScenario = `(async () => {
  const api = window.bewerbungsManager;
  if (!api) throw new Error('preload API is missing');
  // The IPC result arrives after the local save ("pending"); the commit and push are reported as an event.
  const outcomes = [];
  api.gitSync.onStatus((outcome, syncId) => outcomes.push({ outcome, syncId }));
  const pushed = async (result, label) => {
    if (result.gitSync.state !== 'pending' || typeof result.gitSync.syncId !== 'number')
      throw new Error(label + ': the local result did not hand Git to the background');
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const hit = outcomes.find((entry) => entry.syncId >= result.gitSync.syncId);
      if (hit) {
        if (hit.outcome.state !== 'synced' || !hit.outcome.pushed) throw new Error(label + ': ' + JSON.stringify(hit.outcome));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(label + ': no GitHub outcome arrived');
  };
  const status = await api.system.workspaceStatus();
  if (status.state !== 'ready' || typeof status.root !== 'string')
    throw new Error('preload did not unwrap the workspace status IPC result');
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
    lastName: 'Bäcker', email: 'erika@example.test', updatedAt: new Date().toISOString() });
  const created = await api.applications.create({
    company: { name: 'E2E Beispiel GmbH', city: 'Berlin' },
    contact: {}, job: { title: 'Softwareentwickler' },
    templateId: 'classic-professional', accentColor: '#155e58', profileId,
    notes: 'synthetic E2E data',
  });
  if (created.workspace.applications.length !== 1) throw new Error('application was not created');
  await pushed(created, 'application creation was not pushed from Electron');
  const documentChange = structuredClone(created.workspace.applications[0]);
  documentChange.documents.coverMainBody = 'Fiktiver Anschreibentext';
  documentChange.documents.resumeProfile = 'Fiktives Kurzprofil';
  documentChange.documents.deckblattStatement = 'Fiktives Deckblatt';
  documentChange.documents.motivationIntroduction = 'Fiktive Motivation';
  documentChange.interviewAt = '2026-10-20T09:00:00.000Z';
  const updated = await api.applications.save(documentChange);
  await pushed(updated, 'document and appointment changes were not pushed from Electron');
  // Saving the same Bewerbung again without a change: no Git work at all.
  const unchanged = await api.applications.save(structuredClone(updated.workspace.applications[0]));
  if (unchanged.gitSync.state !== 'skipped') throw new Error('an unchanged save started a synchronisation');
  const interview = structuredClone(updated.workspace.events.find((event) =>
    event.applicationId === documentChange.id && event.type === 'interview'));
  interview.startAt = '2026-10-21T10:30:00.000Z';
  const moved = await api.events.save(interview);
  await pushed(moved, 'the moved interview appointment was not pushed from Electron');
  // The unsaved wizard draft lives in the data tree but must never be pushed.
  await api.applicationDraft.save({ company: { name: 'E2E Entwurf GmbH' } });
  await api.settings.save({ ...created.workspace.settings, theme: 'dark' });
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
  // The IPC result arrives after the local save ("pending"); the commit and push are reported as an event.
  const outcomes = [];
  api.gitSync.onStatus((outcome, syncId) => outcomes.push({ outcome, syncId }));
  const pushed = async (result, label) => {
    if (result.gitSync.state !== 'pending' || typeof result.gitSync.syncId !== 'number')
      throw new Error(label + ': the local result did not hand Git to the background');
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const hit = outcomes.find((entry) => entry.syncId >= result.gitSync.syncId);
      if (hit) {
        if (hit.outcome.state !== 'synced' || !hit.outcome.pushed) throw new Error(label + ': ' + JSON.stringify(hit.outcome));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(label + ': no GitHub outcome arrived');
  };
  const status = await api.system.workspaceStatus();
  if (status.state !== 'ready') throw new Error('workspace status was not restored after restart');
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
  const statusChange = await api.applications.changeStatus(workspace.applications[0].id, 'Beworben');
  await pushed(statusChange, 'status change was not pushed from Electron');
  return workspace.applications[0].id;
})()`;

const verifyReloadScenario = `(async () => {
  const workspace = await window.bewerbungsManager.workspace.get();
  if (workspace.applications.length !== 1 || workspace.applications[0].status !== 'Beworben' ||
      workspace.todos[0].title !== 'E2E Nachverfolgung')
    throw new Error('status or todo was lost after renderer reload');
  return true;
})()`;

const createApplicationProfilesScenario = `(async () => {
  const api = window.bewerbungsManager;
  const workspace = await api.workspace.get();
  const source = workspace.profiles[0];
  const alpha = workspace.applications.find((item) => item.company.name === 'E2E Beispiel GmbH');
  if (!source || !alpha?.profileSnapshot) throw new Error('profile source or initial application missing');
  await api.applications.save({ ...alpha, profileSnapshot: { ...alpha.profileSnapshot,
    title: 'Java Backend', summary: 'Java Backend', skills: ['Java', 'Spring Boot'] } });
  const created = await api.applications.create({
    company: { name: 'E2E Zweite GmbH', city: 'Berlin' }, contact: {}, job: { title: 'Golang Backend' },
    templateId: 'classic-professional', accentColor: '#155e58', profileId: source.id, notes: '',
  });
  const beta = created.workspace.applications.find((item) => item.company.name === 'E2E Zweite GmbH');
  await api.applications.save({ ...beta, profileSnapshot: { ...beta.profileSnapshot,
    title: 'Golang Backend', summary: 'Golang Backend', skills: ['Go', 'Docker'] } });
  await api.profiles.save({ ...source, title: 'Zentrale Version', summary: 'Zentrale Version' });
  return true;
})()`;

const verifyApplicationProfilesScenario = `(async () => {
  const api = window.bewerbungsManager;
  const workspace = await api.workspace.get();
  const alpha = workspace.applications.find((item) => item.company.name === 'E2E Beispiel GmbH');
  const beta = workspace.applications.find((item) => item.company.name === 'E2E Zweite GmbH');
  if (alpha?.profileSnapshot?.summary !== 'Java Backend' || beta?.profileSnapshot?.summary !== 'Golang Backend' ||
      workspace.profiles[0]?.summary !== 'Zentrale Version') throw new Error('application profiles did not survive restart');
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const checkPreview = async (company, own, other) => {
    document.querySelector('button.nav-item[title="Aktive Bewerbungen"]').click();
    await wait(150);
    const item = [...document.querySelectorAll('.application-item')].find((entry) => entry.textContent.includes(company));
    if (!item) throw new Error('application missing in UI: ' + company);
    item.click();
    document.querySelector('button.nav-item[title="Lebenslauf"]').click();
    await wait(250);
    const preview = [...document.querySelectorAll('.resume-preview')].map((node) => node.textContent).join(' ');
    if (!preview.includes(own) || preview.includes(other)) throw new Error('wrong preview for ' + company + ': ' + preview);
  };
  await checkPreview('E2E Beispiel GmbH', 'Java Backend', 'Golang Backend');
  await checkPreview('E2E Zweite GmbH', 'Golang Backend', 'Java Backend');
  const first = await api.export.pdf(alpha.id, 'lebenslauf');
  const second = await api.export.pdf(beta.id, 'lebenslauf');
  if (!first.path || !second.path) throw new Error('PDF export was cancelled');
  return { alpha: first.path, beta: second.path };
})()`;

// Vorstellungsgespräch – Fragen & Antworten, driven through the real panel (renderer helpers shared by the phases).
const interviewHelpers = `
  const api = window.bewerbungsManager;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (check, label) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const value = check();
      if (value) return value;
      await wait(50);
    }
    throw new Error('Timeout: ' + label);
  };
  const buttonWith = (text, scope = document) =>
    [...scope.querySelectorAll('button')].find((button) => button.textContent.includes(text));
  const questionButtons = () => [...document.querySelectorAll('.interview-answer__toggle')];
  const expanded = () => questionButtons().map((button) => button.getAttribute('aria-expanded'));
  const outcomes = [];
  api.gitSync.onStatus((outcome, syncId) => outcomes.push({ outcome, syncId }));
  const nextPush = async (count, label) => {
    const outcome = await until(() => outcomes[count], label + ': no GitHub outcome');
    if (outcome.outcome.state !== 'synced' || !outcome.outcome.pushed) throw new Error(label + ': ' + JSON.stringify(outcome.outcome));
  };
  const typeInto = (textarea, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const questions = (prefix, count) => Array.from({ length: count }, (_, index) =>
    'Frage ' + (index + 1) + ': ' + prefix + ' Frage ' + (index + 1) + ' – Größe & Übung?\\n\\nErklärung:\\n' + prefix +
    ' Erklärung ' + (index + 1) + '\\nZweite Zeile\\n\\nAntwort:\\n' + prefix + ' Antwort ' + (index + 1) + '\\n- Punkt A\\n- Punkt B\\n').join('\\n');
  const openPanel = async (navTitle) => {
    document.querySelector('button.nav-item[title="' + navTitle + '"]').click();
    const item = await until(() => [...document.querySelectorAll('.application-item')]
      .find((entry) => entry.textContent.includes('Seidel GmbH & Co. KG')), 'Seidel in ' + navTitle);
    item.click();
    const open = await until(() => buttonWith('Vorstellungsgespräch – Fragen & Antworten', document.querySelector('.detail-form')),
      'interview button in ' + navTitle);
    open.click();
    return until(() => document.querySelector('.interview-prep'), 'interview panel');
  };
  const saveText = async (text, expectedCount) => {
    const textarea = await until(() => document.querySelector('.interview-editor__input'), 'editor');
    typeInto(textarea, text);
    await wait(50);
    if (!buttonWith('Als Markdown speichern').disabled) throw new Error('saving was possible without a preview');
    buttonWith('Vorschau prüfen').click();
    await until(() => document.querySelector('.interview-editor__summary'), 'preview');
    const summary = document.querySelector('.interview-editor__summary').textContent;
    if (summary !== expectedCount + ' Fragen erkannt.') throw new Error('preview: ' + summary);
    if (expanded().length !== expectedCount || expanded().some((value) => value !== 'false'))
      throw new Error('preview answers were not all closed: ' + expanded());
    const before = outcomes.length;
    buttonWith('Als Markdown speichern').click();
    const notice = await until(() => document.querySelector('.interview-prep__notice'), 'save notice');
    await nextPush(before, 'interview notes');
    return notice.textContent;
  };
`;

const interviewSetupScenario = `(async () => {
  ${interviewHelpers}
  const workspace = await api.workspace.get();
  const created = await api.applications.create({
    company: { name: 'Seidel GmbH & Co. KG', city: 'Leipzig' }, contact: {}, job: { title: 'Fachinformatiker' },
    templateId: 'classic-professional', accentColor: '#155e58', profileId: workspace.profiles[0].id, notes: '',
  });
  const application = created.workspace.applications.find((item) => item.company.name === 'Seidel GmbH & Co. KG');
  await until(() => outcomes.length >= 1, 'create push');
  const status = await api.applications.changeStatus(application.id, 'Vorstellungsgespräch');
  await until(() => outcomes.length >= 2, 'status push');
  const current = status.workspace.applications.find((item) => item.id === application.id);
  await api.applications.save({ ...current, interviewAt: new Date(2026, 9, 22, 10, 0).toISOString() });
  await until(() => outcomes.length >= 3, 'date push');
  if (outcomes.some((entry) => entry.outcome.state !== 'synced')) throw new Error('setup push failed: ' + JSON.stringify(outcomes));
  return application.id;
})()`;

const interviewUiScenario = `(async () => {
  ${interviewHelpers}
  const panel = await openPanel('Aktive Bewerbungen');
  const header = panel.querySelector('.interview-prep__header').textContent;
  if (!header.includes('Seidel GmbH & Co. KG') || !header.includes('Fachinformatiker') || !header.includes('22.10.2026'))
    throw new Error('panel header: ' + header);
  const notice = await saveText(questions('Erste', 10), 10);
  if (notice !== '„Vorstellungsgespräch_Seidel.md“ wurde lokal gespeichert.') throw new Error('notice: ' + notice);
  await until(() => questionButtons().length === 10, 'saved file accordion');
  if (expanded().some((value) => value !== 'false')) throw new Error('saved answers were not closed');
  if (!document.querySelector('.interview-answer__body').hidden) throw new Error('answer visible before opening');
  const explanation = document.querySelector('.interview-question__explanation');
  if (!explanation.innerText.includes('Erste Erklärung 1') || explanation.getBoundingClientRect().height === 0)
    throw new Error('the Erklärung is not shown: ' + explanation.innerText);
  // Mouse: independent questions, several open at once, a second click closes.
  questionButtons()[0].click();
  questionButtons()[2].click();
  await wait(50);
  if (expanded().slice(0, 4).join() !== 'true,false,true,false') throw new Error('mouse toggle: ' + expanded());
  const body = document.querySelector('.interview-answer__body');
  if (body.hidden || !body.innerText.includes('Erste Antwort 1') || body.querySelectorAll('ul > li').length !== 2)
    throw new Error('opened answer: ' + body.innerText);
  questionButtons()[0].click();
  await wait(50);
  if (expanded().slice(0, 3).join() !== 'false,false,true') throw new Error('second click did not close: ' + expanded());
  questionButtons()[2].click();
  await wait(50);
  questionButtons()[1].focus();
  return document.activeElement === questionButtons()[1];
})()`;

const interviewSecondFileScenario = `(async () => {
  ${interviewHelpers}
  buttonWith('Neue Datei').click();
  const notice = await saveText(questions('Zweite', 3), 3);
  if (notice !== '„Vorstellungsgespräch_Seidel_1.md“ wurde lokal gespeichert.') throw new Error('second notice: ' + notice);
  const chips = [...document.querySelectorAll('.interview-file-chip span')].map((chip) => chip.textContent);
  if (chips.join() !== 'Vorstellungsgespräch_Seidel.md,Vorstellungsgespräch_Seidel_1.md') throw new Error('chips: ' + chips);
  // The same button from the Vorstellungsgespräche view, the same panel.
  document.querySelector('.interview-prep button[aria-label="Schließen"]').click();
  await until(() => !document.querySelector('.interview-prep'), 'panel closed');
  const panel = await openPanel('Vorstellungsgespräche');
  await until(() => panel.querySelectorAll('.interview-file-chip').length === 2, 'files in Vorstellungsgespräche view');
  return true;
})()`;

const interviewReopenScenario = `(async () => {
  ${interviewHelpers}
  const panel = await openPanel('Vorstellungsgespräche');
  await until(() => panel.querySelectorAll('.interview-file-chip').length === 2, 'files after restart');
  const chips = [...panel.querySelectorAll('.interview-file-chip')].map((chip) => chip.textContent);
  if (!chips[0].includes('Vorstellungsgespräch_Seidel.md') || !chips[0].includes('10 Fragen') || !chips[1].includes('3 Fragen'))
    throw new Error('chips after restart: ' + chips);
  if (questionButtons().length !== 10 || expanded().some((value) => value !== 'false')) throw new Error('reopened accordion');
  buttonWith('Vorstellungsgespräch_Seidel_1.md').click();
  await until(() => questionButtons().length === 3, 'second file');
  questionButtons()[1].click();
  await wait(50);
  if (!document.querySelectorAll('.interview-answer__body')[1].innerText.includes('Zweite Antwort 2')) throw new Error('second file content');
  buttonWith('Datei bearbeiten').click();
  const textarea = await until(() => document.querySelector('.interview-editor__input'), 'edit editor');
  if (!textarea.value.startsWith('# Vorstellungsgespräch\\n\\n## Frage 1: Zweite Frage 1')) throw new Error('editor content: ' + textarea.value.slice(0, 80));
  const notice = await saveText(textarea.value.replace('Zweite Antwort 3', 'Geänderte Antwort 3'), 3);
  if (notice !== '„Vorstellungsgespräch_Seidel_1.md“ wurde lokal gespeichert.') throw new Error('update notice: ' + notice);
  const chipsAfter = [...panel.querySelectorAll('.interview-file-chip span')].map((chip) => chip.textContent);
  if (chipsAfter.join() !== 'Vorstellungsgespräch_Seidel.md,Vorstellungsgespräch_Seidel_1.md') throw new Error('update created a file: ' + chipsAfter);
  // Invalid input is shown in German and cannot be saved.
  buttonWith('Neue Datei').click();
  typeInto(await until(() => document.querySelector('.interview-editor__input'), 'editor'), 'Ohne Fragen');
  buttonWith('Vorschau prüfen').click();
  const issues = await until(() => document.querySelector('.interview-issues'), 'issues');
  if (!issues.textContent.includes('Es wurde keine Frage erkannt.') || !buttonWith('Als Markdown speichern').disabled)
    throw new Error('invalid input: ' + issues.textContent);
  window.confirm = () => true;
  buttonWith('Abbrechen').click();
  document.querySelector('.interview-prep').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => !document.querySelector('.interview-prep'), 'Escape closes the panel');
  // A new interview date: the folder follows, no note is lost.
  const workspace = await api.workspace.get();
  const application = workspace.applications.find((item) => item.company.name === 'Seidel GmbH & Co. KG');
  const before = outcomes.length;
  await api.applications.save({ ...application, interviewAt: new Date(2026, 9, 23, 9, 30).toISOString() });
  await nextPush(before, 'date change');
  const listing = await api.interviews.list(application.id);
  if (listing.folderName !== 'Seidel_GmbH_&_Co._KG_2026-10-23' || listing.files.length !== 2 ||
      !listing.files[1].content.includes('Geänderte Antwort 3'))
    throw new Error('notes after date change: ' + JSON.stringify(listing.files.map((file) => file.fileName)) + ' ' + listing.folderName);
  // The main process refuses paths and unknown names.
  let refused = 0;
  for (const name of ['../workspace.json', 'Notizen.md']) {
    try { await api.interviews.update(application.id, name, 'Frage 1: X?\\nAntwort: y', 'a'.repeat(64)); }
    catch (error) { if (String(error.message).startsWith('Die eingegebenen Daten sind ungültig.')) refused += 1; }
  }
  if (refused !== 2) throw new Error('invalid file names were not refused');
  return true;
})()`;

/** Real keyboard input (not synthetic DOM events): Enter and Space on the focused question button. */
const pressKey = async (window, keyCode) => {
  window.webContents.focus();
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  window.webContents.sendInputEvent({ type: 'char', keyCode: keyCode === 'Space' ? ' ' : '\r' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  await new Promise((resolve) => setTimeout(resolve, 150));
};

const runInterviewKeyboardCheck = async (window) => {
  const state = () => window.webContents.executeJavaScript(
    "[...document.querySelectorAll('.interview-answer__toggle')].map((b) => b.getAttribute('aria-expanded')).slice(0, 3).join()",
  );
  if (await state() !== 'false,false,false') throw new Error(`keyboard start state: ${await state()}`);
  await pressKey(window, 'Enter');
  if (await state() !== 'false,true,false') throw new Error(`Enter did not open question 2: ${await state()}`);
  await pressKey(window, 'Space');
  if (await state() !== 'false,false,false') throw new Error(`Space did not close question 2: ${await state()}`);
  const focus = await window.webContents.executeJavaScript(
    "getComputedStyle(document.activeElement).outlineStyle + ' / focus-visible: ' + document.activeElement.matches(':focus-visible')",
  );
  console.log(`Electron E2E: keyboard toggle passed (outline ${focus})`);
};

let interviewStep = 0;
let reloadPending = false;
let primaryWindow;
app.on('browser-window-created', (_, window) => {
  if (phase === 'second') { fail(new Error('Second Electron instance opened a window')); return; }
  if (phase === 'profiles-reopen' && primaryWindow) return;
  primaryWindow = window;
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
      if (phase === 'interview') {
        // The applications are set up through IPC; the reload hydrates the renderer with them.
        if (interviewStep === 0) {
          interviewStep = 1;
          await window.webContents.executeJavaScript(interviewSetupScenario);
          window.webContents.reload();
          return;
        }
        if (!(await window.webContents.executeJavaScript(interviewUiScenario)))
          throw new Error('question button did not take the focus');
        await runInterviewKeyboardCheck(window);
        await window.webContents.executeJavaScript(interviewSecondFileScenario);
        console.log('Electron E2E: interview notes pasted, previewed, saved and toggled');
      } else if (phase === 'interview-reopen') {
        await window.webContents.executeJavaScript(interviewReopenScenario);
        console.log('Electron E2E: interview notes reloaded, edited in place and kept across a date change');
      } else if (phase === 'profiles') {
        await window.webContents.executeJavaScript(createApplicationProfilesScenario);
        console.log('Electron E2E: independent application profiles saved');
      } else if (phase === 'profiles-reopen') {
        const pdfs = await window.webContents.executeJavaScript(verifyApplicationProfilesScenario);
        fs.writeFileSync(path.join(root, 'profile-pdfs.json'), JSON.stringify(pdfs));
        console.log('Electron E2E: independent previews, restart and PDFs passed');
      } else if (phase === 'create') {
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
