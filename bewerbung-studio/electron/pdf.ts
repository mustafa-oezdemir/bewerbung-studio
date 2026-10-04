import { PDFDocument } from "pdf-lib";

export type PdfAddition = {
  fileName: string;
  bytes: Uint8Array;
};

const appendPages = async (
  target: PDFDocument,
  sourceBytes: Uint8Array,
  label: string,
) => {
  try {
    const source = await PDFDocument.load(sourceBytes);
    const pages = await target.copyPages(source, source.getPageIndices());
    pages.forEach((page) => target.addPage(page));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler";
    throw new Error(`PDF „${label}“ konnte nicht verarbeitet werden: ${detail}`);
  }
};

export const mergePdfDocuments = async (
  generatedDocument: Uint8Array,
  additions: PdfAddition[],
) => {
  const merged = await PDFDocument.create();
  await appendPages(merged, generatedDocument, "Bewerbungsunterlagen");
  for (const addition of additions) {
    await appendPages(merged, addition.bytes, addition.fileName);
  }
  return merged.save();
};
