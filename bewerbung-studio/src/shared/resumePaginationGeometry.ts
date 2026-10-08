import { zweispaltigDefaults } from "./cvTemplateDefaults/zweispaltig.defaults";
import { kreativDefaults } from "./cvTemplateDefaults/kreativ.defaults";
import { stilvollDefaults, stilvollDesign } from "./cvTemplateDefaults/stilvoll.defaults";
import { gepflegtGeometry } from "./gepflegtDesign";
import { klassischDefaults } from "./cvTemplateDefaults/klassisch.defaults";
import { resolveKlassischGeometry } from "./klassischDesign";

const PT_MM = 25.4 / 72;
const klassischGeometry = resolveKlassischGeometry();
const klassischLine = (pt: number, lineHeight: number = klassischDefaults.typography.lineHeight) => pt * PT_MM * lineHeight;
const klassischBodyMm = klassischDefaults.typography.bodySizePt * PT_MM;
const klassischBodyLine = klassischLine(klassischDefaults.typography.bodySizePt);
const klassischTitleLine = klassischLine(klassischDefaults.typography.entryHeadingSizePt, klassischDefaults.typography.headingLineHeight);
const klassischSectionHead = klassischLine(klassischDefaults.typography.sectionHeadingSizePt, klassischDefaults.typography.headingLineHeight) + klassischDefaults.layout.sectionTitleGapMm;
/** The list takes its indent and the item padding off the column. */
const klassischListInset = klassischDefaults.layout.listIndentMm + 0.5;
const klassischBulletWidth = klassischGeometry.contentWidth - klassischListInset;
const klassischTitleWidth = klassischGeometry.contentWidth - klassischDefaults.layout.metaWidthMm - klassischDefaults.layout.metaGapMm;
/** Title + organisation (with the gap between them): the left half of an entry head, taller than date and place. */
const klassischEntryHead = klassischTitleLine + klassischDefaults.layout.organizationGapMm + klassischBodyLine;
/** Below a header: its padding, the hairline (one CSS pixel) and the gap to the first section. */
const klassischHeaderClose = klassischDefaults.layout.headerPaddingBottomMm + 25.4 / 96 + klassischDefaults.layout.headerGapMm;
const klassischHeaderTop = klassischGeometry.top + klassischLine(klassischDefaults.typography.nameSizePt, klassischDefaults.typography.nameLineHeight)
  + klassischDefaults.layout.titleGapMm + klassischLine(klassischDefaults.typography.titleSizePt) + klassischHeaderClose;
import { einspaltigDefaults } from "./cvTemplateDefaults/einfach.defaults";
import { einspaltigSectionTitleMm, resolveEinspaltigGeometry } from "./einspaltigDesign";

const einspaltigGeometry = resolveEinspaltigGeometry();
const einspaltigLine = (pt: number, lineHeight: number = einspaltigDefaults.typography.lineHeight) => pt * PT_MM * lineHeight;
const einspaltigBodyMm = einspaltigDefaults.typography.bodySizePt * PT_MM;
const einspaltigBodyLine = einspaltigLine(einspaltigDefaults.typography.bodySizePt);
const einspaltigTitleLine = einspaltigLine(einspaltigDefaults.typography.entryHeadingSizePt, einspaltigDefaults.typography.headingLineHeight);
const einspaltigSectionHead = einspaltigSectionTitleMm(einspaltigDefaults.typography.sectionHeadingSizePt) + einspaltigDefaults.layout.sectionTitleGapMm;
const einspaltigListInset = einspaltigDefaults.layout.listIndentMm + 0.5;
const einspaltigBulletWidth = einspaltigGeometry.contentWidth - einspaltigListInset;
/** Title row, the gap, organisation row: an entry without bullets. */
const einspaltigEntryHead = einspaltigTitleLine + einspaltigDefaults.layout.organizationGapMm + einspaltigBodyLine;
const einspaltigHeaderClose = einspaltigDefaults.layout.headerPaddingBottomMm + 25.4 / 96 + einspaltigDefaults.layout.headerGapMm;
const einspaltigHeaderTop = einspaltigGeometry.top + einspaltigLine(einspaltigDefaults.typography.nameSizePt, einspaltigDefaults.typography.nameLineHeight)
  + einspaltigDefaults.layout.titleGapMm + einspaltigLine(einspaltigDefaults.typography.titleSizePt) + einspaltigHeaderClose;

export type PaginationZone = "main" | "sidebar";

const zweispaltigContentWidth = zweispaltigDefaults.page.widthMm
  - zweispaltigDefaults.layout.marginLeftMm - zweispaltigDefaults.layout.marginRightMm;
const zweispaltigMainWidth = (zweispaltigContentWidth - zweispaltigDefaults.layout.columnGapMm)
  * zweispaltigDefaults.layout.leftColumnRatio;
const zweispaltigSideWidth = zweispaltigContentWidth - zweispaltigDefaults.layout.columnGapMm - zweispaltigMainWidth;
const zweispaltigBodyMm = zweispaltigDefaults.typography.bodySizePt * 0.3528;
const zweispaltigLineMm = zweispaltigBodyMm * zweispaltigDefaults.typography.lineHeight;

/** Per-item model of a list block: `head` + rows of `pad + pitch × lines` separated by `gap`. */
export type ItemBlockModel = {
  /** Text width (mm) of one item, its font size (mm), line pitch (mm) and vertical padding (mm). */
  w: number;
  font: number;
  pitch: number;
  pad: number;
  /** Average glyph advance in em, including word-wrap slack. */
  cw: number;
  cols: number;
  head: number;
  gap: number;
  /** Line pitch (mm) of the description under an item, when it is not 0.92 × `pitch`. */
  descPitch?: number;
  /** Font of the description relative to the title (default 0.92: set a little smaller). */
  descRatio?: number;
  /** CSS weight of the item title where the template wraps measured text (`text.wrap`). */
  titleWeight?: number;
};

/** Certificates are a plain list whose page and column depend on the template. */
export type CertificateModel = {
  /** Page that draws them natively: page one (sidebar), the last page, or never. */
  home: "first" | "last" | "none";
  zone: PaginationZone;
  /** Height = base + perItem × entries + pitch × extra wrapped lines. */
  base: number;
  perItem: number;
  /** Text width (mm), font size (mm) and line pitch (mm) used to count wrapped lines. */
  w: number;
  font: number;
  pitch: number;
  /** The template shows at most this many entries. */
  limit?: number;
};

/**
 * Measured A4 geometry of every resume template (millimetres, standard density).
 *
 * The values were measured on the rendered PDF markup (real fonts, real CSS) with
 * probe profiles and fitted with a small linear model per template. The page
 * planner uses them to estimate how tall a block will be *before* rendering, so
 * preview and PDF paginate identically and never depend on a hand-tuned "weight".
 * Re-measure a template when its CSS changes: the fit tolerance is roughly 1 mm.
 */
