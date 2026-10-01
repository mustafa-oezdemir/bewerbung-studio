import type { NativeResumeDesign } from "../cvDesignSchema";

export const stilvollDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 14,
    marginRightMm: 15,
    marginBottomMm: 13,
    marginLeftMm: 15,
  },
  layout: {
    headerHeightMm: 36,
    contentTopMm: 42,
    headerToContentGapMm: 6,
    leftColumnWidthMm: 54,
    columnGapMm: 11,
    rightColumnWidthMm: 115,
    sectionGapMm: 6,
    entryGapMm: 3.8,
    sectionTitleGapMm: 3,
    entryContentGapMm: 1,
  },
  colors: {
    primary: "#36B873",
    primaryDark: "#075E50",
    primarySoft: "#D9F2E5",
    text: "#465156",
    muted: "#6D777C",
    divider: "#AEB8B5",
    pattern: "#DCE2DF",
    inactive: "#DDE2E0",
  },
} as const;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const stilvollDesignColors = {
  text: stilvollDefaults.colors.text,
  paragraph: stilvollDefaults.colors.text,
  heading: "#075E50",
  subheading: stilvollDefaults.colors.primary,
  sectionHeading: stilvollDefaults.colors.muted,
  entryHeading: stilvollDefaults.colors.primaryDark,
  divider: stilvollDefaults.colors.divider,
  background: "#FFFFFF",
  accent: stilvollDefaults.colors.primary,
  surface: stilvollDefaults.colors.primarySoft,
  muted: stilvollDefaults.colors.muted,
  icon: stilvollDefaults.colors.primary,
};

export const stilvollDesign: NativeResumeDesign = {
  tokens: {
    colors: stilvollDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: 8.4,
      headingSizePt: 23,
      subheadingSizePt: 12,
      sectionHeadingSizePt: 9.5,
      entryHeadingSizePt: 11,
      lineHeight: 1.05,
      headingWeight: 400,
      subheadingWeight: 400,
      sectionHeadingWeight: 400,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: stilvollDefaults.page.marginLeftMm,
      innerPaddingMm: 0,
      sectionGapMm: stilvollDefaults.layout.sectionGapMm,
      entryGapMm: stilvollDefaults.layout.entryGapMm,
      sectionTitleGapMm: stilvollDefaults.layout.sectionTitleGapMm,
      entryContentGapMm: stilvollDefaults.layout.entryContentGapMm,
      columnGapMm: stilvollDefaults.layout.columnGapMm,
    },
  },
  appearance: {
    sidebarBackgroundColor: stilvollDesignColors.background,
    sidebarTextColor: stilvollDesignColors.text,
    sidebarSectionHeadingColor: stilvollDesignColors.sectionHeading,
    mainBackgroundColor: stilvollDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.3,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: stilvollDesignColors.accent,
    contactDividerColor: stilvollDesignColors.divider,
    photoLayout: "rounded",
    headerLayout: "left",
  },
};
