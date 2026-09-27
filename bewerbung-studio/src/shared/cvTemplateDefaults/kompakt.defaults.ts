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
    contentTopMm: 33,
    leftColumnWidthMm: 108,
    columnGapMm: 10,
    rightColumnWidthMm: 66,
    sectionGapMm: 5.5,
    entryGapMm: 4,
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
