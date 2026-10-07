import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { klassischDefaults } from "./cvTemplateDefaults/klassisch.defaults";
import type { ApplicantProfile } from "./schema";
import { formatPhoneForDisplay, formatResumeAddress, formatResumeBirth, formatResumeContactLine, getResumeFullName, getResumeLinkContacts, getResumePersonalDetails } from "./resumePersonalData";
import { textWidthMm, wrappedLines } from "./textMetrics";

const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;

/**
 * The one physical page geometry of Klassisch for the preview, the PDF and the page planner. "Seitenränder" is a
 * horizontal control here: without a chosen value the native DIN-oriented text box applies (25 mm left, 20 mm right);
 * a chosen value N sets both side margins to N mm. Header, sections and footer share these two edges. The top (25 mm)
 * and the bottom (20 mm) never move with it, so the vertical capacity of a page stays the same.
 */
export const resolveKlassischGeometry = (pageMarginMm?: number) => {
  const { page } = klassischDefaults;
  const native = pageMarginMm === undefined || Math.abs(pageMarginMm - page.marginLeftMm) < 0.05;
  const left = native ? page.marginLeftMm : Math.max(0, pageMarginMm);
  const right = native ? page.marginRightMm : Math.max(0, pageMarginMm);
  return {
    left,
    right,
    top: page.marginTopMm,
    bottom: page.marginBottomMm,
    contentWidth: Math.max(0, page.widthMm - left - right),
    /** Lowest y (mm) the flowing text may reach. */
    contentBottom: page.heightMm - page.marginBottomMm,
  };
};

/**
 * One resolved set of Klassisch variables for both rendering surfaces (the stylesheets `klassisch.css` and
 * `klassischDocumentCss` only reference them): geometry, typography, spacing and the neutral palette. The two
 * application colours (`--klassisch-primary`, `--klassisch-accent`) stay with the template's colour handling.
 */
export const getKlassischDesignVariables = (design: CvDesignTokens): Record<string, string> => {
  const { typography: type, layout } = klassischDefaults;
  const geometry = resolveKlassischGeometry(design.spacing.pageMarginMm);
  return {
    "--klassisch-margin-left": mm(geometry.left),
    "--klassisch-margin-right": mm(geometry.right),
    "--klassisch-margin-top": mm(geometry.top),
    "--klassisch-margin-bottom": mm(geometry.bottom),
    "--klassisch-footer-bottom": mm(layout.footerBottomMm),
    "--klassisch-font": getDocumentFont(design.typography.fontId).family,
    "--klassisch-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--klassisch-body-size": `${design.typography.bodySizePt}pt`,
    "--klassisch-line-height": String(design.typography.lineHeight),
    "--klassisch-name-size": `${design.typography.headingSizePt}pt`,
    "--klassisch-name-weight": String(design.typography.headingWeight),
    "--klassisch-name-line-height": String(type.nameLineHeight),
    "--klassisch-continuation-name-size": `${type.continuationNameSizePt}pt`,
    "--klassisch-title-size": `${design.typography.subheadingSizePt}pt`,
    "--klassisch-title-weight": String(design.typography.subheadingWeight),
    "--klassisch-section-heading-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--klassisch-section-heading-weight": String(design.typography.sectionHeadingWeight),
    "--klassisch-section-heading-tracking": `${type.sectionHeadingTrackingEm}em`,
    "--klassisch-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--klassisch-heading-line-height": String(type.headingLineHeight),
    "--klassisch-entry-heading-size": `${design.typography.entryHeadingSizePt}pt`,
    "--klassisch-entry-heading-weight": String(type.entryHeadingWeight),
    "--klassisch-organization-weight": String(type.organizationWeight),
    "--klassisch-meta-size": `${type.metaSizePt}pt`,
    "--klassisch-contact-size": `${type.contactSizePt}pt`,
    "--klassisch-contact-line-height": String(type.contactLineHeight),
    "--klassisch-footer-size": `${type.footerSizePt}pt`,
    "--klassisch-photo-size": mm(layout.photoSizeMm),
    "--klassisch-photo-gap": mm(layout.photoGapMm),
    "--klassisch-title-gap": mm(layout.titleGapMm),
    "--klassisch-contacts-gap": mm(layout.contactsGapMm),
    "--klassisch-contact-column-gap": mm(layout.contactColumnGapMm),
    "--klassisch-contact-row-gap": mm(layout.contactRowGapMm),
    "--klassisch-contact-icon": mm(layout.contactIconMm),
    "--klassisch-contact-icon-gap": mm(layout.contactIconGapMm),
    "--klassisch-strength-icon": mm(layout.strengthIconMm),
    "--klassisch-header-padding": mm(layout.headerPaddingBottomMm),
    "--klassisch-rule": mm(layout.ruleWidthMm),
    "--klassisch-header-gap": mm(layout.headerGapMm),
    "--klassisch-section-gap-base": mm(design.spacing.sectionGapMm),
    "--klassisch-entry-gap-base": mm(design.spacing.entryGapMm),
    "--klassisch-section-title-gap": mm(design.spacing.sectionTitleGapMm),
    "--klassisch-entry-content-gap": mm(design.spacing.entryContentGapMm),
    "--klassisch-organization-gap": mm(layout.organizationGapMm),
    "--klassisch-meta-width": mm(layout.metaWidthMm),
    "--klassisch-meta-gap": mm(layout.metaGapMm),
    "--klassisch-list-indent": mm(layout.listIndentMm),
    "--klassisch-bullet-gap": mm(layout.bulletGapMm),
    "--klassisch-strength-column-gap": mm(layout.strengthColumnGapMm),
    "--klassisch-strength-row-gap": mm(layout.strengthRowGapMm),
    "--klassisch-language-column-gap": mm(layout.languageColumnGapMm),
    "--klassisch-language-row-gap": mm(layout.languageRowGapMm),
    "--klassisch-wave-opacity": String(layout.waveOpacity),
    "--klassisch-heading": design.colors.sectionHeading,
    "--klassisch-text": design.colors.text,
    "--klassisch-muted": design.colors.muted,
    "--klassisch-soft": design.colors.surface,
    "--klassisch-border": design.colors.divider,
  };
};

