import { renderLocalSvg } from "./localSvgRender";
import { getLocalSvgSource } from "./localSvgSources";
import { vscodeIconEntries } from "./vscodeIconCatalog.generated";

export type VscodeIconEntry = {
  id: string; name: string; kind: "file" | "folder";
  assets: { dark: string | null; light: string | null; opened?: string | null; lightOpened?: string | null };
  available: boolean;
};
export const vscodeIcons = vscodeIconEntries as readonly VscodeIconEntry[];
export const availableVscodeIcons = vscodeIcons.filter((entry) => entry.available);
const byId = new Map(vscodeIcons.map((entry) => [entry.id, entry]));
const cache = new Map<string, string>();

export const getVscodeIconEntry = (id: string) => byId.get(id);

export const getVscodeIconMarkup = (id: string, background: "light" | "dark" = "light", opened = false,
  mode: "original" | "themed" = "original"): string | undefined => {
  const entry = byId.get(id);
  if (!entry?.available) return undefined;
  const assets = entry.assets;
  const file = opened
    ? background === "light" ? assets.lightOpened ?? assets.opened : assets.opened
    : background === "light" ? assets.light ?? assets.dark : assets.dark;
  const source = file && getLocalSvgSource("vscode", file);
  if (!file || !source) return undefined;
  const key = `${id}:${file}:${mode}`;
  if (!cache.has(key)) cache.set(key, renderLocalSvg(source, id, file, mode));
  return cache.get(key);
};

export const getThemedVscodeIconMarkup = (id: string) => getVscodeIconMarkup(id, "light", false, "themed");
