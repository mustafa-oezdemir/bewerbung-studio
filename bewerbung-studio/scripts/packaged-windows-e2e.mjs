import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("Packaged Windows E2E requires Windows.");
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(await readFile(path.join(appRoot, "package.json"), "utf8"));
const artifactRoot = path.join(appRoot, "windows-release");
const portable = path.join(artifactRoot, `BewerbungsManager-${version}-x64-Portable.exe`);
const installer = path.join(artifactRoot, `BewerbungsManager-${version}-x64-Setup.exe`);
const portableOnly = process.argv.includes("--portable-only");
for (const artifact of portableOnly ? [portable] : [portable, installer]) {
  if ((await stat(artifact)).size < 1_000_000) throw new Error(`Windows artifact is missing or too small: ${artifact}`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reservePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const runAndWait = (executable, args, env, timeoutMs = 120_000) => new Promise((resolve, reject) => {
  const child = spawn(executable, args, { cwd: path.dirname(executable), env, windowsHide: true });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const timer = setTimeout(() => { child.kill(); reject(new Error(`${path.basename(executable)} timed out`)); }, timeoutMs);
  child.once("error", (error) => { clearTimeout(timer); reject(error); });
  child.once("exit", (code) => {
    clearTimeout(timer);
    if (code === 0) resolve(output);
    else reject(new Error(`${path.basename(executable)} exited ${code}: ${output.slice(-2000)}`));
  });
});
const waitForPage = async (port) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
      const pages = await response.json();
      const page = pages.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* The executable is still starting or extracting. */ }
    await delay(500);
  }
  throw new Error("Packaged application did not expose a renderer within 60 seconds.");
};
const connect = (url) => new Promise((resolve, reject) => {
  const socket = new WebSocket(url);
  socket.addEventListener("open", () => resolve(socket), { once: true });
  socket.addEventListener("error", () => reject(new Error("CDP WebSocket connection failed")), { once: true });
});
let nextId = 1;
const command = (socket, method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => reject(new Error(`CDP ${method} timed out`)), 15_000);
  const onMessage = (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id !== id) return;
    clearTimeout(timer);
    socket.removeEventListener("message", onMessage);
    if (message.error) reject(new Error(`CDP ${method}: ${message.error.message}`));
    else resolve(message.result);
  };
  socket.addEventListener("message", onMessage);
  socket.send(JSON.stringify({ id, method, params }));
});

const launchAndProbe = async (executable, fixtureRoot, label) => {
  const workspace = path.join(fixtureRoot, "workspace");
  const userData = path.join(fixtureRoot, "userData");
  const appData = path.join(fixtureRoot, "appData");
  await Promise.all([mkdir(userData, { recursive: true }), mkdir(appData, { recursive: true })]);
  const port = await reservePort();
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, "--disable-gpu",
  ], {
    cwd: path.dirname(executable), windowsHide: true,
    env: { ...process.env, BEWERBUNG_ROOT_PATH: workspace, APPDATA: appData, LOCALAPPDATA: appData },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  let socket;
  try {
    socket = await connect(await waitForPage(port));
    let result;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      result = await command(socket, "Runtime.evaluate", {
        expression: `(async () => {
          const api = window.bewerbungsManager;
          if (!api) return { ready: false };
          const status = await api.system.workspaceStatus();
          if (status.state !== 'ready') return { ready: false, status: status.state };
          const before = await api.workspace.get();
          await api.settings.save({ ...before.settings, theme: 'dark' });
          const after = await api.workspace.get();
          return { ready: true, root: status.root, theme: after.settings.theme,
            applications: after.applications.length };
        })()`,
        awaitPromise: true, returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(`Packaged renderer error: ${result.exceptionDetails.text}`);
      if (result.result?.value?.ready) break;
      await delay(100);
    }
    const value = result?.result?.value;
    if (!value?.ready || value.root?.toLowerCase() !== workspace.toLowerCase() ||
        value.theme !== "dark" || value.applications !== 0)
      throw new Error(`${label} used the wrong workspace or failed IPC: ${JSON.stringify(value)}`);
    const saved = JSON.parse(await readFile(path.join(workspace, "data", "Setting", "Settings", "workspace.json"), "utf8"));
    if (saved.settings.theme !== "dark") throw new Error(`${label} did not persist settings to disk`);
    socket.send(JSON.stringify({ id: nextId++, method: "Browser.close" }));
    console.log(`${label}: packaged renderer, preload, IPC and disk write passed`);
  } catch (error) {
    throw new Error(`${label}: ${error.message}${output ? `\n${output.slice(-2000)}` : ""}`);
  } finally {
    socket?.close();
    await delay(1000);
    if (child.exitCode === null) child.kill();
  }
};

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "bm-packaged-e2e-"));
const cleanup = async () => {
  const resolved = path.resolve(temporaryRoot);
  if (!resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`) ||
      !path.basename(resolved).startsWith("bm-packaged-e2e-"))
    throw new Error("Refusing to remove an unexpected test directory.");
  await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
};
const createFixture = async (name) => {
  const root = path.join(temporaryRoot, name);
  const settings = path.join(root, "workspace", "data", "Setting", "Settings");
  await mkdir(settings, { recursive: true });
  await mkdir(path.join(root, "workspace", "data", "Bewerbungen"), { recursive: true });
  await writeFile(path.join(settings, "workspace.json"), JSON.stringify({
    schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
    settings: { followUpDays: null, notificationsEnabled: false, theme: "system",
      archiveAccepted: false, language: "de" }, updatedAt: new Date().toISOString(),
  }));
  await writeFile(path.join(settings, "security-choice.json"), JSON.stringify({ completed: true }));
  return root;
};

try {
  await launchAndProbe(portable, await createFixture("portable"), "Portable EXE");
  if (!portableOnly) {
    const installRoot = path.join(temporaryRoot, "installed");
    await runAndWait(installer, ["/S", `/D=${installRoot}`], process.env);
    const installedExe = path.join(installRoot, "BewerbungsManager.exe");
    await stat(installedExe);
    try {
      await launchAndProbe(installedExe, await createFixture("installer"), "NSIS installed EXE");
    } finally {
      const files = await readdir(installRoot);
      const uninstall = files.find((name) => /^Uninstall .*\.exe$/i.test(name));
      if (uninstall) await runAndWait(path.join(installRoot, uninstall), ["/S"], process.env);
    }
  }
} finally {
  await cleanup();
}
