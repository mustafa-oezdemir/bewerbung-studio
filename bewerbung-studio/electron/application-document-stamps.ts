import { createHash } from "node:crypto";
import path from "node:path";
import { coverLetterTemplateKeys } from "./templates/default-cover-letter";
import { deckblattTemplateKeys } from "./templates/default-deckblatt";
import { sanitizeSynchronizedDocumentFileName } from "./templates/template-filename.service";

/** What the Deckblatt and the Anschreiben of one Bewerbung are made from (`DataStore.getTemplateDocumentContext`). */
export type DocumentStampContext = {
  targetDirectories: { anschreiben: string; deckblatt: string };
  requestedBaseName: string;
  requestedBaseNames: { deckblatt: string };
  data: Record<string, string>;
};

/** The personal Word-Muster for the Anschreiben, when the user has one (it can read every placeholder). */
export type CoverLetterTemplateStamp = {
  id: string;
  filePath: string;
  extension: string;
  modifiedAt?: string;
  fileSize: number;
} | null;

export type ApplicationDocumentKind = "deckblatt" | "anschreiben";
export type DocumentStamps = Record<ApplicationDocumentKind, string>;

// Photo and signature are data URLs of several hundred kB: they enter a stamp as their hash, computed once.
const largeValueDigests = new Map<string, string>();
const digestOf = (value: string) => {
  let digest = largeValueDigests.get(value);
  if (!digest) {
    if (largeValueDigests.size >= 16) largeValueDigests.clear();
    digest = `sha256:${createHash("sha256").update(value).digest("hex")}`;
    largeValueDigests.set(value, digest);
  }
  return digest;
};
const compact = (_key: string, value: unknown) => (typeof value === "string" && value.length > 1024 ? digestOf(value) : value);
const stampOf = (parts: unknown) => createHash("sha256").update(JSON.stringify(parts, compact)).digest("hex");
const pick = (data: Record<string, string>, keys: readonly string[]) => keys.map((key) => data[key] ?? "");

/**
 * A fingerprint of everything one Word document depends on: its folder and file name, the data its generator reads
 * and, for an Anschreiben from the personal Word-Muster, that template file. Equal stamps produce the same document,
 * so it is not generated (and written, and committed) again.
 */
export const documentStamps = (context: DocumentStampContext, coverTemplate: CoverLetterTemplateStamp): DocumentStamps => ({
  deckblatt: stampOf([
    context.targetDirectories.deckblatt, context.requestedBaseNames.deckblatt, pick(context.data, deckblattTemplateKeys),
  ]),
  anschreiben: stampOf([
    context.targetDirectories.anschreiben, context.requestedBaseName,
    coverTemplate
      ? [coverTemplate.id, coverTemplate.filePath, coverTemplate.modifiedAt ?? "", coverTemplate.fileSize, context.data]
      : pick(context.data, coverLetterTemplateKeys),
  ]),
});

/** The files the generators write (the same names as `createDefault*Document` and the Word-Muster synchronisation). */
export const documentFilePaths = (
  context: DocumentStampContext,
  coverTemplate: CoverLetterTemplateStamp,
): Record<ApplicationDocumentKind, string> => ({
  deckblatt: path.join(
    context.targetDirectories.deckblatt,
    `${sanitizeSynchronizedDocumentFileName(context.requestedBaseNames.deckblatt)}.docx`,
  ),
  anschreiben: path.join(
    context.targetDirectories.anschreiben,
    `${sanitizeSynchronizedDocumentFileName(context.requestedBaseName)}${coverTemplate?.extension === ".doc" ? ".doc" : ".docx"}`,
  ),
});
