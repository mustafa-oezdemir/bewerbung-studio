import type { NativeResumeDesign } from "../cvDesignSchema";

/**
 * Pehlione's stylesheets (pehlione*.css and the PDF block in electron/documents.ts) own its look, so there is no
 * layout module like the other templates have. These are the values those stylesheets draw; the design resolver, the
 * design panel and the override adapters read the template from here and nowhere else.
 */
const sharedTypography = {
  bodySizePt: 9.2,
  headingSizePt: 29,
  subheadingSizePt: 13,
  sectionHeadingSizePt: 13,
  lineHeight: 1.2,
  headingWeight: 800,
  subheadingWeight: 700,
  sectionHeadingWeight: 700,
} as const;

export const pehlioneWhiteBlueDefaults = {
  colors: {
    primary: "#0B3D86",
    text: "#142235",
    subtitle: "#12294E",
    surface: "#F1F6FC",
    muted: "#526272",
    divider: "#B8C3D0",
    background: "#FFFFFF",
    sidebarBackground: "#0B3D86",
    sidebarText: "#FFFFFF",
    sidebarSectionHeading: "#FFFFFF",
    contactDivider: "#FFFFFF",
    photoDecoration: "#D9EBFF",
  },
  typography: { ...sharedTypography, entryHeadingSizePt: 9 },
  layout: { sidebarMarginMm: 7, sectionGapMm: 6, entryGapMm: 4, sectionTitleGapMm: 3, entryContentGapMm: 1 },
  /** The sidebar draws smaller, tighter section titles than the main column. */
  sidebar: { sectionHeadingSizePt: 9.7, sectionGapMm: 4.5, sectionTitleGapMm: 2, originalHeadingSizePt: 10.5, originalSectionGapMm: 7, listIndentMm: 4, contactTextOffsetMm: 6.5, strengthIconGapMm: 1.5 },
} as const;

export const pehlioneWhiteDefaults = {
  colors: {
    primary: "#08245C",
    text: "#142235",
    subtitle: "#12294E",
    surface: "#F1F6FC",
    muted: "#526272",
    divider: "#B8C3D0",
    background: "#FFFFFF",
    sidebarBackground: "#FFFFFF",
    sidebarText: "#142235",
    sidebarSectionHeading: "#08245C",
    contactDivider: "#08245C",
    photoDecoration: "#DCECFF",
  },
  typography: { ...sharedTypography, entryHeadingSizePt: 10.4 },
  layout: pehlioneWhiteBlueDefaults.layout,
  // The white sidebar's content follows the text column of its contact rows.
  sidebar: { ...pehlioneWhiteBlueDefaults.sidebar, listIndentMm: 6.5, strengthIconGapMm: 2.5, specialListIndentMm: 4 },
} as const;

type PehlioneDefaults = typeof pehlioneWhiteBlueDefaults | typeof pehlioneWhiteDefaults;

/** Both themes share typography and spacing; they differ in colours and in the entry title size. */
const pehlioneDesign = (defaults: PehlioneDefaults): NativeResumeDesign => {
  const { colors, layout, typography } = defaults;
  return {
    tokens: {
      colors: {
        text: colors.text,
        paragraph: colors.text,
        heading: colors.primary,
        subheading: colors.subtitle,
        sectionHeading: colors.primary,
        entryHeading: colors.primary,
        divider: colors.divider,
        background: colors.background,
        accent: colors.primary,
        surface: colors.surface,
        muted: colors.muted,
        icon: colors.primary,
      },
      typography: {
        fontId: "source-sans",
        headingFontId: "source-sans",
        bodySizePt: typography.bodySizePt,
        headingSizePt: typography.headingSizePt,
        subheadingSizePt: typography.subheadingSizePt,
        sectionHeadingSizePt: typography.sectionHeadingSizePt,
        entryHeadingSizePt: typography.entryHeadingSizePt,
        lineHeight: typography.lineHeight,
        headingWeight: typography.headingWeight,
        subheadingWeight: typography.subheadingWeight,
        sectionHeadingWeight: typography.sectionHeadingWeight,
        sectionHeadingUppercase: true,
      },
      spacing: {
        pageMarginMm: layout.sidebarMarginMm,
        innerPaddingMm: layout.sidebarMarginMm,
        sectionGapMm: layout.sectionGapMm,
        entryGapMm: layout.entryGapMm,
        sectionTitleGapMm: layout.sectionTitleGapMm,
        entryContentGapMm: layout.entryContentGapMm,
        columnGapMm: 0,
      },
    },
    appearance: {
      sidebarBackgroundColor: colors.sidebarBackground,
      sidebarTextColor: colors.sidebarText,
      sidebarSectionHeadingColor: colors.sidebarSectionHeading,
      mainBackgroundColor: colors.background,
      sectionDividerPosition: "bottom",
      sectionDividerWidthMm: 0.3,
      sectionHeadingAlignment: "left",
      sectionHeadingMarginBeforeMm: 0,
      photoDecorationVisible: true,
      photoDecorationColor: colors.photoDecoration,
      contactDividerColor: colors.contactDivider,
      photoLayout: "circle",
      headerLayout: "left",
    },
  };
};

export const pehlioneWhiteBlueDesign = pehlioneDesign(pehlioneWhiteBlueDefaults);
export const pehlioneWhiteDesign = pehlioneDesign(pehlioneWhiteDefaults);
