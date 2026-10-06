import { getDocumentFont, getColorContrastRatio, type DocumentDesignSettings } from "./documentDesign";
import { resolveTemplateCvDesign } from "./cvDesign";
import type { CvDesignTokens } from "./cvDesignSchema";
import { elegantDefaults } from "./cvTemplateDefaults/elegant.defaults";
import { resolveResumeAppearance } from "./resumeDesignSystem";
import { getReadableTextColor } from "./templates";

/** The same physical box and semantic tokens are handed to React, the planner and Electron. */
export const elegantGeometry = (spacing: CvDesignTokens["spacing"]) => {
  const margin = spacing.pageMarginMm;
  const inset = spacing.innerPaddingMm;
  const edge = (native: number) => Math.max(0, margin + native - elegantDefaults.layout.mainLeftMm) + inset;
  return {
    mainTop: edge(elegantDefaults.layout.mainTopMm),
    mainRight: edge(elegantDefaults.layout.mainRightMm),
    mainBottom: edge(elegantDefaults.layout.mainBottomMm),
    mainLeft: edge(elegantDefaults.layout.mainLeftMm),
    sidebarTop: edge(elegantDefaults.layout.sidebarTopMm),
    sidebarRight: edge(elegantDefaults.layout.sidebarRightMm),
    sidebarBottom: edge(elegantDefaults.layout.sidebarBottomMm),
    sidebarLeft: edge(elegantDefaults.layout.sidebarLeftMm),
  };
};

export const getElegantDesignVariables = (
  design: CvDesignTokens = resolveTemplateCvDesign("elegant"),
  settings?: DocumentDesignSettings,
  applicationAccent?: string,
  applicationSidebar?: string,
): Record<string, string> => {
  const appearance = resolveResumeAppearance("elegant", settings?.resumeAppearance);
  const selectedColors = settings?.cvOverrides?.colors;
  const accent = settings?.cvOverrides?.colors?.accent ? design.colors.accent : applicationAccent || design.colors.accent;
  const sidebar = settings?.resumeAppearance?.sidebarBackgroundColor
    ? appearance.sidebarBackgroundColor
    : selectedColors?.surface ? design.colors.surface : applicationSidebar || appearance.sidebarBackgroundColor;
  const readable = getReadableTextColor(sidebar);
  const contrast = (candidate: string) => getColorContrastRatio(candidate, sidebar) >= 4.5 ? candidate : readable;
  const sidebarText = contrast(appearance.sidebarTextColor);
  const sidebarMuted = contrast(elegantDefaults.colors.sidebarMutedText);
  const sidebarTitle = contrast(appearance.sidebarSectionHeadingColor);
  const typography = design.typography;
  const geometry = elegantGeometry(design.spacing);
  const size = (value: number) => `${Math.round(value * 100) / 100}pt`;
  const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;
  return {
    "--elegant-accent": accent,
    "--elegant-subheading": selectedColors?.subheading ? design.colors.subheading : accent,
    "--elegant-icon": selectedColors?.icon ? design.colors.icon : accent,
    "--elegant-sidebar": sidebar,
    "--elegant-sidebar-text": sidebarText,
    "--elegant-sidebar-muted": sidebarMuted,
    "--elegant-sidebar-title": sidebarTitle,
    "--elegant-sidebar-width": `${elegantDefaults.layout.sidebarWidthMm}mm`,
    "--elegant-heading": design.colors.heading,
    "--elegant-section-heading": selectedColors?.sectionHeading ? design.colors.sectionHeading : selectedColors?.heading ? design.colors.heading : design.colors.sectionHeading,
    "--elegant-entry-heading": selectedColors?.entryHeading ? design.colors.entryHeading : selectedColors?.heading ? design.colors.heading : design.colors.entryHeading,
    "--elegant-text": selectedColors?.paragraph ? design.colors.paragraph : selectedColors?.text ? design.colors.text : design.colors.paragraph,
    "--elegant-muted": design.colors.muted,
    "--elegant-line": selectedColors?.divider ? design.colors.divider
      : selectedColors?.heading ? `color-mix(in srgb, ${design.colors.heading}, ${design.colors.background} 55%)` : design.colors.divider,
    "--elegant-paper": settings?.resumeAppearance?.mainBackgroundColor
      ? appearance.mainBackgroundColor : design.colors.background,
    "--elegant-font": getDocumentFont(typography.fontId).family,
    "--elegant-heading-font": getDocumentFont(typography.headingFontId).family,
    "--elegant-name-size": size(typography.headingSizePt),
    "--elegant-profession-size": size(typography.subheadingSizePt),
    "--elegant-section-title-size": size(typography.sectionHeadingSizePt),
    "--elegant-sidebar-title-size": size(typography.sectionHeadingSizePt - 0.5),
    "--elegant-entry-title-size": size(typography.entryHeadingSizePt),
    "--elegant-organization-size": size(typography.bodySizePt),
    "--elegant-body-size": size(typography.bodySizePt),
    "--elegant-small-size": size(Math.max(9, typography.bodySizePt * 0.9)),
    "--elegant-kicker-size": size(Math.max(8.5, typography.bodySizePt * 0.85)),
    "--elegant-footer-size": size(Math.max(8.5, typography.bodySizePt * 0.82)),
    "--elegant-line-height": String(typography.lineHeight),
    "--elegant-heading-weight": String(typography.headingWeight),
    "--elegant-subheading-weight": String(typography.subheadingWeight),
    "--elegant-section-weight": String(typography.sectionHeadingWeight),
    "--elegant-section-transform": typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--elegant-margin": mm(design.spacing.pageMarginMm),
    "--elegant-base-section-gap": mm(design.spacing.sectionGapMm),
    "--elegant-base-entry-gap": mm(design.spacing.entryGapMm),
    "--elegant-title-gap": mm(design.spacing.sectionTitleGapMm),
    "--elegant-content-gap": mm(design.spacing.entryContentGapMm),
    "--elegant-main-top": mm(geometry.mainTop),
    "--elegant-main-right": mm(geometry.mainRight),
    "--elegant-main-bottom": mm(geometry.mainBottom),
    "--elegant-footer-bottom": mm(Math.max(0, geometry.mainBottom - 8)),
    "--elegant-main-left": mm(geometry.mainLeft),
    "--elegant-sidebar-top": mm(geometry.sidebarTop),
    "--elegant-sidebar-right": mm(geometry.sidebarRight),
    "--elegant-sidebar-bottom": mm(geometry.sidebarBottom),
    "--elegant-sidebar-left": mm(geometry.sidebarLeft),
  };
};

