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
