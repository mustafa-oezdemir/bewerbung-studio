import testSources from "./localSvgTestSources";
const loaders = import.meta.glob<string>(["../assets/material-icons/*.svg", "../assets/vscode-icons/*.svg"],
  { query: "?raw", import: "default" });
const sources = new Map(Object.entries(testSources));
const pending = new Map<string, Promise<void>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let revision = 0;
export const subscribeLocalSvgs = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const localSvgRevision = () => revision;
const request = (key: string) => {
  if (!pending.has(key)) pending.set(key, loaders[key]!().then((source) => {
    sources.set(key, source);
    setTimeout(() => { revision += 1; listeners.forEach((listener) => listener()); }, 0);
  }).catch((error: unknown) => { failed.add(key); throw error; }));
  return pending.get(key)!;
};
export const getLocalSvgSource = (catalog: "material" | "vscode", file: string) => {
  const key = `../assets/${catalog}-icons/${file}`;
  if (!sources.has(key) && loaders[key] && !failed.has(key)) void request(key).catch(() => undefined);
  return sources.get(key);
};
/** PDF export waits for local assets before calling the synchronous HTML renderer. */
export const preloadLocalSvgs = async () => { await Promise.all(Object.keys(loaders).map((key) => sources.has(key) ? undefined : request(key))); };
