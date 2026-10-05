import type { NativeResumeDesign } from "../cvDesignSchema";

export const gepflegtDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  layout: {
    sidebarWidthMm: 80,
    topBarHeightMm: 3.5,
  },
  sidebar: {
    paddingTopMm: 14,
    paddingRightMm: 5,
    paddingBottomMm: 16,
    paddingLeftMm: 25,
    photoSizeMm: 26,
    photoGapMm: 12,
  },
  main: {
    paddingTopMm: 14,
    paddingRightMm: 20,
    paddingBottomMm: 24,
    paddingLeftMm: 8,
    footerBottomMm: 16,
    headerGapMm: 9,
  },
  spacing: {
    sectionGapMm: 6.5,
    entryGapMm: 4,
  },
  colors: {
    sidebarBackground: "#087875",
    sidebarTopBar: "#005B59",
    sidebarText: "#FFFFFF",
    sidebarMutedText: "#D8F0EF",
    accent: "#00B8B5",
    heading: "#354147",
    text: "#3F494E",
    mutedText: "#657075",
    divider: "#C7CED1",
    pageBackground: "#FFFFFF",
  },
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", Arial, sans-serif',
    nameSizePt: 24,
    nameWeight: 750,
    jobTitleSizePt: 13.5,
    sectionTitleSizePt: 14.5,
    sidebarTitleSizePt: 12.5,
    entryTitleSizePt: 11.5,
    bodySizePt: 10.3,
    smallSizePt: 9,
    bodyLineHeight: 1.32,
  },
  output: {
    supportsAtsMode: true,
    supportsVisualMode: true,
    supportsFreeform: true,
  },
};

export type GepflegtTemplateDefaults = typeof gepflegtDefaults;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const gepflegtDesignColors = {
  text: gepflegtDefaults.colors.text,
  paragraph: gepflegtDefaults.colors.text,
  heading: gepflegtDefaults.colors.heading,
  subheading: gepflegtDefaults.colors.accent,
  sectionHeading: gepflegtDefaults.colors.heading,
  entryHeading: gepflegtDefaults.colors.heading,
  divider: gepflegtDefaults.colors.divider,
  background: gepflegtDefaults.colors.pageBackground,
  accent: gepflegtDefaults.colors.accent,
  surface: gepflegtDefaults.colors.pageBackground,
  muted: gepflegtDefaults.colors.mutedText,
  icon: gepflegtDefaults.colors.accent,
};

export const gepflegtDesign: NativeResumeDesign = {
  tokens: {
    colors: gepflegtDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: gepflegtDefaults.typography.bodySizePt,
      headingSizePt: gepflegtDefaults.typography.nameSizePt,
      subheadingSizePt: gepflegtDefaults.typography.jobTitleSizePt,
      sectionHeadingSizePt: gepflegtDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: gepflegtDefaults.typography.entryTitleSizePt,
      lineHeight: gepflegtDefaults.typography.bodyLineHeight,
      headingWeight: gepflegtDefaults.typography.nameWeight,
      subheadingWeight: 500,
      sectionHeadingWeight: 500,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: gepflegtDefaults.main.paddingRightMm,
      innerPaddingMm: 10,
      sectionGapMm: gepflegtDefaults.spacing.sectionGapMm,
      entryGapMm: gepflegtDefaults.spacing.entryGapMm,
      sectionTitleGapMm: 3.6,
      entryContentGapMm: 0,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: gepflegtDefaults.colors.sidebarBackground,
    sidebarTextColor: gepflegtDefaults.colors.sidebarText,
    sidebarSectionHeadingColor: "#FFFFFF",
    mainBackgroundColor: gepflegtDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.35,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: gepflegtDesignColors.accent,
    contactDividerColor: gepflegtDesignColors.divider,
    photoLayout: "rounded",
    headerLayout: "left",
  },
};
