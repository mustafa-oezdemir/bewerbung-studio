import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const target = process.argv[2] ?? "all";
const signedRelease = process.argv[3] === "signed";
if (!["all", "nsis", "portable"].includes(target)) {
  throw new Error(`Unbekanntes Windows-Ziel: ${target}`);
}

const workspaceDirectory = path.resolve(".");
const artifactDirectory = path.join(workspaceDirectory, "windows-release");
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), "bewerbungsmanager-release-"),
);
const builderCli = path.join(
  workspaceDirectory,
  "node_modules",
  "electron-builder",
  "out",
  "cli",
  "cli.js",
);

const argumentsForBuilder = [
  builderCli,
  "--win",
  ...(target === "all" ? [] : [target]),
  "--x64",
  "--publish",
  "never",
  `--config.directories.output=${temporaryDirectory}`,
  ...(signedRelease ? ["--config.forceCodeSigning=true"] : []),
];

const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, argumentsForBuilder, {
    cwd: workspaceDirectory,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", reject);
  child.on("exit", (code) => resolve(code ?? 1));
});

if (exitCode !== 0) {
  throw new Error(`Windows-Paketierung wurde mit Code ${exitCode} beendet.`);
}

await mkdir(artifactDirectory, { recursive: true });
const generatedFiles = (await readdir(temporaryDirectory)).filter(
  (fileName) =>
    fileName.startsWith("BewerbungsManager-") &&
    (fileName.endsWith(".exe") || fileName.endsWith(".blockmap")),
);

if (!generatedFiles.some((fileName) => fileName.endsWith(".exe"))) {
  throw new Error("electron-builder hat keine Windows-EXE erzeugt.");
}

for (const fileName of generatedFiles) {
  await copyFile(
    path.join(temporaryDirectory, fileName),
    path.join(artifactDirectory, fileName),
  );
}

try {
  await rm(temporaryDirectory, {
    recursive: true,
    force: true,
    maxRetries: 2,
    retryDelay: 250,
  });
} catch {
  // Windows may briefly retain scanned files in the system temp directory.
}

console.log(
  `${generatedFiles.length} Windows-Release-Dateien nach windows-release/ kopiert.`,
);
