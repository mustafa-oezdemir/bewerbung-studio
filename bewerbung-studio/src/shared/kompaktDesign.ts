import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { kompaktDefaults } from "./cvTemplateDefaults/kompakt.defaults";

const blend = (first: string, second: string, share: number) => `#${[1, 3, 5].map((index) =>
  Math.round(Number.parseInt(first.slice(index, index + 2), 16) * share
    + Number.parseInt(second.slice(index, index + 2), 16) * (1 - share))
    .toString(16).padStart(2, "0")).join("").toUpperCase()}`;

/** One resolved Kompakt palette and set of physical tokens for CV, planner and letter. */
export const getKompaktDesignVariables = (
  design: CvDesignTokens,
  changedColors: Partial<CvDesignTokens["colors"]> | undefined,
  applicationPrimary?: string,
  applicationAccent?: string,
): Record<string, string> => {
  const primary = changedColors?.heading ?? changedColors?.entryHeading ??
    (applicationPrimary && applicationPrimary !== kompaktDefaults.colors.primary ? applicationPrimary : design.colors.heading);
  const accent = changedColors?.accent ??
    (applicationAccent && applicationAccent !== kompaktDefaults.colors.accent ? applicationAccent : design.colors.accent);
  const changed = primary.toLowerCase() !== kompaktDefaults.colors.primary.toLowerCase()
    || accent.toLowerCase() !== kompaktDefaults.colors.accent.toLowerCase();
  const color = (key: keyof CvDesignTokens["colors"], native: string, derived: string) =>
    changedColors?.[key] ?? (changed && design.colors[key].toLowerCase() === native.toLowerCase() ? derived : design.colors[key]);
  const text = color("text", kompaktDefaults.colors.text, blend(primary, "#555B5F", .24));
  const muted = color("muted", kompaktDefaults.colors.muted, blend(primary, "#A0A5A8", .22));
  const pageMargin = design.spacing.pageMarginMm;
  const marginShift = pageMargin - kompaktDefaults.page.marginLeftMm;
  return {
    "--kompakt-primary": primary,
    "--kompakt-accent": accent,
    "--kompakt-text": text,
    "--kompakt-paragraph": color("paragraph", kompaktDefaults.colors.text, text),
    "--kompakt-muted": muted,
    "--kompakt-subheading": color("subheading", kompaktDefaults.colors.muted, muted),
    "--kompakt-section-heading": color("sectionHeading", kompaktDefaults.colors.muted, muted),
    "--kompakt-entry-heading": color("entryHeading", kompaktDefaults.colors.primary, primary),
    "--kompakt-divider": color("divider", kompaktDefaults.colors.divider, blend(primary, "#D7DCDE", .25)),
    "--kompakt-pattern": color("surface", kompaktDefaults.colors.pattern, blend(accent, "#FFFFFF", .25)),
    "--kompakt-inactive": blend(muted, design.colors.background, .20),
    "--kompakt-icon": color("icon", kompaktDefaults.colors.accent, accent),
    "--kompakt-background": design.colors.background,
    "--kompakt-margin-left": `${pageMargin}mm`,
    "--kompakt-margin-right": `${Math.max(0, kompaktDefaults.page.marginRightMm + marginShift)}mm`,
    "--kompakt-margin-top": `${Math.max(0, kompaktDefaults.page.marginTopMm + marginShift)}mm`,
    "--kompakt-margin-bottom": `${Math.max(0, kompaktDefaults.page.marginBottomMm + marginShift)}mm`,
    "--kompakt-column-gap": `${design.spacing.columnGapMm}mm`,
    "--kompakt-section-gap-base": `${design.spacing.sectionGapMm}mm`,
    "--kompakt-entry-gap-base": `${design.spacing.entryGapMm}mm`,
    "--kompakt-section-title-gap": `${design.spacing.sectionTitleGapMm}mm`,
    "--kompakt-entry-content-gap": `${design.spacing.entryContentGapMm}mm`,
    "--kompakt-header-height": `${kompaktDefaults.layout.headerHeightMm}mm`,
    "--kompakt-header-content-gap": `${kompaktDefaults.layout.headerToContentGapMm}mm`,
    "--kompakt-footer-clearance": `${kompaktDefaults.layout.footerClearanceMm}mm`,
    "--doc-body-size": `${design.typography.bodySizePt}pt`,
    "--doc-line-height": String(design.typography.lineHeight),
    "--doc-heading-size": `${design.typography.headingSizePt}pt`,
    "--doc-subheading-size": `${design.typography.subheadingSizePt}pt`,
    "--doc-section-heading-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--doc-entry-heading-size": `${design.typography.entryHeadingSizePt}pt`,
    "--doc-heading-weight": String(design.typography.headingWeight),
    "--doc-subheading-weight": String(design.typography.subheadingWeight),
    "--doc-section-heading-weight": String(design.typography.sectionHeadingWeight),
    "--kompakt-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--doc-font": getDocumentFont(design.typography.fontId).family,
    "--doc-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--letter-body-size": "11pt",
    "--letter-subject-size": "13pt",
  };
};

