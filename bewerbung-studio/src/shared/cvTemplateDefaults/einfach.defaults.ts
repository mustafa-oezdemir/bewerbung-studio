import type { NativeResumeDesign } from "../cvDesignSchema";

export const einspaltigDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 14,
    marginRightMm: 15,
    marginBottomMm: 12,
    marginLeftMm: 15,
  },
  layout: {
    headerHeightMm: 35,
    sectionGapMm: 7,
    entryGapMm: 4.5,
    strengthsColumnGapMm: 15,
    photoDiameterMm: 34,
  },
  colors: {
    primary: "#0B3485",
    accent: "#4AAAF4",
    text: "#3E484E",
    muted: "#68747A",
    pattern: "#EAF5FD",
    inactive: "#E3E7EA",
  },
} as const;

/** @deprecated Nur für bestehende interne Importe. */
export const einfachDefaults = einspaltigDefaults;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const einspaltigDesignColors = {
  text: einspaltigDefaults.colors.text,
  paragraph: einspaltigDefaults.colors.text,
  heading: einspaltigDefaults.colors.primary,
  subheading: einspaltigDefaults.colors.accent,
  sectionHeading: einspaltigDefaults.colors.primary,
  entryHeading: einspaltigDefaults.colors.primary,
  divider: einspaltigDefaults.colors.primary,
  background: "#FFFFFF",
  accent: einspaltigDefaults.colors.accent,
  surface: einspaltigDefaults.colors.pattern,
  muted: einspaltigDefaults.colors.muted,
  icon: einspaltigDefaults.colors.accent,
};

export const einspaltigDesign: NativeResumeDesign = {
  tokens: {
    colors: einspaltigDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: 9.6,
      headingSizePt: 24,
      subheadingSizePt: 11.5,
      sectionHeadingSizePt: 13.5,
      entryHeadingSizePt: 11.5,
      lineHeight: 1.1,
      headingWeight: 750,
      subheadingWeight: 700,
      sectionHeadingWeight: 750,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: einspaltigDefaults.page.marginLeftMm,
      innerPaddingMm: 0,
      sectionGapMm: 5,
      entryGapMm: einspaltigDefaults.layout.entryGapMm,
      sectionTitleGapMm: 2,
      entryContentGapMm: 0,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: einspaltigDesignColors.background,
    sidebarTextColor: einspaltigDesignColors.text,
    sidebarSectionHeadingColor: einspaltigDesignColors.sectionHeading,
    mainBackgroundColor: einspaltigDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.3,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: einspaltigDesignColors.accent,
    contactDividerColor: einspaltigDesignColors.divider,
    photoLayout: "circle",
    headerLayout: "left",
  },
};
