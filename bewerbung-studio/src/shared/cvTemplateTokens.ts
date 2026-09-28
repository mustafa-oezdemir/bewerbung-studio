// Existing template constants are shared by React, Electron and this adapter.
// Adapting them keeps their original values as the source of truth.
import { einspaltigDefaults } from "./cvTemplateDefaults/einfach.defaults";
import { elegantDefaults } from "./cvTemplateDefaults/elegant.defaults";
import { gepflegtDefaults } from "./cvTemplateDefaults/gepflegt.defaults";
import { ivyLeagueDefaults } from "./cvTemplateDefaults/ivy-league.defaults";
import { klassischDefaults } from "./cvTemplateDefaults/klassisch.defaults";
import { kompaktDefaults } from "./cvTemplateDefaults/kompakt.defaults";
import { kreativDefaults } from "./cvTemplateDefaults/kreativ.defaults";
import { modernTemplateDefaults } from "./cvTemplateDefaults/modern.defaults";
import { stilvollDefaults } from "./cvTemplateDefaults/stilvoll.defaults";
import { tabellarischDefaults } from "./cvTemplateDefaults/tabellarisch.defaults";
import { zeitgenoessischDefaults } from "./cvTemplateDefaults/zeitgenoessisch.defaults";
import { zweispaltigDefaults } from "./cvTemplateDefaults/zweispaltig.defaults";
import type { CvDesignOverrides } from "./cvDesignSchema";

type NativeDefaults = {
  colors: {
    text: string; primary?: string; heading?: string; accent?: string;
    muted?: string; mutedText?: string; divider?: string; line?: string;
    border?: string; pageBackground?: string; background?: string;
  };
  typography?: {
    bodySizePt?: number; nameSizePt?: number; professionSizePt?: number;
    jobTitleSizePt?: number; sectionTitleSizePt?: number; entryTitleSizePt?: number;
    lineHeight?: number; bodyLineHeight?: number;
  };
  layout?: { sidebarWidthMm?: number; sectionGapMm?: number; entryGapMm?: number; columnGapMm?: number; marginLeftMm?: number };
  spacing?: { sectionGapMm: number; entryGapMm: number };
  page?: { widthMm?: number; marginLeftMm?: number };
  margins?: { leftMm: number };
};

const adapt = (source: NativeDefaults): CvDesignOverrides => {
  const { colors, typography, layout } = source;
  const heading = colors.heading ?? colors.primary;
  const accent = colors.accent ?? colors.primary;
  const defined = <T extends object>(values: T) =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  return {
    colors: defined({
      text: colors.text, paragraph: colors.text, heading,
      subheading: accent, sectionHeading: heading, entryHeading: heading,
      accent, icon: accent, muted: colors.muted ?? colors.mutedText,
      divider: colors.divider ?? colors.line ?? colors.border,
      background: colors.pageBackground ?? colors.background,
    }),
    typography: defined({
      bodySizePt: typography?.bodySizePt, headingSizePt: typography?.nameSizePt,
      subheadingSizePt: typography?.professionSizePt ?? typography?.jobTitleSizePt,
      sectionHeadingSizePt: typography?.sectionTitleSizePt,
      entryHeadingSizePt: typography?.entryTitleSizePt,
      lineHeight: typography?.lineHeight ?? typography?.bodyLineHeight,
    }),
    spacing: defined({
      pageMarginMm: source.page?.marginLeftMm ?? source.margins?.leftMm ?? layout?.marginLeftMm,
      sectionGapMm: source.spacing?.sectionGapMm ?? layout?.sectionGapMm,
      entryGapMm: source.spacing?.entryGapMm ?? layout?.entryGapMm,
      columnGapMm: layout?.columnGapMm,
    }),
  };
};

/** Native visual defaults; density/ATS variations remain in their template adapters. */
export const cvTemplateTokens: Record<string, CvDesignOverrides> = {
  modern: adapt(modernTemplateDefaults),
  elegant: adapt(elegantDefaults),
  gepflegt: adapt(gepflegtDefaults),
  "ivy-league": adapt(ivyLeagueDefaults),
  zweispaltig: adapt(zweispaltigDefaults),
  zeitgenoessisch: adapt(zeitgenoessischDefaults),
  kreativ: adapt(kreativDefaults),
  tabellarisch: adapt(tabellarischDefaults),
  einspaltig: {
    ...adapt(einspaltigDefaults),
    typography: { headingSizePt: 24, subheadingSizePt: 11.5, sectionHeadingSizePt: 13.5, entryHeadingSizePt: 11.5, bodySizePt: 10.4, lineHeight: 1.12 },
  },
  klassisch: {
    ...adapt(klassischDefaults),
    typography: { headingSizePt: 26, subheadingSizePt: 12.2, sectionHeadingSizePt: 10.4, entryHeadingSizePt: 12.2, bodySizePt: 8.5, lineHeight: 1.25 },
  },
  kompakt: {
    ...adapt(kompaktDefaults),
    typography: { headingSizePt: 20, subheadingSizePt: 8.5, sectionHeadingSizePt: 8.5, entryHeadingSizePt: 10.5, bodySizePt: 8, lineHeight: 1.25 },
    spacing: { ...adapt(kompaktDefaults).spacing, sectionTitleGapMm: kompaktDefaults.layout.sectionTitleGapMm, entryContentGapMm: kompaktDefaults.layout.entryContentGapMm },
  },
  stilvoll: {
    ...adapt(stilvollDefaults),
    colors: { ...adapt(stilvollDefaults).colors, heading: stilvollDefaults.colors.primaryDark, entryHeading: stilvollDefaults.colors.primaryDark, sectionHeading: stilvollDefaults.colors.muted },
    typography: { headingSizePt: 23, subheadingSizePt: 12, sectionHeadingSizePt: 9.5, entryHeadingSizePt: 11, bodySizePt: 8.5, lineHeight: 1.3 },
    spacing: { ...adapt(stilvollDefaults).spacing, sectionTitleGapMm: stilvollDefaults.layout.sectionTitleGapMm, entryContentGapMm: stilvollDefaults.layout.entryContentGapMm },
  },
  // Pehlione's originals live in CSS rather than a *.defaults.ts module.
  pehlione_white_blue: {
    colors: { text: "#142235", paragraph: "#142235", heading: "#0B3D86", subheading: "#12294E", sectionHeading: "#0B3D86", entryHeading: "#0B3D86", divider: "#B8C3D0", background: "#FFFFFF", accent: "#0B3D86", surface: "#F1F6FC", muted: "#526272", icon: "#0B3D86" },
    typography: { headingSizePt: 29, subheadingSizePt: 13, sectionHeadingSizePt: 13, entryHeadingSizePt: 10.4, bodySizePt: 9.7, lineHeight: 1.42 },
    spacing: { pageMarginMm: 10, sectionGapMm: 6, entryGapMm: 4, sectionTitleGapMm: 3 },
  },
  pehlione_white: {
    colors: { text: "#142235", paragraph: "#142235", heading: "#08245C", subheading: "#12294E", sectionHeading: "#08245C", entryHeading: "#08245C", divider: "#B8C3D0", background: "#FFFFFF", accent: "#08245C", surface: "#F1F6FC", muted: "#526272", icon: "#08245C" },
    typography: { headingSizePt: 29, subheadingSizePt: 13, sectionHeadingSizePt: 13, entryHeadingSizePt: 10.4, bodySizePt: 9.7, lineHeight: 1.42 },
    spacing: { pageMarginMm: 10, sectionGapMm: 6, entryGapMm: 4, sectionTitleGapMm: 3 },
  },
};
