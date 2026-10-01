const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve('tmp/spacing-qa');
const expectedMargin = JSON.parse(fs.readFileSync(path.join(output, 'expected-margin.json'), 'utf8'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 900, height: 1250, webPreferences: { sandbox: true } });
  const failures = [];
  let checked = 0;
  // Templates that pad their page by --doc-margin take the variable; the others shift their own margin by the difference.
  const marginAsExpected = (file, result) => {
    const adjustment = expectedMargin[file.replace(/-(pdf|preview)\.html$/, '')];
    if (adjustment.viaVariable) return result.marginVariable === '18mm';
    if (adjustment.shiftMm >= 0) return Math.abs(result.pageMargin - adjustment.shiftMm) <= .2;
    return Math.abs(result.marginBox[0] - adjustment.shiftMm) <= .2;
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
      // The inner padding insets the children of a marked column; the column or host itself keeps the padding that forms the page margin.
      const innerHost = scope?.querySelector('[data-resume-spacing-inner]');
      const inner = innerHost?.firstElementChild;
      const px = value => parseFloat(value) / (96 / 25.4);
      return { scope: !!scope, title: title ? px(getComputedStyle(title).marginBottom) : null,
        entry: entry ? px(getComputedStyle(entry).marginTop) : null,
        section: section ? px(getComputedStyle(section).marginTop) : null,
        entryContent: entryTitle ? px(getComputedStyle(entryTitle).marginBottom) : null,
        pageMargin: scope ? px(getComputedStyle(scope).paddingTop) : null,
        marginVariable: scope ? getComputedStyle(scope).getPropertyValue('--doc-margin').trim() : null,
        marginBox: scope ? [px(getComputedStyle(scope).marginTop), getComputedStyle(scope).width] : null,
        variables: scope ? ['--doc-inner-padding','--doc-entry-content-gap','--doc-column-gap','--doc-line-height'].map(key => getComputedStyle(scope).getPropertyValue(key).trim()) : [],
        columnGap: host ? px(getComputedStyle(host).columnGap) : null,
        innerPadding: inner ? px(getComputedStyle(inner).paddingLeft) : null,
        carrierPadding: innerHost ? (innerHost.style.paddingInline || innerHost.style.paddingLeft || innerHost.style.paddingRight || '') : null,
        lineHeightRatio: paragraph ? parseFloat(getComputedStyle(paragraph).lineHeight) / parseFloat(getComputedStyle(paragraph).fontSize) : null };
    })()`);
    checked++;
    for (const key of Object.keys(coverage)) if (result[key] !== null) coverage[key]++;
    if (!result.scope || (result.title !== null && Math.abs(result.title - 2.5) > .2)
      || (result.entry !== null && Math.abs(result.entry - 3) > .2)
      || (result.section !== null && Math.abs(result.section - 7) > .2)
      || (result.entryContent !== null && Math.abs(result.entryContent - 1.5) > .2)
      || !marginAsExpected(file, result)
      || JSON.stringify(result.variables) !== JSON.stringify(['4mm','1.5mm','8mm','1.3'])
      || (result.columnGap !== null && Math.abs(result.columnGap - 8) > .2)
      || (result.innerPadding !== null && Math.abs(result.innerPadding - 4) > .2)
      || (result.carrierPadding !== null && result.carrierPadding !== '')
      || (result.lineHeightRatio !== null && Math.abs(result.lineHeightRatio - 1.3) > .06)) failures.push({ file, result });
  }
  if (Object.values(coverage).some(value => value === 0)) failures.push({ missingCoverage: coverage });
  console.log(JSON.stringify({ checked, coverage, failures }, null, 2));
  window.destroy(); app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
