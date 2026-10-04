const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const [htmlPath, pdfPath] = process.argv.slice(2);
if (!htmlPath || !pdfPath) {
  throw new Error("Usage: electron print-html-to-pdf.cjs <html> <pdf>");
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  });
  await window.loadFile(path.resolve(htmlPath));
  const pdf = await window.webContents.printToPDF({
    pageSize: "A4",
    preferCSSPageSize: true,
    printBackground: true,
    margins: { marginType: "none" },
  });
  require("node:fs").writeFileSync(path.resolve(pdfPath), pdf);
  await window.close();
  app.quit();
});
