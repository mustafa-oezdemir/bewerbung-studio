import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { profileSchema, type ApplicationInput } from "../src/shared/schema";
import { DataStore } from "./storage";

const input = (company: string, profileId: string): ApplicationInput => ({
  company: { name: company, city: "Berlin", street: "", postalCode: "10115", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: "Backend", fullText: "", reference: "", source: "", url: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
  templateId: "modern", accentColor: "#123456", secondaryColor: "#234567",
  designSettings: defaultDocumentDesign, profileId, notes: "",
});

describe("independent persisted application profiles", () => {
  let root: string;
  let store: DataStore;
  const source = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true,
    firstName: "Fiktiv", lastName: "Person", summary: "Hauptprofil", skills: ["Grundlage"],
    updatedAt: "2026-10-01T10:00:00.000Z" });

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "application-profile-"));
    store = new DataStore(root);
    await store.initialize();
    await store.saveProfile(source);
  });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it("keeps two CVs, their source profile, exports, backup import and duplicate independent", async () => {
    const a = (await store.createApplication(input("Alpha GmbH", source.id))).applications[0];
    const b = (await store.createApplication(input("Beta GmbH", source.id))).applications[0];
    expect(a.profileSnapshot).toEqual(source);
    expect(b.profileSnapshot).toEqual(source);
    expect(a.profileSnapshot).not.toBe(b.profileSnapshot);

    const project = { id: crypto.randomUUID(), kind: "projects" as const, title: "Projekte", isVisible: true,
      entries: [{ id: crypto.randomUUID(), title: "Java-Projekt" }] };
    const aProfile = profileSchema.parse({ ...a.profileSnapshot, title: "Java Backend", summary: "Java Backend", skills: ["Java", "Spring Boot"],
      specialSections: [project], resumeSections: { ...a.profileSnapshot!.resumeSections, skills: false } });
    const bProfile = profileSchema.parse({ ...b.profileSnapshot, title: "Golang Backend", summary: "Golang Backend", skills: ["Go", "Docker"],
      specialSections: [{ ...project, id: crypto.randomUUID(), entries: [{ id: crypto.randomUUID(), title: "Go-Projekt" }] }] });
    await store.saveApplication({ ...a, profileSnapshot: aProfile });
    await store.saveApplication({ ...b, profileSnapshot: bProfile });
    const backupPath = path.join(root, "snapshot-backup.json");
    await store.writeBackup(backupPath);
    await store.saveProfile({ ...source, summary: "Geändertes Hauptprofil" });

    const restarted = new DataStore(root);
    await restarted.initialize();
    const saved = restarted.getWorkspace();
    expect(saved.applications.find((item) => item.id === a.id)?.profileSnapshot).toEqual(aProfile);
    expect(saved.applications.find((item) => item.id === b.id)?.profileSnapshot).toEqual(bProfile);
    expect(saved.profiles[0].summary).toBe("Geändertes Hauptprofil");
    expect(restarted.getTemplateDocumentContext(a.id).data).toMatchObject({
      BERUFSBEZEICHNUNG: "Java Backend", ZUSAMMENFASSUNG: "Java Backend",
    });
    expect(restarted.getTemplateDocumentContext(b.id).data).toMatchObject({
      BERUFSBEZEICHNUNG: "Golang Backend", ZUSAMMENFASSUNG: "Golang Backend",
    });
    for (const target of ["lebenslauf", "deckblatt", "anschreiben", "mappe"] as const) {
      const aHtml = restarted.getExportHtml(a.id, target);
      const bHtml = restarted.getExportHtml(b.id, target);
      expect(aHtml).toContain("Java Backend");
      expect(aHtml).not.toContain("Golang Backend");
      expect(bHtml).toContain("Golang Backend");
      expect(bHtml).not.toContain("Java Backend");
    }
    if (process.env.APPLICATION_PROFILE_QA_OUT) {
      const output = path.resolve(process.env.APPLICATION_PROFILE_QA_OUT);
      await mkdir(output, { recursive: true });
      await writeFile(path.join(output, "alpha.html"), restarted.getExportHtml(a.id, "lebenslauf"));
      await writeFile(path.join(output, "beta.html"), restarted.getExportHtml(b.id, "lebenslauf"));
    }
    const duplicate = (await restarted.duplicateApplication(a.id)).applications[0];
    expect(duplicate.profileSnapshot).toEqual(aProfile);
    expect(duplicate.profileSnapshot).not.toBe(restarted.getApplication(a.id).profileSnapshot);
    await restarted.saveApplication({ ...duplicate, profileSnapshot: { ...duplicate.profileSnapshot!, summary: "Kopie" } });
    expect(restarted.getApplication(a.id).profileSnapshot?.summary).toBe("Java Backend");
    await restarted.removeProfile(source.id);
    expect(restarted.getApplication(a.id).profileSnapshot?.summary).toBe("Java Backend");
    const restored = await restarted.importBackup(backupPath);
    expect(restored.applications.find((item) => item.id === a.id)?.profileSnapshot).toEqual(aProfile);
    expect(restored.applications.find((item) => item.id === b.id)?.profileSnapshot).toEqual(bProfile);
  });

  it("backs up old workspace bytes before a repeatable migration and preserves other fields", async () => {
    const a = (await store.createApplication(input("Alt GmbH", source.id))).applications[0];
    const b = (await store.createApplication(input("Unverändert GmbH", source.id))).applications[0];
    const otherFile = path.join(store.files.applicationDataPath(b.folderName), "bewerbung.json");
    const otherBytes = await readFile(otherFile);
    const workspacePath = path.join(root, "data", "Setting", "Settings", "workspace.json");
    const old = store.getWorkspace();
    const oldApplication = old.applications.find((item: { id: string }) => item.id === a.id)!;
    delete oldApplication.profileSnapshot;
    oldApplication.documents.resumeProfile = "Eigener alter Kurzprofiltext";
    oldApplication.documents.coverMainBody = "Eigener Brieftext";
    await writeFile(path.join(store.files.applicationDataPath(a.folderName), "bewerbung.json"),
      JSON.stringify(oldApplication, null, 2), "utf8");
    await writeFile(workspacePath, JSON.stringify(old), "utf8");
    const oldBytes = await readFile(workspacePath);

    const restarted = new DataStore(root);
    await restarted.initialize();
    const migrated = restarted.getApplication(a.id);
    expect(migrated.profileSnapshot?.summary).toBe("Eigener alter Kurzprofiltext");
    expect(migrated.documents.legacyResumeProfile).toBe("Eigener alter Kurzprofiltext");
    expect(migrated.documents.coverMainBody).toBe("Eigener Brieftext");
    expect(migrated.updatedAt).toBe(a.updatedAt);
    expect(restarted.getApplication(b.id)).toEqual(b);
    expect(await readFile(otherFile)).toEqual(otherBytes);
    const backups = (await readdir(restarted.files.paths.backupsRoot)).filter((name) => name.startsWith("vor-profilumstellung-"));
    expect(backups).toHaveLength(1);
    expect(await readFile(path.join(restarted.files.paths.backupsRoot, backups[0]))).toEqual(oldBytes);
    const again = new DataStore(root);
    await again.initialize();
    expect(again.getApplication(a.id)).toEqual(migrated);
    expect((await readdir(again.files.paths.backupsRoot)).filter((name) => name.startsWith("vor-profilumstellung-"))).toHaveLength(1);
  });

  it("does not overwrite a broken old link during migration", async () => {
    await store.createApplication(input("Ohne Quelle GmbH", source.id));
    const workspacePath = path.join(root, "data", "Setting", "Settings", "workspace.json");
    const old = store.getWorkspace();
    delete old.applications[0].profileSnapshot;
    old.applications[0].profileId = crypto.randomUUID();
    await writeFile(workspacePath, JSON.stringify(old), "utf8");
    const before = await readFile(workspacePath);
    await expect(new DataStore(root).initialize()).rejects.toThrow("fehlt das verknüpfte Profil");
    expect(await readFile(workspacePath)).toEqual(before);
  });

  it("keeps the last saved application snapshot when a save is blocked", async () => {
    const application = (await store.createApplication(input("Sperre GmbH", source.id))).applications[0];
    const workspacePath = path.join(root, "data", "Setting", "Settings", "workspace.json");
    const before = await readFile(workspacePath);
    await writeFile(path.join(root, ".workspace.lock"), JSON.stringify({ hostname: "other-device", pid: 42 }));
    await expect(store.saveApplication({ ...application, profileSnapshot: {
      ...application.profileSnapshot!, summary: "Darf nicht gespeichert werden",
    } })).rejects.toThrow("gesperrt");
    expect(store.getApplication(application.id).profileSnapshot).toEqual(application.profileSnapshot);
    expect(await readFile(workspacePath)).toEqual(before);
  });
});
