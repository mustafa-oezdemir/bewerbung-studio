import type { NativeResumeDesign } from "../cvDesignSchema";

export const kompaktDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 13,
    marginRightMm: 13,
    marginBottomMm: 12,
    marginLeftMm: 13,
  },
  layout: {
    headerHeightMm: 22,
    contentTopMm: 31,
    headerToContentGapMm: 9,
    footerClearanceMm: 15,
    leftColumnWidthMm: 108,
    columnGapMm: 10,
    rightColumnWidthMm: 66,
    sectionGapMm: 3.5,
    entryGapMm: 3.2,
    sectionTitleGapMm: 3,
    entryContentGapMm: 0.7,
  },
  colors: {
    primary: "#073D96",
    accent: "#FF6200",
    text: "#3F494F",
    muted: "#6D757A",
    divider: "#AEB6BA",
    pattern: "#FFD7BC",
    inactive: "#E1E5E7",
  },
} as const;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const kompaktDesignColors = {
  text: kompaktDefaults.colors.text,
  paragraph: kompaktDefaults.colors.text,
  heading: kompaktDefaults.colors.primary,
  subheading: kompaktDefaults.colors.muted,
  sectionHeading: kompaktDefaults.colors.muted,
  entryHeading: kompaktDefaults.colors.primary,
  divider: kompaktDefaults.colors.divider,
  background: "#FFFFFF",
  accent: kompaktDefaults.colors.accent,
  surface: kompaktDefaults.colors.pattern,
  muted: kompaktDefaults.colors.muted,
  icon: kompaktDefaults.colors.accent,
};

export const kompaktDesign: NativeResumeDesign = {
  tokens: {
    colors: kompaktDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: 8.4,
      headingSizePt: 20,
      subheadingSizePt: 8.5,
      sectionHeadingSizePt: 8.5,
      entryHeadingSizePt: 10.5,
      lineHeight: 1,
      headingWeight: 450,
      subheadingWeight: 500,
      sectionHeadingWeight: 450,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: kompaktDefaults.page.marginLeftMm,
      innerPaddingMm: 0,
      sectionGapMm: kompaktDefaults.layout.sectionGapMm,
      entryGapMm: kompaktDefaults.layout.entryGapMm,
      sectionTitleGapMm: 2.5,
      entryContentGapMm: kompaktDefaults.layout.entryContentGapMm,
      columnGapMm: kompaktDefaults.layout.columnGapMm,
    },
  },
  appearance: {
    sidebarBackgroundColor: kompaktDesignColors.background,
    sidebarTextColor: kompaktDesignColors.text,
    sidebarSectionHeadingColor: kompaktDesignColors.sectionHeading,
    mainBackgroundColor: kompaktDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.3,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: kompaktDesignColors.accent,
    contactDividerColor: kompaktDesignColors.divider,
    photoLayout: "rounded",
    headerLayout: "left",
  },
};