export type PaginationGeometry = {
  /** Two-column template (dedicated sidebar column on page one). */
  columns: 1 | 2;
  sidebarLeft: boolean;
  /** Native column of the blocks that can move between columns. */
  zones: Record<"summary" | "strengths" | "knowledge" | "languages", PaginationZone>;
  /**
   * First flow block of the main column: page one / continuation page / ATS page one / ATS continuation page.
   * The ATS offsets were measured with every contact filled (see `ats.header` for stacked contacts).
   */
  top1: number;
  top2: number;
  atsTop1: number;
  atsTop2: number;
  /** Lowest usable y (mm) of the flow above the page footer. */
  limit: number;
  sideTop1: number | null;
  sideLimit: number;
  /** Horizontal extent (mm) of the main column on pages with a sidebar. */
  mainLeft: number;
  mainRight: number;
  /** Text edges (mm) of the main column: where a footer aligned with the main content starts and ends. */
  contentLeft: number;
  contentRight: number;
  text: {
    /** Average glyph advance in em, including word-wrap slack. */
    cw: number;
    lineRatio: number;
    bulletW: number;
    bulletFont: number;
    titleW: number;
    titleFont: number;
    orgW: number;
    orgFont: number;
    sumFont: number;
    mainW: number;
    sideW: number;
    atsW: number;
    /** Bullet width on continuation pages, where no sidebar narrows the main column. */
    contW: number;
    /** Width of a section that spans the whole page (last page, single column, ATS). */
    fullW: number;
    /** Glyph advance of the bullets beside the sidebar when it differs from `cw` (the narrow column wraps earlier than the page-wide one). */
    bulletCw?: number;
    /** Additional word-wrap allowance as the first-page main column narrows. */
    bulletNarrowSlack?: number;
    /**
     * Wrap the real text with the measured advances of the template's font (src/shared/textMetrics.ts) instead of
     * counting characters: CSS weights of the bullets, entry titles and organisations, what the bullet list takes off the
     * column (indent + item padding), the gap beside the date / place, and their font as a share of the body size
     * (`max(minPt, body × ratio)`). Used while the template's own font is chosen.
     */
    wrap?: {
      fontId: string; bodyWeight: number; titleWeight: number; orgWeight: number; listInset: number; metaGap: number; metaRatio: number; metaMinPt: number; metaMaxWidth: number;
      /** A date/place column of fixed width beside title and organisation (Klassisch's grid), instead of one as wide as the date. */
      metaColumn?: number;
      /** The summary paragraph is wrapped with the measured font too. */
      paragraphs?: boolean;
      /** The title of a continued entry part carries the shared "· Fortsetzung" marker (resumeEntrySplitCss): it may wrap. */
      marker?: boolean;
      /**
       * The plain (ATS) layout is wrapped with the same advances, its columns taken as this share of their width (Arial
       * sets about 2 % wider than the measured Segoe UI advances: 0.98 left no line under-estimated on 854 measured bullets).
       */
      atsWidth?: number;
    };
  };
  /** Padding and divider an entry draws below itself except the last one (not part of the entry gap the user sets), mm. */
  entryChrome?: number;
  /**
   * The same padding and divider below a project / interest entry (it inherits the template's entry rule) where the career
   * model holds them elsewhere: Kreativ in `exp.base`, Pehlione in `exp.gap`. Defaults to `entryChrome`.
   */
  customEntryChrome?: number;
  /** Share of the measured page height the planner fills (default 0.97): the reserve for the estimate's error. A template whose entries are measured closely may use more. */
  safety?: number;
  /** `gap` is the space between two entries of a section (margin or padding that belongs to no single entry). */
  exp: { base: number; list: number; perBullet: number; linePitch: number; extraLine: number; gap: number; head: number };
  /**
   * `base` is the entry with a one-line title, institution and meta; `extraLine` one more wrapped line of those. A template whose
   * detail list (Fachrichtung, Abschlussnote, description) has its own metrics gives them separately: `detailLine` per text
   * line, `detailItem` per detail, `detailList` once for the list (its top margin), `detailCw` the glyph advance of the details beside
   * the sidebar (the narrow column wraps earlier than `text.cw` says). Without them the details cost `extraLine` a line.
   */
  edu: { base: number; extraLine: number; gap: number; head: number; detailBase?: number; detailLine?: number; detailItem?: number; detailList?: number; detailCw?: number };
  /**
   * The entries of a special section that stands in the sidebar: the space between two entries (the template styles
   * them like its own entries: a margin, a divider's padding) and the margins before the first and behind the last.
   * Without it a section is sized from `exp.gap` and the list gap of the template.
   */
  specialSide?: { between: number; edge: number };
  blocks: {
    summary: [number, number];
    strengths: [number, number];
    knowledge: [number, number];
    languages: [number, number];
    sectionGap: number;
    sideGap: number;
  };
  /** Strengths and knowledge are modelled per item: a wrapped title costs one more line. */
  items: { strengths: ItemBlockModel; knowledge: ItemBlockModel };
  certs: CertificateModel;
  /**
   * A résumé without strengths of its own shows its skills as strengths, where the template draws them:
   * on page one, only when the whole résumé fits on one page (the plain layouts draw them last), or not at all.
   */
  derivedStrengths: { visual: "first" | "never"; ats: "first" | "single" | "never" };
  /**
   * ATS mode (plain text, one column): measured entry height relative to the visual model
   * (1 = same), plus what the plain layout does differently from the visual one.
   */
  ats: {
    exp: number;
    edu: number;
    /** Space between two sections and the height of a career section heading, where they differ from the visual layout. */
    sectionGap?: number;
    head?: number;
    /**
     * The knowledge list is one comma-separated paragraph per category and subcategory:
     * offset of the first title below the section top, title height, space between two
     * lists, text metrics of a paragraph and the space behind the last one.
     */
    knowledge: { head: number; title: number; gap: number; pitch: number; font: number; w: number; tail: number };
    /** Templates that stack their contacts one per line: header height = base + perContact × contact lines. */
    header?: { base: number; perContact: number };
    /** Plain lists: height = base (heading and spacing) + per entry. Languages and certificates are lines of text here. */
    languages: [number, number];
    certs: { base: number; perItem: number };
    /** Width of the summary paragraph when it differs from `text.atsW` (Pehlione's plain layout spans the page). */
    summaryW?: number;
    /** Height factor of the compact / dense CSS modes in the plain layout (see `density`). */
    density: { compact: number; dense: number };
  };
  /**
   * Height factor of the compact / dense CSS modes relative to standard: the mean shrinkage measured
   * on random two-page résumés plus one percent, so a page planned as compact does not overflow.
   * Density changes gaps and some font sizes only, which is why most templates gain just a few percent.
   */
  density: { compact: number; dense: number };
};

