import type { NativeResumeDesign } from "../cvDesignSchema";

export const klassischDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 16,
    marginRightMm: 15,
    marginBottomMm: 17,
    marginLeftMm: 15,
  },
  layout: {
    headerHeightMm: 31,
    sectionGapMm: 3.8,
    entryGapMm: 3.2,
    educationEntryGapMm: 2.8,
    sectionTitleGapMm: 2.2,
    entryContentGapMm: 0.8,
    strengthGapMm: 9,
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

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
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
      bodySizePt: 8.4,
      headingSizePt: 26,
      subheadingSizePt: 12.2,
      sectionHeadingSizePt: 10.4,
      entryHeadingSizePt: 12.2,
      lineHeight: 1.05,
      headingWeight: 750,
      subheadingWeight: 400,
      sectionHeadingWeight: 750,
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
