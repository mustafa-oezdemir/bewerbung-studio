export const elegantDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  layout: {
    mainWidthMm: 140,
    sidebarWidthMm: 70,
    mainTopMm: 14,
    mainRightMm: 10,
    mainBottomMm: 13,
    mainLeftMm: 17,
    sidebarTopMm: 13,
    sidebarRightMm: 12,
    sidebarBottomMm: 13,
    sidebarLeftMm: 12,
    headerMinHeightMm: 38,
    sectionGapMm: 7,
    entryGapMm: 5,
  },
  colors: {
    primary: "#FE6201",
    sidebarBackground: "#8A0202",
    sidebarText: "#FFFFFF",
    sidebarMutedText: "#F6EAEA",
    heading: "#3B4247",
    text: "#4B5359",
    mutedText: "#6D757A",
    divider: "#B9BFC3",
    pageBackground: "#FFFFFF",
  },
  typography: {
    fontFamily:
      '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif',
    nameSizePt: 22,
    professionSizePt: 12,
    sectionTitleSizePt: 12,
    sidebarSectionTitleSizePt: 11.5,
    entryTitleSizePt: 11,
    bodySizePt: 8.7,
    smallSizePt: 8,
    lineHeight: 1.3,
  },
  multipage: {
    sidebarContinuationMode: "compact" as const,
  },
} as const;

export type ElegantTemplateDefaults = typeof elegantDefaults;