const geometry: Record<string, PaginationGeometry> = {
  "pehlione_white_blue": {
    columns: 2,
    // The career entry rule: 4 mm padding and a 0.25 mm divider below every entry but the last.
    customEntryChrome: 4.25,
    sidebarLeft: true,
    zones: {summary: "main", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 44.6,
    top2: 28.2,
    limit: 287,
    sideTop1: 120.2,
    sideLimit: 285,
    atsTop1: 57.9,
    atsTop2: 45.1,
    mainLeft: 63,
    mainRight: 210,
    contentLeft: 73,
    contentRight: 200,
    text: {contW: 141.0, cw: 0.54, bulletW: 90, bulletFont: 3.246, titleW: 94, titleFont: 3.17, orgW: 94, orgFont: 3.25, sumFont: 3.246, mainW: 127, sideW: 49, atsW: 123, lineRatio: 1.2, fullW: 178},
    exp: {base: 7.8, list: 3.0, perBullet: 0.4, linePitch: 3.9, extraLine: 2.4, gap: 8.2, head: 12},
    edu: {base: 10.5, extraLine: 5.5, gap: 8.2, head: 12},
    blocks: {summary: [12, 3.89], strengths: [9.6, 7.98], knowledge: [14.9, 6.31], languages: [9.7, 5.41], sectionGap: 6, sideGap: 4.5},
    items: {strengths: {w: 43.5, font: 3.104, pitch: 4.04, pad: 0.99, cw: 0.53, cols: 1, head: 11, gap: 3}, knowledge: {w: 43.5, font: 3.104, pitch: 4.04, pad: -0.01, cw: 0.45, cols: 1, head: 16.7, gap: 2}},
    certs: {home: "last", zone: "main", base: 11.5, perItem: 4.38, w: 123.0, font: 3.25, pitch: 3.9},
    derivedStrengths: {visual: "first", ats: "never"},
    ats: {exp: 1.0, edu: 1.0, head: 17.5, knowledge: {head: 12, title: 5.53, gap: 3, pitch: 3.9, font: 3.25, w: 178, tail: 0}, languages: [17, 4.4], certs: {base: 17, perItem: 4.4}, summaryW: 178, density: {compact: 0.93, dense: 0.93}},
    density: {compact: 0.89, dense: 0.89},
  },
  "pehlione_white": {
    columns: 2,
    // The career entry rule: 4 mm padding and a 0.25 mm divider below every entry but the last.
    customEntryChrome: 4.25,
    sidebarLeft: true,
    zones: {summary: "main", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 44.6,
    top2: 28.2,
    limit: 287,
    sideTop1: 120.2,
    sideLimit: 285,
    atsTop1: 57.9,
    atsTop2: 45.1,
    mainLeft: 63,
    mainRight: 210,
    contentLeft: 73,
    contentRight: 200,
    text: {contW: 141.0, cw: 0.54, bulletW: 90, bulletFont: 3.246, titleW: 94, titleFont: 3.67, orgW: 94, orgFont: 3.25, sumFont: 3.246, mainW: 127, sideW: 49, atsW: 126, lineRatio: 1.2, fullW: 178},
    exp: {base: 8.4, list: 3.0, perBullet: 0.4, linePitch: 3.9, extraLine: 2.4, gap: 8.2, head: 12},
    edu: {base: 11.1, extraLine: 4.69, gap: 8.2, head: 12},
    blocks: {summary: [12, 3.89], strengths: [6.8, 8.58], knowledge: [14.6, 6.31], languages: [4.4, 5.41], sectionGap: 6, sideGap: 4.5},
    items: {strengths: {w: 43.3, font: 3.104, pitch: 4.04, pad: 0.99, cw: 0.53, cols: 1, head: 10, gap: 3}, knowledge: {w: 43.3, font: 3.104, pitch: 4.04, pad: -0.01, cw: 0.48, cols: 1, head: 16.4, gap: 2}},
    certs: {home: "last", zone: "main", base: 11.5, perItem: 4.38, w: 123.0, font: 3.25, pitch: 3.9},
    derivedStrengths: {visual: "first", ats: "never"},
    ats: {exp: 1.0, edu: 1.0, head: 17.5, knowledge: {head: 12, title: 5.53, gap: 3, pitch: 3.9, font: 3.25, w: 178, tail: 0}, languages: [17, 4.4], certs: {base: 17, perItem: 4.4}, summaryW: 178, density: {compact: 0.93, dense: 0.93}},
    density: {compact: 0.89, dense: 0.89},
  },
  "modern": {
    columns: 2,
    safety: 0.93,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 44.9,
    top2: 31.8,
    limit: 285.3,
    sideTop1: 44.9,
    sideLimit: 284,
    atsTop1: 54.8,
    atsTop2: 39.1,
    mainLeft: 15,
    mainRight: 117,
    contentLeft: 15,
    contentRight: 117,
    text: {contW: 175.5, cw: 0.515, bulletW: 97.5, bulletFont: 2.963, titleW: 102, titleFont: 3.88, orgW: 97.5, orgFont: 2.79, sumFont: 2.963, mainW: 102, sideW: 67, atsW: 175.5, lineRatio: 1.2, fullW: 180},
    exp: {base: 9.8, list: 0.6, perBullet: 0.28, linePitch: 3.56, extraLine: 5.5, gap: 4.5, head: 7.6},
    edu: {base: 11.4, extraLine: 3.56, detailLine: 3.56, gap: 4.5, head: 7.6},
    blocks: {summary: [7.6, 3.89], strengths: [4.6, 7.85], knowledge: [13.9, 6], languages: [5.1, 6.26], sectionGap: 7, sideGap: 7},
    items: {strengths: {w: 61.5, font: 2.963, pitch: 3.85, pad: 1, cw: 0.53, cols: 1, head: 7.6, gap: 3}, knowledge: {w: 61.5, font: 2.963, pitch: 3.76, pad: 0.24, cw: 0.45, cols: 1, head: 15.9, gap: 2}},
    certs: {home: "first", zone: "sidebar", base: 3.7, perItem: 8.05, w: 67.0, font: 3.25, pitch: 4.06},
    derivedStrengths: {visual: "never", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, sectionGap: 5, head: 6.9, knowledge: {head: 6.9, title: 7.01, gap: 3.24, pitch: 3.9, font: 3.25, w: 180, tail: 0}, languages: [6.55, 4.25], certs: {base: 6.6, perItem: 4.23}, density: {compact: 1, dense: 1}},
    density: {compact: 0.99, dense: 0.96},
  },
  "elegant": {
    columns: 2,
    sidebarLeft: false,
    zones: {summary: "sidebar", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 57,
    top2: 41,
    limit: 286,
    safety: 1,
    sideTop1: 55,
    sideLimit: 282,
    atsTop1: 95,
    atsTop2: 70,
    mainLeft: 0,
    mainRight: 140,
    contentLeft: 10,
    contentRight: 132,
    text: {contW: 175, cw: 0.465, bulletW: 117.5, bulletFont: 3.705, titleW: 92, titleFont: 3.88, orgW: 92, orgFont: 3.705, sumFont: 3.705, mainW: 122, sideW: 52, atsW: 160, lineRatio: 1.2, fullW: 175},
    exp: {base: 12, list: 1.8, perBullet: 0.6, linePitch: 4.45, extraLine: 4.45, gap: 2, head: 12},
    edu: {base: 12, detailBase: 2.4, extraLine: 4.3, gap: 2, head: 12},
    blocks: {summary: [10, 5], strengths: [-2.3, 13.44], knowledge: [13.4, 10.48], languages: [5.5, 7.94], sectionGap: 4.5, sideGap: 4.5},
    items: {strengths: {w: 44.5, font: 3.705, pitch: 5, pad: 1, cw: 0.56, cols: 1, head: 9, gap: 3}, knowledge: {w: 44.5, font: 3.705, pitch: 5, pad: 0.45, cw: 0.49, cols: 1, head: 27.5, gap: 0}},
    certs: {home: "first", zone: "sidebar", base: 9, perItem: 5, w: 44.5, font: 3.705, pitch: 5},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.12, edu: 1.44, knowledge: {head: 9.56, title: 8.49, gap: 3, pitch: 3.11, font: 2.96, w: 184, tail: 0}, header: {base: 40.44, perContact: 9.48}, languages: [5.1, 5.1], certs: {base: 9.4, perItem: 3.1}, density: {compact: 1, dense: 1}},
    density: {compact: 1, dense: 1},
  },
  "zweispaltig": {
    columns: 2,
    entryChrome: 3.25,
    safety: 1,
    sidebarLeft: false,
    zones: {summary: "sidebar", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: zweispaltigDefaults.layout.marginTopMm + 38.9,
    top2: zweispaltigDefaults.layout.marginTopMm + 24.1,
    limit: zweispaltigDefaults.page.heightMm - zweispaltigDefaults.layout.marginBottomMm,
    sideTop1: zweispaltigDefaults.layout.marginTopMm + 38.9,
    sideLimit: zweispaltigDefaults.page.heightMm - zweispaltigDefaults.layout.marginBottomMm,
    atsTop1: 87.8,
    atsTop2: 87.8,
    mainLeft: zweispaltigDefaults.layout.marginLeftMm,
    mainRight: zweispaltigDefaults.layout.marginLeftMm + zweispaltigMainWidth,
    contentLeft: zweispaltigDefaults.layout.marginLeftMm,
    contentRight: zweispaltigDefaults.page.widthMm - zweispaltigDefaults.layout.marginRightMm,
    text: {contW: zweispaltigContentWidth, cw: 0.51, bulletW: zweispaltigMainWidth - 4.8, bulletFont: zweispaltigBodyMm, titleW: zweispaltigMainWidth, titleFont: 4.06, orgW: zweispaltigMainWidth, orgFont: 3.35, sumFont: zweispaltigBodyMm, mainW: zweispaltigMainWidth, sideW: zweispaltigSideWidth, atsW: zweispaltigContentWidth, lineRatio: zweispaltigDefaults.typography.lineHeight, fullW: zweispaltigContentWidth, bulletCw: 0.544},
    // The experience header and wrapped-title overhead come from PDF measurements;
    // bullet line pitch follows the current Zweispaltig body size and line height.
    exp: {base: 13.8, list: 2.0, perBullet: 0.4, linePitch: zweispaltigLineMm, extraLine: 4.8, gap: 3.5, head: 9},
    // Education keeps its measured header/detail overhead while text line pitch
    // follows the same Zweispaltig typography as the rendered document.
    edu: {base: 13.8, extraLine: 4.8, gap: 3.5, head: 9, detailLine: zweispaltigLineMm, detailItem: 0.35, detailList: 2.0, detailCw: 0.544},
    // Measured on the PDF: 3.5 gap + 3 padding + 0.2 divider + 2 x 0.5 margin between entries; 0.5 margin at each end.
    specialSide: {between: 7.7, edge: 1},
    blocks: {summary: [9, 3.11], strengths: [6, 7.85], knowledge: [16.6, 6], languages: [6.5, 6.07], sectionGap: 6.5, sideGap: 6.5},
    items: {strengths: {w: zweispaltigSideWidth - 9, font: 3.35, pitch: zweispaltigLineMm, pad: 1, cw: 0.53, cols: 1, head: 9, gap: 3.5}, knowledge: {w: zweispaltigSideWidth - 9, font: zweispaltigBodyMm, pitch: zweispaltigLineMm, pad: 0.89, cw: 0.45, cols: 1, head: 18.6, gap: 2}},
    certs: {home: "first", zone: "sidebar", base: 8.6, perItem: 3.6, w: 61.2, font: 2.96, pitch: 3.11},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, knowledge: {head: 9.03, title: 6.07, gap: 3, pitch: 3.11, font: 2.96, w: 184, tail: 0}, header: {base: 39.83, perContact: 8}, languages: [7, 5.1], certs: {base: 8.5, perItem: 3.6}, density: {compact: 0.98, dense: 0.97}},
    density: {compact: 0.99, dense: 0.98},
  },
  "zeitgenoessisch": {
    columns: 2,
    sidebarLeft: true,
    zones: {summary: "main", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 53,
    top2: 37,
    limit: 282,
    sideTop1: 112,
    sideLimit: 282,
    atsTop1: 55.3,
    atsTop2: 55.3,
    mainLeft: 82.17,
    mainRight: 190,
    contentLeft: 82.17,
    contentRight: 190,
    text: {contW: 165, cw: 0.525, bulletW: 103, bulletFont: 3.704, titleW: 67.8, titleFont: 4.057, orgW: 67.8, orgFont: 3.704, sumFont: 3.704, mainW: 107.83, sideW: 46.86, atsW: 165, lineRatio: 1.26, fullW: 165},
    exp: {base: 10.8, list: 1.7, perBullet: 0.77, linePitch: 4.67, extraLine: 4.8, gap: 5, head: 10.5},
    edu: {base: 10.8, extraLine: 4.8, gap: 5, head: 10.5, detailLine: 4.67, detailItem: 0.35, detailList: 1.5, detailCw: 0.525},
    // Measured on the PDF: 5 gap + 2 x 0.5 margin between entries; 0.5 margin at each end.
    specialSide: {between: 6, edge: 1},
    blocks: {summary: [10.5, 4.67], strengths: [-5, 15], knowledge: [7, 11], languages: [7, 9], sectionGap: 7, sideGap: 7},
    // The sidebar items of the final PDF (managed strengths grid and knowledge rows; scripts/sidebar-calibration.mjs):
    // 8.4 pt text, a title wraps by 1.57 mm per character (never one line too few), rows of at least the 4 mm icon.
    items: {strengths: {w: 41.86, font: 3.704, pitch: 4.67, pad: 1, cw: 0.57, cols: 1, head: 10.5, gap: 3.5, descPitch: 4.67}, knowledge: {w: 41.86, font: 3.704, pitch: 4.67, pad: 0.05, cw: 0.53, cols: 1, head: 17, gap: 2}},
    certs: {home: "first", zone: "sidebar", base: 10, perItem: 4.67, w: 42, font: 3.704, pitch: 4.67},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, head: 10.5, knowledge: {head: 10.5, title: 8.49, gap: 3, pitch: 4.67, font: 3.704, w: 165, tail: 0}, languages: [9, 4.67], certs: {base: 9, perItem: 4.67}, density: {compact: 1, dense: 1}},
    density: {compact: 1, dense: 1},
  },
  "kreativ": {
    columns: 2,
    customEntryChrome: kreativDefaults.layout.entryDividerGapMm + 0.25,
    sidebarLeft: false,
    zones: {summary: "sidebar", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 53,
    top2: 35,
    limit: 274,
    sideTop1: 53,
    sideLimit: 274,
    atsTop1: 53.2,
    atsTop2: 53.2,
    mainLeft: 25,
    mainRight: 121.3,
    contentLeft: 25,
    contentRight: 121.3,
    text: {contW: 165, cw: 0.525, bulletW: 91.8, bulletFont: 3.704, titleW: 66, titleFont: 3.88, orgW: 66, orgFont: 3.704, sumFont: 3.704, mainW: 96.3, sideW: 58.7, atsW: 165, lineRatio: 1.26, fullW: 165},
    exp: {base: 11.8, list: 1.2, perBullet: 0.6, linePitch: 4.67, extraLine: 4.67, gap: 2.5, head: 10.8},
    edu: {base: 11.8, extraLine: 4.67, gap: 2.5, head: 10.8},
    blocks: {summary: [10.8, 4.67], strengths: [7.5, 9], knowledge: [18, 8], languages: [7.5, 8], sectionGap: 4.5, sideGap: 4.5},
    items: {strengths: {w: 52.5, font: 3.704, pitch: 4.67, pad: 0.5, cw: 0.55, cols: 1, head: 10.8, gap: 2.5}, knowledge: {w: 54.2, font: 3.704, pitch: 4.67, pad: 0.5, cw: 0.53, cols: 1, head: 19.8, gap: 2}},
    certs: {home: "first", zone: "sidebar", base: 10.5, perItem: 4.67, w: 54.2, font: 3.704, pitch: 4.67},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, knowledge: {head: 10.8, title: 7.2, gap: 3, pitch: 4.67, font: 3.704, w: 165, tail: 0}, languages: [10.5, 4.67], certs: {base: 10.5, perItem: 4.67}, density: {compact: 1, dense: 1}},
    density: {compact: 1, dense: 0.99},
  },
  // Re-measured 2026-10-06 on the real PDF at the 11 pt / 1.3 defaults (340 career entries, sidebar and language probes).
  "gepflegt": {
    columns: 2,
    safety: 1,
    sidebarLeft: true,
    zones: {summary: "sidebar", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    // The smallest header (no contacts, no title); estimateResumeHeaderTop raises it with the real header.
    top1: 41,
    top2: 40.5,
    limit: gepflegtGeometry.pageHeightMm - gepflegtGeometry.main.paddingBottomMm,
    sideTop1: gepflegtGeometry.sidebar.paddingTopMm + gepflegtGeometry.sidebar.photoSizeMm + gepflegtGeometry.sidebar.photoGapMm,
    sideLimit: gepflegtGeometry.pageHeightMm - gepflegtGeometry.sidebar.paddingBottomMm,
    atsTop1: 46.6,
    atsTop2: 46.6,
    mainLeft: gepflegtGeometry.sidebarWidthMm + gepflegtGeometry.main.paddingLeftMm,
    mainRight: gepflegtGeometry.pageWidthMm - gepflegtGeometry.main.paddingRightMm,
    contentLeft: gepflegtGeometry.sidebarWidthMm + gepflegtGeometry.main.paddingLeftMm,
    contentRight: gepflegtGeometry.pageWidthMm - gepflegtGeometry.main.paddingRightMm,
    // Wrapping (cw) fitted on the measured lines: unbiased for a page of bullets (one line wraps differently, a page of them
    // evens out), wider where the column narrows; `safety` covers the rest.
    // Main column 112 mm at the default 10 mm Seitenränder (bullets 112 − 5.4 mm list inset), sidebar text 65 mm. Career
    // entries are wrapped with the measured font advances (`wrap`); the character model is the fallback for other fonts.
    text: {contW: 106.6, cw: 0.5, bulletCw: 0.47, bulletNarrowSlack: 0.6, bulletW: 106.6, bulletFont: 3.881, titleW: 72, titleFont: 4.234, orgW: 95, orgFont: 3.881, sumFont: 3.881, mainW: 112, sideW: 57, atsW: 172.6, lineRatio: 1.3, fullW: 112,
      wrap: {fontId: "source-sans", bodyWeight: 400, titleWeight: 500, orgWeight: 500, listInset: 5.4, metaGap: 5, metaRatio: 0.88, metaMinPt: 9, metaMaxWidth: 46}},
    exp: {base: 12.07, list: 1.96, perBullet: 0.434, linePitch: 5.05, extraLine: 5.42, gap: 4, head: 12.42},
    edu: {base: 12.07, extraLine: 5.42, gap: 4, head: 12.42, detailLine: 5.05, detailItem: 0.434, detailList: 1.96, detailCw: 0.55},
    blocks: {summary: [11.86, 5.04], strengths: [11.86, 14.5], knowledge: [11.86, 5.04], languages: [9.86, 7.04], sectionGap: 6.5, sideGap: 6.5},
    items: {strengths: {w: 59.5, font: 3.88, pitch: 5.04, pad: 1, cw: 0.68, cols: 1, head: 11.86, gap: 3, descPitch: 4.64, titleWeight: 700}, knowledge: {w: 59.5, font: 3.88, pitch: 5.04, pad: 0, cw: 0.58, cols: 1, head: 24.37, gap: 2}},
    certs: {home: "first", zone: "sidebar", base: 11.86, perItem: 6.34, w: 61, font: 3.881, pitch: 5.04},

    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, knowledge: {head: 8.44, title: 6.96, gap: 3, pitch: 3.6, font: 3, w: 84, tail: 3}, languages: [8.9, 3.6], certs: {base: 8.4, perItem: 3.6}, density: {compact: 0.94, dense: 0.88}},
    // Compact/dense only shrink the gaps (× .85 / × .7), not the entries: a page saves about 2 % / 4 % of its height.
    density: {compact: 0.985, dense: 0.965},
  },
  "kompakt": {
    columns: 2,
    sidebarLeft: false,
    safety: 1,
    zones: {summary: "main", strengths: "sidebar", knowledge: "sidebar", languages: "main"},
    top1: 34,
    top2: 29.5,
    limit: 279,
    sideTop1: 34,
    sideLimit: 279,
    atsTop1: 54.1,
    atsTop2: 39.7,
    mainLeft: 25,
    mainRight: 122,
    contentLeft: 25,
    contentRight: 122,
    text: {contW: 165, cw: 0.515, bulletW: 92.2, bulletFont: 3.634, titleW: 75, titleFont: 3.986, orgW: 92.2, orgFont: 3.634, sumFont: 3.634, mainW: 97, sideW: 60, atsW: 165, lineRatio: 1.2, fullW: 165},
    exp: {base: 11, list: 0.4, perBullet: 0.31, linePitch: 4.36, extraLine: 4.36, gap: 3.2, head: 8.5},
    edu: {base: 11, extraLine: 4.36, gap: 3.2, head: 8.5},
    blocks: {summary: [8.5, 4.36], strengths: [8.5, 8.5], knowledge: [12, 7], languages: [8.5, 4.36], sectionGap: 3.5, sideGap: 3.5},
    items: {strengths: {w: 55.5, font: 3.634, pitch: 4.36, pad: 1, cw: 0.53, cols: 1, head: 8.5, gap: 3.2}, knowledge: {w: 55.5, font: 3.634, pitch: 4.36, pad: 1.04, cw: 0.45, cols: 1, head: 12, gap: 3.2}},
    certs: {home: "first", zone: "sidebar", base: 12, perItem: 4.5, w: 55.5, font: 3.634, pitch: 4.36, limit: 2},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, knowledge: {head: 7.2, title: 5.92, gap: 3, pitch: 2.96, font: 2.96, w: 184, tail: 0}, languages: [7, 3.2], certs: {base: 6.96, perItem: 3.2}, density: {compact: 0.99, dense: 0.99}},
    density: {compact: 1, dense: 1},
  },
  "stilvoll": {
    columns: 2,
    sidebarLeft: true,
    zones: {summary: "sidebar", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: stilvollDefaults.layout.contentTopMm,
    top2: 30,
    limit: 274,
    sideTop1: stilvollDefaults.layout.contentTopMm,
    sideLimit: 266,
    atsTop1: 62.5,
    atsTop2: 41.7,
    mainLeft: 85,
    mainRight: 190,
    contentLeft: 85,
    contentRight: 190,
    text: {contW: 160, cw: 0.5, bulletW: 100.6, bulletFont: stilvollDesign.tokens.typography.bodySizePt * 25.4 / 72, titleW: 76, titleFont: 4.06, orgW: 96, orgFont: 3.70, sumFont: stilvollDesign.tokens.typography.bodySizePt * 25.4 / 72, mainW: 105, sideW: 50, atsW: 165, lineRatio: stilvollDesign.tokens.typography.lineHeight, fullW: 165},
    exp: {base: 12, list: 0.6, perBullet: 0.5, linePitch: 4.63, extraLine: 4.63, gap: 4, head: 9.5},
    edu: {base: 12.5, extraLine: 4.63, gap: 4, head: 9.5},
    blocks: {summary: [9.5, 4.63], strengths: [4.5, 10.5], knowledge: [10, 7], languages: [5.5, 6], sectionGap: 6, sideGap: 6},
    items: {strengths: {w: 40, font: 3.70, pitch: 4.63, pad: 1, cw: 0.53, cols: 1, head: 9.5, gap: 4}, knowledge: {w: 45, font: 3.70, pitch: 4.63, pad: 0.89, cw: 0.45, cols: 1, head: 12.2, gap: 2}},
    certs: {home: "none", zone: "sidebar", base: 0, perItem: 0, w: 45, font: 3.70, pitch: 4.63},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, knowledge: {head: 7.54, title: 6.08, gap: 3, pitch: 3.11, font: 2.96, w: 180, tail: 0}, languages: [7.3, 3.4], certs: {base: 7.3, perItem: 3.4}, density: {compact: 0.99, dense: 0.96}},
    density: {compact: 1, dense: 0.98},
  },
  // Einspaltig (DIN-oriented, one column): every line box and gap follows from einspaltigDefaults and the stylesheet both
  // surfaces share (11 pt x 1.25 = 4.851 mm per line; ruled 14 pt section titles). Career entries, the summary, knowledge
  // rows and the header are wrapped with the measured font advances (`wrap`, estimateEinspaltigHeaderTop); the character
  // model (`cw`) only serves other fonts.
  "einspaltig": {
    columns: 1,
    safety: 1,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "main", knowledge: "main", languages: "main"},
    // A header with name and Berufsbezeichnung / the running head; estimateEinspaltigHeaderTop computes the real ones.
    top1: einspaltigHeaderTop,
    top2: einspaltigGeometry.top + einspaltigLine(einspaltigDefaults.typography.metaSizePt) + einspaltigLine(einspaltigDefaults.typography.continuationNameSizePt, einspaltigDefaults.typography.nameLineHeight) + einspaltigHeaderClose,
    limit: einspaltigGeometry.contentBottom,
    sideTop1: null,
    sideLimit: einspaltigGeometry.contentBottom,
    atsTop1: einspaltigHeaderTop,
    atsTop2: einspaltigGeometry.top + einspaltigLine(einspaltigDefaults.typography.metaSizePt) + einspaltigLine(einspaltigDefaults.typography.continuationNameSizePt, einspaltigDefaults.typography.nameLineHeight) + einspaltigHeaderClose,
    mainLeft: 0,
    mainRight: einspaltigDefaults.page.widthMm,
    contentLeft: einspaltigGeometry.left,
    contentRight: einspaltigDefaults.page.widthMm - einspaltigGeometry.right,
    text: {contW: einspaltigBulletWidth, cw: 0.5, bulletW: einspaltigBulletWidth, bulletFont: einspaltigBodyMm, titleW: einspaltigGeometry.contentWidth - 30, titleFont: einspaltigDefaults.typography.entryHeadingSizePt * PT_MM,
      orgW: einspaltigGeometry.contentWidth - 30, orgFont: einspaltigBodyMm, sumFont: einspaltigBodyMm, mainW: einspaltigGeometry.contentWidth, sideW: 0, atsW: einspaltigGeometry.contentWidth,
      lineRatio: einspaltigDefaults.typography.lineHeight, fullW: einspaltigGeometry.contentWidth,
      // Date and place stand beside title and organisation, as wide as they are (they never wrap).
      wrap: {fontId: "source-sans", bodyWeight: 400, titleWeight: einspaltigDefaults.typography.entryHeadingWeight, orgWeight: einspaltigDefaults.typography.organizationWeight,
        listInset: einspaltigListInset, metaGap: einspaltigDefaults.layout.metaGapMm, metaRatio: einspaltigDefaults.typography.metaSizePt / einspaltigDefaults.typography.bodySizePt,
        metaMinPt: einspaltigDefaults.typography.metaSizePt, metaMaxWidth: 999, paragraphs: true, marker: true, atsWidth: 0.98}},
    // Entry: title row and organisation row (each beside its meta), then the list (top margin, gaps between bullets, lines).
    exp: {base: einspaltigEntryHead, list: einspaltigDefaults.layout.entryContentGapMm - einspaltigDefaults.layout.bulletGapMm, perBullet: einspaltigDefaults.layout.bulletGapMm,
      linePitch: einspaltigBodyLine, extraLine: einspaltigTitleLine, gap: einspaltigDefaults.layout.entryGapMm, head: einspaltigSectionHead},
    edu: {base: einspaltigEntryHead, extraLine: einspaltigTitleLine, gap: einspaltigDefaults.layout.entryGapMm, head: einspaltigSectionHead,
      detailBase: -einspaltigDefaults.layout.bulletGapMm, detailLine: einspaltigBodyLine, detailItem: einspaltigDefaults.layout.bulletGapMm, detailList: einspaltigDefaults.layout.entryContentGapMm},
    blocks: {summary: [einspaltigSectionHead, einspaltigBodyLine], strengths: [einspaltigSectionHead, einspaltigBodyLine], knowledge: [einspaltigSectionHead, einspaltigBodyLine],
      languages: [einspaltigSectionHead, einspaltigBodyLine * 2], sectionGap: einspaltigDefaults.layout.sectionGapMm, sideGap: einspaltigDefaults.layout.sectionGapMm},
    items: {
      // The managed strength cards: title line 1.3, description at 0.92 em with 1.4 (resumeManagedOutput's card CSS).
      strengths: {w: 50, font: einspaltigBodyMm, pitch: einspaltigBodyMm * 1.3, pad: 0, cw: 0.5, cols: 3, head: einspaltigSectionHead, gap: 3,
        descPitch: einspaltigBodyMm * 0.92 * 1.4, titleWeight: 700},
      // The managed item grid: heading, category title (+1.5 mm) and rows 2 mm apart.
      knowledge: {w: 76, font: einspaltigBodyMm, pitch: einspaltigBodyLine, pad: 0, cw: 0.5, cols: 2, head: einspaltigSectionHead + einspaltigBodyLine + 1.5, gap: 2},
    },
    certs: {home: "last", zone: "main", base: einspaltigSectionHead, perItem: einspaltigBodyLine + einspaltigDefaults.layout.bulletGapMm, w: einspaltigBulletWidth, font: einspaltigBodyMm, pitch: einspaltigBodyLine},
    derivedStrengths: {visual: "first", ats: "single"},
    // Plain layout: the same type scale in Arial; knowledge = category title (+1.5 mm) and a comma-separated paragraph per
    // category; languages and certificates are list lines.
    ats: {exp: 1.0, edu: 1.0, head: einspaltigSectionHead, sectionGap: einspaltigDefaults.layout.sectionGapMm,
      knowledge: {head: einspaltigSectionHead, title: einspaltigBodyLine + 1.5, gap: 3, pitch: einspaltigBodyLine, font: einspaltigBodyMm, w: einspaltigGeometry.contentWidth, tail: 0},
      languages: [einspaltigSectionHead - einspaltigDefaults.layout.bulletGapMm, einspaltigBodyLine + einspaltigDefaults.layout.bulletGapMm],
      certs: {base: einspaltigSectionHead - einspaltigDefaults.layout.bulletGapMm, perItem: einspaltigBodyLine + einspaltigDefaults.layout.bulletGapMm},
      density: {compact: 0.985, dense: 0.965}},
    // Compact/dense only shrink the gaps (x .85 / x .7), never the text.
    density: {compact: 0.985, dense: 0.965},
  },
  // Klassisch (DIN-oriented, one column): every line box and gap follows from klassischDefaults and the stylesheet that
  // both surfaces share (measured equal in the PDF: 11 pt x 1.2 = 4.656 mm per line, 14 pt titles 5.927 mm, entry head
  // 11.08 mm). Career entries, the summary, knowledge rows and the header are wrapped with the measured font advances
  // (`wrap`, estimateKlassischHeaderTop); the character model (`cw`) only serves the plain (ATS) layout and other fonts.
  "klassisch": {
    columns: 1,
    safety: 1,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "main", knowledge: "main", languages: "main"},
    // A header with name and Berufsbezeichnung / the running head; estimateKlassischHeaderTop computes the real ones
    // (page one with its contacts and photo, the running head of later pages, the plain page one).
    top1: klassischHeaderTop,
    top2: klassischGeometry.top + klassischLine(klassischDefaults.typography.metaSizePt) + klassischLine(klassischDefaults.typography.continuationNameSizePt, klassischDefaults.typography.nameLineHeight) + klassischHeaderClose,
    limit: klassischGeometry.contentBottom,
    sideTop1: null,
    sideLimit: klassischGeometry.contentBottom,
    atsTop1: klassischHeaderTop,
    atsTop2: klassischGeometry.top + klassischLine(klassischDefaults.typography.metaSizePt) + klassischLine(klassischDefaults.typography.continuationNameSizePt, klassischDefaults.typography.nameLineHeight) + klassischHeaderClose,
    mainLeft: 0,
    mainRight: klassischDefaults.page.widthMm,
    contentLeft: klassischGeometry.left,
    contentRight: klassischDefaults.page.widthMm - klassischGeometry.right,
    text: {contW: klassischBulletWidth, cw: 0.5, bulletW: klassischBulletWidth, bulletFont: klassischBodyMm, titleW: klassischTitleWidth, titleFont: klassischDefaults.typography.entryHeadingSizePt * PT_MM,
      orgW: klassischTitleWidth, orgFont: klassischBodyMm, sumFont: klassischBodyMm, mainW: klassischGeometry.contentWidth, sideW: 0, atsW: klassischGeometry.contentWidth,
      lineRatio: klassischDefaults.typography.lineHeight, fullW: klassischGeometry.contentWidth,
      wrap: {fontId: "source-sans", bodyWeight: 400, titleWeight: klassischDefaults.typography.entryHeadingWeight, orgWeight: klassischDefaults.typography.organizationWeight,
        listInset: klassischListInset, metaGap: klassischDefaults.layout.metaGapMm, metaRatio: klassischDefaults.typography.metaSizePt / klassischDefaults.typography.bodySizePt,
        metaMinPt: klassischDefaults.typography.metaSizePt, metaMaxWidth: klassischDefaults.layout.metaWidthMm, metaColumn: klassischDefaults.layout.metaWidthMm, paragraphs: true, marker: true, atsWidth: 0.98}},
    // Entry: title + organisation beside the date column, then the list (top margin, a gap between two bullets, lines).
    exp: {base: klassischEntryHead, list: klassischDefaults.layout.entryContentGapMm - klassischDefaults.layout.bulletGapMm, perBullet: klassischDefaults.layout.bulletGapMm,
      linePitch: klassischBodyLine, extraLine: klassischTitleLine, gap: klassischDefaults.layout.entryGapMm, head: klassischSectionHead},
    edu: {base: klassischEntryHead, extraLine: klassischTitleLine, gap: klassischDefaults.layout.entryGapMm, head: klassischSectionHead,
      detailBase: -klassischDefaults.layout.bulletGapMm, detailLine: klassischBodyLine, detailItem: klassischDefaults.layout.bulletGapMm, detailList: klassischDefaults.layout.entryContentGapMm},
    blocks: {summary: [klassischSectionHead, klassischBodyLine], strengths: [klassischSectionHead, klassischBodyLine], knowledge: [klassischSectionHead, klassischBodyLine],
      languages: [klassischSectionHead, klassischBodyLine * 2], sectionGap: klassischDefaults.layout.sectionGapMm, sideGap: klassischDefaults.layout.sectionGapMm},
    items: {
      // The managed strength cards (more than three strengths, skills shown as strengths, the plain layout): measured title
      // line 5.04 mm, description lines 5.0 mm at 0.92 em. Up to three explicit strengths are the template's own cards (gridModel).
      strengths: {w: 44.5, font: klassischBodyMm, pitch: 5.04, pad: 0, cw: 0.5, cols: 3, head: klassischSectionHead, gap: klassischDefaults.layout.strengthRowGapMm,
        descPitch: 5.0, titleWeight: klassischDefaults.typography.organizationWeight},
      // The managed item grid: heading, category title (+1.5 mm) and rows 2 mm apart.
      knowledge: {w: 76, font: klassischBodyMm, pitch: klassischBodyLine, pad: 0, cw: 0.5, cols: 2, head: klassischSectionHead + klassischBodyLine + 1.5, gap: 2},
    },
    certs: {home: "last", zone: "main", base: klassischSectionHead, perItem: klassischBodyLine + klassischDefaults.layout.bulletGapMm, w: klassischBulletWidth, font: klassischBodyMm, pitch: klassischBodyLine},
    derivedStrengths: {visual: "first", ats: "single"},
    // Plain layout: the same type scale in Arial; knowledge = category title (+1.5 mm) and a comma-separated paragraph per
    // category (3 mm apart); languages and certificates are list lines (the list margin hides in the title gap).
    ats: {exp: 1.0, edu: 1.0, head: klassischSectionHead, sectionGap: klassischDefaults.layout.sectionGapMm,
      knowledge: {head: klassischSectionHead, title: klassischBodyLine + 1.5, gap: 3, pitch: klassischBodyLine, font: klassischBodyMm, w: klassischGeometry.contentWidth, tail: 0},
      languages: [klassischSectionHead - klassischDefaults.layout.bulletGapMm, klassischBodyLine + klassischDefaults.layout.bulletGapMm],
      certs: {base: klassischSectionHead - klassischDefaults.layout.bulletGapMm, perItem: klassischBodyLine + klassischDefaults.layout.bulletGapMm},
      density: {compact: 0.985, dense: 0.965}},
    // Compact/dense only shrink the gaps (x .85 / x .7), never the text.
    density: {compact: 0.985, dense: 0.965},
  },
  "tabellarisch": {
    columns: 1,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "main", knowledge: "main", languages: "main"},
    top1: 59.8,
    top2: 30.0,
    limit: 285.1,
    sideTop1: null,
    sideLimit: 285.1,
    atsTop1: 63.3,
    atsTop2: 63.3,
    mainLeft: 0,
    mainRight: 210,
    contentLeft: 15,
    contentRight: 195,
    text: {contW: 127.0, cw: 0.52, bulletW: 125, bulletFont: 3.246, titleW: 130, titleFont: 4.23, orgW: 130, orgFont: 3.6, sumFont: 3.246, mainW: 180, sideW: 0, atsW: 175, lineRatio: 1.1, fullW: 180},
    exp: {base: 15.3, list: 0.6, perBullet: 0.64, linePitch: 3.49, extraLine: 2.4, gap: 0, head: 9.1},
    edu: {base: 15, extraLine: 5.5, gap: 0, head: 9.1},
    blocks: {summary: [9.1, 3.57], strengths: [5.8, 4.66], knowledge: [9.8, 3.29], languages: [9.8, 1.83], sectionGap: 6.3, sideGap: 4.5},
    items: {strengths: {w: 83, font: 3.246, pitch: 4.22, pad: 1, cw: 0.53, cols: 2, head: 9, gap: 3}, knowledge: {w: 52.5, font: 3.246, pitch: 4.15, pad: 0, cw: 0.45, cols: 3, head: 14.7, gap: 0}},
    certs: {home: "last", zone: "main", base: 9.0, perItem: 4.02, w: 79.5, font: 3.25, pitch: 3.57},
    derivedStrengths: {visual: "first", ats: "first"},
    ats: {exp: 1.0, edu: 1.33, head: 7.6, knowledge: {head: 7.57, title: 7.4, gap: 3.24, pitch: 3.57, font: 3.25, w: 84, tail: 3.25}, languages: [9.8, 1.83], certs: {base: 7.5, perItem: 4.02}, density: {compact: 0.99, dense: 0.95}},
    density: {compact: 0.99, dense: 0.92},
  },
  "ivy-league": {
    columns: 1,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "main", knowledge: "main", languages: "main"},
    top1: 38.9,
    top2: 24.5,
    limit: 285.1,
    sideTop1: null,
    sideLimit: 285.1,
    atsTop1: 58.7,
    atsTop2: 58.7,
    mainLeft: 0,
    mainRight: 210,
    contentLeft: 11,
    contentRight: 199,
    text: {contW: 183, cw: 0.47, bulletW: 183, bulletFont: 2.963, titleW: 148, titleFont: 3.42, orgW: 148, orgFont: 3.7, sumFont: 2.963, mainW: 188, sideW: 0, atsW: 161, lineRatio: 1.05, fullW: 188},
    exp: {base: 8.6, list: 1.6, perBullet: 0.42, linePitch: 3.08, extraLine: 2.4, gap: 4.5, head: 9.2},
    edu: {base: 9, extraLine: 2.4, gap: 3.2, head: 9.2},
    blocks: {summary: [9.2, 3.11], strengths: [5.9, 5.39], knowledge: [10.6, 4.03], languages: [10.7, 3.51], sectionGap: 4.5, sideGap: 4.5},
    items: {strengths: {w: 87, font: 4.233, pitch: 5.5, pad: 1, cw: 0.53, cols: 2, head: 9.2, gap: 3}, knowledge: {w: 87, font: 4.233, pitch: 5.08, pad: 0.45, cw: 0.45, cols: 2, head: 16.2, gap: 2}},
    certs: {home: "last", zone: "main", base: 8.9, perItem: 3.45, w: 188.0, font: 4.76, pitch: 5.0},
    derivedStrengths: {visual: "first", ats: "first"},
    ats: {exp: 1.0, edu: 1.0, head: 8.3, knowledge: {head: 8.27, title: 7.9, gap: 3, pitch: 3.11, font: 2.96, w: 166, tail: 0}, languages: [7.9, 3.5], certs: {base: 8, perItem: 3.47}, density: {compact: 0.95, dense: 0.94}},
    density: {compact: 0.95, dense: 0.93},
  },
};

/** Single-column fallback for unknown templates: the widest measured layout. */
export const genericPaginationGeometry: PaginationGeometry = geometry.einspaltig;

export const getPaginationGeometry = (templateId?: string): PaginationGeometry =>
  (templateId ? geometry[templateId] : undefined) ?? genericPaginationGeometry;
