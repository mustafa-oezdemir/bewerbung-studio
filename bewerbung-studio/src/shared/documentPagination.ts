import type { ApplicantProfile, DocumentDraft } from "./schema";
import { ensureKnowledgeSection } from "../features/knowledge/knowledge.service";
import { formatKnowledgeItem } from "../features/knowledge/knowledge.utils";
import { knowledgeLists, type KnowledgeRange } from "./resumeKnowledgeRange";
import { getCoverLetterMainBody } from "./coverLetter";
import { getPehlioneCoreCompetencies, getPehlioneProjectHighlight, hasPehlioneCustomProjectHighlight } from "./pehlioneContent";
import {
  defaultDocumentDesign,
  fontSizeToPt,
  lineHeightLevelToValue,
  marginLevelToMm,
  sectionSpacingLevelToMm,
  type DocumentDesignSettings,
} from "./documentDesign";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { resolveSectionColumns } from "./resumeSectionLayout";
import { hasSidebarHero, isZoneFlowTemplate, sectionListMetrics } from "./resumeSectionPresentation";
import { normalizeCustomSection } from "./resumeCustomSections";
import { getPehlioneContacts } from "./pehlioneContacts";
import { resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import {
  getPaginationGeometry,
  type ItemBlockModel,
  type PaginationGeometry,
  type PaginationZone,
} from "./resumePaginationGeometry";

/** Bullets `from`..`to` (exclusive, of `total`) of an experience entry that continues on the next page. */
export type ResumeBulletRange = { from: number; to: number; total: number };

export type ResumePageItem =
  | { kind: "experience"; id: string; weight: number; bullets?: ResumeBulletRange }
  | { kind: "education"; id: string; weight: number };

export type ResumePagePlan = {
  pageNumber: 1 | 2;
  /**
   * Career items rendered on this page, in reading order. `weight` is the estimated height in mm.
   * An experience entry that breaks between two pages appears on both with complementary `bullets`.
   */
  items: ResumePageItem[];
  density: "standard" | "compact" | "dense";
  /**
   * Movable flow blocks (managed section ids such as `knowledge`, `group:*`,
   * `special:*`) that this page renders. Every block appears on exactly one page.
   */
  blocks?: string[];
  /** A block that breaks between two pages is drawn on both; its items are shared out as ranges. */
  blockRanges?: Record<string, KnowledgeRange>;
  /** Whether this page keeps its sidebar column. Page one always does. */
  sidebar?: boolean;
  /** Estimated filling (0 = empty, 1 = full) of the flow columns, for diagnostics and tests. */
  fill?: { main: number; sidebar: number };
};

export type LetterPageStatus = {
  characterCount: number;
  recommendedMaximum: number;
  density: "standard" | "compact" | "dense";
  isOverRecommendedLength: boolean;
};

export type ResumePaginationOptions = {
  /** Career items are always kept in reading order; kept for older callers. */
  preserveItemOrder?: boolean;
  /** Ignored: sections break wherever page one ends (word-processor flow). Kept for older callers. */
  keepSectionsTogether?: boolean;
  /** Force the number of career items on page one (manual page break, tests). */
  firstPageItemCount?: number;
};

/** Everything the planner needs to know about the resolved document, beyond the profile. */
export type ResumePlanContext = {
  /** Effective visibility and column of each managed section. */
  sections?: ReadonlyArray<{ id: string; visible: boolean; zone: PaginationZone }>;
  atsMode?: boolean;
  layout?: { mode: "single" | "two-column"; sidebarWidthPercent: number; overridden?: boolean; nativeSidebarWidthPercent?: number };
  closing?: { visible: boolean; signature: boolean };
  /** Explicit user design overrides that change text or spacing metrics. */
  overrides?: { bodySizePt?: number; lineHeight?: number; pageMarginMm?: number; sectionGapMm?: number; entryGapMm?: number };
  /** Design settings: they decide how many columns a strengths or knowledge grid gets. */
  settings?: DocumentDesignSettings;
};

const RECOMMENDED_LETTER_CHARACTERS = 3_300;

// Every template used to have its own hand-tuned capacity. They are all derived
// from the measured template geometry now, so the constants stay only as
// (deprecated) named options for callers that still pass them.
export const zweispaltigPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const elegantPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const kompaktPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const kreativPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const tabellarischPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const modernPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const pehlionePaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const gepflegtPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const zeitgenoessischPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const ivyLeaguePaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const stilvollPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const einspaltigPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };
export const klassischPaginationOptions: ResumePaginationOptions = { preserveItemOrder: true };

// ---------------------------------------------------------------------------
// Height estimation (mm)
// ---------------------------------------------------------------------------

/** Points to millimetres, for user font-size overrides. */
const PT_TO_MM = 0.3528;
/** The page planner never trusts an estimate up to the last millimetre. */
const SAFETY = 0.97;
/** Sidebar blocks must fit with this share of the column to be hosted on page one. */
const SIDEBAR_HOST_SHARE = 0.94;
/** Zone-flow templates size the sidebar blocks from their tokens, so they may fill the whole column. */
const ZONE_FLOW_HOST_SHARE = 1;
/**
 * Wrapping of a plain list entry, fitted to 570 measured lists (no underestimate): the average glyph advance
 * (em) and the room (em) that the ragged end of a line wastes.
 */
const LIST_CW = 0.44;
const LIST_WASTE_EM = 4;
/** Lines of a list entry in a column of `columnMm` (its indent already taken off). */
const listLines = (chars: number, columnMm: number, fontMm: number) =>
  chars <= 0 ? 0 : Math.max(1, Math.ceil((chars * LIST_CW * fontMm) / Math.max(columnMm - LIST_WASTE_EM * fontMm, 12)));
/** The same for the body paragraphs of a special section (long compound words wrap a little wider). */
const SPECIAL_CW = 0.5;
/**
 * The sidebar of page one of a zone-flow template: the hero ends at 54 mm, the contact block is a heading (11 mm)
 * with 8 mm per entry (a value that wraps adds a line), and 4.5 mm separate it from the first section.
 */
const SIDEBAR_HERO_MM = 54;
const CONTACT_HEAD_MM = 11;
const CONTACT_ITEM_MM = 8;
const CONTACT_LINE_MM = 3.13;
const CONTACT_FONT_MM = 2.61;
const CONTACT_ICON_MM = 6.5;
const CONTACT_GAP_MM = 4.5;
/** The measured lists leave no reserve to shave off the column. */
const ZONE_FLOW_SIDEBAR_SAFETY = 1;
/** The project highlight: a bold title (10.4 pt) and a bold company line. */
const PROJECT_TITLE_MM = 3.669;
const PROJECT_TITLE_CW = 0.55;
const PROJECT_COMPANY_CW = 0.52;
/** Share of the page a compacted single page may use. */
const COMPACT_MARGIN = 0.96;
/**
 * The résumé flows like a Word document: page one is filled as far as the content
 * allows and the rest continues on page two. Two guards keep the result tidy:
 * the last page never shrinks to a stub (the first page then gives up trailing
 * content), and a compacted single page beats a second page that would be nearly empty.
 */
const MIN_LAST_FILL = 0.15;
const MIN_FIRST_FILL = 0.55;
const COMPACT_INSTEAD_OF_LAST_BELOW = 0.5;
/** Widow/orphan control: an entry breaks between bullets only if this many text lines stay on both sides. */
const MIN_SPLIT_LINES = 2;
const CLOSING_MM = { signature: 22, plain: 10 };
/** Long summaries wrap a little more than the average glyph advance predicts. */
const SUMMARY_WRAP_SLACK = 1.05;
/** Comma-separated lists break at every comma: they wrap a little less than running text. */
const ATS_LIST_WRAP = 0.92;
/** The managed item grids: 3 mm between columns and a 4 mm icon plus 1.5 mm gap in front of each text. */
const GRID_COLUMN_GAP_MM = 3;
const GRID_ICON_MM = 5.5;

