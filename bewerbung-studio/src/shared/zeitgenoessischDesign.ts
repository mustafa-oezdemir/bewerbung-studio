import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { zeitgenoessischDefaults } from "./cvTemplateDefaults/zeitgenoessisch.defaults";

const mix = (first: string, second: string, firstShare: number) => {
  const channel = (color: string, index: number) => Number.parseInt(color.slice(index, index + 2), 16);
  return `#${[1, 3, 5].map((index) => Math.round(channel(first, index) * firstShare + channel(second, index) * (1 - firstShare))
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

/** One presentation adapter for the CV and letter; all semantic values come from the resolved CV design. */
export const getZeitgenoessischDesignVariables = (
  design: CvDesignTokens,
  changedColors: Partial<CvDesignTokens["colors"]> | undefined,
  applicationAccent?: string,
  applicationSurface?: string,
): Record<string, string> => {
  const primary = changedColors?.accent ?? applicationAccent ?? design.colors.accent;
  const surface = changedColors?.surface ?? applicationSurface ?? design.colors.surface;
  const paletteChanged = primary.toLowerCase() !== zeitgenoessischDefaults.colors.primary.toLowerCase();
  const dark = changedColors?.sectionHeading ?? changedColors?.subheading ??
    (paletteChanged ? mix(primary, "#173B3B", 0.72) : design.colors.sectionHeading);
  const divider = changedColors?.divider ??
    (paletteChanged ? mix(primary, "#FFFFFF", 0.22) : design.colors.divider);
  const marginShift = design.spacing.pageMarginMm - zeitgenoessischDefaults.page.marginRightMm;
  return {
    "--zeit-primary": primary,
    "--zeit-primary-dark": dark,
    "--zeit-dark": dark,
    "--zeit-primary-soft": surface,
    "--zeit-soft": surface,
    "--zeit-primary-pale": mix(surface, "#FFFFFF", 0.5),
    "--zeit-pale": mix(surface, "#FFFFFF", 0.5),
    "--zeit-heading": design.colors.heading,
    "--zeit-text": design.colors.text,
    "--zeit-muted": design.colors.muted,
    "--zeit-divider": divider,
    "--zeit-margin-left": `${zeitgenoessischDefaults.page.marginLeftMm + marginShift}mm`,
    "--zeit-margin-right": `${zeitgenoessischDefaults.page.marginRightMm + marginShift}mm`,
    "--zeit-margin-top": `${Math.max(zeitgenoessischDefaults.page.marginTopMm, zeitgenoessischDefaults.page.marginTopMm + marginShift)}mm`,
    "--zeit-margin-bottom": `${Math.max(zeitgenoessischDefaults.page.marginBottomMm, zeitgenoessischDefaults.page.marginBottomMm + marginShift)}mm`,
    "--zeit-section-gap-base": `${design.spacing.sectionGapMm}mm`,
    "--zeit-entry-gap-base": `${design.spacing.entryGapMm}mm`,
    "--doc-body-size": `${design.typography.bodySizePt}pt`,
    "--body-size": `${design.typography.bodySizePt}pt`,
    "--doc-line-height": String(design.typography.lineHeight),
    "--body-line": String(design.typography.lineHeight),
    "--doc-heading-size": `${design.typography.headingSizePt}pt`,
    "--doc-subheading-size": `${design.typography.subheadingSizePt}pt`,
    "--doc-section-heading-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--doc-entry-heading-size": `${design.typography.entryHeadingSizePt}pt`,
    "--doc-heading-weight": String(design.typography.headingWeight),
    "--doc-subheading-weight": String(design.typography.subheadingWeight),
    "--doc-section-heading-weight": String(design.typography.sectionHeadingWeight),
    "--doc-font": getDocumentFont(design.typography.fontId).family,
    "--body-font": getDocumentFont(design.typography.fontId).family,
    "--doc-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--letter-body-size": "11pt",
    "--letter-subject-size": "13pt",
  };
};

/** Identity capitalization is a presentation rule; stored profile data stays intact. */
export const presentZeitgenoessischName = (name: string) => name.toLocaleUpperCase("de-DE");

/** Identical preview and Electron PDF letter rules, consuming the CV's resolved variables. */
export const zeitgenoessischLetterCss = `
.zeitgenoessisch-letter :is(.letter-preview,.letter-content){padding:20mm var(--zeit-margin-right) var(--zeit-margin-bottom) var(--zeit-margin-left)!important;color:var(--zeit-text);font-family:var(--body-font)!important}
.zeitgenoessisch-letter .sender-line,.zeitgenoessisch-letter .sender{text-align:left;color:var(--zeit-text)}
.zeitgenoessisch-letter .sender-name{color:var(--zeit-heading)!important;font-family:var(--heading-font);font-size:var(--doc-heading-size)!important;font-weight:var(--doc-heading-weight)!important;letter-spacing:.025em;line-height:1;text-transform:uppercase}
.zeitgenoessisch-letter .sender-title{color:var(--zeit-dark)!important;font-family:var(--heading-font);font-size:var(--doc-subheading-size)!important;font-weight:var(--doc-subheading-weight)!important;line-height:1.2;text-transform:uppercase}
.zeitgenoessisch-letter .sender-contact{color:var(--zeit-text)!important;font-size:11pt!important;line-height:1.25;overflow-wrap:anywhere}
.zeitgenoessisch-letter :is(.letter-rule,.paper-rule){background:var(--zeit-divider)!important}
.zeitgenoessisch-letter :is(.recipient,.date,address,.paper-date,.letter-salutation,.letter-body,.letter-closing,.signature,.letter-signature,.signature-name){color:var(--zeit-text);font-size:var(--letter-body-size)!important}
.zeitgenoessisch-letter :is(.subject,.letter-subject,.letter-preview h3){color:var(--zeit-dark)!important;font-family:var(--heading-font);font-size:var(--letter-subject-size)!important;font-weight:var(--doc-section-heading-weight)!important}
.zeitgenoessisch-letter :is(.attachments-note,.letter-attachments){color:var(--zeit-muted)}
`;
