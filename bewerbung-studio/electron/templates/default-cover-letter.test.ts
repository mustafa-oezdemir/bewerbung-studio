import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { createDefaultCoverLetterDocument } from "./default-cover-letter";

const baseData = (): Record<string, string> => ({
  BEWERBER_NAME: "Max Mustermann",
  BEWERBER_ADRESSE: "Musterstraße 12",
  BEWERBER_PLZ: "10115",
  BEWERBER_ORT: "Berlin",
  BEWERBER_TELEFON: "+49 30 123456",
  BEWERBER_EMAIL: "max@example.com",
  BEWERBER_WEBSITE: "max.example.com",
  FIRMA_NAME: "Beispiel Technologie und Infrastruktur GmbH",
  ANSPRECHPARTNER: "Frau Anna Müller",
  FIRMA_ABTEILUNG: "Personalentwicklung",
  FIRMA_ADRESSE: "Unternehmensweg 99",
  FIRMA_PLZ: "60311",
  FIRMA_ORT: "Frankfurt am Main",
  BEWERBUNGSDATUM: "08.09.2026",
  BEWERBUNGSDATUM_LANG: "8. September 2026",
  BERUFSBEZEICHNUNG: "Softwareentwickler / Fachinformatiker für Anwendungsentwicklung",
  BETREFF: "Bewerbung als Senior Softwareentwickler",
  STELLENNUMMER: "REF-2026-4711",
  ANREDE: "Sehr geehrte Frau Müller,",
  EINLEITUNG: "Ihre ausgeschriebene Position verbindet Verantwortung und Gestaltungsspielraum.",
  MOTIVATION: "Diese Aufgabe motiviert mich besonders, weil ich tragfähige digitale Lösungen entwickeln möchte.",
  FACHLICHE_EIGNUNG: "Meine Erfahrung mit TypeScript und verteilten Systemen passt zu den beschriebenen Anforderungen.",
  ZUSATZABSATZ: "Komplexe Vorhaben strukturiere ich nachvollziehbar und setze sie zuverlässig um.",
  UNTERNEHMENSBEZUG: "Ihr langfristiger Infrastrukturansatz und die interdisziplinäre Zusammenarbeit überzeugen mich.",
  SCHLUSSTEXT: "Gerne erläutere ich Ihnen meinen möglichen Beitrag in einem persönlichen Gespräch.",
  GRUSSFORMEL: "Mit freundlichen Grüßen,",
  UNTERSCHRIFT: "Max Mustermann",
  UNTERSCHRIFT_GRAFIK: "",
  ANLAGENHINWEIS: "",
});

const readParts = async (filePath: string) => {
  const zip = new PizZip(await readFile(filePath));
  return {
    zip,
    documentXml: zip.file("word/document.xml")!.asText(),
    stylesXml: zip.file("word/styles.xml")!.asText(),
  };
};

