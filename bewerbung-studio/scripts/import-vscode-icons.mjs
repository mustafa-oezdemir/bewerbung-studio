// Run only after approving the asset scope. The wiki names are catalogued in full;
// artwork is copied only for the generic icons whose CC BY-SA status is clear.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceCommit = "f0a0c40aeae5eba2917ada14ad59b7e7f729e396";
const wikiCommit = "057c655b272d1d10f90ddff69e8d53596d488b19";
const root = path.resolve(import.meta.dirname, "..");
const assetDir = path.join(root, "src/assets/vscode-icons");

// These are generic concepts, not identifiable third-party product marks. A new
// name is never automatically allowed just because the upstream wiki adds it.
const approved = {
  file: new Set("file audio binary config csv db font image js key license log package readme script shell source test text video xml yaml zip zip2".split(" ")),
  folder: new Set("folder root_folder api app asset auth audio binary certificate cli client common component config controller coverage db dist docs domain e2e environments favicon fonts frontend helper hook images include interfaces library locale log middleware mobile mock model module notebooks notification package plugin private public route schema script server services shared src sso temp template test theme tools typings video view www".split(" ")),
};

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
};
const parseRows = (markdown, kind) => {
  const rows = markdown.split(/\r?\n/).filter((line) =>
    kind === "file" ? /^\|\s*<sub>\[[^\]]+\]/.test(line) : /^\|\s*\[[^\]]+\]/.test(line),
  );
  const entries = new Map();
  for (const row of rows) {
    const columns = row.split("|").map((column) => column.trim());
    const name = /\[([^\]]+)\]\(#[^)]+\)/.exec(columns[1])?.[1];
    if (!name || !/^[a-zA-Z0-9_+.-]+$/.test(name)) throw new Error(`Unexpected catalog name: ${name}`);
    const expected = kind === "file" ? 5 : 7;
    if (columns.length < expected) throw new Error(`Malformed ${kind} row: ${name}`);
    const asset = (cell) => /icons\/([a-zA-Z0-9_+.-]+\.svg)/.exec(cell)?.[1] ?? null;
    const icon = kind === "file"
      ? { dark: asset(columns[3]), light: asset(columns[4]) }
      : { dark: asset(columns[3]), opened: asset(columns[4]), light: asset(columns[5]), lightOpened: asset(columns[6]) };
    const previous = entries.get(name);
    if (previous) {
      for (const [variant, file] of Object.entries(icon)) {
        if (previous.assets[variant] && file && previous.assets[variant] !== file)
          throw new Error(`Conflicting ${variant} variant for ${kind}:${name}`);
        if (file) previous.assets[variant] = file;
      }
    } else {
      entries.set(name, { id: `vscode:${kind}:${name}`, name, kind, assets: icon, available: approved[kind].has(name) });
    }
  }
  return [...entries.values()];
};

const [fileMd, folderMd] = await Promise.all([
  fetchText("https://raw.githubusercontent.com/wiki/vscode-icons/vscode-icons/ListOfFiles.md"),
  fetchText("https://raw.githubusercontent.com/wiki/vscode-icons/vscode-icons/ListOfFolders.md"),
]);
const expectedWikiHashes = [
  "d00e1268637350fe90c76ddc2ad3c2c6884e164f6de8ee45592c6a67bc6878a7",
  "4246bc85d5713d0414b333b0db9c1533a432da88be814ae8a15d6ba2648c8493",
];
const hashes = [fileMd, folderMd].map((md) => createHash("sha256").update(md).digest("hex"));
if (hashes.some((hash, index) => hash !== expectedWikiHashes[index]))
  throw new Error("VSCode wiki snapshot changed; inspect before importing.");
const entries = [...parseRows(fileMd, "file"), ...parseRows(folderMd, "folder")];
if (entries.length !== 1298 || entries.filter((entry) => entry.kind === "file").length !== 1088)
  throw new Error(`Wiki catalog changed; inspect before importing (${entries.length} names)`);
const required = new Set(entries.filter((entry) => entry.available).flatMap((entry) => Object.values(entry.assets).filter(Boolean)));
const disallowed = /<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)|@import\b|url\(\s*["']?\s*(?:https?:|data:|\/\/)/i;
await mkdir(assetDir, { recursive: true });
for (const file of [...required].sort()) {
  const url = `https://raw.githubusercontent.com/vscode-icons/vscode-icons/${sourceCommit}/icons/${file}`;
  const svg = await fetchText(url);
  if (!/<svg\b/i.test(svg) || disallowed.test(svg)) throw new Error(`Unsafe or invalid SVG: ${file}`);
  await writeFile(path.join(assetDir, file), svg);
}
const output = `// Generated from vscode-icons wiki ${wikiCommit} and asset commit ${sourceCommit}.\n` +
  `// Full names retained; available=false means artwork omitted pending license verification.\n` +
  `export const vscodeIconEntries = ${JSON.stringify(entries, null, 2)} as const;\n`;
await writeFile(path.join(root, "src/shared/vscodeIconCatalog.generated.ts"), output);
await writeFile(path.join(assetDir, "SOURCE.md"), `# vscode-icons asset source\n\nSource commit: ${sourceCommit}\nWiki commit at audit: ${wikiCommit}\nWiki SHA-256 (files, folders): ${hashes.join(", ")}\n\nOnly the generic SVGs selected in \`scripts/import-vscode-icons.mjs\` are copied here. The upstream README calls icons CC BY-SA 4.0 (the README links to https://creativecommons.org/licenses/by-sa/4.0/); branded icons are subject to their respective rights holders. Artwork is separate from this application's Apache-2.0 code. Preserve attribution to the vscode-icons contributors and the upstream source when redistributing or adapting these assets.\n\nhttps://github.com/vscode-icons/vscode-icons\nhttps://github.com/vscode-icons/vscode-icons/wiki/ListOfFiles\nhttps://github.com/vscode-icons/vscode-icons/wiki/ListOfFolders\n`);
console.log(`Catalogued ${entries.length} names; copied ${required.size} SVG variants for ${entries.filter((entry) => entry.available).length} generic IDs.`);
