import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveApplicationPaths } from "../src/config/application-paths";
import type { Application } from "../src/shared/schema";
import {
  ApplicationFolderLockedError,
  FileManagementService,
  applicationPositionFolder,
  formatLocalDate,
  isApplicationFolderLockError,
  isNestedFolderName,
  normalizeFolderName,
  sanitizeFileName,
} from "./file-management";

describe("FileManagementService", () => {
  let root: string;
  let service: FileManagementService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbung-files-"));
    service = new FileManagementService(resolveApplicationPaths(root));
    await service.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates the central folder structure", async () => {
    const paths = service.paths;
    await Promise.all(
      [
        paths.dataRoot,
        paths.applicationsData,
        paths.zeugnisseArchive,
        paths.zertifikateArchive,
        paths.absagenRoot,
        paths.interviewsRoot,
        paths.settingRoot,
        paths.settingsRoot,
        paths.profileRoot,
        paths.backupsRoot,
        paths.logsRoot,
        paths.crashDumpsRoot,
        paths.electronSessionRoot,
        paths.deletedRoot,
      ].map((candidate) => expect(access(candidate)).resolves.toBeUndefined()),
    );
  });

  it("migrates legacy system and archive folders safely and idempotently", async () => {
    const legacySettings = path.join(service.paths.dataRoot, "Settings");
    const legacyProfiles = path.join(service.paths.dataRoot, "Profile");
    const legacyCertificateArchive = path.join(root, "Zeugnisse");
    await Promise.all([
      mkdir(legacySettings, { recursive: true }),
      mkdir(legacyProfiles, { recursive: true }),
      mkdir(legacyCertificateArchive, { recursive: true }),
    ]);
    await writeFile(path.join(legacySettings, "legacy.json"), "settings");
    await writeFile(path.join(legacyProfiles, "photo.jpg"), "photo");
    await writeFile(path.join(legacyCertificateArchive, "zeugnis.pdf"), "certificate");

    await service.initialize();
    await service.initialize();

    await expect(
      readFile(path.join(service.paths.settingsRoot, "legacy.json"), "utf8"),
    ).resolves.toBe("settings");
    await expect(
      readFile(path.join(service.paths.profileRoot, "photo.jpg"), "utf8"),
    ).resolves.toBe("photo");
    await expect(
      readFile(path.join(service.paths.zeugnisseArchive, "zeugnis.pdf"), "utf8"),
    ).resolves.toBe("certificate");
    await expect(access(legacySettings)).rejects.toThrow();
    await expect(access(legacyProfiles)).rejects.toThrow();
    await expect(access(legacyCertificateArchive)).rejects.toThrow();
  });

  it("sanitizes invalid and reserved Windows names", () => {
    expect(sanitizeFileName('Muster/Firma: "Berlin" | GmbH')).toBe(
      "Muster_Firma_Berlin_GmbH",
    );
    expect(sanitizeFileName("CON")).toBe("_CON");
    expect(sanitizeFileName('  <>:"/\\|?*  ')).toBe("Bewerbung");
  });

  it("shares one company/date folder and gives every position its own subfolder", async () => {
    const date = new Date(2026, 6, 30, 12, 0, 0);
    expect(formatLocalDate(date)).toBe("2026-07-30");
    await expect(
      service.allocateApplicationFolderName("Siemens", "Softwareentwickler", date),
    ).resolves.toBe("Siemens_2026-07-30/Softwareentwickler");
    await expect(
      service.allocateApplicationFolderName("Siemens", "IT Support", date),
    ).resolves.toBe("Siemens_2026-07-30/IT_Support");
    await expect(
      service.allocateApplicationFolderName("Siemens", "Bewerbung als Lagerist", date),
    ).resolves.toBe("Siemens_2026-07-30/Lagerist");
    // Another company, or another day, is another shared folder.
    await expect(
      service.allocateApplicationFolderName("Bosch", "Softwareentwickler", date),
    ).resolves.toBe("Bosch_2026-07-30/Softwareentwickler");
    await expect(
      service.allocateApplicationFolderName("Siemens", "Softwareentwickler", new Date(2026, 6, 31)),
    ).resolves.toBe("Siemens_2026-07-31/Softwareentwickler");
  });

  it("suffixes only the position subfolder when the same position is created again", async () => {
    const date = new Date(2026, 8, 30, 12, 0, 0);
    const names = [];
    for (let index = 0; index < 3; index += 1) {
      names.push(await service.allocateApplicationFolderName("Temmler Pharma GmbH", "Mitarbeiter Produktion", date));
    }
    expect(names).toEqual([
      "Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion",
      "Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion_2",
      "Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion_3",
    ]);
    await expect(
      service.allocateApplicationFolderName("Temmler Pharma GmbH", "Maschinen-Einrichter für die Produktion", date),
    ).resolves.toBe("Temmler_Pharma_GmbH_2026-09-30/Maschinen-Einrichter_fur_die_Produktion");
  });

  it("makes a position name safe with the one file-name sanitizer", () => {
    expect(applicationPositionFolder("Bewerbung als Maschinen-Einrichter für die Produktion")).toBe("Maschinen-Einrichter_fur_die_Produktion");
    expect(applicationPositionFolder('Softwareentwickler/in – *Workflow-Modellierung*: "UX" | <Team>?')).toBe("Softwareentwickler_in_–_Workflow-Modellierung_UX_Team");
    expect(applicationPositionFolder("  ..Mitarbeiter Produktion..  ")).toBe("Mitarbeiter_Produktion");
    expect(applicationPositionFolder(" / \\ ")).toBe("Bewerbung");
    expect(applicationPositionFolder("CON")).toBe("_CON");
    // A position name can never add a level to the path.
    expect(isNestedFolderName(applicationPositionFolder("A/B\\C"))).toBe(false);
  });

  it("recognizes the one-level older layout and the native separator of the nested one", () => {
    expect(isNestedFolderName("Siemens_2026-07-30")).toBe(false);
    expect(isNestedFolderName("Siemens_2026-07-30/Softwareentwickler")).toBe(true);
    expect(isNestedFolderName(path.join("Siemens_2026-07-30", "Softwareentwickler"))).toBe(true);
    expect(normalizeFolderName(path.join("Siemens_2026-07-30", "Softwareentwickler"))).toBe("Siemens_2026-07-30/Softwareentwickler");
  });

  it("consolidates legacy cover-letter and resume folders without overwriting existing files", async () => {
    const folderName = path.join("Muster_GmbH_29.09.2026", "Entwicklung");
    const application = { folderName, status: "Entwurf" } as Application;
    const directories = service.documentDirectories(application);
    const coverRoot = path.join(service.paths.anschreibenDocuments, folderName);
    const resumeRoot = path.join(service.paths.lebenslaufDocuments, folderName);
    await Promise.all([
      mkdir(directories.anschreiben, { recursive: true }),
      mkdir(coverRoot, { recursive: true }),
      mkdir(resumeRoot, { recursive: true }),
    ]);
    await writeFile(path.join(directories.anschreiben, "Anschreiben.docx"), "current");
    await writeFile(path.join(coverRoot, "Anschreiben.docx"), "legacy cover");
    await writeFile(path.join(resumeRoot, "Lebenslauf.pdf"), "legacy resume");

    await service.consolidateLegacyDocumentDirectories(application);

    await expect(readFile(path.join(directories.anschreiben, "Anschreiben.docx"), "utf8")).resolves.toBe("current");
    await expect(readFile(path.join(directories.anschreiben, "Altbestand", "Anschreiben.docx"), "utf8")).resolves.toBe("legacy cover");
    await expect(readFile(path.join(directories.lebenslauf, "Lebenslauf.pdf"), "utf8")).resolves.toBe("legacy resume");
    await expect(access(coverRoot)).rejects.toThrow();
    await expect(access(resumeRoot)).rejects.toThrow();
  });

  it("renames legacy document names to <Dokument>_<Name>_<Firma>", async () => {
    const folderName = path.join("Temmler_Pharma_GmbH_29.09.2026", "Maschinen-Einrichter_fur_die_Produktion");
    const application = {
      folderName,
      status: "Entwurf",
      company: { name: "Temmler Pharma GmbH" },
      createdAt: "2026-09-29T08:00:00.000Z",
      sentAt: "2026-09-29T08:00:00.000Z",
    } as Application;
    const directories = service.documentDirectories(application);
    const packageDirectory = path.join(
      service.applicationDataPath(folderName),
      "Bewerbungsunterlagen",
    );
    const coverRoot = path.join(service.paths.anschreibenDocuments, folderName);
    const resumeRoot = path.join(service.paths.lebenslaufDocuments, folderName);
    await Promise.all([mkdir(coverRoot, { recursive: true }), mkdir(resumeRoot, { recursive: true })]);
    await writeFile(path.join(coverRoot, "Anschreiben_Mustafa_Özdemir_Temmler_Pharma_GmbH.docx"), "docx");
    await writeFile(
      path.join(coverRoot, "Temmler_Pharma_GmbH_29.09.2026_Maschinen-Einrichter_fur_die_Produktion_anschreiben.pdf"),
      "cover pdf",
    );
    await writeFile(
      path.join(resumeRoot, "Temmler_Pharma_GmbH_29.09.2026_Maschinen-Einrichter_fur_die_Produktion_lebenslauf.pdf"),
      "resume pdf",
    );
    await writeFile(path.join(resumeRoot, "Temmler_Pharma_GmbH_29.09.2026_mappe.pdf"), "mappe pdf");
    const names = {
      anschreiben: "Anschreiben_Mustafa_Özdemir_Temmler_Pharma_GmbH",
      deckblatt: "Deckblatt_Mustafa_Özdemir_Temmler_Pharma_GmbH",
      lebenslauf: "Lebenslauf_Mustafa_Özdemir_Temmler_Pharma_GmbH",
      mappe: "Mappe_Mustafa_Özdemir_Temmler_Pharma_GmbH",
    };

    await service.consolidateLegacyDocumentDirectories(application);
    await service.normalizeLegacyDocumentNames(application, names);

    await expect(readFile(path.join(directories.anschreiben, `${names.anschreiben}.docx`), "utf8")).resolves.toBe("docx");
    await expect(readFile(path.join(directories.anschreiben, `${names.anschreiben}.pdf`), "utf8")).resolves.toBe("cover pdf");
    await expect(readFile(path.join(directories.lebenslauf, `${names.lebenslauf}.pdf`), "utf8")).resolves.toBe("resume pdf");
    await expect(readFile(path.join(packageDirectory, `${names.mappe}.pdf`), "utf8")).resolves.toBe("mappe pdf");
    await expect(access(coverRoot)).rejects.toThrow();
    await expect(access(resumeRoot)).rejects.toThrow();
  });

  it("never overwrites an existing document while renaming legacy names", async () => {
    const folderName = path.join("Muster_GmbH_29.09.2026", "Entwicklung");
    const application = {
      folderName,
      status: "Entwurf",
      company: { name: "Muster GmbH" },
      createdAt: "2026-09-29T08:00:00.000Z",
      sentAt: "2026-09-29T08:00:00.000Z",
    } as Application;
    const directories = service.documentDirectories(application);
    await Promise.all([
      mkdir(directories.anschreiben, { recursive: true }),
      mkdir(directories.lebenslauf, { recursive: true }),
    ]);
    await writeFile(path.join(directories.lebenslauf, "Lebenslauf_Max_Muster_GmbH.pdf"), "current");
    await writeFile(path.join(directories.lebenslauf, "Muster_GmbH_29.09.2026_Entwicklung_lebenslauf.pdf"), "legacy");
    await writeFile(path.join(directories.anschreiben, "Anschreiben.docx"), "letter");

    await service.normalizeLegacyDocumentNames(application, {
      anschreiben: "Anschreiben_Max_Muster_GmbH",
      deckblatt: "Deckblatt_Max_Muster_GmbH",
      lebenslauf: "Lebenslauf_Max_Muster_GmbH",
      mappe: "Mappe_Max_Muster_GmbH",
    });

    await expect(readFile(path.join(directories.lebenslauf, "Lebenslauf_Max_Muster_GmbH.pdf"), "utf8")).resolves.toBe("current");
    await expect(
      readFile(path.join(directories.lebenslauf, "Muster_GmbH_29.09.2026_Entwicklung_lebenslauf.pdf"), "utf8"),
    ).resolves.toBe("legacy");
    await expect(readFile(path.join(directories.anschreiben, "Anschreiben_Max_Muster_GmbH.docx"), "utf8")).resolves.toBe("letter");
  });

  it("moves every application artifact when the application date changes", async () => {
    const folderName = path.join("Siemens_30.07.2026", "Softwareentwickler");
    const application = {
      folderName,
      status: "Beworben",
      company: { name: "Siemens" },
      job: { title: "Softwareentwickler" },
    } as Application;
    const sourcePaths = [
      service.applicationDataPath(folderName),
      path.join(service.paths.anschreibenDocuments, folderName),
      path.join(service.paths.lebenslaufDocuments, folderName),
    ];
    await Promise.all(
      sourcePaths.map(async (source, index) => {
        await mkdir(source, { recursive: true });
        await writeFile(path.join(source, `Dokument-${index}.txt`), "content");
      }),
    );

    const relocated = await service.relocateApplicationFolders(
      application,
      new Date(2026, 7, 22, 9, 0, 0),
    );

    expect(relocated).toBe(
      "Siemens_2026-08-22/Softwareentwickler",
    );
    for (const [index, source] of sourcePaths.entries()) {
      await expect(access(source)).rejects.toThrow();
      await expect(
        readFile(
          path.join(
            source.replace(folderName, relocated),
            `Dokument-${index}.txt`,
          ),
          "utf8",
        ),
      ).resolves.toBe("content");
    }
  });

  it("moves a legacy company/date folder into the canonical application folder", async () => {
    const legacyFolderName = "Universitatsklinikum_Frankfurt_2026-08-09";
    const application = {
      folderName: legacyFolderName,
      status: "Beworben",
      company: { name: "Universitätsklinikum Frankfurt" },
      job: {
        title:
          "Softwareentwickler/in – *Workflow-Modellierung*& User Experience",
      },
    } as Application;
    const legacyPaths = [
      service.applicationDataPath(legacyFolderName),
      path.join(service.paths.anschreibenDocuments, legacyFolderName),
      path.join(service.paths.lebenslaufDocuments, legacyFolderName),
    ];
    await Promise.all(
      legacyPaths.map(async (legacyPath, index) => {
        await mkdir(legacyPath, { recursive: true });
        await writeFile(path.join(legacyPath, `Dokument-${index}.txt`), "content");
      }),
    );

    const relocated = await service.relocateApplicationFolders(
      application,
      new Date(2026, 7, 9, 12, 0, 0),
    );

    expect(relocated).toBe(
      "Universitatsklinikum_Frankfurt_2026-08-09",
    );
    for (const [index, legacyPath] of legacyPaths.entries()) {
      await expect(
        readFile(
          path.join(
            legacyPath.replace(legacyFolderName, relocated),
            `Dokument-${index}.txt`,
          ),
          "utf8",
        ),
      ).resolves.toBe("content");
    }
  });

  it("keeps an older one-level folder where it is, and nests it with every artifact only when asked", async () => {
    const legacyFolderName = "Temmler_Pharma_GmbH_2026-09-30";
    const application = {
      folderName: legacyFolderName,
      status: "Beworben",
      company: { name: "Temmler Pharma GmbH" },
      job: { title: "Mitarbeiter Produktion" },
    } as Application;
    const legacyPaths = [
      service.applicationDataPath(legacyFolderName),
      path.join(service.paths.anschreibenDocuments, legacyFolderName),
      path.join(service.paths.lebenslaufDocuments, legacyFolderName),
    ];
    await Promise.all(
      legacyPaths.map(async (legacyPath, index) => {
        await mkdir(legacyPath, { recursive: true });
        await writeFile(path.join(legacyPath, `Dokument-${index}.txt`), "content");
      }),
    );
    const date = new Date(2026, 8, 30, 12, 0, 0);

    await expect(service.relocateApplicationFolders(application, date)).resolves.toBe(legacyFolderName);
    await expect(readFile(path.join(legacyPaths[0], "Dokument-0.txt"), "utf8")).resolves.toBe("content");

    const nested = await service.relocateApplicationFolders(application, date, { nest: true });
    expect(nested).toBe("Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion");
    for (const [index, legacyPath] of legacyPaths.entries()) {
      await expect(access(path.join(legacyPath, `Dokument-${index}.txt`))).rejects.toThrow();
      await expect(
        readFile(path.join(legacyPath, "Mitarbeiter_Produktion", `Dokument-${index}.txt`), "utf8"),
      ).resolves.toBe("content");
    }
  });

  it("recognizes Windows file-lock errors", () => {
    for (const code of ["EACCES", "EBUSY", "EPERM"]) {
      expect(isApplicationFolderLockError({ code })).toBe(true);
    }
    expect(isApplicationFolderLockError({ code: "ENOENT" })).toBe(false);
    expect(new ApplicationFolderLockedError().message).toMatch(
      /geöffneten Word-, PDF-/,
    );
  });

  it("creates and dates the personal interview notes folder without losing notes", async () => {
    const application = {
      company: { name: "Muster/Firma GmbH" },
      status: "Vorstellungsgespräch",
    } as Application;

    await service.syncInterviewFolder(undefined, application);
    const openInterviewFolder = path.join(
      service.paths.interviewsRoot,
      "Muster_Firma_GmbH_Termin_offen",
    );
    await writeFile(path.join(openInterviewFolder, "Notizen.txt"), "Fragen");

    const scheduledApplication = {
      ...application,
      interviewAt: new Date(2026, 7, 30, 14, 0, 0).toISOString(),
    };
    await service.syncInterviewFolder(application, scheduledApplication);

    const scheduledInterviewFolder = path.join(
      service.paths.interviewsRoot,
      "Muster_Firma_GmbH_2026-08-30",
    );
    await expect(access(openInterviewFolder)).rejects.toThrow();
    await expect(
      readFile(path.join(scheduledInterviewFolder, "Notizen.txt"), "utf8"),
    ).resolves.toBe("Fragen");
  });

  it("only accepts archive files from the configured category root", async () => {
    const certificate = path.join(
      service.paths.zertifikateArchive,
      "AWS.pdf",
    );
    await writeFile(certificate, "certificate");
    expect(
      service.archiveRelativePath("Zertifikate", certificate),
    ).toBe("AWS.pdf");
    expect(() =>
      service.archiveRelativePath(
        "Zertifikate",
        path.join(root, "outside.pdf"),
      ),
    ).toThrow(/zentralen Ordner/);
  });

  it("keeps company documents in their application subfolders after a rejection", async () => {
    const folderName = await service.allocateApplicationFolderName(
      "Siemens",
      "Softwareentwickler",
      new Date(2026, 6, 30),
    );
    const application = {
      folderName,
      status: "Beworben",
    } as Application;
    const active = service.documentDirectories(application);
    await Promise.all([
      mkdir(active.anschreiben, { recursive: true }),
      mkdir(active.lebenslauf, { recursive: true }),
    ]);
    await writeFile(path.join(active.anschreiben, "Anschreiben.docx"), "cover");
    await writeFile(path.join(active.lebenslauf, "Lebenslauf.docx"), "resume");

    await service.transitionApplicationDocuments(application, "Absage");

    const rejected = service.documentDirectories({
      ...application,
      status: "Absage",
    });
    expect(rejected.anschreiben).toBe(path.join(service.applicationDataPath(folderName), "Anschreiben"));
    await expect(
      readFile(path.join(rejected.anschreiben, "Anschreiben.docx"), "utf8"),
    ).resolves.toBe("cover");
    await expect(
      readFile(path.join(rejected.lebenslauf, "Lebenslauf.docx"), "utf8"),
    ).resolves.toBe("resume");
    expect(active.anschreiben).toBe(rejected.anschreiben);
    expect(active.lebenslauf).toBe(rejected.lebenslauf);
  });

  it("keeps the same document subfolders when an application becomes active again", async () => {
    const folderName = path.join("Siemens_2026-07-30", "Softwareentwickler");
    const application = {
      folderName,
      status: "Absage",
    } as Application;
    const rejected = service.documentDirectories(application);
    await Promise.all([
      mkdir(rejected.anschreiben, { recursive: true }),
      mkdir(rejected.lebenslauf, { recursive: true }),
    ]);
    await writeFile(path.join(rejected.anschreiben, "Anschreiben.docx"), "cover");
    await writeFile(path.join(rejected.lebenslauf, "Lebenslauf.docx"), "resume");

    await service.transitionApplicationDocuments(application, "Beworben");

    const active = service.documentDirectories({
      ...application,
      status: "Beworben",
    });
    await expect(
      readFile(path.join(active.anschreiben, "Anschreiben.docx"), "utf8"),
    ).resolves.toBe("cover");
    await expect(
      readFile(path.join(active.lebenslauf, "Lebenslauf.docx"), "utf8"),
    ).resolves.toBe("resume");
    expect(active.anschreiben).toBe(rejected.anschreiben);
  });

  it("deletes all application folders from active and rejection locations", async () => {
    const folderName = path.join(
      "Siemens_2026-07-30",
      "Softwareentwickler",
    );
    const targets = [
      service.applicationDataPath(folderName),
      path.join(service.paths.anschreibenDocuments, folderName),
      path.join(service.paths.lebenslaufDocuments, folderName),
      service.rejectionPath(folderName),
    ];
    await Promise.all(
      targets.map(async (target) => {
        await mkdir(target, { recursive: true });
        await writeFile(path.join(target, "Dokument.docx"), "content");
      }),
    );

    await service.removeApplicationArtifacts({ folderName });

    await Promise.all(
      targets.map((target) => expect(access(target)).rejects.toThrow()),
    );
    await Promise.all(
      [
        service.paths.applicationsData,
        service.paths.anschreibenDocuments,
        service.paths.lebenslaufDocuments,
        service.paths.absagenRoot,
      ].map((rootPath) =>
        expect(
          access(path.join(rootPath, "Siemens_2026-07-30")),
        ).rejects.toThrow(),
      ),
    );
  });

  it("refuses to delete an application root", async () => {
    await expect(
      service.removeApplicationArtifacts({ folderName: "." }),
    ).rejects.toThrow(/Ungültiger Bewerbungsordner/);
    await expect(access(service.paths.applicationsData)).resolves.toBeUndefined();
  });

  it("protects nested position applications inside an older flat folder", async () => {
    const legacyFolder = "Siemens_2026-07-30";
    const nestedData = path.join(
      service.applicationDataPath(legacyFolder),
      "Softwareentwickler",
    );
    await mkdir(nestedData, { recursive: true });
    await writeFile(path.join(nestedData, "bewerbung.json"), "{}");

    await expect(
      service.removeApplicationArtifacts({ folderName: legacyFolder }),
    ).rejects.toThrow(/positionsbezogene Bewerbungen/);
    await expect(access(nestedData)).resolves.toBeUndefined();
  });
});
