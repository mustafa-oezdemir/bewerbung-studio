import type { NativeResumeDesign } from "../cvDesignSchema";

export const elegantDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  layout: {
    mainWidthMm: 140,
    sidebarWidthMm: 70,
    mainTopMm: 16,
    mainRightMm: 10,
    mainBottomMm: 11,
    mainLeftMm: 10,
    sidebarTopMm: 16,
    sidebarRightMm: 10,
    sidebarBottomMm: 15,
    sidebarLeftMm: 12,
    headerMinHeightMm: 38,
    sectionGapMm: 4.5,
    entryGapMm: 2,
  },
  colors: {
    primary: "#168BE0",
    sidebarBackground: "#234663",
    sidebarText: "#FFFFFF",
    sidebarMutedText: "#E3ECF4",
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
    sectionTitleSizePt: 13,
    sidebarSectionTitleSizePt: 11.5,
    entryTitleSizePt: 11,
    bodySizePt: 10.5,
    smallSizePt: 9.5,
    lineHeight: 1.2,
  },
  multipage: {
    sidebarContinuationMode: "compact" as const,
  },
} as const;

export type ElegantTemplateDefaults = typeof elegantDefaults;

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const elegantDesignColors = {
  text: elegantDefaults.colors.text,
  paragraph: elegantDefaults.colors.text,
  heading: elegantDefaults.colors.heading,
  subheading: elegantDefaults.colors.primary,
  sectionHeading: elegantDefaults.colors.heading,
  entryHeading: elegantDefaults.colors.heading,
  divider: elegantDefaults.colors.divider,
  background: elegantDefaults.colors.pageBackground,
  accent: elegantDefaults.colors.primary,
  surface: elegantDefaults.colors.pageBackground,
  muted: elegantDefaults.colors.mutedText,
  icon: elegantDefaults.colors.primary,
};

export const elegantDesign: NativeResumeDesign = {
  tokens: {
    colors: elegantDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: elegantDefaults.typography.bodySizePt,
      headingSizePt: elegantDefaults.typography.nameSizePt,
      subheadingSizePt: elegantDefaults.typography.professionSizePt,
      sectionHeadingSizePt: elegantDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: elegantDefaults.typography.entryTitleSizePt,
      lineHeight: elegantDefaults.typography.lineHeight,
      headingWeight: 500,
      subheadingWeight: 400,
      sectionHeadingWeight: 500,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: elegantDefaults.layout.mainLeftMm,
      // The column paddings of elegant.css are its page margin; it draws no inner padding of its own (see
      // cvSpacingSchema). A chosen Innenabstand therefore adds an inset instead of pulling text over the header.
      innerPaddingMm: 0,
      sectionGapMm: elegantDefaults.layout.sectionGapMm,
      entryGapMm: elegantDefaults.layout.entryGapMm,
      sectionTitleGapMm: 3.2,
      entryContentGapMm: 0.8,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: elegantDefaults.colors.sidebarBackground,
    sidebarTextColor: elegantDefaults.colors.sidebarText,
    sidebarSectionHeadingColor: "#FFFFFF",
    mainBackgroundColor: elegantDesignColors.background,
    sectionDividerPosition: "bottom",
    sectionDividerWidthMm: 0.3,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: elegantDesignColors.accent,
    contactDividerColor: elegantDesignColors.divider,
    photoLayout: "rounded",
    headerLayout: "left",
  },
};
