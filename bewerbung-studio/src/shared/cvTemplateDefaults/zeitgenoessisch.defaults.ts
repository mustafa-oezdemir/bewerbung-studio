import type { NativeResumeDesign } from "../cvDesignSchema";

export const zeitgenoessischDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 15,
    marginRightMm: 20,
    marginBottomMm: 15,
    marginLeftMm: 25,
  },
  layout: {
    leftColumnWidthMm: 50,
    columnGapMm: 11,
    rightColumnWidthMm: 115,
    headerMinHeightMm: 42,
    sectionGapMm: 7,
    entryGapMm: 5,
    photoSizeMm: 36,
  },
  colors: {
    primary: "#2FB478",
    primaryDark: "#075E4E",
    primarySoft: "#CBECDD",
    primaryPale: "#E5F5EC",
    heading: "#374247",
    text: "#434D52",
    mutedText: "#687277",
    divider: "#D5DEDA",
    pageBackground: "#FFFFFF",
  },
  typography: {
    fontFamily:
      '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif',
    nameSizePt: 25,
    professionSizePt: 12.5,
    sectionTitleSizePt: 12.5,
    entryTitleSizePt: 11.5,
    bodySizePt: 10.5,
    smallSizePt: 9.2,
    lineHeight: 1.26,
  },
} as const;

export type ZeitgenoessischTemplateDefaults =
  typeof zeitgenoessischDefaults;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const zeitgenoessischDesignColors = {
  text: zeitgenoessischDefaults.colors.text,
  paragraph: zeitgenoessischDefaults.colors.text,
  heading: zeitgenoessischDefaults.colors.heading,
  subheading: zeitgenoessischDefaults.colors.primaryDark,
  sectionHeading: zeitgenoessischDefaults.colors.primaryDark,
  entryHeading: zeitgenoessischDefaults.colors.heading,
  divider: zeitgenoessischDefaults.colors.divider,
  background: zeitgenoessischDefaults.colors.pageBackground,
  accent: zeitgenoessischDefaults.colors.primary,
  surface: zeitgenoessischDefaults.colors.primarySoft,
  muted: zeitgenoessischDefaults.colors.mutedText,
  icon: zeitgenoessischDefaults.colors.primary,
};

export const zeitgenoessischDesign: NativeResumeDesign = {
  tokens: {
    colors: zeitgenoessischDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: zeitgenoessischDefaults.typography.bodySizePt,
      headingSizePt: zeitgenoessischDefaults.typography.nameSizePt,
      subheadingSizePt: zeitgenoessischDefaults.typography.professionSizePt,
      sectionHeadingSizePt: zeitgenoessischDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: zeitgenoessischDefaults.typography.entryTitleSizePt,
      lineHeight: zeitgenoessischDefaults.typography.lineHeight,
      headingWeight: 350,
      subheadingWeight: 600,
      sectionHeadingWeight: 750,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: zeitgenoessischDefaults.page.marginRightMm,
      innerPaddingMm: 0,
      sectionGapMm: zeitgenoessischDefaults.layout.sectionGapMm,
      entryGapMm: zeitgenoessischDefaults.layout.entryGapMm,
      sectionTitleGapMm: 3,
      entryContentGapMm: 0,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: zeitgenoessischDesignColors.background,
    sidebarTextColor: zeitgenoessischDesignColors.text,
    sidebarSectionHeadingColor: zeitgenoessischDesignColors.sectionHeading,
    mainBackgroundColor: zeitgenoessischDesignColors.background,
    sectionDividerPosition: "none",
    sectionDividerWidthMm: 0,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: true,
    photoDecorationColor: zeitgenoessischDefaults.colors.primarySoft,
    contactDividerColor: zeitgenoessischDesignColors.divider,
    photoLayout: "circle",
    headerLayout: "left",
  },
};
