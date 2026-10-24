import type { NativeResumeDesign } from "../cvDesignSchema";
import { zweispaltigDesign } from "./zweispaltig.defaults";

/**
 * Türkis Profil's DIN-oriented page (karrierebibel / DIN 5008): margins 25 mm left, 20 mm right, 25 mm top, 20 mm bottom
 * (top and bottom never move; Seitenränder sets left and right), one sans-serif family, 11 pt text at 1.25, 14 pt
 * section titles, one accent colour. Sizes the stylesheet does not take from the design tokens live here.
 */
export const tuerkisProfilDefaults = {
  page: { widthMm: 210, heightMm: 297, marginLeftMm: 25, marginRightMm: 20, marginTopMm: 25, marginBottomMm: 20 },
  layout: { columnGapMm: 8, sidebarShare: 0.4, photoHeightMm: 53, photoGapMm: 3 },
  typography: {
    bodySizePt: 11,
    lineHeight: 1.25,
    nameSizePt: 24,
    professionSizePt: 11,
    sectionTitleSizePt: 14,
    entryTitleSizePt: 12,
    /** Dates and places beside the entry titles, the contact rows and the page footer. */
    metaSizePt: 9.5,
    contactSizePt: 10,
  },
} as const;

/** The reference layout's turquoise, white and neutral palette. */
export const tuerkisProfilDesign: NativeResumeDesign = {
  tokens: {
    ...zweispaltigDesign.tokens,
    typography: {
      ...zweispaltigDesign.tokens.typography,
      bodySizePt: tuerkisProfilDefaults.typography.bodySizePt,
      lineHeight: tuerkisProfilDefaults.typography.lineHeight,
      headingSizePt: tuerkisProfilDefaults.typography.nameSizePt,
      subheadingSizePt: tuerkisProfilDefaults.typography.professionSizePt,
      sectionHeadingSizePt: tuerkisProfilDefaults.typography.sectionTitleSizePt,
      entryHeadingSizePt: tuerkisProfilDefaults.typography.entryTitleSizePt,
    },
    colors: {
      ...zweispaltigDesign.tokens.colors,
      text: "#3F464B", paragraph: "#3F464B", heading: "#24A9E1",
      subheading: "#24A9E1", sectionHeading: "#42484C", entryHeading: "#42484C",
      divider: "#24A9E1", accent: "#24A9E1", surface: "#FFFFFF",
      muted: "#687177", icon: "#24A9E1", background: "#FFFFFF",
    },
    spacing: {
      ...zweispaltigDesign.tokens.spacing,
      pageMarginMm: tuerkisProfilDefaults.page.marginLeftMm, columnGapMm: tuerkisProfilDefaults.layout.columnGapMm,
      sectionGapMm: 6.5, entryGapMm: 3.5,
    },
  },
  appearance: {
    ...zweispaltigDesign.appearance,
    sidebarBackgroundColor: "#FFFFFF",
    sidebarTextColor: "#3F464B",
    sidebarSectionHeadingColor: "#42484C",
    sectionDividerWidthMm: 0.4,
    photoLayout: "square",
  },
};
