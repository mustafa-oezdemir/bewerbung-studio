import { getDocumentFont, type DocumentDesignSettings } from "./documentDesign";
import type { CvDesignTokens } from "./cvDesignSchema";
import { zweispaltigDefaults } from "./cvTemplateDefaults/zweispaltig.defaults";

/** Legacy application colours predate Zweispaltig's own palette. Resolve them once for CV and letter. */
export const resolveZweispaltigApplicationColors = (accentColor: string, secondaryColor: string) => ({
  primary: !accentColor || accentColor.toUpperCase() === "#165DAA"
    ? zweispaltigDefaults.colors.primary : accentColor,
  accent: !secondaryColor || secondaryColor.toUpperCase() === "#EAF2FA"
    ? zweispaltigDefaults.colors.accent : secondaryColor,
});

/** Only the Zweispaltig letter consumes these resolved CV identity values. */
export const getZweispaltigLetterVariables = (
  design: CvDesignTokens,
  settings: DocumentDesignSettings,
  accentColor: string,
  secondaryColor: string,
): Record<string, string> => {
  const application = resolveZweispaltigApplicationColors(accentColor, secondaryColor);
  const changed = settings.cvOverrides?.colors;
  const primary = changed?.heading ?? application.primary;
  const accent = changed?.subheading ?? changed?.accent ?? application.accent;
  return {
    "--letter-identity-primary": primary,
    "--letter-identity-accent": accent,
    "--letter-identity-text": design.colors.text,
    "--letter-identity-muted": design.colors.muted,
    "--letter-identity-divider": changed?.divider ?? primary,
    "--letter-identity-font": getDocumentFont(design.typography.headingFontId).family,
    "--letter-identity-body-font": getDocumentFont(design.typography.fontId).family,
    "--letter-identity-name-size": `${design.typography.headingSizePt}pt`,
    "--letter-identity-title-size": `${design.typography.subheadingSizePt}pt`,
    "--letter-identity-name-weight": String(design.typography.headingWeight),
    "--letter-identity-title-weight": String(design.typography.subheadingWeight),
    "--letter-identity-subject-weight": String(design.typography.sectionHeadingWeight),
    "--letter-body-size": "11pt",
    "--letter-subject-size": "13pt",
  };
};

/** Loaded unchanged by the React preview and Electron PDF. The variables come from the same resolved CV design. */
export const zweispaltigLetterCss = `
.zweispaltig-letter :is(.letter-content,.letter-preview){font-family:var(--letter-identity-body-font);color:var(--letter-identity-text)}
.zweispaltig-letter .sender-name{color:var(--letter-identity-primary)!important;font-family:var(--letter-identity-font);font-size:var(--letter-identity-name-size);font-weight:var(--letter-identity-name-weight);letter-spacing:.025em;line-height:1;text-transform:uppercase}
.zweispaltig-letter .sender-title{color:var(--letter-identity-accent)!important;font-family:var(--letter-identity-font);font-size:var(--letter-identity-title-size);font-weight:var(--letter-identity-title-weight);line-height:1.2}
.zweispaltig-letter .sender-contact{color:var(--letter-identity-text)!important;font-size:11pt!important}
.zweispaltig-letter :is(.letter-rule,.paper-rule){background:var(--letter-identity-divider)!important}
.zweispaltig-letter :is(.attachments-note,.letter-attachments){color:var(--letter-identity-muted)}
.zweispaltig-letter :is(.recipient,.date,address,.paper-date,.letter-salutation,.letter-body,.letter-closing,.signature,.letter-signature,.signature-name){color:var(--letter-identity-text);font-size:11pt!important}
.zweispaltig-letter :is(.subject,.letter-subject){color:var(--letter-identity-primary)!important;font-family:var(--letter-identity-font);font-size:var(--letter-subject-size)!important;font-weight:var(--letter-identity-subject-weight)}
`;
