import { renderLocalSvg } from "./localSvgRender";
import { getLocalSvgSource } from "./localSvgSources";
import { materialIconEntries } from "./materialIconCatalog.generated";

export type MaterialIconEntry = {
  id: string; name: string; concept: string; kind: "file" | "folder";
  assets: { dark: string; light: string | null };
  associations: readonly string[]; listed: boolean;
};
export const materialIcons = materialIconEntries as readonly MaterialIconEntry[];
const byId = new Map(materialIcons.map((entry) => [entry.id, entry]));
const cache = new Map<string, string>();

export const getMaterialIconEntry = (id: string) => byId.get(id);
export const getMaterialIconMarkup = (id: string, background: "light" | "dark" = "light",
  mode: "original" | "themed" = "original"): string | undefined => {
  const entry = byId.get(id);
  if (!entry) return undefined;
  const file = background === "light" ? entry.assets.light ?? entry.assets.dark : entry.assets.dark;
  const source = getLocalSvgSource("material", file);
  if (!source) return undefined;
  const key = `${id}:${file}:${mode}`;
  if (!cache.has(key)) cache.set(key, renderLocalSvg(source, id, file, mode));
  return cache.get(key);
};

// Hand-reviewed aliases bridge common technology labels to the upstream source names.
const conceptAliases: Record<string, string> = {
  "c++": "cpp", "c#": "csharp", "f#": "fsharp", "node.js": "nodejs", node: "nodejs",
  "react.js": "react", reactjs: "react", js: "javascript", ts: "typescript",
  "docker compose": "docker", "spring boot": "spring", springboot: "spring",
  "rest api": "api", "web api": "api", datenbank: "database", datenbanken: "database",
};
export const getAutomaticMaterialIconId = (normalizedTechnology: string) => {
  const key = (conceptAliases[normalizedTechnology] ?? normalizedTechnology).replace(/[\s.]+/g, "-");
  const file = `material:file:${key}`;
  if (byId.has(file)) return file;
  const folder = `material:folder:folder-${key}`;
  return byId.has(folder) ? folder : undefined;
};
