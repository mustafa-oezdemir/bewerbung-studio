const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const out = path.resolve('tmp/section-inheritance-qa');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 850, height: 1200, webPreferences: { sandbox: true } });
  const results = [];
  for (const fixture of JSON.parse(fs.readFileSync(path.join(out, 'manifest.json')))) {
    await window.loadFile(path.join(out, fixture.file + '.html'));
    const result = await window.webContents.executeJavaScript(`(() => {
      const sources = ${JSON.stringify(fixture.sources)};
      const roles = ['section','heading','entry-title','supporting','metadata'];
      const checks = [];
      for (let i=0;i<roles.length;i++) {
        const native = [...document.querySelectorAll(sources[i])].find(n => n.closest('[data-managed-section="experience"]'));
        const custom = document.querySelector(i === 0 ? '[data-custom-template]' : '[data-custom-template] [data-custom-role="'+roles[i]+'"]');
        if (!native || !custom) { checks.push({role:roles[i],missing:true}); continue; }
        const a = getComputedStyle(native), b = getComputedStyle(custom);
        const props = i === 0 ? ['marginBottom','paddingTop','paddingBottom','breakInside'] : ['fontFamily','fontSize','fontWeight','color','lineHeight',...(i === 1 ? ['borderBottomStyle','borderBottomWidth','borderBottomColor','marginBottom','paddingTop','paddingBottom','breakAfter'] : [])];
        const differences = Object.fromEntries(props.filter(p => a[p]!==b[p] && !(p === 'breakAfter' && a[p] === 'auto' && b[p] === 'avoid')).map(p => [p,[a[p],b[p]]]));
        if (Object.keys(differences).length) checks.push({role:roles[i],differences});
      }
      return checks;
    })()`);
    results.push({ file: fixture.file, checks: result });
    if (fixture.surface === 'pdf' && fixture.file.includes('-visual-')) {
      fs.writeFileSync(path.join(out, fixture.file + '.pdf'), await window.webContents.printToPDF({ pageSize:'A4', preferCSSPageSize:true, printBackground:true, margins:{marginType:'none'} }));
    }
    if (fixture.file.includes('-visual-')) fs.writeFileSync(path.join(out, fixture.file + '.png'), (await window.webContents.capturePage()).toPNG());
  }
  fs.writeFileSync(path.join(out, 'computed-styles.json'), JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.filter(r=>r.checks.length)));
  window.destroy(); app.exit(results.some(r => r.checks.length) ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
