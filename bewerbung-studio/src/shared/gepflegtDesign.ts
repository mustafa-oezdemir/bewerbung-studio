import type { CvDesignTokens } from "./cvDesignSchema";
import type { ResolvedResumeAppearance } from "./resumeAppearance";
import { getColorContrastRatio, getDocumentFont } from "./documentDesign";
import { getReadableTextColor } from "./templates";
import { gepflegtDefaults } from "./cvTemplateDefaults/gepflegt.defaults";

const mix = (first: string, second: string, firstShare: number) => `#${[1, 3, 5].map((index) =>
  Math.round(Number.parseInt(first.slice(index, index + 2), 16) * firstShare
    + Number.parseInt(second.slice(index, index + 2), 16) * (1 - firstShare))
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();

const readable = (preferred: string, background: string) => {
  if (getColorContrastRatio(preferred, background) >= 4.5) return preferred;
  const suggested = getReadableTextColor(background);
  const candidates = [suggested, "#FFFFFF", "#26313A"];
  return candidates.sort((a, b) => getColorContrastRatio(b, background) - getColorContrastRatio(a, background))[0];
};

/** Physical Gepflegt coordinates shared by the visual output and the planner. */
export const gepflegtGeometry = {
  pageWidthMm: gepflegtDefaults.page.widthMm,
  pageHeightMm: gepflegtDefaults.page.heightMm,
  sidebarWidthMm: gepflegtDefaults.layout.sidebarWidthMm,
  topBarHeightMm: gepflegtDefaults.layout.topBarHeightMm,
  sidebar: gepflegtDefaults.sidebar,
  main: gepflegtDefaults.main,
};

/** Semantic variables for both CV renderers and the independent DIN letter. */
export const getGepflegtDesignVariables = (
  design: CvDesignTokens,
  appearance: ResolvedResumeAppearance,
  changedColors: Partial<CvDesignTokens["colors"]> | undefined,
  applicationAccent?: string,
  applicationSecondary?: string,
): Record<string, string> => {
  const native = gepflegtDefaults.colors;
  const accent = changedColors?.accent ?? (applicationAccent && applicationAccent !== native.accent ? applicationAccent : design.colors.accent);
  const sidebar = appearance.sidebarBackgroundColor !== native.sidebarBackground
    ? appearance.sidebarBackgroundColor
    : applicationSecondary && applicationSecondary !== native.sidebarBackground ? applicationSecondary : appearance.sidebarBackgroundColor;
  const paletteChanged = accent.toLowerCase() !== native.accent.toLowerCase()
    || sidebar.toLowerCase() !== native.sidebarBackground.toLowerCase();
  const semantic = (key: keyof CvDesignTokens["colors"], nativeValue: string, derived: string) =>
    changedColors?.[key] ?? (paletteChanged && design.colors[key].toLowerCase() === nativeValue.toLowerCase()
      ? derived : design.colors[key]);
  const heading = semantic("heading", native.heading, mix(sidebar, "#26313A", .3));
  const text = semantic("text", native.text, mix(heading, "#4D5559", .35));
  const muted = semantic("muted", native.mutedText, mix(text, design.colors.background, .7));
  const sidebarText = readable(appearance.sidebarTextColor, sidebar);
  const sidebarTitle = readable(appearance.sidebarSectionHeadingColor, sidebar);
  const sidebarMuted = readable(paletteChanged ? mix(sidebarText, sidebar, .92) : native.sidebarMutedText, sidebar);
  const marginShift = design.spacing.pageMarginMm - nativeMargin;
  const sidePaddingLeft = Math.max(gepflegtDefaults.sidebar.paddingLeftMm, gepflegtDefaults.sidebar.paddingLeftMm + marginShift);
  return {
    "--gepflegt-sidebar-width": `${gepflegtGeometry.sidebarWidthMm}mm`,
    "--gepflegt-topbar-height": `${gepflegtGeometry.topBarHeightMm}mm`,
    "--gepflegt-sidebar-background": sidebar,
    "--gepflegt-topbar": paletteChanged ? mix(sidebar, heading, .72) : native.sidebarTopBar,
    "--gepflegt-sidebar-text": sidebarText,
    "--gepflegt-sidebar-title": sidebarTitle,
    "--gepflegt-sidebar-muted": sidebarMuted,
    "--gepflegt-accent": accent,
    "--gepflegt-heading": heading,
    "--gepflegt-section-heading": semantic("sectionHeading", native.heading, heading),
    "--gepflegt-entry-heading": semantic("entryHeading", native.heading, heading),
    "--gepflegt-subheading": semantic("subheading", native.accent, accent),
    "--gepflegt-organization": semantic("icon", native.accent, accent),
    "--gepflegt-icon": semantic("icon", native.accent, accent),
    "--gepflegt-text": text,
    "--gepflegt-paragraph": semantic("paragraph", native.text, text),
    "--gepflegt-muted": muted,
    "--gepflegt-divider": semantic("divider", native.divider, mix(heading, design.colors.background, .25)),
    "--gepflegt-paper": design.colors.background,
    "--gepflegt-sidebar-padding-top": `${gepflegtGeometry.sidebar.paddingTopMm}mm`,
    "--gepflegt-sidebar-padding-right": `${Math.max(gepflegtGeometry.sidebar.paddingRightMm, gepflegtGeometry.sidebar.paddingRightMm + marginShift)}mm`,
    "--gepflegt-sidebar-padding-bottom": `${gepflegtGeometry.sidebar.paddingBottomMm}mm`,
    "--gepflegt-sidebar-padding-left": `${sidePaddingLeft}mm`,
    "--gepflegt-photo-size": `${gepflegtGeometry.sidebar.photoSizeMm}mm`,
    "--gepflegt-photo-gap": `${gepflegtGeometry.sidebar.photoGapMm}mm`,
    "--gepflegt-main-padding-top": `${Math.max(gepflegtGeometry.main.paddingTopMm, gepflegtGeometry.main.paddingTopMm + marginShift)}mm`,
    "--gepflegt-main-padding-right": `${design.spacing.pageMarginMm}mm`,
    "--gepflegt-main-padding-bottom": `${Math.max(gepflegtGeometry.main.paddingBottomMm, gepflegtGeometry.main.paddingBottomMm + marginShift)}mm`,
    "--gepflegt-main-padding-left": `${Math.max(gepflegtGeometry.main.paddingLeftMm, gepflegtGeometry.main.paddingLeftMm + marginShift)}mm`,
    "--gepflegt-footer-bottom": `${gepflegtGeometry.main.footerBottomMm}mm`,
    "--gepflegt-header-gap-base": `${gepflegtGeometry.main.headerGapMm}mm`,
    "--gepflegt-section-gap-base": `${design.spacing.sectionGapMm}mm`,
    "--gepflegt-entry-gap-base": `${design.spacing.entryGapMm}mm`,
    "--gepflegt-section-title-gap": `${design.spacing.sectionTitleGapMm}mm`,
    "--gepflegt-entry-content-gap": `${design.spacing.entryContentGapMm}mm`,
    "--gepflegt-name-size": `${design.typography.headingSizePt}pt`,
    "--gepflegt-title-size": `${design.typography.subheadingSizePt}pt`,
    "--gepflegt-section-title-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--gepflegt-sidebar-title-size": `calc(${design.typography.sectionHeadingSizePt}pt * ${gepflegtDefaults.typography.sidebarTitleSizePt / gepflegtDefaults.typography.sectionTitleSizePt})`,
    "--gepflegt-entry-title-size": `${design.typography.entryHeadingSizePt}pt`,
    "--gepflegt-body-size": `${design.typography.bodySizePt}pt`,
    "--gepflegt-small-size": `max(9pt, calc(${design.typography.bodySizePt}pt * .88))`,
    "--gepflegt-line-height": String(design.typography.lineHeight),
    "--gepflegt-name-weight": String(design.typography.headingWeight),
    "--gepflegt-title-weight": String(design.typography.subheadingWeight),
    "--gepflegt-section-weight": String(design.typography.sectionHeadingWeight),
    "--gepflegt-entry-weight": String(design.typography.subheadingWeight),
    "--gepflegt-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--gepflegt-font": getDocumentFont(design.typography.fontId).family,
    "--gepflegt-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--letter-body-size": "11pt",
    "--letter-subject-size": "13pt",
  };
};

const nativeMargin = gepflegtDefaults.main.paddingRightMm;
const both = (preview: string, pdf: string, declarations: string) =>
  `${[
    ...preview.split(",").map(selector => `.gepflegt-page:not(.gepflegt-page--ats) ${selector.trim()}`),
    ...pdf.split(",").map(selector => `.gepflegt-pdf:not(.gepflegt-pdf-ats) ${selector.trim()}`),
  ].join(",")}{${declarations}}`;
const visual = (declarations: string) =>
  `.gepflegt-page:not(.gepflegt-page--ats),.gepflegt-pdf:not(.gepflegt-pdf-ats){${declarations}}`;

/** Late, identical semantic rules over the two historical native stylesheets. */
export const gepflegtResolvedCss = [
  visual("--gepflegt-section-gap:var(--gepflegt-section-gap-base);--gepflegt-entry-gap:var(--gepflegt-entry-gap-base);--gepflegt-header-gap:var(--gepflegt-header-gap-base);font-family:var(--gepflegt-font);font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-text);background:var(--gepflegt-paper)"),
  `.gepflegt-page[data-density="compact"],.gepflegt-pdf[data-density="compact"]{--gepflegt-section-gap:calc(var(--gepflegt-section-gap-base) * .86);--gepflegt-entry-gap:calc(var(--gepflegt-entry-gap-base) * .85);--gepflegt-header-gap:calc(var(--gepflegt-header-gap-base) * .85)}`,
  `.gepflegt-page[data-density="dense"],.gepflegt-pdf[data-density="dense"]{--gepflegt-section-gap:calc(var(--gepflegt-section-gap-base) * .7);--gepflegt-entry-gap:calc(var(--gepflegt-entry-gap-base) * .7);--gepflegt-header-gap:calc(var(--gepflegt-header-gap-base) * .7)}`,
  `.gepflegt-page:not(.gepflegt-page--ats)::before,.gepflegt-pdf:not(.gepflegt-pdf-ats)::before{height:var(--gepflegt-topbar-height);background:var(--gepflegt-topbar)}`,
  `.gepflegt-layout,.gepflegt-pdf:not(.gepflegt-pdf-ats){grid-template-columns:var(--gepflegt-sidebar-width) minmax(0,1fr)}`,
  both(".gepflegt-sidebar", ".gepflegt-pdf-sidebar", "padding:var(--gepflegt-sidebar-padding-top) var(--gepflegt-sidebar-padding-right) var(--gepflegt-sidebar-padding-bottom) var(--gepflegt-sidebar-padding-left);color:var(--gepflegt-sidebar-text);background:var(--gepflegt-sidebar-background)"),
  both(".gepflegt-sidebar__photo", ".gepflegt-pdf-photo", "width:calc(var(--gepflegt-photo-size) * var(--resume-photo-scale,1));height:calc(var(--gepflegt-photo-size) * var(--resume-photo-scale,1));max-width:100%;margin-bottom:var(--gepflegt-photo-gap)"),
  both(".gepflegt-sidebar__section", ".gepflegt-pdf-sidebar section", "margin-bottom:var(--gepflegt-section-gap)"),
  both(".gepflegt-sidebar__title", ".gepflegt-pdf-sidebar h3", "margin-bottom:var(--gepflegt-section-title-gap);color:var(--gepflegt-sidebar-title);border-color:var(--gepflegt-sidebar-muted);font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-sidebar-title-size);font-weight:var(--gepflegt-section-weight);line-height:var(--gepflegt-line-height);text-transform:var(--gepflegt-heading-case)"),
  both(".gepflegt-sidebar__summary,.gepflegt-knowledge", ".gepflegt-pdf-summary,.gepflegt-pdf-knowledge", "font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-text)"),
  both(".gepflegt-strengths", ".gepflegt-pdf-strengths", "gap:var(--gepflegt-entry-gap)"),
  both(".gepflegt-strength h3", ".gepflegt-pdf-strength h4", "font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-body-size);font-weight:var(--gepflegt-entry-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-text)"),
  both(".gepflegt-strength p", ".gepflegt-pdf-strength p", "font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-muted)"),
  both(".gepflegt-languages", ".gepflegt-pdf-languages", "gap:calc(var(--gepflegt-entry-gap) * .8)"),
  both(".gepflegt-languages strong,.gepflegt-languages span", ".gepflegt-pdf-language strong,.gepflegt-pdf-language span", "font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height)"),
  both(".gepflegt-languages li > div > span,.resume-language-level,.resume-language-description", ".gepflegt-pdf-language em,.resume-language-level,.resume-language-description", "font-size:var(--gepflegt-small-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-muted)"),
  both(".gepflegt-language-dots i", ".gepflegt-pdf-dots i", "width:calc(var(--gepflegt-body-size) * .65);height:calc(var(--gepflegt-body-size) * .65);border-color:var(--gepflegt-sidebar-muted)"),
  both(".gepflegt-language-dots i.is-filled", ".gepflegt-pdf-dots i.filled", "border-color:var(--gepflegt-sidebar-text);background:var(--gepflegt-sidebar-text)"),
  both(".gepflegt-certifications li", ".gepflegt-pdf-certifications li", "font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-text)"),
  both(".gepflegt-content", ".gepflegt-pdf-content", "padding:var(--gepflegt-main-padding-top) var(--gepflegt-main-padding-right) var(--gepflegt-main-padding-bottom) var(--gepflegt-main-padding-left)"),
  both(".gepflegt-header", ".gepflegt-pdf-header", "margin-bottom:var(--gepflegt-header-gap)"),
  both(".gepflegt-header__name", ".gepflegt-pdf-header h1", "font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-name-size);font-weight:var(--gepflegt-name-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-heading)"),
  both(".gepflegt-header__title", ".gepflegt-pdf-header h2", "font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-title-size);font-weight:var(--gepflegt-title-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-subheading)"),
  both(".gepflegt-header__contacts", ".gepflegt-pdf-contacts", "font-size:var(--gepflegt-small-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-text)"),
  both(".gepflegt-header__contacts > a,.gepflegt-header__contacts > span", ".gepflegt-pdf-contact", "max-width:100%;min-width:0;overflow-wrap:anywhere"),
  both(".gepflegt-header__contacts :is(a,span) span", ".gepflegt-pdf-contact span", "white-space:normal;overflow-wrap:anywhere"),
  both(".gepflegt-header__contacts svg", ".gepflegt-pdf-contact svg", "color:var(--gepflegt-icon);stroke:var(--gepflegt-icon)"),
  both(".gepflegt-main", ".gepflegt-pdf-main", "gap:var(--gepflegt-section-gap)"),
  both(".gepflegt-section__title", ".gepflegt-pdf-title", "margin-bottom:var(--gepflegt-section-title-gap);font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-section-title-size);font-weight:var(--gepflegt-section-weight);line-height:var(--gepflegt-line-height);text-transform:var(--gepflegt-heading-case);color:var(--gepflegt-section-heading);border-color:var(--gepflegt-divider)"),
  both(".gepflegt-entry-list", ".gepflegt-pdf-list", "gap:var(--gepflegt-entry-gap)"),
  both(".gepflegt-entry__heading h3", ".gepflegt-pdf-entry-heading h4", "font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-entry-title-size);font-weight:var(--gepflegt-entry-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-entry-heading)"),
  both(".gepflegt-entry__heading span,.gepflegt-entry__subheading span", ".gepflegt-pdf-entry-heading span,.gepflegt-pdf-entry-subheading span", "font-size:var(--gepflegt-small-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-muted)"),
  both(".gepflegt-entry__subheading strong", ".gepflegt-pdf-entry-subheading strong", "font-size:var(--gepflegt-body-size);font-weight:var(--gepflegt-entry-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-organization)"),
  both(".gepflegt-entry li", ".gepflegt-pdf-entry li", "font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-paragraph)"),
  both(".gepflegt-footer", ".gepflegt-pdf-footer", "left:var(--gepflegt-main-padding-left);right:var(--gepflegt-main-padding-right);bottom:var(--gepflegt-footer-bottom);font-size:var(--gepflegt-small-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-muted)"),
  both(".gepflegt-header--compact", ".gepflegt-pdf-header.compact", "margin-bottom:var(--gepflegt-header-gap);border-color:var(--gepflegt-divider)"),
  both(".gepflegt-header--compact .gepflegt-header__name", ".gepflegt-pdf-header.compact h1", "font-size:calc(var(--gepflegt-name-size) * .67)"),
  both(".gepflegt-header--compact .gepflegt-header__title", ".gepflegt-pdf-header.compact h2", "font-size:var(--gepflegt-small-size)"),
  both(".gepflegt-sidebar__continuation h2", ".gepflegt-pdf-sidebar-continuation h2", "font-family:var(--gepflegt-heading-font);font-size:calc(var(--gepflegt-name-size) * .67);font-weight:var(--gepflegt-name-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-text)"),
  both(".gepflegt-sidebar__continuation > p,.gepflegt-sidebar__continuation > small,.gepflegt-sidebar__continuation > span", ".gepflegt-pdf-sidebar-continuation > div > p,.gepflegt-pdf-sidebar-continuation > div > small,.gepflegt-pdf-sidebar-continuation > div > span", "font-size:var(--gepflegt-small-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-sidebar-muted);overflow-wrap:anywhere"),
  `.gepflegt-page [data-managed-section],.gepflegt-pdf [data-managed-section]{font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height)}`,
  `.gepflegt-page [data-managed-section] :is(p,li,strong,span),.gepflegt-pdf [data-managed-section] :is(p,li,strong,span){line-height:var(--gepflegt-line-height)}`,
  `.gepflegt-page .managed-item-text,.gepflegt-pdf .managed-item-text{margin-top:0;font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height)}`,
  `.gepflegt-page :is([data-cv-heading],[data-custom-role="heading"]),.gepflegt-pdf :is([data-cv-heading],[data-custom-role="heading"]){font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-section-title-size);font-weight:var(--gepflegt-section-weight);line-height:var(--gepflegt-line-height);color:var(--gepflegt-section-heading);border-color:var(--gepflegt-divider);text-transform:var(--gepflegt-heading-case);margin-bottom:var(--gepflegt-section-title-gap)}`,
  `.gepflegt-page [data-managed-section] [data-cv-heading],.gepflegt-pdf [data-managed-section] [data-cv-heading]{line-height:var(--gepflegt-line-height)!important}`,
  `.gepflegt-page [data-cv-zone="sidebar"] :is([data-cv-heading],[data-custom-role="heading"]),.gepflegt-pdf [data-cv-zone="sidebar"] :is([data-cv-heading],[data-custom-role="heading"]){font-size:var(--gepflegt-sidebar-title-size);color:var(--gepflegt-sidebar-title);border-color:var(--gepflegt-sidebar-muted)}`,
  `.gepflegt-page [data-managed-section] [data-custom-role="body"],.gepflegt-pdf [data-managed-section] [data-custom-role="body"]{font-size:var(--gepflegt-body-size);line-height:var(--gepflegt-line-height);color:var(--gepflegt-paragraph)}`,
  `.gepflegt-page [data-resume-closing-placement="footer"],.cv-sheet[data-template="gepflegt"] [data-resume-closing-placement="footer"]{left:calc(var(--gepflegt-sidebar-width) + var(--gepflegt-main-padding-left));right:var(--gepflegt-main-padding-right);bottom:25mm;font-size:var(--gepflegt-small-size);color:var(--gepflegt-muted)}`,
].join("\n");

/** Shared DIN letter rules; preview and Electron consume the same CSS string. */
export const gepflegtLetterCss = `
.gepflegt-letter :is(.letter-preview,.letter-content){padding:14mm 20mm 16mm 25mm!important;background:var(--gepflegt-paper);color:var(--gepflegt-text);font-family:var(--gepflegt-font)!important}
.gepflegt-letter .letter-header{display:flex;justify-content:flex-start;align-items:flex-start;min-height:24mm;padding:0 0 1mm;text-align:left}
.gepflegt-letter :is(.sender,.sender-line){margin:0;color:var(--gepflegt-text);text-align:left}
.gepflegt-letter .sender-name{color:var(--gepflegt-heading)!important;font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-name-size)!important;font-weight:var(--gepflegt-name-weight)!important;line-height:var(--gepflegt-line-height);text-transform:uppercase;overflow-wrap:anywhere}
.gepflegt-letter .sender-title{color:var(--gepflegt-subheading)!important;font-family:var(--gepflegt-heading-font);font-size:var(--gepflegt-title-size)!important;font-weight:var(--gepflegt-title-weight)!important;line-height:var(--gepflegt-line-height)}
.gepflegt-letter .sender-contact{color:var(--gepflegt-text)!important;font-size:var(--letter-body-size)!important;line-height:1.28;overflow-wrap:anywhere}
.gepflegt-letter :is(.letter-rule,.paper-rule){height:.35mm!important;margin:0!important;background:var(--gepflegt-divider)!important}
.gepflegt-letter :is(.recipient,.date,address,.paper-date,.letter-salutation,.letter-body,.letter-closing,.signature,.letter-signature,.signature-name){color:var(--gepflegt-text);font-size:var(--letter-body-size)!important}
.gepflegt-letter :is(.recipient,address){min-height:20mm;margin-top:20mm;line-height:1.28}
.gepflegt-letter :is(.date,.paper-date){margin:0 0 20mm;text-align:right;line-height:1.28}
.gepflegt-letter :is(.subject,.letter-subject,.letter-preview h3){margin:0 0 6mm;color:var(--gepflegt-section-heading)!important;font-family:var(--gepflegt-heading-font);font-size:var(--letter-subject-size)!important;font-weight:var(--gepflegt-section-weight)!important;line-height:1.2}
.gepflegt-letter :is(.letter-preview,.letter-content)>.letter-salutation,.gepflegt-letter :is(.letter-preview,.letter-content)>.letter-body{margin:0 0 3.2mm!important;line-height:1.28}
.gepflegt-letter :is(.letter-preview,.letter-content)>.letter-closing{margin-bottom:0!important}
.gepflegt-letter :is(.letter-signature,.signature){margin:3.2mm 0 0!important;line-height:1.28}
.gepflegt-letter :is(.attachments-note,.letter-attachments){color:var(--gepflegt-muted)}
`;