/**
 * Contact lines a plain (ATS) header prints. Elegant and Zweispaltig stack them one per
 * line, so their header grows with the number of filled contact fields.
 */
const atsContactLines = (templateId: string | undefined, profile: ApplicantProfile | undefined) => {
  if (!profile) return 0;
  const filled = (value: string | undefined) => Boolean(value?.trim());
  const location = [profile.postalCode, profile.city, profile.country].some(filled);
  const birth = filled(profile.birthDate) || filled(profile.birthPlace);
  // Elegant prints one "website" line for the portfolio, or the GitHub profile when there is none.
  const web = templateId === "elegant"
    ? [profile.portfolio || profile.github]
    : [profile.github, profile.portfolio];
  return [profile.phone, profile.email, profile.linkedin, ...web].filter(filled).length + Number(location) + Number(birth);
};

/** The template's own space between two sections; the plain (ATS) layout may differ from the styled one. */
const nativeSectionGapOf = (geometry: PaginationGeometry, atsMode?: boolean) =>
  (atsMode ? geometry.ats.sectionGap : undefined) ?? geometry.blocks.sectionGap;

const strip = ({ kind, id, ...item }: MeasuredItem, page: "first" | "cont"): ResumePageItem => ({ kind, id, weight: Math.round(item[page] * 10) / 10 });

type Scale = {
  font: number;
  textHeight: number;
  line: number;
  width: number;
  contWidth: number;
  /** Main-column text width relative to its measured width, and how many mm the sidebar text grew. */
  mainRatio: number;
  sideDelta: number;
  marginInset: number;
  /** Measured entry height of the ATS layout relative to the visual model (1 outside ATS mode). */
  exp: number;
  edu: number;
  sectionGap?: number;
  entryGap?: number;
};

const linesFor = (chars: number, widthMm: number, fontMm: number, cw: number) =>
  chars <= 0 ? 0 : Math.max(1, Math.ceil((chars * cw * fontMm) / Math.max(widthMm, 12)));

/** Bullet-level view of an experience entry: rendered lines per bullet, and the height of any bullet range. */
type EntryMetrics = { lines: number[]; height: (from: number, to: number) => number };

type MeasuredItem = ResumePageItem & {
  first: number;
  cont: number;
  gapAfter: number;
  /** Experience entries can break between bullets: metrics for the first-page and the continuation width. */
  parts?: { first: EntryMetrics; cont: EntryMetrics };
};

const trimmedBullets = (experience: ApplicantProfile["experiences"][number]) =>
  experience.achievements.map((value) => value.trim()).filter(Boolean);

/** Pehlione shows at most this many bullets per entry; every other template shows all of them. */
const bulletCapOf = (templateId?: string) => (templateId?.startsWith("pehlione_") ? 5 : Number.POSITIVE_INFINITY);

const experienceMetrics = (
  experience: ApplicantProfile["experiences"][number],
  geometry: PaginationGeometry,
  scale: Scale,
  widthScale: number,
  bulletCap: number,
): EntryMetrics => {
  const { text, exp } = geometry;
  const bullets = trimmedBullets(experience).slice(0, bulletCap);
  const lines = bullets.map((bullet) => linesFor(bullet.length, text.bulletW * widthScale, text.bulletFont * scale.font, text.cw));
  const titleLines = linesFor(experience.role.trim().length, text.titleW * widthScale, text.titleFont * scale.font, text.cw * 1.08);
  const orgLines = linesFor(experience.company.trim().length, text.orgW * widthScale, text.orgFont * scale.font, text.cw * 1.06);
  const extra = Math.max(0, titleLines - 1) + Math.max(0, orgLines - 1);
  // Every part of an entry repeats the header (dates, role, company); only the bullets are shared out.
  const height = (from: number, to: number) => {
    const shown = lines.slice(from, to);
    return (
      (exp.base +
        (shown.length ? exp.list : 0) +
        exp.perBullet * shown.length +
        exp.linePitch * scale.line * shown.reduce((total, value) => total + value, 0) +
        exp.extraLine * extra) *
      scale.exp * scale.textHeight
    );
  };
  return { lines, height };
};

const educationHeight = (
  education: ApplicantProfile["education"][number],
  geometry: PaginationGeometry,
  scale: Scale,
  widthScale: number,
) => {
  const { text, edu } = geometry;
  const titleLines = linesFor(education.degree.trim().length, text.titleW * widthScale, text.titleFont * scale.font, text.cw * 1.08);
  const orgLines = linesFor(education.institution.trim().length, text.orgW * widthScale, text.orgFont * scale.font, text.cw * 1.06);
  return (edu.base + edu.extraLine * (Math.max(0, titleLines - 1) + Math.max(0, orgLines - 1))) * scale.edu * scale.textHeight;
};

type ListEntry = { title: string; description?: string };

/** Height of one grid row: the tallest of its items (a wrapped title costs another line). */
const rowHeight = (model: ItemBlockModel, scale: Scale, row: ReadonlyArray<ListEntry>) => {
  let tallest = 0;
  for (const entry of row) {
    const titleLines = linesFor(entry.title.length, model.w, model.font * scale.font, model.cw);
    const description = entry.description
      ? linesFor(entry.description.length, model.w, model.font * scale.font * 0.92, model.cw) * model.pitch * 0.92 + 1
      : 0;
    tallest = Math.max(tallest, model.pad + model.pitch * scale.line * titleLines + description);
  }
  return tallest;
};

/** Height of a list block (strengths, knowledge): heading plus rows of wrapped items. */
const listBlockHeight = (
  model: ItemBlockModel,
  scale: Scale,
  entries: ReadonlyArray<ListEntry>,
  extraHeadings = 0,
) => {
  if (!entries.length) return 0;
  const cols = Math.max(model.cols, 1);
  let rowsHeight = 0;
  let rows = 0;
  for (let start = 0; start < entries.length; start += cols) {
    rowsHeight += rowHeight(model, scale, entries.slice(start, start + cols));
    rows += 1;
  }
  return (model.head + extraHeadings * 8 + rowsHeight + model.gap * (rows - 1)) * scale.textHeight;
};

const bounded = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;

const legacyMarginTemplates = new Set([
  "elegant", "zweispaltig", "zeitgenoessisch", "kreativ", "stilvoll",
  "einspaltig", "klassisch", "tabellarisch", "ivy-league",
]);

