import { z } from "zod";
import { documentFontIds } from "./documentDesign";
import { nativeResumeAppearanceSchema, resumeAppearanceSchema } from "./resumeAppearance";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const cvColorsSchema = z.object({
  text: color,
  paragraph: color,
  heading: color,
  subheading: color,
  sectionHeading: color,
  entryHeading: color,
  divider: color,
  background: color,
  accent: color,
  surface: color,
  muted: color,
  icon: color,
});

/** Physical units are shared by controls, validation and both output adapters. */
export const cvDesignLimits = {
  bodySizePt: [7, 14],
  headingSizePt: [14, 36],
  subheadingSizePt: [8, 20],
  sectionHeadingSizePt: [8, 22],
  entryHeadingSizePt: [8, 18],
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
  colors: cvColorsSchema.partial().optional(),
  typography: cvTypographySchema.partial().optional(),
  spacing: cvSpacingSchema.partial().optional(),
});

/**
 * A template's own design, complete and typed: the semantic tokens plus the appearance controls. It is the only
 * place where a template's design numbers live for the resolver, the design panel and the override adapters.
 */
export const nativeResumeDesignSchema = z.object({
  tokens: cvDesignTokensSchema,
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
