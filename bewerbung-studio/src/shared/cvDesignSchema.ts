import { z } from "zod";
import { documentFontIds } from "./documentDesign";
import { nativeResumeAppearanceSchema, resumeAppearanceSchema } from "./resumeAppearance";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
/** The colours every template names itself. */
const cvTemplateColorsSchema = z.object({
  text: color,
  paragraph: color,
  heading: color,
  subheading: color,
  sectionHeading: color,
  entryHeading: color,
  /** Entry roles (resumeTextRoles): Datum / Zeitraum, Unternehmen / Einrichtung, Ort / Standort. */
  date: color,
  organization: color,
  location: color,
  divider: color,
  background: color,
  accent: color,
  surface: color,
  muted: color,
  /** "Symbole": the icons of the Kontaktdaten and nothing else. */
  icon: color,
});

/**
 * The colours of a Lebenslauf. Two controls have no field in the template files; their native value is derived once
 * (resolveTemplateCvDesign): Projekttechnologien (the technology line of a project) and Stärken-Symbole.
 */
export const cvColorsSchema = cvTemplateColorsSchema.extend({
  projectTechnologies: color,
  strengthIcon: color,
});

/** Physical units are shared by controls, validation and both output adapters. */
export const cvDesignLimits = {
  bodySizePt: [7, 14],
  headingSizePt: [14, 36],
  subheadingSizePt: [8, 20],
  sectionHeadingSizePt: [8, 22],
  entryHeadingSizePt: [8, 18],
  dateSizePt: [6, 16],
  organizationSizePt: [6, 16],
  locationSizePt: [6, 16],
  projectTechnologiesSizePt: [6, 16],
  projectDescriptionSizePt: [6, 16],
  lineHeight: [1, 1.8],
  pageMarginMm: [5, 30],
  innerPaddingMm: [0, 16],
  sectionGapMm: [0, 16],
  entryGapMm: [0, 12],
  sectionTitleGapMm: [0, 8],
  entryContentGapMm: [0, 8],
  columnGapMm: [0, 18],
} as const;

const bounded = (key: keyof typeof cvDesignLimits) =>
  z.number().min(cvDesignLimits[key][0]).max(cvDesignLimits[key][1]);

export const cvTypographySchema = z.object({
  fontId: z.enum(documentFontIds),
  headingFontId: z.enum(documentFontIds),
  bodySizePt: bounded("bodySizePt"),
  headingSizePt: bounded("headingSizePt"),
  subheadingSizePt: bounded("subheadingSizePt"),
  sectionHeadingSizePt: bounded("sectionHeadingSizePt"),
  entryHeadingSizePt: bounded("entryHeadingSizePt"),
  /** The entry roles' own sizes (resumeTextRoles); the entry title keeps `entryHeadingSizePt`. */
  dateSizePt: bounded("dateSizePt"),
  organizationSizePt: bounded("organizationSizePt"),
  locationSizePt: bounded("locationSizePt"),
  projectTechnologiesSizePt: bounded("projectTechnologiesSizePt"),
  projectDescriptionSizePt: bounded("projectDescriptionSizePt"),
  lineHeight: bounded("lineHeight"),
  headingWeight: z.number().int().min(300).max(900),
  subheadingWeight: z.number().int().min(300).max(900),
  sectionHeadingWeight: z.number().int().min(300).max(900),
  sectionHeadingUppercase: z.boolean(),
});

/**
 * `pageMarginMm` is the distance between the sheet edge and the content, `innerPaddingMm` an extra inset inside the
 * columns. They never overlap: whatever padding a template draws itself counts into its margin, so its native inner
 * padding is 0 and a chosen inner padding is added on top.
 */
export const cvSpacingSchema = z.object({
  pageMarginMm: bounded("pageMarginMm"),
  innerPaddingMm: bounded("innerPaddingMm"),
  sectionGapMm: bounded("sectionGapMm"),
  entryGapMm: bounded("entryGapMm"),
  sectionTitleGapMm: bounded("sectionTitleGapMm"),
  entryContentGapMm: bounded("entryContentGapMm"),
  columnGapMm: bounded("columnGapMm"),
});

export const cvDesignTokensSchema = z.object({
  colors: cvColorsSchema,
  typography: cvTypographySchema,
  spacing: cvSpacingSchema,
});

// No .default() here: absence means inheritance, never a persisted copy of defaults.
export const cvDesignOverridesSchema = z.object({
  // Zweispaltig's employer override is optional: old records keep their original accent inheritance.
  colors: cvColorsSchema.partial().extend({ employer: color.optional() }).optional(),
  typography: cvTypographySchema.partial().optional(),
  spacing: cvSpacingSchema.partial().optional(),
});

/**
 * A template's own design, complete and typed: the semantic tokens plus the appearance controls. It is the only
 * place where a template's design numbers live for the resolver, the design panel and the override adapters.
 */
export const nativeResumeDesignSchema = z.object({
  tokens: cvDesignTokensSchema.extend({ colors: cvTemplateColorsSchema }),
  appearance: nativeResumeAppearanceSchema,
});

/**
 * The shared Lebenslauf layer of a workspace: sparse overrides that apply to every template and every Bewerbung.
 * Like the document-level overrides it never stores a default; absence means "use the template's own value".
 */
export const resumeDesignLayerSchema = z.object({
  cvOverrides: cvDesignOverridesSchema.optional(),
  resumeAppearance: resumeAppearanceSchema.optional(),
});

export type CvDesignTokens = z.infer<typeof cvDesignTokensSchema>;
export type ResumeDesignLayer = z.infer<typeof resumeDesignLayerSchema>;
export type CvDesignOverrides = z.infer<typeof cvDesignOverridesSchema>;
export type NativeResumeDesign = z.infer<typeof nativeResumeDesignSchema>;
