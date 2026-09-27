export const gepflegtDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  layout: {
    sidebarWidthMm: 72,
    topBarHeightMm: 3.5,
  },
  sidebar: {
    paddingTopMm: 9,
    paddingRightMm: 10,
    paddingBottomMm: 13,
    paddingLeftMm: 10,
    photoSizeMm: 26,
  },
  main: {
    paddingTopMm: 9,
    paddingRightMm: 10,
    paddingBottomMm: 13,
    paddingLeftMm: 9,
  },
  spacing: {
    sectionGapMm: 7,
    entryGapMm: 4.5,
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
    bodySizePt: 8.8,
    smallSizePt: 8,
    bodyLineHeight: 1.28,
  },
  output: {
    supportsAtsMode: true,
    supportsVisualMode: true,
    supportsFreeform: true,
  },
};

export type GepflegtTemplateDefaults = typeof gepflegtDefaults;
