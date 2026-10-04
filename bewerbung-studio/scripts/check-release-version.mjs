// Fails unless the release tag (`vX.Y.Z`) and the version of the app agree, so no artifact is named after another version.
import { readFile } from "node:fs/promises";

const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "";
if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`Ungültiges Release-Tag „${tag}“. Erwartet wird vX.Y.Z (z. B. v1.0.1).`);
}
const expected = tag.slice(1);

const readJson = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const manifest = await readJson("../package.json");
const lock = await readJson("../package-lock.json");
const versions = {
  "package.json": manifest.version,
  "package-lock.json": lock.version,
  "package-lock.json (packages[\"\"])": lock.packages?.[""]?.version,
};
const mismatches = Object.entries(versions).filter(([, version]) => version !== expected);
if (mismatches.length) {
  throw new Error(
    `Tag ${tag} passt nicht zur Version: ${mismatches
      .map(([file, version]) => `${file} = ${version}`)
      .join(", ")} (erwartet ${expected}).`,
  );
}
console.log(`Tag ${tag} und Version ${manifest.version} stimmen überein.`);
