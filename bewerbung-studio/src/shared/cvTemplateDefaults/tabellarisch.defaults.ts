import type { NativeResumeDesign } from "../cvDesignSchema";

/**
 * Tabellarisch Template - Design Defaults & Tokens
 * Modern timeline-based CV template for experienced professionals
 */

export const tabellarischDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  /**
   * The margins the page is drawn with (measured on preview and PDF). Left and right follow "Seitenränder"
   * (`spacing.pageMarginMm`, native 15 mm); top and bottom stay. Below the bottom margin the content keeps
   * `layout.footerClearanceMm` clear for the page footer: the flowing text ends 19 mm above the sheet edge.
   */
  margins: {
    topMm: 15,
    rightMm: 15,
    bottomMm: 14,
    leftMm: 15,
  },
  header: {
    heightMm: 30,
    photoSizeMm: 30,
    photoCircular: true,
    gridGapMm: 10,
    /** The first section's distance to the header is its section gap (`spacing.sectionGapMm`). */
    marginBottomMm: 6.3,
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
    /** The section titles (both surfaces have drawn them in this blue). */
    sectionTitle: "#0B3D86",
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
    /** Line height of the reading text (paragraphs, bullets, lists): the semantic `typography.lineHeight`. */
    bodyLineHeight: 1.1,
    smallSizePt: 8.2,
    smallLineHeight: 1.3,
    nameLineHeight: 1,
    jobTitleLineHeight: 1.15,
    sectionTitleLineHeight: 1.05,
    sectionTitleTrackingEm: 0.01,
    entryTitleLineHeight: 1.15,
    entryTitleRenderedWeight: 500,
    organizationSizePt: 10.2,
    organizationWeight: 700,
    organizationLineHeight: 1.2,
    dateSizePt: 10,
    dateWeight: 750,
    dateLineHeight: 1.15,
    locationSizePt: 8.4,
    locationLineHeight: 1.3,
    continuationNameSizePt: 13,
    continuationTitleSizePt: 9,
    footerSizePt: 7.5,
    footerLineHeight: 1.2,
  },
  /** The stylesheet's layout measures (preview `tabellarisch.css` and the PDF's `tabellarischDocumentCss`). */
  layout: {
    /** Kept clear between the flowing text and the bottom margin: the page footer stands there. */
    footerClearanceMm: 5,
    footerBottomMm: 6,
    sectionTitleGapMm: 3.5,
    /** Date column (grows from 30 to 35 mm), the rail and the two column gaps of a timeline entry. */
    metaColumnMm: 35,
    railColumnMm: 7,
    timelineGapMm: 4,
    metaPaddingTopMm: 0.45,
    locationGapMm: 2,
    /** Above the organisation: the Abstand nach Eintragstitel (`spacing.entryContentGapMm`); below it 1.5 mm. */
    organizationGapAfterMm: 1.5,
    listIndentMm: 4.5,
    listItemPaddingMm: 0.5,
    /** Margin above and below every bullet (adjacent ones collapse to one). */
    bulletGapMm: 0.45,
    continuationHeaderPaddingMm: 2.5,
    continuationHeaderRuleMm: 0.35,
    continuationHeaderGapMm: 6,
    continuationHeaderColumnGapMm: 8,
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

/** Semantic design of the rendered template (measured on the PDF at standard density); values the module names itself are referenced. */
const tabellarischDesignColors = {
  text: tabellarischDefaults.colors.text,
  paragraph: tabellarischDefaults.colors.text,
  heading: tabellarischDefaults.colors.primary,
  subheading: tabellarischDefaults.colors.accent,
  sectionHeading: tabellarischDefaults.colors.sectionTitle,
  entryHeading: tabellarischDefaults.colors.primary,
  divider: tabellarischDefaults.colors.line,
  background: tabellarischDefaults.colors.background,
  accent: tabellarischDefaults.colors.accent,
  surface: "#FFFFFF",
  muted: tabellarischDefaults.colors.muted,
  icon: tabellarischDefaults.colors.accent,
};

export const tabellarischDesign: NativeResumeDesign = {
  tokens: {
    colors: tabellarischDesignColors,
    typography: {
      fontId: "source-sans",
      headingFontId: "source-sans",
      bodySizePt: tabellarischDefaults.typography.bodySizePt,
      headingSizePt: tabellarischDefaults.typography.nameSizePt,
      subheadingSizePt: tabellarischDefaults.typography.jobTitleSizePt,
      sectionHeadingSizePt: tabellarischDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: tabellarischDefaults.typography.entryTitleSizePt,
      lineHeight: tabellarischDefaults.typography.bodyLineHeight,
      headingWeight: 750,
      subheadingWeight: 650,
      sectionHeadingWeight: 750,
      sectionHeadingUppercase: true,
    },
    spacing: {
      pageMarginMm: tabellarischDefaults.margins.leftMm,
      innerPaddingMm: 0,
      sectionGapMm: tabellarischDefaults.spacing.sectionGapMm,
      entryGapMm: tabellarischDefaults.spacing.entryGapMm,
      sectionTitleGapMm: tabellarischDefaults.layout.sectionTitleGapMm,
      entryContentGapMm: 1,
      columnGapMm: 0,
    },
  },
  appearance: {
    sidebarBackgroundColor: tabellarischDesignColors.background,
    sidebarTextColor: tabellarischDesignColors.text,
    sidebarSectionHeadingColor: tabellarischDesignColors.sectionHeading,
    mainBackgroundColor: tabellarischDesignColors.background,
    sectionDividerPosition: "none",
    sectionDividerWidthMm: 0,
    sectionHeadingAlignment: "left",
    sectionHeadingMarginBeforeMm: 0,
    photoDecorationVisible: false,
    photoDecorationColor: tabellarischDesignColors.accent,
    contactDividerColor: tabellarischDesignColors.divider,
    photoLayout: "circle",
    headerLayout: "left",
  },
};
