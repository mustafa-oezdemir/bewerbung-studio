import { zweispaltigDefaults } from "./cvTemplateDefaults/zweispaltig.defaults";
import { stilvollDefaults, stilvollDesign } from "./cvTemplateDefaults/stilvoll.defaults";
import { gepflegtGeometry } from "./gepflegtDesign";

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
  };
  /** Padding and divider an entry draws below itself except the last one (not part of the entry gap the user sets), mm. */
  entryChrome?: number;
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
    text: {contW: 175.5, cw: 0.515, bulletW: 97.5, bulletFont: 3.246, titleW: 102, titleFont: 3.88, orgW: 35.7, orgFont: 2.79, sumFont: 3.246, mainW: 102, sideW: 67, atsW: 175.5, lineRatio: 1.2, fullW: 180},
    exp: {base: 9.8, list: 0.6, perBullet: 0.28, linePitch: 3.91, extraLine: 5.5, gap: 4.5, head: 7.6},
    edu: {base: 11.4, extraLine: 5.5, gap: 4.5, head: 7.6},
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
    contentRight: 130,
    text: {contW: 175, cw: 0.465, bulletW: 115.5, bulletFont: 3.705, titleW: 90, titleFont: 3.88, orgW: 90, orgFont: 3.705, sumFont: 3.705, mainW: 120, sideW: 48, atsW: 160, lineRatio: 1.2, fullW: 175},
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
  "gepflegt": {
    columns: 2,
    safety: 1,
    sidebarLeft: true,
    zones: {summary: "sidebar", strengths: "sidebar", knowledge: "sidebar", languages: "sidebar"},
    top1: 64,
    top2: 39,
    limit: gepflegtGeometry.pageHeightMm - gepflegtGeometry.main.paddingBottomMm,
    sideTop1: gepflegtGeometry.sidebar.paddingTopMm + gepflegtGeometry.sidebar.photoSizeMm + gepflegtGeometry.sidebar.photoGapMm,
    sideLimit: gepflegtGeometry.pageHeightMm - gepflegtGeometry.sidebar.paddingBottomMm,
    atsTop1: 46.6,
    atsTop2: 46.6,
    mainLeft: gepflegtGeometry.sidebarWidthMm + gepflegtGeometry.main.paddingLeftMm,
    mainRight: gepflegtGeometry.pageWidthMm - gepflegtGeometry.main.paddingRightMm,
    contentLeft: gepflegtGeometry.sidebarWidthMm + gepflegtGeometry.main.paddingLeftMm,
    contentRight: gepflegtGeometry.pageWidthMm - gepflegtGeometry.main.paddingRightMm,
    text: {contW: 107.2, cw: 0.49, bulletW: 107.2, bulletFont: 3.88, titleW: 82, titleFont: 4.06, orgW: 95, orgFont: 3.88, sumFont: 3.88, mainW: 112, sideW: 57, atsW: 172.6, lineRatio: 1.16, fullW: 112},
    exp: {base: 12, list: 2.2, perBullet: 0.8, linePitch: 4.5, extraLine: 4.5, gap: 4, head: 11.5},
    edu: {base: 10.5, extraLine: 4.5, gap: 4, head: 11.5, detailBase: 8, detailLine: 4.5, detailItem: 0.6, detailList: 1.8},
    blocks: {summary: [11.4, 4.5], strengths: [11.4, 13.6], knowledge: [11.4, 4.5], languages: [11.4, 7.8], sectionGap: 6.5, sideGap: 6.5},
    items: {strengths: {w: 57.5, font: 3.88, pitch: 4.5, pad: 1, cw: 0.53, cols: 1, head: 11.4, gap: 4}, knowledge: {w: 54, font: 3.88, pitch: 4.5, pad: 0.4, cw: 0.55, cols: 1, head: 11.4, gap: 2}},
    certs: {home: "first", zone: "sidebar", base: 11.4, perItem: 5.5, w: 61, font: 3.88, pitch: 4.5},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, knowledge: {head: 8.44, title: 6.96, gap: 3, pitch: 3.6, font: 3, w: 84, tail: 3}, languages: [8.9, 3.6], certs: {base: 8.4, perItem: 3.6}, density: {compact: 0.94, dense: 0.88}},
    density: {compact: 0.96, dense: 0.91},
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
  "einspaltig": {
    columns: 1,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "main", knowledge: "main", languages: "main"},
    top1: 51.5,
    top2: 31,
    limit: 285.8,
    sideTop1: null,
    sideLimit: 285.8,
    atsTop1: 56.6,
    atsTop2: 34.7,
    mainLeft: 0,
    mainRight: 210,
    contentLeft: 15,
    contentRight: 195,
    text: {contW: 175.6, cw: 0.485, bulletW: 175.6, bulletFont: 3.387, titleW: 152.3, titleFont: 4.06, orgW: 165, orgFont: 3.53, sumFont: 3.175, mainW: 180, sideW: 0, atsW: 175.6, lineRatio: 1.1, fullW: 180},
    exp: {base: 13.7, list: 0.5, perBullet: 0.53, linePitch: 3.6, extraLine: 2.4, gap: 4.5, head: 9},
    edu: {base: 13.9, extraLine: 2.4, gap: 4.5, head: 9},
    blocks: {summary: [9, 3.49], strengths: [5.7, 4.77], knowledge: [9.3, 3.21], languages: [9.9, 1.67], sectionGap: 5, sideGap: 4.5},
    items: {strengths: {w: 83, font: 3.387, pitch: 4.4, pad: 1, cw: 0.53, cols: 2, head: 9, gap: 3}, knowledge: {w: 52.5, font: 3.387, pitch: 3.73, pad: 0.27, cw: 0.45, cols: 3, head: 14.2, gap: 0}},
    certs: {home: "last", zone: "main", base: 10.4, perItem: 3.72, w: 169.4, font: 3.39, pitch: 3.73},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, head: 7.9, knowledge: {head: 7.9, title: 7.11, gap: 3.38, pitch: 3.73, font: 3.39, w: 180, tail: 0}, languages: [7.6, 4], certs: {base: 7.6, perItem: 4}, density: {compact: 1, dense: 0.99}},
    density: {compact: 1, dense: 0.99},
  },
  "klassisch": {
    columns: 1,
    sidebarLeft: false,
    zones: {summary: "main", strengths: "main", knowledge: "main", languages: "main"},
    top1: 54,
    top2: 31.8,
    limit: 285.9,
    sideTop1: null,
    sideLimit: 285.9,
    atsTop1: 60.1,
    atsTop2: 39.9,
    mainLeft: 0,
    mainRight: 210,
    contentLeft: 15,
    contentRight: 195,
    text: {contW: 175.2, cw: 0.51, bulletW: 175.2, bulletFont: 2.963, titleW: 139, titleFont: 4.3, orgW: 139, orgFont: 3.53, sumFont: 2.963, mainW: 180, sideW: 0, atsW: 175.2, lineRatio: 1.05, fullW: 180},
    exp: {base: 9, list: 1.2, perBullet: 0.18, linePitch: 3.1, extraLine: 4.4, gap: 3.2, head: 5.9},
    edu: {base: 9, extraLine: 2.4, gap: 2.8, head: 5.9},
    blocks: {summary: [5.9, 3.11], strengths: [2.7, 4.46], knowledge: [5.6, 3.21], languages: [6.5, 2.67], sectionGap: 3.8, sideGap: 4.5},
    items: {strengths: {w: 83, font: 2.963, pitch: 3.85, pad: 1, cw: 0.53, cols: 2, head: 5.9, gap: 3}, knowledge: {w: 83, font: 2.963, pitch: 3.11, pad: 0.89, cw: 0.45, cols: 2, head: 10.5, gap: 2}},
    certs: {home: "last", zone: "main", base: 5.7, perItem: 3.27, w: 175.7, font: 2.96, pitch: 3.11},
    derivedStrengths: {visual: "first", ats: "single"},
    ats: {exp: 1.0, edu: 1.0, head: 6.9, knowledge: {head: 6.9, title: 6.08, gap: 3, pitch: 3.11, font: 2.96, w: 180, tail: 0}, languages: [6.1, 4.05], certs: {base: 6.7, perItem: 3.27}, density: {compact: 0.99, dense: 0.98}},
    density: {compact: 0.99, dense: 0.98},
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
