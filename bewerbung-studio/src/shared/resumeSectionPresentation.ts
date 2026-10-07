/**
 * One place that decides how a résumé section *looks* — its icon, its heading and its list —
 * from the section, the template and the column it is drawn in (`main` or `sidebar`).
 *
 * The React preview and the PDF both post-process their pages with `applyResumeSectionPresentation`
 * and both load `resumeSectionPresentationCss`, so a section that moves between the columns changes
 * its heading in the same way on either surface, and no surface keeps a private icon set.
 *
 * Only templates listed in `zoneFlowTemplates` are covered. The others keep their own, unchanged
 * headings until their round of verification names them.
 */

import { pehlioneWhiteBlueDefaults, pehlioneWhiteDefaults, pehlioneWhiteBlueDesign } from "./cvTemplateDefaults/pehlione.defaults";
import { stilvollDesign } from "./cvTemplateDefaults/stilvoll.defaults";

export type SectionZone = "main" | "sidebar";
export type SectionSurface = "preview" | "pdf";

/** What a section is, whatever the user called it. */
export type SectionSemanticType =
  | "summary"
  | "strengths"
  | "experience"
  | "education"
  | "knowledge"
  | "certifications"
  | "languages"
  | "projects"
  | "custom";

export type SectionIconKey =
  | "profile"
  | "competencies"
  | "technical"
  | "experience"
  | "education"
  | "certificates"
  | "languages"
  | "project"
  | "generic";

// ---------------------------------------------------------------------------
// Icon registry (Lucide, ISC licence): the only icon source of the section headings.
// ---------------------------------------------------------------------------

const lightbulb =
  '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>';
const graduationCap =
  '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>';

export const sectionIcons: Record<SectionIconKey, string> = {
  profile: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  competencies: lightbulb,
  technical:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  experience:
    '<path d="M12 12h.01"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M22 13a18.15 18.15 0 0 1-20 0"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  education: graduationCap,
  certificates: graduationCap,
  languages:
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  project: lightbulb,
  generic: '<path d="M12 2 3 12l9 10 9-10Z"/>',
};

