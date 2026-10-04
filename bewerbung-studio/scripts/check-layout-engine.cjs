const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('tmp/layout-engine-qa');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1250, webPreferences: { sandbox: true } });
  const failures = [];
  let checked = 0;
  for (const file of fs.readdirSync(output).filter(name => name.endsWith('.html'))) {
    await window.loadFile(path.join(output, file));
    const result = await window.webContents.executeJavaScript(`(() => {
      const host = document.querySelector('[data-resume-layout]');
      if (!host) return { native: true };
      const main = host.querySelector('[data-resume-layout-zone="main"]') || [...host.children].find(el => el.matches('main,[class*="-content"],[class*="-left-column"],[class*="-main-column"],[class*="-pdf-main"],[class*="-pdf-left"]') && !el.matches('aside'));
      const sidebar = host.querySelector('[data-resume-layout-zone="sidebar"]') || [...host.children].find(el => el.matches('aside,[class*="-sidebar"],[class*="-right-column"],[class*="-pdf-right"],[class*="-pdf-left"]') && el !== main);
      if (!main || !sidebar) return { missingZone: true };
      const a = main.getBoundingClientRect(), b = sidebar.getBoundingClientRect(), h = host.getBoundingClientRect();
      return { mode: host.dataset.resumeLayout, side: host.dataset.resumeSidebarSide,
        main: {x:a.x,y:a.y,width:a.width}, sidebar:{x:b.x,y:b.y,width:b.width},
        host:{width:h.width}, tracks:getComputedStyle(host).gridTemplateColumns };
    })()`);
    checked++;
    const expectedMode = file.includes('-single-') ? 'single' : 'two-column';
    const nativeSingle = ['einspaltig', 'ivy-league', 'klassisch', 'tabellarisch'].some(id => file.startsWith(id + '-'));
    if (result.native) {
      if (!(nativeSingle && expectedMode === 'single')) failures.push({file, result});
      continue;
    }
    if (result.missingZone || result.mode !== expectedMode || !result.host.width) { failures.push({file, result}); continue; }
    if (result.mode === 'single') {
      if (Math.abs(result.main.x - result.sidebar.x) > 2 || result.sidebar.y < result.main.y)
        failures.push({file, result});
    } else {
      const sidebarLeft = result.side === 'left';
      const sideCorrect = sidebarLeft ? result.sidebar.x < result.main.x : result.sidebar.x > result.main.x;
      const expectedPercent = file.includes('-left') ? 25 : 40;
      const actualPercent = result.sidebar.width / (result.main.width + result.sidebar.width) * 100;
      if (!sideCorrect || Math.abs(actualPercent - expectedPercent) > 2 || Math.abs(result.main.y - result.sidebar.y) > 2)
        failures.push({file, result, actualPercent});
    }
  }
  console.log(JSON.stringify({checked, failures}, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
