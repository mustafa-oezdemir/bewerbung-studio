import { createHash } from "node:crypto";
import path from "node:path";
import type {
  DocumentTemplate,
  TemplateDocumentType,
  TemplateExtension,
  TemplateMetadata,
  TemplateSource,
} from "../../src/features/templates/template.types";
import { defaultTemplateSortOrder } from "../../src/features/templates/template.constants";

export const createTemplateId = (filePath: string) =>
  createHash("sha256")
    .update(path.resolve(filePath).toLocaleLowerCase("de-DE"))
    .digest("hex");

export const mapTemplateFile = ({
  filePath,
  extension,
  documentType,
  source,
  fileSize,
  createdAt,
  modifiedAt,
  metadata,
}: {
  filePath: string;
  extension: TemplateExtension;
  documentType: TemplateDocumentType;
  source: TemplateSource;
  fileSize: number;
  createdAt?: string;
  modifiedAt?: string;
  metadata: TemplateMetadata;
}): DocumentTemplate => {
  const fileName = path.basename(filePath);
  const fallbackName = path
    .basename(filePath, extension)
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  return {
    id: metadata.id?.trim() || createTemplateId(filePath),
    name: metadata.name?.trim() || fallbackName,
    fileName,
    filePath,
    extension,
    format:
      metadata.format ??
      (extension.slice(1) as DocumentTemplate["format"]),
    documentType: metadata.documentType ?? documentType,
    source: metadata.source ?? source,
    sortOrder: metadata.sortOrder ?? defaultTemplateSortOrder,
    createdAt,
    modifiedAt,
    fileSize,
    description: metadata.description?.trim() || undefined,
    tags: Array.from(
      new Set((metadata.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
    ),
    isFavorite: metadata.isFavorite ?? false,
    isSystemTemplate: metadata.isSystemTemplate ?? false,
    supportsPreview: metadata.supportsPreview ?? true,
    supportsPlaceholders:
      metadata.supportsPlaceholders ?? extension !== ".doc",
    editableInWord: metadata.editableInWord ?? true,
    isProtected: metadata.isProtected ?? false,
    category: metadata.category?.trim() || undefined,
    layout: metadata.layout?.trim() || undefined,
    atsFriendly: metadata.atsFriendly ?? false,
    supportsPhoto: metadata.supportsPhoto ?? false,
    supportsBackground: metadata.supportsBackground ?? false,
    supportsAtsMode: metadata.supportsAtsMode ?? false,
    emphasis: metadata.emphasis?.trim() || undefined,
  };
};
