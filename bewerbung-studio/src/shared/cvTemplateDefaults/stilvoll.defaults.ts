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
    contentTopMm: 50,
    leftColumnWidthMm: 54,
    columnGapMm: 11,
    rightColumnWidthMm: 115,
    sectionGapMm: 7,
    entryGapMm: 5,
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
