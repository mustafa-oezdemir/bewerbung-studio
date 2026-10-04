import type { NativeResumeDesign } from "../cvDesignSchema";

export const kreativDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginLeftMm: 15,
    marginRightMm: 15,
    marginBottomMm: 13,
  },
  layout: {
    headerHeightMm: 46,
    contentTopMm: 53,
    headerToContentGapMm: 7,
    footerClearanceMm: 18,
    entryDividerGapMm: 1.5,
    leftColumnWidthMm: 105,
    columnGapMm: 11,
    rightColumnWidthMm: 64,
    sectionGapMm: 4.5,
    entryGapMm: 2.5,
    photoWidthMm: 28,
    photoHeightMm: 28,
  },
  colors: {
    primary: "#37B978",
    primaryDark: "#075D4E",
    primarySoft: "#D9F2E5",
    heading: "#075D4E",
    text: "#465156",
    mutedText: "#687277",
    divider: "#B8C4C0",
    lightDivider: "#D7DFDC",
    pageBackground: "#FFFFFF",
    headerText: "#FFFFFF",
    inactiveLevel: "#E1E5E3",
  },
  typography: {
    fontFamily:
      '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif',
    nameSizePt: 23,
    professionSizePt: 11.5,
    sectionTitleSizePt: 14,
    entryTitleSizePt: 11,
    bodySizePt: 8.5,
    smallSizePt: 7.8,
    lineHeight: 1.3,
  },
} as const;

export type KreativTemplateDefaults = typeof kreativDefaults;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const kreativDesignColors = {
  text: kreativDefaults.colors.text,
  paragraph: kreativDefaults.colors.text,
  heading: "#FFFFFF",
  subheading: "#FFFFFF",
  sectionHeading: kreativDefaults.colors.heading,
  entryHeading: kreativDefaults.colors.heading,
  divider: "#075D4E",
  background: kreativDefaults.colors.pageBackground,
  accent: kreativDefaults.colors.primary,
  surface: kreativDefaults.colors.primarySoft,
  muted: kreativDefaults.colors.mutedText,
  icon: kreativDefaults.colors.primary,
};

export const kreativDesign: NativeResumeDesign = {
  tokens: {
    colors: kreativDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: 8.4,
      headingSizePt: kreativDefaults.typography.nameSizePt,
      subheadingSizePt: kreativDefaults.typography.professionSizePt,
      sectionHeadingSizePt: kreativDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: kreativDefaults.typography.entryTitleSizePt,
      lineHeight: 1.05,
      headingWeight: 750,
      subheadingWeight: 650,
      sectionHeadingWeight: 750,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: 12,
      innerPaddingMm: 0,
      sectionGapMm: kreativDefaults.layout.sectionGapMm,
      entryGapMm: kreativDefaults.layout.entryGapMm,
      sectionTitleGapMm: 3.5,
      entryContentGapMm: 0,
      columnGapMm: kreativDefaults.layout.columnGapMm,
    },
  },
  appearance: {
    sidebarBackgroundColor: kreativDesignColors.background,
    sidebarTextColor: kreativDesignColors.text,
    sidebarSectionHeadingColor: kreativDesignColors.sectionHeading,
    mainBackgroundColor: kreativDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.65,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: kreativDesignColors.accent,
    contactDividerColor: "#B8C4C0",
    photoLayout: "rounded",
    headerLayout: "left",
  },
};