/** One selector set styles the React letter and the Electron print letter. */
export const elegantLetterCss = `
.elegant-letter .letter-preview,.elegant-letter .letter-content{font-family:var(--elegant-font)!important;color:var(--elegant-text)!important;padding:25mm 20mm 15mm 25mm!important}
.elegant-letter :is(.sender-name){color:var(--elegant-heading)!important;font-family:var(--elegant-heading-font)!important;font-size:16pt!important;font-weight:var(--elegant-heading-weight)!important;text-transform:uppercase}
.elegant-letter :is(.sender-title){color:var(--elegant-subheading)!important;font-family:var(--elegant-heading-font)!important;font-size:11pt!important;font-weight:var(--elegant-subheading-weight)!important}
.elegant-letter :is(.sender-contact){color:var(--elegant-muted)!important;font-size:9.5pt!important}
.elegant-letter :is(.letter-header){display:flex!important;min-height:0!important;align-items:flex-start!important;justify-content:center!important;padding-bottom:1mm!important}
.elegant-letter :is(.sender-line,.sender){width:100%!important;margin:0!important;text-align:center!important}
.elegant-letter :is(.letter-rule){background:var(--elegant-accent)!important;height:.35mm!important}
.elegant-letter :is(address,.recipient){min-height:20mm!important;margin:20mm 0 0!important}
.elegant-letter :is(.paper-date,.date){margin:0 0 20mm!important;text-align:right!important}
.elegant-letter.letter-gap-1 :is(.paper-date,.date){margin-bottom:16mm!important}
.elegant-letter.letter-gap-2 :is(.paper-date,.date){margin-bottom:12mm!important}
.elegant-letter.letter-gap-3 :is(.paper-date,.date){margin-bottom:8mm!important}
.elegant-letter.letter-gap-4 :is(.paper-date,.date){margin-bottom:4mm!important}
.elegant-letter.letter-dense :is(address,.recipient){min-height:18mm!important;margin-top:17mm!important}
.elegant-letter.letter-dense :is(.paper-date,.date){margin-bottom:15mm!important}
.elegant-letter.letter-dense.letter-gap-1 :is(.paper-date,.date){margin-bottom:11mm!important}
.elegant-letter.letter-dense.letter-gap-2 :is(.paper-date,.date){margin-bottom:7mm!important}
.elegant-letter.letter-dense.letter-gap-3 :is(.paper-date,.date){margin-bottom:3mm!important}
.elegant-letter.letter-dense.letter-gap-4 :is(.paper-date,.date){margin-bottom:0!important}
.elegant-letter :is(address,.recipient,.paper-date,.date,.letter-salutation,.letter-body,.letter-closing,.letter-signature,.signature,.signature-name){color:var(--elegant-text)!important;font-family:var(--elegant-font)!important;font-size:11pt!important;line-height:1.35!important}
.elegant-letter :is(.paper-date,.date){color:var(--elegant-muted)!important}
.elegant-letter :is(h3.letter-subject,.subject){margin:0 0 6mm!important;padding:0!important;border:0!important;color:var(--elegant-heading)!important;font-family:var(--elegant-heading-font)!important;font-size:13pt!important;font-weight:var(--elegant-section-weight)!important;line-height:1.2!important}
.elegant-letter :is(.letter-salutation){margin:0 0 3.2mm!important}
.elegant-letter :is(.letter-body){margin:0 0 3.2mm!important;text-align:justify!important;hyphens:auto!important;overflow-wrap:break-word!important}
.elegant-letter :is(.letter-closing){margin-bottom:0!important}
.elegant-letter :is(.letter-signature,.signature){display:flex!important;flex-direction:column!important;align-items:flex-start!important;margin:3.2mm 0 0!important}
.elegant-letter :is(.letter-signature,.signature)>:is(p,span){margin:0!important;font-size:11pt!important;line-height:1.35!important}
.elegant-letter :is(.attachments-note){color:var(--elegant-muted)!important}
`;

