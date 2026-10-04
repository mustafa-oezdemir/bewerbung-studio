import type { NativeResumeDesign } from "../cvDesignSchema";

export const zweispaltigDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  layout: {
    marginTopMm: 20,
    marginRightMm: 20,
    marginBottomMm: 15,
    marginLeftMm: 25,
    leftColumnRatio: 0.62,
    rightColumnRatio: 0.38,
    columnGapMm: 11,
    headerGapMm: 6.5,
    sectionGapMm: 6.5,
    entryGapMm: 3.5,
    photoSizeMm: 30,
  },
  colors: {
    primary: "#0B3D86",
    accent: "#58B5F7",
    primaryDark: "#082F6D",
    primarySoft: "#EAF5FD",
    heading: "#0B3D86",
    text: "#4A555C",
    mutedText: "#667178",
    divider: "#D6DCE0",
    pageBackground: "#FFFFFF",
  },
  typography: {
    fontFamily:
      '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif',
    nameSizePt: 24,
    professionSizePt: 10.5,
    sectionTitleSizePt: 14,
    entryTitleSizePt: 11.5,
    bodySizePt: 10,
    smallSizePt: 7.5,
    lineHeight: 1.32,
  },
} as const;

/** The physical page box is shared by the preview, Electron PDF and the planner. */
export const zweispaltigPageVariables = {
  "--zweispaltig-margin-top": `${zweispaltigDefaults.layout.marginTopMm}mm`,
  "--zweispaltig-margin-right": `${zweispaltigDefaults.layout.marginRightMm}mm`,
  "--zweispaltig-margin-bottom": `${zweispaltigDefaults.layout.marginBottomMm}mm`,
  "--zweispaltig-margin-left": `${zweispaltigDefaults.layout.marginLeftMm}mm`,
} as const;
export const zweispaltigPageStyle = Object.entries(zweispaltigPageVariables)
  .map(([name, value]) => `${name}:${value}`)
  .join(";");

export type ZweispaltigTemplateDefaults = typeof zweispaltigDefaults;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const zweispaltigDesignColors = {
  text: zweispaltigDefaults.colors.text,
  paragraph: zweispaltigDefaults.colors.text,
  heading: zweispaltigDefaults.colors.primary,
  subheading: zweispaltigDefaults.colors.accent,
  sectionHeading: zweispaltigDefaults.colors.heading,
  entryHeading: zweispaltigDefaults.colors.primary,
  divider: zweispaltigDefaults.colors.primary,
  background: zweispaltigDefaults.colors.pageBackground,
  accent: zweispaltigDefaults.colors.accent,
  surface: zweispaltigDefaults.colors.primarySoft,
  muted: zweispaltigDefaults.colors.mutedText,
  icon: zweispaltigDefaults.colors.accent,
};

export const zweispaltigDesign: NativeResumeDesign = {
  tokens: {
    colors: zweispaltigDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: zweispaltigDefaults.typography.bodySizePt,
      headingSizePt: zweispaltigDefaults.typography.nameSizePt,
      subheadingSizePt: 11.5,
      sectionHeadingSizePt: zweispaltigDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: zweispaltigDefaults.typography.entryTitleSizePt,
      lineHeight: zweispaltigDefaults.typography.lineHeight,
      headingWeight: 750,
      subheadingWeight: 700,
      sectionHeadingWeight: 750,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: zweispaltigDefaults.layout.marginLeftMm,
      innerPaddingMm: 0,
      sectionGapMm: zweispaltigDefaults.layout.sectionGapMm,
      entryGapMm: zweispaltigDefaults.layout.entryGapMm,
      sectionTitleGapMm: 2.5,
      entryContentGapMm: 0.7,
      columnGapMm: zweispaltigDefaults.layout.columnGapMm,
    },
  },
  appearance: {
    sidebarBackgroundColor: zweispaltigDesignColors.background,
    sidebarTextColor: zweispaltigDesignColors.text,
    sidebarSectionHeadingColor: zweispaltigDesignColors.sectionHeading,
    mainBackgroundColor: zweispaltigDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.65,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: zweispaltigDesignColors.accent,
    contactDividerColor: zweispaltigDesignColors.divider,
    photoLayout: "circle",
    headerLayout: "left",
  },
};
