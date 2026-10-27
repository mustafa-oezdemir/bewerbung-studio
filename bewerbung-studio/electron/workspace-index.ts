import path from "node:path";
import { lstat, readFile } from "./security/secure-fs";
import {
  applicationSchema,
  profileSchema,
  workspaceSchema,
  type Workspace,
} from "../src/shared/schema";
import { assertNoDroppedKeys, centralDataSchema, workspaceIndexSchema, type WorkspaceIndex } from "../src/shared/workspaceIndexSchema";
export { centralDataSchema, workspaceIndexSchema } from "../src/shared/workspaceIndexSchema";
export type { WorkspaceIndex, CentralData } from "../src/shared/workspaceIndexSchema";
import type { ApplicationPaths } from "../src/config/application-paths";
import { isPathInside } from "./file-management";

export const relativeReference = (paths: ApplicationPaths, absolute: string) =>
  path.relative(paths.root, absolute).split(path.sep).join("/");

export const safeApplicationFolderName = (name: string) =>
  Boolean(name) && !path.isAbsolute(name) && !path.win32.isAbsolute(name) &&
  !name.split(/[\\/]+/).some((part) => !part || part === "." || part === ".." || part.includes(":"));

/** Reject traversal, alternate Windows path syntax and links before reading an indexed file. */
export const resolveReference = async (paths: ApplicationPaths, relative: string, area: "application" | "profile" | "central") => {
  if (!relative || relative.includes("\\") || path.isAbsolute(relative) || path.win32.isAbsolute(relative) ||
      relative.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":")))
    throw new Error("Ungültiger Dateipfad im Datenbestand.");
  const absolute = path.resolve(paths.root, ...relative.split("/"));
  const base = area === "application" ? paths.applicationsData :
    area === "profile" ? paths.profileRoot : paths.settingsRoot;
  if (!isPathInside(base, absolute) || absolute === base ||
      (area === "application" && path.basename(absolute) !== "bewerbung.json") ||
      (area !== "application" && path.extname(absolute).toLowerCase() !== ".json"))
    throw new Error("Ungültiger Dateipfad im Datenbestand.");
  if ((await lstat(paths.root)).isSymbolicLink())
    throw new Error("Eine Verknüpfung im Datenbestand ist nicht zulässig.");
  let current = paths.root;
  for (const part of path.relative(paths.root, absolute).split(path.sep)) {
    current = path.join(current, part);
    const info = await lstat(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (info?.isSymbolicLink()) throw new Error("Eine Verknüpfung im Datenbestand ist nicht zulässig.");
  }
  return absolute;
};

const uniqueIdsAndPaths = (items: readonly { id: string; path: string }[]) => {
  if (new Set(items.map((item) => item.id)).size !== items.length ||
      new Set(items.map((item) => item.path.toLowerCase())).size !== items.length)
    throw new Error("Doppelte Datei- oder ID-Referenz im Datenbestand.");
};

export const hydrateWorkspaceIndex = async (paths: ApplicationPaths, index: WorkspaceIndex): Promise<Workspace> => {
  uniqueIdsAndPaths(index.applications);
  uniqueIdsAndPaths(index.profiles);
  const applications = [];
  for (const ref of index.applications) {
    const file = await resolveReference(paths, ref.path, "application");
    let value: unknown;
    try { value = JSON.parse(await readFile(file, "utf8")); }
    catch { throw new Error(`Bewerbungsdatei fehlt oder ist beschädigt: ${ref.path}`); }
    const parsed = applicationSchema.safeParse(value);
    if (parsed.success) assertNoDroppedKeys(value, parsed.data, `Bewerbungsdatei ${ref.path}`);
    if (!parsed.success || parsed.data.id !== ref.id || !safeApplicationFolderName(parsed.data.folderName) ||
        relativeReference(paths, path.join(paths.applicationsData, parsed.data.folderName, "bewerbung.json")) !== ref.path)
      throw new Error(`Bewerbungsdatei hat eine ungültige ID oder einen ungültigen Inhalt: ${ref.path}`);
    applications.push(parsed.data);
  }
  const profiles = [];
  for (const ref of index.profiles) {
    const file = await resolveReference(paths, ref.path, "profile");
    let value: unknown;
    try { value = JSON.parse(await readFile(file, "utf8")); }
    catch { throw new Error(`Profildatei fehlt oder ist beschädigt: ${ref.path}`); }
    const parsed = profileSchema.safeParse(value);
    if (parsed.success) assertNoDroppedKeys(value, parsed.data, `Profildatei ${ref.path}`);
    if (!parsed.success || parsed.data.id !== ref.id)
      throw new Error(`Profildatei hat eine ungültige ID oder einen ungültigen Inhalt: ${ref.path}`);
    profiles.push(parsed.data);
  }
  const centralFile = await resolveReference(paths, index.centralPath, "central");
  let centralValue: unknown;
  try { centralValue = JSON.parse(await readFile(centralFile, "utf8")); }
  catch { throw new Error(`Zentrale Datendatei fehlt oder ist beschädigt: ${index.centralPath}`); }
  const central = centralDataSchema.parse(centralValue);
  assertNoDroppedKeys(centralValue, central, `Zentrale Datei ${index.centralPath}`);
  return workspaceSchema.parse({ schemaVersion: 1, applications, profiles,
    events: central.events, attachments: central.attachments, todos: central.todos,
    customCvDesigns: central.customCvDesigns, settings: index.settings, updatedAt: index.updatedAt });
};
