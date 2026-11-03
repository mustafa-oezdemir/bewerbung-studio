import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const source = process.argv[2];
if (!source) throw new Error("Pass the checked-out Material Icon Theme v5.40.0 directory.");
const commit = "045291ff033062a25441dd297fd51546326866f2";
if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim() !== commit)
  throw new Error("Material source is not the reviewed v5.40.0 commit.");
const root = path.resolve(import.meta.dirname, "..");
const icons = new Set(await readdir(path.join(source, "icons")));
const unsafe = /<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)|@import\b|url\(\s*["']?\s*(?:https?:|data:|\/\/)/i;
for (const file of icons) {
  if (!file.endsWith(".svg")) continue;
  const svg = await readFile(path.join(source, "icons", file), "utf8");
  if (!/<svg\b/i.test(svg) || unsafe.test(svg)) throw new Error(`Unsafe SVG: ${file}`);
}
const definitions = new Map();
const collect = async (kind, file) => {
  const content = await readFile(path.join(source, file), "utf8");
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const propertyName = (property) => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : "";
  const strings = (object, key) => {
    const prop = object.properties.find((item) => ts.isPropertyAssignment(item) && propertyName(item) === key);
    return prop && ts.isPropertyAssignment(prop) && ts.isArrayLiteralExpression(prop.initializer)
      ? prop.initializer.elements.filter(ts.isStringLiteral).map((item) => item.text) : [];
  };
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const prop = node.properties.find((item) => ts.isPropertyAssignment(item) && propertyName(item) === "name");
      const name = prop && ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer) ? prop.initializer.text : null;
      if (name && icons.has(`${name}.svg`)) {
        const key = `${kind}:${name}`;
        const previous = definitions.get(key) ?? { kind, sourceName: name, associations: [], listed: true };
        previous.associations = [...new Set([...previous.associations, ...strings(node, kind === "file" ? "fileExtensions" : "folderNames"), ...strings(node, "fileNames")])];
        definitions.set(key, previous);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
};
await collect("file", "src/core/icons/fileIcons.ts");
await collect("folder", "src/core/icons/folderIcons.ts");

// Source SVGs without an active manifest association remain selectable by their published name.
for (const file of icons) {
  if (!file.endsWith(".svg") || file.endsWith("_light.svg")) continue;
  const name = file.slice(0, -4);
  const kind = name === "folder" || name.startsWith("folder-") ? "folder" : "file";
  const key = `${kind}:${name}`;
  if (!definitions.has(key)) definitions.set(key, { kind, sourceName: name, associations: [], listed: false });
}
const entries = [...definitions.values()].map((entry) => {
  const concept = entry.kind === "folder" && entry.sourceName.startsWith("folder-") ? entry.sourceName.slice(7) : entry.sourceName;
  return { id: `material:${entry.kind}:${entry.sourceName}`, name: entry.sourceName, concept, kind: entry.kind,
    assets: { dark: `${entry.sourceName}.svg`, light: icons.has(`${entry.sourceName}_light.svg`) ? `${entry.sourceName}_light.svg` : null },
    associations: entry.associations, listed: entry.listed };
}).sort((a, b) => a.kind.localeCompare(b.kind) || a.concept.localeCompare(b.concept));
if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Material ID collision");
const imported = new Set((await readdir(path.join(root, "src/assets/material-icons"))).filter((file) => file.endsWith(".svg")));
for (const entry of entries) for (const file of Object.values(entry.assets)) if (file && !imported.has(file)) throw new Error(`Missing packaged ${file}`);
await writeFile(path.join(root, "src/shared/materialIconCatalog.generated.ts"),
  `// Material Icon Theme v5.40.0, source commit ${commit}. Original names and variants.\nexport const materialIconEntries = ${JSON.stringify(entries, null, 2)} as const;\n`);
const materialNames = new Map(entries.map((entry) => [`${entry.kind}:${entry.concept.toLowerCase()}`, entry]));
const vscodeText = await readFile(path.join(root, "src/shared/vscodeIconCatalog.generated.ts"), "utf8");
const vscodeEntries = JSON.parse(vscodeText.slice(vscodeText.indexOf("= [") + 2, vscodeText.lastIndexOf(" as const;")));
const wikiHashes = {
  file: "d00e1268637350fe90c76ddc2ad3c2c6884e164f6de8ee45592c6a67bc6878a7",
  folder: "4246bc85d5713d0414b333b0db9c1533a432da88be814ae8a15d6ba2648c8493",
};
const hints = new Map();
for (const kind of ["file", "folder"]) {
  const url = `https://raw.githubusercontent.com/wiki/vscode-icons/vscode-icons/ListOf${kind === "file" ? "Files" : "Folders"}.md`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot read ${url}`);
  const markdown = await response.text();
  if (createHash("sha256").update(markdown).digest("hex") !== wikiHashes[kind]) throw new Error("VSCode wiki snapshot changed");
  for (const line of markdown.split(/\r?\n/)) {
    const columns = line.split("|");
    const name = /\[([^\]]+)\]\(#[^)]+\)/.exec(columns[1] ?? "")?.[1];
    if (!name) continue;
    const tokens = (columns[2] ?? "").replace(/<[^>]+>|\*\*|`/g, "").split(",")
      .map((token) => token.trim().toLowerCase()).filter((token) => /^[.a-z0-9_+-]+$/.test(token));
    const key = `${kind}:${name.toLowerCase()}`;
    hints.set(key, [...new Set([...(hints.get(key) ?? []), ...tokens])]);
  }
}
const aliases = { reactjs: "react", reactts: "react", javascript: "javascript", js: "javascript", ts: "typescript", docker2: "docker", nodejs: "node", python3: "python", css2: "css" };
const matches = [];
const unmatchedVscode = [];
for (const vscode of vscodeEntries) {
  const key = vscode.name.toLowerCase();
  const concept = aliases[key] ?? key;
  const material = materialNames.get(`${vscode.kind}:${concept}`);
  if (material) {
    const commonAssociations = material.associations.map((item) => item.toLowerCase())
      .filter((item) => hints.get(`${vscode.kind}:${key}`)?.includes(item));
    matches.push({ concept, kind: vscode.kind, materialId: material.id, vscodeId: vscode.id,
    reason: concept !== key ? `reviewed alias ${key} → ${concept}` : commonAssociations.length
      ? `same icon kind and upstream association: ${commonAssociations.slice(0, 3).join(", ")}`
      : "same published concept and icon kind; no shared association recorded",
    alternativeAvailable: vscode.available });
  } else unmatchedVscode.push({ id: vscode.id, available: vscode.available });
}
const matchedMaterial = new Set(matches.map((match) => match.materialId));
const report = { source: { materialTag: "v5.40.0", materialCommit: commit, vscodeCommit: "f0a0c40aeae5eba2917ada14ad59b7e7f729e396" },
  counts: { material: entries.length, vscode: vscodeEntries.length, common: matches.length,
    materialOnly: entries.filter((entry) => !matchedMaterial.has(entry.id)).length,
    vscodeOnly: unmatchedVscode.length, selectableVscodeAlternatives: matches.filter((match) => match.alternativeAvailable).length,
    unresolved: vscodeEntries.filter((entry) => !entry.available).length,
    associationVerified: matches.filter((match) => match.reason.includes("upstream association")).length,
    aliasReviewed: matches.filter((match) => match.reason.startsWith("reviewed alias")).length,
    nameOnly: matches.filter((match) => match.reason.includes("no shared association")).length }, matches, unmatchedVscode };
await writeFile(path.join(root, "src/shared/iconComparison.generated.json"), JSON.stringify(report, null, 2) + "\n");
const hash = createHash("sha256").update([...icons].filter((file) => file.endsWith(".svg")).sort().join("\n")).digest("hex");
await writeFile(path.join(root, "src/assets/material-icons/SOURCE.md"), `# Material Icon Theme\n\nVersion: v5.40.0\nSource commit: ${commit}\nSVG filenames SHA-256: ${hash}\n\nThe 908 original SVGs are from https://github.com/material-extensions/vscode-material-icon-theme/tree/v5.40.0/icons. The repository's MIT license is preserved in LICENSE. Product marks remain with their owners.\n`);
console.log(JSON.stringify(report.counts));
