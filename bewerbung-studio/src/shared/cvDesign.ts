import { defaultDocumentDesign, getDocumentFont, type DocumentDesignSettings } from "./documentDesign";
import { cvDesignOverridesSchema, type CvDesignOverrides, type CvDesignTokens, type NativeResumeDesign } from "./cvDesignSchema";
import { legacyGenericDesign } from "./cvTemplateDefaults/legacyGeneric.defaults";
import { nativeResumeDesigns } from "./cvTemplateTokens";
import type { NativeResumeAppearance } from "./resumeAppearance";
import { getTemplate } from "./templates";

/** Fresh values on every call: callers must never mutate registry defaults. */
export const getTemplateDocumentDesignDefaults = (templateId: string): DocumentDesignSettings => ({
  ...defaultDocumentDesign,
  ...getTemplate(templateId).designDefaults,
});

const definedFields = <T extends object>(fields: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(fields ?? {}).filter(([, value]) => value !== undefined)) as Partial<T>;

const mergeTokens = (base: CvDesignTokens, changes: CvDesignOverrides): CvDesignTokens => ({
  colors: { ...base.colors, ...definedFields(changes.colors) },
  typography: { ...base.typography, ...definedFields(changes.typography) },
  spacing: { ...base.spacing, ...definedFields(changes.spacing) },
});

/**
 * A template's own design: complete, typed and always a fresh copy, so callers can never mutate the registry.
 * Retired templates that only the generic renderer draws derive theirs from their document settings.
 */
export const getNativeResumeDesign = (templateId: string): NativeResumeDesign => {
  const template = getTemplate(templateId);
  return structuredClone(nativeResumeDesigns[template.id] ?? legacyGenericDesign(
    getTemplateDocumentDesignDefaults(template.id), template.accent, template.secondary, template.layout === "centered"));
};

export const resolveTemplateCvDesign = (templateId: string): CvDesignTokens => getNativeResumeDesign(templateId).tokens;

/** The appearance controls' native values of a template (alignment, dividers, sidebar colours, photo shape ...). */
export const resolveTemplateResumeAppearance = (templateId: string): NativeResumeAppearance =>
  getNativeResumeDesign(templateId).appearance;

/** Validation keeps CSS injection and unsafe physical dimensions out of both renderers. */
export const resolveCvDesign = (templateId: string, overrides: CvDesignOverrides = {}): CvDesignTokens =>
  mergeTokens(resolveTemplateCvDesign(templateId), cvDesignOverridesSchema.parse(overrides));

/**
 * Remove inherited values before persistence; an empty result is a complete reset. `inherited` is what the document
 * inherits when it has no override of its own: the template's native design, or that design with the shared
 * Lebenslauf layer on top.
 */
export const compactCvDesignOverrides = (
  templateId: string,
  overrides: CvDesignOverrides,
  inherited?: CvDesignTokens,
): CvDesignOverrides => {
  const parsed = cvDesignOverridesSchema.parse(overrides);
  const defaults = inherited ?? resolveTemplateCvDesign(templateId);
  return Object.fromEntries(Object.entries(parsed).flatMap(([group, fields]) => {
    if (!fields) return [];
    const base = defaults[group as keyof CvDesignTokens];
    const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => {
      const current = base[key as keyof typeof base];
      return value !== undefined && (group === "colors"
        ? String(value).toLowerCase() !== String(current).toLowerCase()
        : value !== current);
    }));
    return Object.keys(changed).length ? [[group, changed]] : [];
  }));
};

/**
 * One unit conversion for preview and PDF; consumers choose when to apply overrides. `only` limits the result to the
 * fields a layer really overrides, so unchanged template values never become CSS variables of their own.
 */
export const getCvDesignVariables = (design: CvDesignTokens, only?: CvDesignOverrides): Record<string, string> => {
  const variables: Record<string, string> = {};
  const kebab = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const keep = <Group extends keyof CvDesignTokens>(group: Group, name: string) =>
    !only || (only[group] as Record<string, unknown> | undefined)?.[name] !== undefined;
  for (const [name, value] of Object.entries(design.colors)) if (keep("colors", name)) variables[`--doc-${kebab(name)}-color`] = value;
  for (const [name, value] of Object.entries(design.spacing)) if (keep("spacing", name)) variables[`--doc-${kebab(name.replace(/Mm$/, ""))}`] = `${value}mm`;
  for (const [name, value] of Object.entries(design.typography)) {
    if (name === "fontId" || name === "headingFontId" || !keep("typography", name)) continue;
    variables[`--doc-${kebab(name.replace(/Pt$/, ""))}`] = `${value}${name.endsWith("Pt") ? "pt" : ""}`;
  }
  if (keep("typography", "fontId")) variables["--doc-font"] = getDocumentFont(design.typography.fontId).family;
  if (keep("typography", "headingFontId")) variables["--doc-heading-font"] = getDocumentFont(design.typography.headingFontId).family;
  // Preserve the established names used by the current document adapter.
  if (!only) {
    variables["--doc-margin"] = variables["--doc-page-margin"];
    variables["--doc-padding"] = variables["--doc-inner-padding"];
  }
  if (variables["--doc-accent-color"]) variables["--doc-accent"] = variables["--doc-accent-color"];
  if (variables["--doc-divider-color"]) variables["--doc-line-color"] = variables["--doc-divider-color"];
  return variables;
};