const PT_TO_MM = 25.4 / 72;
/** A 0.3 mm rule is drawn as one CSS pixel. */
const RULE_MM = 25.4 / 96;

/** The contacts of the first-page header in the order both renderers print them (KlassischHeader, the PDF's contact list). */
export const getKlassischHeaderContacts = (profile: ApplicantProfile) => [
  formatPhoneForDisplay(profile.phone),
  profile.email.trim(),
  ...getResumeLinkContacts(profile).map((link) => link.value),
  formatResumeAddress(profile),
  formatResumeBirth(profile, { prefix: true }),
  ...getResumePersonalDetails(profile).map((detail) => detail.text),
].filter((value) => value.trim());

/**
 * Where the first section of a Klassisch page starts (mm from the top of the sheet), computed from the stylesheet and the
 * measured font advances: the header (name, Berufsbezeichnung, the two-column contact grid beside the photo, or the
 * running head of a later page with the contacts chosen for it), its hairline and the gap below it. The plain (ATS) page
 * one adds its "Persönliche Daten" paragraph.
 */
export const estimateKlassischHeaderTop = (
  profile: ApplicantProfile,
  options: {
    continuation: boolean;
    contacts: boolean;
    /** E-mail / phone a later page repeats (resumeContinuationContactVisibility). */
    continuationContacts?: string[];
    photoScale?: number;
    contentWidthMm: number;
    namePt: number;
    titlePt: number;
    bodyPt: number;
    lineHeight: number;
    sectionGapMm: number;
    titleGapMm: number;
    ats?: boolean;
  },
): number => {
  const { typography: type, layout, page } = klassischDefaults;
  const box = (pt: number, lineHeight: number) => pt * PT_TO_MM * lineHeight;
  const close = layout.headerPaddingBottomMm + RULE_MM + layout.headerGapMm;
  const width = options.contentWidthMm;
  const name = getResumeFullName(profile);
  const title = profile.title.trim();
  const contactLine = box(type.contactSizePt, type.contactLineHeight);
  if (options.continuation) {
    let height = box(type.metaSizePt, options.lineHeight) + layout.organizationGapMm;
    height += Math.max(1, wrappedLines(name, width, type.continuationNameSizePt * PT_TO_MM, type.nameWeight)) * box(type.continuationNameSizePt, type.nameLineHeight);
    if (title) height += layout.organizationGapMm + wrappedLines(title, width, options.bodyPt * PT_TO_MM, type.titleWeight) * box(options.bodyPt, options.lineHeight);
    const extra = (options.continuationContacts ?? []).filter((value) => value.trim());
    if (extra.length) {
      // A flowing line of links: a value moves to the next row when it does not fit behind the one before.
      let rows = 1;
      let used = 0;
      for (const value of extra) {
        const itemWidth = Math.min(width, textWidthMm(value, type.contactSizePt * PT_TO_MM));
        if (used && used + layout.contactColumnGapMm + itemWidth > width) { rows += 1; used = itemWidth; } else used += (used ? layout.contactColumnGapMm : 0) + itemWidth;
      }
      height += layout.contactsGapMm + rows * contactLine + (rows - 1) * layout.contactRowGapMm;
    }
    return page.marginTopMm + height + close;
  }
  const photo = options.photoScale ? layout.photoSizeMm * options.photoScale : 0;
  const identityWidth = photo ? width - photo - layout.photoGapMm : width;
  let identity = Math.max(1, wrappedLines(name, identityWidth, options.namePt * PT_TO_MM, type.nameWeight)) * box(options.namePt, type.nameLineHeight);
  if (title) identity += layout.titleGapMm + Math.max(1, wrappedLines(title, identityWidth, options.titlePt * PT_TO_MM, type.titleWeight)) * box(options.titlePt, options.lineHeight);
  const contacts = options.contacts && !options.ats ? getKlassischHeaderContacts(profile) : [];
  if (contacts.length) {
    const textWidth = (identityWidth - layout.contactColumnGapMm) / 2 - layout.contactIconMm - layout.contactIconGapMm;
    const lines = contacts.map((value) => Math.max(1, wrappedLines(value, textWidth, type.contactSizePt * PT_TO_MM)));
    let rows = 0;
    let height = 0;
    for (let index = 0; index < lines.length; index += 2) {
      height += Math.max(...lines.slice(index, index + 2)) * contactLine;
      rows += 1;
    }
    identity += layout.contactsGapMm + height + (rows - 1) * layout.contactRowGapMm;
  }
  let top = page.marginTopMm + Math.max(identity, photo) + close;
  if (options.ats && options.contacts) {
    // The plain page one opens with its "Persönliche Daten" paragraph (title, then the wrapped line of contacts).
    const text = formatResumeContactLine(profile);
    if (text) top += box(type.sectionHeadingSizePt, type.headingLineHeight) + options.titleGapMm
      + Math.max(1, wrappedLines(text, width, options.bodyPt * PT_TO_MM)) * box(options.bodyPt, options.lineHeight) + options.sectionGapMm;
  }
  return top;
};
