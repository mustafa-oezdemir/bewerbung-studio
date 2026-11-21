// Usage: node scripts/import-vscode-icons.mjs <upstream checkout> <wiki checkout>
// The upstream manifest is read as data. No code from either checkout is executed.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { renderLocalSvg } from "../src/shared/localSvgRender.ts";

const version = "13.0.0";
const sourceCommit = "9e482fbb342849f4fefa20746657f97b88acc4ec";
const wikiCommit = "c6b602591adf87eeb130141021d79633600a8066";
const root = path.resolve(import.meta.dirname, "..");
const assetDir = path.join(root, "src/assets/vscode-icons");
const catalogPath = path.join(root, "src/shared/vscodeIconCatalog.generated.ts");
const [source, wiki] = process.argv.slice(2);
if (!source || !wiki) throw new Error("Pass the pinned vscode-icons source and wiki checkouts (see SOURCE.md).");

const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
if (git(source, "rev-parse", "HEAD") !== sourceCommit || git(wiki, "rev-parse", "HEAD") !== wikiCommit)
  throw new Error("The upstream checkouts do not match the pinned commits.");
execFileSync("git", ["-C", source, "diff", "--quiet", "HEAD", "--", "README.md", "package.json", "src/iconsManifest", "icons"]);
execFileSync("git", ["-C", wiki, "diff", "--quiet", "HEAD", "--", "ListOfFiles.md", "ListOfFolders.md"]);

const approved = {
  // Generic artwork reviewed for this snapshot. Branded artwork needs separate evidence; names alone do not grant a license.
  file: new Set((
    "file audio binary config csv db font image js key license log package readme script shell source test text video xml yaml zip zip2 " +
    "bak cddl cert cheader codeowners coverage cppheader dependencies diff dotenv dtd eps favicon funding geojson host http inc ini " +
    "json language_configuration layout lnk mailing manifest manifest_bak manifest_skip map patch pddl_happenings pddl_plan plsql " +
    "plsql_package plsql_package_body plsql_package_header plsql_package_spec rest rnc search_result sitemap sql tasks_json todo tree xsl"
  ).split(" ")),
  folder: new Set((
    "folder root_folder api app asset auth audio binary certificate cli client common component config controller coverage db dist " +
    "docs domain e2e environments favicon fonts frontend helper hook images include interfaces library locale log middleware mobile " +
    "mock model module notebooks notification package plugin private public route schema script server services shared src sso temp " +
    "template test theme tools typings video view www blueprint bot json"
  ).split(" ")),
};

const validName = /^[a-zA-Z0-9_+.-]+$/;
const variantsByKind = { file: ["dark", "light"], folder: ["dark", "opened", "light", "lightOpened"] };
const trackedIcons = new Set(git(source, "ls-files", "--", "icons/*.svg").split(/\r?\n/).map((file) => file.slice("icons/".length)));

function readWiki(markdown, kind) {
  const entries = new Map();
  const pattern = kind === "file" ? /^\|\s*<sub>\[([^\]]+)\]\(#/ : /^\|\s*\[([^\]]+)\]\(#/;
  for (const row of markdown.split("\n")) {
    const name = row.match(pattern)?.[1];
    if (!name) continue;
    if (!validName.test(name)) throw new Error("Unexpected wiki icon name: " + name);
    const cells = row.split("|").slice(3);
    const assets = entries.get(name) ?? {};
    variantsByKind[kind].forEach((variant, index) => {
      const file = /\/icons\/([a-zA-Z0-9_+.-]+\.svg)/.exec(cells[index])?.[1] ?? null;
      if (file && assets[variant] && assets[variant] !== file) throw new Error("Conflicting wiki variant: " + kind + ":" + name);
      assets[variant] = assets[variant] ?? file;
    });
    entries.set(name, assets);
  }
  return entries;
}

async function readManifest(kind) {
  const filename = kind === "file" ? "supportedExtensions.ts" : "supportedFolders.ts";
  const file = ts.createSourceFile(filename, await readFile(path.join(source, "src/iconsManifest", filename), "utf8"), ts.ScriptTarget.Latest);
  const prop = (node, key) => node.properties.find((item) => ts.isPropertyAssignment(item)
    && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === key)?.initializer;
  const collection = file.statements.filter(ts.isVariableStatement).flatMap((statement) => [...statement.declarationList.declarations])
    .find((entry) => ts.isIdentifier(entry.name) && entry.name.text === "extensions")?.initializer;
  if (!collection || !ts.isObjectLiteralExpression(collection)) throw new Error("Missing icon collection in " + filename);
  const defaults = prop(collection, "default");
  const supported = prop(collection, "supported");
  if (!defaults || !ts.isObjectLiteralExpression(defaults) || !supported || !ts.isArrayLiteralExpression(supported))
    throw new Error("Unexpected icon collection in " + filename);
  const entries = new Map();
  for (const [isDefault, rows] of [[true, defaults.properties.map((item) => item.initializer)], [false, supported.elements]]) {
    for (const row of rows) {
      if (!ts.isObjectLiteralExpression(row)) throw new Error("Unexpected manifest row in " + filename);
      const icon = prop(row, "icon");
      if (!icon || !ts.isStringLiteral(icon) || !validName.test(icon.text)) throw new Error("Unexpected icon in " + filename);
      const info = entries.get(icon.text) ?? { isDefault, light: false };
      info.light ||= prop(row, "light")?.kind === ts.SyntaxKind.TrueKeyword;
      entries.set(icon.text, info);
    }
  }
  return entries;
}

