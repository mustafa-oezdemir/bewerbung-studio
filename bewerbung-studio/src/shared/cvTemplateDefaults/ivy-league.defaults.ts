import type { NativeResumeDesign } from "../cvDesignSchema";

export const ivyLeagueDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 13,
    marginRightMm: 14,
    marginBottomMm: 12,
    marginLeftMm: 14,
  },
  layout: {
    contentWidthMm: 182,
    headerHeightMm: 19,
    sectionGapMm: 6.5,
    entryGapMm: 4.5,
    titleRuleGapMm: 1.5,
    strengthsColumnGapMm: 8,
  },
  colors: {
    primary: "#073C8C",
    accent: "#FF6A00",
    heading: "#073C8C",
    text: "#3F4B50",
    mutedText: "#667177",
    divider: "#0B459A",
    activeLevel: "#073C8C",
    inactiveLevel: "#DCE9E8",
    pageBackground: "#F8FBF8",
  },
  typography: {
    headingFontFamily: '"Georgia", "Times New Roman", Times, serif',
    bodyFontFamily:
      '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif',
    nameSizePt: 17.5,
    professionSizePt: 11.5,
    sectionTitleSizePt: 13.5,
    entryTitleSizePt: 10.5,
    bodySizePt: 8.5,
    smallSizePt: 7.8,
    lineHeight: 1.34,
  },
  background: {
    opacity: 0.58,
  },
} as const;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const ivyLeagueDesignColors = {
  text: ivyLeagueDefaults.colors.text,
  paragraph: ivyLeagueDefaults.colors.text,
  heading: ivyLeagueDefaults.colors.primary,
  subheading: ivyLeagueDefaults.colors.accent,
  sectionHeading: ivyLeagueDefaults.colors.heading,
  entryHeading: ivyLeagueDefaults.colors.primary,
  divider: ivyLeagueDefaults.colors.divider,
  background: ivyLeagueDefaults.colors.pageBackground,
  accent: ivyLeagueDefaults.colors.accent,
  surface: ivyLeagueDefaults.colors.pageBackground,
  muted: ivyLeagueDefaults.colors.mutedText,
  icon: ivyLeagueDefaults.colors.accent,
};

export const ivyLeagueDesign: NativeResumeDesign = {
  tokens: {
    colors: ivyLeagueDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "georgia",
      bodySizePt: 8.4,
      headingSizePt: ivyLeagueDefaults.typography.nameSizePt,
      subheadingSizePt: ivyLeagueDefaults.typography.professionSizePt,
      sectionHeadingSizePt: ivyLeagueDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: 9.7,
      lineHeight: 1.05,
      headingWeight: 700,
      subheadingWeight: 400,
      sectionHeadingWeight: 700,
      sectionHeadingUppercase: false,
    },
    spacing: {
      pageMarginMm: 11,
      innerPaddingMm: 0,
      sectionGapMm: 4.5,
      entryGapMm: ivyLeagueDefaults.layout.entryGapMm,
      sectionTitleGapMm: 2.5,
      entryContentGapMm: 0,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: ivyLeagueDesignColors.background,
    sidebarTextColor: ivyLeagueDesignColors.text,
    sidebarSectionHeadingColor: ivyLeagueDesignColors.sectionHeading,
    mainBackgroundColor: ivyLeagueDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.3,
    sectionHeadingAlignment: "center",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: ivyLeagueDesignColors.accent,
    contactDividerColor: ivyLeagueDesignColors.divider,
    photoLayout: "hidden",
    headerLayout: "center",
  },
};
