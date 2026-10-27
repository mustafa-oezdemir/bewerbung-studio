import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import type { ApplicationInput } from "../src/shared/schema";
import { parseInterviewQuestions } from "../src/shared/interviewQuestions";
import { DataStore } from "./storage";
import { addSyntheticProfile } from "./test-profile";
import { interviewFileNameSchema, interviewRevisionSchema } from "./interview-notes";
import { clearActiveEncryption, setActiveEncryption } from "./security/secure-fs";
import { WorkspaceSecurity } from "./security/workspace-security";

const input = (company: string, title = "Softwareentwickler"): ApplicationInput => ({
  company: { name: company, street: "", postalCode: "10115", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: {
    title, reference: "", source: "", url: "", fullText: "", workModel: "Hybrid",
    contractType: "Unbefristet", salaryExpectation: "",
  },
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
});

const questions = (prefix: string, count = 2) => Array.from({ length: count }, (_, index) =>
  `Frage ${index + 1}: ${prefix} Frage ${index + 1}?\n\nErklärung:\n${prefix} Erklärung ${index + 1}\n\nAntwort:\n${prefix} Antwort ${index + 1}\n- Größe\n- Übung\n`,
).join("\n");

const interviewAt = new Date(2026, 9, 22, 10, 0, 0).toISOString();

describe("Vorstellungsgespräch – Fragen & Antworten files", () => {
  let root: string;
  let store: DataStore;
  let queued: string[];

  const createInterview = async (company: string, title?: string, date: string | null = interviewAt) => {
    const created = await store.createApplication(input(company, title));
    const application = created.applications[0];
    await store.changeStatus(application.id, "Vorstellungsgespräch");
    if (date) await store.saveApplication({ ...store.getApplication(application.id), interviewAt: date });
    return store.getApplication(application.id);
  };
  const folderOf = (id: string) => store.files.interviewPath(store.getApplication(id));

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbung-interview-"));
    queued = [];
    store = new DataStore(root, {
      queueCommit: (company, action, description) => queued.push(`${action}:${company}:${description?.details?.join(",") ?? ""}`),
    });
    await store.initialize();
    await addSyntheticProfile(store);
  });

  afterEach(async () => {
    clearActiveEncryption();
    await rm(root, { recursive: true, force: true });
  });

  it("saves new files as Vorstellungsgespräch_<Firma>.md, _1, _2 in the interview folder and never changes earlier ones", async () => {
    const application = await createInterview("Seidel GmbH & Co. KG");
    const folder = folderOf(application.id);
    expect(path.basename(folder)).toBe("Seidel_GmbH_&_Co._KG_2026-10-22");
    expect(path.dirname(folder)).toBe(path.join(root, "data", "Vorstellungsgespräch"));

    const first = await store.createInterviewNote(application.id, questions("Erste", 10));
    expect(first.file.fileName).toBe("Vorstellungsgespräch_Seidel.md");
    const firstBytes = await readFile(path.join(folder, "Vorstellungsgespräch_Seidel.md"));
    const second = await store.createInterviewNote(application.id, questions("Zweite"));
    const third = await store.createInterviewNote(application.id, questions("Dritte"));
    expect([second.file.fileName, third.file.fileName]).toEqual(["Vorstellungsgespräch_Seidel_1.md", "Vorstellungsgespräch_Seidel_2.md"]);
    expect(await readFile(path.join(folder, "Vorstellungsgespräch_Seidel.md"))).toEqual(firstBytes);

    const markdown = await readFile(path.join(folder, "Vorstellungsgespräch_Seidel.md"), "utf8");
    expect(markdown.startsWith("# Vorstellungsgespräch\n\n## Frage 1: Erste Frage 1?\n\n### Erklärung\nErste Erklärung 1")).toBe(true);
    expect(parseInterviewQuestions(markdown).questions).toHaveLength(10);
    expect(queued.filter((entry) => entry.startsWith("interview:"))).toEqual([
      "interview:Seidel GmbH & Co. KG:Vorstellungsgespräch_Seidel.md angelegt",
      "interview:Seidel GmbH & Co. KG:Vorstellungsgespräch_Seidel_1.md angelegt",
      "interview:Seidel GmbH & Co. KG:Vorstellungsgespräch_Seidel_2.md angelegt",
    ]);
    // No temporary file stays behind and nothing goes into workspace.json.
    expect((await readdir(folder)).sort()).toEqual(["Vorstellungsgespräch_Seidel.md", "Vorstellungsgespräch_Seidel_1.md", "Vorstellungsgespräch_Seidel_2.md"]);
    expect(await readFile(path.join(root, "data", "Setting", "Settings", "workspace.json"), "utf8")).not.toContain("Erste Antwort");
  });

  it("lists every file numerically after a restart and keeps the older names next to new company names", async () => {
    const application = await createInterview("Sortier AG");
    const folder = folderOf(application.id);
    await mkdir(folder, { recursive: true });
    for (const name of ["Vorstellungsgespräch_10.md", "Vorstellungsgespräch_2.md", "Vorstellungsgespräch.md", "Notizen.txt"]) {
      await writeFile(path.join(folder, name), name.endsWith(".md") ? questions(name) : "privat");
    }
    const reopened = new DataStore(root);
    await reopened.initialize();
    const listing = await reopened.listInterviewNotes(application.id);
    expect(listing.folderName).toBe("Sortier_AG_2026-10-22");
    expect(listing.files.map((file) => file.fileName)).toEqual([
      "Vorstellungsgespräch.md", "Vorstellungsgespräch_2.md", "Vorstellungsgespräch_10.md",
    ]);
    expect(listing.files[2].content).toBe(questions("Vorstellungsgespräch_10.md"));
    expect((await reopened.createInterviewNote(application.id, questions("Neu"))).file.fileName).toBe("Vorstellungsgespräch_Sortier.md");
  });

  it("updates exactly the opened file, refuses an outdated revision and writes nothing for unchanged text", async () => {
    const application = await createInterview("Update GmbH");
    await store.createInterviewNote(application.id, questions("Alt"));
    await store.createInterviewNote(application.id, questions("Zweite"));
    const folder = folderOf(application.id);
    const secondBytes = await readFile(path.join(folder, "Vorstellungsgespräch_Update_1.md"));
    const [file] = (await store.listInterviewNotes(application.id)).files;

    const updated = await store.updateInterviewNote(application.id, file.fileName, questions("Neu", 3), file.revision);
    expect(updated.changed).toBe(true);
    expect(updated.file.fileName).toBe("Vorstellungsgespräch_Update.md");
    expect(parseInterviewQuestions(updated.file.content!).questions.map((question) => question.question))
      .toEqual(["Neu Frage 1?", "Neu Frage 2?", "Neu Frage 3?"]);
    expect(await readdir(folder)).toHaveLength(2);
    expect(await readFile(path.join(folder, "Vorstellungsgespräch_Update_1.md"))).toEqual(secondBytes);

    const savedBytes = await readFile(path.join(folder, "Vorstellungsgespräch_Update.md"));
    await expect(store.updateInterviewNote(application.id, file.fileName, questions("Veraltet"), file.revision))
      .rejects.toThrow("wurde inzwischen außerhalb dieser Ansicht geändert");
    expect(await readFile(path.join(folder, "Vorstellungsgespräch_Update.md"))).toEqual(savedBytes);

    queued.length = 0;
    const same = await store.updateInterviewNote(application.id, file.fileName, updated.file.content!, updated.file.revision);
    expect(same.changed).toBe(false);
    expect(queued).toEqual([]);
    expect(await readFile(path.join(folder, "Vorstellungsgespräch_Update.md"))).toEqual(savedBytes);
  });

  it("deletes exactly the chosen file and keeps it under Silinenler", async () => {
    const application = await createInterview("Lösch GmbH");
    await store.createInterviewNote(application.id, questions("Erste"));
    await store.createInterviewNote(application.id, questions("Zweite"));
    const folder = folderOf(application.id);
    const firstBytes = await readFile(path.join(folder, "Vorstellungsgespräch_Lösch.md"));
    const [, second] = (await store.listInterviewNotes(application.id)).files;
    const secondBytes = await readFile(path.join(folder, second.fileName));

    await expect(store.removeInterviewNote(application.id, second.fileName, "a".repeat(64)))
      .rejects.toThrow("wurde inzwischen außerhalb dieser Ansicht geändert und wurde nicht gelöscht");
    queued.length = 0;
    const removed = await store.removeInterviewNote(application.id, second.fileName, second.revision);
    expect(removed.fileName).toBe("Vorstellungsgespräch_Lösch_1.md");
    expect(removed.archivedAs).toMatch(
      /^Vorstellungsgespräch[\\/]Losch_GmbH_2026-10-22[\\/]Vorstellungsgespräch_Lösch_1_gelöscht_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.md$/,
    );
    expect(await readdir(folder)).toEqual(["Vorstellungsgespräch_Lösch.md"]);
    expect(await readFile(path.join(folder, "Vorstellungsgespräch_Lösch.md"))).toEqual(firstBytes);
    const archived = path.join(root, "data", "Silinenler", removed.archivedAs);
    expect(await readFile(archived)).toEqual(secondBytes);
    expect(queued).toEqual(["interview:Lösch GmbH:Vorstellungsgespräch_Lösch_1.md gelöscht"]);
    // The next new file takes the next number again; the archive is never a note.
    expect((await store.listInterviewNotes(application.id)).files.map((file) => file.fileName)).toEqual(["Vorstellungsgespräch_Lösch.md"]);
    expect((await store.createInterviewNote(application.id, questions("Neu"))).file.fileName).toBe("Vorstellungsgespräch_Lösch_1.md");
    await expect(store.removeInterviewNote(application.id, "../Vorstellungsgespräch.md", "a".repeat(64))).rejects.toThrow("nicht gefunden");
  });

  it("gives the path of exactly a listed note for opening it, never another path", async () => {
    const application = await createInterview("Öffnen GmbH");
    const created = await store.createInterviewNote(application.id, questions("Offen"));
    expect(await store.getInterviewNotePath(application.id, created.file.fileName))
      .toBe(path.join(folderOf(application.id), "Vorstellungsgespräch_Öffnen.md"));
    await expect(store.getInterviewNotePath(application.id, "Vorstellungsgespräch_Öffnen_1.md")).rejects.toThrow("nicht gefunden");
    await expect(store.getInterviewNotePath(application.id, "../workspace.json")).rejects.toThrow("nicht gefunden");
    await expect(store.getInterviewNotePath("unbekannt", created.file.fileName)).rejects.toThrow("Bewerbung wurde nicht gefunden.");
  });

  it("can delete a damaged file", async () => {
    const application = await createInterview("Defekt GmbH");
    const folder = folderOf(application.id);
    await writeFile(path.join(folder, "Vorstellungsgespräch.md"), Buffer.from([0xff, 0xfe, 0x00]));
    const [file] = (await store.listInterviewNotes(application.id)).files;
    expect(file.content).toBeNull();
    expect(file.revision).toMatch(/^[0-9a-f]{64}$/);
    await store.removeInterviewNote(application.id, file.fileName, file.revision);
    expect(await readdir(folder)).toEqual([]);
  });

  it("refuses invalid input before writing anything", async () => {
    const application = await createInterview("Eingabe GmbH");
    await expect(store.createInterviewNote(application.id, "Nur Text ohne Frage"))
      .rejects.toThrow("Die Fragen wurden nicht gespeichert: Es wurde keine Frage erkannt.");
    await expect(store.createInterviewNote(application.id, "Frage 1:\nAntwort: a"))
      .rejects.toThrow("Frage 1: Der Fragetext fehlt.");
    await expect(store.createInterviewNote("unbekannt", questions("X"))).rejects.toThrow("Bewerbung wurde nicht gefunden.");
    const plain = (await store.createApplication(input("Ohne Gespräch GmbH"))).applications[0];
    await expect(store.createInterviewNote(plain.id, questions("X")))
      .rejects.toThrow("Für diese Bewerbung ist kein Vorstellungsgespräch eingetragen.");
    expect(await readdir(folderOf(application.id))).toEqual([]);
  });

  it("accepts only the allowed file names and never leaves the interview folder", async () => {
    for (const name of ["../workspace.json", "..\\Vorstellungsgespräch.md", "Vorstellungsgespräch.md/../x.md",
      "C:\\Vorstellungsgespräch.md", "Vorstellungsgespräch_0.md", "Notizen.md", "Vorstellungsgespräch.md.tmp"]) {
      expect(interviewFileNameSchema.safeParse(name).success).toBe(false);
    }
    expect(interviewRevisionSchema.safeParse("../etc").success).toBe(false);
    const application = await createInterview("Pfad GmbH");
    await expect(store.updateInterviewNote(application.id, "Vorstellungsgespräch_4.md", questions("X"), "a".repeat(64)))
      .rejects.toThrow("„Vorstellungsgespräch_4.md“ wurde im Vorstellungsgesprächsordner nicht gefunden.");
    await expect(store.updateInterviewNote(application.id, "../Vorstellungsgespräch.md", questions("X"), "a".repeat(64)))
      .rejects.toThrow("nicht gefunden");
  });

  it("does not follow a symbolic link or junction for the interview folder", async () => {
    const application = await createInterview("Link GmbH");
    const folder = folderOf(application.id);
    const outside = path.join(root, "outside");
    await mkdir(outside);
    await rm(folder, { recursive: true, force: true });
    await symlink(outside, folder, "junction");
    await expect(store.listInterviewNotes(application.id)).rejects.toThrow("aus Sicherheitsgründen nicht verwendet");
    await expect(store.createInterviewNote(application.id, questions("X"))).rejects.toThrow("aus Sicherheitsgründen");
    expect(await readdir(outside)).toEqual([]);
  });

  it("does not read a note that is a symbolic link", async (context) => {
    const application = await createInterview("Dateilink GmbH");
    const folder = folderOf(application.id);
    const secret = path.join(root, "geheim.md");
    await writeFile(secret, questions("Geheim"));
    try {
      await symlink(secret, path.join(folder, "Vorstellungsgespräch.md"), "file");
    } catch {
      context.skip(); // Windows without the right to create file symlinks.
    }
    const [file] = (await store.listInterviewNotes(application.id)).files;
    expect(file).toMatchObject({ fileName: "Vorstellungsgespräch.md", content: null });
    expect(file.error).toContain("aus Sicherheitsgründen nicht geöffnet");
  });

  it("shows a damaged file with its name and never overwrites it", async () => {
    const application = await createInterview("Kaputt GmbH");
    const folder = folderOf(application.id);
    const damaged = Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x00, 0xc3]);
    await writeFile(path.join(folder, "Vorstellungsgespräch.md"), damaged);
    const [file] = (await store.listInterviewNotes(application.id)).files;
    expect(file.content).toBeNull();
    expect(file.error).toBe("„Vorstellungsgespräch.md“ ist keine gültige UTF-8-Textdatei. Die Datei wird nicht überschrieben.");
    await expect(store.updateInterviewNote(application.id, file.fileName, questions("X"), "a".repeat(64)))
      .rejects.toThrow("keine gültige UTF-8-Textdatei");
    expect((await store.createInterviewNote(application.id, questions("Neu"))).file.fileName).toBe("Vorstellungsgespräch_Kaputt.md");
    expect(await readFile(path.join(folder, "Vorstellungsgespräch.md"))).toEqual(damaged);
  });

  it("keeps the existing file when the write fails and reports it in German", async () => {
    const application = await createInterview("Schreibschutz GmbH");
    const created = await store.createInterviewNote(application.id, questions("Alt"));
    const target = path.join(folderOf(application.id), created.file.fileName);
    const before = await readFile(target);
    await chmod(target, 0o444);
    try {
      await expect(store.updateInterviewNote(application.id, created.file.fileName, questions("Neu"), created.file.revision))
        .rejects.toThrow("„Vorstellungsgespräch_Schreibschutz.md“ konnte nicht gespeichert werden. Vorhandene Inhalte bleiben unverändert.");
      expect(await readFile(target)).toEqual(before);
      expect(await readdir(folderOf(application.id))).toEqual(["Vorstellungsgespräch_Schreibschutz.md"]);
    } finally {
      await chmod(target, 0o644);
    }
  });

  it("refuses to write while another instance holds the workspace lock", async () => {
    const application = await createInterview("Sperre GmbH");
    await writeFile(path.join(root, ".workspace.lock"), JSON.stringify({ hostname: "anderer-rechner", pid: 1, lockId: "x" }));
    await expect(store.createInterviewNote(application.id, questions("X"))).rejects.toThrow("durch eine andere Instanz gesperrt");
    expect(await readdir(folderOf(application.id))).toEqual([]);
  });

  it("does not show or write notes of a folder two Bewerbungen share (same company, same day)", async () => {
    const first = await createInterview("Doppel GmbH", "Entwickler");
    await store.createInterviewNote(first.id, questions("Erste"));
    const second = await createInterview("Doppel GmbH", "Tester");
    expect(folderOf(first.id)).toBe(folderOf(second.id));
    for (const id of [first.id, second.id]) {
      const listing = await store.listInterviewNotes(id);
      expect(listing.files).toEqual([]);
      expect(listing.sharedWith).toHaveLength(1);
      await expect(store.createInterviewNote(id, questions("X"))).rejects.toThrow("gehört auch zu einer anderen Bewerbung");
    }
    // The first Bewerbung's notes stay where they are and are found again once the days differ.
    await store.saveApplication({ ...store.getApplication(second.id), interviewAt: new Date(2026, 9, 23, 9).toISOString() });
    expect((await store.listInterviewNotes(first.id)).files.map((file) => file.fileName)).toEqual(["Vorstellungsgespräch_Doppel.md"]);
    expect((await store.listInterviewNotes(second.id)).files).toEqual([]);
  });

  it("keeps the notes when the interview date, the company or the interview stage change", async () => {
    const application = await createInterview("Termin GmbH", undefined, null);
    expect(path.basename(folderOf(application.id))).toBe("Termin_GmbH_Termin_offen");
    await store.createInterviewNote(application.id, questions("Offen"));
    const content = (await store.listInterviewNotes(application.id)).files[0].content;

    await store.saveApplication({ ...store.getApplication(application.id), interviewAt });
    expect(path.basename(folderOf(application.id))).toBe("Termin_GmbH_2026-10-22");
    expect((await store.listInterviewNotes(application.id)).files[0].content).toBe(content);

    await store.changeStatus(application.id, "Zweites Gespräch");
    await store.saveApplication({
      ...store.getApplication(application.id),
      interviewAt: new Date(2026, 9, 29, 9).toISOString(),
      secondInterviewAt: new Date(2026, 10, 5, 9).toISOString(),
    });
    await store.saveApplication({
      ...store.getApplication(application.id),
      company: { ...store.getApplication(application.id).company, name: "Termin GmbH & Co. KG" },
    });
    const listing = await store.listInterviewNotes(application.id);
    expect(listing.folderName).toBe("Termin_GmbH_&_Co._KG_2026-10-29");
    expect(listing.files.map((file) => file.content)).toEqual([content]);
    expect(await readdir(store.files.paths.interviewsRoot)).toEqual(["Termin_GmbH_&_Co._KG_2026-10-29"]);
  });

  it("joins an already existing target folder without overwriting its files", async () => {
    const application = await createInterview("Ziel GmbH");
    await store.createInterviewNote(application.id, questions("Alt"));
    const nextDate = new Date(2026, 9, 30, 9).toISOString();
    const target = store.files.interviewPath({ company: application.company, interviewAt: nextDate });
    await mkdir(target);
    await writeFile(path.join(target, "Vorstellungsgespräch_Ziel.md"), questions("Bereits da"));
    await store.saveApplication({ ...store.getApplication(application.id), interviewAt: nextDate });
    const listing = await store.listInterviewNotes(application.id);
    expect(listing.files.map((file) => [file.fileName, file.content])).toEqual([
      ["Vorstellungsgespräch_Ziel.md", questions("Bereits da")],
      ["Vorstellungsgespräch_Ziel_1.md", (await readFile(path.join(target, "Vorstellungsgespräch_Ziel_1.md"), "utf8"))],
    ]);
    expect(parseInterviewQuestions(listing.files[1].content!).questions[0].question).toBe("Alt Frage 1?");
    expect(await readdir(store.files.paths.interviewsRoot)).toEqual([path.basename(target)]);
  });

  it("keeps the notes encrypted in an encrypted workspace and reads them after unlocking", async () => {
    const application = await createInterview("Geheim GmbH");
    await store.createInterviewNote(application.id, questions("Vor der Verschlüsselung"));
    const folder = folderOf(application.id);
    const controller = new WorkspaceSecurity(root);
    await controller.enable("Kaffee Zug Marburg Wolke 2026!");
    const existing = await readFile(path.join(folder, "Vorstellungsgespräch_Geheim.md"));
    expect(existing.includes("Vor der Verschlüsselung")).toBe(false);

    setActiveEncryption(root, controller.service!);
    const encryptedStore = new DataStore(root);
    await encryptedStore.initialize();
    const [file] = (await encryptedStore.listInterviewNotes(application.id)).files;
    expect(file.content).toContain("Vor der Verschlüsselung Antwort 1");
    const created = await encryptedStore.createInterviewNote(application.id, questions("Verschlüsselt"));
    expect(created.file.content).toContain("Verschlüsselt Antwort 2");
    const raw = await readFile(path.join(folder, created.file.fileName));
    expect(raw.includes("Verschlüsselt")).toBe(false);
    const updated = await encryptedStore.updateInterviewNote(application.id, file.fileName, questions("Geändert"), file.revision);
    expect((await readFile(path.join(folder, file.fileName))).includes("Geändert")).toBe(false);
    expect(updated.file.content).toContain("Geändert Antwort 1");
    clearActiveEncryption();
    controller.lock();
  }, 30_000);
});
