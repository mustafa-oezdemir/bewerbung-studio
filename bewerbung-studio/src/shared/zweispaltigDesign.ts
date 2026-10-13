import type { CvDesignTokens } from "./cvDesignSchema";
import { zweispaltigDefaults } from "./cvTemplateDefaults/zweispaltig.defaults";
import { resolveZweispaltigApplicationColors } from "./zweispaltigLetterIdentity";

/** One colour palette for the Zweispaltig CV preview and its Electron PDF. */
export const getZweispaltigDesignVariables = (
  design: CvDesignTokens,
  changedColors: Partial<CvDesignTokens["colors"]> | undefined,
  applicationAccent?: string,
  applicationSecondary?: string,
): Record<string, string> => {
  const native = zweispaltigDefaults.colors;
  const applicationColors = resolveZweispaltigApplicationColors(applicationAccent ?? "", applicationSecondary ?? "");
  const primaryWasChosen = applicationColors.primary.toLowerCase() !== native.primary.toLowerCase();
  const accentWasChosen = applicationColors.accent.toLowerCase() !== native.accent.toLowerCase();
  const primary = changedColors?.heading ?? (primaryWasChosen ? applicationColors.primary : design.colors.heading);
  const defaultSubheading = design.colors.subheading.toLowerCase() === native.accent.toLowerCase();
  const accent = changedColors?.subheading ?? changedColors?.accent
    ?? (accentWasChosen ? applicationColors.accent : defaultSubheading ? design.colors.accent : design.colors.subheading);
  const sectionHeading = changedColors?.sectionHeading
    ?? (design.colors.sectionHeading.toLowerCase() === native.heading.toLowerCase() ? primary : design.colors.sectionHeading);

  return {
    "--zweispaltig-primary": primary,
    "--zweispaltig-accent": accent,
    "--zweispaltig-heading": sectionHeading,
    "--zweispaltig-soft": design.colors.surface,
    "--zweispaltig-text": design.colors.text,
    "--zweispaltig-muted": design.colors.muted,
    "--zweispaltig-divider": design.colors.divider,
  };
};
