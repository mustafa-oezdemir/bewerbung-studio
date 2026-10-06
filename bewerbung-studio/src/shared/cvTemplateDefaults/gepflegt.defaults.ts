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
    // The left text edge of the sidebar = Seitenränder (default 10 mm, like the right edge of the main column).
    paddingLeftMm: 10,
    photoSizeMm: 26,
    photoGapMm: 9,
  },
  main: {
    paddingTopMm: 14,
    paddingRightMm: 10,
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
    // One calm accent: the teal of the sidebar (text contrast on white 5.4:1), not a second, brighter cyan.
    accent: "#087875",
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
    // Readable German CV defaults: 11 pt body, 13-14 pt headings, line height 1.3, one font family.
    jobTitleSizePt: 13,
    sectionTitleSizePt: 14,
    sidebarTitleSizePt: 13,
    entryTitleSizePt: 12,
    bodySizePt: 11,
    smallSizePt: 9.5,
    bodyLineHeight: 1.3,
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
      sectionHeadingWeight: 600,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: gepflegtDefaults.main.paddingRightMm,
      // Innenabstand is an extra inset on top of the page margin (native 0 like every template); the columns' own
      // paddings belong to the margin (resolveGepflegtGeometry). 10 pulled a chosen 4 mm six millimetres to the left.
      innerPaddingMm: 0,
      sectionGapMm: gepflegtDefaults.spacing.sectionGapMm,
      entryGapMm: gepflegtDefaults.spacing.entryGapMm,
      sectionTitleGapMm: 3.6,
      entryContentGapMm: 0,
      // The distance between the coloured sidebar and the main text (resolveGepflegtGeometry).
      columnGapMm: gepflegtDefaults.main.paddingLeftMm,
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
