import {
  fontSizeToPt, getDocumentFont, lineHeightLevelToValue, marginLevelToMm, paddingLevelToMm, sectionSpacingLevelToMm,
  type DocumentDesignSettings,
} from "../documentDesign";
import type { NativeResumeDesign } from "../cvDesignSchema";
import { getReadableTextColor } from "../templates";

/**
 * The generic `.cv-page` renderer in electron/documents.ts draws the retired templates (`modern-sidebar`,
 * `classic-professional`, ...). It has no stylesheet of its own: its sizes are fixed in that CSS block and its spacing
 * and colours come from the document settings, so the settings are this renderer's native design.
 */
const genericRenderer = {
  nameSizePt: 25,
  subheadingSizePt: 14,
  sectionHeadingSizePt: 11,
  entryHeadingSizePt: 11.5,
  subheadingWeight: 500,
  sectionHeadingWeight: 600,
  sectionHeadingColor: "#535C5B",
  dividerColor: "#AEB6B5",
  mutedColor: "#5C6870",
  sectionTitleGapMm: 3,
  entryContentGapMm: 1,
  /** `.cv-entry` is spaced by this share of the section gap. */
  entryGapShare: 0.8,
  dividerWidthMm: 0.26,
} as const;

const mix = (first: string, second: string, share: number) => {
  const channel = (hex: string, index: number) => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return `#${[0, 1, 2].map((index) => Math.round(channel(first, index) * share + channel(second, index) * (1 - share))
    .toString(16).padStart(2, "0")).join("").toUpperCase()}`;
};

const round = (value: number) => Math.round(value * 10) / 10;

export const legacyGenericDesign = (settings: DocumentDesignSettings, accent: string, secondary: string, centered: boolean): NativeResumeDesign => {
  const sectionGapMm = sectionSpacingLevelToMm[settings.sectionSpacingLevel];
  const renderer = genericRenderer;
  return {
    tokens: {
      colors: {
        text: settings.textColor,
        paragraph: settings.textColor,
        heading: settings.headingColor,
        subheading: accent,
        sectionHeading: renderer.sectionHeadingColor,
        entryHeading: mix(accent, "#172125", 0.76),
        divider: renderer.dividerColor,
        background: settings.backgroundColor,
        accent,
        surface: secondary,
        muted: renderer.mutedColor,
        icon: accent,
      },
      typography: {
        fontId: settings.fontId,
        headingFontId: settings.headingFontId,
        bodySizePt: fontSizeToPt[settings.fontSize],
        headingSizePt: renderer.nameSizePt,
        subheadingSizePt: renderer.subheadingSizePt,
        sectionHeadingSizePt: renderer.sectionHeadingSizePt,
        entryHeadingSizePt: renderer.entryHeadingSizePt,
        lineHeight: lineHeightLevelToValue[settings.lineHeightLevel],
        headingWeight: getDocumentFont(settings.headingFontId).headingWeight,
        subheadingWeight: renderer.subheadingWeight,
        sectionHeadingWeight: renderer.sectionHeadingWeight,
        sectionHeadingUppercase: true,
      },
      spacing: {
        pageMarginMm: marginLevelToMm[settings.marginLevel],
        innerPaddingMm: paddingLevelToMm[settings.paddingLevel],
        sectionGapMm,
        entryGapMm: round(sectionGapMm * renderer.entryGapShare),
        sectionTitleGapMm: renderer.sectionTitleGapMm,
        entryContentGapMm: renderer.entryContentGapMm,
        columnGapMm: 0,
      },
    },
    appearance: {
      sidebarBackgroundColor: secondary,
      sidebarTextColor: getReadableTextColor(secondary).toUpperCase(),
      sidebarSectionHeadingColor: getReadableTextColor(secondary).toUpperCase(),
      mainBackgroundColor: settings.backgroundColor,
      sectionDividerPosition: "bottom",
      sectionDividerWidthMm: renderer.dividerWidthMm,
      sectionHeadingAlignment: "left",
      sectionHeadingMarginBeforeMm: 0,
      photoDecorationVisible: false,
      photoDecorationColor: accent,
      contactDividerColor: renderer.dividerColor,
      photoLayout: "circle",
      headerLayout: centered ? "center" : "left",
    },
  };
};
