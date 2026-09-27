export const kreativDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginLeftMm: 15,
    marginRightMm: 15,
    marginBottomMm: 13,
  },
  layout: {
    headerHeightMm: 46,
    contentTopMm: 56,
    leftColumnWidthMm: 105,
    columnGapMm: 11,
    rightColumnWidthMm: 64,
    sectionGapMm: 7,
    entryGapMm: 4.5,
    photoWidthMm: 28,
    photoHeightMm: 28,
  },
  colors: {
    primary: "#37B978",
    primaryDark: "#075D4E",
    primarySoft: "#D9F2E5",
    heading: "#075D4E",
    text: "#465156",
    mutedText: "#687277",
    divider: "#B8C4C0",
    lightDivider: "#D7DFDC",
    pageBackground: "#FFFFFF",
    headerText: "#FFFFFF",
    inactiveLevel: "#E1E5E3",
  },
  typography: {
    fontFamily:
      '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif',
    nameSizePt: 23,
    professionSizePt: 11.5,
    sectionTitleSizePt: 14,
    entryTitleSizePt: 11,
    bodySizePt: 8.5,
    smallSizePt: 7.8,
    lineHeight: 1.3,
  },
} as const;

export type KreativTemplateDefaults = typeof kreativDefaults;
