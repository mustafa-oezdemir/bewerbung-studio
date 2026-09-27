const { app, BrowserWindow, dialog } = require('electron');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const userData = path.resolve('tmp/electron-startup-smoke');
fs.mkdirSync(userData, {recursive:true});
app.setPath('userData', userData);
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
      const result = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        let attempts = 0;
        const timer = setInterval(() => {
          const text = document.getElementById('app')?.innerText?.trim();
          if (text) { clearInterval(timer); resolve({ title: document.title, text: text.slice(0,300) }); }
          else if (++attempts > 50) { clearInterval(timer); reject(new Error('React did not mount')); }
        }, 100);
      })`);
      console.log('Electron main, preload and React mounted:', JSON.stringify(result));
      app.exit(0);
    } catch(error) { fail(error); }
  });
});
import(pathToFileURL(path.resolve('dist-electron/main.js')).href).catch(fail);