/** Applied after historical template CSS on both rendering surfaces. */
export const kompaktResolvedCss = `
.kompakt-template,.kompakt-pdf{--kompakt-margin:var(--kompakt-margin-left);--kompakt-body-size:var(--doc-body-size);--kompakt-line-height:var(--doc-line-height);--kompakt-section-gap:var(--kompakt-section-gap-base);--kompakt-entry-gap:var(--kompakt-entry-gap-base);--managed-primary:var(--kompakt-primary);--managed-accent:var(--kompakt-accent);--managed-text:var(--kompakt-text);--managed-muted:var(--kompakt-muted);--managed-divider:var(--kompakt-divider);--managed-pattern:var(--kompakt-pattern);--managed-margin:var(--kompakt-margin-left);--managed-section-gap:var(--kompakt-section-gap);--managed-entry-gap:var(--kompakt-entry-gap);font-family:var(--doc-font);font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kompakt-text);background:var(--kompakt-background)}
.kompakt-template[data-density="compact"],.kompakt-pdf[data-density="compact"]{--kompakt-section-gap:calc(var(--kompakt-section-gap-base) * .85);--kompakt-entry-gap:calc(var(--kompakt-entry-gap-base) * .85)}
.kompakt-template[data-density="dense"],.kompakt-pdf[data-density="dense"]{--kompakt-section-gap:calc(var(--kompakt-section-gap-base) * .65);--kompakt-entry-gap:calc(var(--kompakt-entry-gap-base) * .65)}
.kompakt-template .kompakt-background,.kompakt-pdf .managed-pdf-background{color:var(--kompakt-pattern);opacity:.72}
.kompakt-template .kompakt-header,.kompakt-pdf .kompakt-pdf-header{min-height:var(--kompakt-header-height);padding:var(--kompakt-margin-top) var(--kompakt-margin-right) 0 var(--kompakt-margin-left)}
.kompakt-template .kompakt-header h1,.kompakt-pdf .kompakt-pdf-header h1{max-width:calc(100% - 25mm);font-family:var(--doc-heading-font);font-size:var(--doc-heading-size);font-weight:var(--doc-heading-weight);color:var(--kompakt-primary);line-height:1;overflow-wrap:anywhere}
.kompakt-template .kompakt-header h2,.kompakt-pdf .kompakt-pdf-header h2{max-width:calc(100% - 25mm);font-family:var(--doc-heading-font);font-size:var(--doc-subheading-size);font-weight:var(--doc-subheading-weight);line-height:var(--doc-line-height);color:var(--kompakt-subheading)}
.kompakt-template .kompakt-header:not(.kompakt-header--with-photo) h1,.kompakt-template .kompakt-header:not(.kompakt-header--with-photo) h2,.kompakt-pdf .kompakt-pdf-header:not(.with-photo) h1,.kompakt-pdf .kompakt-pdf-header:not(.with-photo) h2{max-width:100%}
.kompakt-template .kompakt-header__photo,.kompakt-pdf .kompakt-pdf-photo{right:var(--kompakt-margin-right)}
.kompakt-template .kompakt-header--with-photo,.kompakt-pdf .kompakt-pdf-header.with-photo{padding-bottom:calc(20mm * (var(--resume-photo-scale,1) - 1))}
.kompakt-template .kompakt-header--compact,.kompakt-pdf .kompakt-pdf-header.compact{min-height:0;padding-top:var(--kompakt-margin-top);padding-bottom:2mm;border-color:var(--kompakt-divider)}
.kompakt-template .kompakt-header--compact h1,.kompakt-pdf .kompakt-pdf-header.compact h1{font-size:calc(var(--doc-heading-size) * .72)}
.kompakt-template .kompakt-header--compact h2,.kompakt-pdf .kompakt-pdf-header.compact h2{font-size:var(--doc-subheading-size)}
.kompakt-template .kompakt-header--compact>p,.kompakt-pdf .kompakt-pdf-header.compact .kicker{color:var(--kompakt-accent);font-size:calc(var(--doc-body-size) * .82)}
.kompakt-template .kompakt-content,.kompakt-pdf .kompakt-pdf-columns{grid-template-columns:minmax(0,97fr) minmax(0,60fr);column-gap:var(--kompakt-column-gap);padding-left:var(--kompakt-margin-left);padding-right:var(--kompakt-margin-right);padding-bottom:var(--kompakt-footer-clearance)}
.kompakt-template .kompakt-content>.kompakt-left,.kompakt-pdf .kompakt-pdf-columns>main{min-width:0}
.kompakt-template .kompakt-content>.kompakt-right,.kompakt-pdf .kompakt-pdf-columns>aside{min-width:0}
.kompakt-template .kompakt-content:not(.kompakt-content--continuation),.kompakt-pdf .kompakt-pdf-columns:not(.continuation){padding-top:var(--kompakt-header-content-gap)}
.kompakt-template .kompakt-content--continuation,.kompakt-pdf .kompakt-pdf-columns.continuation{padding-top:4mm}
.kompakt-template .kompakt-section,.kompakt-pdf .managed-pdf-section{margin-bottom:var(--kompakt-section-gap)}
.kompakt-template .kompakt-section__title,.kompakt-pdf .managed-pdf-title,.kompakt-template [data-cv-heading],.kompakt-pdf [data-cv-heading]{margin-bottom:var(--kompakt-section-title-gap);font-family:var(--doc-heading-font);font-size:var(--doc-section-heading-size);font-weight:var(--doc-section-heading-weight);line-height:var(--doc-line-height);color:var(--kompakt-section-heading);border-color:var(--kompakt-divider);text-transform:var(--kompakt-heading-case)}
.kompakt-template .kompakt-summary,.kompakt-pdf .managed-pdf-section>p{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kompakt-paragraph)}
.kompakt-template .kompakt-career__list,.kompakt-pdf .managed-pdf-list{gap:var(--kompakt-entry-gap)}
.kompakt-template .kompakt-career-entry h3,.kompakt-pdf .kompakt-pdf-entry h3{font-family:var(--doc-heading-font);font-size:var(--doc-entry-heading-size);font-weight:600;line-height:var(--doc-line-height);letter-spacing:-.025em;color:var(--kompakt-entry-heading)}
.kompakt-template .kompakt-career-entry__heading time,.kompakt-pdf .kompakt-pdf-entry-heading time,.kompakt-template .kompakt-career-entry__meta,.kompakt-pdf .kompakt-pdf-meta{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height);color:var(--kompakt-muted)}
.kompakt-template .kompakt-career-entry__meta,.kompakt-pdf .kompakt-pdf-meta{margin:var(--kompakt-entry-content-gap) 0 1mm}
.kompakt-template .kompakt-career-entry__meta strong,.kompakt-pdf .kompakt-pdf-meta strong{font-size:var(--doc-body-size);font-weight:600;line-height:var(--doc-line-height);color:var(--kompakt-accent)}
.kompakt-template .kompakt-career-entry li,.kompakt-pdf .kompakt-pdf-entry li{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kompakt-paragraph)}
.kompakt-template .kompakt-contacts address,.kompakt-pdf .kompakt-pdf-contacts{gap:calc(var(--kompakt-entry-gap) * .8)}
.kompakt-template .kompakt-contacts :is(a,span),.kompakt-pdf .kompakt-pdf-contact :is(a,span){font-size:calc(var(--doc-body-size) * .92);line-height:var(--doc-line-height);color:var(--kompakt-primary);overflow-wrap:anywhere}
.kompakt-template .kompakt-contacts i,.kompakt-pdf .kompakt-pdf-contact i,.kompakt-template .kompakt-strengths article>i,.kompakt-pdf .kompakt-pdf-strength>i{color:var(--kompakt-icon);font-size:var(--doc-body-size)}
.kompakt-template .kompakt-strengths article,.kompakt-pdf .kompakt-pdf-strength{margin-bottom:var(--kompakt-entry-gap)}
.kompakt-pdf .kompakt-pdf-strength:last-child{margin-bottom:0}
.kompakt-template .kompakt-strengths h3,.kompakt-pdf .kompakt-pdf-strength h3{font-family:var(--doc-heading-font);font-size:var(--doc-body-size);font-weight:600;line-height:var(--doc-line-height);color:var(--kompakt-primary)}
.kompakt-template .kompakt-strengths p,.kompakt-pdf .kompakt-pdf-strength p{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kompakt-paragraph)}
.kompakt-template .kompakt-skills span,.kompakt-pdf .kompakt-pdf-skill{font-size:calc(var(--doc-body-size) * .94);line-height:var(--doc-line-height);font-weight:600;color:var(--kompakt-primary);border-color:var(--kompakt-divider)}
.kompakt-template .kompakt-languages strong,.kompakt-pdf .kompakt-pdf-language strong{font-size:var(--doc-body-size);line-height:var(--doc-line-height);color:var(--kompakt-primary)}
.kompakt-template .kompakt-languages article>span:not(.kompakt-language__dots),.kompakt-pdf .kompakt-pdf-language .resume-language-description,.kompakt-template .resume-language-level,.kompakt-pdf .resume-language-level{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height);color:var(--kompakt-muted)}
.kompakt-template .kompakt-language__dots i,.kompakt-pdf .kompakt-pdf-language .managed-pdf-dots i{width:calc(var(--doc-body-size) * .8);height:calc(var(--doc-body-size) * .8);background:var(--kompakt-inactive)}
.kompakt-template .kompakt-language__dots i.filled,.kompakt-pdf .kompakt-pdf-language .managed-pdf-dots i.filled{background:var(--kompakt-accent)}
.kompakt-template [data-managed-section],.kompakt-pdf [data-managed-section]{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kompakt-template [data-managed-section] :is(p,li,strong,span),.kompakt-pdf [data-managed-section] :is(p,li,strong,span){line-height:var(--doc-line-height)}
.kompakt-template [data-managed-section^="special:"] :is([data-custom-role="entry"],li,p),.kompakt-pdf [data-managed-section^="special:"] :is([data-custom-role="entry"],li,p){font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kompakt-template [data-managed-section="strengths"] .managed-strengths-grid,.kompakt-pdf [data-managed-section="strengths"] .managed-strengths-grid{gap:calc(var(--kompakt-entry-gap) * .5)}
.kompakt-template [data-managed-section="strengths"] .managed-strength-card :is(strong,p),.kompakt-pdf [data-managed-section="strengths"] .managed-strength-card :is(strong,p){font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kompakt-template .resume-language-primary,.kompakt-pdf .resume-language-primary{font-size:var(--doc-body-size);line-height:var(--doc-line-height)}
.kompakt-template .resume-language-description,.kompakt-pdf .resume-language-description{font-size:calc(var(--doc-body-size) * .88);line-height:var(--doc-line-height)}
.kompakt-template .kompakt-footer,.kompakt-pdf .managed-pdf-footer{left:var(--kompakt-margin-left);right:var(--kompakt-margin-right);bottom:6mm;font-size:calc(var(--doc-body-size) * .82);color:var(--kompakt-muted)}
.kompakt-template .kompakt-footer a,.kompakt-pdf .managed-pdf-footer a{color:var(--kompakt-primary)}
.kompakt-template [data-resume-closing-placement="footer"],.cv-sheet[data-template="kompakt"] [data-resume-closing-placement="footer"]{left:var(--kompakt-margin-left);right:var(--kompakt-margin-right);bottom:13mm}
`;

