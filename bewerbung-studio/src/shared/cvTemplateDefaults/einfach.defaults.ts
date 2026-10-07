import type { NativeResumeDesign } from "../cvDesignSchema";

/**
 * Einspaltig: one column on a DIN-5008-oriented A4 page (project standard, not a DIN typography rule): text box 25 mm
 * left, 20 mm right, 25 mm top, 20 mm bottom, 11 pt body at 1.25, name 16 pt, section titles 14 pt, one accent colour on
 * white. Every physical value of the preview, the PDF and the page planner is read from here (src/shared/einspaltigDesign.ts).
 */
export const einspaltigDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 25,
    marginRightMm: 20,
    marginBottomMm: 20,
    marginLeftMm: 25,
  },
  typography: {
    bodySizePt: 11,
    lineHeight: 1.25,
    nameSizePt: 16,
    nameWeight: 700,
    nameLineHeight: 1.15,
    nameTrackingEm: 0.03,
    titleSizePt: 12,
    titleWeight: 400,
    sectionHeadingSizePt: 14,
    sectionHeadingWeight: 600,
    headingLineHeight: 1.2,
    entryHeadingSizePt: 12,
    entryHeadingWeight: 600,
    organizationWeight: 600,
    metaSizePt: 10,
    contactSizePt: 10,
    contactLineHeight: 1.3,
    footerSizePt: 8,
    /** The name in the running head of later pages. */
    continuationNameSizePt: 14,
  },
  layout: {
    /** Header: name, Berufsbezeichnung and a two-column contact grid beside the round photo, closed by a hairline. */
    photoSizeMm: 30,
    photoGapMm: 8,
    titleGapMm: 1,
    contactsGapMm: 3,
    contactColumnGapMm: 6,
    contactRowGapMm: 0.8,
    contactIconMm: 3.5,
    contactIconGapMm: 1.5,
    headerPaddingBottomMm: 4,
    ruleWidthMm: 0.3,
    headerGapMm: 6,
    /** Body rhythm for 11 pt text. */
    sectionGapMm: 6,
    entryGapMm: 4,
    sectionTitleGapMm: 2.5,
    entryContentGapMm: 1,
    /** Below the section title text: its rule (the shared divider of the section heading). */
    sectionRulePaddingMm: 1,
    organizationGapMm: 0.5,
    metaGapMm: 4,
    listIndentMm: 5,
    bulletGapMm: 0.6,
    strengthIconMm: 5,
    strengthColumnGapMm: 6,
    strengthRowGapMm: 3,
    languageColumnGapMm: 8,
    languageRowGapMm: 1.5,
    /** The footer (portfolio link, page number) stands inside the bottom margin. */
    footerBottomMm: 10,
    /** Opacity of the optional geometric background, kept quiet behind the text. */
    patternOpacity: 0.45,
    /** @deprecated measured by the former layout; kept for existing imports. */
    headerHeightMm: 35,
    strengthsColumnGapMm: 15,
    photoDiameterMm: 30,
  },
  colors: {
    primary: "#0B3485",
    accent: "#0B3485",
    text: "#3B454B",
    heading: "#1E2A33",
    muted: "#68747A",
    border: "#D5DBDE",
    pattern: "#EAF5FD",
    inactive: "#E3E7EA",
  },
} as const;

/** @deprecated Nur für bestehende interne Importe. */
export const einfachDefaults = einspaltigDefaults;

/** Semantic design of the rendered template: one accent (the template colour), neutral text and greys. */
const einspaltigDesignColors = {
  text: einspaltigDefaults.colors.text,
  paragraph: einspaltigDefaults.colors.text,
  heading: einspaltigDefaults.colors.heading,
  subheading: einspaltigDefaults.colors.primary,
  sectionHeading: einspaltigDefaults.colors.primary,
  entryHeading: einspaltigDefaults.colors.heading,
  divider: einspaltigDefaults.colors.primary,
  background: "#FFFFFF",
  accent: einspaltigDefaults.colors.primary,
  surface: einspaltigDefaults.colors.pattern,
  muted: einspaltigDefaults.colors.muted,
  icon: einspaltigDefaults.colors.primary,
};

export const einspaltigDesign: NativeResumeDesign = {
  tokens: {
    colors: einspaltigDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: einspaltigDefaults.typography.bodySizePt,
      headingSizePt: einspaltigDefaults.typography.nameSizePt,
      subheadingSizePt: einspaltigDefaults.typography.titleSizePt,
      sectionHeadingSizePt: einspaltigDefaults.typography.sectionHeadingSizePt,
      entryHeadingSizePt: einspaltigDefaults.typography.entryHeadingSizePt,
      lineHeight: einspaltigDefaults.typography.lineHeight,
      headingWeight: einspaltigDefaults.typography.nameWeight,
      subheadingWeight: einspaltigDefaults.typography.titleWeight,
      sectionHeadingWeight: einspaltigDefaults.typography.sectionHeadingWeight,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: einspaltigDefaults.page.marginLeftMm,
      innerPaddingMm: 0,
      sectionGapMm: einspaltigDefaults.layout.sectionGapMm,
      entryGapMm: einspaltigDefaults.layout.entryGapMm,
      sectionTitleGapMm: einspaltigDefaults.layout.sectionTitleGapMm,
      entryContentGapMm: einspaltigDefaults.layout.entryContentGapMm,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: einspaltigDesignColors.background,
    sidebarTextColor: einspaltigDesignColors.text,
    sidebarSectionHeadingColor: einspaltigDesignColors.sectionHeading,
    mainBackgroundColor: einspaltigDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: einspaltigDefaults.layout.ruleWidthMm,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: einspaltigDesignColors.accent,
    contactDividerColor: einspaltigDesignColors.divider,
    photoLayout: "circle",
    headerLayout: "left",
  },
};
