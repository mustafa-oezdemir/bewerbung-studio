import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { mergePdfDocuments } from "./pdf";

const createPdf = async (pages: number) => {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) {
    document.addPage([595, 842]);
  }
  return document.save();
};

describe("Bewerbungsmappe PDF merge", () => {
  it("keeps the generated documents first and appends attachments", async () => {
    const generated = await createPdf(3);
    const certificate = await createPdf(2);
    const certification = await createPdf(1);
    const result = await mergePdfDocuments(generated, [
      { fileName: "Arbeitszeugnis.pdf", bytes: certificate },
      { fileName: "Zertifikat.pdf", bytes: certification },
    ]);
    const merged = await PDFDocument.load(result);
    expect(merged.getPageCount()).toBe(6);
  });

  it("reports a readable error for invalid attachments", async () => {
    const generated = await createPdf(1);
    await expect(
      mergePdfDocuments(generated, [
        {
          fileName: "Defekt.pdf",
          bytes: new TextEncoder().encode("not a pdf"),
        },
      ]),
    ).rejects.toThrow("Defekt.pdf");
  });
});
