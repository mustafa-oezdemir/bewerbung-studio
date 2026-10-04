import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { createDefaultDeckblattDocument } from "./default-deckblatt";

const widePng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNk+M/wHwAF/gL+Xb07WQAAAABJRU5ErkJggg==";

const baseData = {
  BEWERBER_NAME: "Mina Kaya",
  FIRMA_NAME: "Beispiel GmbH",
  STELLENBEZEICHNUNG: "Senior Softwareentwicklerin",
  BEWERBUNGSDATUM: "08.09.2026",
  DECKBLATT_STANDORT: "Berlin",
  DECKBLATT_KURZPROFIL: "Erfahren in skalierbaren Webplattformen.",
  DECKBLATT_DOKUMENTE:
    "Anschreiben\nLebenslauf\nArbeitszeugnis.pdf\nAWS-Zertifikat.pdf",
  DECKBLATT_KOMPETENZEN: "TypeScript\nReact\nNode.js",
  DECKBLATT_KONTAKT:
    "Adresse: Musterstraße 1, 10115 Berlin\nTelefon: +49 30 123456\nE-Mail: mina@example.com",
  BERUFSBEZEICHNUNG: "Softwareentwicklerin",
  DESIGN_PRIMARY: "#123f8c",
  DESIGN_ACCENT: "#244766",
  DESIGN_FONT: "Arial",
  PROFILFOTO: widePng,
};

const documentXml = async (filePath: string) =>
  new PizZip(await readFile(filePath)).file("word/document.xml")?.asText() ?? "";

describe("automatic default Deckblatt DOCX", () => {
  it("covers scenario A with photo, contact details, competencies and certificates", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "deckblatt-photo-"));
    try {
      const result = await createDefaultDeckblattDocument(
        root,
        "Beispiel_GmbH_08.09.2026_Deckblatt",
        baseData,
      );
      const zip = new PizZip(await readFile(result.filePath));
      const xml = zip.file("word/document.xml")?.asText() ?? "";
      expect(result.fileName).toBe("Beispiel_GmbH_08.09.2026_Deckblatt.docx");
      expect(xml).toContain("Bewerbung als Senior Softwareentwicklerin");
      expect(xml).toContain("Arbeitszeugnis.pdf");
      expect(xml).toContain("AWS-Zertifikat.pdf");
      expect(xml).toContain("Anschreiben");
      expect(xml).toContain('<w:jc w:val="both"/>');
      expect(xml).toContain('<w:gridCol w:w="3180"/>');
      expect(xml).toContain('<w:gridCol w:w="6180"/>');
      expect(xml).toContain('<w:left w:w="240" w:type="dxa"/>');
      expect(xml).toContain("mina@example.com");
      expect(xml).toContain('descr="PROFILFOTO"');
      expect(xml).toContain('<a:srcRect l="25000" t="0" r="25000" b="0"/>');
      expect(zip.file("word/media/profilfoto.png")).toBeTruthy();
      expect(xml.match(/<w:sectPr>/g)).toHaveLength(1);
      expect(xml).not.toContain('w:type="page"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("covers scenario B without leaving a photo placeholder", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "deckblatt-no-photo-"));
    try {
      const result = await createDefaultDeckblattDocument(
        root,
        "Beispiel_GmbH_08.09.2026_Deckblatt",
        { ...baseData, PROFILFOTO: "" },
      );
      const zip = new PizZip(await readFile(result.filePath));
      expect(zip.file("word/media/profilfoto.png")).toBeNull();
      expect(await documentXml(result.filePath)).not.toContain("PROFILFOTO");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("covers scenario C with the updated central date and file name", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "deckblatt-date-"));
    try {
      const result = await createDefaultDeckblattDocument(
        root,
        "Beispiel_GmbH_12.09.2026_Deckblatt",
        { ...baseData, BEWERBUNGSDATUM: "12.09.2026" },
      );
      expect(result.fileName).toBe("Beispiel_GmbH_12.09.2026_Deckblatt.docx");
      expect(await documentXml(result.filePath)).toContain("12.09.2026");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("covers scenario D by replacing an old job title during synchronization", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "deckblatt-role-"));
    try {
      const baseName = "Beispiel_GmbH_08.09.2026_Deckblatt";
      const initial = await createDefaultDeckblattDocument(root, baseName, baseData);
      await createDefaultDeckblattDocument(root, baseName, {
        ...baseData,
        STELLENBEZEICHNUNG: "Tech Lead",
      });
      const xml = await documentXml(initial.filePath);
      expect(xml).toContain("Bewerbung als Tech Lead");
      expect(xml).not.toContain("Senior Softwareentwicklerin");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing mandatory applicant data with an actionable error", async () => {
    await expect(
      createDefaultDeckblattDocument("ignored", "Deckblatt", {
        ...baseData,
        BEWERBER_NAME: "",
      }),
    ).rejects.toThrow("Name der Bewerberin oder des Bewerbers");
  });
});
