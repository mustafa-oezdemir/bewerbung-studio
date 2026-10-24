import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { documentFilePaths, documentStamps, type DocumentStampContext } from "./application-document-stamps";
import { coverLetterTemplateKeys, createDefaultCoverLetterDocument } from "./templates/default-cover-letter";
import { createDefaultDeckblattDocument, deckblattTemplateKeys } from "./templates/default-deckblatt";

const photo = `data:image/png;base64,${"iVBORw0KGgo".padEnd(4000, "A")}`;
const data = (): Record<string, string> => ({
  BEWERBER_NAME: "Erika Beispiel", FIRMA_NAME: "Fiktiv GmbH", STELLENBEZEICHNUNG: "Entwicklerin", STELLENNUMMER: "R-1",
  BEWERBUNGSDATUM: "01.10.2026", BEWERBUNGSDATUM_LANG: "1. Oktober 2026", BERUFSBEZEICHNUNG: "Softwareentwicklerin",
  DECKBLATT_KONTAKT: "Musterweg 1", DECKBLATT_KURZPROFIL: "Kurz", DECKBLATT_KOMPETENZEN: "TypeScript",
  DECKBLATT_DOKUMENTE: "Lebenslauf", DECKBLATT_STANDORT: "Berlin", DESIGN_FONT: "Arial", DESIGN_PRIMARY: "#155e58",
  DESIGN_ACCENT: "#244766", DESIGN_FONT_SIZE: "11", PROFILFOTO: photo, UNTERSCHRIFT_GRAFIK: "", UNTERSCHRIFT: "Erika Beispiel",
  ANREDE: "Sehr geehrte Damen und Herren,", BETREFF: "Bewerbung", EINLEITUNG: "Hallo", HAUPTTEXT: "Text",
  SCHLUSSTEXT: "Gruß", GRUSSFORMEL: "Mit freundlichen Grüßen", FIRMA_ADRESSE: "Hauptstraße 1", FIRMA_PLZ: "10115",
  FIRMA_ORT: "Berlin", FIRMA_ABTEILUNG: "", ANSPRECHPARTNER: "", BEWERBER_ADRESSE: "Musterweg 1", BEWERBER_PLZ: "10115",
  BEWERBER_ORT: "Berlin", BEWERBER_TELEFON: "030", BEWERBER_EMAIL: "erika@example.test", FACHLICHE_EIGNUNG: "",
  UNTERNEHMENSBEZUG: "", ZUSATZABSATZ: "", ANLAGENHINWEIS: "",
  // Lebenslauf-only values (the Word Lebenslauf reads them, Deckblatt and Anschreiben do not).
  KENNTNISSE: "Linux", POSITION_1: "Praktikum", ZERTIFIKATE: "IBM",
});

let root: string;
const context = (values = data(), changes: Partial<DocumentStampContext> = {}): DocumentStampContext => ({
  targetDirectories: { anschreiben: path.join(root, "Anschreiben"), deckblatt: path.join(root, "Deckblatt") },
  requestedBaseName: "Anschreiben_Erika_Beispiel_Fiktiv_GmbH",
  requestedBaseNames: { deckblatt: "Deckblatt_Erika_Beispiel_Fiktiv_GmbH" },
  data: values,
  ...changes,
});

/** Runs a generator on data that records which values it reads; reading the whole object counts as "everything". */
const readKeys = async (generate: (values: Record<string, string>) => Promise<unknown>) => {
  const read = new Set<string>();
  const values = new Proxy(data(), {
    get(target, key, receiver) {
      if (typeof key === "string") read.add(key);
      return Reflect.get(target, key, receiver);
    },
    ownKeys(target) {
      read.add("*");
      return Reflect.ownKeys(target);
    },
  });
  await generate(values);
  return read;
};

beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), "bm-stamps-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe("Word document stamps", () => {
  it("covers every value the default generators read (and they never read the whole data)", async () => {
    const deckblatt = await readKeys((values) => createDefaultDeckblattDocument(path.join(root, "D"), "Deckblatt", values));
    const cover = await readKeys((values) => createDefaultCoverLetterDocument(path.join(root, "A"), "Anschreiben", values));
    expect(deckblatt.has("*")).toBe(false);
    expect(cover.has("*")).toBe(false);
    // Every value a generator reads is part of its stamp (some are only read in certain cases).
    const undeclared = (read: Set<string>, declared: readonly string[]) =>
      [...read].filter((key) => /^[A-Z_]+$/.test(key) && !declared.includes(key));
    expect(undeclared(deckblatt, deckblattTemplateKeys)).toEqual([]);
    expect(undeclared(cover, coverLetterTemplateKeys)).toEqual([]);
    expect(deckblatt.size).toBeGreaterThan(5);
    expect(cover.size).toBeGreaterThan(10);
  });

  it("changes only when something the document shows changes", () => {
    const base = documentStamps(context(), null);
    expect(documentStamps(context(), null)).toEqual(base);
    // Lebenslauf content that neither document prints: no new Word file.
    expect(documentStamps(context({ ...data(), KENNTNISSE: "Kubernetes", POSITION_1: "Werkstudent", ZERTIFIKATE: "AWS" }), null)).toEqual(base);
    // A company name, a date or the photo change both or the one that shows it.
    const company = documentStamps(context({ ...data(), FIRMA_NAME: "Andere GmbH" }), null);
    expect(company.deckblatt).not.toBe(base.deckblatt);
    expect(company.anschreiben).not.toBe(base.anschreiben);
    const date = documentStamps(context({ ...data(), BEWERBUNGSDATUM: "02.10.2026" }), null);
    expect(date.deckblatt).not.toBe(base.deckblatt);
    expect(date.anschreiben).not.toBe(base.anschreiben);
    const newPhoto = documentStamps(context({ ...data(), PROFILFOTO: `${photo}B` }), null);
    expect(newPhoto.deckblatt).not.toBe(base.deckblatt);
    expect(newPhoto.anschreiben).toBe(base.anschreiben);
    const introduction = documentStamps(context({ ...data(), EINLEITUNG: "Neu" }), null);
    expect(introduction).toEqual({ deckblatt: base.deckblatt, anschreiben: expect.not.stringMatching(base.anschreiben) });
    // A renamed folder or file name is a new document.
    const renamed = documentStamps(context(data(), { requestedBaseNames: { deckblatt: "Deckblatt_Neu" } }), null);
    expect(renamed.deckblatt).not.toBe(base.deckblatt);
    const moved = documentStamps(context(data(), { targetDirectories: { anschreiben: path.join(root, "X"), deckblatt: path.join(root, "Deckblatt") } }), null);
    expect(moved).toEqual({ deckblatt: base.deckblatt, anschreiben: expect.not.stringMatching(base.anschreiben) });
  });

  it("follows every value and the template file when the Anschreiben comes from the personal Word-Muster", () => {
    const template = { id: "word-muster", filePath: path.join(root, "Muster.docx"), extension: ".docx", modifiedAt: "2026-10-01T10:00:00.000Z", fileSize: 1000 };
    const base = documentStamps(context(), template);
    expect(base.anschreiben).not.toBe(documentStamps(context(), null).anschreiben);
    // The Muster may print any placeholder.
    expect(documentStamps(context({ ...data(), KENNTNISSE: "Kubernetes" }), template).anschreiben).not.toBe(base.anschreiben);
    // A replaced Muster file is a new document; the Deckblatt does not depend on it.
    const replaced = documentStamps(context(), { ...template, modifiedAt: "2026-10-02T10:00:00.000Z" });
    expect(replaced.anschreiben).not.toBe(base.anschreiben);
    expect(replaced.deckblatt).toBe(base.deckblatt);
  });

  it("names the files the generators write", async () => {
    const values = context();
    const written = await Promise.all([
      createDefaultDeckblattDocument(values.targetDirectories.deckblatt, values.requestedBaseNames.deckblatt, data()),
      createDefaultCoverLetterDocument(values.targetDirectories.anschreiben, values.requestedBaseName, data()),
    ]);
    expect(documentFilePaths(values, null)).toEqual({ deckblatt: written[0].filePath, anschreiben: written[1].filePath });
    expect(documentFilePaths(values, { id: "m", filePath: "x.doc", extension: ".doc", fileSize: 1 }).anschreiben)
      .toBe(written[1].filePath.replace(/\.docx$/, ".doc"));
  });
});
