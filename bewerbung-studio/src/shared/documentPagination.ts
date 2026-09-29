import type { ApplicantProfile, DocumentDraft } from "./schema";
import { ensureKnowledgeSection } from "../features/knowledge/knowledge.service";
import { flattenKnowledgeNames } from "../features/knowledge/knowledge.utils";
import { getCoverLetterMainBody } from "./coverLetter";
import { getPehlioneProjectHighlight, hasPehlioneCustomProjectHighlight } from "./pehlioneContent";
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
import {
  getPaginationGeometry,
  type ItemBlockModel,
  type PaginationGeometry,
  type PaginationZone,
} from "./resumePaginationGeometry";

export type ResumePageItem =
  | { kind: "experience"; id: string; weight: number }
  | { kind: "education"; id: string; weight: number };

export type ResumePagePlan = {
  pageNumber: 1 | 2;
  /** Career items rendered on this page, in reading order. `weight` is the estimated height in mm. */
  items: ResumePageItem[];
  density: "standard" | "compact" | "dense";
  /**
   * Movable flow blocks (managed section ids such as `knowledge`, `group:*`,
   * `special:*`) that this page renders. Every block appears on exactly one page.
   */
  blocks?: string[];
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
  /** Prefer breaking between sections over breaking inside one (default). */
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
/** Share of the page a compacted single page may use. */
const COMPACT_MARGIN = 0.96;
/** Cost of choosing a compacted single page over two pages. */
const COMPACT_PAGE_COST = 0.1;
/** Comfort limits of a two-page split (share of a page): see the cost function below. */
const MIN_LAST_FILL = 0.45;
const MIN_FIRST_FILL = 0.72;
const MAX_FILL_GAP = 0.45;
const REVERSED_GAP = 0.05;
const CLOSING_MM = { signature: 22, plain: 10 };
/** Long summaries wrap a little more than the average glyph advance predicts. */
const SUMMARY_WRAP_SLACK = 1.05;
/** The managed item grids: 3 mm between columns and a 4 mm icon plus 1.5 mm gap in front of each text. */
const GRID_COLUMN_GAP_MM = 3;
const GRID_ICON_MM = 5.5;

const strip = ({ kind, id, ...item }: MeasuredItem, page: "first" | "cont"): ResumePageItem => ({ kind, id, weight: Math.round(item[page] * 10) / 10 });

type Scale = {
  font: number;
  textHeight: number;
  line: number;
  width: number;
  contWidth: number;
  marginInset: number;
  /** Measured entry height of the ATS layout relative to the visual model (1 outside ATS mode). */
  exp: number;
  edu: number;
  sectionGap?: number;
  entryGap?: number;
};

const linesFor = (chars: number, widthMm: number, fontMm: number, cw: number) =>
  chars <= 0 ? 0 : Math.max(1, Math.ceil((chars * cw * fontMm) / Math.max(widthMm, 12)));

type MeasuredItem = ResumePageItem & { first: number; cont: number; gapAfter: number };

const trimmedBullets = (experience: ApplicantProfile["experiences"][number]) =>
  experience.achievements.map((value) => value.trim()).filter(Boolean);

const experienceHeight = (
  experience: ApplicantProfile["experiences"][number],
  geometry: PaginationGeometry,
  scale: Scale,
  widthScale: number,
) => {
  const { text, exp } = geometry;
  const bullets = trimmedBullets(experience);
  const bulletLines = bullets.reduce(
    (total, bullet) => total + linesFor(bullet.length, text.bulletW * widthScale, text.bulletFont * scale.font, text.cw),
    0,
  );
  const titleLines = linesFor(experience.role.trim().length, text.titleW * widthScale, text.titleFont * scale.font, text.cw * 1.08);
  const orgLines = linesFor(experience.company.trim().length, text.orgW * widthScale, text.orgFont * scale.font, text.cw * 1.06);
  const extra = Math.max(0, titleLines - 1) + Math.max(0, orgLines - 1);
  return (
    (exp.base +
      (bullets.length ? exp.list : 0) +
      exp.perBullet * bullets.length +
      exp.linePitch * scale.line * bulletLines +
      exp.extraLine * extra) *
    scale.exp * scale.textHeight
  );
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
    let tallest = 0;
    for (const entry of entries.slice(start, start + cols)) {
      const titleLines = linesFor(entry.title.length, model.w, model.font * scale.font, model.cw);
      const description = entry.description
        ? linesFor(entry.description.length, model.w, model.font * scale.font * 0.92, model.cw) * model.pitch * 0.92 + 1
        : 0;
      tallest = Math.max(tallest, model.pad + model.pitch * scale.line * titleLines + description);
    }
    rowsHeight += tallest;
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
    ? geometry.blocks.sectionGap + sectionSpacingLevelToMm[settings.sectionSpacingLevel] - sectionSpacingLevelToMm[defaults.sectionSpacingLevel]
    : undefined);
  const single = context.atsMode || context.layout?.mode === "single";
  const factors = context.atsMode ? geometry.ats : { exp: 1, edu: 1 };
  const spacing = { sectionGap, entryGap: overrides.entryGapMm };
  if (single) {
    const width = geometry.text.atsW / geometry.text.bulletW;
    const insetWidth = Math.max(0.55, (geometry.text.atsW - 2 * marginInset) / geometry.text.atsW);
    return { font, textHeight, line, width: width * insetWidth, contWidth: width * insetWidth, marginInset, ...factors, ...spacing };
  }
  let width = 1;
  const layout = context.layout;
  if (geometry.columns === 2 && layout?.overridden && layout.nativeSidebarWidthPercent) {
    width = (100 - layout.sidebarWidthPercent) / Math.max(100 - layout.nativeSidebarWidthPercent, 1);
  }
  // Continuation pages have no sidebar: their main column spans the page.
  const contWidth = geometry.columns === 2 ? geometry.text.contW / geometry.text.bulletW : width;
  const mainInset = Math.max(0.55, (geometry.text.mainW - 2 * marginInset) / geometry.text.mainW);
  const continuationInset = Math.max(0.55, (geometry.text.contW - 2 * marginInset) / geometry.text.contW);
  return { font, textHeight, line, width: width * mainInset, contWidth: contWidth * continuationInset, marginInset, ...factors, ...spacing };
};

