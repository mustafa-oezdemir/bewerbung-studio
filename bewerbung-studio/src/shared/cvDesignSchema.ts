import { z } from "zod";
import { documentFontIds } from "./documentDesign";

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
  pageMarginMm: [8, 30],
  innerPaddingMm: [0, 12],
  sectionGapMm: [0, 16],
  entryGapMm: [0, 12],
  sectionTitleGapMm: [0, 8],
  entryContentGapMm: [0, 8],
  columnGapMm: [3, 18],
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
});

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

export type CvDesignTokens = z.infer<typeof cvDesignTokensSchema>;
export type CvDesignOverrides = z.infer<typeof cvDesignOverridesSchema>;