/** The same resolved identity, palette and type family on both letter surfaces. */
export const kompaktLetterCss = `
.kompakt-letter :is(.letter-preview,.letter-content){padding:var(--kompakt-margin-top) var(--kompakt-margin-right) var(--kompakt-margin-bottom) var(--kompakt-margin-left)!important;color:var(--kompakt-text);font-family:var(--doc-font)!important;background:var(--kompakt-background)}
.kompakt-letter .letter-header{display:flex;justify-content:flex-start;align-items:flex-start;min-height:24mm;padding:0 0 1mm;text-align:left}
.kompakt-letter :is(.sender,.sender-line){margin:0;color:var(--kompakt-text);text-align:left}
.kompakt-letter .sender-name{color:var(--kompakt-primary)!important;font-family:var(--doc-heading-font);font-size:var(--doc-heading-size)!important;font-weight:var(--doc-heading-weight)!important;line-height:1;text-transform:uppercase}
.kompakt-letter .sender-title{color:var(--kompakt-subheading)!important;font-family:var(--doc-heading-font);font-size:var(--doc-subheading-size)!important;font-weight:var(--doc-subheading-weight)!important;line-height:var(--doc-line-height)}
.kompakt-letter .sender-contact{color:var(--kompakt-primary)!important;font-size:var(--letter-body-size)!important;line-height:1.25;overflow-wrap:anywhere}
.kompakt-letter :is(.letter-rule,.paper-rule){height:.3mm!important;margin:0!important;background:var(--kompakt-divider)!important}
.kompakt-letter :is(.recipient,.date,address,.paper-date,.letter-salutation,.letter-body,.letter-closing,.signature,.letter-signature,.signature-name){color:var(--kompakt-text);font-size:var(--letter-body-size)!important}
.kompakt-letter :is(.recipient,address){min-height:20mm;margin-top:20mm;line-height:1.28}
.kompakt-letter :is(.date,.paper-date){margin:0 0 20mm;text-align:right;line-height:1.28}
.kompakt-letter :is(.subject,.letter-subject,.letter-preview h3){margin:0 0 6mm;color:var(--kompakt-primary)!important;font-family:var(--doc-heading-font);font-size:var(--letter-subject-size)!important;font-weight:var(--doc-section-heading-weight)!important;line-height:1.2}
.kompakt-letter :is(.letter-preview,.letter-content)>.letter-salutation,.kompakt-letter :is(.letter-preview,.letter-content)>.letter-body{margin:0 0 3.2mm!important;line-height:1.28}
.kompakt-letter :is(.letter-preview,.letter-content)>.letter-closing{margin-bottom:0!important}
.kompakt-letter :is(.letter-signature,.signature){margin:3.2mm 0 0!important;line-height:1.28}
.kompakt-letter :is(.attachments-note,.letter-attachments){color:var(--kompakt-muted)}
`;
