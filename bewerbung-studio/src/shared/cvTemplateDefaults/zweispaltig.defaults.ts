export const zweispaltigDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  layout: {
    marginTopMm: 16,
    marginRightMm: 17,
    marginBottomMm: 13,
    marginLeftMm: 17,
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
    bodySizePt: 8.4,
    smallSizePt: 7.5,
    lineHeight: 1.3,
  },
} as const;

export type ZweispaltigTemplateDefaults = typeof zweispaltigDefaults;
