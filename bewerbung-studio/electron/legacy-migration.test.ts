import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ApplicationInput } from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
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

describe("legacy migration", () => {
  let base: string;
  let sourceStore: DataStore;
  let targetStore: DataStore;

  beforeEach(async () => {
    base = await mkdtemp(path.join(tmpdir(), "bewerbung-migration-"));
    sourceStore = new DataStore(path.join(base, "source"));
    targetStore = new DataStore(path.join(base, "target"));
    await sourceStore.initialize();
    await targetStore.initialize();
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("previews and copies legacy data without modifying the source", async () => {
    const sourceWorkspace = await sourceStore.createApplication(
      applicationInput("Legacy GmbH"),
    );
    const application = sourceWorkspace.applications[0];
    const legacyDocument = path.join(
      sourceStore.dataPath,
      "Bewerbungen",
      application.folderName,
      "Anschreiben",
      "Legacy.docx",
    );
    await mkdir(path.dirname(legacyDocument), { recursive: true });
    await writeFile(legacyDocument, "legacy-cover");

    const preview = await targetStore.previewLegacyMigration(
      sourceStore.dataPath,
    );
    expect(preview.applications).toBe(1);
    expect(preview.fileCount).toBeGreaterThan(0);

    const migrated = await targetStore.migrateLegacyData(sourceStore.dataPath);
    expect(migrated.applications).toHaveLength(1);
    const migratedDocument = path.join(
      targetStore.files.documentDirectories(application).anschreiben,
      "Legacy.docx",
    );
    await expect(readFile(migratedDocument, "utf8")).resolves.toBe(
      "legacy-cover",
    );
    await expect(access(path.dirname(migratedDocument))).resolves.toBeUndefined();
    await expect(readFile(legacyDocument, "utf8")).resolves.toBe(
      "legacy-cover",
    );
    await expect(access(sourceStore.dataPath)).resolves.toBeUndefined();
  });

  it("refuses to merge legacy data into a non-empty target workspace", async () => {
    await sourceStore.createApplication(applicationInput("Source GmbH"));
    await targetStore.createApplication(applicationInput("Target GmbH"));
    await expect(
      targetStore.migrateLegacyData(sourceStore.dataPath),
    ).rejects.toThrow(/nur möglich.*leer/i);
  });
});
