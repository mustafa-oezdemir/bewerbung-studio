import type { NativeResumeDesign } from "../cvDesignSchema";

/**
 * Klassisch: one column on a DIN-5008-oriented A4 page (project standard, not a DIN typography rule): text box
 * 25 mm left, 20 mm right, 25 mm top, 20 mm bottom, 11 pt body at 1.2 line height, 14 pt titles. Every physical value
 * of the preview, the PDF and the page planner is read from here (src/shared/klassischDesign.ts).
 */
export const klassischDefaults = {
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
    lineHeight: 1.2,
    nameSizePt: 24,
    nameWeight: 700,
    nameLineHeight: 1.1,
    /** The name in the running head of later pages. */
    continuationNameSizePt: 18,
    titleSizePt: 14,
    titleWeight: 400,
    sectionHeadingSizePt: 14,
    sectionHeadingWeight: 700,
    sectionHeadingTrackingEm: 0.04,
    headingLineHeight: 1.2,
    entryHeadingSizePt: 14,
    entryHeadingWeight: 600,
    organizationWeight: 600,
    metaSizePt: 10,
    contactSizePt: 10,
    contactLineHeight: 1.3,
    footerSizePt: 8,
  },
  layout: {
    /** Header: name, Berufsbezeichnung and a two-column contact grid beside the round photo, closed by a hairline. */
    photoSizeMm: 32,
    photoGapMm: 8,
    titleGapMm: 1.5,
    contactsGapMm: 3.5,
    contactColumnGapMm: 6,
    contactRowGapMm: 1,
    contactIconMm: 3.5,
    contactIconGapMm: 1.5,
    strengthIconMm: 5,
    headerPaddingBottomMm: 4.5,
    ruleWidthMm: 0.3,
    headerGapMm: 7,
    /** Body: section and entry rhythm for 11 pt text. */
    sectionGapMm: 6,
    entryGapMm: 4,
    sectionTitleGapMm: 2.5,
    entryContentGapMm: 1,
    organizationGapMm: 0.5,
    metaWidthMm: 36,
    metaGapMm: 6,
    listIndentMm: 5,
    bulletGapMm: 0.6,
    strengthColumnGapMm: 6,
    strengthRowGapMm: 3,
    languageColumnGapMm: 14,
    languageRowGapMm: 1.5,
    /** The footer (portfolio link, page number) stands inside the bottom margin. */
    footerBottomMm: 10,
    /** Opacity of the optional soft wave background, kept in the background behind the text. */
    waveOpacity: 0.55,
  },
  colors: {
    primary: "#2B2F32",
    accent: "#00AFC5",
    heading: "#5A6267",
    text: "#3F484D",
    muted: "#68747A",
    softBackground: "#CDEFF3",
    border: "#D5DBDE",
    inactive: "#E4E8EA",
  },
} as const;

/** Semantic design of the rendered template; values the module names itself are referenced. */
const klassischDesignColors = {
  text: klassischDefaults.colors.text,
  paragraph: klassischDefaults.colors.text,
  heading: klassischDefaults.colors.primary,
  subheading: klassischDefaults.colors.text,
  sectionHeading: klassischDefaults.colors.heading,
  entryHeading: klassischDefaults.colors.primary,
  divider: klassischDefaults.colors.border,
  background: "#FFFFFF",
  accent: klassischDefaults.colors.accent,
  surface: klassischDefaults.colors.softBackground,
  muted: klassischDefaults.colors.muted,
  icon: klassischDefaults.colors.accent,
};

export const klassischDesign: NativeResumeDesign = {
  tokens: {
    colors: klassischDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: klassischDefaults.typography.bodySizePt,
      headingSizePt: klassischDefaults.typography.nameSizePt,
      subheadingSizePt: klassischDefaults.typography.titleSizePt,
      sectionHeadingSizePt: klassischDefaults.typography.sectionHeadingSizePt,
      entryHeadingSizePt: klassischDefaults.typography.entryHeadingSizePt,
      lineHeight: klassischDefaults.typography.lineHeight,
      headingWeight: klassischDefaults.typography.nameWeight,
      subheadingWeight: klassischDefaults.typography.titleWeight,
      sectionHeadingWeight: klassischDefaults.typography.sectionHeadingWeight,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: klassischDefaults.page.marginLeftMm,
      innerPaddingMm: 0,
      sectionGapMm: klassischDefaults.layout.sectionGapMm,
      entryGapMm: klassischDefaults.layout.entryGapMm,
      sectionTitleGapMm: klassischDefaults.layout.sectionTitleGapMm,
      entryContentGapMm: klassischDefaults.layout.entryContentGapMm,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: klassischDesignColors.background,
    sidebarTextColor: klassischDesignColors.text,
    sidebarSectionHeadingColor: klassischDesignColors.sectionHeading,
    mainBackgroundColor: klassischDesignColors.background,
    sectionDividerPosition: "none",
    sectionDividerWidthMm: 0,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: klassischDesignColors.accent,
    contactDividerColor: klassischDesignColors.divider,
    photoLayout: "circle",
    headerLayout: "left",
  },
};