/** Managed sections are rebuilt after the native template renders; these rules keep their metrics identical. */
export const elegantManagedCss = `
:is(.elegant-template,.elegant-pdf) .resume-special-output-list{gap:0}
.elegant-pdf-continuation>[data-managed-section]{margin-top:var(--elegant-section-gap)!important}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation{display:flex;flex-direction:column;min-width:0;color:var(--elegant-sidebar-muted)}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>:is(p,h2,span,small){margin:0}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>p{color:var(--elegant-accent);font-size:var(--elegant-kicker-size);font-weight:700;letter-spacing:.16em;text-transform:uppercase}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>h2{margin-top:3.5mm;color:var(--elegant-sidebar-title);font-family:var(--elegant-heading-font);font-size:calc(var(--elegant-name-size) * .62);font-weight:700;letter-spacing:0!important;line-height:var(--elegant-line-height);overflow-wrap:break-word}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>span{margin-top:1.8mm;font-size:var(--elegant-small-size);line-height:var(--elegant-line-height);overflow-wrap:anywhere}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>i{width:18mm;height:.6mm;margin:6mm 0;background:var(--elegant-accent)}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>small{margin-bottom:5mm;font-size:var(--elegant-small-size);letter-spacing:.03em}
:is(.elegant-template,.elegant-pdf) .elegant-sidebar__continuation>a{margin-top:1.7mm;color:var(--elegant-sidebar-text);font-size:var(--elegant-small-size);text-decoration:none;overflow-wrap:anywhere}
:is(.elegant-template,.elegant-pdf) [data-managed-section]{font-size:var(--elegant-body-size)!important;line-height:var(--elegant-line-height)!important}
:is(.elegant-template,.elegant-pdf) [data-managed-section] :is(p,li,.managed-item-text,.managed-strength-card strong,.managed-knowledge-category h4,.managed-knowledge-category h5){font-size:var(--elegant-body-size)!important;line-height:var(--elegant-line-height)!important}
:is(.elegant-template,.elegant-pdf) [data-managed-section="languages"] :is(.resume-language-level,.resume-language-description){font-size:var(--elegant-small-size)!important;line-height:var(--elegant-line-height)!important}
:is(.elegant-template,.elegant-pdf) [data-managed-section="languages"] [data-resume-language-dots]{color:var(--elegant-sidebar-text)!important}
:is(.elegant-sidebar,.elegant-pdf-sidebar) :is(.managed-strength-card strong,.managed-knowledge-category h4,.managed-knowledge-category h5){color:var(--elegant-sidebar-title)!important}
:is(.elegant-sidebar,.elegant-pdf-sidebar) :is(.managed-strength-card p,.managed-item-text,[data-managed-section="certifications"] li){color:var(--elegant-sidebar-muted)!important}
`;