const entries = [];
const wikiHashes = [];
const trackedVariants = new Set();
const wikiVariantDifferences = [];
for (const [kind, filename] of [["file", "ListOfFiles.md"], ["folder", "ListOfFolders.md"]]) {
  const markdown = (await readFile(path.join(wiki, filename), "utf8")).replace(/\r\n/g, "\n");
  wikiHashes.push(createHash("sha256").update(markdown).digest("hex"));
  const manifest = await readManifest(kind);
  const wikiEntries = readWiki(markdown, kind);
  const wikiOnly = [...wikiEntries.keys()].filter((name) => !manifest.has(name));
  const manifestOnly = [...manifest.keys()].filter((name) => !wikiEntries.has(name));
  if (wikiOnly.length || manifestOnly.length) throw new Error(JSON.stringify({ kind, wikiOnly, manifestOnly }));
  const absentApprovals = [...approved[kind]].filter((name) => !wikiEntries.has(name));
  if (absentApprovals.length) throw new Error("Review retired approved icons: " + absentApprovals.join(", "));
  for (const [name, assets] of wikiEntries) {
    const { isDefault, light } = manifest.get(name);
    const prefix = isDefault ? "default_" : kind + "_type_";
    const expected = { dark: prefix + name + ".svg", light: light ? prefix + "light_" + name + ".svg" : null };
    if (kind === "folder") {
      expected.opened = prefix + name + "_opened.svg";
      expected.lightOpened = light ? prefix + "light_" + name + "_opened.svg" : null;
    }
    for (const variant of variantsByKind[kind]) {
      const file = expected[variant];
      if (file && !trackedIcons.has(file)) throw new Error("Manifest variant has no upstream SVG: " + file);
      if (assets[variant] && !trackedIcons.has(assets[variant])) throw new Error("Wiki variant has no upstream SVG: " + assets[variant]);
      if (assets[variant] !== file) wikiVariantDifferences.push({ id: "vscode:" + kind + ":" + name,
        variant, wiki: assets[variant], manifest: file });
      assets[variant] = file;
      if (file) trackedVariants.add(file);
    }
    entries.push({ id: "vscode:" + kind + ":" + name, name, kind, assets, available: approved[kind].has(name) });
  }
}

// Keep saved IDs readable after upstream removes them. Never silently redirect a saved ID to a different drawing.
const previousText = await readFile(catalogPath, "utf8");
const previous = JSON.parse(previousText.slice(previousText.indexOf("= [") + 2, previousText.lastIndexOf(" as const;")));
const currentIds = new Set(entries.map(({ id }) => id));
const retired = previous.filter(({ id }) => !currentIds.has(id)).map((entry) => ({ ...entry, retired: true }));
entries.push(...retired);

const required = new Map();
for (const entry of entries) if (entry.available && !entry.retired) {
  for (const file of Object.values(entry.assets)) if (file) required.set(file, entry.id);
}
const added = [];
const updated = [];
const writes = [];
const readExisting = (file) => readFile(file, "utf8").catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
for (const [file, id] of [...required].sort(([a], [b]) => a.localeCompare(b))) {
  const svg = await readFile(path.join(source, "icons", file), "utf8");
  if (!renderLocalSvg(svg, id, file, "original").includes("viewBox="))
    throw new Error("Missing SVG geometry: " + file);
  renderLocalSvg(svg, id, file, "themed");
  const destination = path.join(assetDir, file);
  const existing = await readExisting(destination);
  if (existing?.replace(/\r\n/g, "\n") === svg.replace(/\r\n/g, "\n")) continue;
  (existing === undefined ? added : updated).push(file);
  writes.push([destination, svg]);
}
const counts = Object.fromEntries(["file", "folder"].map((kind) => {
  const active = entries.filter((entry) => entry.kind === kind && !entry.retired);
  return [kind, { listed: active.length, selectable: active.filter((entry) => entry.available).length,
    licenseNotVerified: active.filter((entry) => !entry.available).length }];
}));

await mkdir(assetDir, { recursive: true });
for (const [file, svg] of writes) await writeFile(file, svg);
const header = "// Generated from vscode-icons wiki " + wikiCommit + " and asset commit " + sourceCommit + ".\n"
  + "// Current wiki entries with available=false lack verified artwork redistribution rights. Retired IDs are retained.\n";
await writeFile(catalogPath, header + "export const vscodeIconEntries = " + JSON.stringify(entries, null, 2) + " as const;\n");
console.log(JSON.stringify({ version, sourceCommit, wikiCommit, wikiHashes, counts, referencedVariants: trackedVariants.size,
  packagedVariants: required.size, added, updated, retired: retired.map(({ id }) => id), wikiVariantDifferences }, null, 2));