/** The icon glyph as inline SVG; sizes, stroke width and colours come from the presentation CSS. */
export const sectionIconSvg = (key: SectionIconKey) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${sectionIcons[key]}</svg>`;

const iconOfType: Record<SectionSemanticType, SectionIconKey> = {
  summary: "profile",
  strengths: "competencies",
  experience: "experience",
  education: "education",
  knowledge: "technical",
  certifications: "certificates",
  languages: "languages",
  projects: "project",
  custom: "generic",
};

/**
 * The semantic type of a managed section id. Knowledge groups that stand for a built-in
 * section (`core-competencies`, `training`, ...) count as that section; everything the user
 * added (special sections, free groups) is `custom`.
 */
const builtInSections: readonly string[] = [
  "summary", "strengths", "experience", "education", "knowledge", "certifications", "languages", "projects",
];

export const sectionSemanticType = (id: string, groupSemanticType?: string): SectionSemanticType => {
  if (builtInSections.includes(id)) return id as SectionSemanticType;
  if (id.startsWith("group:")) {
    if (groupSemanticType === "core-competencies") return "strengths";
    if (groupSemanticType === "technical-focus") return "knowledge";
    if (groupSemanticType === "training" || groupSemanticType === "certificates") return "certifications";
    if (groupSemanticType === "project-highlight") return "projects";
  }
  return "custom";
};

// ---------------------------------------------------------------------------
// Template policy
// ---------------------------------------------------------------------------

/**
 * Templates whose sections follow their column: a section's preferred column (`main` or `sidebar`)
 * is independent of the page the pagination puts it on, the headings are resolved per column,
 * and the closing date comes from the application. Templates join this list one by one, after
 * their look was verified on both surfaces.
 */
export const zoneFlowTemplates: readonly string[] = ["pehlione_white_blue", "pehlione_white", "zweispaltig", "zeitgenoessisch", "kreativ", "ivy-league", "stilvoll", "kompakt", "einspaltig", "klassisch", "gepflegt", "modern"];

export const isZoneFlowTemplate = (templateId: string | undefined): boolean =>
  Boolean(templateId && zoneFlowTemplates.includes(templateId));

/**
 * Two-column templates that draw a continuation sidebar (preview and PDF), so
 * that a section the user put into the Seitenspalte stays there on page two and later. Only these templates let
 * the sidebar run through the pages as a lane of its own and break a sidebar section at its item boundaries;
 * the others keep a sidebar block whole (page one, or the main column of the last page). Templates join one by
 * one, once both surfaces draw the continuation sidebar and its column surface.
 */
export const sidebarContinuationTemplates: readonly string[] = ["zeitgenoessisch", "zweispaltig", "stilvoll", "kreativ", "gepflegt", "elegant"];

/**
 * Templates whose Bildungsweg entries the output can cut between their detail units (`applyEducationBreaks`): the planner
 * lets such an entry start on page one with its header and the first details and go on on the next page, instead of
 * moving the whole entry (and with it the heading) to the next page when it does not fit as a whole.
 */
export const educationSplitTemplates: readonly string[] = [
  "zweispaltig", "zeitgenoessisch", "kreativ", "stilvoll", "kompakt", "gepflegt", "elegant", "modern",
  "tabellarisch", "klassisch", "einspaltig", "ivy-league", "pehlione_white", "pehlione_white_blue",
];
export const supportsEducationSplit = (templateId: string | undefined): boolean =>
  Boolean(templateId && educationSplitTemplates.includes(templateId));

export const supportsSidebarContinuation = (templateId: string | undefined): boolean =>
  Boolean(templateId && sidebarContinuationTemplates.includes(templateId));

/** The closing of these templates prints the application date (`Ort, DD.MM.YYYY`), not a profile field. */
export const usesApplicationClosingDate = (templateId: string | undefined): boolean => isZoneFlowTemplate(templateId);

// ---------------------------------------------------------------------------
// Presentation tokens
// ---------------------------------------------------------------------------

export type SectionHeadingTokens = {
  /** Width of the icon box and of the first grid column, and the gap behind it (mm). */
  iconBox: number;
  iconGap: number;
  iconRadius: number;
  glyphSize: number;
  glyphStroke: number;
  fontSizePt: { standard: number; compact: number };
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  textTransform: "uppercase" | "none";
  textAlign?: "left" | "center";
  fontFamily?: string;
  /** Space under the heading and under the divider line (mm). */
  marginBottom: { standard: number; compact: number };
  labelPadding: { standard: number; compact: number };
  labelPaddingTop?: number;
  color: string;
  dividerColor: string;
  /** Thickness of the divider line under the title. */
  dividerWidth?: string;
  iconColor: string;
  iconBackground: string;
  /**
   * Space around the whole section (mm). A template that spaces its sections by a top margin of its own
   * (Zweispaltig) names the side and may pass the CSS expression its native stylesheet uses, so that the
   * design settings and the density keep steering it.
   */
  sectionGap: { standard: number; compact: number; side?: "top" | "bottom"; expr?: string };
  /** Height of the heading itself (mm) when it is not the icon box: a plain title with its padding and rule. */
  height?: number;
};

export type SectionListTokens = {
  fontSizePt: { standard: number; compact: number };
  lineHeight: { standard: number; compact: number };
  /** Line height of the entries themselves, when it differs from the list's. */
  itemLineHeight?: number;
  /** Space between two entries (mm): the item margin in the main column, the grid gap in the sidebar. */
  itemGap: { standard: number; compact: number };
  indent: number;
  /** Text size and line height come from the body of the page (the design settings steer them). */
  inheritBody?: boolean;
  /** `margins` (default in the main column) spaces the entries by their margins, `grid` (sidebar) by a grid gap. */
  layout?: "margins" | "grid";
  /** Space between the heading and the list (mm), for templates whose list has a margin of its own. */
  marginTop?: number;
  markerColor?: string;
  /** A template's native marker for canonical plain-list entries. */
  itemPrefix?: string;
  /** `list-style` of the list (default `disc`); a template whose entries are plain lines passes `none`. */
  listStyle?: string;
  /** With `inheritBody`: the text size / line height of the page body as this template's stylesheet names them. */
  fontExpr?: string;
  lineHeightExpr?: string;
};

export type SectionPresentation = {
  templateId: string;
  sectionType: SectionSemanticType;
  zone: SectionZone;
  /** `null` when the template draws no icon in front of this heading. */
  icon: SectionIconKey | null;
  heading: SectionHeadingTokens;
  list: SectionListTokens;
};

type TemplateTokens = Record<SectionZone, { heading: SectionHeadingTokens; list: SectionListTokens; icons: boolean }>;

/**
 * Pehlione White Blue: the values of the measured PDF, which is what the pagination geometry was
 * fitted to. The preview takes exactly the same numbers.
 */
// Pehlione's numbers live in its typed defaults; the lower-case hex strings keep the generated CSS identical.
const pehlioneBlue = pehlioneWhiteBlueDefaults.colors.primary.toLowerCase();
const pehlioneNavy = pehlioneWhiteDefaults.colors.primary.toLowerCase();
const pehlioneMain = pehlioneWhiteBlueDesign.tokens;
const pehlioneSidebar = pehlioneWhiteBlueDefaults.sidebar;
const pehlioneWhiteBlue: TemplateTokens = {
  main: {
    icons: true,
    heading: {
      iconBox: 9, iconGap: 3, iconRadius: 1.2, glyphSize: 5.5, glyphStroke: 1.9,
      fontSizePt: { standard: pehlioneMain.typography.sectionHeadingSizePt, compact: 11.2 },
      fontWeight: pehlioneMain.typography.sectionHeadingWeight, lineHeight: 1.1,
      letterSpacing: "0", textTransform: pehlioneMain.typography.sectionHeadingUppercase ? "uppercase" : "none",
      marginBottom: { standard: pehlioneMain.spacing.sectionTitleGapMm, compact: 2 }, labelPadding: { standard: 1.2, compact: 0.8 },
      color: `var(--pehlione-section-color,var(--pehlione-primary,${pehlioneBlue}))`,
      dividerColor: `var(--pehlione-divider-color,var(--pehlione-primary,${pehlioneBlue}))`,
      iconColor: "#fff", iconBackground: `var(--pehlione-primary,${pehlioneBlue})`,
      sectionGap: { standard: pehlioneMain.spacing.sectionGapMm, compact: 3.1 },
    },
    list: {
      fontSizePt: { standard: 8.8, compact: 7.8 }, lineHeight: { standard: 1.3, compact: 1.2 },
      itemGap: { standard: 0.5, compact: 0.15 }, indent: 4,
    },
  },
  sidebar: {
    icons: true,
    heading: {
      iconBox: 9, iconGap: 3, iconRadius: 1.2, glyphSize: 5.5, glyphStroke: 1.9,
      fontSizePt: { standard: pehlioneSidebar.sectionHeadingSizePt, compact: pehlioneSidebar.sectionHeadingSizePt },
      fontWeight: pehlioneMain.typography.sectionHeadingWeight, lineHeight: 1.1,
      letterSpacing: "0", textTransform: pehlioneMain.typography.sectionHeadingUppercase ? "uppercase" : "none",
      marginBottom: { standard: pehlioneSidebar.sectionTitleGapMm, compact: pehlioneSidebar.sectionTitleGapMm },
      labelPadding: { standard: 1.2, compact: 1.2 },
      color: "var(--pehlione-sidebar-text,#fff)",
      dividerColor: "var(--pehlione-divider-color,#b8d2f4)",
      iconColor: "#fff", iconBackground: `var(--pehlione-primary,${pehlioneBlue})`,
      sectionGap: { standard: pehlioneSidebar.sectionGapMm, compact: pehlioneSidebar.sectionGapMm },
    },
    list: {
      fontSizePt: { standard: 7.8, compact: 7.8 }, lineHeight: { standard: 1.2, compact: 1.2 }, itemLineHeight: 1.25,
      itemGap: { standard: 1.35, compact: 1.35 }, indent: pehlioneSidebar.listIndentMm,
    },
  },
};

/**
 * Pehlione White: the main column draws the same boxed headings as White Blue, the white sidebar a bare
 * icon (no box) in the accent colour under a smaller icon column. Lists and spacing are shared.
 */
const pehlioneWhite: TemplateTokens = {
  main: {
    ...pehlioneWhiteBlue.main,
    heading: {
      ...pehlioneWhiteBlue.main.heading,
      color: `var(--pehlione-section-color,var(--pehlione-primary,${pehlioneNavy}))`,
      dividerColor: `var(--pehlione-divider-color,var(--pehlione-primary,${pehlioneNavy}))`,
      iconBackground: `var(--pehlione-primary,${pehlioneNavy})`,
    },
  },
  sidebar: {
    ...pehlioneWhiteBlue.sidebar,
    list: { ...pehlioneWhiteBlue.sidebar.list, indent: pehlioneWhiteDefaults.sidebar.listIndentMm },
    heading: {
      ...pehlioneWhiteBlue.sidebar.heading,
      iconBox: 8, iconGap: 2, iconRadius: 0, glyphSize: 7, glyphStroke: 1.9,
      color: `var(--pehlione-primary,${pehlioneNavy})`,
      dividerColor: `var(--pehlione-divider-color,var(--pehlione-primary,${pehlioneNavy}))`,
      iconColor: `var(--pehlione-primary,${pehlioneNavy})`, iconBackground: "transparent",
    },
  },
};

/**
 * Zweispaltig: one heading and one list for both columns (measured in the PDF, 14 pt titles over a 0.65 mm
 * rule, body-size lists with a 4.5 mm indent). It draws no icons, so no icon is added. The gap between the
 * sections is the template's own top margin, which the design settings and the density keep steering.
 */
const zweispaltigHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 14, compact: 14 }, fontWeight: 750, lineHeight: 1,
  letterSpacing: ".015em", textTransform: "uppercase",
  marginBottom: { standard: 2.5, compact: 2.5 }, labelPadding: { standard: 1, compact: 1 },
  color: "var(--zweispaltig-heading)", dividerColor: "var(--zweispaltig-heading)", dividerWidth: ".65mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 6.5, compact: 6.5, side: "top", expr: "var(--zweispaltig-section-gap)" },
  height: 6.53,
};
const zweispaltigList: SectionListTokens = {
  fontSizePt: { standard: 8.4, compact: 8.4 }, lineHeight: { standard: 1.05, compact: 1.05 },
  itemGap: { standard: 0.5, compact: 0.5 }, indent: 4.5, inheritBody: true, layout: "margins", marginTop: 1.5,
  markerColor: "var(--zweispaltig-primary)",
};
const zweispaltig: TemplateTokens = {
  main: { icons: false, heading: zweispaltigHeading, list: zweispaltigList },
  sidebar: { icons: false, heading: zweispaltigHeading, list: zweispaltigList },
};

const zeitgenoessischHeading: SectionHeadingTokens = {
  iconBox: 6.5, iconGap: 2, iconRadius: 1.5, glyphSize: 4, glyphStroke: 1.8,
  fontSizePt: { standard: 12.5, compact: 12.5 }, fontWeight: 750, lineHeight: 1,
  letterSpacing: ".025em", textTransform: "uppercase",
  marginBottom: { standard: 3, compact: 3 }, labelPadding: { standard: 0, compact: 0 },
  color: "var(--zeit-primary-dark,var(--zeit-dark))",
  dividerColor: "transparent", dividerWidth: "0",
  iconColor: "var(--zeit-primary-dark,var(--zeit-dark))",
  iconBackground: "var(--zeit-primary-soft,var(--zeit-soft))",
  sectionGap: { standard: 7, compact: 7, side: "top", expr: "var(--zeit-section-gap,var(--section-gap,7mm))" },
  height: 6.5,
};
const zeitgenoessischList: SectionListTokens = {
  fontSizePt: { standard: 10.5, compact: 10.5 }, lineHeight: { standard: 1.26, compact: 1.26 },
  itemGap: { standard: 0.5, compact: 0.5 }, indent: 4.5, inheritBody: true,
  layout: "margins", marginTop: 1.5, markerColor: "var(--zeit-primary-dark,var(--zeit-dark))",
};
const zeitgenoessisch: TemplateTokens = {
  main: { icons: true, heading: zeitgenoessischHeading, list: zeitgenoessischList },
  sidebar: { icons: true, heading: zeitgenoessischHeading, list: zeitgenoessischList },
};

/**
 * Kreativ: one heading and one list for both columns (measured in the PDF: 14 pt titles over a 0.65 mm rule
 * in the dark green of the template, body-size lists with a 4.5 mm indent). It draws no icons. The gap after a
 * section is the template's own bottom margin, which the design settings keep steering.
 */
const kreativHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 14, compact: 14 }, fontWeight: 750, lineHeight: 1,
  letterSpacing: ".025em", textTransform: "uppercase",
  marginBottom: { standard: 3.5, compact: 3.5 }, labelPadding: { standard: 1.2, compact: 1.2 },
  // The preview names the colour `--kreativ-heading`, the PDF `--kreativ-dark`.
  color: "var(--kreativ-heading,var(--kreativ-dark))", dividerColor: "var(--kreativ-heading,var(--kreativ-dark))", dividerWidth: ".65mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 4.5, compact: 4.5, side: "bottom", expr: "var(--kreativ-section-gap)" },
  height: 6.73,
};
const kreativList: SectionListTokens = {
  fontSizePt: { standard: 10.5, compact: 10.5 }, lineHeight: { standard: 1.26, compact: 1.26 },
  itemGap: { standard: 0.5, compact: 0.5 }, indent: 4.5, inheritBody: true, layout: "margins",
  markerColor: "var(--kreativ-primary,var(--accent))",
};
const kreativ: TemplateTokens = {
  main: { icons: false, heading: kreativHeading, list: kreativList },
  sidebar: { icons: false, heading: kreativHeading, list: kreativList },
};

/** Ivy League is a single-column design: both logical zones use its centered, iconless heading. */
const ivyLeagueHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 13.5, compact: 13.5 }, fontWeight: 700, lineHeight: 1.05,
  letterSpacing: "0", textTransform: "none", textAlign: "center",
  fontFamily: 'var(--ivy-heading-font,Georgia,"Times New Roman",serif)',
  marginBottom: { standard: 2.5, compact: 2.5 }, labelPadding: { standard: 1.5, compact: 1.5 },
  color: "var(--ivy-heading,var(--ivy-primary,var(--accent)))",
  dividerColor: "var(--ivy-divider,var(--accent))", dividerWidth: ".3mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 4.5, compact: 4.5, side: "bottom", expr: "var(--ivy-section-gap,var(--section-gap,4.5mm))" },
  height: 8.9,
};
const ivyLeagueList: SectionListTokens = {
  fontSizePt: { standard: 9, compact: 9 }, lineHeight: { standard: 1.25, compact: 1.25 },
  itemGap: { standard: 0.35, compact: 0.35 }, indent: 4.5, inheritBody: true,
  layout: "margins", marginTop: 1.3, markerColor: "var(--ivy-heading,var(--ivy-primary,var(--accent)))",
};
const ivyLeague: TemplateTokens = {
  main: { icons: false, heading: ivyLeagueHeading, list: ivyLeagueList },
  sidebar: { icons: false, heading: ivyLeagueHeading, list: ivyLeagueList },
};

/** Kompakt keeps its small ruled heading in either column; it has no heading icons. */
const kompaktHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 11, compact: 11 }, fontWeight: 500, lineHeight: 1.2,
  letterSpacing: "0", textTransform: "uppercase",
  marginBottom: { standard: 3, compact: 3 }, labelPadding: { standard: 1, compact: 1 },
  color: "var(--kompakt-muted,var(--managed-muted,#6d757a))",
  dividerColor: "var(--kompakt-divider,var(--managed-divider,#aeb6ba))", dividerWidth: ".3mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 3.5, compact: 3.5, side: "bottom", expr: "var(--kompakt-section-gap,var(--managed-section-gap,3.5mm))" },
  height: 5.5,
};
const kompaktList: SectionListTokens = {
  fontSizePt: { standard: 10.3, compact: 10.3 }, lineHeight: { standard: 1.2, compact: 1.2 },
  itemGap: { standard: 3.2, compact: 3.2 }, indent: 0, inheritBody: true, layout: "grid",
  markerColor: "var(--kompakt-accent,var(--managed-accent,#ff6200))", itemPrefix: "★",
};
const kompakt: TemplateTokens = {
  main: { icons: false, heading: kompaktHeading, list: kompaktList },
  sidebar: { icons: false, heading: kompaktHeading, list: kompaktList },
};

/** Einspaltig has one physical column and a large blue ruled heading without an icon. */
const einspaltigHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 13.5, compact: 13.5 }, fontWeight: 750, lineHeight: 1,
  letterSpacing: "0", textTransform: "uppercase",
  marginBottom: { standard: 2, compact: 2 }, labelPadding: { standard: 1, compact: 1 }, labelPaddingTop: 1,
  color: "var(--einfach-primary,var(--managed-primary,#0b3485))",
  dividerColor: "var(--einfach-primary,var(--managed-primary,#0b3485))", dividerWidth: ".3mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 6, compact: 6, side: "bottom", expr: "var(--einfach-section-gap,var(--managed-section-gap,6mm))" },
  height: 7,
};
const einspaltigList: SectionListTokens = {
  fontSizePt: { standard: 9.2, compact: 9.2 }, lineHeight: { standard: 1.12, compact: 1.12 },
  itemGap: { standard: 0.3, compact: 0.3 }, indent: 4.5, inheritBody: true,
  layout: "margins", markerColor: "var(--einfach-primary,var(--managed-primary,#0b3485))",
};
const einspaltig: TemplateTokens = {
  main: { icons: false, heading: einspaltigHeading, list: einspaltigList },
  sidebar: { icons: false, heading: einspaltigHeading, list: einspaltigList },
};

/** Klassisch keeps its small grey, iconless title and one physical column. */
const klassischHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 10.4, compact: 10.4 }, fontWeight: 750, lineHeight: 1,
  letterSpacing: "0.01em", textTransform: "uppercase",
  marginBottom: { standard: 2.2, compact: 2.2 }, labelPadding: { standard: 0, compact: 0 },
  color: "var(--klassisch-heading,#5a6267)", dividerColor: "transparent", dividerWidth: "0",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 3.8, compact: 3.8, side: "bottom", expr: "var(--klassisch-section-gap,var(--managed-section-gap,3.8mm))" },
  height: 4.5,
};
const klassischList: SectionListTokens = {
  fontSizePt: { standard: 8.5, compact: 8.5 }, lineHeight: { standard: 1.25, compact: 1.25 },
  itemGap: { standard: 0.15, compact: 0.15 }, indent: 4.3, inheritBody: true,
  layout: "margins", marginTop: 0.8, markerColor: "var(--klassisch-muted,#68747a)",
};
const klassisch: TemplateTokens = {
  main: { icons: false, heading: klassischHeading, list: klassischList },
  sidebar: { icons: false, heading: klassischHeading, list: klassischList },
};

/** Gepflegt has a dark title in the main column and a white title in its teal sidebar. */
const gepflegt: TemplateTokens = {
  main: {
    icons: false,
    heading: {
      iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
      fontSizePt: { standard: 14, compact: 14 }, fontWeight: 600, lineHeight: 1,
      letterSpacing: ".04em", textTransform: "uppercase", fontFamily: "var(--heading-font,var(--gepflegt-font,Arial,sans-serif))",
      marginBottom: { standard: 3.6, compact: 3.6 }, labelPadding: { standard: 2.2, compact: 2.2 },
      color: "var(--gepflegt-heading,#354147)", dividerColor: "var(--gepflegt-divider,#c7ced1)", dividerWidth: ".35mm",
      iconColor: "currentColor", iconBackground: "transparent",
      // The native main column is a flex stack with its own gap.
      sectionGap: { standard: 0, compact: 0 }, height: 7.3,
    },
    list: {
      fontSizePt: { standard: 8.8, compact: 8.8 }, lineHeight: { standard: 1.28, compact: 1.28 },
      itemGap: { standard: 0.45, compact: 0.45 }, indent: 4.8, inheritBody: true, layout: "grid",
      markerColor: "var(--gepflegt-muted,#657075)",
    },
  },
  sidebar: {
    icons: false,
    heading: {
      iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
      fontSizePt: { standard: 13, compact: 13 }, fontWeight: 600, lineHeight: 1.05,
      letterSpacing: ".06em", textTransform: "uppercase", fontFamily: "var(--gepflegt-font,var(--body-font,Arial,sans-serif))",
      marginBottom: { standard: 3.5, compact: 3.5 }, labelPadding: { standard: 2.2, compact: 2.2 },
      color: "var(--gepflegt-sidebar-text,#fff)", dividerColor: "color-mix(in srgb,var(--gepflegt-sidebar-text,#fff) 55%,transparent)", dividerWidth: ".35mm",
      iconColor: "currentColor", iconBackground: "transparent",
      // The central Abschnittsabstand (with the page density), on every page and in both outputs.
      sectionGap: { standard: 6.5, compact: 6.5, side: "bottom", expr: "var(--gepflegt-section-gap,6.5mm)" }, height: 7.5,
    },
    list: {
      // The sidebar lists (Zertifikate) follow the central body size and line height like every other sidebar text.
      fontSizePt: { standard: 11, compact: 11 }, lineHeight: { standard: 1.3, compact: 1.3 },
      itemGap: { standard: 1.3, compact: 1.3 }, indent: 4, layout: "grid", inheritBody: true,
      fontExpr: "var(--gepflegt-body-size,11pt)", lineHeightExpr: "var(--gepflegt-line-height,1.3)",
      markerColor: "var(--gepflegt-sidebar-muted,#d8f0ef)",
    },
  },
};

/**
 * Stilvoll: one light heading and one list for both columns (measured in the PDF: 9.5 pt regular capitals in the
 * muted grey over a 0.3 mm rule, body-size lists with a 4 mm indent like its career bullets). It draws no icons.
 * The preview and the PDF name the colours and the gap between the sections differently.
 */
const stilvollHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: stilvollDesign.tokens.typography.sectionHeadingSizePt, compact: stilvollDesign.tokens.typography.sectionHeadingSizePt }, fontWeight: 400, lineHeight: stilvollDesign.tokens.typography.lineHeight,
  letterSpacing: "normal", textTransform: "uppercase",
  marginBottom: { standard: 3, compact: 3 }, labelPadding: { standard: 1, compact: 1 },
  color: "var(--stilvoll-muted,var(--managed-muted))", dividerColor: "var(--stilvoll-divider,var(--managed-divider))", dividerWidth: ".3mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 6, compact: 5.1, side: "bottom", expr: "var(--managed-section-gap,var(--stilvoll-section-gap))" },
  height: 6.2,
};
const stilvollList: SectionListTokens = {
  fontSizePt: { standard: stilvollDesign.tokens.typography.bodySizePt, compact: stilvollDesign.tokens.typography.bodySizePt }, lineHeight: { standard: stilvollDesign.tokens.typography.lineHeight, compact: stilvollDesign.tokens.typography.lineHeight },
  itemGap: { standard: 0.3, compact: 0.3 }, indent: 4, inheritBody: true, layout: "margins", marginTop: 0.6,
};
const stilvoll: TemplateTokens = {
  main: { icons: false, heading: stilvollHeading, list: stilvollList },
  sidebar: { icons: false, heading: stilvollHeading, list: stilvollList },
};

/**
 * Modern: one small heading and one list for both columns (measured in the PDF: 9.2 pt capitals in the muted grey
 * over a 0.35 mm rule; certificates are plain lines 4 mm apart). It draws no icons. The two column stacks space
 * their sections with a gap of their own, so a section adds no margin; the preview's sections are flex stacks
 * with an extra gap under the heading that the PDF does not have.
 */
const modernHeading: SectionHeadingTokens = {
  iconBox: 0, iconGap: 0, iconRadius: 0, glyphSize: 0, glyphStroke: 0,
  fontSizePt: { standard: 9.2, compact: 9.2 }, fontWeight: 500, lineHeight: 1,
  letterSpacing: ".5px", textTransform: "uppercase",
  marginBottom: { standard: 3.2, compact: 3.2 }, labelPadding: { standard: 1, compact: 1 },
  color: "var(--modern-muted)", dividerColor: "var(--modern-divider)", dividerWidth: ".35mm",
  iconColor: "currentColor", iconBackground: "transparent",
  sectionGap: { standard: 0, compact: 0 },
  height: 4.44,
};
const modernList: SectionListTokens = {
  fontSizePt: { standard: 9.2, compact: 9.2 }, lineHeight: { standard: 1.25, compact: 1.25 },
  itemGap: { standard: 4, compact: 4 }, indent: 0, inheritBody: true, layout: "grid", listStyle: "none",
  fontExpr: "var(--body-size,var(--doc-body-size,9.2pt))", lineHeightExpr: "1.25",
};
const modern: TemplateTokens = {
  main: { icons: false, heading: modernHeading, list: modernList },
  sidebar: { icons: false, heading: modernHeading, list: modernList },
};

/** How a template is reached on both surfaces, and which parts of the shared machinery it takes. */
type TemplateConfig = {
  tokens: TemplateTokens;
  /** Root of the preview page and of the PDF page (`pdfBody` carries the density attribute in the PDF). */
  roots: { preview: string; pdf: string; pdfBody: string; host?: string };
  /** Plain sections rebuilt as one canonical list; the others keep their own markup and follow their column. */
  plainLists: readonly SectionSemanticType[];
  /** Page one of the sidebar starts with a hero image and a contact block (Pehlione); otherwise at the header line. */
  sidebarHero: boolean;
  /**
   * Text in the sidebar takes the colour of the sidebar (default). A template whose sidebar elements carry
   * colours of their own (Stilvoll's language names) turns this off.
   */
  sidebarInheritsText?: boolean;
  /** Extra rules of a template that the tokens cannot express; `host` is the selector that scopes both surfaces. */
  zoneCss?: (host: string) => string;
};

const pehlioneRoots = (templateId: string) => ({
  preview: `.pehlione-resume[data-template="${templateId}"]`,
  pdf: `.cv-sheet[data-template="${templateId}"]`,
  pdfBody: ".pehlione-pdf",
  host: `:is(.pehlione-resume,.cv-sheet)[data-template="${templateId}"]`,
});

const configByTemplate: Record<string, TemplateConfig> = {
  pehlione_white_blue: { tokens: pehlioneWhiteBlue, roots: pehlioneRoots("pehlione_white_blue"), plainLists: ["certifications", "languages"], sidebarHero: true },
  pehlione_white: {
    tokens: pehlioneWhite, roots: pehlioneRoots("pehlione_white"), plainLists: ["certifications", "languages"], sidebarHero: true,
    zoneCss: (host) => `${host} [data-cv-zone="sidebar"] .managed-strength-card{column-gap:${pehlioneWhiteDefaults.sidebar.strengthIconGapMm}mm}
