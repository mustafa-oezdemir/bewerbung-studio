import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Application, ApplicationInput } from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { DataStore } from "./storage";

const applicationInput = (company: string, position: string, sentAt: string): ApplicationInput => ({
  company: { name: company, street: "", postalCode: "10115", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: position, reference: "", source: "", url: "", fullText: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
  templateId: "classic-professional",
  accentColor: "#155e58",
  secondaryColor: "#244766",
  designSettings: defaultDocumentDesign,
  notes: "",
  sentAt,
});

const temmler = "Temmler Pharma GmbH";
const machine = "Maschinen-Einrichter für die Produktion";
const production = "Mitarbeiter Produktion";
const day = "2026-09-30T09:00:00.000Z";

const exists = (target: string) => access(target).then(() => true, () => false);
const names = (directory: string) => readdir(directory).then((entries) => entries.sort());

describe("one folder per company and day, one subfolder per position", () => {
  let root: string;
  let store: DataStore;

  const create = async (company: string, position: string, sentAt = day) => {
    const workspace = await store.createApplication(applicationInput(company, position, sentAt));
    return workspace.applications[0];
  };
  const reload = (id: string) => store.getWorkspace().applications.find((item) => item.id === id)!;
  const dataPath = (application: Application) => store.files.applicationDataPath(application.folderName);
  const write = async (application: Application, file: string, content: string) => {
    const target = path.join(dataPath(application), file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    return target;
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbungsmanager-folders-"));
    store = new DataStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("A. another company gets its own shared folder", async () => {
    const siemens = await create("Siemens", "Softwareentwickler");
    expect(siemens.folderName).toBe("Siemens_2026-09-30/Softwareentwickler");
  });

  it("B. two positions at one company on one day share the folder and never get a suffixed root", async () => {
    const first = await create(temmler, machine);
    await write(first, "Anschreiben/Notiz.txt", "first letter");
    const second = await create(temmler, production);

    expect(first.folderName).toBe("Temmler_Pharma_GmbH_2026-09-30/Maschinen-Einrichter_fur_die_Produktion");
    expect(second.folderName).toBe("Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion");
    const applications = path.join(store.files.paths.applicationsData);
    expect(await names(applications)).toEqual(["Temmler_Pharma_GmbH_2026-09-30"]);
    expect(await names(path.join(applications, "Temmler_Pharma_GmbH_2026-09-30"))).toEqual(["Maschinen-Einrichter_fur_die_Produktion", "Mitarbeiter_Produktion"]);
    // The first application is untouched by the second.
    await expect(readFile(path.join(dataPath(first), "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("first letter");
    for (const folder of ["Anschreiben", "Lebenslauf", "Deckblatt", "Email", "Stellenanzeige", "Bewerbungsunterlagen"]) {
      expect(await exists(path.join(dataPath(second), folder)), folder).toBe(true);
    }
  });

  it("C. the same position on the same day gets a suffix on its own subfolder only", async () => {
    const first = await create(temmler, production);
    const again = await create(temmler, production);
    expect(first.folderName).toBe("Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion");
    expect(again.folderName).toBe("Temmler_Pharma_GmbH_2026-09-30/Mitarbeiter_Produktion_2");
    expect(await names(path.join(store.files.paths.applicationsData))).toEqual(["Temmler_Pharma_GmbH_2026-09-30"]);
  });

  it("D. a new date moves only that application to the shared folder of the new day", async () => {
    const other = await create(temmler, machine);
    const moving = await create(temmler, production);
    await write(other, "Email/Email.md", "other");
    await write(moving, "Anschreiben/Notiz.txt", "letter");
    await write(moving, "Bewerbungsunterlagen/Zeugnis.pdf", "certificate");

    await store.saveApplication({ ...moving, sentAt: "2026-10-01T09:00:00.000Z" });
    const moved = reload(moving.id);

    expect(moved.folderName).toBe("Temmler_Pharma_GmbH_2026-10-01/Mitarbeiter_Produktion");
    await expect(readFile(path.join(dataPath(moved), "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("letter");
    await expect(readFile(path.join(dataPath(moved), "Bewerbungsunterlagen", "Zeugnis.pdf"), "utf8")).resolves.toBe("certificate");
    // The other position stays where it was, with its files; the old shared folder holds only it.
    expect(reload(other.id).folderName).toBe(other.folderName);
    await expect(readFile(path.join(dataPath(other), "Email", "Email.md"), "utf8")).resolves.toBe("other");
    expect(await names(path.join(store.files.paths.applicationsData, "Temmler_Pharma_GmbH_2026-09-30"))).toEqual(["Maschinen-Einrichter_fur_die_Produktion"]);
  });

  it("the old shared folder disappears with its last application", async () => {
    const only = await create(temmler, production);
    await write(only, "Anschreiben/Notiz.txt", "letter");
    await store.saveApplication({ ...only, sentAt: "2026-10-01T09:00:00.000Z" });
    expect(await names(path.join(store.files.paths.applicationsData))).toEqual(["Temmler_Pharma_GmbH_2026-10-01"]);
  });

  it("a changed position renames the subfolder, keeps every file and never overwrites a sibling", async () => {
    const first = await create(temmler, production);
    const sibling = await create(temmler, "Produktionsmitarbeiter");
    await write(first, "Anschreiben/Notiz.txt", "letter");
    await write(sibling, "Anschreiben/Notiz.txt", "sibling letter");

    // The new name is taken by the sibling: the moved application gets the suffix, the sibling keeps its files.
    await store.saveApplication({ ...first, job: { ...first.job, title: "Produktionsmitarbeiter" } });
    const renamed = reload(first.id);
    expect(renamed.folderName).toBe("Temmler_Pharma_GmbH_2026-09-30/Produktionsmitarbeiter_2");
    await expect(readFile(path.join(dataPath(renamed), "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("letter");
    await expect(readFile(path.join(dataPath(reload(sibling.id)), "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("sibling letter");

    await store.saveApplication({ ...renamed, job: { ...renamed.job, title: "Fachkraft Produktion" } });
    expect(reload(first.id).folderName).toBe("Temmler_Pharma_GmbH_2026-09-30/Fachkraft_Produktion");
    await expect(readFile(path.join(dataPath(reload(first.id)), "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("letter");
  });

  it("E. keeps the folder of every application across a restart and still reaches its documents", async () => {
    const first = await create(temmler, machine);
    const second = await create(temmler, production);
    await write(first, "Anschreiben/Notiz.txt", "first");
    await write(second, "Anschreiben/Notiz.txt", "second");

    const restarted = new DataStore(root);
    await restarted.initialize();
    const applications = restarted.getWorkspace().applications;
    expect(applications.find((item) => item.id === first.id)?.folderName).toBe(first.folderName);
    expect(applications.find((item) => item.id === second.id)?.folderName).toBe(second.folderName);
    for (const [application, content] of [[first, "first"], [second, "second"]] as const) {
      await expect(readFile(path.join(restarted.getApplicationAnschreibenPath(application.id), "Notiz.txt"), "utf8")).resolves.toBe(content);
    }
    expect(await names(path.join(store.files.paths.applicationsData))).toEqual(["Temmler_Pharma_GmbH_2026-09-30"]);
  });

  describe("an application of an older version directly in the company/date folder", () => {
    /** Turns a fresh application into the older layout: its data directly in `<Firma>_<Datum>`. */
    const makeLegacy = async (application: Application) => {
      const flat = application.folderName.split("/")[0];
      const workspace = store.files.paths.applicationsData;
      await rename(path.join(workspace, application.folderName), path.join(workspace, `${flat}.moving`));
      await rm(path.join(workspace, flat), { recursive: true, force: true });
      await rename(path.join(workspace, `${flat}.moving`), path.join(workspace, flat));
      const stored = (store as unknown as { workspace: { applications: Application[] } }).workspace.applications.find((item) => item.id === application.id)!;
      stored.folderName = flat;
      await (store as unknown as { persist: (applications?: Application[]) => Promise<void> }).persist([stored]);
      return flat;
    };

    it("keeps its folder on a restart and on a save: nothing is migrated on its own", async () => {
      const legacy = await create(temmler, production);
      const flat = await makeLegacy(legacy);
      await write(reload(legacy.id), "Anschreiben/Notiz.txt", "legacy letter");

      await store.saveApplication(reload(legacy.id));
      const restarted = new DataStore(root);
      await restarted.initialize();

      expect(restarted.getWorkspace().applications[0].folderName).toBe(flat);
      await expect(readFile(path.join(store.files.paths.applicationsData, flat, "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("legacy letter");
    });

    it("gets its own position subfolder, with every file, when a second position joins the day", async () => {
      const legacy = await create(temmler, machine);
      const flat = await makeLegacy(legacy);
      await write(reload(legacy.id), "Anschreiben/Notiz.txt", "legacy letter");
      await write(reload(legacy.id), "Bewerbungsunterlagen/Zeugnis.pdf", "legacy mappe");

      const second = await create(temmler, production);

      const nested = reload(legacy.id);
      expect(nested.folderName).toBe(`${flat}/Maschinen-Einrichter_fur_die_Produktion`);
      expect(second.folderName).toBe(`${flat}/Mitarbeiter_Produktion`);
      await expect(readFile(path.join(dataPath(nested), "Anschreiben", "Notiz.txt"), "utf8")).resolves.toBe("legacy letter");
      await expect(readFile(path.join(dataPath(nested), "Bewerbungsunterlagen", "Zeugnis.pdf"), "utf8")).resolves.toBe("legacy mappe");
      // Nothing is left directly in the shared folder, and nothing is lost.
      expect(await names(path.join(store.files.paths.applicationsData, flat))).toEqual(["Maschinen-Einrichter_fur_die_Produktion", "Mitarbeiter_Produktion"]);
      await expect(access(path.join(store.files.paths.applicationsData, flat, "bewerbung.json"))).rejects.toThrow();
      await expect(readFile(path.join(dataPath(nested), "bewerbung.json"), "utf8")).resolves.toContain(`"folderName": "${flat}/Maschinen-Einrichter_fur_die_Produktion"`);

      const restarted = new DataStore(root);
      await restarted.initialize();
      expect(restarted.getWorkspace().applications.map((item) => item.folderName).sort()).toEqual([nested.folderName, second.folderName].sort());
    });

    it("the same position again then gets the suffix on its subfolder", async () => {
      const legacy = await create(temmler, production);
      const flat = await makeLegacy(legacy);
      const again = await create(temmler, production);
      expect(reload(legacy.id).folderName).toBe(`${flat}/Mitarbeiter_Produktion`);
      expect(again.folderName).toBe(`${flat}/Mitarbeiter_Produktion_2`);
    });
  });

  it("a second position of a duplicated application joins the shared folder as well", async () => {
    const first = await create(temmler, production, new Date().toISOString());
    await store.duplicateApplication(first.id);
    const folders = store.getWorkspace().applications.map((item) => item.folderName);
    expect(new Set(folders.map((folder) => folder.split("/")[0])).size).toBe(1);
    expect(new Set(folders).size).toBe(2);
  });
});
