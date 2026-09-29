import {
  defaultDocumentDesign, fontSizeToPt, getDocumentFont, lineHeightLevelToValue,
  marginLevelToMm, paddingLevelToMm, sectionSpacingLevelToMm,
  type DocumentDesignSettings,
} from "./documentDesign";
import { cvDesignOverridesSchema, type CvDesignOverrides, type CvDesignTokens } from "./cvDesignSchema";
import { cvTemplateTokens } from "./cvTemplateTokens";
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

export const resolveTemplateCvDesign = (templateId: string): CvDesignTokens => {
  const template = getTemplate(templateId);
  const settings = getTemplateDocumentDesignDefaults(template.id);
  return mergeTokens({
    colors: {
      text: settings.textColor, paragraph: settings.textColor,
      heading: settings.headingColor, subheading: template.secondary,
      sectionHeading: settings.headingColor, entryHeading: settings.headingColor,
      divider: settings.lineColor, background: settings.backgroundColor,
      accent: template.accent, surface: settings.backgroundColor,
      muted: settings.textColor, icon: template.accent,
    },
    typography: {
      fontId: settings.fontId, headingFontId: settings.headingFontId,
      bodySizePt: fontSizeToPt[settings.fontSize], headingSizePt: 24,
      subheadingSizePt: 12, sectionHeadingSizePt: 12, entryHeadingSizePt: 11,
      lineHeight: lineHeightLevelToValue[settings.lineHeightLevel],
      headingWeight: getDocumentFont(settings.headingFontId).headingWeight,
      subheadingWeight: 600, sectionHeadingWeight: 700,
      sectionHeadingUppercase: false,
    },
    spacing: {
      pageMarginMm: marginLevelToMm[settings.marginLevel],
      innerPaddingMm: paddingLevelToMm[settings.paddingLevel],
      sectionGapMm: sectionSpacingLevelToMm[settings.sectionSpacingLevel],
      entryGapMm: 4, sectionTitleGapMm: 2, entryContentGapMm: 1.5, columnGapMm: 10,
    },
  }, cvTemplateTokens[template.id] ?? {});
};

/** Validation keeps CSS injection and unsafe physical dimensions out of both renderers. */
export const resolveCvDesign = (templateId: string, overrides: CvDesignOverrides = {}): CvDesignTokens =>
  mergeTokens(resolveTemplateCvDesign(templateId), cvDesignOverridesSchema.parse(overrides));

/** Remove inherited values before persistence; an empty result is a complete reset. */
export const compactCvDesignOverrides = (templateId: string, overrides: CvDesignOverrides): CvDesignOverrides => {
  const parsed = cvDesignOverridesSchema.parse(overrides);
  const defaults = resolveTemplateCvDesign(templateId);
  return Object.fromEntries(Object.entries(parsed).flatMap(([group, fields]) => {
    if (!fields) return [];
    const base = defaults[group as keyof CvDesignTokens];
    const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => {
      const inherited = base[key as keyof typeof base];
      return value !== undefined && (group === "colors"
        ? String(value).toLowerCase() !== String(inherited).toLowerCase()
        : value !== inherited);
    }));
    return Object.keys(changed).length ? [[group, changed]] : [];
  }));
};

/** One unit conversion for preview and PDF; consumers choose when to apply overrides. */
export const getCvDesignVariables = (design: CvDesignTokens): Record<string, string> => {
  const variables: Record<string, string> = {};
  const kebab = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  for (const [name, value] of Object.entries(design.colors)) variables[`--doc-${kebab(name)}-color`] = value;
  for (const [name, value] of Object.entries(design.spacing)) variables[`--doc-${kebab(name.replace(/Mm$/, ""))}`] = `${value}mm`;
  for (const [name, value] of Object.entries(design.typography)) {
    if (name === "fontId" || name === "headingFontId") continue;
    variables[`--doc-${kebab(name.replace(/Pt$/, ""))}`] = `${value}${name.endsWith("Pt") ? "pt" : ""}`;
  }
  variables["--doc-font"] = getDocumentFont(design.typography.fontId).family;
  variables["--doc-heading-font"] = getDocumentFont(design.typography.headingFontId).family;
  // Preserve the established names used by the current document adapter.
  variables["--doc-margin"] = variables["--doc-page-margin"];
  variables["--doc-padding"] = variables["--doc-inner-padding"];
  variables["--doc-accent"] = variables["--doc-accent-color"];
  variables["--doc-line-color"] = variables["--doc-divider-color"];
  return variables;
};
