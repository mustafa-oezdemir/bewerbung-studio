export const templateDocumentTypes = [
  "anschreiben",
  "deckblatt",
  "lebenslauf",
] as const;

export const templateSources = [
  "muster-folder",
  "existing-document",
  "uploaded-word-template",
  "system-word-template",
] as const;

export const templateExtensions = [".docx", ".dotx", ".doc"] as const;
export const templateFormats = ["docx", "dotx", "doc"] as const;

export type TemplateDocumentType = (typeof templateDocumentTypes)[number];
export type TemplateSource = (typeof templateSources)[number];
export type TemplateExtension = (typeof templateExtensions)[number];
export type TemplateFormat = (typeof templateFormats)[number];

export interface DocumentTemplate {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  extension: TemplateExtension;
  format: TemplateFormat;
  documentType: TemplateDocumentType;
  source: TemplateSource;
  sortOrder: number;
  createdAt?: string;
  modifiedAt?: string;
  fileSize: number;
  previewImagePath?: string;
  previewDataUrl?: string;
  description?: string;
  tags: string[];
  isFavorite: boolean;
  isSystemTemplate: boolean;
  supportsPreview: boolean;
  supportsPlaceholders: boolean;
  editableInWord: boolean;
  isProtected: boolean;
  category?: string;
  layout?: string;
  atsFriendly: boolean;
  supportsPhoto: boolean;
  supportsBackground: boolean;
  supportsAtsMode: boolean;
  emphasis?: string;
}

export interface CreatedDocumentResult {
  templateId: string;
  fileName: string;
  filePath: string;
  extension: TemplateExtension;
  replacedPlaceholders: string[];
  warning?: string;
}

export interface TemplateScanResult {
  templates: DocumentTemplate[];
  scannedAt: string;
  warnings: string[];
}

export interface AddTemplateInput {
  documentType: TemplateDocumentType;
  requestedName?: string;
}

export interface UseTemplateInput {
  templateId: string;
  applicationId: string;
  atsMode?: boolean;
}

export interface TemplateMetadata {
  id?: string;
  name?: string;
  documentType?: TemplateDocumentType;
  format?: TemplateFormat;
  source?: TemplateSource;
  sortOrder?: number;
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
  isSystemTemplate?: boolean;
  supportsPreview?: boolean;
  supportsPlaceholders?: boolean;
  editableInWord?: boolean;
  isProtected?: boolean;
  category?: string;
  layout?: string;
  atsFriendly?: boolean;
  supportsPhoto?: boolean;
  supportsBackground?: boolean;
  supportsAtsMode?: boolean;
  emphasis?: string;
}
