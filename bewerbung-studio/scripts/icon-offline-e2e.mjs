import { spawn } from "node:child_process";
import { mkdtemp, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

const [executable, workspace] = process.argv.slice(2);
if (!executable || !workspace) throw new Error("Pass the packaged executable and an isolated synthetic workspace.");
const fixture = await mkdtemp(path.join(os.tmpdir(), "bm-icons-offline-"));
const userData = path.join(fixture, "userData");
await mkdir(userData);
const port = await new Promise((resolve) => { const server = createServer(); server.listen(0, "127.0.0.1", () => {
  const value = server.address().port; server.close(() => resolve(value));
}); });
const child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, "--disable-gpu"],
  { windowsHide: true, env: { ...process.env, BEWERBUNG_ROOT_PATH: workspace, APPDATA: fixture, LOCALAPPDATA: fixture } });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let id = 0;
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 30000);
  const listener = (event) => { const message = JSON.parse(event.data); if (message.id !== requestId) return;
    clearTimeout(timer); socket.removeEventListener("message", listener);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
  };
  socket.addEventListener("message", listener); socket.send(JSON.stringify({ id: requestId, method, params }));
});
try {
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((entry) => entry.type === "page"); } catch {}
    if (page) break; await delay(300);
  }
  if (!page) throw new Error("Packaged renderer did not start");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  await command("Network.enable");
  await command("Network.setBlockedURLs", { urls: ["http://*", "https://*"] });
  const result = await command("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async (check) => { for(let i=0;i<100;i++){ const value=check(); if(value)return value; await wait(100); } throw new Error('UI timeout'); };
    await until(() => document.querySelector('button.nav-item[title="Aktive Bewerbungen"]'));
    const results = [];
    for(const [company, brand] of [['E2E Beispiel GmbH','material:folder:folder-api'],['E2E Zweite GmbH','vscode:folder:api']]) {
      document.querySelector('button.nav-item[title="Aktive Bewerbungen"]').click(); await wait(200);
      const item = await until(() => [...document.querySelectorAll('.application-item')].find(item => item.textContent.includes(company)));
      item.click(); document.querySelector('button.nav-item[title="Lebenslauf"]').click();
      const icon = await until(() => document.querySelector('.document-lebenslauf svg[data-brand="'+brand+'"]'));
      if(!icon.outerHTML.includes('currentColor')) throw new Error('Unthemed icon: '+brand);
      results.push({brand,color:getComputedStyle(icon).color});
    }
    return results;
  })()` });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  console.log("Packaged offline icons passed:", JSON.stringify(result.result.value));
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await command("Browser.close"); } catch {} socket.close(); }
  if (child.exitCode === null) child.kill();
}