type SectionId = "summary" | "strengths" | "knowledge" | "languages" | "certifications" | "projects";

/** Everything except career items: estimated height, column, and the page it lives on. */
type FlowBlock = {
  id: string;
  zone: PaginationZone;
  height: number;
  home: "first" | "last";
  /** Sidebar block that may be hosted on page one instead of the last page. */
  hostable?: boolean;
  /** Height when the block flows into the full-width main column of the last page. */
  contHeight?: number;
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

  const closingVisible = context.closing?.visible ?? Boolean(profile?.resumeClosing && (profile.resumeClosing.showPlace || profile.resumeClosing.showDate || profile.resumeClosing.showSignature));
  const closingHeight = closingVisible
    ? (context.closing?.signature ?? Boolean(profile?.signaturePath && profile.resumeClosing?.showSignature))
      ? CLOSING_MM.signature
      : CLOSING_MM.plain
    : 0;

  // --- career items ---------------------------------------------------------
  const sectionGap = scale.sectionGap ?? geometry.blocks.sectionGap;
  const experienceGap = geometry.exp.gap > 0 ? (scale.entryGap ?? geometry.exp.gap) : 0;
  const educationGap = geometry.edu.gap > 0 ? (scale.entryGap ?? geometry.edu.gap) : 0;
  const items: MeasuredItem[] = [
    ...(profile?.experiences ?? []).map((experience): MeasuredItem => ({
      kind: "experience", id: experience.id, weight: 0, gapAfter: experienceGap,
      first: experienceHeight(experience, geometry, scale, scale.width),
      cont: experienceHeight(experience, geometry, scale, scale.contWidth),
    })),
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

  const sectionHead = (kind: ResumePageItem["kind"]) => (kind === "experience" ? geometry.exp.head : geometry.edu.head);
  /** Height of a run of career items on one kind of page, including one heading per section. */
  const itemsHeight = (list: readonly MeasuredItem[], page: "first" | "cont") => {
    let total = 0;
    let previousKind: string | undefined;
    list.forEach((item, index) => {
      if (item.kind !== previousKind) {
        total += (index > 0 ? sectionGap : 0) + sectionHead(item.kind);
      } else {
        total += list[index - 1].gapAfter;
      }
      total += item[page];
      previousKind = item.kind;
    });
    return total;
  };

  // --- fixed blocks -----------------------------------------------------------
  const summaryText = (resumeProfile || profile?.summary || "").trim();
  const knowledgeSection = profile ? ensureKnowledgeSection(profile.knowledgeSection, profile.skills) : undefined;
  const knowledgeNames = knowledgeSection ? flattenKnowledgeNames(knowledgeSection) : [];
  const knowledgeCategories = knowledgeSection?.categories.filter((category) => category.isVisible).length ?? 0;
  const strengthEntries: ListEntry[] = (profile?.strengths ?? [])
    .filter((entry) => entry.title.trim())
    .map((entry) => ({ title: entry.title.trim(), description: entry.description.trim() }));
  const languages = (profile?.languages ?? []).filter((entry) => entry.trim());
  const certifications = (profile?.certifications ?? []).filter((entry) => entry.trim());
  const { blocks } = geometry;
  const line = (values: [number, number], count: number) => values[0] + values[1] * count;
  const textWidth = (zone: PaginationZone) =>
    (zone === "sidebar" && !flat ? geometry.text.sideW : flat ? geometry.text.atsW : geometry.text.mainW) * scale.width;

  // Strengths and knowledge are drawn by the managed layer as an item grid. Beside a
  // sidebar the list keeps its measured narrow column; anywhere else the number of
  // columns follows the same rule as the renderer (resolveSectionColumns).
  const settings = context.settings ?? defaultDocumentDesign;
  const gridModel = (kind: "strengths" | "knowledge", entries: ListEntry[], zone: PaginationZone, page: "first" | "last"): ItemBlockModel => {
    const model = geometry.items[kind];
    if (zone === "sidebar" && !flat && page === "first") return model;
    const beside = !flat && page === "first" && geometry.columns === 2;
    const mode = kind === "strengths" ? settings.strengthsColumns : settings.knowledgeColumns;
    const cols = resolveSectionColumns(mode, templateId ?? "", "main", entries, settings, beside);
    const width = beside ? geometry.text.mainW * scale.width : geometry.text.fullW;
    return {
      ...model,
      cols,
      w: Math.max(12, (width - GRID_COLUMN_GAP_MM * (cols - 1)) / cols - (context.atsMode ? 0 : GRID_ICON_MM)),
      gap: kind === "strengths" ? 3 : 2,
    };
  };

  const flow: FlowBlock[] = [];
  if (visible("summary") && summaryText) {
    const zone = zoneOf("summary");
    const lines = linesFor(summaryText.length, textWidth(zone), geometry.text.sumFont * scale.font, geometry.text.cw * SUMMARY_WRAP_SLACK);
    flow.push({ id: "summary", zone, height: (blocks.summary[0] + blocks.summary[1] * scale.line * lines) * scale.textHeight, home: "first" });
  }
  if (visible("strengths") && strengthEntries.length) {
    const zone = zoneOf("strengths");
    flow.push({ id: "strengths", zone, height: listBlockHeight(gridModel("strengths", strengthEntries, zone, "first"), scale, strengthEntries), home: "first" });
  }
  if (visible("languages") && languages.length) {
    const zone = zoneOf("languages");
    // Languages follow the sidebar on page one; in a flat main column they close the document.
    flow.push({
      id: "languages",
      zone,
      // Long names such as “Türkisch (Muttersprache) – C2” wrap inside a narrow sidebar.
      height: (line(blocks.languages, languages.length) + languages.filter((entry) => entry.length > 22).length * geometry.exp.linePitch) * scale.textHeight,
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
      flow.push({ id: "projects", zone: "main", height: (24 + lines * geometry.exp.linePitch) * scale.textHeight, home: "last" });
    }
  }
  const knowledgeZone = zoneOf("knowledge");
  if (visible("knowledge") && knowledgeNames.length) {
    const names: ListEntry[] = knowledgeNames.map((name) => ({ title: name }));
    const extraHeadings = Math.max(0, knowledgeCategories - 1);
    flow.push({
      id: "knowledge",
      zone: knowledgeZone,
      height: listBlockHeight(gridModel("knowledge", names, knowledgeZone, "first"), scale, names, extraHeadings),
      // On the last page there is no sidebar: the list spreads over the page width.
      contHeight: listBlockHeight(gridModel("knowledge", names, knowledgeZone, "last"), scale, names, extraHeadings),
      home: "last",
      hostable: knowledgeZone === "sidebar" && !flat,
    });
  }
  const certificates = geometry.certs;
  if (visible("certifications") && certifications.length && certificates.home !== "none") {
    const shown = certifications.slice(0, certificates.limit ?? certifications.length);
    const width = flat ? geometry.text.fullW : certificates.w * (certificates.zone === "main" ? scale.width : 1);
    const wrapped = shown.reduce(
      (total, entry) => total + Math.max(0, linesFor(entry.length, width, certificates.font * scale.font, geometry.text.cw) - 1),
      0,
    );
    // A template that keeps them in its sidebar draws them on page one; flattened layouts append them.
    const zone = flat ? "main" : ((customLayout ? find("certifications")?.zone : undefined) ?? certificates.zone);
    flow.push({
      id: "certifications",
      zone,
      height: (certificates.base + certificates.perItem * shown.length + certificates.pitch * scale.line * wrapped) * scale.textHeight,
      home: flat ? "last" : certificates.home,
    });
  }
  const hostedIds: string[] = [];
  for (const special of profile?.specialSections ?? []) {
    const entry = find(`special:${special.id}`);
    if (!special.isVisible || entry?.visible === false) continue;
    const zone = entry?.zone ?? "main";
    const height = 9 + special.entries.reduce((total, item) => total + 9 + (item.description ? 3.5 : 0), 0);
    flow.push({ id: `special:${special.id}`, zone: flat ? "main" : zone, height, home: "last" });
    hostedIds.push(`special:${special.id}`);
  }
  for (const entry of context.sections ?? []) {
    if (!entry.id.startsWith("group:") || !entry.visible) continue;
    const zone = flat ? "main" : entry.zone;
    flow.push({ id: entry.id, zone, height: 30, home: "last" });
    hostedIds.push(entry.id);
  }

  // --- page geometry ----------------------------------------------------------
  const top1 = context.atsMode ? geometry.atsTop1 : geometry.top1;
  const top2 = context.atsMode ? geometry.atsTop2 : geometry.top2;
  const mainCap1 = (geometry.limit - top1 - 2 * scale.marginInset) * SAFETY;
  const mainCap2 = (geometry.limit - top2 - 2 * scale.marginInset) * SAFETY;
  const sideCap1 = geometry.sideTop1 === null || flat ? 0 : (geometry.sideLimit - geometry.sideTop1 - 2 * scale.marginInset) * SAFETY;
  const dense = geometry.density;

  const blockLoad = (blocksOfZone: FlowBlock[], zone: PaginationZone) => {
    const heights = blocksOfZone.filter((block) => block.zone === zone).map((block) => block.height);
    return sumHeights(heights, zone === "sidebar" ? blocks.sideGap : sectionGap);
  };
  const firstBlocks = flow.filter((block) => block.home === "first");
  const lastBlocks = flow.filter((block) => block.home === "last");
  const hostable = lastBlocks.filter((block) => block.hostable);

  const stack = (fixed: number, run: number) => fixed + run + (fixed > 0 && run > 0 ? sectionGap : 0);
  const wholeMain = () =>
    stack(blockLoad(firstBlocks, "main"), stack(itemsHeight(items, "first"), blockLoad(lastBlocks, "main"))) + closingHeight;
  const wholeSide = () => blockLoad([...firstBlocks, ...lastBlocks], "sidebar");

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
  const fitsCompact =
    wholeMain() * dense.compact <= mainCap1 * COMPACT_MARGIN &&
    (sideCap1 === 0 || wholeSide() * dense.compact <= sideCap1 * COMPACT_MARGIN);

  // Sidebar blocks move to page one whenever that column has room for them.
  const hostedOnFirst = new Set<string>();
  if (sideCap1) {
    let sideLoad = blockLoad(firstBlocks, "sidebar");
    for (const block of hostable) {
      const next = sideLoad + (sideLoad > 0 ? blocks.sideGap : 0) + block.height;
      if (next <= sideCap1 * SIDEBAR_HOST_SHARE) {
        hostedOnFirst.add(block.id);
        sideLoad = next;
      }
    }
  }
  const pageOneFlow = [...firstBlocks, ...lastBlocks.filter((block) => hostedOnFirst.has(block.id))];
  const pageTwoFlow = lastBlocks.filter((block) => !hostedOnFirst.has(block.id));
  // The last page has no sidebar: a sidebar block that stays there flows into the full-width main column.
  const lastMainFixed = sumHeights(pageTwoFlow.map((block) => block.contHeight ?? block.height), sectionGap);
  const load1Fixed = blockLoad(pageOneFlow, "main");
  const sideLoadOne = blockLoad(pageOneFlow, "sidebar");
  const sideFill = sideCap1 ? sideLoadOne / sideCap1 : 0;

  type Candidate = {
    count: number;
    fillOne: number;
    fillTwo: number;
    densityOne: ResumePagePlan["density"];
    densityTwo: ResumePagePlan["density"];
    cost: number;
  };
  const densityFor = (fill: number): { density: ResumePagePlan["density"]; overflow: number } => {
    if (fill <= 1) return { density: "standard", overflow: 0 };
    if (fill * dense.compact <= 1) return { density: "compact", overflow: 0 };
    return { density: "dense", overflow: Math.max(0, fill * dense.dense - 1) };
  };
  const splits = (count: number) => {
    const before = items[count - 1];
    const after = items[count];
    return Boolean(before && after && before.kind === after.kind);
  };
  const singleSide = (count: number) => {
    if (!splits(count)) return false;
    const kind = items[count].kind;
    const onFirst = items.slice(0, count).filter((item) => item.kind === kind).length;
    const onSecond = items.slice(count).filter((item) => item.kind === kind).length;
    return onFirst === 1 || onSecond === 1;
  };
  const candidates: Candidate[] = [];
  const evaluate = (count: number) => {
    const load1 = stack(load1Fixed, itemsHeight(items.slice(0, count), "first"));
    const load2 = stack(lastMainFixed, itemsHeight(items.slice(count), "cont")) + closingHeight;
    const fillOne = load1 / mainCap1;
    const fillTwo = load2 / mainCap2;
    // An overloaded sidebar shrinks the page as much as an overloaded main column.
    const one = densityFor(Math.max(fillOne, sideFill));
    const two = densityFor(fillTwo);
    const preferWhole = options.keepSectionsTogether ?? true;
    const gap = fillOne - fillTwo;
    const cost =
      1000 * (one.overflow + two.overflow) +
      (one.density === "compact" ? 0.04 : one.density === "dense" ? 0.2 : 0) +
      (two.density === "compact" ? 0.04 : two.density === "dense" ? 0.2 : 0) +
      // What a reader dislikes, in this order: an almost empty last page, a first page
      // that stops long before its end, a last page fuller than the first, and a first
      // page far fuller than the last.
      Math.max(0, MIN_LAST_FILL - fillTwo) * 3 +
      Math.max(0, MIN_FIRST_FILL - fillOne) * 1.5 +
      Math.max(0, -gap - REVERSED_GAP) * 0.6 +
      Math.max(0, gap - MAX_FILL_GAP) +
      // Zweispaltig removes the sidebar on continuation pages. Do not leave a
      // visibly empty first-page main column just to keep education together.
      (templateId === "zweispaltig" && !flat ? Math.max(0, 0.85 - fillOne) * 2.4 : 0) +
      (splits(count) ? (preferWhole ? 0.14 : 0.04) + (singleSide(count) ? 0.05 : 0) : 0);
    candidates.push({ count, fillOne, fillTwo, densityOne: one.density, densityTwo: two.density, cost });
  };
  if (forced !== undefined) evaluate(Math.min(Math.max(forced, 0), items.length));
  else for (let count = 1; count < items.length; count += 1) evaluate(count);
  // Ties go to the fuller first page.
  const best = candidates.reduce((chosen, candidate) =>
    candidate.cost < chosen.cost - 1e-9 || (Math.abs(candidate.cost - chosen.cost) <= 1e-9 && candidate.count > chosen.count)
      ? candidate
      : chosen,
  );

  if (forced === undefined && fitsCompact && COMPACT_PAGE_COST <= best.cost) return onePage("compact");

  return [
    {
      pageNumber: 1,
      items: items.slice(0, best.count).map((item) => strip(item, "first")),
      density: best.densityOne,
      blocks: pageOneFlow.filter((block) => block.home === "last").map((block) => block.id),
      sidebar: geometry.columns === 2 && !flat,
      fill: { main: best.fillOne, sidebar: sideFill },
    },
    {
      pageNumber: 2,
      items: items.slice(best.count).map((item) => strip(item, "cont")),
      density: best.densityTwo,
      blocks: pageTwoFlow.map((block) => block.id),
      // Continuation pages never keep a sidebar: what did not fit on page one flows into the main column.
      sidebar: false,
      fill: { main: best.fillTwo, sidebar: 0 },
    },
  ];
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
