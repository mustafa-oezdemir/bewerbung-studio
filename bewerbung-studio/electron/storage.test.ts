import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  profileSchema,
  type ApplicationInput,
} from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { createDocumentDesignDraft, selectDocumentTemplate, resetDocumentDesign, updateCvDesignField } from "../src/shared/documentEditorState";
import { setResumeSectionTitle } from "../src/features/resume-sections/resume-sections";
import { DataStore } from "./storage";

const applicationInput = (company: string): ApplicationInput => ({
  company: {
    name: company,
    street: "",
    postalCode: "10115",
    city: "Berlin",
    country: "Deutschland",
    website: "",
  },
  contact: {
    salutation: "",
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: "",
  },
  job: {
    title: "Softwareentwickler",
    reference: "",
    source: "",
    url: "",
    fullText: "",
    workModel: "Hybrid",
    contractType: "Unbefristet",
    salaryExpectation: "",
  },
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
});

describe("DataStore backups", () => {
  let root: string;
  let store: DataStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbungsmanager-"));
    store = new DataStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates one automatic daily workspace backup", async () => {
    const files = await readdir(store.files.paths.backupsRoot);
    expect(
      files.some((file) => /^workspace-\d{4}-\d{2}-\d{2}\.json$/.test(file)),
    ).toBe(true);
  });

  it("restores a validated workspace and keeps a pre-import snapshot", async () => {
    await store.createApplication(applicationInput("Erste GmbH"));
    const backupPath = path.join(root, "workspace-export.json");
    await store.writeBackup(backupPath);
    await store.createApplication(applicationInput("Zweite AG"));

    const restored = await store.importBackup(backupPath);

    expect(restored.applications).toHaveLength(1);
    expect(restored.applications[0].company.name).toBe("Erste GmbH");
    const files = await readdir(store.files.paths.backupsRoot);
    expect(files.some((file) => file.startsWith("vor-import-"))).toBe(true);
  });

  it("rejects invalid settings imports without changing the workspace", async () => {
    const settingsPath = path.join(root, "invalid-settings.json");
    await writeFile(
      settingsPath,
      JSON.stringify({
        followUpDays: 14,
        notificationsEnabled: true,
        theme: "system",
        archiveAccepted: false,
        autoBackupEnabled: true,
        backupRetention: 500,
        autoSaveDelaySeconds: 2,
        language: "de",
      }),
      "utf8",
    );

    await expect(store.importSettings(settingsPath)).rejects.toThrow();
    expect(store.getWorkspace().settings.backupRetention).toBe(10);
  });

  it("exports the current editor snapshot instead of a stale persisted template", async () => {
    const workspace = await store.createApplication(
      applicationInput("Snapshot GmbH"),
    );
    const persisted = workspace.applications[0];
    const snapshot = {
      ...persisted,
      templateId: "executive-dark",
      accentColor: "#16b8b5",
      secondaryColor: "#087573",
      designSettings: {
        ...persisted.designSettings,
        columnLayout: "template" as const,
        backgroundId: "dots" as const,
      },
    };

    const persistedHtml = store.getExportHtml(
      persisted.id,
      "lebenslauf",
    );
    const snapshotHtml = store.getExportHtml(
      persisted.id,
      "lebenslauf",
      snapshot,
    );

    expect(persistedHtml).toContain("cv-centered");
    expect(snapshotHtml).toContain("cv-sidebar-left");
    expect(snapshotHtml).toContain("column-template");
    expect(snapshotHtml).toContain("--accent:#16b8b5");
    expect(snapshotHtml).toContain("--secondary:#087573");
    expect(snapshotHtml).toContain("background-dots");
  });

  it("creates one company-date folder per application", async () => {
    const first = await store.createApplication(applicationInput("Siemens"));
    const firstApplication = first.applications[0];
    expect(firstApplication.folderName).toMatch(/^Siemens_\d{4}-\d{2}-\d{2}\/Softwareentwickler$/);
    const root = firstApplication.folderName.split("/")[0];

    // Another position on the same day shares the company/date folder instead of getting a suffixed one.
    const secondInput = applicationInput("Siemens");
    secondInput.job.title = "IT Support Spezialist";
    const second = await store.createApplication(secondInput);
    const secondApplication = second.applications[0];
    expect(secondApplication.folderName).toBe(`${root}/IT_Support_Spezialist`);

    // Only the same position on the same day gets a suffix, and only on its own subfolder.
    const third = await store.createApplication(applicationInput("Siemens"));
    const thirdApplication = third.applications[0];
    expect(thirdApplication.folderName).toBe(`${root}/Softwareentwickler_2`);
    expect(store.getWorkspace().applications.map((item) => item.folderName.split("/")[0])).toEqual([root, root, root]);
    await expect(access(path.join(store.files.paths.anschreibenDocuments, firstApplication.folderName))).rejects.toThrow();
    expect(store.getApplicationAnschreibenPath(firstApplication.id)).toBe(
      path.join(store.files.applicationDataPath(firstApplication.folderName), "Anschreiben"),
    );
    await expect(
      access(
        path.join(
          store.files.paths.lebenslaufDocuments,
          firstApplication.folderName,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      access(
        path.join(
          store.files.paths.applicationsData,
          firstApplication.folderName,
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      readFile(
        path.join(
          store.files.paths.applicationsData,
          firstApplication.folderName,
          "bewerbung.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"status": "Entwurf"');

    await store.changeStatus(firstApplication.id, "Bewerbungsbereit");
    await expect(
      access(
        path.join(
          store.files.paths.lebenslaufDocuments,
          firstApplication.folderName,
        ),
      ),
    ).rejects.toThrow();
  });

  it("persists todos and reusable CV designs across restarts", async () => {
    const now = "2026-09-29T10:00:00.000Z";
    const todoId = crypto.randomUUID();
    const designId = crypto.randomUUID();
    await store.saveTodo({ id: todoId, title: "Lebenslauf prüfen", description: "", priority: "high",
      dueDate: "2026-09-30", completed: false, createdAt: now, updatedAt: now });
    await store.saveCustomCvDesign({ id: designId, name: "Mein Design", baseTemplateId: "modern",
      accentColor: "#123456", secondaryColor: "#abcdef", settings: defaultDocumentDesign,
      createdAt: now, updatedAt: now });

    const restarted = new DataStore(root);
    await restarted.initialize();
    expect(restarted.getWorkspace().todos.map((item) => item.id)).toContain(todoId);
    expect(restarted.getWorkspace().customCvDesigns.map((item) => item.id)).toContain(designId);

    await restarted.removeTodo(todoId);
    await restarted.removeCustomCvDesign(designId);
    expect(restarted.getWorkspace().todos).toEqual([]);
    expect(restarted.getWorkspace().customCvDesigns).toEqual([]);
  });

  it("retains section columns and manual technology icons after reopening", async () => {
    const workspace = await store.createApplication(applicationInput("Layout GmbH"));
    const application = workspace.applications[0];
    await store.saveApplication({ ...application, designSettings: { ...application.designSettings, strengthsColumns: 2, knowledgeColumns: 1 } });
    const reopened = new DataStore(root);
    await reopened.initialize();
    expect(reopened.getWorkspace().applications[0].designSettings).toMatchObject({ strengthsColumns: 2, knowledgeColumns: 1 });
  });

  it("persists sparse per-template CV overrides and keeps a reset after restarting", async () => {
    await store.createApplication(applicationInput("Design GmbH"));
    const application = store.getWorkspace().applications[0];
    const base = selectDocumentTemplate(createDocumentDesignDraft(application), "modern");
    const changed = updateCvDesignField(base, "colors", "paragraph", "#abcdef");
    const other = selectDocumentTemplate(changed, "kompakt");
    await store.saveApplication({ ...application, templateId: other.templateId, accentColor: other.accentColor, secondaryColor: other.secondaryColor, designSettings: other.settings, templateDesigns: other.templateDesigns });
    const reopened = new DataStore(root);
    await reopened.initialize();
    const loaded = reopened.getWorkspace().applications[0];
    expect(loaded.templateDesigns.modern).toEqual({ settings: { cvOverrides: { colors: { paragraph: "#abcdef" } } } });
    const restored = selectDocumentTemplate(createDocumentDesignDraft(loaded), "modern");
    expect(restored.settings.cvOverrides).toEqual({ colors: { paragraph: "#abcdef" } });
    const reset = resetDocumentDesign(restored);
    await reopened.saveApplication({ ...loaded, templateId: reset.templateId, accentColor: reset.accentColor, secondaryColor: reset.secondaryColor, designSettings: reset.settings, templateDesigns: reset.templateDesigns });
    const restarted = new DataStore(root);
    await restarted.initialize();
    const persisted = restarted.getWorkspace().applications[0];
    expect(persisted.designSettings).not.toHaveProperty("cvOverrides");
    expect(persisted.templateDesigns.modern).toBeUndefined();
    expect(selectDocumentTemplate(selectDocumentTemplate(createDocumentDesignDraft(persisted), "kompakt"), "modern").settings).not.toHaveProperty("cvOverrides");
  });

  it("reloads the saved resume configuration from disk without leaking between applications or profiles", async () => {
    await store.createApplication(applicationInput("Bewerbung A"));
    const a = store.getWorkspace().applications[0];
    await store.createApplication(applicationInput("Bewerbung B"));
    const b = store.getWorkspace().applications.find((item) => item.id !== a.id)!;
    const first = setResumeSectionTitle(profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(), languages: ["Englisch – B2", "Deutsch – C1"], resumeManagerLayouts: { modern: [{ id: "education", zone: "main" }, { id: "experience", zone: "main" }] }, resumePersonalFieldVisibility: { address: false, phone: true, email: true, linkedin: false, github: false, website: false, birthDate: false, birthPlace: false, nationality: false, drivingLicense: false, xing: false } }), "experience", "Meine Praxis");
    const second = profileSchema.parse({ ...first, id: crypto.randomUUID(), isDefault: false, firstName: "Ali", summary: "Profil B", languages: ["Türkisch – Muttersprache"] });
    await store.saveProfile(first);
    await store.saveProfile(second);
    const original = { ...createDocumentDesignDraft(a), templateId: "modern", accentColor: "#112233", settings: { ...a.designSettings, marginLevel: 8 as const, fontId: "arial" as const } };
    const other = selectDocumentTemplate(original, "klassisch");
    await store.saveApplication({ ...a, profileId: first.id, templateId: other.templateId, accentColor: other.accentColor, secondaryColor: other.secondaryColor, designSettings: other.settings, templateDesigns: other.templateDesigns });
    await store.saveApplication({ ...b, profileId: second.id });

    const restarted = new DataStore(root);
    await restarted.initialize();
    const workspace = restarted.getWorkspace();
    const savedA = workspace.applications.find((item) => item.id === a.id)!;
    const savedB = workspace.applications.find((item) => item.id === b.id)!;
    expect(selectDocumentTemplate(createDocumentDesignDraft(savedA), "modern").settings).toEqual(original.settings);
    expect(selectDocumentTemplate(createDocumentDesignDraft(savedA), "modern").accentColor).toBe("#112233");
    expect(savedB.templateId).toBe(b.templateId);
    expect(savedB.templateDesigns).toEqual({});
    expect(workspace.profiles.find((item) => item.id === first.id)).toEqual(first);
    expect(workspace.profiles.find((item) => item.id === second.id)).toEqual(second);
  });

  it("does not replace unreadable existing workspace data with an empty workspace", async () => {
    const workspacePath = path.join(store.files.paths.settingsRoot, "workspace.json");
    await writeFile(workspacePath, "{broken", "utf8");
    await writeFile(`${workspacePath}.bak`, "{broken", "utf8");
    await expect(new DataStore(root).initialize()).rejects.toThrow("nicht gelesen");
    expect(await readFile(workspacePath, "utf8")).toBe("{broken");
  });

  it("preserves both the damaged file and the valid fallback before recovery", async () => {
    const workspacePath = path.join(store.files.paths.settingsRoot, "workspace.json");
    await writeFile(`${workspacePath}.bak`, await readFile(workspacePath));
    await writeFile(workspacePath, "{broken", "utf8");
    await new DataStore(root).initialize();
    const backups = await readdir(store.files.paths.backupsRoot);
    const damaged = backups.find((file) => file.startsWith("unlesbar-workspace-"));
    const recovered = backups.find((file) => file.startsWith("wiederhergestellt-workspace-"));
    expect(damaged).toBeDefined();
    expect(recovered).toBeDefined();
    expect(await readFile(path.join(store.files.paths.backupsRoot, damaged!), "utf8")).toBe("{broken");
  });

  it("creates a dated application with its email area and cover-letter name", async () => {
    const created = await store.createApplication({
      ...applicationInput("Muster GmbH"),
      sentAt: "2026-09-08T09:00:00.000Z",
    });
    const application = created.applications[0];
    const dataDirectory = store.files.applicationDataPath(application.folderName);
    const emailMarkdown = await readFile(
      path.join(dataDirectory, "Email", "Email.md"),
      "utf8",
    );
    const context = store.getTemplateDocumentContext(application.id);

    expect(application.folderName).toBe("Muster_GmbH_2026-09-08/Softwareentwickler");
    expect(context.requestedBaseName).toBe(
      "Anschreiben_Muster_GmbH",
    );
    expect(context.requestedBaseNames.deckblatt).toBe("Deckblatt_Muster_GmbH");
    expect(store.getExportDefaultName(application.id, "deckblatt")).toBe(
      "Deckblatt_Muster_GmbH.pdf",
    );
    expect(store.getAutomaticExportPath(application.id, "lebenslauf")).toBe(
      path.join(context.targetDirectories.lebenslauf, store.getExportDefaultName(application.id, "lebenslauf")),
    );
    expect(context.data.BEWERBUNGSDATUM).toBe("08.09.2026");
    expect(context.data.DECKBLATT_DOKUMENTE).toBe("Anschreiben\nLebenslauf");
    expect(emailMarkdown).toContain("- Firma: Muster GmbH");
    expect(emailMarkdown).toContain("- Stellenbezeichnung: Softwareentwickler");
    expect(emailMarkdown).toContain("- Bewerbungsdatum: 08.09.2026");
  });

  it("does not rewrite user-authored application documents", async () => {
    const first = await store.createApplication(applicationInput("Erste GmbH"));
    const firstApplication = first.applications[0];
    const coverLetterPath = path.join(
      store.files.documentDirectories(firstApplication).anschreiben,
      "Erste_GmbH.md",
    );
    await writeFile(coverLetterPath, "Manuell bearbeitet", "utf8");

    const second = await store.createApplication(applicationInput("Zweite AG"));
    const secondApplication = second.applications[0];
    const secondCoverLetterPath = path.join(
      store.files.documentDirectories(secondApplication).anschreiben,
      "Zweite_AG.md",
    );
    await writeFile(secondCoverLetterPath, "Auch manuell bearbeitet", "utf8");
    secondApplication.documents.coverIntroduction =
      "Nur dieses Anschreiben wurde geändert.";
    await store.saveApplication(secondApplication);

    await expect(readFile(coverLetterPath, "utf8")).resolves.toBe(
      "Manuell bearbeitet",
    );
    await expect(readFile(secondCoverLetterPath, "utf8")).resolves.toBe(
      "Auch manuell bearbeitet",
    );
  });

  it("persists an optional second contact when creating an application", async () => {
    const created = await store.createApplication({
      ...applicationInput("Kontakt GmbH"),
      additionalContacts: [
        {
          salutation: "Frau",
          firstName: "Erika",
          lastName: "Musterfrau",
          position: "Recruiting",
          email: "erika@example.com",
          phone: "+49 30 123456",
        },
      ],
    });

    expect(created.applications[0].additionalContacts[0]).toMatchObject({
      salutation: "Frau",
      lastName: "Musterfrau",
      position: "Recruiting",
    });
    const reloadedStore = new DataStore(root);
    await reloadedStore.initialize();
    expect(
      reloadedStore.getWorkspace().applications[0].additionalContacts[0]
        .email,
    ).toBe("erika@example.com");
  });

  it("queues company-specific Git actions after successful application changes", async () => {
    const queued: Array<{ company: string; action: string }> = [];
    const gitStore = new DataStore(root, {
      queueCommit: (company, action) => queued.push({ company, action }),
    });
    await gitStore.initialize();

    const created = await gitStore.createApplication(
      applicationInput("Git Firma GmbH"),
    );
    const application = created.applications[0];
    await gitStore.changeStatus(application.id, "Vorstellungsgespräch");
    await gitStore.changeStatus(application.id, "Absage");
    await gitStore.removeApplication(application.id);

    expect(queued).toEqual([
      { company: "Git Firma GmbH", action: "create" },
      { company: "Git Firma GmbH", action: "vorstellungsgespraech" },
      { company: "Git Firma GmbH", action: "absage" },
      { company: "Git Firma GmbH", action: "delete" },
    ]);
  });

  it("renames application folders when the sent date changes", async () => {
    const created = await store.createApplication({
      ...applicationInput("Datum GmbH"),
      sentAt: "2026-08-11T09:00:00.000Z",
    });
    const application = created.applications[0];
    const oldFolderName = application.folderName;
    const oldAnschreiben = store.files.documentDirectories(application).anschreiben;
    await writeFile(path.join(oldAnschreiben, "Anschreiben.docx"), "letter");
    application.sentAt = "2026-08-22T09:00:00.000Z";

    const saved = await store.saveApplication(application);
    const updated = saved.applications.find((item) => item.id === application.id)!;
    const newAnschreiben = store.files.documentDirectories(updated).anschreiben;

    expect(updated.folderName).toBe("Datum_GmbH_2026-08-22/Softwareentwickler");
    expect(updated.folderName).not.toBe(oldFolderName);
    await expect(access(oldAnschreiben)).rejects.toThrow();
    await expect(
      readFile(
        path.join(newAnschreiben, store.getExportDefaultName(updated.id, "anschreiben").replace(/\.pdf$/, ".docx")),
        "utf8",
      ),
    ).resolves.toBe("letter");
    await expect(
      readFile(
        path.join(
          store.files.applicationDataPath(updated.folderName),
          "bewerbung.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"sentAt": "2026-08-22T09:00:00.000Z"');
  });

  it("moves legacy Anschreiben/Lebenslauf files into the application folder with applicant names on startup", async () => {
    const created = await store.createApplication({
      ...applicationInput("Temmler Pharma GmbH"),
      sentAt: "2026-09-29T09:00:00.000Z",
    });
    const application = created.applications[0];
    const base = `Temmler_Pharma_GmbH_29.09.2026_${path.basename(application.folderName)}`;
    const coverRoot = path.join(root, "Anschreiben", application.folderName);
    const resumeRoot = path.join(root, "Lebenslauf", application.folderName);
    await mkdir(coverRoot, { recursive: true });
    await mkdir(resumeRoot, { recursive: true });
    await writeFile(path.join(coverRoot, `${base}_anschreiben.pdf`), "cover");
    await writeFile(path.join(resumeRoot, `${base}_lebenslauf.pdf`), "resume");

    const restarted = new DataStore(root);
    await restarted.initialize();

    const target = restarted.files.applicationDataPath(application.folderName);
    const directories = restarted.files.documentDirectories(application);
    await expect(
      readFile(path.join(directories.anschreiben, restarted.getExportDefaultName(application.id, "anschreiben")), "utf8"),
    ).resolves.toBe("cover");
    await expect(
      readFile(path.join(directories.lebenslauf, restarted.getExportDefaultName(application.id, "lebenslauf")), "utf8"),
    ).resolves.toBe("resume");
    expect(restarted.getAutomaticExportPath(application.id, "mappe")).toBe(
      path.join(target, "Bewerbungsunterlagen", restarted.getExportDefaultName(application.id, "mappe")),
    );
    await expect(access(coverRoot)).rejects.toThrow();
    await expect(access(resumeRoot)).rejects.toThrow();
  });

  it("preserves the application-standard synchronized cover letter while saving editor changes", async () => {
    const created = await store.createApplication(applicationInput("Muster GmbH"));
    const application = created.applications[0];
    const anschreiben = store.files.documentDirectories(application).anschreiben;
    const personalFile = path.join(
      anschreiben,
      "Anschreiben_Mustafa_Özdemir_Muster_GmbH.docx",
    );
    await writeFile(personalFile, "personal letter");
    application.documents.emailMessage = "Aktualisierte E-Mail.";

    await expect(store.saveApplication(application)).resolves.toBeDefined();
    await expect(readFile(personalFile, "utf8")).resolves.toBe("personal letter");
  });

  it("consolidates legacy document folders when an existing application is saved", async () => {
    const created = await store.createApplication(applicationInput("Legacy GmbH"));
    const application = created.applications[0];
    const legacyDirectory = path.join(
      store.files.paths.anschreibenDocuments,
      application.folderName,
    );
    await mkdir(legacyDirectory, { recursive: true });
    await writeFile(path.join(legacyDirectory, "Legacy.docx"), "legacy letter");

    const saved = await store.saveApplication(application);
    const updated = saved.applications.find((item) => item.id === application.id)!;
    const consolidatedFile = path.join(
      store.files.documentDirectories(updated).anschreiben,
      "Legacy.docx",
    );

    await expect(readFile(consolidatedFile, "utf8")).resolves.toBe("legacy letter");
    await expect(access(legacyDirectory)).rejects.toThrow();
  });

  it("renames application folders immediately when company and position change", async () => {
    const input = applicationInput("YKK DEUTSCHLAND GmbH");
    input.job.title = "Bewerbung als Maschinenbediener";
    input.sentAt = "2026-08-25T09:00:00.000Z";
    const created = await store.createApplication(input);
    const application = created.applications[0];
    const oldFolderName = application.folderName;
    const oldAnschreiben = store.files.documentDirectories(application).anschreiben;
    await writeFile(path.join(oldAnschreiben, "Anschreiben.docx"), "letter");

    application.company.name = "YKK Produktion GmbH";
    application.job.title = "Maschinenbediener";
    const saved = await store.saveApplication(application);
    const updated = saved.applications.find(
      (item) => item.id === application.id,
    )!;
    const newAnschreiben = store.files.documentDirectories(updated).anschreiben;

    expect(oldFolderName).toBe("YKK_DEUTSCHLAND_GmbH_2026-08-25/Maschinenbediener");
    expect(updated.folderName).toBe(
      "YKK_Produktion_GmbH_2026-08-25/Maschinenbediener",
    );
    expect(updated.folderName).not.toBe(oldFolderName);
    await expect(access(oldAnschreiben)).rejects.toThrow();
    await expect(
      readFile(
        path.join(
          newAnschreiben,
          store.getExportDefaultName(updated.id, "anschreiben").replace(/\.pdf$/, ".docx"),
        ),
        "utf8",
      ),
    ).resolves.toBe("letter");
    await expect(
      readFile(
        path.join(
          store.files.applicationDataPath(updated.folderName),
          "bewerbung.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"title": "Maschinenbediener"');
  });

  it("maps the current cover-letter fields to Word placeholders", async () => {
    const input = applicationInput("Beispiel GmbH");
    input.job.reference = "REF-4711";
    const created = await store.createApplication({
      ...input,
      sentAt: "2024-05-17T09:00:00.000Z",
      contact: {
        salutation: "Herr",
        firstName: "Andreas",
        lastName: "Steck",
        position: "",
        email: "andreas@example.com",
        phone: "",
      },
      additionalContacts: [
        {
          salutation: "Frau",
          firstName: "Erika",
          lastName: "Musterfrau",
          position: "Recruiting",
          email: "erika@example.com",
          phone: "",
        },
      ],
    });
    const application = created.applications[0];
    application.documents = {
      ...application.documents,
      coverMotivation: "Motivation aus dem Editor.",
      coverQualification: "Fachliche Eignung aus dem Editor.",
      coverCompanyFit: "Unternehmensbezug aus dem Editor.",
    };
    await store.saveApplication(application);

    const context = store.getTemplateDocumentContext(application.id);

    expect(context.targetDirectories.anschreiben).toBe(
      path.join(store.files.applicationDataPath(application.folderName), "Anschreiben"),
    );
    expect(application.folderName).toMatch(/^Beispiel_GmbH_2024-05-17\//);
    expect(context.data).toMatchObject({
      ANSPRECHPARTNER: "Herrn Andreas Steck\nFrau Erika Musterfrau",
      ANREDE: "Sehr geehrter Herr Steck, sehr geehrte Frau Musterfrau,",
      BEWERBUNGSDATUM: "17.05.2024",
      BEWERBUNGSDATUM_LANG: "17. Mai 2024",
      MOTIVATION: "",
      FACHLICHE_EIGNUNG: "Motivation aus dem Editor.\n\nFachliche Eignung aus dem Editor.",
      UNTERNEHMENSBEZUG: "Unternehmensbezug aus dem Editor.",
      ZUSATZABSATZ: "",
      FIRMA_ABTEILUNG: "Recruiting",
      STELLENNUMMER: "REF-4711",
      BEWERBER_WEBSITE: "",
      UNTERSCHRIFT_GRAFIK: "",
      ANLAGENHINWEIS: "Anlagen:\nLebenslauf",
    });
  });

  it("maps detailed profile and special-section data to resume placeholders", async () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      nationality: "deutsch",
      strengths: [
        {
          id: crypto.randomUUID(),
          title: "Analytisches Denken",
          description: "Komplexe Probleme strukturieren",
        },
      ],
      resumeSectionTitles: {
        summary: "Über mich",
        strengths: "Kernkompetenzen",
        experience: "Praxis",
        education: "Bildungsweg",
        languages: "Sprachprofil",
        certifications: "Nachweise",
      },
      experiences: [
        {
          id: crypto.randomUUID(),
          from: "01/2024",
          to: "heute",
          role: "Entwicklerin",
          company: "Beispiel GmbH",
          city: "Berlin",
          description: "Plattformentwicklung",
          tasks: ["Architektur geplant"],
          projects: ["Migration"],
          technologies: ["TypeScript", "React"],
          achievements: ["Ladezeit reduziert"],
        },
      ],
      education: [
        {
          id: crypto.randomUUID(),
          from: "10/2018",
          to: "09/2022",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Hochschule",
          city: "Berlin",
          country: "Deutschland",
          fieldOfStudy: "Software Engineering",
          grade: "1,7",
        },
      ],
      specialSections: [
        {
          id: crypto.randomUUID(),
          kind: "projects",
          title: "Ausgewählte Projekte",
          entries: [
            {
              id: crypto.randomUUID(),
              title: "Bewerbungsplattform",
              subtitle: "Lead Developer",
              from: "03/2025",
              to: "08/2026",
              description: "Lokale Desktop-Anwendung",
              bullets: ["Automatisierte Dokumenterstellung"],
            },
          ],
        },
      ],
      applicationPlace: "Berlin",
      applicationDate: "23.08.2026",
      updatedAt: new Date().toISOString(),
    });
    await store.saveProfile(profile);
    const created = await store.createApplication({
      ...applicationInput("Profil GmbH"),
      profileId: profile.id,
    });

    const context = store.getTemplateDocumentContext(
      created.applications[0].id,
    );

    expect(context.data).toMatchObject({
      BESCHREIBUNG_1: "Plattformentwicklung",
      TECHNOLOGIEN_1: "TypeScript · React",
      ERFOLG_1_1: "Architektur geplant",
      ERFOLG_1_2: "Projekt: Migration",
      ERFOLG_1_3: "Ladezeit reduziert",
      FACHRICHTUNG_1: "Software Engineering · 1,7",
      AUSBILDUNG_ORT_1: "Berlin, Deutschland",
      PROJEKTE_TITEL: "Ausgewählte Projekte",
      STAERKEN_TITEL: "KERNKOMPETENZEN",
      STAERKE_1_TITEL: "Analytisches Denken",
      STAERKE_1_BESCHREIBUNG: "Komplexe Probleme strukturieren",
      BERUFSERFAHRUNG_TITEL: "PRAXIS",
      AUSBILDUNG_TITEL: "BILDUNGSWEG",
      LEBENSLAUF_ORT: "Berlin",
      LEBENSLAUF_DATUM: "23.08.2026",
    });
    expect(context.data.PROJEKTE).toContain("Bewerbungsplattform");
    expect(context.data.PROJEKTE).toContain(
      "Automatisierte Dokumenterstellung",
    );
  });

  it("deletes profiles and safely reassigns linked applications", async () => {
    const primary = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      updatedAt: new Date().toISOString(),
    });
    const replacement = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: false,
      firstName: "Mustafa",
      lastName: "Özdemir",
      updatedAt: new Date().toISOString(),
    });
    await store.saveProfile(primary);
    await store.saveProfile(replacement);
    const created = await store.createApplication({
      ...applicationInput("Profilwechsel GmbH"),
      profileId: primary.id,
    });

    const afterPrimaryRemoval = await store.removeProfile(primary.id);

    expect(afterPrimaryRemoval.profiles).toHaveLength(1);
    expect(afterPrimaryRemoval.profiles[0]).toMatchObject({
      id: replacement.id,
      isDefault: true,
    });
    expect(afterPrimaryRemoval.applications[0].profileId).toBe(replacement.id);
    expect(
      store.getProfileForApplication(afterPrimaryRemoval.applications[0])?.id,
    ).toBe(replacement.id);

    const afterLastRemoval = await store.removeProfile(replacement.id);

    expect(afterLastRemoval.profiles).toHaveLength(0);
    expect(afterLastRemoval.applications[0].profileId).toBeUndefined();
    expect(
      store.getProfileForApplication(afterLastRemoval.applications[0]),
    ).toBeUndefined();
    expect(created.applications[0].id).toBe(
      afterLastRemoval.applications[0].id,
    );
  });

  it("rejects deleting an unknown profile", async () => {
    await expect(store.removeProfile(crypto.randomUUID())).rejects.toThrow(
      "Profil wurde nicht gefunden.",
    );
  });

  it("links central archive documents without copying or deleting them", async () => {
    const created = await store.createApplication(
      applicationInput("Archive GmbH"),
    );
    const application = created.applications[0];
    const certificatePath = path.join(
      store.files.paths.zertifikateArchive,
      "Certificate.pdf",
    );
    await writeFile(certificatePath, "certificate");

    const linked = await store.addAttachment(
      application.id,
      "Zertifikate",
      certificatePath,
    );
    const attachment = linked.attachments[0];
    expect(attachment.archiveRelativePath).toBe("Certificate.pdf");
    expect(attachment.storedName).toBeUndefined();
    expect(store.getAttachmentPathById(attachment.id)).toBe(certificatePath);

    await store.removeAttachment(attachment.id);
    await expect(readFile(certificatePath, "utf8")).resolves.toBe(
      "certificate",
    );
  });

  it("imports a PDF selected outside the central archive", async () => {
    const created = await store.createApplication(
      applicationInput("Import GmbH"),
    );
    const sourcePath = path.join(root, "Arbeitszeugnis.pdf");
    await writeFile(sourcePath, "zeugnis");

    const linked = await store.addAttachment(
      created.applications[0].id,
      "Zeugnisse",
      sourcePath,
    );
    const attachment = linked.attachments[0];

    expect(attachment.archiveRelativePath).toBe("Arbeitszeugnis.pdf");
    await expect(
      readFile(store.getAttachmentPathById(attachment.id), "utf8"),
    ).resolves.toBe("zeugnis");
    await expect(readFile(sourcePath, "utf8")).resolves.toBe("zeugnis");
  });

  it("keeps the record and archives company documents when status becomes Absage", async () => {
    const created = await store.createApplication(
      {
        ...applicationInput("Absage GmbH"),
        sentAt: new Date().toISOString(),
      },
    );
    const application = created.applications[0];
    const active = store.files.documentDirectories(application);
    await mkdir(active.lebenslauf, { recursive: true });
    await writeFile(path.join(active.lebenslauf, "Lebenslauf.docx"), "resume");

    const rejected = await store.changeStatus(application.id, "Absage");
    const rejectedApplication = rejected.applications.find(
      (item) => item.id === application.id,
    );
    expect(rejectedApplication?.status).toBe("Absage");
    const rejectionEvent = rejected.events.find(
      (event) =>
        event.applicationId === application.id &&
        event.type === "application-rejected",
    );
    expect(rejectionEvent).toMatchObject({
      title: "Absage GmbH · Absage",
      startAt: rejectedApplication?.rejectionAt,
      allDay: true,
      cancelled: false,
    });

    await writeFile(
      path.join(store.files.paths.settingsRoot, "workspace.json"),
      JSON.stringify({
        ...rejected,
        events: rejected.events.filter(
          (event) => event.type !== "application-rejected",
        ),
      }),
      "utf8",
    );
    const reloadedStore = new DataStore(root);
    await reloadedStore.initialize();
    expect(
      reloadedStore
        .getWorkspace()
        .events.find((event) => event.type === "application-rejected"),
    ).toMatchObject({
      applicationId: application.id,
      startAt: rejectedApplication?.rejectionAt,
    });
    const rejectedDirectories = store.files.documentDirectories(
      rejectedApplication!,
    );
    expect(store.getApplicationAnschreibenPath(application.id)).toBe(
      rejectedDirectories.anschreiben,
    );
    await expect(
      readFile(
        path.join(
          rejectedDirectories.lebenslauf,
          reloadedStore
            .getExportDefaultName(application.id, "lebenslauf")
            .replace(/\.pdf$/, ".docx"),
        ),
        "utf8",
      ),
    ).resolves.toBe("resume");
  });

  it("creates the interview notes folder and renames it when the appointment is saved", async () => {
    const created = await store.createApplication(
      applicationInput("Gespräch GmbH"),
    );
    const application = created.applications[0];

    const withInterviewStatus = await store.changeStatus(
      application.id,
      "Vorstellungsgespräch",
    );
    const openFolder = path.join(
      store.files.paths.interviewsRoot,
      "Gesprach_GmbH_Termin_offen",
    );
    await expect(access(openFolder)).resolves.toBeUndefined();
    await writeFile(path.join(openFolder, "Meine Notizen.txt"), "Vorbereitung");

    const interviewAt = new Date(2026, 8, 8, 10, 30, 0).toISOString();
    await store.saveApplication({
      ...withInterviewStatus.applications[0],
      interviewAt,
    });

    const datedFolder = path.join(
      store.files.paths.interviewsRoot,
      "Gesprach_GmbH_2026-09-08",
    );
    await expect(access(openFolder)).rejects.toThrow();
    await expect(
      readFile(path.join(datedFolder, "Meine Notizen.txt"), "utf8"),
    ).resolves.toBe("Vorbereitung");
  });

  it("deletes the application record and its generated folders", async () => {
    const created = await store.createApplication(
      {
        ...applicationInput("Löschen GmbH"),
        sentAt: new Date().toISOString(),
      },
    );
    const application = created.applications[0];
    const activeDirectories = store.files.documentDirectories(application);
    const dataDirectory = store.files.applicationDataPath(application.folderName);
    const rejectionDirectory = store.files.rejectionPath(application.folderName);
    await Promise.all([
      mkdir(activeDirectories.lebenslauf, { recursive: true }),
      mkdir(path.join(dataDirectory, "Deckblatt"), { recursive: true }),
      mkdir(rejectionDirectory, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(activeDirectories.anschreiben, "Anschreiben.docx"), "letter"),
      writeFile(path.join(activeDirectories.lebenslauf, "Lebenslauf.docx"), "resume"),
      writeFile(path.join(rejectionDirectory, "Absage.pdf"), "rejection"),
    ]);
    const certificatePath = path.join(
      store.files.paths.zertifikateArchive,
      "Loeschen-Zertifikat.pdf",
    );
    await writeFile(certificatePath, "certificate");
    const withAttachment = await store.addAttachment(
      application.id,
      "Zertifikate",
      certificatePath,
    );
    const attachment = withAttachment.attachments.find(
      (item) => item.applicationId === application.id,
    );

    const workspace = await store.removeApplication(application.id);

    expect(workspace.applications).toHaveLength(0);
    const deletedArchive = JSON.parse(
      await readFile(
        path.join(store.dataPath, "Silinenler", "silinenler.json"),
        "utf8",
      ),
    );
    expect(deletedArchive.deletedApplications).toHaveLength(1);
    expect(deletedArchive.deletedApplications[0]).toMatchObject({
      application: {
        id: application.id,
        company: { name: "Löschen GmbH" },
      },
      events: expect.arrayContaining([
        expect.objectContaining({ applicationId: application.id }),
      ]),
      attachments: [
        expect.objectContaining({ id: attachment?.id }),
      ],
    });
    expect(deletedArchive.deletedApplications[0].deletedAt).toBeTruthy();
    await expect(readFile(certificatePath, "utf8")).resolves.toBe("certificate");
    await Promise.all(
      [
        activeDirectories.anschreiben,
        activeDirectories.lebenslauf,
        dataDirectory,
        rejectionDirectory,
      ].map((target) => expect(access(target)).rejects.toThrow()),
    );
  });

  it("persists and clears the new-application draft below data/Setting/Settings", async () => {
    const draft = applicationInput("Draft GmbH");
    await store.saveApplicationDraft(draft);
    await expect(store.getApplicationDraft()).resolves.toMatchObject({
      company: { name: "Draft GmbH" },
    });
    await store.clearApplicationDraft();
    await expect(store.getApplicationDraft()).resolves.toBeNull();
  });
});
