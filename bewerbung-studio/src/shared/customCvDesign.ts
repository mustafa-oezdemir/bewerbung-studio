import type { CustomCvDesign } from "./schema";
import type { DocumentDesignDraft } from "./documentEditorState";

export const createCustomCvDesign = (
  name: string,
  draft: DocumentDesignDraft,
  now = new Date().toISOString(),
): CustomCvDesign => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  baseTemplateId: draft.templateId,
  accentColor: draft.accentColor,
  secondaryColor: draft.secondaryColor,
  settings: structuredClone(draft.settings),
  createdAt: now,
  updatedAt: now,
});

export const applyCustomCvDesign = (
  design: CustomCvDesign,
  current: DocumentDesignDraft,
): DocumentDesignDraft => ({
  ...current,
  templateId: design.baseTemplateId,
  accentColor: design.accentColor,
  secondaryColor: design.secondaryColor,
  settings: structuredClone(design.settings),
});

export const updateCustomCvDesign = (
  design: CustomCvDesign,
  name: string,
  draft: DocumentDesignDraft,
  now = new Date().toISOString(),
): CustomCvDesign => ({
  ...design,
  name: name.trim(),
  baseTemplateId: draft.templateId,
  accentColor: draft.accentColor,
  secondaryColor: draft.secondaryColor,
  settings: structuredClone(draft.settings),
  updatedAt: now,
});

export const duplicateCustomCvDesign = (design: CustomCvDesign, now = new Date().toISOString()): CustomCvDesign => ({
  ...structuredClone(design),
  id: crypto.randomUUID(),
  name: `${design.name} (Kopie)`,
  createdAt: now,
  updatedAt: now,
});
