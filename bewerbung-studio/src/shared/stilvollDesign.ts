import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { stilvollDefaults } from "./cvTemplateDefaults/stilvoll.defaults";

const mix = (first: string, second: string, share: number) => {
  const channel = (color: string, index: number) => Number.parseInt(color.slice(index, index + 2), 16);
  return `#${[1, 3, 5].map(index => Math.round(channel(first, index) * share + channel(second, index) * (1 - share))
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};

/** Resolved once for the CV, its planner and the independent cover letter. */
export const getStilvollDesignVariables = (
  design: CvDesignTokens,
  changedColors: Partial<CvDesignTokens["colors"]> | undefined,
  applicationAccent?: string,
  applicationSecondary?: string,
): Record<string, string> => {
  const primary = changedColors?.accent ??
    (design.colors.accent !== stilvollDefaults.colors.primary ? design.colors.accent : applicationAccent) ?? design.colors.accent;
  const dark = changedColors?.entryHeading ?? changedColors?.heading ??
    (design.colors.entryHeading !== stilvollDefaults.colors.primaryDark ? design.colors.entryHeading : applicationSecondary) ??
    design.colors.entryHeading;
  const paletteChanged = primary.toLowerCase() !== stilvollDefaults.colors.primary.toLowerCase()
    || dark.toLowerCase() !== stilvollDefaults.colors.primaryDark.toLowerCase();
  const derived = (key: keyof CvDesignTokens["colors"], defaultColor: string, color: string) =>
    changedColors?.[key] ?? (paletteChanged && design.colors[key].toLowerCase() === defaultColor.toLowerCase()
      ? color : design.colors[key]);
  const text = derived("text", stilvollDefaults.colors.text, mix(dark, "#454B50", .44));
  const muted = derived("muted", stilvollDefaults.colors.muted, mix(dark, "#959CA0", .3));
  const shift = design.spacing.pageMarginMm - stilvollDefaults.page.marginRightMm;
  return {
    "--stilvoll-primary": primary,
    "--stilvoll-primary-dark": dark,
    "--stilvoll-title": derived("subheading", stilvollDefaults.colors.primary, primary),
    "--stilvoll-icon": derived("icon", stilvollDefaults.colors.primary, primary),
    "--stilvoll-text": text,
    "--stilvoll-paragraph": derived("paragraph", stilvollDefaults.colors.text, text),
    "--stilvoll-muted": muted,
    "--stilvoll-section-heading": derived("sectionHeading", stilvollDefaults.colors.muted, muted),
    "--stilvoll-divider": derived("divider", stilvollDefaults.colors.divider, mix(primary, "#D9DEE0", .3)),
    "--stilvoll-pattern": derived("surface", stilvollDefaults.colors.primarySoft, mix(primary, "#FFFFFF", .19)),
    "--stilvoll-inactive": derived("surface", stilvollDefaults.colors.primarySoft, mix(primary, "#FFFFFF", .15)),
    "--stilvoll-icon-surface": derived("surface", stilvollDefaults.colors.primarySoft, mix(primary, "#FFFFFF", .1)),
    "--stilvoll-background": design.colors.background,
    "--stilvoll-margin-left": `${stilvollDefaults.page.marginLeftMm + shift}mm`,
    "--stilvoll-margin-right": `${design.spacing.pageMarginMm}mm`,
    "--stilvoll-margin-top": `${Math.max(10, stilvollDefaults.page.marginTopMm + shift)}mm`,
    "--stilvoll-margin-bottom": `${Math.max(stilvollDefaults.page.marginBottomMm, stilvollDefaults.page.marginBottomMm + shift)}mm`,
    "--stilvoll-column-gap": `${design.spacing.columnGapMm}mm`,
    "--stilvoll-section-gap-base": `${design.spacing.sectionGapMm}mm`,
    "--stilvoll-entry-gap-base": `${design.spacing.entryGapMm}mm`,
    "--stilvoll-section-title-gap": `${design.spacing.sectionTitleGapMm}mm`,
    "--stilvoll-entry-content-gap": `${design.spacing.entryContentGapMm}mm`,
    "--stilvoll-header-height": `${stilvollDefaults.layout.headerHeightMm}mm`,
    "--stilvoll-header-content-gap": `${stilvollDefaults.layout.headerToContentGapMm}mm`,
    "--doc-body-size": `${design.typography.bodySizePt}pt`,
    "--doc-line-height": String(design.typography.lineHeight),
    "--doc-heading-size": `${design.typography.headingSizePt}pt`,
    "--doc-subheading-size": `${design.typography.subheadingSizePt}pt`,
    "--doc-section-heading-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--doc-entry-heading-size": `${design.typography.entryHeadingSizePt}pt`,
    "--doc-heading-weight": String(design.typography.headingWeight),
    "--doc-subheading-weight": String(design.typography.subheadingWeight),
    "--doc-section-heading-weight": String(design.typography.sectionHeadingWeight),
    "--stilvoll-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--doc-font": getDocumentFont(design.typography.fontId).family,
    "--doc-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--letter-body-size": "11pt",
    "--letter-subject-size": "13pt",
  };
};

/** Both native renderers consume these exact declarations after their historical CSS. */
export const stilvollResolvedCss = `
.stilvoll-template,.stilvoll-pdf{--stilvoll-section-gap:var(--stilvoll-section-gap-base);--stilvoll-entry-gap:var(--stilvoll-entry-gap-base);--managed-primary:var(--stilvoll-primary);--managed-dark:var(--stilvoll-primary-dark);--managed-text:var(--stilvoll-text);--managed-muted:var(--stilvoll-muted);--managed-divider:var(--stilvoll-divider);--managed-pattern:var(--stilvoll-pattern);--managed-margin:var(--stilvoll-margin-right);--managed-section-gap:var(--stilvoll-section-gap);--managed-entry-gap:var(--stilvoll-entry-gap);font-family:var(--doc-font);font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--stilvoll-text);background:var(--stilvoll-background)}
.stilvoll-template[data-density="compact"],.stilvoll-pdf[data-density="compact"]{--stilvoll-section-gap:calc(var(--stilvoll-section-gap-base) * .85);--stilvoll-entry-gap:calc(var(--stilvoll-entry-gap-base) * .85)}
.stilvoll-template[data-density="dense"],.stilvoll-pdf[data-density="dense"]{--stilvoll-section-gap:calc(var(--stilvoll-section-gap-base) * .65);--stilvoll-entry-gap:calc(var(--stilvoll-entry-gap-base) * .65)}
.stilvoll-template .stilvoll-background,.stilvoll-pdf .managed-pdf-background{color:var(--stilvoll-pattern);opacity:.3}
.stilvoll-template .stilvoll-background>path,.stilvoll-pdf .managed-pdf-background>path{fill:rgba(255,255,255,.72);stroke:none}
.stilvoll-template .stilvoll-background pattern path,.stilvoll-pdf .managed-pdf-background pattern path{fill:none;stroke:currentColor;stroke-width:.45}
.stilvoll-template .stilvoll-header,.stilvoll-pdf .stilvoll-pdf-header{min-height:var(--stilvoll-header-height);padding:var(--stilvoll-margin-top) var(--stilvoll-margin-right) 0 var(--stilvoll-margin-left)}
.stilvoll-template .stilvoll-header h1,.stilvoll-pdf .stilvoll-pdf-header h1{font-family:var(--doc-heading-font);font-size:var(--doc-heading-size);font-weight:var(--doc-heading-weight);color:var(--stilvoll-primary-dark)}
.stilvoll-template .stilvoll-header h2,.stilvoll-pdf .stilvoll-pdf-header h2{font-family:var(--doc-heading-font);font-size:var(--doc-subheading-size);font-weight:var(--doc-subheading-weight);line-height:var(--doc-line-height);color:var(--stilvoll-title)}
.stilvoll-template .stilvoll-header address,.stilvoll-pdf .stilvoll-pdf-contacts{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height);color:var(--stilvoll-text)}
.stilvoll-template .stilvoll-header address>span,.stilvoll-pdf .stilvoll-pdf-contacts>span{min-width:0;max-width:100%;overflow-wrap:anywhere}
.stilvoll-template .stilvoll-header address :is(a,span),.stilvoll-pdf .stilvoll-pdf-contacts :is(a,span){min-width:0;overflow-wrap:anywhere}
.stilvoll-template .stilvoll-header figure,.stilvoll-pdf .stilvoll-pdf-photo{background:var(--stilvoll-icon-surface)}
.stilvoll-template .stilvoll-header--compact,.stilvoll-pdf .stilvoll-pdf-header.compact{min-height:24mm;padding-top:11mm;padding-bottom:3mm;border-color:var(--stilvoll-divider)}
.stilvoll-template .stilvoll-header--compact h1,.stilvoll-pdf .stilvoll-pdf-header.compact h1{font-size:15pt}
.stilvoll-template .stilvoll-header--compact h2,.stilvoll-pdf .stilvoll-pdf-header.compact h2{font-size:calc(var(--doc-body-size) * .88)}
.stilvoll-template .stilvoll-content,.stilvoll-pdf .stilvoll-pdf-columns{grid-template-columns:minmax(0,50fr) minmax(0,105fr);column-gap:var(--stilvoll-column-gap);padding-left:var(--stilvoll-margin-left);padding-right:var(--stilvoll-margin-right);padding-bottom:calc(var(--stilvoll-margin-bottom) + 8mm)}
.stilvoll-template .stilvoll-content:not(.stilvoll-content--continuation),.stilvoll-pdf .stilvoll-pdf-columns:not(.continuation){padding-top:var(--stilvoll-header-content-gap)}
.stilvoll-template .stilvoll-footer,.stilvoll-pdf .managed-pdf-footer{left:var(--stilvoll-margin-left);right:var(--stilvoll-margin-right);bottom:var(--stilvoll-margin-bottom);font-size:8.5pt;color:var(--stilvoll-muted)}
.stilvoll-template .stilvoll-footer a,.stilvoll-pdf .managed-pdf-footer a{color:var(--stilvoll-primary-dark)}
.stilvoll-template .stilvoll-section__title,.stilvoll-pdf .managed-pdf-title,.stilvoll-template [data-cv-heading],.stilvoll-pdf [data-cv-heading]{font-family:var(--doc-heading-font);font-size:var(--doc-section-heading-size);font-weight:var(--doc-section-heading-weight);line-height:var(--doc-line-height);color:var(--stilvoll-section-heading);border-color:var(--stilvoll-divider);text-transform:var(--stilvoll-heading-case);margin-bottom:var(--stilvoll-section-title-gap)}
.stilvoll-template .stilvoll-summary,.stilvoll-pdf .managed-pdf-section>p{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--stilvoll-paragraph)}
.stilvoll-template .stilvoll-strengths article,.stilvoll-pdf .stilvoll-pdf-strength{grid-template-columns:8mm minmax(0,1fr);gap:2mm;margin-bottom:var(--stilvoll-entry-gap)}
.stilvoll-template .stilvoll-strengths article>i,.stilvoll-pdf .stilvoll-pdf-strength>i{width:7mm;height:7mm;background:var(--stilvoll-icon-surface);color:var(--stilvoll-primary)}
.stilvoll-template .stilvoll-strengths h3,.stilvoll-pdf .stilvoll-pdf-strength h3{font-family:var(--doc-heading-font);font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--stilvoll-primary-dark)}
.stilvoll-template .stilvoll-strengths p,.stilvoll-pdf .stilvoll-pdf-strength p{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.stilvoll-template [data-managed-section="strengths"] .managed-strengths-grid,.stilvoll-pdf [data-managed-section="strengths"] .managed-strengths-grid{gap:calc(var(--stilvoll-entry-gap) * .5)}
.stilvoll-template [data-managed-section="strengths"] .managed-strength-card,.stilvoll-pdf [data-managed-section="strengths"] .managed-strength-card{grid-template-columns:4mm minmax(0,1fr);gap:1mm 1.5mm;margin:0;padding:0}
.stilvoll-template [data-managed-section="strengths"] .managed-strength-card strong,.stilvoll-pdf [data-managed-section="strengths"] .managed-strength-card strong{font-size:var(--doc-body-size);font-weight:500;line-height:var(--doc-line-height);color:var(--stilvoll-primary-dark)}
.stilvoll-template [data-managed-section="strengths"] .managed-strength-card svg,.stilvoll-pdf [data-managed-section="strengths"] .managed-strength-card svg{color:var(--stilvoll-icon)}
.stilvoll-template .stilvoll-languages article,.stilvoll-pdf .stilvoll-pdf-language{margin-bottom:calc(var(--stilvoll-entry-gap) * .75);line-height:var(--doc-line-height)}
.stilvoll-template .stilvoll-languages strong,.stilvoll-pdf .stilvoll-pdf-language strong{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--stilvoll-primary-dark)}
.stilvoll-template .stilvoll-languages i,.stilvoll-pdf .stilvoll-pdf-language .managed-pdf-dots i{width:1.8mm;height:1.8mm;background:var(--stilvoll-inactive)}
.stilvoll-template .stilvoll-languages i.filled,.stilvoll-pdf .stilvoll-pdf-language .managed-pdf-dots i.filled{background:var(--stilvoll-primary-dark)}
.stilvoll-template .stilvoll-career h3,.stilvoll-pdf .stilvoll-pdf-entry h3{font-family:var(--doc-heading-font);font-size:var(--doc-entry-heading-size);line-height:var(--doc-line-height);color:var(--stilvoll-primary-dark)}
.stilvoll-template .stilvoll-career__heading time,.stilvoll-template .stilvoll-career__meta span,.stilvoll-pdf :is(.stilvoll-pdf-heading,.stilvoll-pdf-meta)>span{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height);color:var(--stilvoll-muted)}
.stilvoll-template .stilvoll-career__meta strong,.stilvoll-pdf .stilvoll-pdf-meta strong{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--stilvoll-primary)}
.stilvoll-template .stilvoll-career li,.stilvoll-pdf .stilvoll-pdf-entry li{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--stilvoll-paragraph)}
.stilvoll-template [data-managed-section],.stilvoll-pdf [data-managed-section]{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.stilvoll-template [data-custom-template="stilvoll"] [data-custom-role="body"],.stilvoll-pdf [data-custom-template="stilvoll"] [data-custom-role="body"]{font-size:var(--doc-body-size)!important;line-height:var(--doc-line-height)!important;color:var(--stilvoll-paragraph)}
.stilvoll-template [data-managed-section="languages"] :is(.resume-language-primary,.resume-language-level,.resume-language-description),.stilvoll-pdf [data-managed-section="languages"] :is(.resume-language-primary,.resume-language-level,.resume-language-description){font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.stilvoll-template [data-managed-section] :is(p,li,strong,span),.stilvoll-pdf [data-managed-section] :is(p,li,strong,span){line-height:var(--doc-line-height)}
.stilvoll-template [data-resume-closing-placement="footer"],.cv-sheet[data-template="stilvoll"] [data-resume-closing-placement="footer"]{left:var(--stilvoll-margin-left);right:var(--stilvoll-margin-right);bottom:calc(var(--stilvoll-margin-bottom) + 7mm)}
`;

export const stilvollLetterCss = `
.stilvoll-letter :is(.letter-preview,.letter-content){padding:var(--stilvoll-margin-top) var(--stilvoll-margin-right) var(--stilvoll-margin-bottom) var(--stilvoll-margin-left)!important;color:var(--stilvoll-text);font-family:var(--doc-font)!important}
.stilvoll-letter .letter-header{display:flex;align-items:flex-start;justify-content:flex-start;min-height:24mm;padding:0 0 1mm;text-align:left}
.stilvoll-letter :is(.sender,.sender-line){margin:0;color:var(--stilvoll-text);text-align:left}
.stilvoll-letter .sender-name{color:var(--stilvoll-primary-dark)!important;font-family:var(--doc-heading-font);font-size:var(--doc-heading-size)!important;font-weight:var(--doc-heading-weight)!important;line-height:1;letter-spacing:.015em;text-transform:uppercase}
.stilvoll-letter .sender-title{color:var(--stilvoll-title)!important;font-family:var(--doc-heading-font);font-size:var(--doc-subheading-size)!important;font-weight:var(--doc-subheading-weight)!important;line-height:var(--doc-line-height)}
.stilvoll-letter .sender-contact{color:var(--stilvoll-text)!important;font-size:var(--letter-body-size)!important;line-height:1.25;overflow-wrap:anywhere}
.stilvoll-letter :is(.letter-rule,.paper-rule){height:.35mm!important;margin:0!important;background:var(--stilvoll-divider)!important}
.stilvoll-letter :is(.recipient,.date,address,.paper-date,.letter-salutation,.letter-body,.letter-closing,.signature,.letter-signature,.signature-name){color:var(--stilvoll-text);font-size:var(--letter-body-size)!important}
.stilvoll-letter .letter-body{color:var(--stilvoll-paragraph)}
.stilvoll-letter :is(.recipient,address){min-height:20mm;margin-top:20mm;line-height:1.28}
.stilvoll-letter :is(.date,.paper-date){margin:0 0 20mm;text-align:right;line-height:1.28}
.stilvoll-letter :is(.subject,.letter-subject,.letter-preview h3){margin:0 0 6mm;color:var(--stilvoll-primary-dark)!important;font-family:var(--doc-heading-font);font-size:var(--letter-subject-size)!important;font-weight:var(--doc-section-heading-weight)!important;line-height:1.2}
.stilvoll-letter :is(.letter-preview,.letter-content)>.letter-salutation,.stilvoll-letter :is(.letter-preview,.letter-content)>.letter-body{margin:0 0 3.2mm!important;line-height:1.28}
.stilvoll-letter :is(.letter-preview,.letter-content)>.letter-closing{margin-bottom:0!important}
.stilvoll-letter :is(.letter-signature,.signature){margin:3.2mm 0 0!important;line-height:1.28}
.stilvoll-letter :is(.attachments-note,.letter-attachments){color:var(--stilvoll-muted)}
`;
