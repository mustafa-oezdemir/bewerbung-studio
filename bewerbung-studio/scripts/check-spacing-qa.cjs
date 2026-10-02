const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('tmp/spacing-qa');
const expectedMargin = JSON.parse(fs.readFileSync(path.join(output, 'expected-margin.json'), 'utf8'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1250, webPreferences: { sandbox: true } });
  const failures = [];
  let checked = 0;
  // The page stays fixed. Keep each template's native child padding and measure
  // only the added text shift from the page-margin and inner-padding overrides.
  const marginAsExpected = (file, result) => {
    const adjustment = expectedMargin[file.replace(/-(pdf|preview)\.html$/, '')];
    return result.textInset !== null && result.innerPadding !== null
      && Math.abs(result.textInset - result.innerPadding - adjustment.shiftMm - adjustment.innerShiftMm) <= .2;
  };
  const coverage = { title: 0, entry: 0, section: 0, entryContent: 0, columnGap: 0, innerPadding: 0, lineHeightRatio: 0 };
  for (const file of fs.readdirSync(output).filter(name => name.endsWith('.html'))) {
    await window.loadFile(path.join(output, file));
    const result = await window.webContents.executeJavaScript(`(() => {
      const scope = document.querySelector('[data-resume-spacing-entry-gap]');
      const title = scope?.querySelector('[data-resume-spacing-title]');
      const entry = scope?.querySelector('[data-resume-spacing-entry-following]');
      const section = scope?.querySelector('[data-resume-spacing-section-following]');
      const entryTitle = scope?.querySelector('[data-resume-spacing-entry-title]');
      const paragraph = scope?.querySelector('[data-managed-section] p');
      const host = scope?.querySelector('[style*="column-gap"]') || (scope?.style.columnGap ? scope : null);
      const inner = scope?.querySelector('[data-managed-section] > :not([data-resume-background-layer])');
      const px = value => parseFloat(value) / (96 / 25.4);
      return { scope: !!scope, title: title ? px(getComputedStyle(title).marginBottom) : null,
        entry: entry ? px(getComputedStyle(entry).marginTop) : null,
        section: section ? px(getComputedStyle(section).marginTop) : null,
        entryContent: entryTitle ? px(getComputedStyle(entryTitle).marginBottom) : null,
        scopeGeometryChanged: scope ? ['padding','margin','width','height'].some(key => scope.style[key]) : null,
        variables: scope ? ['--doc-inner-padding','--doc-entry-content-gap','--doc-column-gap','--doc-line-height'].map(key => getComputedStyle(scope).getPropertyValue(key).trim()) : [],
        columnGap: host ? px(getComputedStyle(host).columnGap) : null,
        innerPadding: inner ? px(getComputedStyle(inner).paddingLeft) : null,
        textInset: inner ? px(getComputedStyle(inner).paddingLeft) + px(getComputedStyle(inner).marginLeft) : null,
        lineHeightRatio: paragraph ? parseFloat(getComputedStyle(paragraph).lineHeight) / parseFloat(getComputedStyle(paragraph).fontSize) : null };
    })()`);
    checked++;
    for (const key of Object.keys(coverage)) if (result[key] !== null) coverage[key]++;
    if (!result.scope || (result.title !== null && Math.abs(result.title - 2.5) > .2)
      || (result.entry !== null && Math.abs(result.entry - 3) > .2)
      || (result.section !== null && Math.abs(result.section - 7) > .2)
      || (result.entryContent !== null && Math.abs(result.entryContent - 1.5) > .2)
      || !marginAsExpected(file, result)
      || result.scopeGeometryChanged
      || JSON.stringify(result.variables) !== JSON.stringify(['4mm','1.5mm','8mm','1.3'])
      || (result.columnGap !== null && Math.abs(result.columnGap - 8) > .2)
      || (result.innerPadding !== null && result.innerPadding < 0)
      || (result.lineHeightRatio !== null && Math.abs(result.lineHeightRatio - 1.3) > .06)) failures.push({ file, result });
  }
  if (Object.values(coverage).some(value => value === 0)) failures.push({ missingCoverage: coverage });
  console.log(JSON.stringify({ checked, coverage, failures }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
