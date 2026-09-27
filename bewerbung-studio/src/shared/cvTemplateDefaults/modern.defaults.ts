/**
 * Modern template default values and design tokens
 * Based on z_Modern.md specifications
 */

export const modernTemplateDefaults = {
  // Page dimensions (A4)
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 15,
    marginRightMm: 15,
    marginBottomMm: 14,
    marginLeftMm: 15,
  },

  // Layout measurements
  layout: {
    headerHeightMm: 25,
    photoSizeMm: 25,
    photoTopMm: 6,
    photoRightMm: 15,
    contentStartMm: 44,
    columnGapMm: 11,
    leftColumnWidthMm: 102,
    rightColumnWidthMm: 67,
    sectionGapMm: 7,
    entryGapMm: 4,
    footerTopMm: 280,
    footerHeightMm: 10,
  },

  // Wave background
  waves: {
    topWaveHeightMm: 55,
    topWaveAscentRightMm: 48,
    bottomWaveHeightMm: 65,
    bottomWaveWidthMm: 55,
  },

  // Colors
  colors: {
    primary: "#06B6C9", // Bright turquoise
    primarySoft: "#C7F1F5", // Soft light turquoise
    secondary: "#E8FAFB", // Very light turquoise
    heading: "#303437", // Dark gray
    text: "#444B4F", // Medium gray
    mutedText: "#686F73", // Muted gray
    divider: "#AEB4B6", // Divider gray
    iconBackground: "#F2F3F3", // Light gray bg for icons
    pageBackground: "#FFFFFF", // Page white
    waveColor: "#06B6C9", // Wave turquoise
  },

  // Typography (pt = points)
  typography: {
    fontFamily: '"Source Sans 3", "Segoe UI", Arial, sans-serif',
    nameSizePt: 24,
    nameWeight: 700,
    professionSizePt: 12.5,
    professionWeight: 500,
    sectionTitleSizePt: 9.2,
    sectionTitleWeight: 500,
    entryTitleSizePt: 11,
    entryTitleWeight: 500,
    companySizePt: 9.2,
    companyWeight: 600,
    bodySizePt: 8.4,
    smallSizePt: 7.9,
    lineHeight: 1.27,
    smallLineHeight: 1.2,
  },

  // Component-specific spacing
  header: {
    nameBelowProfessionGapMm: 1,
    photoAlignmentRightMm: 0,
  },

  contact: {
    iconSizeMm: 8.5,
    iconGapMm: 3,
    itemGapMm: 3.2,
  },

  sections: {
    titleBelowGapMm: 3.2,
    titleUnderlineHeightMm: 0.35,
  },

  experience: {
    roleBottomGapMm: 1,
    metaBottomGapMm: 1.5,
    summaryBottomGapMm: 1,
  },
} as const;

export type ModernTemplateDefaults = typeof modernTemplateDefaults;
