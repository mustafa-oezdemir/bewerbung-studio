import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveApplicationPaths } from "../../src/config/application-paths";
import {
  einspaltigLebenslaufTemplateConfig,
  elegantLebenslaufTemplateConfig,
  ivyLeagueLebenslaufTemplateConfig,
  klassischLebenslaufTemplateConfig,
  kompaktLebenslaufTemplateConfig,
  kreativLebenslaufTemplateConfig,
  stilvollLebenslaufTemplateConfig,
  zeitgenoessischLebenslaufTemplateConfig,
  wordMusterTemplateConfig,
} from "../../src/features/templates/template.constants";
import { TemplateError } from "../../src/features/templates/template.errors";
import { TemplateService } from "./template.service";

const createDocx = async (
  filePath: string,
  body = `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{FIRMA_</w:t></w:r><w:r><w:t>NAME}}</w:t></w:r></w:p>`,
) => {
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
      <w:body>${body}<w:sectPr/></w:body>
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

describe("Musterverwaltung", () => {
  let root: string;
  let paths: ReturnType<typeof resolveApplicationPaths>;
  let service: TemplateService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbung-templates-"));
    paths = resolveApplicationPaths(root);
    service = new TemplateService(paths);
    await service.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates missing folders and scans each Muster folder with the correct type", async () => {
    await createDocx(path.join(paths.anschreibenTemplates, "Brief.docx"));
    await createDocx(path.join(paths.deckblattTemplates, "Titel.docx"));
    await createDocx(path.join(paths.lebenslaufTemplates, "CV.docx"));

    const result = await service.scanAllTemplates();

    expect(result.templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "Brief.docx",
          documentType: "anschreiben",
          source: "muster-folder",
        }),
        expect.objectContaining({
          fileName: "Titel.docx",
          documentType: "deckblatt",
        }),
        expect.objectContaining({
          fileName: "CV.docx",
          documentType: "lebenslauf",
        }),
      ]),
    );
    await expect(stat(paths.previewCache)).resolves.toBeDefined();
  });

  it("shows Word files from data/Anschreiben as Eigene Dokumente", async () => {
    await createDocx(
      path.join(paths.anschreibenDocuments, "Mein_Anschreiben.docx"),
    );

    await service.scanAllTemplates();
    const documents = await service.scanExistingAnschreiben();

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      source: "existing-document",
      documentType: "anschreiben",
    });
  });

  it("copies an existing Anschreiben to Muster without changing the original or overwriting collisions", async () => {
    const sourcePath = path.join(
      paths.anschreibenDocuments,
      "Anschreiben_Muster.docx",
    );
    await createDocx(sourcePath);
    const original = await readFile(sourcePath);
    await service.scanAllTemplates();
    const source = (await service.scanExistingAnschreiben())[0];

    const first = await service.copyExistingTemplateById(source.id);
    const second = await service.copyExistingTemplateById(source.id);

    expect(first.filePath).not.toBe(second.filePath);
    expect(await readFile(sourcePath)).toEqual(original);
    await expect(stat(first.filePath)).resolves.toBeDefined();
    await expect(stat(second.filePath)).resolves.toBeDefined();
  });

  it("registers Word Muster from the uploaded source", async () => {
    const sourcePath = path.join(
      paths.anschreibenDocuments,
      wordMusterTemplateConfig.fileName,
    );
    const targetPath = path.join(
      paths.anschreibenTemplates,
      wordMusterTemplateConfig.fileName,
    );
    await createDocx(sourcePath);
    const original = await readFile(sourcePath);
    const firstPath = path.join(paths.anschreibenTemplates, "Erste.docx");
    const laterPath = path.join(paths.deckblattTemplates, "Spaeter.docx");
    await createDocx(firstPath);
    await createDocx(laterPath);
    await writeFile(
      path.join(paths.anschreibenTemplates, "Erste.template.json"),
      JSON.stringify({ sortOrder: 1 }),
      "utf8",
    );
    await writeFile(
      path.join(paths.deckblattTemplates, "Spaeter.template.json"),
      JSON.stringify({ sortOrder: 3 }),
      "utf8",
    );

    const initialized = await service.initialize();
    const wordMuster = initialized.templates.find(
      (template) => template.id === wordMusterTemplateConfig.id,
    )!;

    expect(wordMuster).toMatchObject({
      id: "word-muster-anschreiben",
      name: "Anschreiben Mustafa Özdemir",
      fileName: "Anschreiben_Muster.docx",
      format: "docx",
      source: "uploaded-word-template",
      documentType: "anschreiben",
      sortOrder: 2,
      isSystemTemplate: false,
      supportsPreview: true,
      supportsPlaceholders: true,
      editableInWord: true,
      isProtected: true,
    });
    expect(await readFile(targetPath)).toEqual(original);
    expect(await readFile(sourcePath)).toEqual(original);

    const later = initialized.templates.find(
      (template) => template.fileName === "Spaeter.docx",
    )!;
    const afterFavorite = await service.toggleTemplateFavorite(later.id);
    expect(
      afterFavorite.templates.some(
        (template) => template.id === wordMusterTemplateConfig.id,
      ),
    ).toBe(true);
    await expect(
      service.deleteCustomTemplate(wordMuster.id),
    ).rejects.toMatchObject({ code: "PROTECTED_TEMPLATE" });
    await expect(stat(targetPath)).resolves.toBeDefined();
  });

  it("replaces Turkish Word Muster aliases on a new copy and leaves unknown placeholders unchanged", async () => {
    const templatePath = path.join(
      paths.anschreibenTemplates,
      wordMusterTemplateConfig.fileName,
    );
    await createDocx(
      templatePath,
      [
        `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{FIRMA_</w:t></w:r><w:r><w:t>ADI}}</w:t></w:r></w:p>`,
        "{{ANSPRECHPARTNER}}",
        "{{FIRMA_ADRESI}}",
        "{{POSTA_KODU}}",
        "{{SEHIR}}",
        "{{TARIH}}",
        "{{STELLE}}",
        "{{REFERENZNUMMER}}",
        "{{ANREDE}}",
        "{{ANSCHREIBEN_METNI}}",
        "{{KAPANIS}}",
        "{{UNBEKANNT}}",
      ]
        .map((value) =>
          value.startsWith("<w:p>")
            ? value
            : `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`,
        )
        .join(""),
    );
    const original = await readFile(templatePath);
    const initialized = await service.initialize();
    const wordMuster = initialized.templates.find(
      (template) => template.id === wordMusterTemplateConfig.id,
    )!;
    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "Siemens",
      "Anschreiben",
    );

    const created = await service.createDocumentFromTemplate(
      wordMuster.id,
      targetDirectory,
      "Siemens AG",
      {
        FIRMA_NAME: "Siemens AG",
        ANSPRECHPARTNER: "Frau Beispiel",
        FIRMA_ADRESSE: "Werner-von-Siemens-Straße 1",
        FIRMA_PLZ: "80333",
        FIRMA_ORT: "München",
        BEWERBUNGSDATUM: "20.07.2026",
        STELLENBEZEICHNUNG: "Softwareentwickler",
        STELLENNUMMER: "REF-42",
        ANREDE: "Sehr geehrte Frau Beispiel,",
        HAUPTTEXT: "Mein individueller Anschreibentext.",
        SCHLUSSTEXT: "Ich freue mich auf Ihre Rückmeldung.",
      },
    );
    const outputZip = new PizZip(await readFile(created.filePath));
    const documentXml = outputZip.file("word/document.xml")!.asText();

    expect(created.fileName).toMatch(
      /^Siemens_AG_\d{8}_\d{6}\.docx$/,
    );
    expect(created.replacedPlaceholders).toEqual(
      expect.arrayContaining([
        "FIRMA_ADI",
        "FIRMA_ADRESI",
        "POSTA_KODU",
        "SEHIR",
        "TARIH",
        "STELLE",
        "REFERENZNUMMER",
        "ANSCHREIBEN_METNI",
        "KAPANIS",
      ]),
    );
    expect(documentXml).toContain("Siemens AG");
    expect(documentXml).toContain("Softwareentwickler");
    expect(documentXml).toContain("Mein individueller Anschreibentext.");
    expect(documentXml).toContain("{{UNBEKANNT}}");
    expect(documentXml).toContain("<w:b/>");
    expect(documentXml.match(/<w:jc w:val="both"\/>/g)).toHaveLength(2);
    expect(await readFile(templatePath)).toEqual(original);
  });

  it("registers Zeitgenössisch and creates photo and ATS Lebenslauf copies", async () => {
    paths = resolveApplicationPaths(
      root,
      path.resolve("public", "templates"),
    );
    service = new TemplateService(paths);
    const firstPath = path.join(
      paths.anschreibenTemplates,
      "Erste.docx",
    );
    await createDocx(firstPath);
    await writeFile(
      path.join(paths.anschreibenTemplates, "Erste.template.json"),
      JSON.stringify({ sortOrder: 1 }),
      "utf8",
    );
    await createDocx(
      path.join(
        paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      ),
    );

    const initialized = await service.initialize();
    const zeitgenoessisch = initialized.templates.find(
      (template) => template.id === zeitgenoessischLebenslaufTemplateConfig.id,
    )!;
    const bundledPath = path.resolve(
      "public",
      "templates",
      zeitgenoessischLebenslaufTemplateConfig.fileName,
    );
    const bundledOriginal = await readFile(bundledPath);
    const onePixelPng =
      "data:image/png;base64," +
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" +
      "AAAADUlEQVR42mNk+M/wHwAEAQH/7Z7uWQAAAABJRU5ErkJggg==";
    const data = {
      VORNAME: "Mustafa",
      NACHNAME: "Özdemir",
      BERUFSBEZEICHNUNG: "Softwareentwickler",
      FACHGEBIETE: "Backend | Cloud | DevOps",
      KONTAKT_ZEILE_1: "+49 170 123456 | mustafa@example.de",
      KONTAKT_ZEILE_2: "Berlin",
      KONTAKT_ZEILE_3: "Berlin",
      KONTAKTE_TITEL: "KONTAKTE",
      TELEFON_ZEILE: "Telefon: +49 170 123456",
      EMAIL_ZEILE: "E-Mail: mustafa@example.de",
      WEBSITE_ZEILE: "Website: mustafa.example",
      LINKEDIN_ZEILE: "LinkedIn: linkedin.com/in/mustafa",
      ORT_ZEILE: "Ort: Berlin",
      PROFILFOTO: onePixelPng,
      ZUSAMMENFASSUNG_TITEL: "ZUSAMMENFASSUNG",
      ZUSAMMENFASSUNG: "Erfahrener Entwickler für sichere Plattformen.",
      BERUFSERFAHRUNG_TITEL: "BERUFSERFAHRUNG",
      POSITION_1: "Senior Softwareentwickler",
      UNTERNEHMEN_1: "Beispiel GmbH",
      STARTDATUM_1: "01/2022",
      DATUM_TRENNER_1: " – ",
      ENDDATUM_1: "heute",
      ARBEITSORT_1: "Berlin",
      BESCHREIBUNG_1: "Entwicklung geschäftskritischer Anwendungen.",
      ERFOLG_1_1: "Bereitstellungszeit um 40 Prozent reduziert.",
      AUSBILDUNG_TITEL: "AUSBILDUNG",
      ABSCHLUSS_1: "Bachelor of Science",
      HOCHSCHULE_1: "Technische Hochschule",
      AUSBILDUNG_START_1: "2014",
      AUSBILDUNG_DATUM_TRENNER_1: " – ",
      AUSBILDUNG_ENDE_1: "2018",
      AUSBILDUNG_ORT_1: "Berlin",
      STAERKEN_TITEL: "STÄRKEN",
      STAERKE_1_TITEL: "Zielorientierung",
      KENNTNISSE_TITEL: "FÄHIGKEITEN",
      KENNTNIS_KATEGORIE_1: "Backend",
      KENNTNIS_EINTRAEGE_1: "TypeScript · Node.js · PostgreSQL",
      SPRACHEN_TITEL: "SPRACHEN",
      SPRACHE_1: "Deutsch",
      SPRACHNIVEAU_1: "Muttersprache",
      SPRACHE_1_PUNKTE: "●●●●●",
      SPRACHEN_ATS: "Deutsch – Muttersprache",
      DESIGN_PRIMARY: "#123456",
      DESIGN_ACCENT: "#36B779",
      DESIGN_SOFT_ACCENT: "#DDEEEE",
      DESIGN_TITLE_BACKGROUND: "#CCEEDD",
      DESIGN_FONT: "Arial",
    };

    expect(zeitgenoessisch).toMatchObject({
      id: "word-lebenslauf-zeitgenoessisch",
      name: "Zeitgenössisch",
      documentType: "lebenslauf",
      format: "docx",
      source: "system-word-template",
      sortOrder: 3,
      category: "contemporary",
      layout: "two-column-left-sidebar",
      atsFriendly: true,
      supportsPhoto: true,
      supportsPlaceholders: true,
      editableInWord: true,
      supportsAtsMode: true,
      isSystemTemplate: true,
      isProtected: true,
    });

    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "Zeitgenoessisch",
      "Lebenslauf",
    );
    const created = await service.createDocumentFromTemplate(
      zeitgenoessisch.id,
      targetDirectory,
      "ignored",
      data,
    );
    const outputZip = new PizZip(await readFile(created.filePath));
    const documentXml = outputZip.file("word/document.xml")!.asText();
    const stylesXml = outputZip.file("word/styles.xml")!.asText();
    const outputMedia = Object.keys(outputZip.files)
      .filter((fileName) => /^word\/media\/.*\.png$/i.test(fileName))
      .map((fileName) => outputZip.file(fileName)!.asNodeBuffer());

    expect(created.fileName).toMatch(
      /^Lebenslauf_Mustafa_Oezdemir_\d{8}_\d{6}\.docx$/,
    );
    expect(documentXml).toContain("Mustafa");
    expect(documentXml).toContain("Senior Softwareentwickler");
    expect(stylesXml).toContain('w:color w:val="123456"');
    expect(documentXml).toContain('w:fill="CCEEDD"');
    expect(documentXml).toContain('<w:gridCol w:w="3409"/>');
    expect(documentXml).toContain('<w:gridCol w:w="7589"/>');
    expect(documentXml).toContain("<w:drawing>");
    expect(documentXml).not.toContain("{{");
    expect(outputMedia).toContainEqual(
      Buffer.from(onePixelPng.split(",")[1], "base64"),
    );
    expect(await readFile(bundledPath)).toEqual(bundledOriginal);

    const withoutPhoto = await service.createDocumentFromTemplate(
      zeitgenoessisch.id,
      path.join(targetDirectory, "OhneFoto"),
      "ignored",
      { ...data, PROFILFOTO: "" },
    );
    const withoutPhotoZip = new PizZip(
      await readFile(withoutPhoto.filePath),
    );
    const withoutPhotoXml = withoutPhotoZip
      .file("word/document.xml")!
      .asText();
    expect(withoutPhotoXml).not.toContain('descr="PROFILFOTO"');
    expect(withoutPhotoXml.match(/<w:drawing>/g)).toHaveLength(1);

    const atsCreated = await service.createDocumentFromTemplate(
      zeitgenoessisch.id,
      path.join(targetDirectory, "ATS"),
      "ignored",
      data,
      { atsMode: true },
    );
    const atsZip = new PizZip(await readFile(atsCreated.filePath));
    const atsXml = atsZip.file("word/document.xml")!.asText();
    expect(atsXml).toContain("Mustafa");
    expect(atsXml).not.toContain('<w:gridCol w:w="3409"/>');
    expect(atsXml).not.toContain("<w:drawing>");

    const favorited = await service.toggleTemplateFavorite(
      zeitgenoessisch.id,
    );
    expect(
      favorited.templates.some(
        (template) =>
          template.id === zeitgenoessischLebenslaufTemplateConfig.id,
      ),
    ).toBe(true);
  });

  it("fills Elegant with the shared Anschreiben applicant placeholders", async () => {
    paths = resolveApplicationPaths(
      root,
      path.resolve("public", "templates"),
    );
    service = new TemplateService(paths);
    await createDocx(
      path.join(
        paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      ),
    );

    const initialized = await service.initialize();
    const elegant = initialized.templates.find(
      (template) => template.id === elegantLebenslaufTemplateConfig.id,
    )!;
    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "Elegant",
      "Lebenslauf",
    );
    const created = await service.createDocumentFromTemplate(
      elegant.id,
      targetDirectory,
      "ignored",
      {
        BEWERBER_NAME: "Mustafa Özdemir",
        BEWERBER_VORNAME: "Mustafa",
        BEWERBER_NACHNAME: "Özdemir",
        BERUFSBEZEICHNUNG: "Softwareentwickler",
        BEWERBER_ADRESSE: "Musterstraße 12",
        BEWERBER_PLZ: "35037",
        BEWERBER_ORT: "Marburg",
        BEWERBER_EMAIL: "mustafa@example.de",
        BEWERBER_TELEFON: "+49 170 123456",
        BERUFSERFAHRUNG_TITEL: "BERUFSERFAHRUNG",
        POSITION_1: "Senior Softwareentwickler",
        UNTERNEHMEN_1: "Beispiel GmbH",
      },
    );
    const outputZip = new PizZip(await readFile(created.filePath));
    const documentXml = outputZip.file("word/document.xml")!.asText();

    expect(created.fileName).toMatch(
      /^Lebenslauf_Mustafa_Oezdemir_\d{8}_\d{6}\.docx$/,
    );
    expect(documentXml).toContain("Mustafa Özdemir");
    expect(documentXml).toContain("Musterstraße 12");
    expect(documentXml).toContain("35037");
    expect(documentXml).toContain("Marburg");
    expect(documentXml).toContain("mustafa@example.de");
    expect(documentXml).toContain("+49 170 123456");
    expect(documentXml).toContain("Senior Softwareentwickler");
    expect(documentXml).not.toContain("{{");
  });

  it("registers Kreativ and preserves its banner, background and ATS copy", async () => {
    paths = resolveApplicationPaths(
      root,
      path.resolve("public", "templates"),
    );
    service = new TemplateService(paths);
    const firstPath = path.join(
      paths.anschreibenTemplates,
      "Erste.docx",
    );
    await createDocx(firstPath);
    await writeFile(
      path.join(paths.anschreibenTemplates, "Erste.template.json"),
      JSON.stringify({ sortOrder: 1 }),
      "utf8",
    );
    await createDocx(
      path.join(
        paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      ),
    );

    const initialized = await service.initialize();
    const kreativ = initialized.templates.find(
      (template) => template.id === kreativLebenslaufTemplateConfig.id,
    )!;
    expect(kreativ).toMatchObject({
      id: "word-lebenslauf-kreativ",
      name: "Kreativ",
      documentType: "lebenslauf",
      format: "docx",
      source: "system-word-template",
      sortOrder: 4,
      category: "creative",
      layout: "two-column-header-banner",
      atsFriendly: true,
      supportsPhoto: true,
      supportsBackground: true,
      supportsPlaceholders: true,
      editableInWord: true,
      supportsAtsMode: true,
      emphasis: "compact-information",
      isSystemTemplate: true,
      isProtected: true,
    });

    const bundledPath = path.resolve(
      "public",
      "templates",
      kreativLebenslaufTemplateConfig.fileName,
    );
    const bundledOriginal = await readFile(bundledPath);
    const onePixelPng =
      "data:image/png;base64," +
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ" +
      "AAAADUlEQVR42mNk+M/wHwAEAQH/7Z7uWQAAAABJRU5ErkJggg==";
    const data = {
      VORNAME: "Marie",
      NACHNAME: "Schröder",
      BERUFSBEZEICHNUNG: "IT-Projektmanagerin",
      FACHGEBIETE: "Softwareentwicklung | Prozessmanagement",
      HEADER_KONTAKT_1: "+49 30 12345678",
      HEADER_KONTAKT_2: "marie@example.de",
      HEADER_KONTAKT_3: "linkedin.com/in/marie",
      HEADER_KONTAKT_4: "Berlin, Deutschland",
      HEADER_KONTAKT_5: "Geb. 01.03.1990 in München",
      PROFILFOTO: onePixelPng,
      ERFAHRUNG_TITEL: "ERFAHRUNG",
      POSITION_1: "Senior IT-Projektmanagerin",
      UNTERNEHMEN_1: "TechnologieLösungen AG",
      STARTDATUM_1: "2018",
      DATUM_TRENNER_1: "–",
      ENDDATUM_1: "2023",
      METADATA_TRENNER_1: "·",
      ARBEITSORT_1: "München",
      BESCHREIBUNG_1: "Leitung komplexer IT-Projekte.",
      ERFOLG_1_1: "Mehr als 15 Projekte erfolgreich umgesetzt.",
      TECHNOLOGIEN_1: "Jira · TypeScript · React",
      AUSBILDUNG_TITEL: "AUSBILDUNG",
      ABSCHLUSS_1: "M.Sc.",
      FACHRICHTUNG_1: "Wirtschaftsinformatik",
      HOCHSCHULE_1: "Technische Universität München",
      AUSBILDUNG_START_1: "2010",
      AUSBILDUNG_DATUM_TRENNER_1: "–",
      AUSBILDUNG_ENDE_1: "2012",
      AUSBILDUNG_METADATA_TRENNER_1: "·",
      AUSBILDUNG_ORT_1: "München",
      ZUSAMMENFASSUNG_TITEL: "ZUSAMMENFASSUNG",
      ZUSAMMENFASSUNG: "Erfahrene Projektmanagerin für digitale Transformation.",
      STAERKEN_TITEL: "STÄRKEN",
      STAERKE_1_TITEL: "Projektmanagement",
      STAERKE_1_BESCHREIBUNG: "Mehrjährige Leitung komplexer Projekte.",
      SPRACHEN_TITEL: "SPRACHEN",
      SPRACHE_1: "Deutsch",
      SPRACHNIVEAU_1: "Muttersprache",
      SPRACHE_1_PUNKTE: "●●●●●",
      SPRACHEN_ATS: "Deutsch – Muttersprache",
      KENNTNISSE_TITEL: "FÄHIGKEITEN",
      KENNTNISSE: "Jira, TypeScript, React",
      KENNTNIS_KATEGORIE_1: "Projektmanagement",
      KENNTNIS_EINTRAEGE_1: "Jira · Asana",
      DESIGN_PRIMARY: "#111111",
      DESIGN_SOFT_ACCENT: "#EEEEEE",
      DESIGN_FONT: "Arial",
    };
    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "Kreativ",
      "Lebenslauf",
    );
    const created = await service.createDocumentFromTemplate(
      kreativ.id,
      targetDirectory,
      "ignored",
      data,
    );
    const outputZip = new PizZip(await readFile(created.filePath));
    const documentXml = outputZip.file("word/document.xml")!.asText();
    const media = Object.keys(outputZip.files)
      .filter((fileName) => /^word\/media\/.*\.png$/i.test(fileName))
      .map((fileName) => outputZip.file(fileName)!.asNodeBuffer());

    expect(created.fileName).toMatch(
      /^Lebenslauf_Marie_Schroeder_\d{8}_\d{6}\.docx$/,
    );
    expect(documentXml).toContain('w:fill="111111"');
    expect(documentXml).toContain('<w:gridCol w:w="8250"/>');
    expect(documentXml).toContain('<w:gridCol w:w="2748"/>');
    expect(documentXml).toContain('<w:gridCol w:w="6599"/>');
    expect(documentXml).toContain('<w:gridCol w:w="4399"/>');
    expect(documentXml).toContain("Senior IT-Projektmanagerin");
    expect(documentXml).not.toContain("{{");
    expect(media).toContainEqual(
      Buffer.from(onePixelPng.split(",")[1], "base64"),
    );
    expect(await readFile(bundledPath)).toEqual(bundledOriginal);

    const withoutPhoto = await service.createDocumentFromTemplate(
      kreativ.id,
      path.join(targetDirectory, "OhneFoto"),
      "ignored",
      { ...data, PROFILFOTO: "" },
    );
    const withoutPhotoXml = new PizZip(
      await readFile(withoutPhoto.filePath),
    )
      .file("word/document.xml")!
      .asText();
    expect(withoutPhotoXml).not.toContain('descr="PROFILFOTO"');
    expect(withoutPhotoXml.match(/<w:drawing>/g)).toHaveLength(1);

    const atsCreated = await service.createDocumentFromTemplate(
      kreativ.id,
      path.join(targetDirectory, "ATS"),
      "ignored",
      data,
      { atsMode: true },
    );
    const atsXml = new PizZip(await readFile(atsCreated.filePath))
      .file("word/document.xml")!
      .asText();
    expect(atsXml).toContain("Marie");
    expect(atsXml).not.toContain("<w:drawing>");
    expect(atsXml).not.toContain('<w:gridCol w:w="6599"/>');

    const denseResult = await service.createDocumentFromTemplate(
      kreativ.id,
      path.join(targetDirectory, "Dicht"),
      "ignored",
      {
        ...data,
        POSITION_2: "Projektmanagerin",
        POSITION_3: "Projektleiterin",
        POSITION_4: "Softwareentwicklerin",
        POSITION_5: "Consultant",
      },
    );
    expect(denseResult.warning).toContain(
      "Der Inhalt passt möglicherweise nicht vollständig auf eine Seite.",
    );

    const favorited = await service.toggleTemplateFavorite(kreativ.id);
    expect(
      favorited.templates.some(
        (template) => template.id === kreativLebenslaufTemplateConfig.id,
      ),
    ).toBe(true);
  });

  it("registers Kompakt and preserves margins, links, decoration and ATS mode", async () => {
    paths = resolveApplicationPaths(
      root,
      path.resolve("public", "templates"),
    );
    service = new TemplateService(paths);
    await createDocx(
      path.join(paths.anschreibenTemplates, "Erste.docx"),
    );
    await writeFile(
      path.join(paths.anschreibenTemplates, "Erste.template.json"),
      JSON.stringify({ sortOrder: 1 }),
      "utf8",
    );
    await createDocx(
      path.join(
        paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      ),
    );

    const initialized = await service.initialize();
    const kompakt = initialized.templates.find(
      (template) => template.id === kompaktLebenslaufTemplateConfig.id,
    )!;
    expect(kompakt).toMatchObject({
      id: "word-lebenslauf-kompakt",
      name: "Kompakt",
      documentType: "lebenslauf",
      format: "docx",
      source: "system-word-template",
      sortOrder: 5,
      category: "compact",
      layout: "two-column-compact",
      atsFriendly: true,
      supportsPhoto: false,
      supportsBackground: true,
      supportsPlaceholders: true,
      editableInWord: true,
      supportsAtsMode: true,
      emphasis: "single-page-high-density",
      isSystemTemplate: true,
      isProtected: true,
    });
    const bundledPath = path.resolve(
      "public",
      "templates",
      kompaktLebenslaufTemplateConfig.fileName,
    );
    const bundledOriginal = await readFile(bundledPath);
    const data = {
      VORNAME: "Julian",
      NACHNAME: "Fischer",
      BERUFSBEZEICHNUNG: "IT-Projektmanager",
      KONTAKTDATEN_TITEL: "KONTAKTDATEN",
      TELEFON: "+49 30 12345678",
      EMAIL: "julian@example.de",
      LINKEDIN: "linkedin.com/in/julian",
      GITHUB: "github.com/julian",
      WEBSITE: "julian.example/portfolio",
      ORT: "München",
      GEBURTSZEILE: "Geb. 01.03.1990 in München",
      ZUSAMMENFASSUNG_TITEL: "ZUSAMMENFASSUNG",
      ZUSAMMENFASSUNG: "Erfahrener Projektmanager mit technischem Fokus.",
      ERFAHRUNG_TITEL: "ERFAHRUNG",
      POSITION_1: "Stellvertretender Restaurantleiter",
      UNTERNEHMEN_1: "Sushi Palace",
      STARTDATUM_1: "2019",
      DATUM_TRENNER_1: "–",
      ENDDATUM_1: "2023",
      METADATA_TRENNER_1: "·",
      ARBEITSORT_1: "Düsseldorf",
      BESCHREIBUNG_1: "Verantwortung für das tägliche Geschäft.",
      ERFOLG_1_1: "Schulung von 25 neuen Mitarbeitern.",
      TECHNOLOGIEN_1: "Inventar · Dienstplanung",
      AUSBILDUNG_TITEL: "AUSBILDUNG",
      ABSCHLUSS_1: "B.A.",
      FACHRICHTUNG_1: "Betriebswirtschaft",
      HOCHSCHULE_1: "Hochschule Düsseldorf",
      AUSBILDUNG_START_1: "2014",
      AUSBILDUNG_DATUM_TRENNER_1: "–",
      AUSBILDUNG_ENDE_1: "2018",
      AUSBILDUNG_METADATA_TRENNER_1: "·",
      AUSBILDUNG_ORT_1: "Düsseldorf",
      SPRACHEN_TITEL: "SPRACHEN",
      SPRACHE_1: "Deutsch",
      SPRACHNIVEAU_1: "Muttersprache",
      SPRACHE_1_PUNKTE: "●●●●●",
      SPRACHEN_ATS: "Deutsch – Muttersprache",
      STAERKEN_TITEL: "STÄRKEN",
      STAERKE_1_TITEL: "Teamleitung",
      STAERKE_1_BESCHREIBUNG: "Führung von Teams mit 30 Mitarbeitern.",
      STAERKEN_ATS: "Teamleitung",
      ERFOLGE_TITEL: "ERFOLGE",
      ERFOLG_HIGHLIGHT_1_TITEL: "Prozessqualität",
      ERFOLG_HIGHLIGHT_1_BESCHREIBUNG:
        "Operative Abläufe messbar verbessert.",
      ERFOLGE_ATS: "Prozessqualität: Operative Abläufe verbessert.",
      KENNTNISSE_TITEL: "FÄHIGKEITEN",
      KENNTNISSE: "Projektmanagement, Kommunikation",
      KENNTNIS_KATEGORIE_1: "Projektmanagement",
      KENNTNIS_EINTRAEGE_1: "Jira · Asana",
      DESIGN_PRIMARY: "#123456",
      DESIGN_ACCENT: "#D15A00",
      DESIGN_SOFT_ACCENT: "#FBE1D1",
      DESIGN_FONT: "Arial",
      DESIGN_MARGIN_VERTICAL_MM: "10",
      DESIGN_MARGIN_HORIZONTAL_MM: "13",
      DEKORATION_AKTIV: "true",
    };
    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "Kompakt",
      "Lebenslauf",
    );
    const created = await service.createDocumentFromTemplate(
      kompakt.id,
      targetDirectory,
      "ignored",
      data,
    );
    const outputZip = new PizZip(await readFile(created.filePath));
    const documentXml = outputZip.file("word/document.xml")!.asText();
    const stylesXml = outputZip.file("word/styles.xml")!.asText();
    const relationshipsXml = outputZip
      .file("word/_rels/document.xml.rels")!
      .asText();

    expect(created.fileName).toMatch(
      /^Lebenslauf_Julian_Fischer_\d{8}_\d{6}\.docx$/,
    );
    expect(documentXml).toContain('<w:gridCol w:w="6124"/>');
    expect(documentXml).toContain('<w:gridCol w:w="4082"/>');
    expect(documentXml).toContain('w:top="567"');
    expect(documentXml).toContain('w:left="737"');
    expect(documentXml).toContain("KOMPAKT_DEKORATION");
    expect(documentXml).not.toContain("PROFILFOTO");
    expect(stylesXml).toContain('w:color w:val="123456"');
    expect(stylesXml).toContain('w:color w:val="D15A00"');
    expect(relationshipsXml).toContain("mailto:julian@example.de");
    expect(relationshipsXml).toContain("https://linkedin.com/in/julian");
    expect(documentXml).not.toContain("{{");
    expect(await readFile(bundledPath)).toEqual(bundledOriginal);

    const withoutDecoration = await service.createDocumentFromTemplate(
      kompakt.id,
      path.join(targetDirectory, "OhneDekoration"),
      "ignored",
      { ...data, DEKORATION_AKTIV: "false" },
    );
    const withoutDecorationXml = new PizZip(
      await readFile(withoutDecoration.filePath),
    )
      .file("word/document.xml")!
      .asText();
    expect(withoutDecorationXml).not.toContain("KOMPAKT_DEKORATION");
    expect(withoutDecorationXml).not.toContain("<w:drawing>");

    const atsCreated = await service.createDocumentFromTemplate(
      kompakt.id,
      path.join(targetDirectory, "ATS"),
      "ignored",
      data,
      { atsMode: true },
    );
    const atsXml = new PizZip(await readFile(atsCreated.filePath))
      .file("word/document.xml")!
      .asText();
    expect(atsXml).toContain("Julian");
    expect(atsXml).not.toContain("<w:tbl>");
    expect(atsXml).not.toContain("<w:drawing>");

    const denseResult = await service.createDocumentFromTemplate(
      kompakt.id,
      path.join(targetDirectory, "Dicht"),
      "ignored",
      {
        ...data,
        ZUSAMMENFASSUNG: "a".repeat(601),
        ERFOLG_HIGHLIGHT_1_BESCHREIBUNG:
          "Schulung von 25 neuen Mitarbeitern.",
        POSITION_2: "Schichtleiter",
        POSITION_3: "Teamleiter",
        POSITION_4: "Servicekoordinator",
        POSITION_5: "Projektmanager",
        POSITION_6: "Consultant",
      },
    );
    expect(denseResult.warning).toContain(
      "Der Inhalt passt nicht vollständig auf eine Seite.",
    );
    expect(denseResult.warning).toContain(
      "Die Zusammenfassung überschreitet die empfohlenen 600 Zeichen.",
    );
    expect(denseResult.warning).toContain(
      "bereits in der Berufserfahrung verwendet",
    );

    const favorited = await service.toggleTemplateFavorite(kompakt.id);
    expect(
      favorited.templates.some(
        (template) => template.id === kompaktLebenslaufTemplateConfig.id,
      ),
    ).toBe(true);
  });

  it("creates a new DOCX, replaces split-run placeholders and preserves run formatting", async () => {
    const templatePath = path.join(
      paths.anschreibenTemplates,
      "Formatiert.docx",
    );
    await createDocx(templatePath);
    const result = await service.scanAllTemplates();
    const template = result.templates.find(
      (item) => item.fileName === "Formatiert.docx",
    )!;
    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "Siemens",
      "Anschreiben",
    );

    const created = await service.createDocumentFromTemplate(
      template.id,
      targetDirectory,
      "Siemens AG",
      { FIRMA_NAME: "Siemens AG" },
    );
    const outputZip = new PizZip(await readFile(created.filePath));
    const documentXml = outputZip.file("word/document.xml")!.asText();

    expect(created.fileName).toMatch(/^Siemens_AG_\d{8}_\d{6}\.docx$/);
    expect(documentXml).toContain("Siemens AG");
    expect(documentXml).toContain("<w:b/>");
    expect(await readFile(templatePath)).not.toEqual(
      await readFile(created.filePath),
    );
  });

  it("synchronizes one stable DOCX instead of creating timestamped copies", async () => {
    const templatePath = path.join(
      paths.anschreibenTemplates,
      "Synchronisiert.docx",
    );
    await createDocx(
      templatePath,
      `<w:p><w:r><w:t>{{FIRMA_NAME}}</w:t></w:r></w:p>
       <w:p><w:r><w:t>{{EINLEITUNG}}</w:t></w:r></w:p>`,
    );
    const result = await service.scanAllTemplates();
    const template = result.templates.find(
      (item) => item.fileName === "Synchronisiert.docx",
    )!;
    const targetDirectory = path.join(
      paths.anschreibenDocuments,
      "Bosch_2026-08-11",
      "Softwareentwickler_PHP",
    );

    const first = await service.synchronizeDocumentFromTemplate(
      template.id,
      targetDirectory,
      "Anschreiben_Mustafa_Özdemir",
      { FIRMA_NAME: "Bosch", EINLEITUNG: "Kurze Einleitung" },
    );
    const second = await service.synchronizeDocumentFromTemplate(
      template.id,
      targetDirectory,
      "Anschreiben_Mustafa_Özdemir",
      {
        FIRMA_NAME: "Robert Bosch GmbH",
        EINLEITUNG: "Langer Anschreibentext ".repeat(120),
      },
    );
    const outputZip = new PizZip(await readFile(second.filePath));

    expect(second.filePath).toBe(first.filePath);
    expect(second.fileName).toBe("Anschreiben_Mustafa_Özdemir.docx");
    expect(await readdir(targetDirectory)).toEqual([
      "Anschreiben_Mustafa_Özdemir.docx",
    ]);
    expect(outputZip.file("word/document.xml")!.asText()).toContain(
      "Robert Bosch GmbH",
    );
  });

  it("adds an optional extra paragraph before the closing in older templates", async () => {
    const templatePath = path.join(
      paths.anschreibenTemplates,
      "Zusatzabsatz.docx",
    );
    await createDocx(
      templatePath,
      `<w:p><w:r><w:t>{{SCHLUSSTEXT}}</w:t></w:r></w:p>`,
    );
    const result = await service.scanAllTemplates();
    const template = result.templates.find(
      (item) => item.fileName === "Zusatzabsatz.docx",
    )!;
    const created = await service.synchronizeDocumentFromTemplate(
      template.id,
      path.join(paths.anschreibenDocuments, "Beispiel", "Entwicklung"),
      "Anschreiben",
      {
        ZUSATZABSATZ: "Optionaler Zusatzabsatz.",
        SCHLUSSTEXT: "Abschließender Absatz.",
      },
    );
    const documentXml = new PizZip(await readFile(created.filePath))
      .file("word/document.xml")!
      .asText();

    expect(documentXml).toContain("Optionaler Zusatzabsatz.");
    expect(documentXml).toContain("Abschließender Absatz.");
    expect(documentXml.indexOf("Optionaler Zusatzabsatz.")).toBeLessThan(
      documentXml.indexOf("Abschließender Absatz."),
    );
  });

  it("appends the Anlagen section when a cover-letter template has no placeholder for it", async () => {
    const templatePath = path.join(
      paths.anschreibenTemplates,
      "Anlagen-ohne-Platzhalter.docx",
    );
    await createDocx(
      templatePath,
      `<w:p><w:r><w:t>{{SCHLUSSTEXT}}</w:t></w:r></w:p>`,
    );
    const result = await service.scanAllTemplates();
    const template = result.templates.find(
      (item) => item.fileName === "Anlagen-ohne-Platzhalter.docx",
    )!;
    const created = await service.synchronizeDocumentFromTemplate(
      template.id,
      path.join(paths.anschreibenDocuments, "Beispiel", "Verkauf"),
      "Anschreiben_Mustafa_Özdemir",
      {
        SCHLUSSTEXT: "Abschließender Absatz.",
        ANLAGENHINWEIS: "Anlagen:\nLebenslauf\nArbeitszeugnisse",
        DESIGN_PRIMARY: "#0B3D86",
      },
    );
    const documentXml = new PizZip(await readFile(created.filePath))
      .file("word/document.xml")!
      .asText();

    expect(created.fileName).toBe("Anschreiben_Mustafa_Özdemir.docx");
    expect(documentXml).toContain("Anlagen:");
    expect(documentXml).toContain("Lebenslauf");
    expect(documentXml).toContain("Arbeitszeugnisse");
    expect(documentXml.indexOf("Abschließender Absatz.")).toBeLessThan(
      documentXml.indexOf("Anlagen:"),
    );
  });

  it("places Anlagen after the signature even when a legacy placeholder is in the body", async () => {
    const templatePath = path.join(
      paths.anschreibenTemplates,
      "Anlagen-im-Text.docx",
    );
    await createDocx(
      templatePath,
      `<w:p><w:r><w:t>{{SCHLUSSTEXT}}</w:t></w:r></w:p><w:p><w:r><w:t>{{ANLAGENHINWEIS}}</w:t></w:r></w:p><w:p><w:r><w:t>{{GRUSSFORMEL}}</w:t></w:r></w:p><w:p><w:r><w:t>{{UNTERSCHRIFT}}</w:t></w:r></w:p>`,
    );
    const result = await service.scanAllTemplates();
    const template = result.templates.find(
      (item) => item.fileName === "Anlagen-im-Text.docx",
    )!;
    const created = await service.synchronizeDocumentFromTemplate(
      template.id,
      path.join(paths.anschreibenDocuments, "Beispiel", "Verkauf"),
      "Anschreiben_Mustafa_Özdemir",
      {
        SCHLUSSTEXT: "Abschließender Absatz.",
        GRUSSFORMEL: "Mit freundlichen Grüßen",
        UNTERSCHRIFT: "Mustafa Özdemir",
        ANLAGENHINWEIS: "Anlagen:\nLebenslauf",
        DESIGN_PRIMARY: "#0B3D86",
      },
    );
    const documentXml = new PizZip(await readFile(created.filePath))
      .file("word/document.xml")!
      .asText();

    expect(documentXml.indexOf("Mustafa Özdemir")).toBeLessThan(
      documentXml.indexOf("Anlagen:"),
    );
  });

  it("does not list unsupported extensions and reports corrupt DOCX files without crashing", async () => {
    await writeFile(path.join(paths.anschreibenTemplates, "Notiz.txt"), "x");
    await writeFile(
      path.join(paths.anschreibenTemplates, "Defekt.docx"),
      "not-a-zip",
    );

    const result = await service.scanAllTemplates();
    const corrupt = result.templates.find(
      (item) => item.fileName === "Defekt.docx",
    )!;

    expect(result.templates.some((item) => item.fileName === "Notiz.txt")).toBe(
      false,
    );
    await expect(
      service.createDocumentFromTemplate(
        corrupt.id,
        path.join(paths.dataRoot, "Bewerbungen", "Test", "Anschreiben"),
        "Test",
        {},
      ),
    ).rejects.toMatchObject({ code: "CORRUPT" });
  });

  it("persists favorites in sidecar metadata and protects system templates from deletion", async () => {
    const templatePath = path.join(
      paths.lebenslaufTemplates,
      "System.docx",
    );
    await createDocx(templatePath);
    await writeFile(
      path.join(paths.lebenslaufTemplates, "System.template.json"),
      JSON.stringify({ isSystemTemplate: true }),
      "utf8",
    );
    const result = await service.scanAllTemplates();
    const template = result.templates[0];

    await expect(service.deleteCustomTemplate(template.id)).rejects.toEqual(
      expect.objectContaining<Partial<TemplateError>>({
        code: "SYSTEM_TEMPLATE",
      }),
    );
    await expect(stat(templatePath)).resolves.toBeDefined();
  });

  it("registers Ivy League with its watercolor Muster, preview, and linear ATS copy", async () => {
    paths = resolveApplicationPaths(
      root,
      path.resolve("public", "templates"),
    );
    service = new TemplateService(paths);
    await createDocx(
      path.join(
        paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      ),
    );

    const initialized = await service.initialize();
    const ivy = initialized.templates.find(
      (template) => template.id === ivyLeagueLebenslaufTemplateConfig.id,
    );

    expect(ivy).toMatchObject({
      id: "word-lebenslauf-ivy-league",
      name: "Ivy League",
      documentType: "lebenslauf",
      format: "docx",
      source: "system-word-template",
      category: "classic-professional",
      layout: "single-column-watercolor",
      atsFriendly: true,
      supportsPhoto: false,
      supportsBackground: true,
      supportsAtsMode: true,
      supportsPlaceholders: true,
      isSystemTemplate: true,
      isProtected: true,
    });
    expect(ivy?.previewDataUrl).toMatch(/^data:image\/png;base64,/);

    const data = {
      VORNAME: "Lena",
      NACHNAME: "Hoffmann",
      BERUFSBEZEICHNUNG: "Ingenieurin",
      FACHGEBIETE: "Maschinenbau | FEM",
      KONTAKT_ZEILE_1: "+49 30 12345678",
      KONTAKT_ZEILE_2: "lena@example.de",
      KONTAKT_ZEILE_3: "linkedin.com/in/lena",
      HEADER_KONTAKT_4: "München, Deutschland",
      HEADER_KONTAKT_5: "Geb. 01.03.1990 in München",
      HEADER_KONTAKT_6: "lena.example.com",
      ZUSAMMENFASSUNG_TITEL: "ZUSAMMENFASSUNG",
      ZUSAMMENFASSUNG: "Erfahrene Ingenieurin für sichere Systeme.",
      STAERKEN_TITEL: "STÄRKEN",
      STAERKEN_ATS: "Analysefähigkeit\nTeamführung",
      STAERKE_1_TITEL: "Analysefähigkeit",
      STAERKE_1_BESCHREIBUNG: "Präzise Bewertung komplexer Systeme.",
      ERFAHRUNG_TITEL: "ERFAHRUNG",
      BERUFSERFAHRUNG_TITEL: "BERUFSERFAHRUNG",
      UNTERNEHMEN_1: "Siemens AG",
      ARBEITSORT_1: "Berlin",
      POSITION_1: "Senior Maschinenbauingenieurin",
      STARTDATUM_1: "2019",
      DATUM_TRENNER_1: " – ",
      ENDDATUM_1: "2023",
      ERFOLG_1_1: "Projekteffizienz um 15 % gesteigert.",
      AUSBILDUNG_TITEL: "AUSBILDUNG",
      HOCHSCHULE_1: "Technische Universität München",
      AUSBILDUNG_ORT_1: "München",
      ABSCHLUSS_1: "M.Sc.",
      FACHRICHTUNG_1: "Maschinenbau",
      AUSBILDUNG_START_1: "2011",
      AUSBILDUNG_DATUM_TRENNER_1: " – ",
      AUSBILDUNG_ENDE_1: "2013",
      KENNTNISSE_TITEL: "KENNTNISSE",
      KENNTNISSE: "FEM · ANSYS",
      SPRACHEN_TITEL: "SPRACHEN",
      SPRACHEN_ATS: "Deutsch – Muttersprache",
      SPRACHE_1: "Deutsch",
      SPRACHNIVEAU_1: "Muttersprache",
      SPRACHE_1_PUNKTE: "●●●●●",
      ZERTIFIKATE_TITEL: "ZERTIFIKATE",
      ZERTIFIKATE: "TÜV Functional Safety Engineer",
      WEBSITE: "lena.example.com",
      DESIGN_PRIMARY: "#123456",
      DESIGN_ACCENT: "#F05A00",
      DESIGN_FONT: "Arial",
    };
    const targetDirectory = path.join(
      paths.dataRoot,
      "Bewerbungen",
      "IvyLeague",
      "Lebenslauf",
    );
    const visual = await service.createDocumentFromTemplate(
      ivy!.id,
      targetDirectory,
      "ignored",
      data,
    );
    const visualZip = new PizZip(await readFile(visual.filePath));
    const visualXml = visualZip.file("word/document.xml")!.asText();
    const stylesXml = visualZip.file("word/styles.xml")!.asText();
    const headerXml = visualZip.file("word/header1.xml")!.asText();

    expect(visual.fileName).toMatch(
      /^Lebenslauf_Lena_Hoffmann_\d{8}_\d{6}\.docx$/,
    );
    expect(visualXml).toContain("Senior Maschinenbauingenieurin");
    expect(visualXml).not.toContain("{{");
    expect(stylesXml).toContain('w:val="123456"');
    expect(stylesXml).toContain('w:val="F05A00"');
    expect(headerXml).toContain('behindDoc="1"');
    expect(headerXml).toContain("<w:drawing>");

    const ats = await service.createDocumentFromTemplate(
      ivy!.id,
      path.join(targetDirectory, "ATS"),
      "ignored",
      data,
      { atsMode: true },
    );
    const atsZip = new PizZip(await readFile(ats.filePath));
    const atsXml = atsZip.file("word/document.xml")!.asText();
    expect(atsXml).toContain("BERUFSERFAHRUNG");
    expect(atsXml).not.toContain("{{");
    expect(
      Object.keys(atsZip.files).some((name) =>
        /^word\/media\//.test(name),
      ),
    ).toBe(false);
  });

  it("registers Stilvoll, Einspaltig, and Klassisch with visual previews and linear ATS copies", async () => {
    paths = resolveApplicationPaths(
      root,
      path.resolve("public", "templates"),
    );
    service = new TemplateService(paths);
    await createDocx(
      path.join(
        paths.anschreibenDocuments,
        wordMusterTemplateConfig.fileName,
      ),
    );

    const initialized = await service.initialize();
    const stilvoll = initialized.templates.find(
      (template) => template.id === stilvollLebenslaufTemplateConfig.id,
    );
    const einspaltig = initialized.templates.find(
      (template) => template.id === einspaltigLebenslaufTemplateConfig.id,
    );
    const klassisch = initialized.templates.find(
      (template) => template.id === klassischLebenslaufTemplateConfig.id,
    );

    expect(stilvoll).toMatchObject({
      name: "Stilvoll",
      sortOrder: 10,
      category: "modern-professional",
      layout: "two-column-right-wide",
      supportsPhoto: true,
      supportsBackground: true,
      supportsAtsMode: true,
      isSystemTemplate: true,
      isProtected: true,
    });
    expect(einspaltig).toMatchObject({
      name: "Einspaltig",
      sortOrder: 11,
      category: "single-column",
      layout: "single-column",
      supportsPhoto: true,
      supportsBackground: true,
      supportsAtsMode: true,
      isSystemTemplate: true,
      isProtected: true,
    });
    expect(klassisch).toMatchObject({
      name: "Klassisch",
      sortOrder: 8,
      category: "classic",
      layout: "single-column-classic",
      supportsPhoto: true,
      supportsBackground: true,
      supportsAtsMode: true,
      isSystemTemplate: true,
      isProtected: true,
    });
    expect(stilvoll?.previewDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(einspaltig?.previewDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(klassisch?.previewDataUrl).toMatch(/^data:image\/png;base64,/);
    await expect(
      service.getTemplateById("word-lebenslauf-einfach"),
    ).resolves.toMatchObject({
      id: einspaltigLebenslaufTemplateConfig.id,
      name: "Einspaltig",
    });

    const onePixelPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const data = {
      VORNAME: "Lena",
      NACHNAME: "Hoffmann",
      BERUFSBEZEICHNUNG: "IT-Projektmanagerin",
      TELEFON: "+49 30 12345678",
      EMAIL: "lena@example.de",
      LINKEDIN: "linkedin.com/in/lena",
      WEBSITE: "lena.example.com",
      HEADER_KONTAKT_1: "+49 30 12345678",
      HEADER_KONTAKT_2: "lena@example.de",
      HEADER_KONTAKT_3: "linkedin.com/in/lena",
      HEADER_KONTAKT_4: "München, Deutschland",
      HEADER_KONTAKT_6: "lena.example.com",
      ORT: "München",
      ZUSAMMENFASSUNG_TITEL: "ZUSAMMENFASSUNG",
      ZUSAMMENFASSUNG:
        "Erfahrene Projektmanagerin für digitale Produkte.",
      STAERKEN_TITEL: "STÄRKEN",
      STAERKEN_ATS: "Teamführung\nProzessqualität",
      STAERKE_1_TITEL: "Teamführung",
      STAERKE_1_BESCHREIBUNG:
        "Führung interdisziplinärer Teams.",
      BERUFSERFAHRUNG_TITEL: "BERUFSERFAHRUNG",
      ERFAHRUNG_TITEL: "ERFAHRUNG",
      POSITION_1: "Senior IT-Projektmanagerin",
      UNTERNEHMEN_1: "Beispiel AG",
      STARTDATUM_1: "2019",
      DATUM_TRENNER_1: " – ",
      ENDDATUM_1: "2023",
      ARBEITSORT_1: "Berlin",
      ERFOLG_1_1: "Projektdauer um 15 % reduziert.",
      AUSBILDUNG_TITEL: "AUSBILDUNG",
      ABSCHLUSS_1: "M.Sc.",
      FACHRICHTUNG_1: "Wirtschaftsinformatik",
      HOCHSCHULE_1: "Technische Universität München",
      AUSBILDUNG_START_1: "2011",
      AUSBILDUNG_DATUM_TRENNER_1: " – ",
      AUSBILDUNG_ENDE_1: "2015",
      AUSBILDUNG_ORT_1: "München",
      KENNTNISSE_TITEL: "KENNTNISSE",
      KENNTNISSE: "Projektmanagement · Jira",
      SPRACHEN_TITEL: "SPRACHEN",
      SPRACHEN_ATS: "Deutsch – Muttersprache",
      SPRACHE_1: "Deutsch",
      SPRACHNIVEAU_1: "Muttersprache",
      SPRACHE_1_PUNKTE: "●●●●●",
      ZERTIFIKATE_TITEL: "ZERTIFIKATE",
      ZERTIFIKATE: "Professional Scrum Master I",
      PROFILFOTO: onePixelPng,
      DESIGN_PRIMARY: "#123456",
      DESIGN_ACCENT: "#4A90E2",
      DESIGN_SOFT_ACCENT: "#E6F3FA",
      DESIGN_FONT: "Arial",
    };

    for (const template of [stilvoll!, einspaltig!, klassisch!]) {
      const targetDirectory = path.join(
        paths.dataRoot,
        "Bewerbungen",
        template.name,
        "Lebenslauf",
      );
      const visual = await service.createDocumentFromTemplate(
        template.id,
        targetDirectory,
        "ignored",
        data,
      );
      const visualZip = new PizZip(await readFile(visual.filePath));
      const visualXml = visualZip.file("word/document.xml")!.asText();
      const stylesXml = visualZip.file("word/styles.xml")!.asText();
      const headerXml =
        visualZip.file("word/header1.xml")?.asText() ?? "";
      const styledXml = `${visualXml}${stylesXml}`;

      expect(visual.fileName).toMatch(
        /^Lebenslauf_Lena_Hoffmann_\d{8}_\d{6}\.docx$/,
      );
      expect(visualXml).toContain("Senior IT-Projektmanagerin");
      expect(visualXml).not.toContain("{{");
      expect(styledXml).toContain('w:val="123456"');
      expect(styledXml).toContain('w:val="4A90E2"');
      expect(headerXml).toContain('behindDoc="1"');
      expect(headerXml).toContain("<w:drawing>");
      expect(
        Object.keys(visualZip.files).some((name) =>
          /^word\/media\//.test(name),
        ),
      ).toBe(true);
      if (template.id === klassischLebenslaufTemplateConfig.id) {
        const relationships = Object.keys(visualZip.files)
          .filter((name) => /^word\/_rels\/.*\.rels$/.test(name))
          .map((name) => visualZip.file(name)?.asText() ?? "")
          .join("");
        expect(relationships).toContain("mailto:lena@example.de");
        expect(relationships).toContain("https://linkedin.com/in/lena");
        expect(relationships).toContain("https://lena.example.com");
      }

      const ats = await service.createDocumentFromTemplate(
        template.id,
        path.join(targetDirectory, "ATS"),
        "ignored",
        data,
        { atsMode: true },
      );
      const atsZip = new PizZip(await readFile(ats.filePath));
      const atsXml = atsZip.file("word/document.xml")!.asText();
      expect(atsXml).toContain(
        template.id === klassischLebenslaufTemplateConfig.id
          ? "BERUFSERFAHRUNG"
          : "Berufserfahrung",
      );
      expect(atsXml).not.toContain("{{");
      expect(atsXml).not.toContain("<w:tbl>");
      expect(atsXml).not.toContain("<w:drawing>");
      expect(
        Object.keys(atsZip.files).some((name) =>
          /^word\/media\//.test(name),
        ),
      ).toBe(false);
    }
  });

  it("invalidates the preview cache when the source modification time changes", async () => {
    const templatePath = path.join(paths.deckblattTemplates, "Cache.docx");
    await createDocx(templatePath);
    const first = await service.scanAllTemplates();
    const firstPreview = first.templates[0].previewImagePath;
    await new Promise((resolve) => setTimeout(resolve, 12));
    await createDocx(
      templatePath,
      `<w:p><w:r><w:t>Neue Version</w:t></w:r></w:p>`,
    );

    const second = await service.scanAllTemplates();

    expect(second.templates[0].previewImagePath).not.toBe(firstPreview);
    await expect(stat(second.templates[0].previewImagePath!)).resolves.toBeDefined();
  });
});