${host} [data-cv-zone="sidebar"] .resume-special-output__entry h4{margin-inline-start:${pehlioneWhiteDefaults.sidebar.contactTextOffsetMm}mm}
${host} [data-cv-zone="sidebar"] .resume-special-output__entry ul{margin-inline-start:${pehlioneWhiteDefaults.sidebar.contactTextOffsetMm - pehlioneWhiteDefaults.sidebar.specialListIndentMm}mm}`,
  },
  modern: {
    tokens: modern,
    roots: { preview: ".modern-resume-page", pdf: '.cv-sheet[data-template="modern"]', pdfBody: ".modern-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
    sidebarInheritsText: false,
    zoneCss: (host) => `${host} [data-cv-zone]{display:block;gap:0}`,
  },
  stilvoll: {
    tokens: stilvoll,
    roots: { preview: ".stilvoll-template", pdf: '.cv-sheet[data-template="stilvoll"]', pdfBody: ".stilvoll-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
    sidebarInheritsText: false,
  },
  kreativ: {
    tokens: kreativ,
    roots: { preview: ".kreativ-template", pdf: '.cv-sheet[data-template="kreativ"]', pdfBody: ".kreativ-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  zweispaltig: {
    tokens: zweispaltig,
    roots: { preview: ".zweispaltig-template", pdf: '.cv-sheet[data-template="zweispaltig"]', pdfBody: ".zweispaltig-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  zeitgenoessisch: {
    tokens: zeitgenoessisch,
    roots: { preview: ".zeitgenoessisch-template", pdf: '.cv-sheet[data-template="zeitgenoessisch"]', pdfBody: ".zeit-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  "ivy-league": {
    tokens: ivyLeague,
    roots: { preview: ".ivy-league-template", pdf: '.cv-sheet[data-template="ivy-league"]', pdfBody: ".ivy-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  kompakt: {
    tokens: kompakt,
    roots: { preview: ".kompakt-template", pdf: '.cv-sheet[data-template="kompakt"]', pdfBody: ".kompakt-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  einspaltig: {
    tokens: einspaltig,
    roots: { preview: ".einfach-template", pdf: '.cv-sheet[data-template="einspaltig"]', pdfBody: ".einfach-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  klassisch: {
    tokens: klassisch,
    roots: { preview: ".klassisch-template", pdf: '.cv-sheet[data-template="klassisch"]', pdfBody: ".klassisch-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
  gepflegt: {
    tokens: gepflegt,
    roots: { preview: ".gepflegt-page", pdf: '.cv-sheet[data-template="gepflegt"]', pdfBody: ".gepflegt-pdf" },
    plainLists: ["certifications"],
    sidebarHero: false,
  },
};
const tokensByTemplate: Record<string, TemplateTokens> = Object.fromEntries(
  Object.entries(configByTemplate).map(([id, config]) => [id, config.tokens]),
);

/** Whether `type` is a plain list of this template that the shared output rebuilds as one canonical list. */
export const isPlainListSection = (templateId: string | undefined, type: SectionSemanticType): boolean =>
  Boolean(templateId && configByTemplate[templateId]?.plainLists.includes(type));

export const plainListItemPrefix = (templateId: string | undefined): string =>
  templateId ? configByTemplate[templateId]?.tokens.main.list.itemPrefix ?? "" : "";

/** Whether page one of this template's sidebar starts with a hero image and a contact block. */
export const hasSidebarHero = (templateId: string | undefined): boolean =>
  Boolean(templateId && configByTemplate[templateId]?.sidebarHero);

const PT_TO_MM = 0.3528;

/** Millimetres the page planner needs to size a plain list section (heading, entries) drawn in `zone`. */
export const sectionListMetrics = (templateId: string, zone: SectionZone) => {
  const tokens = tokensByTemplate[templateId]?.[zone];
  if (!tokens) return undefined;
  const { heading, list } = tokens;
  const fontMm = list.fontSizePt.standard * PT_TO_MM;
  return {
    headingMm: (heading.height ?? heading.iconBox) + heading.marginBottom.standard,
    fontMm,
    lineMm: fontMm * (list.itemLineHeight ?? list.lineHeight.standard),
    gapMm: list.itemGap.standard,
    indentMm: list.indent,
    /** The list takes the body size of the page: the planner scales it with the design font size. */
    inheritBody: Boolean(list.inheritBody),
  };
};

/**
 * How `sectionId` looks in `zone` of `templateId`. `groupSemanticType` is the type of the
 * knowledge group behind a `group:*` section.
 */
export const resolveSectionPresentation = (
  templateId: string,
  sectionId: string,
  zone: SectionZone,
  groupSemanticType?: string,
): SectionPresentation | undefined => {
  const tokens = tokensByTemplate[templateId]?.[zone];
  if (!tokens) return undefined;
  const sectionType = sectionSemanticType(sectionId, groupSemanticType);
  return {
    templateId,
    sectionType,
    zone,
    icon: tokens.icons ? iconOfType[sectionType] : null,
    heading: tokens.heading,
    list: tokens.list,
  };
};

// ---------------------------------------------------------------------------
// CSS: generated from the tokens, shared by the preview and the PDF
// ---------------------------------------------------------------------------

const mm = (value: number) => `${value}mm`;
/** The closing line keeps its own distance to the last section (the section's margin would double it). */
const closingSelector = ":is(.pehlione-closing,.pehlione-pdf-closing,[data-resume-closing])";

const templateCss = (templateId: string, { tokens, roots, sidebarInheritsText = true, zoneCss }: TemplateConfig) => {
  const host = roots.host ?? `:is(${roots.preview},${roots.pdf})`;
  const compact = (suffix: string) =>
    `${roots.preview}[data-density="compact"] ${suffix},${roots.pdf} ${roots.pdfBody}[data-density="compact"] ${suffix}`;
  const hidden = (suffix: string) =>
    `${roots.preview}[data-section-divider="hidden"] ${suffix},${roots.pdf} ${roots.pdfBody}[data-section-divider="hidden"] ${suffix}`;
  const { main, sidebar } = tokens;
  const zoneRules = (zone: SectionZone, { heading, list }: TemplateTokens[SectionZone]) => {
    const scope = `[data-cv-zone="${zone}"]`;
    const listSelector = `${scope} [data-cv-list]`;
    const gridList = (list.layout ?? (zone === "sidebar" ? "grid" : "margins")) === "grid";
    const listFont = list.inheritBody
      ? `font-size:${list.fontExpr ?? "inherit"};line-height:${list.lineHeightExpr ?? "inherit"}`
      : `font-size:${list.fontSizePt.standard}pt;line-height:${list.lineHeight.standard}`;
    const gapSide = heading.sectionGap.side ?? "bottom";
    // The icon box of the main column is the base; a column that draws its icon differently overrides it.
    const iconGeometry = (["iconBox", "iconGap", "iconRadius", "glyphSize", "glyphStroke"] as const).some(
      (key) => heading[key] !== main.heading[key],
    );
    return [
      iconGeometry
        ? [
          `${host} ${scope}>.cv-heading{grid-template-columns:${mm(heading.iconBox)} minmax(0,1fr);gap:${mm(heading.iconGap)}}`,
          `${host} ${scope}>.cv-heading:not(:has(.cv-heading__icon)){grid-template-columns:minmax(0,1fr)}`,
          `${host} ${scope}>.cv-heading .cv-heading__icon{width:${mm(heading.iconBox)};height:${mm(heading.iconBox)};border-radius:${mm(heading.iconRadius)}}`,
          `${host} ${scope}>.cv-heading .cv-heading__icon svg{width:${mm(heading.glyphSize)};height:${mm(heading.glyphSize)};stroke-width:${heading.glyphStroke}}`,
        ].join("\n")
        : "",
      gapSide === "top"
        ? `${host} ${scope}{margin:${heading.sectionGap.expr ?? mm(heading.sectionGap.standard)} 0 0}`
        : `${host} ${scope}{margin:0 0 ${heading.sectionGap.expr ?? mm(heading.sectionGap.standard)}}`,
      !heading.sectionGap.expr && heading.sectionGap.compact !== heading.sectionGap.standard
        ? `${compact(scope)}{margin-${gapSide === "top" ? "top" : "bottom"}:${mm(heading.sectionGap.compact)}}` : "",
      `${host} ${scope}>.cv-heading{margin:0 0 ${mm(heading.marginBottom.standard)};color:${heading.color};font-size:${heading.fontSizePt.standard}pt;${heading.fontFamily ? `font-family:${heading.fontFamily};` : ""}--cv-divider:${heading.dividerColor};--cv-icon-color:${heading.iconColor};--cv-icon-bg:${heading.iconBackground}}`,
      `${host} ${scope}>.cv-heading .cv-heading__label{padding-bottom:${mm(heading.labelPadding.standard)};${heading.labelPaddingTop ? `padding-top:${mm(heading.labelPaddingTop)}` : ""}}`,
      heading.marginBottom.compact !== heading.marginBottom.standard || heading.fontSizePt.compact !== heading.fontSizePt.standard
        ? `${compact(`${scope}>.cv-heading`)}{margin-bottom:${mm(heading.marginBottom.compact)};font-size:${heading.fontSizePt.compact}pt}` : "",
      heading.labelPadding.compact !== heading.labelPadding.standard
        ? `${compact(`${scope}>.cv-heading .cv-heading__label`)}{padding-bottom:${mm(heading.labelPadding.compact)}}` : "",
      `${host} ${listSelector}{${gridList ? `display:grid;gap:${mm(list.itemGap.standard)};` : ""}margin:${list.marginTop ? `${mm(list.marginTop)} 0 0` : "0"};padding:0 0 0 ${mm(list.indent)};color:inherit;${listFont};list-style:${list.listStyle ?? "disc"}}`,
      list.markerColor ? `${host} ${listSelector} li::marker{color:${list.markerColor}}` : "",
      `${host} ${listSelector} li{${gridList ? "margin:0;" : `margin:${mm(list.itemGap.standard)} 0;`}color:inherit;font-size:inherit;line-height:${list.itemLineHeight ?? "inherit"};hyphens:auto;break-inside:auto;page-break-inside:auto;orphans:2;widows:2}`,
      !list.inheritBody && (list.fontSizePt.compact !== list.fontSizePt.standard || list.lineHeight.compact !== list.lineHeight.standard)
        ? `${compact(listSelector)}{font-size:${list.fontSizePt.compact}pt;line-height:${list.lineHeight.compact}}` : "",
      !gridList && list.itemGap.compact !== list.itemGap.standard
        ? `${compact(`${listSelector} li`)}{margin:${mm(list.itemGap.compact)} 0}` : "",
    ].filter(Boolean).join("\n");
  };
  const { heading } = main;
  return `