const buildScale = (geometry: PaginationGeometry, context: ResumePlanContext, templateId?: string): Scale => {
  const overrides = context.overrides ?? {};
  const settings = context.settings;
  const defaults = templateId ? getTemplateDocumentDesignDefaults(templateId) : defaultDocumentDesign;
  const nativePt = geometry.text.bulletFont / PT_TO_MM;
  const font = overrides.bodySizePt
    ? bounded(overrides.bodySizePt, nativePt) / nativePt
    : settings ? fontSizeToPt[settings.fontSize] / fontSizeToPt[defaults.fontSize] : 1;
  // A larger font raises every line's box, even when an entry stays at the
  // same predicted line count. The nonlinear reserve covers word-wrap
  // thresholds observed in the rendered templates (notably Kreativ/Kompakt).
  const textHeight = Math.max(1, Math.pow(font, 1.3));
  const line = overrides.lineHeight
    ? bounded(overrides.lineHeight, geometry.text.lineRatio) / geometry.text.lineRatio
    : settings ? lineHeightLevelToValue[settings.lineHeightLevel] / lineHeightLevelToValue[defaults.lineHeightLevel] : 1;
  const defaultMargin = marginLevelToMm[defaults.marginLevel];
  const legacyMargin = settings && legacyMarginTemplates.has(templateId ?? "")
    ? marginLevelToMm[settings.marginLevel] - defaultMargin : 0;
  const marginInset = Math.max(0, overrides.pageMarginMm !== undefined
    ? overrides.pageMarginMm - defaultMargin : legacyMargin);
  const sectionGap = overrides.sectionGapMm ?? (settings && settings.sectionSpacingLevel !== defaults.sectionSpacingLevel
    ? nativeSectionGapOf(geometry, context.atsMode) + sectionSpacingLevelToMm[settings.sectionSpacingLevel] - sectionSpacingLevelToMm[defaults.sectionSpacingLevel]
    : undefined);
  const single = context.atsMode || context.layout?.mode === "single";
  const factors = context.atsMode ? geometry.ats : { exp: 1, edu: 1 };
  const spacing = { sectionGap, entryGap: overrides.entryGapMm };
  if (single) {
    const width = geometry.text.atsW / geometry.text.bulletW;
    const insetWidth = Math.max(0.55, (geometry.text.atsW - 2 * marginInset) / geometry.text.atsW);
    return { font, textHeight, line, width: width * insetWidth, contWidth: width * insetWidth, mainRatio: insetWidth, sideDelta: 0, marginInset, ...factors, ...spacing };
  }
  // A wider sidebar takes its extra millimetres from the main column (page width 210 mm).
  const layout = context.layout;
  const sideDelta = geometry.columns === 2 && layout?.nativeSidebarWidthPercent
    ? (layout.sidebarWidthPercent - layout.nativeSidebarWidthPercent) * 2.1
    : 0;
  const bulletRatio = Math.max(0.5, (geometry.text.bulletW - sideDelta) / geometry.text.bulletW);
  // Continuation pages have no sidebar: their main column spans the page.
  const contWidth = geometry.columns === 2 ? geometry.text.contW / geometry.text.bulletW : bulletRatio;
  const mainInset = Math.max(0.55, (geometry.text.mainW - 2 * marginInset) / geometry.text.mainW);
  const continuationInset = Math.max(0.55, (geometry.text.contW - 2 * marginInset) / geometry.text.contW);
  const mainRatio = Math.max(0.5, (geometry.text.mainW - sideDelta) / geometry.text.mainW) * mainInset;
  return { font, textHeight, line, width: bulletRatio * mainInset, contWidth: contWidth * continuationInset, mainRatio, sideDelta, marginInset, ...factors, ...spacing };
};

type SectionId = "summary" | "strengths" | "knowledge" | "languages" | "certifications" | "projects";

/** Everything except career items: estimated height, column, and the page it lives on. */
type FlowBlock = {
  id: string;
  zone: PaginationZone;
  height: number;
  home: "first" | "last";
  /** Position in the manager's order (a hand-arranged layout); blocks the manager does not know come last. */
  rank?: number;
  /** Sidebar block that may be hosted on page one instead of the last page. */
  hostable?: boolean;
  /** A block the template only draws when the whole résumé fits on one page. */
  singleOnly?: boolean;
  /** Height when the block flows into the full-width main column of the last page. */
  contHeight?: number;
  /** A list block whose rows may break between two pages: cumulative item count and height of any row range. */
  split?: { ends: number[]; height: (from: number, to: number) => number };
};

const sumHeights = (values: number[], gap: number) =>
  values.length ? values.reduce((total, value) => total + value, 0) + gap * (values.length - 1) : 0;

