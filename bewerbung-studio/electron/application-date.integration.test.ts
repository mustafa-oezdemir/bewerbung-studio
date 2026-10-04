import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveApplicationPaths } from "../src/config/application-paths";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { wordMusterTemplateConfig } from "../src/features/templates/template.constants";
import { DataStore } from "./storage";
import { TemplateService } from "./templates/template.service";

const createCoverLetterTemplate = async (filePath: string) => {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Bewerbung als {{STELLENBEZEICHNUNG}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>{{FIRMA_NAME}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>Bewerbungsdatum: {{BEWERBUNGSDATUM}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>{{ANREDE}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>{{EINLEITUNG}}</w:t></w:r></w:p>
        <w:p><w:r><w:t>{{SCHLUSSTEXT}}</w:t></w:r></w:p>
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
        </w:sectPr>
      </w:body>
    </w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    zip.generate({ type: "nodebuffer", compression: "DEFLATE" }),
  );
};

describe("central application-date workflow", () => {
  let root: string;
  const retainedQaRoot = process.env.APPLICATION_DATE_QA_ROOT;

  beforeEach(async () => {
    root = retainedQaRoot
      ? path.resolve(retainedQaRoot)
      : await mkdtemp(path.join(tmpdir(), "bewerbung-date-workflow-"));
    if (retainedQaRoot) {
      const allowedRoot = path.resolve(process.cwd(), "tmp", "date-qa");
      if (root !== allowedRoot) throw new Error("Ungültiger QA-Ausgabepfad.");
      await rm(root, { recursive: true, force: true });
      await mkdir(root, { recursive: true });
    }
  });

  afterEach(async () => {
    if (!retainedQaRoot) await rm(root, { recursive: true, force: true });
  });

  // Real files and a Word template: give a slow or busy machine room (the test itself takes a fraction of a second).
  it("passes new, changed-date, and existing-application scenarios", { timeout: 30_000 }, async () => {
    const paths = resolveApplicationPaths(root);
    await createCoverLetterTemplate(
      path.join(paths.anschreibenDocuments, wordMusterTemplateConfig.fileName),
    );
    const templates = new TemplateService(paths);
    await templates.initialize();
    const store = new DataStore(paths);
    await store.initialize();

    const created = await store.createApplication({
      company: {
        name: "Muster GmbH",
        street: "Musterstraße 1",
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
        fullText: "Testanzeige",
        workModel: "Hybrid",
        contractType: "Unbefristet",
        salaryExpectation: "",
      },
      templateId: "classic-professional",
      accentColor: "#155e58",
      secondaryColor: "#244766",
      designSettings: defaultDocumentDesign,
      notes: "",
      sentAt: "2026-09-08T09:00:00.000Z",
    });
    const initial = created.applications[0];
    const initialContext = store.getTemplateDocumentContext(initial.id);
    const initialResult = await templates.synchronizeDocumentFromTemplate(
      wordMusterTemplateConfig.id,
      initialContext.targetDirectories.anschreiben,
      initialContext.requestedBaseName,
      initialContext.data,
    );
    expect(initial.folderName).toMatch(/^Muster_GmbH_2026-09-08\/[^/]+$/);
    expect(path.basename(initialResult.filePath)).toBe(
      "Anschreiben_Muster_GmbH.docx",
    );
    expect(new PizZip(await readFile(initialResult.filePath)).file("word/document.xml")?.asText()).toContain(
      "Bewerbungsdatum: 08.09.2026",
    );
    if (retainedQaRoot) {
      await copyFile(initialResult.filePath, path.join(root, "QA_08.09.2026_Anschreiben.docx"));
    }

    const existingStore = new DataStore(paths);
    await existingStore.initialize();
    const existing = structuredClone(existingStore.getApplication(initial.id));
    existing.sentAt = "2026-09-15T09:00:00.000Z";
    const saved = await existingStore.saveApplication(existing);
    const updated = saved.applications.find((item) => item.id === initial.id)!;
    const updatedContext = existingStore.getTemplateDocumentContext(updated.id);
    const updatedResult = await templates.synchronizeDocumentFromTemplate(
      wordMusterTemplateConfig.id,
      updatedContext.targetDirectories.anschreiben,
      updatedContext.requestedBaseName,
      updatedContext.data,
    );

    expect(updated.folderName).toBe(
      `Muster_GmbH_2026-09-15/${initial.folderName.split("/")[1]}`,
    );
    expect(path.basename(updatedResult.filePath)).toBe(
      "Anschreiben_Muster_GmbH.docx",
    );
    const updatedXml = new PizZip(await readFile(updatedResult.filePath))
      .file("word/document.xml")
      ?.asText();
    expect(updatedXml).toContain("Bewerbungsdatum: 15.09.2026");
    expect(updatedXml).not.toContain("08.09.2026");
    const emailMarkdown = await readFile(
      path.join(paths.applicationsData, updated.folderName, "Email", "Email.md"),
      "utf8",
    );
    expect(emailMarkdown).toContain("- Bewerbungsdatum: 15.09.2026");
    expect(emailMarkdown).not.toContain("08.09.2026");
    expect(await readdir(updatedContext.targetDirectories.anschreiben)).not.toContain(
      "Muster_GmbH_08.09.2026_Anschreiben.docx",
    );
    if (retainedQaRoot) console.info(`FINAL_DOCX=${updatedResult.filePath}`);
  });
});
