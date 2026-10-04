const { app, BrowserWindow, dialog } = require('electron');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
fs.mkdirSync(path.resolve('tmp'), { recursive: true });
const userData = fs.mkdtempSync(path.resolve('tmp/electron-startup-smoke-'));
app.setPath('userData', userData);
const smokeWorkspace = path.join(userData, 'workspace');
const settingsDirectory = path.join(smokeWorkspace, 'data', 'Setting', 'Settings');
fs.mkdirSync(settingsDirectory, { recursive: true });
fs.mkdirSync(path.join(smokeWorkspace, 'data', 'Bewerbungen'), { recursive: true });
fs.writeFileSync(path.join(settingsDirectory, 'workspace.json'), JSON.stringify({
  schemaVersion: 1,
  applications: [], profiles: [], events: [], attachments: [],
  settings: {
    followUpDays: null, notificationsEnabled: false, theme: 'system',
    archiveAccepted: false, language: 'de',
  },
  updatedAt: new Date().toISOString(),
}));
process.env.BEWERBUNG_ROOT_PATH = smokeWorkspace;
BrowserWindow.prototype.show = function () {};
const fail = error => { console.error(error); app.exit(1); };
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
dialog.showErrorBox = (title, content) => fail(new Error(title + ': ' + content));
setTimeout(() => fail(new Error('Startup timed out')), 20000).unref();
app.on('browser-window-created', (_, window) => {
  window.webContents.on('console-message', event => { if (event.level === 'error') fail(new Error(event.message)); });
  window.webContents.on('preload-error', (_, path, error) => fail(error));
  window.webContents.on('render-process-gone', (_, details) => fail(JSON.stringify(details)));
  window.webContents.on('did-fail-load', (_, code, description) => fail(description + ': ' + code));
  window.webContents.once('did-finish-load', async () => {
    try {
      window.webContents.debugger.attach('1.3');
      await window.webContents.debugger.sendCommand('DOM.enable');
      let markup = '';
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const document = await window.webContents.debugger.sendCommand('DOM.getDocument');
        const response = await window.webContents.debugger.sendCommand('DOM.getOuterHTML', { nodeId: document.root.nodeId });
        markup = response.outerHTML;
        if (markup.includes('Datenschutz &amp; Sicherheit')) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!markup.includes('Datenschutz &amp; Sicherheit') ||
          /kann nicht geladen werden|unerwarteter Fehler/i.test(markup))
        throw new Error('Electron main, preload and React did not mount the workspace');
      console.log('Electron main, preload and React mounted the workspace');
      app.exit(0);
    } catch(error) { fail(error); }
  });
});
import(pathToFileURL(path.resolve('dist-electron/main.js')).href).catch(fail);