export const createResumePagePlan = (
  profile: ApplicantProfile | undefined,
  resumeProfile = "",
  options: ResumePaginationOptions = {},
  templateId?: string,
  context: ResumePlanContext = {},
): ResumePagePlan[] => {
  const geometry = getPaginationGeometry(templateId);
  const scale = buildScale(geometry, context, templateId);
  const flat = Boolean(context.atsMode) || context.layout?.mode === "single" || geometry.columns === 1;

  const find = (id: string) => context.sections?.find((section) => section.id === id);
  const legacy = profile?.resumeSections;
  const legacyFlag: Partial<Record<SectionId, boolean>> = {
    summary: legacy?.profile,
    strengths: legacy?.strengths,
    knowledge: legacy?.skills,
    languages: legacy?.languages,
    certifications: legacy?.certifications,
  };
  const visible = (id: SectionId) => find(id)?.visible ?? legacyFlag[id] ?? true;
  // Templates draw a section in its native column until the user arranges the
  // layout; only then do the managed zones apply (see applyManagedResumeOutput).
  const customLayout = Boolean(templateId && profile?.resumeManagerLayouts?.[templateId]?.length);
  const zoneOf = (id: SectionId): PaginationZone => {
    if (flat) return "main";
    const configured = customLayout ? find(id)?.zone : undefined;
    if (configured) return configured;
    if (id === "summary" || id === "strengths" || id === "knowledge" || id === "languages") return geometry.zones[id];
    return "main";
  };
  // Zone-flow templates keep a section in the column the user gave it, whatever page the pagination
  // ends up giving it: a sidebar block is hosted on page one whenever that column has room, and the
  // blocks of the main column flow behind the career entries.
  const zoneFlow = isZoneFlowTemplate(templateId) && !flat;
  const managerRank = (id: string) => {
    const index = context.sections?.findIndex((section) => section.id === id) ?? -1;
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };

  const closingVisible = context.closing?.visible ?? Boolean(profile?.resumeClosing && (profile.resumeClosing.showPlace || profile.resumeClosing.showDate || profile.resumeClosing.showSignature));
  const closingHeight = closingVisible
    ? (context.closing?.signature ?? Boolean(profile?.signaturePath && profile.resumeClosing?.showSignature))
      ? CLOSING_MM.signature
      : CLOSING_MM.plain
    : 0;

  // --- career items ---------------------------------------------------------
  const sectionGap = scale.sectionGap ?? nativeSectionGapOf(geometry, context.atsMode);
  const experienceGap = geometry.exp.gap > 0 ? (scale.entryGap ?? geometry.exp.gap) : 0;
  const educationGap = geometry.edu.gap > 0 ? (scale.entryGap ?? geometry.edu.gap) : 0;
  const items: MeasuredItem[] = [
    ...(profile?.experiences ?? []).map((experience): MeasuredItem => {
      const first = experienceMetrics(experience, geometry, scale, scale.width, bulletCapOf(templateId));
      const cont = experienceMetrics(experience, geometry, scale, scale.contWidth, bulletCapOf(templateId));
      return {
        kind: "experience", id: experience.id, weight: 0, gapAfter: experienceGap,
        first: first.height(0, first.lines.length),
        cont: cont.height(0, cont.lines.length),
        parts: { first, cont },
      };
    }),
    ...(profile?.education ?? []).map((education): MeasuredItem => ({
      kind: "education", id: education.id, weight: 0, gapAfter: educationGap,
      first: educationHeight(education, geometry, scale, scale.width),
      cont: educationHeight(education, geometry, scale, scale.contWidth),
    })),
  ];
  const managerLayout = templateId ? profile?.resumeManagerLayouts?.[templateId] : undefined;
  if (managerLayout?.length) {
    const order = managerLayout.map((entry) => entry.id);
    const rank = (kind: string) => {
      const index = order.indexOf(kind);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    // Array#sort is stable: items of one section keep their profile order.
    items.sort((left, right) => rank(left.kind) - rank(right.kind));
  }

  const sectionHead = (kind: ResumePageItem["kind"]) =>
    (context.atsMode ? geometry.ats.head : undefined) ?? (kind === "experience" ? geometry.exp.head : geometry.edu.head);
  /** A career entry as drawn on one page: all of it, or the part of an entry that breaks across pages. */
  type Shown = { kind: ResumePageItem["kind"]; height: number; gapAfter: number };
  /** Height of a run of career entries on one page, including one heading per section. */
  const runHeight = (list: readonly Shown[]) => {
    let total = 0;
    let previousKind: string | undefined;
    list.forEach((entry, index) => {
      if (entry.kind !== previousKind) {
        total += (index > 0 ? sectionGap : 0) + sectionHead(entry.kind);
      } else {
        total += list[index - 1].gapAfter;
      }
      total += entry.height;
      previousKind = entry.kind;
    });
    return total;
  };
  const wholeShown = (item: MeasuredItem, page: "first" | "cont"): Shown => ({ kind: item.kind, height: item[page], gapAfter: item.gapAfter });
  const itemsHeight = (list: readonly MeasuredItem[], page: "first" | "cont") => runHeight(list.map((item) => wholeShown(item, page)));

  // --- fixed blocks -----------------------------------------------------------
  const summaryText = (resumeProfile || profile?.summary || "").trim();
  const knowledgeSection = profile ? ensureKnowledgeSection(profile.knowledgeSection, profile.skills) : undefined;
  const knowledgeGroups = knowledgeSection?.isVisible === false ? [] : knowledgeLists(knowledgeSection ?? { title: "", categories: [], isVisible: true }).filter((list) => list.items.length);
  const knowledgeItemCount = knowledgeGroups.reduce((total, list) => total + list.items.length, 0);
  // Without strengths of its own a résumé shows its skills as strengths (see applyManagedResumeOutput).
  const explicitStrengths = (profile?.strengths ?? [])
    .filter((entry) => entry.title.trim())
    .map((entry) => ({ title: entry.title.trim(), description: entry.description.trim() }));
  const skillStrengths: ListEntry[] = [...new Set((profile?.skills ?? []).map((value) => value.trim()).filter(Boolean))].map((value) => {
    const [title, ...description] = value.split(/\s+(?:–|—|:)\s+/);
    return { title, description: description.join(" – ") };
  });
  // Pehlione words its core competencies from what the profile says when it lists neither strengths nor skills.
  const pehlioneCompetencies: ListEntry[] = zoneFlow && templateId?.startsWith("pehlione_") && !explicitStrengths.length && !skillStrengths.length
    ? getPehlioneCoreCompetencies(profile).map((title) => ({ title, description: "" }))
    : [];
  const strengthEntries: ListEntry[] = explicitStrengths.length ? explicitStrengths : skillStrengths.length ? skillStrengths : pehlioneCompetencies;
  const languages = (profile?.languages ?? []).filter((entry) => entry.trim());
  const certifications = (profile?.certifications ?? []).filter((entry) => entry.trim());
  const { blocks } = geometry;
  const line = (values: [number, number], count: number) => values[0] + values[1] * count;
  const textWidth = (zone: PaginationZone) =>
    flat ? ((context.atsMode ? geometry.ats.summaryW : undefined) ?? geometry.text.atsW) * scale.mainRatio
      : zone === "sidebar" ? geometry.text.sideW + scale.sideDelta
        : geometry.text.mainW * scale.mainRatio;

  // Strengths and knowledge are drawn by the managed layer as an item grid. Beside a
  // sidebar the list keeps its measured narrow column; anywhere else the number of
  // columns follows the same rule as the renderer (resolveSectionColumns).
  const settings = context.settings ?? defaultDocumentDesign;
  const gridModel = (kind: "strengths" | "knowledge", entries: ListEntry[], zone: PaginationZone, page: "first" | "last"): ItemBlockModel => {
    const model = geometry.items[kind];
    if (zone === "sidebar" && !flat && page === "first") return { ...model, w: model.w + scale.sideDelta };
    const beside = !flat && page === "first" && geometry.columns === 2;
    const mode = kind === "strengths" ? settings.strengthsColumns : settings.knowledgeColumns;
    const cols = resolveSectionColumns(mode, templateId ?? "", "main", entries, settings, beside);
    const width = beside ? geometry.text.mainW * scale.mainRatio : geometry.text.fullW;
    return {
      ...model,
      cols,
      w: Math.max(12, (width - GRID_COLUMN_GAP_MM * (cols - 1)) / cols - (context.atsMode ? 0 : GRID_ICON_MM)),
      gap: kind === "strengths" ? 3 : 2,
    };
  };

  // A plain list section (certificates, languages, special sections, the project highlight) of a
  // zone-flow template: heading plus wrapped entries, sized from the same tokens that draw it.
  // The entries wrap at the text width of the column they stand in — the narrow sidebar, the main
  // column beside it, or the full page width on the last page.
  const plainListHeight = (zone: PaginationZone, texts: readonly string[], fullWidth = false) => {
    const metrics = zoneFlow && templateId ? sectionListMetrics(templateId, zone) : undefined;
    if (!metrics || !texts.length) return 0;
    const column = zone === "sidebar" ? geometry.text.sideW + scale.sideDelta
      : fullWidth ? geometry.text.fullW : geometry.text.mainW * scale.mainRatio;
    // The lists of Pehlione have fixed sizes: neither the design font size nor the line height reaches them.
    // A list that takes the body size of the page follows the design settings like the rest of the text.
    const fontMm = metrics.inheritBody ? geometry.text.bulletFont * scale.font : metrics.fontMm;
    const lineMm = metrics.inheritBody ? fontMm * geometry.text.lineRatio * scale.line : metrics.lineMm;
    const lines = texts.map((text) => listLines(text.length, column - metrics.indentMm, fontMm));
    const body = lines.reduce((total, count) => total + count * lineMm, 0);
    return metrics.headingMm + body + metrics.gapMm * (texts.length - 1);
  };
  /**
   * A special section: its entries are drawn like career entries (the template's entry spacing between them)
   * with paragraphs in the body font, in whichever column the section stands.
   */
  const specialHeight = (zone: PaginationZone, section: NonNullable<typeof profile>["specialSections"][number], fullWidth = false) => {
    const metrics = zoneFlow && templateId ? sectionListMetrics(templateId, zone) : undefined;
    if (!metrics) return 0;
    const normalized = normalizeCustomSection(section);
    const listed = normalized.contentType === "list" || normalized.contentType === "skills" || normalized.contentType === "timeline";
    const column = zone === "sidebar" ? geometry.text.sideW + scale.sideDelta
      : fullWidth ? geometry.text.fullW : geometry.text.mainW * scale.mainRatio;
    const font = geometry.text.bulletFont * scale.font;
    const pitch = font * geometry.text.lineRatio * scale.line;
    const lines = (text: string, indent = 0) => (text.trim() ? linesFor(text.trim().length, column - indent, font, SPECIAL_CW) : 0);
    const headed = normalized.contentType === "entries" || normalized.contentType === "timeline";
    const entries = normalized.entries.map((entry) => {
      const indent = listed ? metrics.indentMm : 0;
      const meta = [entry.location, entry.date.trim() || [entry.from, entry.to].filter((value) => value.trim()).join(" – ")].filter((value) => value.trim()).join(" · ");
      const head = headed
        ? lines(entry.title, indent) * pitch * 1.13 + (entry.subtitle.trim() ? 6.7 : 0) + (meta ? 4.1 : 0)
        : lines(entry.title, indent) * pitch + lines(entry.subtitle, indent) * pitch + lines(meta, indent) * pitch;
      return head
        + lines(entry.description, indent) * pitch
        + entry.bullets.reduce((total, value) => total + lines(value, indent + metrics.indentMm) * pitch, 0)
        + lines(entry.url, indent) * pitch;
    });
    const between = geometry.exp.gap + (zone === "sidebar" && listed ? metrics.gapMm : 3);
    return (metrics.headingMm + entries.reduce((total, value) => total + value, 0) + between * Math.max(0, entries.length - 1)) * scale.textHeight;
  };
  /**
   * The project highlight in the sidebar: the title, the company line and the bullets keep their body sizes,
   * only the column is narrow (the main-column model is calibrated on the wide column).
   */
  const sidebarProjectHeight = (project: NonNullable<ReturnType<typeof getPehlioneProjectHighlight>>) => {
    const metrics = zoneFlow && templateId ? sectionListMetrics(templateId, "sidebar") : undefined;
    if (!metrics) return 0;
    const column = geometry.text.sideW + scale.sideDelta;
    const bodyFont = geometry.text.bulletFont * scale.font;
    const titleFont = PROJECT_TITLE_MM * scale.font;
    const titleLines = linesFor(project.title.length, column, titleFont, PROJECT_TITLE_CW);
    const company = [project.company, ...project.technologies].filter(Boolean).join(" · ");
    const companyLines = company ? linesFor(company.length, column, bodyFont, PROJECT_COMPANY_CW) : 0;
    const bullets = project.achievements.map((entry) => listLines(entry.length, column - metrics.indentMm, bodyFont));
    const bulletPitch = bodyFont * 1.25 * scale.line;
    const list = bullets.reduce((total, lines) => total + lines * bulletPitch + 1, 0) + (bullets.length > 1 ? 1.35 * (bullets.length - 1) : 0);
    return (
      metrics.headingMm
      + titleLines * titleFont * 1.3 * scale.line
      + (companyLines ? companyLines * bodyFont * 1.2 * scale.line + 2.5 : 0)
      + list
    ) * scale.textHeight;
  };
  /** A free knowledge group: its items as a plain list (level and description under the text). */
  const groupHeight = (zone: PaginationZone, id: string, fullWidth = false) => {
    const group = resolveKnowledgeGroups(templateId ?? "", profile?.resumeKnowledgeGroups).find((candidate) => `group:${candidate.id}` === id);
    const items = (group?.items ?? []).filter((item) => item.visible && item.text.trim());
    if (!items.length) return 30;
    return plainListHeight(zone, items.map((item) => [item.text, item.level, item.description].filter(Boolean).join(" ")), fullWidth) * 1.15;
  };

  const flow: FlowBlock[] = [];
  if (visible("summary") && summaryText) {
    const zone = zoneOf("summary");
    const lines = linesFor(summaryText.length, textWidth(zone), geometry.text.sumFont * scale.font, geometry.text.cw * SUMMARY_WRAP_SLACK);
    // Every plain section starts with the same heading block as the career sections.
    const summaryHead = context.atsMode ? geometry.ats.head ?? geometry.exp.head : blocks.summary[0];
    // The lines of a summary follow the body font exactly; only enlarged text keeps its reserve.
    const summaryScale = zoneFlow && scale.font < 1 ? scale.font : scale.textHeight;
    flow.push({
      id: "summary",
      zone,
      height: zoneFlow
        ? summaryHead * scale.textHeight + blocks.summary[1] * scale.line * lines * summaryScale
        : (summaryHead + blocks.summary[1] * scale.line * lines) * scale.textHeight,
      home: "first",
    });
  }
  // Skills shown as strengths are only drawn by some templates, and some only on a one-page résumé.
  const derivedStrengths = explicitStrengths.length ? "first" : geometry.derivedStrengths[context.atsMode ? "ats" : "visual"];
  if (visible("strengths") && strengthEntries.length && derivedStrengths !== "never") {
    const zone = zoneOf("strengths");
    flow.push({
      id: "strengths",
      zone,
      height: listBlockHeight(gridModel("strengths", strengthEntries, zone, "first"), scale, strengthEntries),
      home: "first",
      singleOnly: derivedStrengths === "single",
    });
  }
  if (visible("languages") && languages.length) {
    const zone = zoneOf("languages");
    // Languages follow the sidebar on page one; in a flat main column they close the document.
    flow.push({
      id: "languages",
      zone,
      // Long names such as “Türkisch (Muttersprache) – C2” wrap inside a narrow sidebar; plain lists span the page.
      height: context.atsMode
        ? line(geometry.ats.languages, languages.length) * scale.textHeight
        : zoneFlow
          ? plainListHeight(zone, languages)
          : (line(blocks.languages, languages.length) + languages.filter((entry) => entry.length > 22).length * geometry.exp.linePitch) * scale.textHeight,
      home: !flat && geometry.zones.languages === "sidebar" ? "first" : "last",
    });
  }
  const projectVisible = find("projects")?.visible ?? true;
  if (templateId?.startsWith("pehlione_") && projectVisible && !context.atsMode) {
    const project = getPehlioneProjectHighlight(profile);
    if (project && !(templateId === "pehlione_white_blue" && hasPehlioneCustomProjectHighlight(profile))) {
      const lines = project.achievements.reduce(
        (total, entry) => total + linesFor(entry.length, geometry.text.bulletW, geometry.text.bulletFont, geometry.text.cw),
        0,
      );
      // Pehlione renders its project highlight after education. When education
      // continues on page two, the project must follow it there as well.
      const mainHeight = (24 + lines * geometry.exp.linePitch) * scale.textHeight;
      const zone = zoneFlow ? zoneOf("projects") : "main";
      const inSidebar = zoneFlow && zone === "sidebar";
      flow.push({
        id: "projects",
        zone,
        height: inSidebar ? sidebarProjectHeight(project) : mainHeight,
        contHeight: inSidebar ? mainHeight : undefined,
        home: "last",
        rank: managerRank("projects"),
        hostable: inSidebar,
      });
    }
  }
  const knowledgeZone = zoneOf("knowledge");
  if (visible("knowledge") && knowledgeItemCount) {
    // The renderer draws one grid per category (and subcategory): its rows are the places a page may end.
    const knowledgeRows = (page: "first" | "last") => {
      const rows: Array<{ end: number; height: number; list: number; gap: number }> = [];
      let shown = 0;
      knowledgeGroups.forEach((group, list) => {
        const entries: ListEntry[] = group.items.map((item) => ({ title: item.name, description: item.description }));
        const model = gridModel("knowledge", entries, knowledgeZone, page);
        const cols = Math.max(model.cols, 1);
        for (let start = 0; start < entries.length; start += cols) {
          const row = entries.slice(start, start + cols);
          shown += row.length;
          rows.push({ end: shown, height: rowHeight(model, scale, row), list, gap: model.gap });
        }
      });
      return rows;
    };
    const rowsHeight = (rows: ReturnType<typeof knowledgeRows>, from: number, to: number) => {
      const part = rows.slice(from, to);
      if (!part.length) return 0;
      const lists = new Set(part.map((row) => row.list)).size;
      // The heading and the first category title lead every part; each further category adds a title.
      return (geometry.items.knowledge.head + 8 * (lists - 1) + part.reduce((total, row) => total + row.height, 0) + part[0].gap * (part.length - lists)) * scale.textHeight;
    };
    if (context.atsMode) {
      // Plain text: one comma-separated paragraph per category and subcategory. It stays whole.
      const model = geometry.ats.knowledge;
      const listHeights = knowledgeGroups.map(({ category, items }) => {
        const characters = items.reduce(
          (total, item) => total + formatKnowledgeItem(item, category.showLevels, category.showYearsOfExperience, "comma-separated").length,
          2 * (items.length - 1),
        );
        const lines = linesFor(characters, model.w * scale.mainRatio, model.font * scale.font, geometry.text.cw * ATS_LIST_WRAP);
        return model.title + lines * model.pitch * scale.line;
      });
      const height = (model.head + sumHeights(listHeights, model.gap) + model.tail) * scale.textHeight;
      flow.push({ id: "knowledge", zone: knowledgeZone, height, contHeight: height, home: "last" });
    } else {
      const firstRows = knowledgeRows("first");
      const lastRows = knowledgeRows("last");
      flow.push({
        id: "knowledge",
        zone: knowledgeZone,
        height: rowsHeight(firstRows, 0, firstRows.length),
        // On the last page there is no sidebar: the list spreads over the page width.
        contHeight: rowsHeight(lastRows, 0, lastRows.length),
        home: "last",
        rank: managerRank("knowledge"),
        hostable: knowledgeZone === "sidebar" && !flat,
        split: { ends: lastRows.map((row) => row.end), height: (from, to) => rowsHeight(lastRows, from, to) },
      });
    }
  }
  const certificates = geometry.certs;
  // The plain layouts list every certificate, whatever the styled layout shows of them.
  const plain = Boolean(context.atsMode);
  const certificateHome = flat ? "last" : certificates.home;
  if (visible("certifications") && certifications.length && (plain || certificateHome !== "none")) {
    const shown = plain ? certifications : certifications.slice(0, certificates.limit ?? certifications.length);
    const width = flat ? geometry.text.fullW : certificates.zone === "main" ? certificates.w * scale.mainRatio : certificates.w + scale.sideDelta;
    const wrapped = shown.reduce(
      (total, entry) => total + Math.max(0, linesFor(entry.length, width, certificates.font * scale.font, geometry.text.cw) - 1),
      0,
    );
    const model = plain ? geometry.ats.certs : certificates;
    // A template that keeps them in its sidebar draws them on page one; flattened layouts append them.
    const zone = flat ? "main" : ((customLayout ? find("certifications")?.zone : undefined) ?? certificates.zone);
    const legacyHeight = (model.base + model.perItem * shown.length + certificates.pitch * scale.line * wrapped) * scale.textHeight;
    const inSidebar = zoneFlow && zone === "sidebar";
    flow.push({
      id: "certifications",
      zone,
      height: zoneFlow ? plainListHeight(zone, shown) : legacyHeight,
      // A sidebar block that does not fit beside page one goes to the full-width main column of the last page.
      contHeight: zoneFlow ? plainListHeight("main", shown, true) : undefined,
      // A zone-flow template hosts the certificates on page one when their column has room, whatever home the
      // template's own geometry gives them (some draw them beside page one, some behind the career).
      home: zoneFlow ? "last" : certificateHome === "none" ? "last" : certificateHome,
      rank: managerRank("certifications"),
      hostable: inSidebar,
    });
  }
  const hostedIds: string[] = [];
  for (const special of profile?.specialSections ?? []) {
    const entry = find(`special:${special.id}`);
    if (!special.isVisible || entry?.visible === false) continue;
    const zone = flat ? "main" : entry?.zone ?? "main";
    const height = 9 + special.entries.reduce((total, item) => total + 9 + (item.description ? 3.5 : 0), 0);
    const inSidebar = zoneFlow && zone === "sidebar";
    flow.push({
      id: `special:${special.id}`,
      zone,
      height: zoneFlow ? specialHeight(zone, special) : height,
      contHeight: zoneFlow ? specialHeight("main", special, true) : undefined,
      home: "last",
      rank: managerRank(`special:${special.id}`),
      hostable: inSidebar,
    });
    hostedIds.push(`special:${special.id}`);
  }
  for (const entry of context.sections ?? []) {
    if (!entry.id.startsWith("group:") || !entry.visible) continue;
    const zone = flat ? "main" : entry.zone;
    const inSidebar = zoneFlow && zone === "sidebar";
    flow.push({
      id: entry.id,
      zone,
      height: zoneFlow ? groupHeight(zone, entry.id) : 30,
      contHeight: zoneFlow ? groupHeight("main", entry.id, true) : undefined,
      home: "last",
      rank: managerRank(entry.id),
      hostable: inSidebar,
    });
    hostedIds.push(entry.id);
  }

  // --- page geometry ----------------------------------------------------------
  // Every continuation page repeats the native first-page header. Kompakt's
  // first header has no contact block, and the added line exceeds its minimum
  // height; the other templates have room for the shared contact line.
  const contactOnContinuation = find("personalData")?.visible !== false && Boolean(profile?.email?.trim() || profile?.phone?.trim());
  const kompaktContactHeight = !context.atsMode && templateId === "kompakt" && contactOnContinuation ? 5.5 : 0;
  // The plain layouts measured their offsets with every contact filled; a header that stacks
  // its contacts shrinks with each missing one, and every page repeats it.
  const stackedHeader = context.atsMode ? geometry.ats.header : undefined;
  const stackedHeight = stackedHeader
    ? stackedHeader.base + stackedHeader.perContact * (find("personalData")?.visible === false ? 0 : atsContactLines(templateId, profile))
    : undefined;
  const top1 = (context.atsMode ? stackedHeight ?? geometry.atsTop1 : geometry.top1) + kompaktContactHeight;
  const top2 = (context.atsMode ? stackedHeight ?? geometry.atsTop2 : geometry.top1) + kompaktContactHeight;
  const mainCap1 = (geometry.limit - top1 - 2 * scale.marginInset) * SAFETY;
  const mainCap2 = (geometry.limit - top2 - 2 * scale.marginInset) * SAFETY;
  // Where the first sidebar block starts depends on how many contact entries (and wrapped values) precede it.
  const sidebarHero = zoneFlow && hasSidebarHero(templateId);
  const contactItems = sidebarHero && find("personalData")?.visible !== false ? getPehlioneContacts(profile) : [];
  const contactValueWidth = geometry.text.sideW + scale.sideDelta - CONTACT_ICON_MM;
  const sideTop1 = sidebarHero && geometry.sideTop1 !== null
    ? SIDEBAR_HERO_MM + (contactItems.length
      ? CONTACT_HEAD_MM
        + contactItems.reduce((total, item) => total + CONTACT_ITEM_MM
          + (listLines(item.value.length, contactValueWidth, CONTACT_FONT_MM * scale.font) - 1) * CONTACT_LINE_MM, 0)
        + CONTACT_GAP_MM
      : 0)
    : geometry.sideTop1;
  const sideCap1 = sideTop1 === null || flat
    ? 0
    : (geometry.sideLimit - sideTop1 - 2 * scale.marginInset) * (zoneFlow ? ZONE_FLOW_SIDEBAR_SAFETY : SAFETY);
  const dense = context.atsMode ? geometry.ats.density : geometry.density;

  const blockLoad = (blocksOfZone: FlowBlock[], zone: PaginationZone) => {
    const heights = blocksOfZone.filter((block) => block.zone === zone).map((block) => block.height);
    return sumHeights(heights, zone === "sidebar" ? blocks.sideGap : sectionGap);
  };
  const firstBlocks = flow.filter((block) => block.home === "first" && !block.singleOnly);
  const singleOnlyBlocks = flow.filter((block) => block.singleOnly);
  const lastBlocks = flow.filter((block) => block.home === "last");
  const hostable = lastBlocks.filter((block) => block.hostable);
  // The sidebar fills in the order of the user's layout.
  if (zoneFlow && customLayout) hostable.sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0));

  const stack = (fixed: number, run: number) => fixed + run + (fixed > 0 && run > 0 ? sectionGap : 0);
  const wholeMain = () =>
    stack(blockLoad([...firstBlocks, ...singleOnlyBlocks], "main"), stack(itemsHeight(items, "first"), blockLoad(lastBlocks, "main"))) + closingHeight;
  const wholeSide = () => blockLoad([...firstBlocks, ...singleOnlyBlocks, ...lastBlocks], "sidebar");

  const forced = options.firstPageItemCount;
  const onePage = (density: ResumePagePlan["density"]): ResumePagePlan[] => [
    {
      pageNumber: 1,
      items: items.map((item) => strip(item, "first")),
      density,
      blocks: flow.filter((block) => block.home === "last" || block.hostable).map((block) => block.id),
      sidebar: geometry.columns === 2 && !flat,
      fill: { main: wholeMain() / mainCap1, sidebar: sideCap1 ? wholeSide() / sideCap1 : 0 },
    },
  ];
  const fitsOnePage = wholeMain() <= mainCap1 && (sideCap1 === 0 || wholeSide() <= sideCap1);
  if ((fitsOnePage && forced === undefined) || items.length <= 1) return onePage("standard");
  // A slightly compacted single page beats a second page that would be nearly empty,
  // but only with a real margin: the estimate must not be trusted to the last millimetre.
  // The lists of a zone-flow sidebar keep their size in every density: compaction earns that column nothing.
  const sideShrink = (factor: number) => (zoneFlow ? 1 : factor);
  const fitsCompact =
    wholeMain() * dense.compact <= mainCap1 * COMPACT_MARGIN &&
    (sideCap1 === 0 || wholeSide() * sideShrink(dense.compact) <= sideCap1 * COMPACT_MARGIN);

  // Sidebar blocks move to page one whenever that column has room for them.
  const hostedOnFirst = new Set<string>();
  if (sideCap1) {
    let sideLoad = blockLoad(firstBlocks, "sidebar");
    for (const block of hostable) {
      const next = sideLoad + (sideLoad > 0 ? blocks.sideGap : 0) + block.height;
      if (next <= sideCap1 * (zoneFlow ? ZONE_FLOW_HOST_SHARE : SIDEBAR_HOST_SHARE)) {
        hostedOnFirst.add(block.id);
        sideLoad = next;
      }
    }
  }
  // Zone flow: the main column keeps the order of the user's layout. A block that stands above the
  // career sections belongs to page one; the others follow the career entries, and start on page one
  // for as long as it has room.
  const careerRank = Math.min(managerRank("experience"), managerRank("education"));
  const headBlocks = zoneFlow && customLayout
    ? lastBlocks.filter((block) => !hostedOnFirst.has(block.id) && block.zone === "main" && (block.rank ?? Number.MAX_SAFE_INTEGER) < careerRank)
    : [];
  const pageOneFlow = [...firstBlocks, ...lastBlocks.filter((block) => hostedOnFirst.has(block.id) || headBlocks.includes(block))];
  const pageTwoFlow = lastBlocks.filter((block) => !hostedOnFirst.has(block.id) && !headBlocks.includes(block));
  // The last page has no sidebar: a sidebar block that stays there flows into the full-width main column.
  const contOf = (block: FlowBlock) => block.contHeight ?? block.height;
  // The blocks behind the career entries keep the order their template draws them in. Only
  // a leading run of blocks the plan can place (Pehlione's project highlight, the knowledge
  // list) may start on page one; everything after the first fixed block is drawn by the
  // template itself on the last page. A hand-arranged layout keeps its own order.
  const nativeTail = templateId === "tabellarisch" && !context.atsMode
    ? ["certifications", "languages", "knowledge"]
    : templateId === "gepflegt" && flat
      ? ["languages", "knowledge"]
      : ["projects", "knowledge", "languages", "certifications"];
  const tail: FlowBlock[] = [];
  if (zoneFlow) {
    // Every block of the main column can start on page one: the project highlight and the knowledge
    // list first, then the free groups, the certificates and the special sections (the order the
    // template draws them in), or the order of the user's layout.
    const nativeRank = (id: string) =>
      id === "projects" ? 0 : id === "knowledge" ? 1 : id.startsWith("group:") ? 2 : id === "certifications" ? 3 : 4;
    tail.push(
      ...pageTwoFlow
        .filter((block) => block.zone === "main")
        .sort((left, right) => customLayout
          ? (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
          : nativeRank(left.id) - nativeRank(right.id)),
    );
  } else if (!customLayout) {
    for (const id of nativeTail) {
      const block = pageTwoFlow.find((candidate) => candidate.id === id);
      if (!block) continue;
      if ((id === "projects" || id === "knowledge") && (flat || block.zone === "main")) tail.push(block);
      else break;
    }
  }
  const pinned = pageTwoFlow.filter((block) => !tail.includes(block));
  const pinnedLoad = sumHeights(pinned.map(contOf), sectionGap);
  const load1Fixed = blockLoad(pageOneFlow, "main");
  const sideLoadOne = blockLoad(pageOneFlow, "sidebar");
  const sideFill = sideCap1 ? sideLoadOne / sideCap1 : 0;

  // --- where page one ends ------------------------------------------------------
  /**
   * Page one ends after `count` whole entries, then `kept` bullets of the next experience,
   * then `tail` whole blocks, then `rows` grid rows of the next block.
   */
  type Cut = { count: number; kept: number; tail: number; rows: number };
  const totalBullets = (item: MeasuredItem) => item.parts?.first.lines.length ?? 0;
  /** Bullet counts after which an entry may break without leaving a widow or an orphan. */
  const breakPoints = (item: MeasuredItem): number[] => {
    if (!item.parts) return [];
    const points: number[] = [];
    for (let kept = 1; kept < totalBullets(item); kept += 1) {
      const before = item.parts.first.lines.slice(0, kept).reduce((total, value) => total + value, 0);
      const after = item.parts.cont.lines.slice(kept).reduce((total, value) => total + value, 0);
      if (before >= MIN_SPLIT_LINES && after >= MIN_SPLIT_LINES) points.push(kept);
    }
    return points;
  };
  const shownFirst = ({ count, kept }: Cut): Shown[] => {
    const list = items.slice(0, count).map((item) => wholeShown(item, "first"));
    const split = kept ? items[count] : undefined;
    if (split?.parts) list.push({ kind: split.kind, height: split.parts.first.height(0, kept), gapAfter: split.gapAfter });
    return list;
  };
  const shownLast = ({ count, kept }: Cut): Shown[] => {
    const split = kept ? items[count] : undefined;
    const list: Shown[] = [];
    if (split?.parts) list.push({ kind: split.kind, height: split.parts.cont.height(kept, totalBullets(split)), gapAfter: split.gapAfter });
    list.push(...items.slice(count + (kept ? 1 : 0)).map((item) => wholeShown(item, "cont")));
    return list;
  };
  /** Heights of the tail blocks drawn on page one / on the last page, including a block that breaks between them. */
  const tailFirst = ({ tail: whole, rows }: Cut) => [
    ...tail.slice(0, whole).map((block) => block.height),
    ...(rows && tail[whole]?.split ? [tail[whole].split!.height(0, rows)] : []),
  ];
  const tailLast = ({ tail: whole, rows }: Cut) => [
    ...(rows && tail[whole]?.split ? [tail[whole].split!.height(rows, tail[whole].split!.ends.length)] : []),
    ...tail.slice(whole + (rows ? 1 : 0)).map(contOf),
  ];
  const loadFirst = (cut: Cut) =>
    stack(load1Fixed, stack(runHeight(shownFirst(cut)), sumHeights(tailFirst(cut), sectionGap)));
  const loadLast = (cut: Cut) =>
    stack(stack(runHeight(shownLast(cut)), sumHeights(tailLast(cut), sectionGap)), pinnedLoad) + closingHeight;

  const cuts: Cut[] = [];
  for (let count = 0; count <= items.length; count += 1) {
    cuts.push({ count, kept: 0, tail: 0, rows: 0 });
    const item = items[count];
    if (item) for (const kept of breakPoints(item)) cuts.push({ count, kept, tail: 0, rows: 0 });
  }
  for (let whole = 1; whole <= tail.length; whole += 1) {
    // A list block may end page one at any of its rows, keeping two rows on either side.
    const split = tail[whole - 1].split;
    if (split) for (let rows = 2; rows <= split.ends.length - 2; rows += 1) cuts.push({ count: items.length, kept: 0, tail: whole - 1, rows });
    cuts.push({ count: items.length, kept: 0, tail: whole, rows: 0 });
  }
  // The signature never travels alone: the last page needs something besides the closing block.
  const candidates = cuts.filter((cut) => shownLast(cut).length > 0 || tailLast(cut).length > 0 || pinned.length > 0);

  const densityFactor = { standard: 1, compact: dense.compact, dense: dense.dense };
  const densityFor = (fill: number): { density: ResumePagePlan["density"]; overflow: number } => {
    if (fill <= 1) return { density: "standard", overflow: 0 };
    if (fill * dense.compact <= 1) return { density: "compact", overflow: 0 };
    return { density: "dense", overflow: Math.max(0, fill * dense.dense - 1) };
  };

  const assemble = (cut: Cut, densityOne: ResumePagePlan["density"], densityTwo: ResumePagePlan["density"]): ResumePagePlan[] => {
    const split = cut.kept ? items[cut.count] : undefined;
    const part = (item: MeasuredItem, from: number, to: number, page: "first" | "cont"): ResumePageItem => ({
      kind: "experience",
      id: item.id,
      weight: Math.round((item.parts?.[page].height(from, to) ?? 0) * 10) / 10,
      bullets: { from, to, total: totalBullets(item) },
    });
    const firstItems: ResumePageItem[] = items.slice(0, cut.count).map((item) => strip(item, "first"));
    if (split) firstItems.push(part(split, 0, cut.kept, "first"));
    const lastItems: ResumePageItem[] = [];
    if (split) lastItems.push(part(split, cut.kept, totalBullets(split), "cont"));
    lastItems.push(...items.slice(cut.count + (split ? 1 : 0)).map((item) => strip(item, "cont")));
    // A list block that breaks between the pages is drawn on both, each with its own items.
    const broken = cut.rows ? tail[cut.tail] : undefined;
    const total = broken?.split ? knowledgeItemCount : 0;
    const shown = broken?.split ? broken.split.ends[cut.rows - 1] : 0;
    const ranges = broken?.split
      ? { first: { [broken.id]: { from: 0, to: shown, total } }, last: { [broken.id]: { from: shown, to: total, total } } }
      : undefined;
    return [
      {
        pageNumber: 1,
        items: firstItems,
        density: densityOne,
        blocks: [...pageOneFlow.filter((block) => block.home === "last"), ...tail.slice(0, cut.tail + (broken ? 1 : 0))].map((block) => block.id),
        ...(ranges ? { blockRanges: ranges.first } : {}),
        sidebar: geometry.columns === 2 && !flat,
        fill: { main: loadFirst(cut) / mainCap1, sidebar: sideFill },
      },
      {
        pageNumber: 2,
        items: lastItems,
        density: densityTwo,
        blocks: [...tail.slice(cut.tail), ...pinned].map((block) => block.id),
        ...(ranges ? { blockRanges: ranges.last } : {}),
        // Continuation pages never keep a sidebar: what did not fit on page one flows into the main column.
        sidebar: false,
        fill: { main: loadLast(cut) / mainCap2, sidebar: 0 },
      },
    ];
  };

  // A manual page break keeps whole entries on either side of it.
  if (forced !== undefined) {
    const cut: Cut = { count: Math.min(Math.max(forced, 0), items.length), kept: 0, tail: 0, rows: 0 };
    return assemble(cut, densityFor(Math.max(loadFirst(cut) / mainCap1, sideFill)).density, densityFor(loadLast(cut) / mainCap2).density);
  }

  // Fill page one as far as the content allows; compact the whole document only if the
  // rest does not fit on page two either.
  const greedy = (density: ResumePagePlan["density"]) => {
    const factor = densityFactor[density];
    let index = 0;
    candidates.forEach((cut, position) => {
      if (loadFirst(cut) * factor <= mainCap1) index = position;
    });
    return index;
  };
  let density: ResumePagePlan["density"] = "dense";
  let index = greedy("dense");
  for (const attempt of ["standard", "compact"] as const) {
    // A sidebar that overflows on its own needs the stronger density whatever the cut is.
    if (sideFill * sideShrink(densityFactor[attempt]) > 1) continue;
    const position = greedy(attempt);
    if (loadLast(candidates[position]) * densityFactor[attempt] <= mainCap2) {
      density = attempt;
      index = position;
      break;
    }
  }
  // A last page that is only a stub takes back trailing content from page one.
  const factor = densityFactor[density];
  while (index > 0 && loadLast(candidates[index]) / mainCap2 < MIN_LAST_FILL) {
    const earlier = candidates[index - 1];
    if (loadFirst(earlier) / mainCap1 < MIN_FIRST_FILL || loadLast(earlier) * factor > mainCap2) break;
    index -= 1;
  }
  const best = candidates[index];

  if (fitsCompact && (density !== "standard" || loadLast(best) / mainCap2 < COMPACT_INSTEAD_OF_LAST_BELOW)) return onePage("compact");

  return assemble(best, density, density);
};

export const getLetterPageStatus = <
  T extends Pick<
    DocumentDraft,
    | "coverSubject"
    | "coverIntroduction"
    | "coverMainBody"
    | "coverMotivation"
    | "coverQualification"
    | "coverCompanyFit"
    | "coverExtraParagraph"
    | "coverClosing"
  >,
>(
  documents: T,
): LetterPageStatus => {
  const characterCount = [
    documents.coverSubject,
    documents.coverIntroduction,
    getCoverLetterMainBody(documents),
    documents.coverCompanyFit,
    documents.coverExtraParagraph,
    documents.coverClosing,
  ].reduce((total, value) => total + value.trim().length, 0);

  return {
    characterCount,
    recommendedMaximum: RECOMMENDED_LETTER_CHARACTERS,
    density:
      characterCount > RECOMMENDED_LETTER_CHARACTERS
        ? "dense"
        : characterCount > 2_500
          ? "compact"
          : "standard",
    isOverRecommendedLength: characterCount > RECOMMENDED_LETTER_CHARACTERS,
  };
};
