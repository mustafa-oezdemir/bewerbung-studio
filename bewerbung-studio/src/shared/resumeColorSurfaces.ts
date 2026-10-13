import type { CvDesignTokens } from "./cvDesignSchema";
import { getColorContrastRatio } from "./documentDesign";

// Colour the individual rendered cards/tags, never their section or grid containers.
export const resumeColorSurfaceSelector = ".resume-special-output__project,.project-card,.managed-strength-card,.managed-tags>span,.chip,.knowledge-tags>span";
export const resumeSurfaceTextKeys = ["text", "paragraph", "entryHeading", "muted"] as const;

/** Preserve explicit text choices; otherwise choose readable ink for a newly coloured card. */
export const resolveResumeSurfaceText = (
  colors: CvDesignTokens["colors"],
  explicit: Partial<CvDesignTokens["colors"]> | undefined,
  key: typeof resumeSurfaceTextKeys[number],
): string => {
  if (explicit?.[key] !== undefined || getColorContrastRatio(colors[key], colors.surface) >= 4.5) return colors[key];
  return getColorContrastRatio("#000000", colors.surface) >= getColorContrastRatio("#FFFFFF", colors.surface)
    ? "#000000" : "#FFFFFF";
};

export const getResumeSurfaceContrastWarnings = (
  colors: CvDesignTokens["colors"], explicit: Partial<CvDesignTokens["colors"]> | undefined,
) => resumeSurfaceTextKeys.filter((key) => explicit?.[key] !== undefined
  && getColorContrastRatio(colors[key], colors.surface) < 4.5);
