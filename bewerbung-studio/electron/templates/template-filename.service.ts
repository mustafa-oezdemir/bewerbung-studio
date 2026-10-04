import { access } from "node:fs/promises";
import path from "node:path";
import type { TemplateExtension } from "../../src/features/templates/template.types";

export const sanitizeTemplateFileName = (value: string) =>
  value
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 100) || "Vorlage";

export const sanitizeSynchronizedDocumentFileName = (value: string) =>
  value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 100) || "Dokument";

export const templateTimestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
};

export const createUniqueFilePath = async (
  directory: string,
  requestedBaseName: string,
  extension: TemplateExtension,
) => {
  const baseName = sanitizeTemplateFileName(requestedBaseName);
  const initial = path.join(directory, `${baseName}${extension}`);
  try {
    await access(initial);
  } catch {
    return initial;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = path.join(
      directory,
      `${baseName}_Kopie_${index}${extension}`,
    );
    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }
  return path.join(
    directory,
    `${baseName}_${templateTimestamp()}${extension}`,
  );
};
