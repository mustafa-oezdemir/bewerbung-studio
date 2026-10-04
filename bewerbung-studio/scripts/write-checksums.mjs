import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const releaseDirectory = path.resolve("windows-release");
const entries = (await readdir(releaseDirectory))
  .filter((fileName) => fileName.endsWith(".exe"))
  .sort();

const requiredKinds = ["-Setup.exe", "-Portable.exe"];
for (const kind of requiredKinds) {
  if (!entries.some((fileName) => fileName.endsWith(kind))) {
    throw new Error(`Release-Artefakt fehlt: *${kind}`);
  }
}

const checksumFor = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const lines = [];
for (const fileName of entries) {
  const filePath = path.join(releaseDirectory, fileName);
  const fileStats = await stat(filePath);
  if (fileStats.size < 1_000_000) {
    throw new Error(`Release-Artefakt unerwartet klein: ${fileName}`);
  }
  lines.push(`${await checksumFor(filePath)}  ${fileName}`);
}

await writeFile(
  path.join(releaseDirectory, "SHA256SUMS.txt"),
  `${lines.join("\n")}\n`,
  "utf8",
);

console.log(`Prüfsummen für ${entries.length} Windows-Artefakte erstellt.`);