describe("default cover-letter document", () => {
  it.each([["small", 20], ["medium", 22], ["large", 24]] as const)("uses the shared %s size for body and subject in Word", async (size, halfPoints) => {
    const root = await mkdtemp(path.join(tmpdir(), "fallback-cover-letter-size-"));
    try {
      const result = await createDefaultCoverLetterDocument(root, "Anschreiben", { ...baseData(), DESIGN_FONT_SIZE: size });
      const { documentXml, stylesXml } = await readParts(result.filePath);
      const subject = documentXml.match(/<w:pStyle w:val="ApplicationSubject"\/>[\s\S]*?<\/w:p>/)?.[0];
      const body = documentXml.match(/<w:pStyle w:val="ApplicationBody"\/>[\s\S]*?<\/w:p>/)?.[0];
      expect(subject).toContain(`<w:sz w:val="${halfPoints}"/>`);
      expect(body).toContain(`<w:sz w:val="${halfPoints}"/>`);
      expect(stylesXml).toContain(`<w:sz w:val="${halfPoints}"/>`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates a DIN-oriented, editable one-page DOCX from central data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fallback-cover-letter-"));
    try {
      const result = await createDefaultCoverLetterDocument(
        root,
        "Beispiel_Technologie_08.09.2026_Anschreiben",
        baseData(),
      );
      expect(result.fileName).toBe(
        "Beispiel_Technologie_08.09.2026_Anschreiben.docx",
      );
      const { documentXml, stylesXml } = await readParts(result.filePath);
      expect(documentXml).toContain("Berlin, den 8. September 2026");
      expect(documentXml).toContain("Beispiel Technologie und Infrastruktur GmbH");
      expect(documentXml).toContain("Personalentwicklung");
      expect(documentXml).toContain(
        "Bewerbung als Senior Softwareentwickler - Referenz REF-2026-4711",
      );
      expect(documentXml).toContain('w:pgSz w:w="11906" w:h="16838"');
      expect(documentXml).toContain('w:pgMar w:top="680" w:right="1134" w:bottom="1417" w:left="1134"');
      expect(documentXml.match(/<w:sectPr>/g)).toHaveLength(1);
      expect(documentXml.match(/<w:tbl>/g)).toHaveLength(2);
      expect(documentXml).toContain('<w:jc w:val="center"/>');
      expect(documentXml).toContain(
        '<w:bottom w:val="single" w:sz="18" w:space="1" w:color="123F8C"/>',
      );
      expect(documentXml).toContain(
        "Musterstraße 12 | 10115 Berlin | max@example.com | +49 30 123456",
      );
      expect(documentXml).not.toContain("max.example.com");
      expect(documentXml).not.toContain("w:type=\"page\"");
      expect(documentXml).not.toContain("Betreff:");
      expect(documentXml).toContain(
        '<w:pStyle w:val="ApplicationBody"/><w:spacing',
      );
      expect(documentXml).toContain('<w:jc w:val="both"/>');
      expect(documentXml).not.toContain("Mit freundlichen Grüßen,");
      expect(documentXml.indexOf("UNTERNEHMENSBEZUG")).toBe(-1);
      expect(documentXml.indexOf("Ihr langfristiger Infrastrukturansatz")).toBeLessThan(
        documentXml.indexOf("Gerne erläutere ich Ihnen"),
      );
      for (const style of [
        "ApplicationSender",
        "ApplicationRecipient",
        "ApplicationSubject",
        "ApplicationSalutation",
        "ApplicationBody",
        "ApplicationGreeting",
      ]) {
        expect(stylesXml).toContain(`w:styleId="${style}"`);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("omits unavailable optional recipient, reference, signature and attachment data", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fallback-cover-letter-"));
    try {
      const data = baseData();
      data.ANSPRECHPARTNER = "";
      data.FIRMA_ABTEILUNG = "";
      data.STELLENNUMMER = "";
      data.UNTERSCHRIFT_GRAFIK = "";
      data.ANLAGENHINWEIS = "";
      data.ANREDE = "Sehr geehrte Damen und Herren,";
      data.BEWERBER_PLZ = "";
      const result = await createDefaultCoverLetterDocument(root, "Anschreiben", data);
      const { documentXml, zip } = await readParts(result.filePath);
      expect(documentXml).toContain("Sehr geehrte Damen und Herren,");
      expect(documentXml).not.toContain("Kennziffer:");
      expect(documentXml).not.toContain("ApplicationAttachments");
      expect(documentXml).not.toContain("ApplicationReturnAddress");
      expect(zip.file("word/media/unterschrift.png")).toBeNull();
      expect(documentXml).not.toContain("{{");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("embeds an optional signature proportionally and an explicit attachment note", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fallback-cover-letter-"));
    try {
      const data = baseData();
      data.UNTERSCHRIFT_GRAFIK =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAADUlEQVR42mNk+M/wHwAEAQH/8p3L5QAAAABJRU5ErkJggg==";
      data.ANLAGENHINWEIS = "Anlagen";
      const result = await createDefaultCoverLetterDocument(root, "Anschreiben", data);
      const { documentXml, zip } = await readParts(result.filePath);
      expect(zip.file("word/media/unterschrift.png")).not.toBeNull();
      const extent = documentXml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
      expect(extent).not.toBeNull();
      expect(Number(extent![1]) / Number(extent![2])).toBeCloseTo(2, 3);
      expect(documentXml).toContain("Anlagen");
      expect(documentXml.indexOf("Mit freundlichen Grüßen")).toBeLessThan(
        documentXml.indexOf("UNTERSCHRIFT_GRAFIK"),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps long body text at 11 pt without inserting a page break", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fallback-cover-letter-"));
    try {
      const data = baseData();
      data.MOTIVATION = "Motivation und belastbare Umsetzung. ".repeat(40);
      data.FACHLICHE_EIGNUNG = "Fachliche Erfahrung und messbare Ergebnisse. ".repeat(35);
      const result = await createDefaultCoverLetterDocument(root, "Anschreiben", data);
      const { documentXml } = await readParts(result.filePath);
      expect(documentXml).toContain('w:sz w:val="22"');
      expect(documentXml).not.toContain('w:type="page"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
