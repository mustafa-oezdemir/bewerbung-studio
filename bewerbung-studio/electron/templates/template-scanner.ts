import { readdir, readFile } from "../security/secure-fs";
import path from "node:path";
import type { ApplicationPaths } from "../../src/config/application-paths";
import {
  gepflegtLebenslaufTemplateConfig,
  kompaktLebenslaufTemplateConfig,
  kreativLebenslaufTemplateConfig,
  maximumTemplateFileSize,
  modernLebenslaufTemplateConfig,
  zeitgenoessischLebenslaufTemplateConfig,
  wordMusterTemplateConfig,
} from "../../src/features/templates/template.constants";
import type {
  DocumentTemplate,
  TemplateDocumentType,
  TemplateMetadata,
  TemplateSource,
} from "../../src/features/templates/template.types";
import { mapTemplateFile } from "./template-mapper";
import {
  getTemplateExtension,
  validateTemplateFile,
  withOneDriveRetry,
} from "./template-validator";

type ScanLocation = {
  root: string;
  documentType: TemplateDocumentType;
  source: TemplateSource;
};

const metadataPathFor = (filePath: string) =>
  `${filePath.slice(0, -path.extname(filePath).length)}.template.json`;

const readMetadata = async (filePath: string): Promise<TemplateMetadata> => {
  try {
    const raw: unknown = JSON.parse(
      await readFile(metadataPathFor(filePath), "utf8"),
    );
    if (!raw || typeof raw !== "object") return {};
    const value = raw as Record<string, unknown>;
    return {
      id: typeof value.id === "string" ? value.id : undefined,
      name: typeof value.name === "string" ? value.name : undefined,
      documentType:
        value.documentType === "anschreiben" ||
        value.documentType === "deckblatt" ||
        value.documentType === "lebenslauf"
          ? value.documentType
          : undefined,
      format:
        value.format === "docx" ||
        value.format === "dotx" ||
        value.format === "doc"
          ? value.format
          : undefined,
      source:
        value.source === "muster-folder" ||
        value.source === "existing-document" ||
        value.source === "uploaded-word-template" ||
        value.source === "system-word-template"
          ? value.source
          : undefined,
      sortOrder:
        typeof value.sortOrder === "number" &&
        Number.isFinite(value.sortOrder)
          ? value.sortOrder
          : undefined,
      description:
        typeof value.description === "string"
          ? value.description
          : undefined,
      tags: Array.isArray(value.tags)
        ? value.tags.filter((tag): tag is string => typeof tag === "string")
        : undefined,
      isFavorite:
        typeof value.isFavorite === "boolean"
          ? value.isFavorite
          : undefined,
      isSystemTemplate:
        typeof value.isSystemTemplate === "boolean"
          ? value.isSystemTemplate
          : undefined,
      supportsPreview:
        typeof value.supportsPreview === "boolean"
          ? value.supportsPreview
          : undefined,
      supportsPlaceholders:
        typeof value.supportsPlaceholders === "boolean"
          ? value.supportsPlaceholders
          : undefined,
      editableInWord:
        typeof value.editableInWord === "boolean"
          ? value.editableInWord
          : undefined,
      isProtected:
        typeof value.isProtected === "boolean"
          ? value.isProtected
          : undefined,
      category:
        typeof value.category === "string"
          ? value.category
          : undefined,
      layout:
        typeof value.layout === "string"
          ? value.layout
          : undefined,
      atsFriendly:
        typeof value.atsFriendly === "boolean"
          ? value.atsFriendly
          : undefined,
      supportsPhoto:
        typeof value.supportsPhoto === "boolean"
          ? value.supportsPhoto
          : undefined,
      supportsBackground:
        typeof value.supportsBackground === "boolean"
          ? value.supportsBackground
          : undefined,
      supportsAtsMode:
        typeof value.supportsAtsMode === "boolean"
          ? value.supportsAtsMode
          : undefined,
      emphasis:
        typeof value.emphasis === "string"
          ? value.emphasis
          : undefined,
    };
  } catch {
    return {};
  }
};

const listFilesRecursive = async (root: string) => {
  const result: string[] = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop()!;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(candidate);
      if (entry.isFile()) result.push(candidate);
    }
  }
  return result;
};

const sortTemplates = (templates: DocumentTemplate[]) => {
  return [...templates].sort((left, right) =>
    left.name.localeCompare(right.name, "de", { sensitivity: "base" }),
  );
};

export class TemplateScanner {
  constructor(private readonly paths: ApplicationPaths) {}

  private locations(): ScanLocation[] {
    return [
      {
        root: this.paths.anschreibenTemplates,
        documentType: "anschreiben",
        source: "muster-folder",
      },
      {
        root: this.paths.deckblattTemplates,
        documentType: "deckblatt",
        source: "muster-folder",
      },
      {
        root: this.paths.lebenslaufTemplates,
        documentType: "lebenslauf",
        source: "muster-folder",
      },
      {
        root: this.paths.anschreibenDocuments,
        documentType: "anschreiben",
        source: "existing-document",
      },
    ];
  }

  async scanAllTemplates() {
    const templates: DocumentTemplate[] = [];
    const warnings: string[] = [];
    for (const location of this.locations()) {
      let files: string[] = [];
      try {
        files = await withOneDriveRetry(() =>
          listFilesRecursive(location.root),
        );
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `${path.basename(location.root)}: ${error.message}`
            : `${path.basename(location.root)} konnte nicht gelesen werden.`,
        );
        continue;
      }
      for (const filePath of files) {
        let extension;
        try {
          extension = getTemplateExtension(filePath);
        } catch {
          continue;
        }
        try {
          const info = await withOneDriveRetry(() =>
            validateTemplateFile(this.paths, filePath),
          );
          if (info.size > maximumTemplateFileSize) continue;
          templates.push(
            mapTemplateFile({
              filePath,
              extension,
              documentType: location.documentType,
              source: location.source,
              fileSize: info.size,
              createdAt: info.birthtime.toISOString(),
              modifiedAt: info.mtime.toISOString(),
              metadata: await readMetadata(filePath),
            }),
          );
        } catch (error) {
          warnings.push(
            error instanceof Error
              ? `${path.basename(filePath)}: ${error.message}`
              : `${path.basename(filePath)} konnte nicht gelesen werden.`,
          );
        }
      }
    }
    return {
      templates: sortTemplates(templates),
      warnings,
    };
  }

  async scanTemplatesByType(documentType: TemplateDocumentType) {
    const result = await this.scanAllTemplates();
    return result.templates.filter(
      (template) => template.documentType === documentType,
    );
  }

  async scanExistingAnschreiben() {
    const result = await this.scanAllTemplates();
    return result.templates.filter(
      (template) => template.source === "existing-document",
    );
  }
}

export { metadataPathFor, sortTemplates };
