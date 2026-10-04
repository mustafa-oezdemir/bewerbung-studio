import path from "node:path";

export const DEFAULT_BEWERBUNG_ROOT_PATH = "D:\\bewerbung_mustafa";
export const BEWERBUNG_ROOT_PATH_ENV = "BEWERBUNG_ROOT_PATH";

export interface ApplicationPaths {
  root: string;
  dataRoot: string;
  settingRoot: string;
  settingsRoot: string;
  profileRoot: string;
  backupsRoot: string;
  logsRoot: string;
  crashDumpsRoot: string;
  electronSessionRoot: string;
  deletedRoot: string;
  applicationsData: string;
  musterRoot: string;
  anschreibenTemplates: string;
  deckblattTemplates: string;
  lebenslaufTemplates: string;
  anschreibenDocuments: string;
  lebenslaufDocuments: string;
  zeugnisseArchive: string;
  zertifikateArchive: string;
  absagenRoot: string;
  interviewsRoot: string;
  previewCache: string;
  systemTemplateCache: string;
  bundledTemplatesRoot?: string;
}

export const resolveBewerbungRootPath = (
  environment: Record<string, string | undefined> = process.env,
) => {
  const configured = environment[BEWERBUNG_ROOT_PATH_ENV]?.trim();
  return path.resolve(configured || DEFAULT_BEWERBUNG_ROOT_PATH);
};

export const resolveApplicationPaths = (
  rootPath = resolveBewerbungRootPath(),
  bundledTemplatesRoot?: string,
): ApplicationPaths => {
  const root = path.resolve(rootPath);
  const dataRoot = path.join(root, "data");
  const settingRoot = path.join(dataRoot, "Setting");
  const musterRoot = path.join(settingRoot, "Muster");
  return {
    root,
    dataRoot,
    settingRoot,
    settingsRoot: path.join(settingRoot, "Settings"),
    profileRoot: path.join(settingRoot, "Profile"),
    backupsRoot: path.join(settingRoot, "Backups"),
    logsRoot: path.join(settingRoot, "Logs"),
    crashDumpsRoot: path.join(settingRoot, "CrashDumps"),
    electronSessionRoot: path.join(settingRoot, "ElectronSession"),
    deletedRoot: path.join(dataRoot, "Silinenler"),
    applicationsData: path.join(dataRoot, "Bewerbungen"),
    musterRoot,
    anschreibenTemplates: path.join(musterRoot, "Anschreiben"),
    deckblattTemplates: path.join(musterRoot, "Deckblatt"),
    lebenslaufTemplates: path.join(musterRoot, "Lebenslauf"),
    // Read-only compatibility roots for documents created by older versions.
    anschreibenDocuments: path.join(dataRoot, "Anschreiben"),
    lebenslaufDocuments: path.join(dataRoot, "Lebenslauf"),
    zeugnisseArchive: path.join(dataRoot, "Zeugnisse"),
    zertifikateArchive: path.join(dataRoot, "Zertifikate"),
    absagenRoot: path.join(dataRoot, "Absagen"),
    interviewsRoot: path.join(dataRoot, "Vorstellungsgespräch"),
    previewCache: path.join(settingRoot, "cache", "template-previews"),
    systemTemplateCache: path.join(settingRoot, "cache", "system-templates"),
    bundledTemplatesRoot,
  };
};
