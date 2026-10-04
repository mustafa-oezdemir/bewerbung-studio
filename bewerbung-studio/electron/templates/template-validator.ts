import { stat } from "node:fs/promises";
import path from "node:path";
import type { ApplicationPaths } from "../../src/config/application-paths";
import {
  allowedTemplateExtensions,
  maximumTemplateFileSize,
} from "../../src/features/templates/template.constants";
import type { TemplateExtension } from "../../src/features/templates/template.types";
import { TemplateError, toTemplateError } from "../../src/features/templates/template.errors";

export const getTemplateExtension = (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase() as TemplateExtension;
  if (!allowedTemplateExtensions.has(extension)) {
    throw new TemplateError(
      "Dieses Dateiformat wird nicht als Word-Vorlage unterstützt.",
      "INVALID_FORMAT",
    );
  }
  return extension;
};

export const isPathInside = (root: string, candidate: string) => {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  return (
    resolvedCandidate === resolvedRoot ||
    resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)
  );
};

export const assertAllowedTemplatePath = (
  paths: ApplicationPaths,
  filePath: string,
) => {
  const allowedRoots = [
    paths.anschreibenTemplates,
    paths.deckblattTemplates,
    paths.lebenslaufTemplates,
    paths.anschreibenDocuments,
    paths.systemTemplateCache,
  ];
  if (!allowedRoots.some((root) => isPathInside(root, filePath))) {
    throw new TemplateError("Ungültiger Vorlagenpfad.", "INVALID_PATH");
  }
  getTemplateExtension(filePath);
};

export const validateTemplateFile = async (
  paths: ApplicationPaths,
  filePath: string,
) => {
  assertAllowedTemplatePath(paths, filePath);
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new TemplateError("Die Vorlage ist keine Datei.", "INVALID_FORMAT");
  }
  if (info.size > maximumTemplateFileSize) {
    throw new TemplateError(
      "Die Vorlage darf höchstens 25 MB groß sein.",
      "FILE_TOO_LARGE",
    );
  }
  return info;
};

export const withOneDriveRetry = async <T>(
  action: () => Promise<T>,
  attempts = 3,
) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (!["EBUSY", "EPERM", "EACCES", "EIO", "ENODATA"].includes(code)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  throw toTemplateError(lastError);
};
