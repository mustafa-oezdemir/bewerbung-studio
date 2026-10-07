import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { einspaltigDefaults } from "./cvTemplateDefaults/einfach.defaults";
import type { ApplicantProfile } from "./schema";
import {
  formatPhoneForDisplay, formatResumeAddress, formatResumeBirth, formatResumeContactLine, getResumeFullName,
  getResumeLinkContacts, getResumePersonalDetails,
} from "./resumePersonalData";
import { textWidthMm, wrappedLines } from "./textMetrics";

const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;
const PT_TO_MM = 25.4 / 72;
/** A 0.3 mm rule is drawn as one CSS pixel. */
const RULE_MM = 25.4 / 96;

/**
 * The one physical page geometry of Einspaltig for the preview, the PDF and the page planner. "Seitenränder" is a
 * horizontal control: without a chosen value the native DIN-oriented text box applies (25 mm left, 20 mm right); a chosen
 * value N sets both side margins to N mm. Header, sections and footer share these edges. The top (25 mm) and the bottom
 * (20 mm) never move, so the vertical capacity of a page stays the same.
 */
export const resolveEinspaltigGeometry = (pageMarginMm?: number) => {
  const { page } = einspaltigDefaults;
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
 * One resolved set of Einspaltig variables for both rendering surfaces (`einfach.css` and the PDF's `.einfach-pdf` rules
 * only reference them): geometry, typography, spacing and the palette. The palette has one accent: the template colour,
 * or the colour the application chose (a Farbwelt), or the Lebenslauf design's own accent; every token that natively is
 * the accent follows it, the neutral ones stay unless the user sets them.
 */
export const getEinspaltigDesignVariables = (
  design: CvDesignTokens,
  changedColors?: Partial<CvDesignTokens["colors"]>,
  applicationAccent?: string,
): Record<string, string> => {
  const { typography: type, layout, colors } = einspaltigDefaults;
  const geometry = resolveEinspaltigGeometry(design.spacing.pageMarginMm);
  const native = colors.primary.toLowerCase();
  const accent = changedColors?.accent
    ?? (applicationAccent && applicationAccent.toLowerCase() !== native ? applicationAccent : design.colors.accent);
  const color = (key: keyof CvDesignTokens["colors"]) =>
    changedColors?.[key] ?? (design.colors[key].toLowerCase() === native ? accent : design.colors[key]);
  return {
    "--einfach-margin-left": mm(geometry.left),
    "--einfach-margin-right": mm(geometry.right),
    "--einfach-margin-top": mm(geometry.top),
    "--einfach-margin-bottom": mm(geometry.bottom),
    "--einfach-footer-bottom": mm(layout.footerBottomMm),
    "--einfach-font": getDocumentFont(design.typography.fontId).family,
    "--einfach-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--einfach-body-size": `${design.typography.bodySizePt}pt`,
    "--einfach-line-height": String(design.typography.lineHeight),
    "--einfach-name-size": `${design.typography.headingSizePt}pt`,
    "--einfach-name-weight": String(design.typography.headingWeight),
    "--einfach-name-line-height": String(type.nameLineHeight),
    "--einfach-name-tracking": `${type.nameTrackingEm}em`,
    "--einfach-continuation-name-size": `${type.continuationNameSizePt}pt`,
    "--einfach-title-size": `${design.typography.subheadingSizePt}pt`,
    "--einfach-title-weight": String(design.typography.subheadingWeight),
    "--einfach-section-heading-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--einfach-section-heading-weight": String(design.typography.sectionHeadingWeight),
    "--einfach-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--einfach-heading-line-height": String(type.headingLineHeight),
    "--einfach-entry-heading-size": `${design.typography.entryHeadingSizePt}pt`,
    "--einfach-entry-heading-weight": String(type.entryHeadingWeight),
    "--einfach-organization-weight": String(type.organizationWeight),
    "--einfach-meta-size": `${type.metaSizePt}pt`,
    "--einfach-contact-size": `${type.contactSizePt}pt`,
    "--einfach-contact-line-height": String(type.contactLineHeight),
    "--einfach-footer-size": `${type.footerSizePt}pt`,
    "--einfach-photo-size": mm(layout.photoSizeMm),
    "--einfach-photo-gap": mm(layout.photoGapMm),
    "--einfach-title-gap": mm(layout.titleGapMm),
    "--einfach-contacts-gap": mm(layout.contactsGapMm),
    "--einfach-contact-column-gap": mm(layout.contactColumnGapMm),
    "--einfach-contact-row-gap": mm(layout.contactRowGapMm),
    "--einfach-contact-icon": mm(layout.contactIconMm),
    "--einfach-contact-icon-gap": mm(layout.contactIconGapMm),
    "--einfach-header-padding": mm(layout.headerPaddingBottomMm),
    "--einfach-rule": mm(layout.ruleWidthMm),
    "--einfach-header-gap": mm(layout.headerGapMm),
    "--einfach-section-gap-base": mm(design.spacing.sectionGapMm),
    "--einfach-entry-gap-base": mm(design.spacing.entryGapMm),
    "--einfach-section-title-gap": mm(design.spacing.sectionTitleGapMm),
    "--einfach-section-rule-padding": mm(layout.sectionRulePaddingMm),
    "--einfach-entry-content-gap": mm(design.spacing.entryContentGapMm),
    "--einfach-organization-gap": mm(layout.organizationGapMm),
    "--einfach-meta-gap": mm(layout.metaGapMm),
    "--einfach-list-indent": mm(layout.listIndentMm),
    "--einfach-bullet-gap": mm(layout.bulletGapMm),
    "--einfach-strength-icon": mm(layout.strengthIconMm),
    "--einfach-strength-column-gap": mm(layout.strengthColumnGapMm),
    "--einfach-strength-row-gap": mm(layout.strengthRowGapMm),
    "--einfach-language-column-gap": mm(layout.languageColumnGapMm),
    "--einfach-language-row-gap": mm(layout.languageRowGapMm),
    "--einfach-pattern-opacity": String(layout.patternOpacity),
    "--einfach-primary": accent,
    "--einfach-accent": accent,
    "--einfach-text": color("text"),
    "--einfach-paragraph": color("paragraph"),
    "--einfach-name-color": color("heading"),
    "--einfach-subheading": color("subheading"),
    "--einfach-section-heading": color("sectionHeading"),
    "--einfach-entry-heading": color("entryHeading"),
    "--einfach-divider": color("divider"),
    "--einfach-muted": color("muted"),
    "--einfach-icon": color("icon"),
    "--einfach-pattern": color("surface"),
    "--einfach-paper": color("background"),
    "--einfach-border": colors.border,
    "--einfach-inactive": colors.inactive,
  };
};

/** The contacts of the first-page header in the order both renderers print them (EinfachHeader, the PDF's contact list). */
export const getEinspaltigHeaderContacts = (profile: ApplicantProfile) => [
  formatPhoneForDisplay(profile.phone),
  profile.email.trim(),
  ...getResumeLinkContacts(profile).map((link) => link.value),
  formatResumeAddress(profile),
  formatResumeBirth(profile, { prefix: true }),
  ...getResumePersonalDetails(profile).map((detail) => detail.text),
].filter((value) => value.trim());

/** Height of a section title: the line, the padding above its rule and the rule (the gap below comes on top). */
export const einspaltigSectionTitleMm = (sectionHeadingPt: number) =>
  sectionHeadingPt * PT_TO_MM * einspaltigDefaults.typography.headingLineHeight + einspaltigDefaults.layout.sectionRulePaddingMm + RULE_MM;

/**
 * Where the first section of an Einspaltig page starts (mm from the top of the sheet), computed from the stylesheet and
 * the measured font advances: the header (name in capitals, Berufsbezeichnung, the two-column contact grid beside the
 * photo, or the running head of a later page with the contacts chosen for it), its hairline and the gap below it. The
 * plain (ATS) page one adds its "Persönliche Daten" paragraph.
 */
export const estimateEinspaltigHeaderTop = (
  profile: ApplicantProfile,
  options: {
    continuation: boolean;
    contacts: boolean;
    continuationContacts?: string[];
    photoScale?: number;
    contentWidthMm: number;
    namePt: number;
    titlePt: number;
    bodyPt: number;
    lineHeight: number;
    sectionHeadingPt: number;
    sectionGapMm: number;
    titleGapMm: number;
    ats?: boolean;
  },
): number => {
  const { typography: type, layout, page } = einspaltigDefaults;
  const box = (pt: number, lineHeight: number) => pt * PT_TO_MM * lineHeight;
  const close = layout.headerPaddingBottomMm + RULE_MM + layout.headerGapMm;
  const width = options.contentWidthMm;
  const name = getResumeFullName(profile).toLocaleUpperCase("de-DE");
  const title = profile.title.trim();
  const contactLine = box(type.contactSizePt, type.contactLineHeight);
  const nameLines = (pt: number, columnMm: number) => Math.max(1, wrappedLines(name, columnMm, pt * PT_TO_MM, type.nameWeight, type.nameTrackingEm));
  if (options.continuation) {
    let height = box(type.metaSizePt, options.lineHeight) + layout.organizationGapMm;
    height += nameLines(type.continuationNameSizePt, width) * box(type.continuationNameSizePt, type.nameLineHeight);
    if (title) height += layout.organizationGapMm + wrappedLines(title, width, options.bodyPt * PT_TO_MM, type.titleWeight) * box(options.bodyPt, options.lineHeight);
    const extra = (options.continuationContacts ?? []).filter((value) => value.trim());
    if (extra.length) {
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
  let identity = nameLines(options.namePt, identityWidth) * box(options.namePt, type.nameLineHeight);
  if (title) identity += layout.titleGapMm + Math.max(1, wrappedLines(title, identityWidth, options.titlePt * PT_TO_MM, type.titleWeight)) * box(options.titlePt, options.lineHeight);
  const contacts = options.contacts && !options.ats ? getEinspaltigHeaderContacts(profile) : [];
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
    // The plain page one opens with its "Persönliche Daten" paragraph (title with its rule, then the wrapped contacts).
    const text = formatResumeContactLine(profile);
    if (text) top += einspaltigSectionTitleMm(options.sectionHeadingPt) + options.titleGapMm
      + Math.max(1, wrappedLines(text, width, options.bodyPt * PT_TO_MM)) * box(options.bodyPt, options.lineHeight) + options.sectionGapMm;
  }
  return top;
};
