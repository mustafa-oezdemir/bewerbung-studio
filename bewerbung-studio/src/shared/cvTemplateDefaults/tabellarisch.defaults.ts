/**
 * Tabellarisch Template - Design Defaults & Tokens
 * Modern timeline-based CV template for experienced professionals
 */

export const tabellarischDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  margins: {
    topMm: 16,
    rightMm: 17,
    bottomMm: 14,
    leftMm: 17,
  },
  header: {
    heightMm: 30,
    photoSizeMm: 30,
    photoCircular: true,
    gridGapMm: 10,
    marginBottomMm: 6,
  },
  background: {
    heightMm: 58,
    opacity: 0.2,
    geometricPattern: true,
  },
  timeline: {
    dateColumnMinMm: 30,
    dateColumnMaxMm: 35,
    railWidthMm: 7,
    railGapMm: 4,
    dotSizeMm: 2.3,
    lineWidthMm: 0.35,
  },
  spacing: {
    sectionGapMm: 6.3,
    entryGapMm: 4.4,
    itemGapMm: 1.2,
  },
  colors: {
    primary: "#17263d",
    accent: "#c78300",
    text: "#3f4850",
    muted: "#6d747a",
    line: "#c8cdd1",
    background: "#ffffff",
  },
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", Arial, sans-serif',
    headingFontFamily: '"Source Sans 3", "Segoe UI", Arial, sans-serif',
    nameSizePt: 25,
    nameWeight: 700,
    jobTitleSizePt: 13.5,
    jobTitleWeight: 600,
    sectionTitleSizePt: 15,
    sectionTitleWeight: 700,
    entryTitleSizePt: 12,
    entryTitleWeight: 600,
    bodySizePt: 9.2,
    bodyWeight: 400,
    bodyLineHeight: 1.4,
    smallSizePt: 8.2,
    smallLineHeight: 1.3,
  },
  strengths: {
    columnsCount: 2,
    gapRowMm: 5,
    gapColMm: 12,
    iconSizeMm: 8,
    iconGapMm: 2.5,
  },
  footer: {
    heightMm: 3,
    bottomMm: 6,
  },
} as const;

export type TabellarischTemplateDefaults = typeof tabellarischDefaults;
