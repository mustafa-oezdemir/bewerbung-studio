import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { kreativDefaults } from "./cvTemplateDefaults/kreativ.defaults";

const mix = (first: string, second: string, firstShare: number) => {
  const channel = (color: string, index: number) => Number.parseInt(color.slice(index, index + 2), 16);
  return `#${[1, 3, 5].map((index) => Math.round(channel(first, index) * firstShare + channel(second, index) * (1 - firstShare))
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

/** The same resolved profile/application design feeds the CV and the letter. */
export const getKreativDesignVariables = (
  design: CvDesignTokens,
  changedColors: Partial<CvDesignTokens["colors"]> | undefined,
  applicationAccent?: string,
  applicationSurface?: string,
): Record<string, string> => {
  const primary = changedColors?.accent ??
    (design.colors.accent !== kreativDefaults.colors.primary ? design.colors.accent : applicationAccent) ?? design.colors.accent;
  const surface = changedColors?.surface ??
    (design.colors.surface !== kreativDefaults.colors.primarySoft ? design.colors.surface : applicationSurface) ?? design.colors.surface;
  const paletteChanged = primary.toLowerCase() !== kreativDefaults.colors.primary.toLowerCase();
  const dark = changedColors?.sectionHeading ?? changedColors?.entryHeading ??
    (design.colors.sectionHeading !== kreativDefaults.colors.heading ? design.colors.sectionHeading : undefined) ??
    (paletteChanged ? mix(primary, "#173B3B", 0.72) : design.colors.sectionHeading);
  const divider = changedColors?.divider ??
    (design.colors.divider !== kreativDefaults.colors.primaryDark ? design.colors.divider : undefined) ??
    (paletteChanged ? mix(primary, "#FFFFFF", 0.44) : kreativDefaults.colors.divider);
  const marginShift = design.spacing.pageMarginMm - kreativDefaults.page.marginRightMm;
  return {
    "--kreativ-primary": primary,
    "--kreativ-primary-soft": surface,
    "--kreativ-dark": dark,
    "--kreativ-primary-dark": dark,
    "--kreativ-heading": dark,
    "--kreativ-text": design.colors.text,
    "--kreativ-muted": design.colors.muted,
    "--kreativ-divider": divider,
    "--kreativ-light-divider": paletteChanged ? mix(primary, "#FFFFFF", 0.2) : kreativDefaults.colors.lightDivider,
    "--kreativ-light": paletteChanged ? mix(primary, "#FFFFFF", 0.2) : kreativDefaults.colors.lightDivider,
    "--kreativ-inactive": paletteChanged ? mix(surface, "#FFFFFF", 0.35) : kreativDefaults.colors.inactiveLevel,
    "--kreativ-header-text": design.colors.heading,
    "--kreativ-margin-left": `${kreativDefaults.page.marginLeftMm + marginShift}mm`,
    "--kreativ-margin-right": `${kreativDefaults.page.marginRightMm + marginShift}mm`,
    "--kreativ-margin-bottom": `${Math.max(kreativDefaults.page.marginBottomMm, kreativDefaults.page.marginBottomMm + marginShift)}mm`,
    "--kreativ-margin": `${design.spacing.pageMarginMm}mm`,
    "--kreativ-column-gap": `${design.spacing.columnGapMm}mm`,
    "--kreativ-section-gap-base": `${design.spacing.sectionGapMm}mm`,
    "--kreativ-entry-gap-base": `${design.spacing.entryGapMm}mm`,
    "--kreativ-section-title-gap": `${design.spacing.sectionTitleGapMm}mm`,
    "--kreativ-entry-content-gap": `${design.spacing.entryContentGapMm}mm`,
    "--kreativ-header-height": `${kreativDefaults.layout.headerHeightMm}mm`,
    "--kreativ-header-to-content-gap": `${kreativDefaults.layout.headerToContentGapMm}mm`,
    "--kreativ-footer-clearance": `${kreativDefaults.layout.footerClearanceMm}mm`,
    "--kreativ-entry-divider-gap": `${kreativDefaults.layout.entryDividerGapMm}mm`,
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
    "--kreativ-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--doc-font": getDocumentFont(design.typography.fontId).family,
    "--body-font": getDocumentFont(design.typography.fontId).family,
    "--doc-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--letter-body-size": "11pt",
    "--letter-subject-size": "13pt",
  };
};

/** Shared after the template defaults on both rendered surfaces. */
export const kreativResolvedCss = `
.kreativ-template,.kreativ-pdf{font-family:var(--doc-font);font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kreativ-text)}
.kreativ-template .kreativ-header,.kreativ-pdf .kreativ-pdf-header{background:var(--kreativ-primary)}
.kreativ-template .kreativ-header,.kreativ-pdf .kreativ-pdf-header{padding-left:var(--kreativ-margin-left);padding-right:var(--kreativ-margin-right);min-height:calc(var(--kreativ-header-height) + 28mm * (var(--resume-photo-scale,1) - 1))}
.kreativ-template .kreativ-header__identity h1,.kreativ-pdf .kreativ-pdf-identity h1{font-family:var(--doc-heading-font);font-size:var(--doc-heading-size);font-weight:var(--doc-heading-weight);color:var(--kreativ-header-text)}
.kreativ-template .kreativ-header__identity h2,.kreativ-pdf .kreativ-pdf-identity h2{font-family:var(--doc-heading-font);font-size:var(--doc-subheading-size);font-weight:var(--doc-subheading-weight);color:var(--kreativ-header-text);line-height:var(--doc-line-height)}
.kreativ-template .kreativ-header__contacts,.kreativ-pdf .kreativ-pdf-contacts{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height)}
.kreativ-template .kreativ-header__contacts>[data-contact-kind="email"],.kreativ-pdf .kreativ-pdf-contacts>[data-contact-kind="email"]{grid-column:1/-1;min-width:0}
.kreativ-template .kreativ-header__contacts>[data-contact-kind="email"]>span,.kreativ-pdf .kreativ-pdf-contacts>[data-contact-kind="email"]>i{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;overflow-wrap:normal}
.kreativ-template .kreativ-header--compact,.kreativ-pdf .kreativ-pdf-header.compact{min-height:24mm;color:var(--kreativ-dark)}
.kreativ-template .kreativ-header--compact,.kreativ-pdf .kreativ-pdf-header.compact{background:#fff}
.kreativ-template .kreativ-header--compact .kreativ-header__identity h1,.kreativ-pdf .kreativ-pdf-header.compact .kreativ-pdf-identity h1{font-size:15pt;color:var(--kreativ-dark)}
.kreativ-template .kreativ-header--compact .kreativ-header__identity h2,.kreativ-pdf .kreativ-pdf-header.compact .kreativ-pdf-identity h2{font-size:calc(var(--doc-body-size) * .88);color:var(--kreativ-muted)}
.kreativ-template .kreativ-content,.kreativ-pdf .kreativ-pdf-content{grid-template-columns:minmax(0,96.3fr) minmax(0,58.7fr);column-gap:var(--kreativ-column-gap);padding-left:var(--kreativ-margin-left);padding-right:var(--kreativ-margin-right);padding-bottom:var(--kreativ-footer-clearance)}
.kreativ-template .kreativ-ats,.kreativ-pdf.kreativ-pdf-ats{padding:15mm var(--kreativ-margin-right) var(--kreativ-margin-bottom) var(--kreativ-margin-left)}
.kreativ-template .kreativ-footer,.kreativ-pdf .kreativ-pdf-footer{left:var(--kreativ-margin-left);right:var(--kreativ-margin-right);bottom:var(--kreativ-margin-bottom);color:var(--kreativ-muted)}
.kreativ-template .kreativ-section__title,.kreativ-pdf .kreativ-pdf-title{font-family:var(--doc-heading-font);font-size:var(--doc-section-heading-size);font-weight:var(--doc-section-heading-weight);color:var(--kreativ-dark);border-color:var(--kreativ-dark);margin-bottom:var(--kreativ-section-title-gap);text-transform:var(--kreativ-heading-case)}
.kreativ-template [data-cv-heading],.kreativ-pdf [data-cv-heading]{font-family:var(--doc-heading-font);font-size:var(--doc-section-heading-size);font-weight:var(--doc-section-heading-weight);color:var(--kreativ-dark);border-color:var(--kreativ-dark);text-transform:var(--kreativ-heading-case)}
.kreativ-template .kreativ-section__title small{font-size:calc(var(--doc-body-size) * .78)}
.kreativ-template .kreativ-career-entry h3,.kreativ-pdf .kreativ-pdf-entry h4{font-family:var(--doc-heading-font);font-size:var(--doc-entry-heading-size);line-height:var(--doc-line-height);color:var(--kreativ-dark)}
.kreativ-template .kreativ-career-entry h4,.kreativ-pdf .kreativ-pdf-entry h5{font-size:calc(var(--doc-body-size) * .98);line-height:var(--doc-line-height);color:var(--kreativ-primary)}
.kreativ-template .kreativ-career-entry__meta,.kreativ-template .kreativ-career-entry__location,.kreativ-pdf .kreativ-pdf-entry-meta,.kreativ-pdf .kreativ-pdf-entry-location{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height)}
.kreativ-template .kreativ-career-entry li,.kreativ-pdf .kreativ-pdf-entry li{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template .kreativ-career-entry li::marker,.kreativ-pdf .kreativ-pdf-entry li::marker{color:var(--kreativ-primary)}
.kreativ-template .kreativ-summary,.kreativ-pdf .kreativ-pdf-summary{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template .kreativ-strengths__list,.kreativ-pdf .kreativ-pdf-strengths{gap:calc(var(--kreativ-entry-gap) * .5)}
.kreativ-template .kreativ-strength,.kreativ-pdf .kreativ-pdf-strength{margin-bottom:0;padding-bottom:calc(var(--kreativ-entry-gap) * .5)}
.kreativ-template .kreativ-strength h3,.kreativ-pdf .kreativ-pdf-strength :is(h4,span){font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kreativ-dark)}
.kreativ-template .kreativ-strength > svg,.kreativ-pdf .kreativ-pdf-strength :is(svg,i){color:var(--kreativ-primary)}
.kreativ-template .kreativ-strength p,.kreativ-pdf .kreativ-pdf-strength p{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template .kreativ-language h3,.kreativ-pdf .kreativ-pdf-language h4{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kreativ-dark)}
.kreativ-template .kreativ-language__dots i.is-filled,.kreativ-pdf .kreativ-pdf-dots i.filled{background:var(--kreativ-primary)}
.kreativ-template .kreativ-skill,.kreativ-pdf .kreativ-pdf-skill{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template [data-managed-section="strengths"] .managed-strength-card :is(strong,p),.kreativ-pdf [data-managed-section="strengths"] .managed-strength-card :is(strong,p){font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template .resume-language-primary,.kreativ-pdf .resume-language-primary{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template :is(.resume-language-level,.resume-language-description),.kreativ-pdf :is(.resume-language-level,.resume-language-description){font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height)}
.kreativ-template [data-managed-section="knowledge"],.kreativ-pdf [data-managed-section="knowledge"]{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template [data-managed-section="knowledge"] :is(small,h4,h5),.kreativ-pdf [data-managed-section="knowledge"] :is(small,h4,h5){font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height)}
.kreativ-template [data-managed-section="certifications"],.kreativ-pdf [data-managed-section="certifications"]{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template [data-managed-section],.kreativ-pdf [data-managed-section]{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kreativ-template [data-managed-section] :is(p,li,h4,h5),.kreativ-pdf [data-managed-section] :is(p,li,h4,h5){line-height:var(--doc-line-height)}
.kreativ-template [data-resume-closing-placement="footer"],.cv-sheet[data-template="kreativ"] [data-resume-closing-placement="footer"]{left:var(--kreativ-margin-left);right:var(--kreativ-margin-right);bottom:calc(var(--kreativ-margin-bottom) + 7.5mm)}
`;

/** The letter follows the CV's normal-case white identity in a full-width primary banner. */
export const kreativLetterCss = `
.kreativ-letter :is(.letter-preview,.letter-content){padding:0 var(--kreativ-margin-right) var(--kreativ-margin-bottom) var(--kreativ-margin-left)!important;color:var(--kreativ-text);font-family:var(--doc-font)!important}
.kreativ-letter .letter-header{display:flex;align-items:center;min-height:46mm;margin-left:calc(-1 * var(--kreativ-margin-left));margin-right:calc(-1 * var(--kreativ-margin-right));padding:10mm var(--kreativ-margin-right) 6mm var(--kreativ-margin-left);background:var(--kreativ-primary);color:var(--kreativ-header-text);text-align:left}
.kreativ-letter :is(.sender,.sender-line){margin:0;color:var(--kreativ-header-text)!important;text-align:left}
.kreativ-letter .sender-name{color:var(--kreativ-header-text)!important;font-family:var(--doc-heading-font);font-size:var(--doc-heading-size)!important;font-weight:var(--doc-heading-weight)!important;line-height:1.05;letter-spacing:.015em;text-transform:none}
.kreativ-letter .sender-title{color:var(--kreativ-header-text)!important;font-family:var(--doc-heading-font);font-size:var(--doc-subheading-size)!important;font-weight:var(--doc-subheading-weight)!important;line-height:var(--doc-line-height)}
.kreativ-letter .sender-contact{color:var(--kreativ-header-text)!important;font-size:11pt!important;line-height:1.25;overflow-wrap:anywhere}
.kreativ-letter :is(.letter-rule,.paper-rule){height:.55mm!important;margin:0!important;background:var(--kreativ-divider)!important}
.kreativ-letter :is(.recipient,.date,address,.paper-date,.letter-salutation,.letter-body,.letter-closing,.signature,.letter-signature,.signature-name){color:var(--kreativ-text);font-size:var(--letter-body-size)!important}
.kreativ-letter :is(.recipient,address){min-height:20mm;margin-top:20mm;line-height:1.28}
.kreativ-letter :is(.date,.paper-date){margin:0 0 20mm;text-align:right}
.kreativ-letter :is(.date,.paper-date){line-height:1.3}
.kreativ-letter :is(.subject,.letter-subject,.letter-preview h3){margin:0 0 6mm;color:var(--kreativ-dark)!important;font-family:var(--doc-heading-font);font-size:var(--letter-subject-size)!important;font-weight:var(--doc-section-heading-weight)!important}
.kreativ-letter :is(.letter-preview,.letter-content)>.letter-salutation,.kreativ-letter :is(.letter-preview,.letter-content)>.letter-body{margin:0 0 3.2mm!important;line-height:1.28}
.kreativ-letter :is(.letter-preview,.letter-content)>.letter-closing{margin-bottom:0!important}
.kreativ-letter :is(.letter-signature,.signature){margin:3.2mm 0 0!important;line-height:1.28}
.kreativ-letter :is(.attachments-note,.letter-attachments){color:var(--kreativ-muted)}
`;
