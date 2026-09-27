export const zeitgenoessischDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 15,
    marginRightMm: 17,
    marginBottomMm: 14,
    marginLeftMm: 17,
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
    sectionTitleSizePt: 11,
    entryTitleSizePt: 10.5,
    bodySizePt: 8.5,
    smallSizePt: 7.8,
    lineHeight: 1.32,
  },
} as const;

export type ZeitgenoessischTemplateDefaults =
  typeof zeitgenoessischDefaults;
