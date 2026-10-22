import type { NativeResumeDesign } from "../cvDesignSchema";
import { zweispaltigDesign } from "./zweispaltig.defaults";

/** The reference layout's turquoise, white and neutral palette. */
export const tuerkisProfilDesign: NativeResumeDesign = {
  tokens: {
    ...zweispaltigDesign.tokens,
    colors: {
      ...zweispaltigDesign.tokens.colors,
      text: "#3F464B", paragraph: "#3F464B", heading: "#24A9E1",
      subheading: "#24A9E1", sectionHeading: "#42484C", entryHeading: "#42484C",
      divider: "#24A9E1", accent: "#24A9E1", surface: "#FFFFFF",
      muted: "#687177", icon: "#24A9E1", background: "#FFFFFF",
    },
    spacing: {
      ...zweispaltigDesign.tokens.spacing,
      pageMarginMm: 12, columnGapMm: 8, sectionGapMm: 5, entryGapMm: 3.5,
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
