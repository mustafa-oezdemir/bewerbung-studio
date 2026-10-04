const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('tmp/metadata-qa');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1250, webPreferences: { sandbox: true } });
  const failures = [];
  let checked = 0;
  for (const file of fs.readdirSync(output).filter(name => name.endsWith('.html'))) {
    await window.loadFile(path.join(output, file));
    const result = await window.webContents.executeJavaScript(`(() => {
      const section = document.querySelector('[data-managed-section="experience"]');
      const entry = section?.querySelector('[data-resume-metadata-entry]');
      const grid = entry?.querySelector('[data-resume-metadata-grid]');
      const box = key => grid?.querySelector('[data-resume-metadata-' + key + ']')?.getBoundingClientRect();
      const role = box('role'), org = box('organization'), date = box('date'), location = box('location');
      return { role: role && [role.x,role.y], org: org && [org.x,org.y], date: date && [date.x,date.y],
        location: location && [location.x,location.y], display: grid && getComputedStyle(grid).display,
        body: entry?.textContent?.includes('Anwendungen entwickelt.') };
    })()`);
    checked++;
    const direction = file.endsWith('-left.html') ? 'left' : file.endsWith('-right.html') ? 'right' : 'stacked';
    const { role, org, date, location } = result;
    const aligned = role && org && date && location && result.display === 'grid' && result.body &&
      (direction === 'stacked'
        ? role[1] < org[1] && org[1] < date[1] && date[1] < location[1]
        : Math.abs(role[1] - date[1]) < 2 && Math.abs(org[1] - location[1]) < 2 && role[1] < org[1]
          && (direction === 'left' ? date[0] < role[0] : role[0] < date[0]));
    if (!aligned) failures.push({ file, result });
  }
  console.log(JSON.stringify({ checked, failures }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