${host} .cv-heading{display:grid;grid-template-columns:${mm(heading.iconBox)} minmax(0,1fr);gap:${mm(heading.iconGap)};align-items:center;box-sizing:border-box;padding:0;border:0;font-style:normal;font-weight:${heading.fontWeight};line-height:${heading.lineHeight};letter-spacing:${heading.letterSpacing};text-transform:${heading.textTransform};${heading.textAlign ? `text-align:${heading.textAlign};` : ""}${heading.fontFamily ? `font-family:${heading.fontFamily};` : ""}break-after:avoid;page-break-after:avoid}
${host} .cv-heading:not(:has(.cv-heading__icon)){grid-template-columns:minmax(0,1fr)}
${host} .cv-heading__icon{display:grid;box-sizing:border-box;width:${mm(heading.iconBox)};height:${mm(heading.iconBox)};place-items:center;border-radius:${mm(heading.iconRadius)};color:var(--cv-icon-color,${heading.iconColor});background:var(--cv-icon-bg,${heading.iconBackground});font-style:normal}
${host} .cv-heading__icon svg{display:block;width:${mm(heading.glyphSize)};height:${mm(heading.glyphSize)};fill:none;stroke:currentColor;stroke-width:${heading.glyphStroke};stroke-linecap:round;stroke-linejoin:round}
${host} .cv-heading__label{display:block;min-width:0;border-bottom:${heading.dividerWidth ?? "var(--pehlione-divider-width,.3mm)"} solid var(--cv-divider,${heading.dividerColor});color:inherit;font-weight:inherit}
${hidden(".cv-heading__label")}{border-bottom:0}
${zoneRules("main", main)}
${zoneRules("sidebar", sidebar)}
${templateId === "kompakt" ? `${host} [data-cv-section="certifications"]>[data-cv-list]{list-style:none}
${host} [data-cv-section="certifications"]>[data-cv-list] li{display:grid;grid-template-columns:5mm minmax(0,1fr);gap:1.5mm;align-items:start}
${host} [data-cv-section="certifications"]>[data-cv-list] li i{color:var(--kompakt-accent,var(--managed-accent,#ff6200));font-size:11pt;font-style:normal;line-height:1}` : ""}
${host} [data-cv-zone="main"]:has(+ ${closingSelector}){margin-bottom:0}
${compact(`[data-cv-zone="main"]:has(+ ${closingSelector})`)}{margin-bottom:0}
${sidebarInheritsText ? `${host} [data-cv-zone="sidebar"] :is(h4,h5,strong,p,li,small){color:inherit}\n` : ""}${host} [data-cv-zone="sidebar"] p{text-align:left}
${zoneCss ? zoneCss(host) : ""}
`;
};

export const resumeSectionPresentationCss = Object.entries(configByTemplate)
  .map(([templateId, config]) => templateCss(templateId, config))
  .join("");

// ---------------------------------------------------------------------------
// DOM: the same code builds the headings of the preview and of the PDF
// ---------------------------------------------------------------------------

export type ManagedSectionNodes = {
  id: string;
  nodes: readonly Element[];
  groupSemanticType?: string;
};

/** Rebuild the heading of a section as the template's heading system draws it in `zone`. */
export const buildSectionHeading = (
  document: Document,
  presentation: SectionPresentation,
  title: string,
  previous?: Element,
): Element => {
  const heading = document.createElement(previous?.tagName.toLowerCase() ?? "h3");
  for (const attribute of Array.from(previous?.attributes ?? []))
    if (attribute.name !== "class" && attribute.name !== "style") heading.setAttribute(attribute.name, attribute.value);
  heading.setAttribute("class", "cv-heading");
  heading.setAttribute("data-cv-heading", presentation.sectionType);
  if (presentation.icon) {
    const box = document.createElement("i");
    box.setAttribute("class", "cv-heading__icon");
    box.setAttribute("aria-hidden", "true");
    box.setAttribute("data-cv-icon", presentation.icon);
    // A bare icon (no box behind it) is drawn like the title and follows a colour the user gives the title.
    box.setAttribute("data-cv-icon-style", presentation.heading.iconBackground === "transparent" ? "bare" : "boxed");
    box.innerHTML = sectionIconSvg(presentation.icon);
    heading.appendChild(box);
  }
  const label = document.createElement("b");
  label.setAttribute("class", "cv-heading__label");
  if (previous?.hasAttribute("data-custom-role")) label.setAttribute("data-custom-role", "heading-label");
  label.textContent = title;
  heading.appendChild(label);
  return heading;
};

/**
 * Draw the headings of every managed section in the column it really stands in. A section that the
 * layout moved into (or out of) the sidebar, or that the pagination pushed to a page without a
 * sidebar, gets the heading of the column it is in now.
 */
export const applyResumeSectionPresentation = (
  root: Element,
  templateId: string,
  { main, sidebar, sections }: { main: Element; sidebar: Element; sections: readonly ManagedSectionNodes[] },
): void => {
  if (!isZoneFlowTemplate(templateId)) return;
  const document = root.ownerDocument;
  for (const { id, nodes, groupSemanticType } of sections) {
    for (const node of nodes) {
      const zone: SectionZone = sidebar !== main && sidebar.contains(node) ? "sidebar" : "main";
      const presentation = resolveSectionPresentation(templateId, id, zone, groupSemanticType);
      if (!presentation) continue;
      node.setAttribute("data-cv-zone", zone);
      node.setAttribute("data-cv-section", presentation.sectionType);
      const previous = Array.from(node.querySelectorAll("h2,h3")).find(
        (candidate) => candidate.closest("section") === node && !(candidate.closest("article") && node.contains(candidate.closest("article"))),
      );
      if (!previous) continue;
      const title = (previous.textContent ?? "").trim();
      const heading = buildSectionHeading(document, presentation, title, previous);
      const nativeWrapper = templateId === "zeitgenoessisch" && previous.parentElement?.matches(".zeitgenoessisch-section-heading,.zeit-pdf-heading")
        ? previous.parentElement : null;
      (nativeWrapper ?? previous).replaceWith(heading);
    }
  }
};
