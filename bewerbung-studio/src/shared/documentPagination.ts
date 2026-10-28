import type { ApplicantProfile, DocumentDraft } from "./schema";
import { ensureKnowledgeSection } from "../features/knowledge/knowledge.service";
import { formatKnowledgeItem } from "../features/knowledge/knowledge.utils";
import { educationDetailUnits, resolveEducationPresentation } from "./resumeEducation";
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
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "./cvDesign";
import { zweispaltigDefaults } from "./cvTemplateDefaults/zweispaltig.defaults";
import { tuerkisProfilDefaults } from "./cvTemplateDefaults/tuerkis-profil.defaults";
import { stilvollDefaults } from "./cvTemplateDefaults/stilvoll.defaults";
import { resolveTuerkisGeometry } from "./tuerkisProfilDesign";
import { kompaktDefaults } from "./cvTemplateDefaults/kompakt.defaults";
import { gepflegtDefaults } from "./cvTemplateDefaults/gepflegt.defaults";
import { elegantDefaults, elegantDesign } from "./cvTemplateDefaults/elegant.defaults";
import { klassischDefaults } from "./cvTemplateDefaults/klassisch.defaults";
import { einspaltigDefaults } from "./cvTemplateDefaults/einfach.defaults";
import { resolveKompaktGeometry } from "./kompaktDesign";
import { resolveGepflegtGeometry } from "./gepflegtDesign";
import { estimateKlassischHeaderTop, resolveKlassischGeometry } from "./klassischDesign";
import { einspaltigSectionTitleMm, estimateEinspaltigHeaderTop, resolveEinspaltigGeometry } from "./einspaltigDesign";
import { estimateTabellarischContinuationTop, resolveTabellarischGeometry } from "./tabellarischDesign";
import { tabellarischDefaults } from "./cvTemplateDefaults/tabellarisch.defaults";
import { textWidthMm, wrappedLines } from "./textMetrics";
import { hyphenatedSummaryLines, summaryWordEnds, summaryWrappedLines } from "./resumeSummaryHyphenation";
import { resolveSectionColumns } from "./resumeSectionLayout";
import { hasSidebarHero, isPlainListSection, isZoneFlowTemplate, sectionHeadingLineMetrics, sectionListMetrics, supportsEducationSplit, supportsSidebarContinuation } from "./resumeSectionPresentation";
import { normalizeCustomSection, spacesEntriesLikeCareer } from "./resumeCustomSections";
import { getPehlioneContacts } from "./pehlioneContacts";
import { getPersonalDataTitle, resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import {
  getPaginationGeometry,
  tabellarischAtsPaginationGeometry,
  type ItemBlockModel,
  type PaginationGeometry,
  type PaginationZone,
} from "./resumePaginationGeometry";
import { formatPhoneForDisplay, getResumeHeaderContactTexts, getResumePersonalDetails, getZweispaltigContactTexts } from "./resumePersonalData";
import { getResumePhotoGrowth, getResumePhotoScale, resumePhotoShown } from "./resumePhoto";
import { formatCareerPeriod, resolveExperience } from "./resumeCareer";
import { getResumeSectionTitle, savedTemplateSidebarOrder } from "../features/resume-sections/resume-sections";
import { estimateAtsHeaderTop, estimateElegantHeaderTop, estimateGepflegtHeaderTop, estimateKreativHeaderTop, estimateResumeHeaderTop, estimateStilvollHeaderTop, estimateTabellarischTop } from "./resumeHeaderGeometry";
import { resolveLanguagePresentation } from "../features/languages/language-levels";
import { languageBlockHeight } from "./languageBlockHeight";
import type { ResumeTextRole } from "./resumeTextRoles";
import { entryHeadDelta, nativeEntryRoleSizes, roleTextDelta, rolesBeside, type EntryHeadModel, type EntryRoleSizes } from "./resumeEntryRoleMetrics";

/**
 * Bullets `from`..`to` (exclusive, of `total`) of a career entry that continues on the next page: the bullets of an
 * experience, the detail units of an education (`educationDetailUnits`: Fachrichtung, Abschlussnote, the sentences of
 * the description).
 */
export type ResumeBulletRange = { from: number; to: number; total: number };

export type ResumePageItem =
  | { kind: "experience"; id: string; weight: number; bullets?: ResumeBulletRange }
  | { kind: "education"; id: string; weight: number; bullets?: ResumeBulletRange };

export type ResumePagePlan = {
  pageNumber: number;
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
  /**
   * One-column templates that follow the order of the section list (`orderedOneColumnTemplates`): the blocks this plan
   * places itself, the same list on every page. Each stands on the page whose `blocks` name it (`sectionOnPage`).
   */
  placed?: string[];
  /**
   * Whether this page keeps its sidebar column. Page one always does. A later page has one when sidebar content
   * of the user's layout is still pending (only templates with `supportsSidebarContinuation`); otherwise the
   * sidebar sections that did not fit on page one flow into the main column of the last page.
   */
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
  closing?: { visible: boolean; signature: boolean; placement?: "footer" | "main" };
  /** Explicit user design overrides that change text or spacing metrics. */
  overrides?: {
    bodySizePt?: number; headingSizePt?: number; subheadingSizePt?: number;
    /** Size of an entry title where the template sets it from the design (Tabellarisch). */
    entryHeadingPt?: number;
    /** The CV font (Typografie → Schriftart) and section title size where a template wraps text with measured advances (`text.wrap`). */
    fontId?: string; sectionHeadingPt?: number;
    lineHeight?: number; pageMarginMm?: number; innerPaddingMm?: number;
    sectionGapMm?: number; entryGapMm?: number;
    /** Lebenslauf-Design → Erweiterte Abstände: "Abstand nach Abschnittstitel", "Abstand nach Eintragstitel", "Spaltenabstand". */
    sectionTitleGapMm?: number; entryContentGapMm?: number; columnGapMm?: number;
    /**
     * Lebenslauf-Design → Typografie: the sizes (pt) the user chose for the entry roles (Eintragstitel, Datum / Zeitraum,
     * Unternehmen / Einrichtung, Ort / Standort, Projekttechnologien, Projektbeschreibung); only the chosen ones.
     */
    entryRoleSizes?: Partial<Record<ResumeTextRole, number>>;
  };
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
/** What Gepflegt's computed header keeps in reserve (sub-pixel rounding of the line boxes). */
const GEPFLEGT_HEADER_RESERVE_MM = 0.5;
/**
 * What a Gepflegt continuation sidebar keeps free below its estimated sections: the wrap estimate of a narrow sidebar
 * (Seitenränder 20–30 mm) ran up to 4.8 mm long on 40 random documents once the page cue alone stood above them.
 */
const GEPFLEGT_CONTINUATION_SIDE_RESERVE_MM = 5;
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
/** An education entry may stand on a page with its header and a single detail line (Abschlussnote): the rest goes on. */
const minLinesBefore = (kind: string) => (kind === "education" ? 1 : MIN_SPLIT_LINES);
/**
 * A sidebar section that breaks between two pages keeps its heading and at least this many rows on the page it
 * starts on (never a heading alone) and leaves at least this many on the next one (never a single stray row).
 */
const LANE_MIN_ROWS_BEFORE = 1;
const LANE_MIN_ROWS_AFTER = 2;
const CLOSING_MM = { signature: 22, plain: 10 };
/** Elegant's sidebar title: 1.6 mm padding, the rule (one CSS pixel) and 2.4 mm gap below its text line (elegantManagedCss). */
const ELEGANT_SIDE_HEADING_CHROME_MM = 1.6 + 25.4 / 96 + 2.4;
/** Elegant's sidebar keeps this much free at its bottom for the rounding of line boxes (its blocks are computed exactly). */
const ELEGANT_SIDE_RESERVE_MM = 0.8;
/** Elegant's sidebar languages: free at the right edge, the dots beside the name, the description gap, the row gap. */
const ELEGANT_LANGUAGE_EDGE_MM = 5.3;
const ELEGANT_LANGUAGE_DOTS_MM = 6.55 + 1.5;
const ELEGANT_LANGUAGE_DESCRIPTION_GAP_MM = 0.6;
const ELEGANT_LANGUAGE_ROW_GAP_MM = 2;
/** Elegant's sidebar knowledge: below a category title, between two items, between two categories. */
const ELEGANT_KNOWLEDGE_TITLE_GAP_MM = 1.5;
const ELEGANT_KNOWLEDGE_ITEM_GAP_MM = 2;
const ELEGANT_KNOWLEDGE_CATEGORY_GAP_MM = 3;
/** A Kurzprofil part in Elegant's sidebar lane holds at least this many words (about two lines). */
const ELEGANT_SUMMARY_MIN_WORDS = 10;
/** What Elegant's sidebar list takes off the column. */
const ELEGANT_SIDE_LIST_INDENT_MM = 4;
/** What Tabellarisch's page-one header estimate keeps in reserve (its model never fell short on real headers). */
const TABELLARISCH_HEADER_RESERVE_MM = 0.3;
/**
 * The shared closing block (resumeClosingCss): 2 mm padding above a 9 pt line (line height 1.25) or the signature (an image
 * of at most 14 mm and the 8 pt name); in the footer 12 mm above the sheet edge, in the main column 5 mm below the text.
 */
const CLOSING_BOX = { bottomMm: 12, paddingMm: 2, lineMm: 9 * (25.4 / 72) * 1.25, signatureMm: 14 + 8 * (25.4 / 72) * 1.25, mainGapMm: 5, clearanceMm: 2 };
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
  // LinkedIn, GitHub and the website are three contacts (`getResumeLinkContacts`), one line each when stacked.
  const web = [profile.github, profile.portfolio];
  const details = getResumePersonalDetails(profile).length;
  return [profile.phone, profile.email, profile.linkedin, ...web].filter(filled).length + Number(location) + Number(birth) + details;
};

/** The template's own space between two sections; the plain (ATS) layout may differ from the styled one. */
const nativeSectionGapOf = (geometry: PaginationGeometry, atsMode?: boolean) =>
  (atsMode ? geometry.ats.sectionGap : undefined) ?? geometry.blocks.sectionGap;

const strip = ({ kind, id, ...item }: MeasuredItem, page: "first" | "cont"): ResumePageItem => ({ kind, id, weight: Math.round(item[page] * 10) / 10 });

type Scale = {
  /** Wrap real text with the measured font advances (`geometry.text.wrap`, the template's own font, not ATS). */
  wrapText?: boolean;
  /** Font (mm) of an entry title where it keeps its own size whatever the body size is (Tabellarisch). */
  titleFont?: number;
  /** `text.fullW` relative to its measured width: a template whose sidebar lane narrows every page with the margin. */
  fullRatio?: number;
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
  /** What every career entry of the plain layout adds inside its box (`ats.entryPad`). */
  entryPad?: number;
  /** The plain layout's career bullets where they are wrapped exactly (`ats.bullet`). */
  bullet?: { w: number; font: number; pitch?: number; gap: number };
  sectionGap?: number;
  entryGap?: number;
  /**
   * What the central spacing adds to (or takes from) the template's native value, in mm: below a section title, below an
   * entry title, and between the two columns (which narrows the main column). Zero without an override.
   */
  titleGapDelta: number;
  contentGapDelta: number;
  columnGapDelta: number;
  /** The entry-role sizes (native and chosen) and the head of a career entry they change; no `roles` without a choice. */
  roles?: EntryRoleSizes;
  entryHead?: EntryHeadModel;
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
  /** Height of the entry where page one draws it in the sidebar (Türkis Profil's Bildungsweg). */
  side?: number;
};

/**
 * Lines of an entry wrapped with the measured font (`geometry.text.wrap`): the title beside its date, the organisation
 * beside its place, the place itself (it wraps beyond `metaMaxWidth`) and every detail line in the bullet column.
 */
const measuredEntryLines = (
  geometry: PaginationGeometry, scale: Scale, widthScale: number,
  title: string, organization: string, location: string, period: string, details: readonly string[],
  /** The part of an entry that goes on from the page before: its title ends with the "· Fortsetzung" marker. */
  continued = false,
) => {
  const wrap = geometry.text.wrap;
  if (!wrap || !scale.wrapText) return undefined;
  const titleMm = scale.titleFont ?? geometry.text.titleFont * scale.font;
  // The marker (resumeEntrySplitCss): 0.45 em margin, then the text at 0.72 em, weight 500, 0.02 em letter-spacing, no wrap.
  const marker = continued && wrap.marker ? 0.45 * titleMm + textWidthMm("· Fortsetzung", 0.72 * titleMm, 500, 0.02) : 0;
  const bulletWidth = geometry.text.bulletW * widthScale;
  const column = bulletWidth + wrap.listInset;
  const bodyMm = geometry.text.bulletFont * scale.font;
  const metaMm = Math.max(wrap.metaMinPt * PT_TO_MM, bodyMm * wrap.metaRatio);
  // A template with a fixed date/place column (`metaColumn`) keeps it beside every title, whatever the date says.
  const meta = (value: string) => wrap.metaColumn !== undefined ? wrap.metaColumn + wrap.metaGap
    : value ? Math.min(wrap.metaMaxWidth, textWidthMm(value, metaMm)) + wrap.metaGap : 0;
  return {
    title: Math.max(1, wrappedLines(title, column - meta(period), titleMm, wrap.titleWeight, 0, marker)),
    org: organization ? Math.max(1, wrappedLines(organization, column - meta(location), geometry.text.orgFont * scale.font, wrap.orgWeight)) : 1,
    location: location ? Math.max(1, wrappedLines(location, wrap.metaMaxWidth, metaMm)) : 1,
    details: details.map((detail) => wrappedLines(detail, bulletWidth, bodyMm, wrap.bodyWeight)),
  };
};

/**
 * A grid entry (`geometry.gridEntry`, Türkis Profil) from its stylesheet: the title row, the organisation row (where there
 * is an organisation or a place), and the list of the shown details (`lines` per paragraph), the padding below.
 */
const gridEntryHeight = (
  geometry: PaginationGeometry, scale: Scale, titleLines: number, organisationRow: boolean, lines: readonly number[],
) => {
  const grid = geometry.gridEntry!;
  const bodyMm = geometry.text.bulletFont * scale.font;
  const titleMm = scale.titleFont ?? geometry.text.titleFont;
  const list = lines.length
    ? grid.rowGap + grid.listTop + grid.itemMargin * (lines.length + 1)
      + lines.reduce((total, value) => total + value, 0) * bodyMm * geometry.text.lineRatio * scale.line
    : 0;
  return titleLines * titleMm * grid.titleLineHeight
    + (organisationRow ? grid.rowGap + bodyMm * grid.orgLineHeight : 0)
    + list + grid.padBottom + scale.contentGapDelta;
};

/**
 * A timeline entry (`geometry.timeline`, Tabellarisch) from its stylesheet, every text wrapped with the measured font: the
 * text column (role at the entry title size, the Abstand nach Eintragstitel, organisation, the gap below it, then the
 * details `bulletGap` apart: the first one's margin hides in that gap, the last one's stays) beside the date column (date,
 * place). The entry is as tall as the taller column; every part of a split entry repeats the head.
 */
const timelineMetrics = (
  geometry: PaginationGeometry, scale: Scale, widthScale: number,
  head: { title: string; organization: string; location: string; period: string },
  /** The detail paragraphs (bullets) and the text of a range of them (an education detail joins its units). */
  details: readonly string[], shownTexts: (from: number, to: number) => string[],
): EntryMetrics => {
  const timeline = geometry.timeline!;
  const wrap = geometry.text.wrap!;
  const column = geometry.text.bulletW * widthScale + wrap.listInset;
  const bodyMm = geometry.text.bulletFont * scale.font;
  const bodyLine = bodyMm * geometry.text.lineRatio * scale.line;
  const titleMm = scale.titleFont ?? geometry.text.titleFont;
  // The organisation, the date and the place at the sizes the user chose (Typografie → Größen in Einträgen).
  const orgMm = chosenRoleMm(scale, "organization", geometry.text.orgFont);
  const dateFont = chosenRoleMm(scale, "period", timeline.dateFont);
  const locationFont = chosenRoleMm(scale, "location", timeline.locationFont);
  const marker = wrap.marker ? 0.45 * titleMm + textWidthMm("· Fortsetzung", 0.72 * titleMm, 500, 0.02) : 0;
  const titleHeight = (continued: boolean) => Math.max(1, wrappedLines(head.title, column, titleMm, wrap.titleWeight, 0, continued ? marker : 0))
    * titleMm * timeline.roleLineHeight;
  const contentGap = Math.max(0, (resolveTemplateCvDesign("tabellarisch").spacing.entryContentGapMm) + scale.contentGapDelta);
  // An empty organisation still draws its margins: they collapse into the larger one.
  const organization = head.organization.trim()
    ? contentGap + Math.max(1, wrappedLines(head.organization, column, orgMm, wrap.orgWeight)) * orgMm * timeline.orgLineHeight + timeline.orgGapAfter
    : Math.max(contentGap, timeline.orgGapAfter);
  const meta = timeline.metaPad
    + (head.period.trim() ? Math.max(1, wrappedLines(head.period, timeline.metaWidth, dateFont, timeline.dateWeight)) * dateFont * timeline.dateLineHeight : 0)
    + (head.location.trim() ? timeline.locationGap + Math.max(1, wrappedLines(head.location, timeline.metaWidth, locationFont)) * locationFont * timeline.locationLineHeight : 0);
  const bulletWidth = geometry.text.bulletW * widthScale;
  const lines = details.map((detail) => wrappedLines(detail, bulletWidth, bodyMm, wrap.bodyWeight));
  const height = (from: number, to: number) => {
    const shown = shownTexts(from, to);
    const text = titleHeight(from > 0) + organization
      + shown.reduce((total, value) => total + wrappedLines(value, bulletWidth, bodyMm, wrap.bodyWeight) * bodyLine + timeline.bulletGap, 0);
    return Math.max(text, meta);
  };
  return { lines, height };
};

/** The padding a list item of a grid entry takes off its text column (zweispaltig li: padding-left 0.3 mm). */
const GRID_ITEM_PADDING_MM = 0.3;

/**
 * What the chosen entry-role sizes add to (or take from) the head of a career entry: its rows as the template draws them
 * (`geometry.entryHead`), every text wrapped at its own size. Zero without a chosen size, so the plan stays as it was.
 */
const roleHeadDelta = (
  geometry: PaginationGeometry, scale: Scale, widthScale: number, texts: Partial<Record<ResumeTextRole, string>>,
) => {
  const { roles, entryHead: head } = scale;
  if (!roles || !head) return 0;
  const { text } = geometry;
  const wrap = text.wrap;
  const weights: Partial<Record<ResumeTextRole, number>> = { "entry-title": wrap?.titleWeight ?? 600, organization: wrap?.orgWeight ?? 600 };
  // What a date or a place beside a title or an organisation takes off its line (it never wraps itself).
  const besideMm = (role: ResumeTextRole, pt: number) => texts[role]?.trim()
    ? Math.min(wrap?.metaMaxWidth ?? Infinity, textWidthMm(texts[role]!.trim(), pt * PT_TO_MM, weights[role] ?? 400)) + (wrap?.metaGap ?? 2) : 0;
  const width = (role: ResumeTextRole, sizeOf: (role: ResumeTextRole) => number) => {
    if (role === "period") return undefined;
    const own = role === "entry-title" ? text.titleW : text.orgW;
    if (role === "location") return Math.min(wrap?.metaMaxWidth ?? 45, own * widthScale);
    const beside = head.fixedCells ? [] : rolesBeside(head, role).filter((other) => other === "period" || other === "location");
    const besideWidth = (sizeOfRole: (role: ResumeTextRole) => number) => Math.max(0, ...beside.map((other) => besideMm(other, sizeOfRole(other))));
    // With the measured column (`text.wrap`) the line is the column less what stands beside it; otherwise the calibrated
    // width already leaves room for a date at the template's size, and only a larger one takes more.
    return wrap ? text.bulletW * widthScale + wrap.listInset - besideWidth(sizeOf)
      : own * widthScale - Math.max(0, besideWidth(sizeOf) - besideWidth((other) => roles.native[other]));
  };
  return entryHeadDelta(head, roles, texts, width, (value, columnMm, fontMm, role) => wrappedLines(value, columnMm, fontMm, weights[role] ?? 400));
};

/** The chosen size (mm) of a role, or `fallback` (the measured model) while the user keeps the template's. */
const chosenRoleMm = (scale: Scale, role: ResumeTextRole, fallback: number) => {
  const chosen = scale.roles?.chosen[role];
  return chosen === undefined || chosen === scale.roles?.native[role] ? fallback : chosen * PT_TO_MM;
};

const experienceMetrics = (
  experience: ApplicantProfile["experiences"][number],
  geometry: PaginationGeometry,
  scale: Scale,
  widthScale: number,
  /** Page one (beside the sidebar) or a continuation page. */
  first = false,
): EntryMetrics => {
  const { text, exp } = geometry;
  const resolved = resolveExperience(experience);
  const bullets = resolved.bullets;
  if (geometry.timeline && scale.wrapText)
    return timelineMetrics(geometry, scale, widthScale, { title: resolved.role, organization: resolved.organization, location: resolved.location, period: resolved.period },
      bullets, (from, to) => bullets.slice(from, to));
  const bulletCw = first
    ? (text.bulletCw ?? text.cw) * (1 + Math.max(0, 1 - widthScale) * (text.bulletNarrowSlack ?? 0))
    : text.cw;
  const measured = measuredEntryLines(geometry, scale, widthScale, resolved.role, resolved.organization, resolved.location, resolved.period, bullets);
  // A grid entry's bullets wrap at spaces and hyphens in the column less the item padding. (Hyphenated lines would be
  // tighter, but Chromium hyphenates fewer words than the German patterns allow: measured, they under-count 3 % of the
  // bullets, the plain wrap none.)
  const lines = scale.bullet
    ? bullets.map((bullet) => wrappedLines(bullet, scale.bullet!.w * scale.mainRatio, scale.bullet!.font * scale.font))
    : geometry.gridEntry && measured
    ? bullets.map((bullet) => wrappedLines(bullet, text.bulletW * widthScale - GRID_ITEM_PADDING_MM, text.bulletFont * scale.font, geometry.text.wrap!.bodyWeight))
    : measured?.details ?? bullets.map((bullet) => linesFor(bullet.length, text.bulletW * widthScale, text.bulletFont * scale.font, bulletCw));
  const titleLines = measured?.title ?? linesFor(resolved.role.length, text.titleW * widthScale, text.titleFont * scale.font, text.cw * 1.08);
  const orgLines = measured?.org ?? linesFor(resolved.organization.length, text.orgW * widthScale, text.orgFont * scale.font, text.cw * 1.06);
  const extra = Math.max(0, titleLines - 1) + Math.max(0, orgLines - 1) + Math.max(0, (measured?.location ?? 1) - 1);
  // A continued part's title may take one more line for its marker.
  const continuedTitle = geometry.text.wrap?.marker
    ? measuredEntryLines(geometry, scale, widthScale, resolved.role, resolved.organization, resolved.location, resolved.period, [], true)?.title
    : undefined;
  const continuedExtra = extra + Math.max(0, (continuedTitle ?? titleLines) - titleLines);
  // Every part repeats the head: the chosen role sizes change each of them alike.
  const roleDelta = roleHeadDelta(geometry, scale, widthScale,
    { "entry-title": resolved.role, organization: resolved.organization, period: resolved.period, location: resolved.location });
  if (geometry.gridEntry && measured) {
    // The organisation keeps one line beside its place (the measured column); a wrapped one adds its lines.
    const organisationRow = Boolean(resolved.organization || resolved.location);
    return { lines, height: (from, to) => gridEntryHeight(geometry, scale, from > 0 ? continuedTitle ?? titleLines : titleLines,
      organisationRow, lines.slice(from, to)) + Math.max(0, orgLines - 1) * geometry.text.bulletFont * scale.font * geometry.gridEntry!.orgLineHeight + roleDelta };
  }
  // Every part of an entry repeats the header (dates, role, company); only the bullets are shared out.
  const height = (from: number, to: number) => {
    const shown = lines.slice(from, to);
    return (
      (exp.base + scale.contentGapDelta +
        (shown.length ? exp.list : 0) +
        (scale.bullet?.gap ?? exp.perBullet) * shown.length +
        (scale.bullet?.pitch ?? exp.linePitch) * scale.line * shown.reduce((total, value) => total + value, 0) +
        exp.extraLine * (from > 0 ? continuedExtra : extra)) *
      scale.exp * scale.textHeight + roleDelta + (scale.entryPad ?? 0)
    );
  };
  return { lines, height };
};

/**
 * An education entry as the page planner sees it: the header (Abschluss, Institution, Zeitraum, Ort) stays together, the
 * details behind it are units a page break may fall between (see `educationDetailUnits`). `lines` are the text lines of
 * every unit, `height(from, to)` the height of the entry with the units `from`..`to` (every part repeats the header; the
 * sentences of the description share their lines like one paragraph). The whole entry is `height(0, lines.length)`.
 */
const educationMetrics = (
  education: ApplicantProfile["education"][number],
  geometry: PaginationGeometry,
  scale: Scale,
  widthScale: number,
  visibility: unknown,
  /** Page one (beside the sidebar) or a continuation page. */
  first: boolean,
): EntryMetrics => {
  const { text, edu } = geometry;
  const detailCw = first ? edu.detailCw ?? text.cw : text.cw;
  const view = resolveEducationPresentation(education, visibility);
  const measured = measuredEntryLines(geometry, scale, widthScale, view.title, view.institution, view.location, formatCareerPeriod(view.from, view.to), []);
  const titleLines = measured?.title ?? linesFor(view.title.length, text.titleW * widthScale, text.titleFont * scale.font, text.cw * 1.08);
  const orgLines = measured?.org ?? linesFor(view.institution.length, text.orgW * widthScale, text.orgFont * scale.font, text.cw * 1.06);
  const locationLines = measured ? measured.location : view.location ? linesFor(view.location.length, text.orgW * widthScale, text.orgFont * scale.font, text.cw) : 0;
  const units = educationDetailUnits(view.details, view.descriptionIndex);
  /** The units `from`..`to` as the paragraphs they print: the units of one detail are one paragraph. */
  const paragraphs = (from: number, to: number) => units.slice(from, to).reduce<string[]>((total, unit, index, shown) => {
    if (index > 0 && shown[index - 1].detail === unit.detail) total[total.length - 1] += ` ${unit.text}`;
    else total.push(unit.text);
    return total;
  }, []);
  if (geometry.timeline && scale.wrapText) {
    const metrics = timelineMetrics(geometry, scale, widthScale, { title: view.title, organization: view.institution, location: view.location,
      period: formatCareerPeriod(view.from, view.to) }, units.map((unit) => unit.text), paragraphs);
    return metrics;
  }
  const detailWidth = text.bulletW * widthScale;
  const detailFont = text.bulletFont * scale.font;
  /** Lines of a detail text: wrapped with the measured font where the template has one. */
  const detailLinesOf = (value: string) => geometry.gridEntry && measured
    ? wrappedLines(value, detailWidth - GRID_ITEM_PADDING_MM, detailFont, geometry.text.wrap!.bodyWeight)
    : measured
    ? wrappedLines(value, detailWidth, detailFont, geometry.text.wrap!.bodyWeight)
    : linesFor(value.length, detailWidth, detailFont, detailCw);
  const lines = units.map((unit) => detailLinesOf(unit.text));
  const header = edu.extraLine * (Math.max(0, titleLines - 1) + Math.max(0, orgLines - 1) + Math.max(0, locationLines - 1));
  // A continued part's title may take one more line for its "· Fortsetzung" marker.
  const continuedTitle = geometry.text.wrap?.marker
    ? measuredEntryLines(geometry, scale, widthScale, view.title, view.institution, view.location, formatCareerPeriod(view.from, view.to), [], true)?.title
    : undefined;
  const continuedHeader = header + edu.extraLine * Math.max(0, (continuedTitle ?? titleLines) - titleLines);
  const roleDelta = roleHeadDelta(geometry, scale, widthScale,
    { "entry-title": view.title, organization: view.institution, period: formatCareerPeriod(view.from, view.to), location: view.location });
  if (geometry.gridEntry && measured) {
    const organisationRow = Boolean(view.institution || view.location);
    return { lines, height: (from, to) => gridEntryHeight(geometry, scale, from > 0 ? continuedTitle ?? titleLines : titleLines,
      organisationRow, paragraphs(from, to).map(detailLinesOf))
      + Math.max(0, orgLines - 1) * geometry.text.bulletFont * scale.font * geometry.gridEntry!.orgLineHeight + roleDelta };
  }
  const height = (from: number, to: number) => {
    const shown = units.slice(from, to);
    // the units of one detail are one paragraph: its lines are counted on the joined text
    const details = shown.reduce<string[]>((total, unit, index) => {
      if (index > 0 && shown[index - 1].detail === unit.detail) total[total.length - 1] += ` ${unit.text}`;
      else total.push(unit.text);
      return total;
    }, []);
    const detailLines = details.reduce((sum, value) => sum + detailLinesOf(value), 0);
    const list = details.length ? edu.detailList ?? 0 : 0;
    return (edu.base + (details.length ? edu.detailBase ?? 0 : 0) + scale.contentGapDelta + list + (from > 0 ? continuedHeader : header)
      + (edu.detailLine ?? edu.extraLine) * detailLines + (edu.detailItem ?? 0) * details.length) * scale.edu * scale.textHeight + roleDelta
      + (scale.entryPad ?? 0);
  };
  return { lines, height };
};

type ListEntry = { title: string; description?: string };

/** Height of one grid row: the tallest of its items (a wrapped title costs another line). */
const rowHeight = (model: ItemBlockModel, scale: Scale, row: ReadonlyArray<ListEntry>) => {
  let tallest = 0;
  // With measured text (`text.wrap`) the item and its description wrap like the browser sets them.
  const lines = (text: string, fontMm: number, weight: number) => scale.wrapText
    ? Math.max(1, wrappedLines(text, model.w, fontMm, weight))
    : linesFor(text.length, model.w, fontMm, model.cw);
  for (const entry of row) {
    const titleLines = lines(entry.title, model.font * scale.font, model.titleWeight ?? 400);
    const description = entry.description
      ? lines(entry.description, model.font * scale.font * (model.descRatio ?? 0.92), 400) * (model.descPitch ?? model.pitch * 0.92) + 1
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
  const textHeight = templateId === "kreativ" || templateId === "kompakt" || templateId === "elegant"
    ? font : Math.max(1, Math.pow(font, 1.3));
  const line = overrides.lineHeight
    ? bounded(overrides.lineHeight, geometry.text.lineRatio) / geometry.text.lineRatio
    : settings ? lineHeightLevelToValue[settings.lineHeightLevel] / lineHeightLevelToValue[defaults.lineHeightLevel] : 1;
  const defaultMargin = marginLevelToMm[defaults.marginLevel];
  const legacyMargin = settings && legacyMarginTemplates.has(templateId ?? "")
    ? marginLevelToMm[settings.marginLevel] - defaultMargin : 0;
  // A chosen margin moves the template's own margin (typed in its native design) on every side alike.
  const nativeMargin = templateId ? resolveTemplateCvDesign(templateId).spacing.pageMarginMm : defaultMargin;
  // Gepflegt places its margin itself (resolveGepflegtGeometry, horizontal only; the plain layout keeps its own box).
  const marginInset = templateId === "gepflegt" ? 0 : overrides.pageMarginMm !== undefined
    ? overrides.pageMarginMm - nativeMargin : legacyMargin;
  const nativePadding = templateId ? resolveTemplateCvDesign(templateId).spacing.innerPaddingMm : 0;
  const textInset = marginInset + (overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0);
  // Türkis Profil draws its own section gap whatever the legacy spacing level says (only the design's value reaches it).
  const sectionGap = overrides.sectionGapMm ?? (settings && settings.sectionSpacingLevel !== defaults.sectionSpacingLevel && templateId !== "tuerkis-profil"
    ? nativeSectionGapOf(geometry, context.atsMode) + sectionSpacingLevelToMm[settings.sectionSpacingLevel] - sectionSpacingLevelToMm[defaults.sectionSpacingLevel]
    : undefined);
  const single = context.atsMode || context.layout?.mode === "single";
  const factors = context.atsMode ? geometry.ats : { exp: 1, edu: 1 };
  // The central spacing replaces the native value: the planner measures with the difference.
  const nativeSpacing = templateId ? resolveTemplateCvDesign(templateId).spacing : undefined;
  const delta = (override: number | undefined, native: number | undefined) =>
    override !== undefined && native !== undefined ? override - native : 0;
  const spacing = {
    sectionGap, entryGap: overrides.entryGapMm,
    titleGapDelta: delta(overrides.sectionTitleGapMm, nativeSpacing?.sectionTitleGapMm),
    contentGapDelta: delta(overrides.entryContentGapMm, nativeSpacing?.entryContentGapMm),
    columnGapDelta: single || geometry.columns !== 2 ? 0 : delta(overrides.columnGapMm, nativeSpacing?.columnGapMm),
  };
  if (templateId === "klassisch" || templateId === "einspaltig") {
    // The geometry the preview and the PDF draw (resolveKlassischGeometry / resolveEinspaltigGeometry): Seitenränder moves
    // only the left and right edge, so the text column narrows or widens and the top and bottom of the page stay (no
    // vertical inset). Only the Innenabstand insets the sections on every side (the shared spacing CSS pads the first and
    // the last one).
    const box = templateId === "klassisch" ? resolveKlassischGeometry(overrides.pageMarginMm) : resolveEinspaltigGeometry(overrides.pageMarginMm);
    const padding = overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0;
    // The plain layout sets Arial: its lines are wrapped on a slightly narrower column (`wrap.atsWidth`).
    const textWidth = Math.max(24, box.contentWidth - 2 * padding) * (context.atsMode ? geometry.text.wrap?.atsWidth ?? 1 : 1);
    const ratio = textWidth / geometry.text.mainW;
    const bullets = Math.max(0.2, (textWidth - (geometry.text.mainW - geometry.text.bulletW)) / geometry.text.bulletW);
    // Einspaltig: a section title of another size (Typografie → Abschnittstitel) changes the height of every titled block
    // like the gap below it does.
    const headingDelta = templateId === "einspaltig" && overrides.sectionHeadingPt !== undefined
      ? einspaltigSectionTitleMm(overrides.sectionHeadingPt) - einspaltigSectionTitleMm(einspaltigDefaults.typography.sectionHeadingSizePt) : 0;
    // Einspaltig: the organisation row of an entry head is set at the body line height, so another Zeilenhöhe changes it.
    const organizationDelta = templateId === "einspaltig" ? (line - 1) * geometry.text.bulletFont * font * geometry.text.lineRatio : 0;
    return { font, textHeight, line, width: bullets, contWidth: bullets, mainRatio: ratio, sideDelta: 0,
      marginInset: padding, fullRatio: ratio, ...factors, ...spacing, titleGapDelta: spacing.titleGapDelta + headingDelta,
      contentGapDelta: spacing.contentGapDelta + organizationDelta };
  }
  if (templateId === "tabellarisch" && !context.atsMode) {
    // The geometry the preview and the PDF draw (resolveTabellarischGeometry): Seitenränder moves the left and right edge,
    // so the timeline column narrows or widens; top and bottom stay (no vertical inset). The Innenabstand insets the text.
    const box = resolveTabellarischGeometry(overrides.pageMarginMm);
    const padding = overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0;
    const bullets = Math.max(0.2, (box.bulletWidth - 2 * padding) / geometry.text.bulletW);
    const ratio = Math.max(0.2, (box.contentWidth - 2 * padding) / geometry.text.mainW);
    return { font, textHeight, line, width: bullets, contWidth: bullets, mainRatio: ratio, sideDelta: 0,
      marginInset: padding, fullRatio: ratio, ...factors, ...spacing,
      titleFont: (overrides.entryHeadingPt ?? tabellarischDefaults.typography.entryTitleSizePt) * PT_TO_MM };
  }
  if (templateId === "tuerkis-profil") {
    // Türkis Profil's DIN page (resolveTuerkisGeometry): Seitenränder moves only the side edges (no vertical inset), the
    // type comes from the design alone (the legacy size sliders never reach it), the left column keeps 40 % of the width.
    const box = resolveTuerkisGeometry(overrides.pageMarginMm, overrides.columnGapMm);
    const ownFont = bounded(overrides.bodySizePt, nativePt) / nativePt;
    const ownLine = bounded(overrides.lineHeight, geometry.text.lineRatio) / geometry.text.lineRatio;
    const ownHeight = Math.max(1, Math.pow(ownFont, 1.3));
    const padding = overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0;
    const listInset = geometry.text.wrap?.listInset ?? 4.5;
    const fullTextWidth = Math.max(12, box.contentWidth - 2 * padding);
    if (single) {
      return { font: ownFont, textHeight: ownHeight, line: ownLine, width: fullTextWidth / geometry.text.bulletW, contWidth: fullTextWidth / geometry.text.bulletW,
        mainRatio: fullTextWidth / geometry.text.atsW, sideDelta: 0, marginInset: padding, ...factors, ...spacing };
    }
    const mainTextWidth = Math.max(12, box.mainWidth - 2 * padding);
    return { font: ownFont, textHeight: ownHeight, line: ownLine,
      // The entry title keeps its own size whatever the text size is.
      titleFont: (overrides.entryHeadingPt ?? tuerkisProfilDefaults.typography.entryTitleSizePt) * PT_TO_MM,
      width: Math.max(0.5, (mainTextWidth - listInset) / geometry.text.bulletW),
      contWidth: (fullTextWidth - listInset) / geometry.text.bulletW,
      mainRatio: mainTextWidth / geometry.text.mainW,
      fullRatio: fullTextWidth / geometry.text.fullW,
      sideDelta: box.sideWidth - 2 * padding - geometry.text.sideW,
      marginInset: 0, ...factors, ...spacing };
  }
  if (templateId === "zweispaltig") {
    const native = zweispaltigDefaults.layout;
    const chosenMargin = overrides.pageMarginMm ?? (settings && settings.marginLevel !== defaults.marginLevel
      ? marginLevelToMm[settings.marginLevel] : undefined);
    const contentWidth = zweispaltigDefaults.page.widthMm
      - 2 * (chosenMargin ?? native.marginLeftMm);
    const padding = overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0;
    if (single) {
      const textWidth = Math.max(12, contentWidth - 2 * padding);
      const width = textWidth / geometry.text.bulletW;
      return { font, textHeight, line, width, contWidth: width,
        mainRatio: textWidth / geometry.text.atsW, sideDelta: 0, marginInset: padding, ...factors, ...spacing };
    }
    const gap = overrides.columnGapMm ?? native.columnGapMm;
    const sidebarRatio = (context.layout?.sidebarWidthPercent ?? native.rightColumnRatio * 100) / 100;
    const mainWidth = (contentWidth - gap) * (1 - sidebarRatio);
    const sideWidth = (contentWidth - gap) * sidebarRatio;
    const mainTextWidth = Math.max(12, mainWidth - 2 * padding);
    const fullTextWidth = Math.max(12, contentWidth - 2 * padding);
    return { font, textHeight, line,
      width: Math.max(0.5, (mainTextWidth - 4.8) / geometry.text.bulletW),
      contWidth: fullTextWidth / geometry.text.bulletW,
      mainRatio: mainTextWidth / geometry.text.mainW,
      sideDelta: sideWidth - 2 * padding - geometry.text.sideW,
      marginInset: padding, ...factors, ...spacing };
  }
  if (templateId === "kompakt" && !single) {
    // The same geometry the preview and the PDF draw (resolveKompaktGeometry): Seitenränder only moves the left and right
    // edges, so the columns get narrower or wider and the top of the page stays where it is (no vertical inset).
    const native = kompaktDefaults;
    const kompakt = resolveKompaktGeometry(
      overrides.pageMarginMm ?? native.page.marginLeftMm + legacyMargin,
      overrides.columnGapMm ?? native.layout.columnGapMm,
      context.layout?.overridden ? (context.layout.sidebarWidthPercent ?? 38) / 100 : undefined,
    );
    const padding = overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0;
    const mainWidth = Math.max(12, kompakt.mainWidth - 2 * padding);
    const sideWidth = Math.max(12, kompakt.sideWidth - 2 * padding);
    const fullWidth = Math.max(24, kompakt.contentWidth - 2 * padding);
    return { font, textHeight, line,
      width: Math.max(0.5, (mainWidth - 4.8) / geometry.text.bulletW),
      contWidth: fullWidth / geometry.text.bulletW,
      mainRatio: mainWidth / geometry.text.mainW,
      sideDelta: sideWidth - geometry.text.sideW,
      marginInset: 0, ...factors, ...spacing };
  }
  if (templateId === "gepflegt" && !single) {
    // The geometry the preview and the PDF draw: Seitenränder moves the left edge of the sidebar text and the right edge
    // of the main text, Spaltenabstand the main text's distance to the sidebar. Top and bottom never move.
    const gepflegt = resolveGepflegtGeometry(
      overrides.pageMarginMm ?? gepflegtDefaults.main.paddingRightMm,
      overrides.columnGapMm ?? gepflegtDefaults.main.paddingLeftMm,
      context.layout?.overridden ? (context.layout.sidebarWidthPercent ?? 38) * gepflegtDefaults.page.widthMm / 100 : undefined,
    );
    const native = resolveGepflegtGeometry();
    const padding = overrides.innerPaddingMm !== undefined ? overrides.innerPaddingMm - nativePadding : 0;
    const mainWidth = Math.max(24, gepflegt.mainContentWidth - 2 * padding);
    const sideWidth = Math.max(12, gepflegt.sideContentWidth - 2 * padding);
    return { font, textHeight, line,
      width: Math.max(0.5, (mainWidth - (native.mainContentWidth - geometry.text.bulletW)) / geometry.text.bulletW),
      contWidth: Math.max(0.5, (mainWidth - (native.mainContentWidth - geometry.text.contW)) / geometry.text.bulletW),
      mainRatio: mainWidth / native.mainContentWidth,
      sideDelta: sideWidth - native.sideContentWidth,
      marginInset: 0, fullRatio: mainWidth / native.mainContentWidth, ...factors, ...spacing, columnGapDelta: 0 };
  }
  if (templateId === "elegant" && !single) {
    const margin = overrides.pageMarginMm ?? nativeMargin;
    const padding = overrides.innerPaddingMm ?? nativePadding;
    const gap = overrides.columnGapMm ?? elegantDefaults.layout.columnGapMm;
    // The two columns: native 140 / 70 mm, or the sidebar share the user chose (resumeLayoutEngine sets them as fr tracks of
    // the page), so a wider sidebar narrows the main column by the same millimetres.
    const sidebarBox = context.layout?.overridden && context.layout.mode === "two-column"
      ? elegantDefaults.page.widthMm * context.layout.sidebarWidthPercent / 100 : elegantDefaults.layout.sidebarWidthMm;
    const mainWidth = Math.max(12, elegantDefaults.layout.mainWidthMm - (sidebarBox - elegantDefaults.layout.sidebarWidthMm)
      - margin - elegantDefaults.layout.mainRightMm - gap / 2 - 2 * padding);
    const sideWidth = Math.max(12, sidebarBox
      - elegantDefaults.layout.sidebarLeftMm - gap / 2 - margin - 2 * padding);
    return { font, textHeight, line,
      width: mainWidth / geometry.text.mainW,
      contWidth: mainWidth / geometry.text.mainW,
      mainRatio: mainWidth / geometry.text.mainW,
      sideDelta: sideWidth - geometry.text.sideW,
      marginInset: padding, ...factors, ...spacing };
  }
  if (single) {
    // The visual Tabellarisch career list keeps its narrow text column even
    // though the page has a single section stream. ATS uses the full width.
    const width = templateId === "tabellarisch" && !context.atsMode
      ? 1 : geometry.text.atsW / geometry.text.bulletW;
    const insetWidth = Math.max(0.55, (geometry.text.atsW - 2 * textInset) / geometry.text.atsW);
    return { font, textHeight, line, width: width * insetWidth, contWidth: width * insetWidth, mainRatio: insetWidth, sideDelta: 0, marginInset: textInset, ...factors, ...spacing };
  }
  // A wider sidebar takes its extra millimetres from the main column (page width 210 mm).
  const layout = context.layout;
  const sideDelta = geometry.columns === 2 && layout?.nativeSidebarWidthPercent
    ? (layout.sidebarWidthPercent - layout.nativeSidebarWidthPercent) * 2.1
    : 0;
  // A wider gap between the columns takes its millimetres from the main column.
  const columnDelta = spacing.columnGapDelta;
  const bulletRatio = Math.max(0.5, (geometry.text.bulletW - sideDelta - columnDelta) / geometry.text.bulletW);
  // Elegant keeps its compact identity sidebar on continuation pages, so its main text stays narrow.
  const contWidth = templateId === "elegant" && !context.atsMode
    ? bulletRatio : geometry.columns === 2 ? geometry.text.contW / geometry.text.bulletW : bulletRatio;
  const mainInset = Math.max(0.55, (geometry.text.mainW - 2 * textInset) / geometry.text.mainW);
  const continuationTextWidth = templateId === "elegant" && !context.atsMode ? geometry.text.mainW : geometry.text.contW;
  const continuationInset = Math.max(0.55, (continuationTextWidth - 2 * textInset) / continuationTextWidth);
  const mainRatio = Math.max(0.5, (geometry.text.mainW - sideDelta - columnDelta) / geometry.text.mainW) * mainInset;
  return { font, textHeight, line, width: bulletRatio * mainInset, contWidth: contWidth * continuationInset, mainRatio, sideDelta, marginInset: textInset, ...factors, ...spacing };
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
  /**
   * A list block whose rows may break between two pages: cumulative item count and height of any row range (the
   * rows of the last page, where the list spreads over the page width). `firstHeight` is the height of the part that
   * stands on page one for the given number of items, in the narrower column beside the sidebar. `narrowHeight` is
   * the height of a row range of the last page when that page keeps a sidebar (the main column stays narrow there).
   */
  split?: {
    ends: number[];
    height: (from: number, to: number) => number;
    firstHeight?: (items: number) => number;
    narrowHeight?: (from: number, to: number) => number;
    /** A custom section may break after one entry; grid lists keep two rows on each side. */
    minRows?: number;
    /** A paragraph (Kurzprofil) whose rows are words: its text lines, so a break leaves no widow or orphan line. */
    lines?: (from: number, to: number) => number;
  };
  /**
   * The same for a block that stands in the sidebar: rows are the safe break points (a grid row, a list entry, a
   * special-section entry), the heights are those of the narrow sidebar column, and every part repeats the heading.
   */
  sideSplit?: { ends: number[]; height: (from: number, to: number) => number; lines?: (from: number, to: number) => number };
};

/**
 * Whether a paragraph block may break after row `end` of the part `from`..`to`: at least `MIN_SPLIT_LINES` text lines
 * stay on either side (no widow, no orphan). Blocks without lines keep their row rule.
 */
const paragraphBreakAllowed = (lines: ((from: number, to: number) => number) | undefined, from: number, end: number, to: number) =>
  !lines || (lines(from, end) >= MIN_SPLIT_LINES && lines(end, to) >= MIN_SPLIT_LINES);

const sumHeights = (values: number[], gap: number) =>
  values.length ? values.reduce((total, value) => total + value, 0) + gap * (values.length - 1) : 0;

/**
 * The order in which a template with a sidebar lane draws its Seitenspalte on page one while the user has not arranged
 * the section list (measured on both outputs). Templates missing here draw it in the order of the section list.
 */
const nativeSidebarOrder: Record<string, readonly string[]> = {
  zweispaltig: ["summary", "strengths", "knowledge", "languages", "certifications"],
  "tuerkis-profil": ["summary"],
  gepflegt: ["summary", "strengths", "languages", "knowledge", "certifications"],
  zeitgenoessisch: ["summary", "strengths", "languages", "knowledge", "certifications"],
  elegant: ["summary", "strengths", "knowledge", "languages", "certifications"],
};

/** Templates whose page draws its sidebar in the order of a saved (older) section layout when there is one. */
const savedLayoutSidebarTemplates = new Set(["zweispaltig"]);

/** The order the template itself draws its sidebar in: a saved section layout's, else `nativeSidebarOrder`. */
const templateSidebarOrder = (profile: ApplicantProfile | undefined, templateId: string | undefined): readonly string[] | undefined =>
  (templateId && savedLayoutSidebarTemplates.has(templateId) ? savedTemplateSidebarOrder(profile, templateId) : undefined)
  ?? nativeSidebarOrder[templateId ?? ""];

/**
 * One-column templates whose pages follow the order of the section list, also across page breaks: a Kurzprofil or
 * Stärken behind the career flows with the blocks after it, every block behind the career keeps the order of the list,
 * and the template draws Kurzprofil, Stärken, Sprachen (ATS also Zertifikate) on the page the plan names.
 * Tabellarisch has its own ordered page flow.
 */
export const orderedOneColumnTemplates = new Set(["klassisch", "einspaltig", "ivy-league"]);

/**
 * Plain (ATS) layouts that draw every section behind the career on the page the plan names, on both surfaces: Sprachen
 * and Zertifikate through `sectionOnPage` (the plan places them itself), the other blocks through the output, each at
 * its place in the section list. They follow that list and start on page one while it has room. (Pehlione places its
 * Sprachen as a plain list the output draws, isPlainListSection.)
 */
export const atsFlowTemplates = new Set(["zweispaltig", "tuerkis-profil", "zeitgenoessisch", "kreativ", "ivy-league", "stilvoll", "kompakt", "einspaltig", "klassisch", "modern"]);

/** Whether a section stands on this page: where the plan placed it, else by the template's own rule (`fallback`). */
export const sectionOnPage = (plan: Pick<ResumePagePlan, "blocks" | "placed">, id: string, fallback: boolean): boolean =>
  plan.placed?.includes(id) ? Boolean(plan.blocks?.includes(id)) : fallback;

export const createResumePagePlan = (
  profile: ApplicantProfile | undefined,
  resumeProfile = "",
  options: ResumePaginationOptions = {},
  templateId?: string,
  context: ResumePlanContext = {},
): ResumePagePlan[] => {
  const plan = planResumePages(profile, resumeProfile, options, templateId, context);
  if (!templateId || !orderedOneColumnTemplates.has(templateId)) return plan;
  const placed = [...new Set(plan.flatMap((page) => [...(page.blocks ?? []), ...(page.placed ?? [])]))];
  return plan.map((page) => ({ ...page, placed }));
};

const planResumePages = (
  profile: ApplicantProfile | undefined,
  resumeProfile = "",
  options: ResumePaginationOptions = {},
  templateId?: string,
  context: ResumePlanContext = {},
): ResumePagePlan[] => {
  // Tabellarisch's plain layout keeps its measured model; the visual one is computed from the stylesheet.
  const geometry = context.atsMode && templateId === "tabellarisch" ? tabellarischAtsPaginationGeometry : getPaginationGeometry(templateId);
  const wrap = geometry.text.wrap;
  const chosenRoles = context.overrides?.entryRoleSizes;
  const scale: Scale = {
    ...buildScale(geometry, context, templateId),
    wrapText: Boolean(wrap && (!context.atsMode || wrap.atsWidth) && (context.overrides?.fontId ?? wrap.fontId) === wrap.fontId),
    ...(chosenRoles && Object.keys(chosenRoles).length ? {
      roles: { native: { ...nativeEntryRoleSizes(resolveTemplateCvDesign(templateId ?? "").typography), ...(context.atsMode ? geometry.atsRolePt : {}) }, chosen: chosenRoles },
      entryHead: context.atsMode ? geometry.atsEntryHead ?? geometry.entryHead : geometry.entryHead,
    } : {}),
  };
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
  // Kreativ and Türkis Profil arrange their page by the zones of the section list, also before the user changes it
  // (tuerkisProfilLayout: Bildungsweg and Sprachen in the left column, Zertifikate in the main column).
  const zonesFromList = customLayout || templateId === "kreativ" || templateId === "tuerkis-profil";
  const zoneOf = (id: SectionId): PaginationZone => {
    if (flat) return "main";
    const configured = zonesFromList ? find(id)?.zone : undefined;
    if (configured) return configured;
    if (id === "summary" || id === "strengths" || id === "knowledge" || id === "languages") return geometry.zones[id];
    return "main";
  };
  // Zone-flow templates keep a section in the column the user gave it, whatever page the pagination
  // ends up giving it: a sidebar block is hosted on page one whenever that column has room, and the
  // blocks of the main column flow behind the career entries.
  // A native one-column template still needs managed page flow. `flat` only removes
  // the physical sidebar; it must not pin movable blocks to the last page.
  const zoneFlow = isZoneFlowTemplate(templateId) && !context.atsMode && (!flat || geometry.columns === 1);
  const managerRank = (id: string) => {
    const index = context.sections?.findIndex((section) => section.id === id) ?? -1;
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };
  const careerRank = Math.min(managerRank("experience"), managerRank("education"));
  const ordered = Boolean(templateId && orderedOneColumnTemplates.has(templateId));
  /** The plain layout of `atsFlowTemplates`: the blocks behind the career follow the section list (see the tail below). */
  const atsFlow = Boolean(context.atsMode && templateId && atsFlowTemplates.has(templateId));
  /** A block's place in the user's order; the ordered one-column templates read every block from the list. */
  const rankOf = (block: FlowBlock) => (ordered ? managerRank(block.id) : block.rank ?? Number.MAX_SAFE_INTEGER);
  const byRank = (left: FlowBlock, right: FlowBlock) => rankOf(left) - rankOf(right);
  /**
   * Kurzprofil and Stärken stand on page one, unless the section list puts them behind the career: a hand-arranged one
   * (ordered templates, plain layout) or a template's own (Türkis Profil's, plain layout).
   */
  const leadHome = (id: string): FlowBlock["home"] =>
    ((ordered || atsFlow) && (customLayout || (atsFlow && zonesFromList)) && managerRank(id) > careerRank ? "last" : "first");

  const closingVisible = context.closing?.visible ?? Boolean(profile?.resumeClosing && (profile.resumeClosing.showPlace || profile.resumeClosing.showDate || profile.resumeClosing.showSignature));
  const closingHeight = closingVisible
    ? (context.closing?.signature ?? Boolean(profile?.signaturePath && profile.resumeClosing?.showSignature))
      ? CLOSING_MM.signature
      : (context.atsMode ? geometry.ats.closing : undefined) ?? CLOSING_MM.plain
    : 0;
  /**
   * Tabellarisch: the room the closing needs below the content of the last page, from its box (resumeClosingCss). Placed
   * in the footer it stands 12 mm above the sheet edge, so only the part above the content's bottom boundary (and 2 mm
   * clear of it) is taken; placed in the main column it follows the text.
   */
  const tabellarischClosingRoom = (() => {
    if (!closingVisible) return 0;
    const signature = context.closing?.signature ?? Boolean(profile?.signaturePath && profile.resumeClosing?.showSignature);
    const box = CLOSING_BOX.paddingMm + (signature ? CLOSING_BOX.signatureMm : CLOSING_BOX.lineMm);
    if (context.closing?.placement === "main") return CLOSING_BOX.mainGapMm + box;
    return Math.max(0, geometry.limit - (tabellarischDefaults.page.heightMm - CLOSING_BOX.bottomMm - box - CLOSING_BOX.clearanceMm));
  })();

  // --- career items ---------------------------------------------------------
  const educationSplit = !context.atsMode && supportsEducationSplit(templateId);
  const sectionGap = scale.sectionGap ?? nativeSectionGapOf(geometry, context.atsMode);
  /** The space between two blocks of the sidebar: the central Abschnittsabstand where the user chose one. */
  const sideGap = scale.sectionGap ?? geometry.blocks.sideGap;
  /** The frame between two career entries (the plain PDF may draw none: `ats.entryChrome`). */
  const entryChrome = (context.atsMode ? geometry.ats.entryChrome : undefined) ?? geometry.entryChrome ?? 0;
  const experienceGap = geometry.exp.gap > 0 ? (scale.entryGap ?? geometry.exp.gap) + entryChrome : 0;
  const educationGap = geometry.edu.gap > 0 ? (scale.entryGap ?? geometry.edu.gap) + entryChrome : 0;
  /**
   * Türkis Profil draws the Bildungsweg in its left column where the section list puts it there (its default): on page
   * one those entries take room in that column, not in the main column beside it; the later pages have one column.
   * There the entries keep the plain entry style of the column (title, organisation, meta row), measured with the
   * column's width plus the 2 mm padding Türkis gives every entry.
   */
  const educationBeside = templateId === "tuerkis-profil" && !flat && find("education")?.zone === "sidebar";
  const besideGeometry: PaginationGeometry = { ...geometry, gridEntry: undefined };
  const besideWidth = (geometry.text.sideW + scale.sideDelta - (geometry.text.wrap?.listInset ?? 0)) / geometry.text.bulletW;
  const items: MeasuredItem[] = [
    ...(profile?.experiences ?? []).map((experience): MeasuredItem => {
      const first = experienceMetrics(experience, geometry, scale, scale.width, true);
      const cont = experienceMetrics(experience, geometry, scale, scale.contWidth);
      return {
        kind: "experience", id: experience.id, weight: 0, gapAfter: experienceGap,
        first: first.height(0, first.lines.length),
        cont: cont.height(0, cont.lines.length),
        parts: { first, cont },
      };
    }),
    ...(profile?.education ?? []).map((education): MeasuredItem => {
      const first = educationMetrics(education, geometry, scale, scale.width, profile?.resumeEducationFieldVisibility, true);
      const cont = educationMetrics(education, geometry, scale, scale.contWidth, profile?.resumeEducationFieldVisibility, false);
      const beside = educationBeside
        ? educationMetrics(education, besideGeometry, scale, besideWidth, profile?.resumeEducationFieldVisibility, true) : undefined;
      // The later pages draw the column's sections above the main column, in the column's own entry style.
      const besideCont = educationBeside
        ? educationMetrics(education, besideGeometry, scale, scale.contWidth, profile?.resumeEducationFieldVisibility, false) : undefined;
      return {
        kind: "education", id: education.id, weight: 0, gapAfter: educationGap,
        first: first.height(0, first.lines.length),
        cont: besideCont ? besideCont.height(0, besideCont.lines.length) + (geometry.gridEntry?.padBottom ?? 0) : cont.height(0, cont.lines.length),
        ...(beside ? { side: beside.height(0, beside.lines.length) + (geometry.gridEntry?.padBottom ?? 0) } : {}),
        // An entry may break between its detail units where the output can cut it there (`supportsEducationSplit`); one
        // beside the career stays whole on page one.
        ...(educationSplit && !beside && first.lines.length > 1 ? { parts: { first, cont } } : {}),
      };
    }),
  ];
  const managerLayout = templateId ? profile?.resumeManagerLayouts?.[templateId] : undefined;
  if (managerLayout?.length && templateId !== "kreativ") {
    const order = managerLayout.map((entry) => entry.id);
    const rank = (kind: string) => {
      const index = order.indexOf(kind);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    // Array#sort is stable: items of one section keep their profile order.
    items.sort((left, right) => rank(left.kind) - rank(right.kind));
  }

  /**
   * The heading of a career section. With measured text (`text.wrap`) a title that wraps costs its extra lines, and on a
   * page the section continues onto its title reads "… · Fortsetzung" (14 pt capitals often take two lines there).
   */
  const sectionHeadingPt = context.overrides?.sectionHeadingPt ?? gepflegtDefaults.typography.sectionTitleSizePt;
  const headingLines = (kind: ResumePageItem["kind"], continued: boolean) => {
    const wrapping = geometry.text.wrap;
    if (!wrapping || !scale.wrapText) return 1;
    const title = `${getResumeSectionTitle(profile, kind === "experience" ? "experience" : "education")}${continued ? " · Fortsetzung" : ""}`;
    // (Türkis Profil sets its titles at weight 750, 0.16 em apart)
    const tuerkis = templateId === "tuerkis-profil";
    return Math.max(1, wrappedLines(title.toLocaleUpperCase("de-DE"), geometry.text.bulletW * scale.width + wrapping.listInset,
      sectionHeadingPt * PT_TO_MM, tuerkis ? 750 : 600, tuerkis ? 0.16 : 0.04));
  };
  const sectionHead = (kind: ResumePageItem["kind"], continued = false) =>
    ((context.atsMode ? geometry.ats.head : undefined) ?? (kind === "experience" ? geometry.exp.head : geometry.edu.head)) + scale.titleGapDelta
      + (headingLines(kind, continued) - 1) * sectionHeadingPt * PT_TO_MM * geometry.text.lineRatio * scale.line;
  /** A career entry as drawn on one page: all of it, or the part of an entry that breaks across pages. */
  type Shown = { kind: ResumePageItem["kind"]; height: number; gapAfter: number };
  /** Height of a run of career entries on one page, including one heading per section. */
  /** `continued`: the run opens a page the first section goes on onto (its heading says "· Fortsetzung"). */
  const runHeight = (list: readonly Shown[], continued = false) => {
    let total = 0;
    let previousKind: string | undefined;
    list.forEach((entry, index) => {
      if (entry.kind !== previousKind) {
        total += (index > 0 ? sectionGap : 0) + sectionHead(entry.kind, continued && index === 0);
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
  /** The entries page one draws in its main column (Türkis Profil's Bildungsweg may stand beside it). */
  const inMainFirst = (item: { kind: ResumePageItem["kind"] }) => !(educationBeside && item.kind === "education");
  /** Height the entries on page one take in the sidebar: their heading and the entries `educationGap` apart. */
  /**
   * Türkis Profil's section titles (14 pt capitals 0.16 em apart, line height 1) wrap in its narrow left column: every further line of
   * a title there adds its line box to the section (each part of a section that breaks repeats its title).
   */
  const sideTitleExtra = (id: string) => {
    if (templateId !== "tuerkis-profil" || flat) return 0;
    const special = id.startsWith("special:") ? profile?.specialSections.find((entry) => `special:${entry.id}` === id) : undefined;
    const title = (special ? special.title : ["summary", "strengths", "knowledge", "languages", "certifications", "education", "experience"].includes(id)
      ? getResumeSectionTitle(profile, id as Parameters<typeof getResumeSectionTitle>[1]) : "").toLocaleUpperCase("de-DE");
    const titleMm = 14 * PT_TO_MM;
    return title ? (Math.max(1, wrappedLines(title, geometry.text.sideW + scale.sideDelta, titleMm, 750, 0.16)) - 1) * titleMm : 0;
  };
  const besideHeight = (list: readonly MeasuredItem[]) => {
    const beside = list.filter((item) => item.side !== undefined);
    return beside.length ? sectionHead("education") + sideTitleExtra("education") + sumHeights(beside.map((item) => item.side!), educationGap) : 0;
  };

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
  // Every language once, as the renderers list them (applyResumeLanguageOutput): a row range means the same rows there.
  const languages = [...new Set((profile?.languages ?? []).map((entry) => entry.trim()).filter(Boolean))];
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
    if (zone === "sidebar" && !flat && page === "first") {
      // Stilvoll can draw an explicit two- or three-column strengths grid inside its sidebar.
      // Size the same grid here; treating every card as a row moves visible cards to page two too early.
      if (templateId === "stilvoll" && kind === "strengths") {
        const cols = resolveSectionColumns(settings.strengthsColumns, templateId, "sidebar", entries, settings, true);
        if (cols > 1) {
          const gap = (scale.entryGap ?? stilvollDefaults.layout.entryGapMm) * .5;
          const textWidth = Math.max(4, (geometry.text.sideW + scale.sideDelta - gap * (cols - 1)) / cols - GRID_ICON_MM);
          // The legacy character estimator clamps widths below 12 mm; scale its advance for narrow three-column cards.
          const measuredWidth = Math.max(12, textWidth);
          return { ...model, cols, gap, w: measuredWidth, cw: model.cw * measuredWidth / textWidth };
        }
      }
      return { ...model, w: model.w + scale.sideDelta };
    }
    // Klassisch draws up to three explicit strengths as its own cards: always three columns (resumeManagedOutput keeps them).
    if (templateId === "klassisch" && kind === "strengths" && !context.atsMode && explicitStrengths.length >= 1 && explicitStrengths.length <= 3) {
      const { layout } = klassischDefaults;
      const width = geometry.text.fullW * (scale.fullRatio ?? 1);
      // Title and description at the body size and line height, one after the other (the +1 mm of the model stays as reserve).
      return { ...model, cols: 3, gap: layout.strengthRowGapMm, pitch: geometry.text.bulletFont * geometry.text.lineRatio,
        descPitch: geometry.text.bulletFont * geometry.text.lineRatio, descRatio: 1,
        w: Math.max(12, (width - 2 * layout.strengthColumnGapMm) / 3 - layout.strengthIconMm - layout.contactIconGapMm) };
    }
    // Gepflegt keeps its sidebar lane on every page: its main column is never the page width.
    const beside = !flat && (page === "first" || templateId === "gepflegt") && geometry.columns === 2;
    const mode = kind === "strengths" ? settings.strengthsColumns : settings.knowledgeColumns;
    const cols = resolveSectionColumns(mode, templateId ?? "", "main", entries, settings, beside);
    const width = beside ? geometry.text.mainW * scale.mainRatio : geometry.text.fullW * (scale.fullRatio ?? 1);
    return {
      ...model,
      cols,
      w: Math.max(12, (width - GRID_COLUMN_GAP_MM * (cols - 1)) / cols - (context.atsMode ? 0 : GRID_ICON_MM)),
      // (Türkis Profil's strength rows stand 3.5 mm apart, measured)
      gap: kind === "strengths" ? (templateId === "zeitgenoessisch" ? 2 : templateId === "tuerkis-profil" ? 3.5 : 3) : 2,
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
      : fullWidth ? geometry.text.fullW * (scale.fullRatio ?? 1) : geometry.text.mainW * scale.mainRatio;
    // The lists of Pehlione have fixed sizes: neither the design font size nor the line height reaches them.
    // A list that takes the body size of the page follows the design settings like the rest of the text.
    const fontMm = metrics.inheritBody ? geometry.text.bulletFont * scale.font : metrics.fontMm;
    const lineMm = metrics.inheritBody ? fontMm * geometry.text.lineRatio * scale.line : metrics.lineMm;
    const lines = texts.map((text) => listLines(text.length, column - metrics.indentMm, fontMm));
    const body = lines.reduce((total, count) => total + count * lineMm, 0);
    return metrics.headingMm + body + metrics.gapMm * (texts.length - 1);
  };
  /**
   * Projekte and Hobbys & Interessen space their entries like the career entries (resumeManagedOutput): the Eintragsabstand
   * plus the padding and divider the template's entry rule draws below every entry but the last, and the Abstand nach
   * Eintragstitel below an entry title.
   */
  const nativeEntryGap = templateId ? resolveTemplateCvDesign(templateId).spacing.entryGapMm : geometry.exp.gap;
  /** How far the chosen Eintragsabstand moves the native one. */
  const careerLikeEntryGapDelta = (scale.entryGap ?? nativeEntryGap) - nativeEntryGap;
  const careerLikeEntryGap = (scale.entryGap ?? nativeEntryGap) + (geometry.customEntryChrome ?? geometry.entryChrome ?? 0);
  const careerLikeContentGap = context.overrides?.entryContentGapMm ?? (templateId ? resolveTemplateCvDesign(templateId).spacing.entryContentGapMm : 0);
  /**
   * What the chosen entry-role sizes add to a Projekte / Hobbys entry (renderCustomSectionContent): its title, the
   * technologies and the description of a project, the organisation and the place-and-period line of the other kinds, each
   * at the line height of these entries (the design's), against the size the template draws it in. 0 without a choice.
   */
  const customRoleDelta = (kind: string, entry: ReturnType<typeof normalizeCustomSection>["entries"][number], width: number) => {
    if (!scale.roles) return 0;
    const delta = (roles: readonly ResumeTextRole[], value: string) => roleTextDelta(scale.roles, roles, value, width,
      geometry.text.lineRatio * scale.line, (text, columnMm, fontMm) => linesFor(text.trim().length, columnMm, fontMm, SPECIAL_CW), geometry.customRolePt);
    if (kind === "projects") return delta(["entry-title"], entry.title)
      + delta(["technologies"], entry.technologies.filter((value) => value.trim()).join(" · ")) + delta(["description"], entry.description);
    const period = entry.date.trim() || [entry.from, entry.to].filter((value) => value.trim()).join(" – ");
    return (entry.sectionType === "subsection" ? delta(["entry-title"], entry.title) : 0) + delta(["organization"], entry.subtitle)
      + delta(["location", "period"], [entry.location, period].filter((value) => value.trim()).join(" · "));
  };
  /**
   * A special section: its entries are drawn like career entries (the template's entry spacing between them)
   * with paragraphs in the body font, in whichever column the section stands. The lines are wrapped and pitched in the
   * scaled body font already, so the height is not scaled by the font once more (`scale.textHeight` counted a larger
   * font twice: Projekte at 9.2 pt in Kreativ came out 11 mm too tall and their last entry left a roomy page).
   */
  const specialHeight = (
    zone: PaginationZone,
    section: NonNullable<typeof profile>["specialSections"][number],
    fullWidth = false,
    /** Only the entries `from`..`to` (exclusive): the part of a section that breaks between two pages. */
    range?: readonly [number, number],
  ) => {
    const metrics = zoneFlow && templateId ? sectionListMetrics(templateId, zone) : undefined;
    if (!metrics) return 0;
    const normalized = normalizeCustomSection(section);
    const careerLike = spacesEntriesLikeCareer(section.kind);
    const listed = normalized.contentType === "list" || normalized.contentType === "skills" || normalized.contentType === "timeline";
    const column = zone === "sidebar" ? geometry.text.sideW + scale.sideDelta
      : fullWidth ? geometry.text.fullW * (scale.fullRatio ?? 1) : geometry.text.mainW * scale.mainRatio;
    const font = geometry.text.bulletFont * scale.font;
    const pitch = font * geometry.text.lineRatio * scale.line;
    const lines = (text: string, indent = 0) => (text.trim() ? linesFor(text.trim().length, column - indent, font, SPECIAL_CW) : 0);
    const headed = normalized.contentType === "entries" || normalized.contentType === "timeline";
    const entries = normalized.entries.slice(range?.[0] ?? 0, range?.[1]).map((entry) => {
      const indent = listed ? metrics.indentMm : 0;
      if (section.kind === "projects") return lines(entry.title, indent) * pitch * 1.13
        + (entry.title.trim() && (entry.technologies.some((value) => value.trim()) || entry.description.trim()) ? careerLikeContentGap : 0)
        + lines(entry.technologies.join(" · "), indent) * pitch * .88
        + lines(entry.description, indent) * pitch
        + customRoleDelta(section.kind, entry, column - indent);
      const meta = [entry.location, entry.date.trim() || [entry.from, entry.to].filter((value) => value.trim()).join(" – ")].filter((value) => value.trim()).join(" · ");
      const head = headed
        ? lines(entry.title, indent) * pitch * 1.13 + (entry.subtitle.trim() ? 6.7 : 0) + (meta ? 4.1 : 0)
        : lines(entry.title, indent) * pitch + lines(entry.subtitle, indent) * pitch + lines(meta, indent) * pitch;
      const titleGap = careerLike && headed && entry.title.trim()
        && [entry.subtitle, meta, entry.description, entry.url, ...entry.bullets].some((value) => value.trim()) ? careerLikeContentGap : 0;
      return head + titleGap
        + lines(entry.description, indent) * pitch
        + entry.bullets.reduce((total, value) => total + lines(value, indent + metrics.indentMm) * pitch, 0)
        + lines(entry.url, indent) * pitch
        + customRoleDelta(section.kind, entry, column - indent);
    });
    // The entries of a sidebar section may be styled like the template's own entries (margins, a divider's padding).
    const side = zone === "sidebar" && listed ? geometry.specialSide : undefined;
    const between = careerLike
      ? side ? side.between + careerLikeEntryGapDelta : careerLikeEntryGap
      : side?.between ?? (templateId === "modern" && listed
        ? metrics.gapMm : geometry.exp.gap + (zone === "sidebar" && listed ? metrics.gapMm : 3));
    return metrics.headingMm + (side?.edge ?? 0) + entries.reduce((total, value) => total + value, 0) + between * Math.max(0, entries.length - 1);
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
    ) * scale.textHeight + projectHighlightRoleDelta(project, column);
  };
  /** The chosen Eintragstitel and the company-and-technology line of the project highlight (10.4 pt title, 9.2 pt line). */
  const projectHighlightRoleDelta = (project: NonNullable<ReturnType<typeof getPehlioneProjectHighlight>>, width: number) => {
    const lines = (text: string, columnMm: number, fontMm: number) => linesFor(text.length, columnMm, fontMm, PROJECT_COMPANY_CW);
    return roleTextDelta(scale.roles, ["entry-title"], project.title, width, 1.2, lines, { "entry-title": 10.4 })
      + roleTextDelta(scale.roles, ["organization", "technologies"], [project.company, ...project.technologies].filter(Boolean).join(" · "), width, 1.3,
        lines, { organization: 9.2, technologies: 9.2 });
  };
  /** A free knowledge group: its items as a plain list (level and description under the text). */
  const groupTexts = (id: string) => {
    const group = resolveKnowledgeGroups(templateId ?? "", profile?.resumeKnowledgeGroups).find((candidate) => `group:${candidate.id}` === id);
    // The renderer draws the visible items in their order (resumeManagedOutput); a range counts them the same way.
    return (group?.items ?? [])
      .filter((item) => item.visible && item.text.trim())
      .sort((a, b) => a.order - b.order)
      .map((item) => [item.text, item.level, item.description].filter(Boolean).join(" "));
  };
  const groupHeight = (zone: PaginationZone, id: string, fullWidth = false) => {
    const texts = groupTexts(id);
    if (!texts.length) return 30;
    return plainListHeight(zone, texts, fullWidth) * 1.15;
  };
  /** The items of a group are the safe break points of its sidebar lane. */
  const groupSideSplit = (id: string): FlowBlock["sideSplit"] => {
    const texts = groupTexts(id);
    return texts.length ? { ends: texts.map((_, index) => index + 1), height: (from, to) => plainListHeight("sidebar", texts.slice(from, to)) * 1.15 } : undefined;
  };

  const flow: FlowBlock[] = [];
  /**
   * Elegant's sidebar as its stylesheet draws it (elegantManagedCss): a section title (the section title size − 0.5 pt at the
   * design's line height) with its 1.6 mm padding, rule and 2.4 mm gap, then lines of the body size at the design's line
   * height across the sidebar's text width, wrapped with the measured advances of its font (Source Sans 3 stack).
   */
  const elegantSidebar = templateId === "elegant" && !context.atsMode && !flat
    && (context.overrides?.fontId ?? elegantDesign.tokens.typography.fontId) === "source-sans";
  const elegantSideWidth = geometry.text.sideW + scale.sideDelta;
  const elegantBodyMm = geometry.text.bulletFont * scale.font;
  const elegantLine = elegantBodyMm * geometry.text.lineRatio * scale.line;
  const elegantSideTitleMm = ((context.overrides?.sectionHeadingPt ?? elegantDefaults.typography.sectionTitleSizePt) - 0.5) * PT_TO_MM;
  /** A sidebar title: its lines (capitals, 0.075 em tracking) at the line height, then padding, rule and gap. */
  const elegantSideHeadFor = (title: string) => Math.max(1, wrappedLines(title.toLocaleUpperCase("de-DE"), elegantSideWidth,
    elegantSideTitleMm, elegantDesign.tokens.typography.sectionHeadingWeight, 0.075))
    * elegantSideTitleMm * geometry.text.lineRatio * scale.line + ELEGANT_SIDE_HEADING_CHROME_MM;
  const elegantSideHead = elegantSideTitleMm * geometry.text.lineRatio * scale.line + ELEGANT_SIDE_HEADING_CHROME_MM;
  const elegantSideLines = (text: string, indent = 0) =>
    text.trim() ? Math.max(1, wrappedLines(text.trim(), elegantSideWidth - indent, elegantBodyMm, 400)) : 0;
  if (visible("summary") && summaryText) {
    const zone = zoneOf("summary");
    // Tabellarisch sets the Kurzprofil across the whole content width: its lines are wrapped there with the measured font
    // (the browser's justified, hyphenated lines never take more).
    const tabellarischSummary = templateId === "tabellarisch" && !context.atsMode && scale.wrapText;
    /**
     * Both outputs set the Kurzprofil justified with German hyphenation (resumeSummaryTextCss) in the template's font.
     * With the measured advances of that font (the "Source Sans 3" / Segoe UI stack every template uses by default) and
     * the same soft hyphens, its lines are wrapped like the browser does: measured on all 14 templates in either column
     * (exact, or one line long). The plain layout and another font keep the conservative estimates below.
     */
    const exactSummary = !context.atsMode && (context.overrides?.fontId ?? "source-sans") === "source-sans"
      && (context.settings?.fontId ?? "source-sans") === "source-sans";
    /** The plain layout's Kurzprofil where it was measured (`ats.summary`): wrapped like the visual one, in its own type. */
    const atsSummary = context.atsMode ? geometry.ats.summary : undefined;
    const measureSummaryLines = (value: string) => Math.max(1, atsSummary
      ? hyphenatedSummaryLines(value, atsSummary.w * scale.mainRatio, atsSummary.font * scale.font, 400)
      : tabellarischSummary
      ? wrappedLines(value, geometry.text.mainW * scale.mainRatio, geometry.text.sumFont * scale.font, geometry.text.wrap!.bodyWeight)
      : exactSummary
        ? hyphenatedSummaryLines(value, textWidth(zone), geometry.text.sumFont * scale.font, geometry.text.wrap?.bodyWeight ?? 400)
      : value.length < 180 || zoneFlow && !supportsSidebarContinuation(templateId)
        ? scale.wrapText && geometry.text.wrap?.paragraphs
          ? wrappedLines(value, textWidth(zone), geometry.text.sumFont * scale.font, geometry.text.wrap.bodyWeight)
          : linesFor(value.length, textWidth(zone), geometry.text.sumFont * scale.font, geometry.text.cw * 1.05)
        : summaryWrappedLines(value, textWidth(zone), geometry.text.sumFont * scale.font,
          geometry.text.wrap?.bodyWeight ?? 400));
    // A page break is tried after every word of a long Kurzprofil: each part is wrapped once.
    const summaryLineCache = new Map<string, number>();
    const summaryLines = (value: string) => {
      const cached = summaryLineCache.get(value);
      if (cached !== undefined) return cached;
      const lines = measureSummaryLines(value);
      summaryLineCache.set(value, lines);
      return lines;
    };
    // Every plain section starts with the same heading block as the career sections.
    const summaryHead = context.atsMode ? geometry.ats.head ?? geometry.exp.head : blocks.summary[0];
    // The lines of a summary follow the body font exactly; only enlarged text keeps its reserve.
    const summaryScale = zoneFlow && scale.font < 1 ? scale.font : scale.textHeight;
    const height = (value: string) => atsSummary
      ? (atsSummary.head + atsSummary.line * scale.line * summaryLines(value)) * scale.textHeight
      : elegantSidebar && zone === "sidebar"
      // Justified, broken at the same soft hyphens the renderer inserts.
      ? elegantSideHeadFor(getResumeSectionTitle(profile, "summary")) + Math.max(1, hyphenatedSummaryLines(value, elegantSideWidth, elegantBodyMm, 400)) * elegantLine
      : exactSummary && !tabellarischSummary
      // The measured lines at the paragraph's line pitch, below the heading (measured headings of the main column ran up
      // to 0.5 mm taller than `blocks.summary[0]`: the safety share of its capacity covers that).
      ? summaryHead * scale.textHeight + (geometry.text.summaryLine ?? blocks.summary[1]) * scale.line * summaryLines(value) * summaryScale
      : zoneFlow
      ? summaryHead * scale.textHeight + blocks.summary[1] * scale.line * summaryLines(value) * summaryScale
      : (summaryHead + blocks.summary[1] * scale.line * summaryLines(value)) * scale.textHeight;
    const ends = summaryWordEnds(summaryText);
    const partText = (from: number, to: number) => summaryText.slice(from ? ends[from - 1] : 0, ends[to - 1]).trim();
    // A part that goes on from the page before is titled "… · Fortsetzung": the lines that title takes beyond the plain one.
    const summaryTitle = getResumeSectionTitle(profile, "summary");
    const continuedTitle = `${summaryTitle} · Fortsetzung`;
    const headingLine = templateId ? sectionHeadingLineMetrics(templateId, zone === "sidebar" ? "sidebar" : "main") : undefined;
    const titleLines = (title: string) => headingLine ? Math.max(1, wrappedLines(headingLine.uppercase ? title.toLocaleUpperCase("de-DE") : title,
      textWidth(zone) - headingLine.iconMm, headingLine.fontMm * scale.font, headingLine.weight, headingLine.letterSpacingEm)) : 1;
    const continuedHeadExtra = elegantSidebar && zone === "sidebar"
      ? elegantSideHeadFor(continuedTitle) - elegantSideHeadFor(summaryTitle)
      : headingLine ? (titleLines(continuedTitle) - titleLines(summaryTitle)) * headingLine.lineMm * scale.font : 0;
    const partHeight = (from: number, to: number) => height(partText(from, to)) + (from > 0 ? continuedHeadExtra : 0);
    // The text lines of a part, wrapped like its height: a break never leaves a single line on either page.
    const partLines = (from: number, to: number) => from >= to ? 0 : elegantSidebar && zone === "sidebar"
      ? Math.max(1, hyphenatedSummaryLines(partText(from, to), elegantSideWidth, elegantBodyMm, 400))
      : summaryLines(partText(from, to));
    flow.push({
      id: "summary",
      zone,
      height: height(summaryText),
      home: leadHome("summary"),
      rank: managerRank("summary"),
      ...(summaryText.length >= 180 && ends.length > 1
        ? { split: { ends, height: partHeight, minRows: 2, lines: partLines }, sideSplit: { ends, height: partHeight, lines: partLines } } : {}),
      // Elegant's sidebar is one lane: the Kurzprofil fills page one and goes on in the next page's sidebar when it must.
      ...(elegantSidebar && zone === "sidebar"
        ? { home: "last" as const, hostable: true, ...(ends.length > 1 ? { sideSplit: { ends, height: partHeight, lines: partLines } } : {}) } : {}),
    });
  }
  // Skills shown as strengths are only drawn by some templates, and some only on a one-page résumé.
  const derivedStrengths = explicitStrengths.length ? "first" : geometry.derivedStrengths[context.atsMode ? "ats" : "visual"];
  /**
   * Tabellarisch's strengths are the shared strength cards (managedResumeCss) across the content width: per card the title
   * (bold) at the body size (line height 1.3), the 1 mm row gap and the description (0.92 em, line height 1.4) beside a 4 mm icon;
   * a row is as tall as its tallest card, rows 3 mm apart.
   */
  const tabellarischStrengthsHeight = (entries: ListEntry[]) => {
    const cols = Math.max(1, gridModel("strengths", entries, "main", "first").cols);
    const width = (geometry.text.fullW * (scale.fullRatio ?? 1) - GRID_COLUMN_GAP_MM * (cols - 1)) / cols - GRID_ICON_MM;
    const bodyMm = geometry.text.bulletFont * scale.font;
    let rows = 0;
    for (let start = 0; start < entries.length; start += cols) {
      rows += Math.max(...entries.slice(start, start + cols).map((entry) => Math.max(4,
        Math.max(1, wrappedLines(entry.title, width, bodyMm, 700)) * bodyMm * 1.3 + 1
          + (entry.description ? wrappedLines(entry.description, width, bodyMm * 0.92) * bodyMm * 0.92 * 1.4 : 0))));
    }
    return blocks.summary[0] + rows + 3 * (Math.ceil(entries.length / cols) - 1);
  };
  /**
   * Elegant's sidebar strengths: the shared strength cards one per row beside a 5.5 mm icon, the bold title, 1 mm, the
   * description (both at the body size and the design's line height), cards 3 mm apart.
   */
  const elegantStrengthsHeight = (entries: ListEntry[]) => elegantSideHeadFor(getResumeSectionTitle(profile, "strengths"))
    + entries.reduce((total, entry) => total + Math.max(1, wrappedLines(entry.title, elegantSideWidth - GRID_ICON_MM, elegantBodyMm, 700)) * elegantLine
      + 1 + (entry.description ? Math.max(1, wrappedLines(entry.description, elegantSideWidth - GRID_ICON_MM, elegantBodyMm, 400)) * elegantLine : 0), 0)
    + 3 * Math.max(0, entries.length - 1);
  /**
   * Türkis Profil's main column flows like a word processor: the Stärken behind the career break between two rows of
   * their grid (the heading leads every part), page one in the column beside the sidebar, the later pages across the
   * page width with the columns the grid has there.
   */
  const wordFlowGrid = (entries: ListEntry[]): Pick<FlowBlock, "split" | "contHeight"> => {
    const first = gridModel("strengths", entries, "main", "first");
    const last = gridModel("strengths", entries, "main", "last");
    const ends = entries.map((_, index) => index + 1).filter((end) => end % last.cols === 0 || end === entries.length);
    const covered = (items: number, cols: number) => Math.min(entries.length, Math.ceil(items / cols) * cols);
    const startOf = (row: number) => (row > 0 ? ends[row - 1] : 0);
    return {
      contHeight: listBlockHeight(last, scale, entries),
      split: {
        ends,
        height: (from, to) => listBlockHeight(last, scale, entries.slice(startOf(from), ends[to - 1])),
        firstHeight: (items) => listBlockHeight(first, scale, entries.slice(0, covered(items, first.cols))),
        narrowHeight: (from, to) => listBlockHeight(first, scale, entries.slice(startOf(from), ends[to - 1])),
        minRows: 1,
      },
    };
  };
  if (visible("strengths") && strengthEntries.length && derivedStrengths !== "never") {
    const zone = zoneOf("strengths");
    flow.push({
      id: "strengths",
      zone,
      height: templateId === "tabellarisch" && !context.atsMode && scale.wrapText
        ? tabellarischStrengthsHeight(strengthEntries)
        : elegantSidebar && zone === "sidebar" ? elegantStrengthsHeight(strengthEntries)
        : listBlockHeight(gridModel("strengths", strengthEntries, zone, "first"), scale, strengthEntries),
      home: derivedStrengths === "single" ? "first" : leadHome("strengths"),
      rank: managerRank("strengths"),
      singleOnly: derivedStrengths === "single",
      // A sidebar lane breaks the strengths between two cards (every part repeats the heading).
      ...(zone === "sidebar" && !flat && derivedStrengths !== "single"
        ? { sideSplit: { ends: strengthEntries.map((_, index) => index + 1), height: (from: number, to: number) => elegantSidebar
          ? elegantStrengthsHeight(strengthEntries.slice(from, to))
          : listBlockHeight(gridModel("strengths", strengthEntries, zone, "first"), scale, strengthEntries.slice(from, to)) } } : {}),
      // Elegant's sidebar lane: the strengths break between two cards.
      ...(elegantSidebar && zone === "sidebar" && derivedStrengths !== "single" ? { home: "last" as const, hostable: true } : {}),
      ...(templateId === "tuerkis-profil" && zone === "main" && !flat && derivedStrengths !== "single" ? wordFlowGrid(strengthEntries) : {}),
    });
  }
  if (visible("languages") && languages.length) {
    const zone = zoneOf("languages");
    // What the page prints of each language (Lebenslauf → Sprachen: Punkte, Niveau, Beschreibung): the same resolver as the
    // preview and the PDF. Dots share the name row when they fit; the description follows below.
    const languageRows = languages.map((entry) =>
      resolveLanguagePresentation(entry, profile?.resumeLanguageDisplay, { dots: true, ats: context.atsMode }));
    /** The block's height when it stands in `at`: from the printed rows, measured per template (languageBlockHeight). */
    const languageHeightIn = (at: PaginationZone, fullWidth = false, rows = languageRows) => {
      const beside = !flat && (!fullWidth || templateId === "gepflegt") && geometry.columns === 2;
      const columns = resolveSectionColumns(settings.languagesColumns, templateId ?? "", at === "sidebar" ? "sidebar" : "main",
        rows.map((language) => ({ title: language.primaryText, description: language.secondaryText })), settings, beside);
      return templateId && !context.atsMode
        ? languageBlockHeight(templateId, rows, {
          column: at === "sidebar" ? geometry.text.sideW + scale.sideDelta : fullWidth ? geometry.text.fullW * (scale.fullRatio ?? 1) : geometry.text.mainW * scale.mainRatio,
          font: scale.font,
          // Einspaltig sets its language rows at the body line height.
          textHeight: scale.textHeight * (templateId === "einspaltig" ? scale.line : 1),
          columns,
          zone: at === "sidebar" ? "sidebar" : "main",
        })
        : undefined;
    };
    /**
     * Elegant's sidebar languages (both surfaces): per language a row of the bold name and – beside it, wrapping in the line
     * boxes of that row (body × 1.25) – the level text at the small size; with Punkte the 6.55 mm dots beside it and the
     * Beschreibung in lines of its own (small size at the design's line height, 0.6 mm below); rows 2 mm apart. The list
     * keeps 5.3 mm free at its right edge.
     */
    const elegantLanguagesHeight = (rows: typeof languageRows) => {
      const small = Math.max(9 * PT_TO_MM, elegantBodyMm * 0.9);
      const rowLine = elegantBodyMm * 1.25 * Math.max(1, scale.line);
      const smallLine = small * geometry.text.lineRatio * scale.line;
      const room = elegantSideWidth - ELEGANT_LANGUAGE_EDGE_MM;
      return elegantSideHeadFor(getResumeSectionTitle(profile, "languages")) + rows.reduce((total, row) => {
        const name = textWidthMm(row.name, elegantBodyMm, 700);
        const detail = row.detail ? ` – ${row.detail}` : "";
        const levelRoom = Math.max(8, room - name - (row.showDots ? ELEGANT_LANGUAGE_DOTS_MM : 0));
        const lines = detail ? Math.max(1, wrappedLines(detail, levelRoom, small, 400)) : 1;
        const description = row.secondaryText ? ELEGANT_LANGUAGE_DESCRIPTION_GAP_MM + Math.max(1, wrappedLines(row.secondaryText, room, small, 400)) * smallLine : 0;
        return total + lines * rowLine + description;
      }, 0) + ELEGANT_LANGUAGE_ROW_GAP_MM * Math.max(0, rows.length - 1);
    };
    const languageHeight = elegantSidebar && zone === "sidebar" ? elegantLanguagesHeight(languageRows) : context.atsMode
      ? line(geometry.ats.languages, languages.length) * scale.textHeight
      : languageHeightIn(zone) ?? (zoneFlow
        ? plainListHeight(zone, languageRows.map((row) => row.primaryText))
        // Long lines such as “Türkisch – C2 · Annähernd muttersprachlich” wrap inside a narrow sidebar.
        : (line(blocks.languages, languages.length) + languageRows.filter((row) => row.primaryText.length > 22).length * geometry.exp.linePitch) * scale.textHeight);
    // Languages follow the sidebar on page one; in a flat main column they close the document.
    flow.push({
      id: "languages",
      zone,
      height: languageHeight,
      home: !flat && geometry.zones.languages === "sidebar" && templateId !== "elegant" ? "first" : "last",
      rank: managerRank("languages"),
      hostable: (templateId === "kompakt" && zoneFlow || templateId === "elegant") && zone === "sidebar" && !flat,
      contHeight: templateId === "kompakt" && zoneFlow ? (languageHeightIn("main", true) ?? plainListHeight("main", languageRows.map((row) => row.primaryText), true)) : undefined,
      // A sidebar lane breaks the languages between two rows.
      sideSplit: (templateId === "elegant" || zoneFlow) && zone === "sidebar" && !flat
        ? { ends: languageRows.map((_, index) => index + 1), height: (from, to) => elegantSidebar
          ? elegantLanguagesHeight(languageRows.slice(from, to))
          : languageHeightIn("sidebar", false, languageRows.slice(from, to)) ?? 0 }
        : undefined,
    });
  }
  const projectVisible = find("projects")?.visible ?? true;
  if (templateId?.startsWith("pehlione_") && projectVisible) {
    const project = getPehlioneProjectHighlight(profile);
    if (project && !(templateId === "pehlione_white_blue" && hasPehlioneCustomProjectHighlight(profile))) {
      const lines = project.achievements.reduce(
        (total, entry) => total + linesFor(entry.length, geometry.text.bulletW, geometry.text.bulletFont, geometry.text.cw),
        0,
      );
      // Pehlione renders its project highlight after education. When education
      // continues on page two, the project must follow it there as well.
      const mainHeight = (24 + lines * geometry.exp.linePitch) * scale.textHeight + projectHighlightRoleDelta(project, geometry.text.mainW * scale.mainRatio);
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
        const entries: ListEntry[] = group.items.map((item) => ({
          title: formatKnowledgeItem(item, group.category.showLevels, group.category.showYearsOfExperience, "comma-separated"),
        }));
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
    /**
     * Elegant's sidebar knowledge (one item per row): the title, then per category its title (body size at the line height,
     * 1.5 mm below; the first one's top margin hides in the title gap, a further one stands 3 mm below the list before) and
     * its items beside a 5.5 mm icon, 2 mm apart.
     */
    const elegantKnowledge = elegantSidebar && knowledgeZone === "sidebar"
      && knowledgeGroups.every((group) => gridModel("knowledge", group.items.map((item) => ({ title: item.name })), knowledgeZone, "first").cols === 1);
    const elegantKnowledgeHeight = (rows: ReturnType<typeof knowledgeRows>, from: number, to: number) => {
      const part = rows.slice(from, to);
      if (!part.length) return 0;
      const titles = knowledgeGroups.flatMap((group) => group.items.map((item) =>
        formatKnowledgeItem(item, group.category.showLevels, group.category.showYearsOfExperience, "comma-separated")));
      const firstItem = from > 0 ? rows[from - 1].end : 0;
      let height = elegantSideHeadFor(knowledgeSection?.title || getResumeSectionTitle(profile, "knowledge"));
      let list = -1;
      part.forEach((row, index) => {
        const item = index === 0 ? firstItem : part[index - 1].end;
        if (row.list !== list) {
          const group = knowledgeGroups[row.list];
          // A category that goes on from the page before carries the "· Fortsetzung" marker.
          const continued = list < 0 && from > 0 && rows[from - 1].list === row.list;
          const title = `${group.subcategory?.title ?? group.category.title}${continued ? " · Fortsetzung" : ""}`;
          height += (list >= 0 ? ELEGANT_KNOWLEDGE_CATEGORY_GAP_MM : 0) + elegantSideLines(title) * elegantLine + ELEGANT_KNOWLEDGE_TITLE_GAP_MM;
          list = row.list;
        } else height += ELEGANT_KNOWLEDGE_ITEM_GAP_MM;
        height += Math.max(1, wrappedLines(titles[item] ?? "", elegantSideWidth - GRID_ICON_MM, elegantBodyMm, 400)) * elegantLine;
      });
      // The last category keeps its 3 mm bottom margin inside the section (a flex item of page one's sidebar).
      return height + ELEGANT_KNOWLEDGE_CATEGORY_GAP_MM;
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
        split: {
          ends: lastRows.map((row) => row.end),
          height: (from, to) => rowsHeight(lastRows, from, to),
          // The part on page one is drawn beside the sidebar: its rows are those of the narrower column (the rows
          // that cover the items; a row that is only partly covered counts whole, which errs on the safe side).
          firstHeight: (items) => rowsHeight(firstRows, 0, firstRows.findIndex((row) => row.end >= items) + 1),
          // A page that keeps its sidebar draws the part in the narrow column too: the rows of that column that cover
          // the items of the range (a row only partly covered counts whole).
          narrowHeight: (from, to) => {
            const ends = lastRows.map((row) => row.end);
            const fromItems = from > 0 ? ends[from - 1] : 0;
            const start = firstRows.findIndex((row) => row.end > fromItems);
            const end = firstRows.findIndex((row) => row.end >= ends[to - 1]) + 1;
            return start < 0 ? 0 : rowsHeight(firstRows, start, end);
          },
        },
        // In the sidebar the rows are those of the narrow column; a sidebar lane may break the list at any row.
        sideSplit: knowledgeZone === "sidebar" && !flat
          ? { ends: firstRows.map((row) => row.end), height: (from, to) => elegantKnowledge
            ? elegantKnowledgeHeight(firstRows, from, to) : rowsHeight(firstRows, from, to) }
          : undefined,
      });
    }
  }
  const certificates = geometry.certs;
  // The plain layouts list every certificate, whatever the styled layout shows of them.
  const plain = Boolean(context.atsMode);
  const certificateHome = flat ? "last" : certificates.home;
  // A template that draws no certificates of its own (home "none") still shows them once it follows its columns:
  // the section list offers them, so the user's choice of a column must reach the output.
  if (visible("certifications") && certifications.length && (plain || zoneFlow || certificateHome !== "none")) {
    const shown = plain || templateId === "kompakt"
      ? certifications
      : certifications.slice(0, certificates.limit ?? certifications.length);
    const width = flat ? geometry.text.fullW * (scale.fullRatio ?? 1) : certificates.zone === "main" ? certificates.w * scale.mainRatio : certificates.w + scale.sideDelta;
    const wrapped = shown.reduce(
      (total, entry) => total + Math.max(0, linesFor(entry.length, width, certificates.font * scale.font, geometry.text.cw) - 1),
      0,
    );
    const model = plain ? geometry.ats.certs : certificates;
    // A template that keeps them in its sidebar draws them on page one; flattened layouts append them.
    const zone = flat ? "main" : ((customLayout || templateId === "tuerkis-profil" ? find("certifications")?.zone : undefined) ?? certificates.zone);
    const legacyHeight = (model.base + model.perItem * shown.length + certificates.pitch * scale.line * wrapped) * scale.textHeight;
    const inSidebar = (zoneFlow || templateId === "elegant") && zone === "sidebar";
    const certificateHeight = (values: readonly string[]) => {
      const extraLines = values.reduce((total, entry) => total + Math.max(0,
        linesFor(entry.length, width, certificates.font * scale.font, geometry.text.cw) - 1), 0);
      return (model.base + model.perItem * values.length + certificates.pitch * scale.line * extraLines) * scale.textHeight;
    };
    /**
     * Tabellarisch draws its certificates as one list across the content width (each once, as the templates list them):
     * the heading, every certificate wrapped with the measured font at the design's line height, 0.45 mm between two.
     * The list breaks between two certificates like a Word list.
     */
    const tabellarischList = templateId === "tabellarisch" && !context.atsMode && scale.wrapText
      ? [...new Set(shown.map((entry) => entry.trim()))] : undefined;
    const tabellarischListHeight = (from: number, to: number) => {
      const bodyMm = certificates.font * scale.font;
      const values = tabellarischList!.slice(from, to);
      return blocks.summary[0] + values.reduce((total, value) => total
        + wrappedLines(value, certificates.w * scale.mainRatio, bodyMm, geometry.text.wrap!.bodyWeight) * bodyMm * geometry.text.lineRatio * scale.line, 0)
        + tabellarischDefaults.layout.bulletGapMm * Math.max(0, values.length - 1);
    };
    flow.push({
      id: "certifications",
      zone,
      height: zoneFlow ? plainListHeight(zone, shown) : tabellarischList ? tabellarischListHeight(0, tabellarischList.length) : legacyHeight,
      ...(tabellarischList && tabellarischList.length > 1
        ? { split: { ends: tabellarischList.map((_, index) => index + 1), height: tabellarischListHeight, minRows: 1 } } : {}),
      // Türkis Profil's main column breaks the list between two certificates, like a word processor.
      ...(templateId === "tuerkis-profil" && zone === "main" && !context.atsMode && shown.length > 1 ? { split: {
        ends: shown.map((_, index) => index + 1),
        height: (from: number, to: number) => plainListHeight("main", shown.slice(from, to), true),
        firstHeight: (items: number) => plainListHeight("main", shown.slice(0, items)),
        narrowHeight: (from: number, to: number) => plainListHeight("main", shown.slice(from, to)),
        minRows: 1,
      } } : {}),
      // A sidebar block that does not fit beside page one goes to the full-width main column of the last page.
      contHeight: zoneFlow ? plainListHeight("main", shown, true) : undefined,
      // A zone-flow template hosts the certificates on page one when their column has room, whatever home the
      // template's own geometry gives them (some draw them beside page one, some behind the career).
      home: zoneFlow || templateId === "elegant" ? "last" : certificateHome === "none" ? "last" : certificateHome,
      rank: managerRank("certifications"),
      hostable: inSidebar,
      sideSplit: inSidebar
        ? { ends: shown.map((_, index) => index + 1), height: (from, to) => elegantSidebar
          // One line box per wrapped line (the list takes 4 mm indent off the column), no gap between two certificates.
          ? elegantSideHeadFor(getResumeSectionTitle(profile, "certifications")) + shown.slice(from, to).reduce((total, value) => total + elegantSideLines(value, ELEGANT_SIDE_LIST_INDENT_MM) * elegantLine, 0)
          : templateId === "elegant" ? certificateHeight(shown.slice(from, to)) * 1.2 : plainListHeight("sidebar", shown.slice(from, to)) }
        : undefined,
    });
  }
  const hostedIds: string[] = [];
  for (const special of profile?.specialSections ?? []) {
    const entry = find(`special:${special.id}`);
    const normalized = normalizeCustomSection(special);
    const careerLike = spacesEntriesLikeCareer(special.kind);
    if (!special.isVisible || entry?.visible === false || !normalized.entries.length) continue;
    const zone = flat ? "main" : entry?.zone ?? "main";
    // The plain layout sets them across its own text width, like the Kurzprofil (not the visual main column).
    const availableWidth = zone === "sidebar" ? geometry.text.sideW + scale.sideDelta
      : (context.atsMode ? geometry.ats.summaryW ?? geometry.text.atsW : geometry.text.mainW) * scale.mainRatio;
    const font = geometry.text.bulletFont * scale.font;
    const pitch = font * geometry.text.lineRatio * scale.line;
    const lineCount = (value: string) => value.trim() ? linesFor(value.trim().length, availableWidth, font, SPECIAL_CW) : 0;
    const visibleTexts = (item: typeof normalized.entries[number]) => special.kind === "projects"
      ? [item.title, item.technologies.join(" · "), item.description]
      : [item.title, item.subtitle, item.location, item.date, item.description, item.url, ...item.bullets];
    const legacyPartHeight = (from: number, to: number) => {
      const shown = normalized.entries.slice(from, to);
      return 9 + shown.reduce((total, item) => {
        const [title, ...rest] = visibleTexts(item);
        const titleGap = careerLike && normalized.contentType === "entries" && title.trim() && rest.some((value) => value.trim()) ? careerLikeContentGap : 0;
        return total + (careerLike ? titleGap : 4) + visibleTexts(item).reduce((lines, value) => lines + lineCount(value) * pitch, 0)
          + customRoleDelta(special.kind, item, availableWidth);
      }, 0) + (careerLike ? careerLikeEntryGap * Math.max(0, shown.length - 1) : 0);
    };
    /**
     * Tabellarisch: Projekte and Hobbys & Interessen as the shared markup draws them (renderCustomSectionContent) across the
     * content width, every text wrapped with the measured font: the entry title (entry title size), the Abstand nach
     * Eintragstitel, the technologies (0.88 of the body size), the other texts in the body size, all at the design's line
     * height; the Eintragsabstand between two entries.
     */
    const tabellarischPartHeight = (from: number, to: number) => {
      const width = geometry.text.mainW * scale.mainRatio;
      const lineHeight = geometry.text.lineRatio * scale.line;
      const bodyMm = geometry.text.bulletFont * scale.font;
      const text = (value: string, fontMm = bodyMm, weight = 400, indent = 0) =>
        value.trim() ? wrappedLines(value, width - indent, fontMm, weight) * fontMm * lineHeight : 0;
      const shown = normalized.entries.slice(from, to);
      return blocks.summary[0] + shown.reduce((total, item) => {
        const headed = item.sectionType === "subsection";
        // The entry title keeps the entry title size of the design, whatever the body size is.
        const title = headed ? text(item.title, scale.titleFont ?? geometry.text.titleFont, 600) : text(item.title);
        const period = item.date.trim() || [item.from, item.to].filter((value) => value.trim()).join(" – ");
        // Technologies, description, organisation and the place-and-period line at the sizes the user chose (place and
        // period stand inline in a line of the body size, which a smaller choice does not lower).
        const metaMm = Math.max(bodyMm, chosenRoleMm(scale, "location", bodyMm), chosenRoleMm(scale, "period", bodyMm));
        const rest = special.kind === "projects"
          ? text(item.technologies.filter((value) => value.trim()).join(" · "), chosenRoleMm(scale, "technologies", bodyMm * 0.88))
            + text(item.description, chosenRoleMm(scale, "description", bodyMm))
          : text(item.subtitle, chosenRoleMm(scale, "organization", bodyMm)) + text([item.location, period].filter((value) => value.trim()).join(" · "), metaMm) + text(item.description)
            + item.bullets.reduce((sum, value) => sum + text(value, bodyMm, 400, tabellarischDefaults.layout.listIndentMm), 0) + text(item.url);
        return total + title + (headed && item.title.trim() && rest > 0 ? careerLikeContentGap : 0) + rest;
      }, 0) + careerLikeEntryGap * Math.max(0, shown.length - 1);
    };
    const tabellarischSpecial = templateId === "tabellarisch" && !context.atsMode && careerLike && scale.wrapText;
    const partHeight = tabellarischSpecial ? tabellarischPartHeight : legacyPartHeight;
    const height = partHeight(0, normalized.entries.length);
    const inSidebar = (zoneFlow || templateId === "elegant") && zone === "sidebar";
    flow.push({
      id: `special:${special.id}`,
      zone,
      height: zoneFlow ? specialHeight(zone, special) : height,
      contHeight: zoneFlow ? specialHeight("main", special, true) : undefined,
      home: "last",
      rank: managerRank(`special:${special.id}`),
      hostable: inSidebar,
      // Projekte and Hobbys & Interessen break between two entries like the career entries do.
      split: (templateId === "modern" || careerLike) && zone === "main" && normalized.entries.length > 1
        ? {
          ends: normalized.entries.map((_, index) => index + 1),
          height: (from, to) => zoneFlow ? specialHeight("main", special, true, [from, to]) : partHeight(from, to),
          firstHeight: (to) => zoneFlow ? specialHeight("main", special, false, [0, to]) : partHeight(0, to),
          narrowHeight: (from, to) => zoneFlow ? specialHeight("main", special, false, [from, to]) : partHeight(from, to),
          minRows: 1,
        }
        : undefined,
      // The entries of a special section are its safe break points in the sidebar.
      sideSplit: inSidebar
        ? { ends: normalized.entries.map((_, index) => index + 1), height: (from, to) => elegantSidebar && normalized.contentType === "list" && !careerLike
          // A plain list in Elegant's sidebar: every text of an entry in lines of its own across the list (4 mm indent), entries 2 mm apart.
          ? elegantSideHeadFor(special.title) + normalized.entries.slice(from, to).reduce((total, item) => total
            + visibleTexts(item).reduce((lines, value) => lines + elegantSideLines(value, ELEGANT_SIDE_LIST_INDENT_MM), 0) * elegantLine, 0)
            + 2 * Math.max(0, Math.min(to, normalized.entries.length) - from - 1)
          : templateId === "elegant" ? legacyPartHeight(from, to) * 1.2 : specialHeight("sidebar", special, false, [from, to]) }
        : undefined,
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
      sideSplit: inSidebar ? groupSideSplit(entry.id) : undefined,
    });
    hostedIds.push(entry.id);
  }

  // Kreativ auxiliary sections follow the complete career run in main, or flow
  // through their own sidebar lane. None is pinned to page one.
  if (templateId === "kreativ") for (const block of flow) {
    block.home = "last";
    block.singleOnly = false;
    block.rank = managerRank(block.id);
    block.hostable = block.zone === "sidebar" && !flat;
  }

  // The gap below a section title (Lebenslauf-Design) is part of every block that has a title.
  if (scale.titleGapDelta) {
    const add = scale.titleGapDelta;
    for (const block of flow) {
      block.height += add;
      if (block.contHeight !== undefined) block.contHeight += add;
      if (block.split) {
        const { height, firstHeight, narrowHeight } = block.split;
        block.split = {
          ...block.split,
          height: (from, to) => height(from, to) + add,
          ...(firstHeight ? { firstHeight: (items: number) => firstHeight(items) + add } : {}),
          ...(narrowHeight ? { narrowHeight: (from: number, to: number) => narrowHeight(from, to) + add } : {}),
        };
      }
      if (block.sideSplit) {
        const { height } = block.sideSplit;
        block.sideSplit = { ...block.sideSplit, height: (from, to) => height(from, to) + add };
      }
    }
  }

  // --- page geometry ----------------------------------------------------------
  // Every continuation page repeats the native first-page header. Kompakt's
  // first header has no contact block, and the added line exceeds its minimum
  // height; the other templates have room for the shared contact line.
  const contactOnContinuation = find("personalData")?.visible !== false && Boolean(profile?.email?.trim() || profile?.phone?.trim());
  // Zeitgenössisch keeps its contacts in the sidebar too: a multi-page CV adds the same contact line to its header.
  const kompaktContactHeight = !context.atsMode && templateId === "zeitgenoessisch" && contactOnContinuation ? 5.5 : 0;
  // The plain layouts measured their offsets with every contact filled; a header that stacks
  // its contacts shrinks with each missing one, and every page repeats it.
  const stackedHeader = context.atsMode ? geometry.ats.header : undefined;
  const stackedHeight = stackedHeader
    ? stackedHeader.base + stackedHeader.perContact * (find("personalData")?.visible === false ? 0 : atsContactLines(templateId, profile))
    : undefined;
  // A bigger Bewerbungsfoto (Fotogröße "Groß") pushes the first section down; the continuation pages repeat the header.
  const photoGrowth = !context.atsMode && resumePhotoShown(profile, context.settings) ? getResumePhotoGrowth(templateId ?? "", profile) : { main: 0, side: 0 };
  // A header that shows more than the measured one (more or longer contacts, a long Berufsbezeichnung or name)
  // pushes the content down; every visual page repeats it (Pehlione's continuation header stays compact).
  const showContacts = find("personalData")?.visible !== false;
  const withPhoto = !context.atsMode && resumePhotoShown(profile, context.settings);
  /**
   * The plain layout's header where it was fitted (estimateAtsHeaderTop): the first section's top on page one and on a
   * later page, from the contacts, the Berufsbezeichnung and the name it shows.
   */
  const atsHeaderTop = (page: "first" | "cont") => context.atsMode ? estimateAtsHeaderTop(templateId, profile, page, showContacts) : undefined;
  const grownTop = (top: number, continuation: boolean) =>
    context.atsMode || (continuation && templateId?.startsWith("pehlione_"))
      ? top
      : estimateResumeHeaderTop(templateId, profile, "main", top, showContacts, withPhoto,
        templateId === "gepflegt" ? scale.mainRatio : 1) ?? top;
  // Gepflegt computes its header from the stylesheet and the measured font (page one with, later pages without contacts).
  const gepflegtHeaderTop = (contacts: boolean) => templateId === "gepflegt" && profile && !context.atsMode && scale.wrapText
    ? estimateGepflegtHeaderTop(profile, {
      contacts,
      widthMm: geometry.text.bulletW * scale.width + (geometry.text.wrap?.listInset ?? 0),
      namePt: context.overrides?.headingSizePt ?? gepflegtDefaults.typography.nameSizePt,
      titlePt: context.overrides?.subheadingSizePt ?? gepflegtDefaults.typography.jobTitleSizePt,
      bodyPt: geometry.text.bulletFont * scale.font / PT_TO_MM,
      lineHeight: geometry.text.lineRatio * scale.line,
    }) + GEPFLEGT_HEADER_RESERVE_MM
    : undefined;
  const klassischHeaderTop = (continuation: boolean) => templateId === "klassisch" && profile
    ? estimateKlassischHeaderTop(profile, {
      continuation,
      contacts: showContacts,
      continuationContacts: showContacts ? [
        profile.resumeContinuationContactVisibility.email ? profile.email : "",
        profile.resumeContinuationContactVisibility.phone ? formatPhoneForDisplay(profile.phone) : "",
      ] : [],
      photoScale: withPhoto ? getResumePhotoScale(profile) : 0,
      contentWidthMm: geometry.text.mainW * scale.mainRatio,
      namePt: context.overrides?.headingSizePt ?? geometry.text.titleFont / PT_TO_MM,
      titlePt: context.overrides?.subheadingSizePt ?? geometry.text.titleFont / PT_TO_MM,
      bodyPt: geometry.text.bulletFont * scale.font / PT_TO_MM,
      lineHeight: geometry.text.lineRatio * scale.line,
      sectionGapMm: sectionGap,
      titleGapMm: klassischDefaults.layout.sectionTitleGapMm + scale.titleGapDelta,
      ats: context.atsMode,
    })
    : undefined;
  // Tabellarisch: page one under its header (calibrated model); later pages under the compact head (name, Berufsbezeichnung, the contacts chosen for later pages), computed from the stylesheet.
  const tabellarischHeaderTop = (continuation: boolean) => {
    if (templateId !== "tabellarisch" || !profile || context.atsMode) return undefined;
    if (continuation) return estimateTabellarischContinuationTop({
      name: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),
      title: profile.title ?? "",
      contacts: showContacts ? [
        profile.resumeContinuationContactVisibility.email ? profile.email : "",
        profile.resumeContinuationContactVisibility.phone ? formatPhoneForDisplay(profile.phone) : "",
      ] : [],
      pageMarginMm: context.overrides?.pageMarginMm,
      sectionGapMm: sectionGap,
    });
    const box = resolveTabellarischGeometry(context.overrides?.pageMarginMm);
    // The model (calibrated on real headers: name and Berufsbezeichnung wraps, the contact grid rows, photo and minimum
    // height; it never fell short) and a small reserve; the section gap of the first section is the chosen one.
    const { top } = estimateTabellarischTop(profile, showContacts, withPhoto, {
      contentWidthMm: box.contentWidth, sectionGapMm: sectionGap,
      namePt: context.overrides?.headingSizePt, titlePt: context.overrides?.subheadingSizePt,
    });
    return top + TABELLARISCH_HEADER_RESERVE_MM;
  };
  // Einspaltig: the same from its own stylesheet (capital name, ruled section titles).
  const einspaltigHeaderTop = (continuation: boolean) => templateId === "einspaltig" && profile
    ? estimateEinspaltigHeaderTop(profile, {
      continuation,
      contacts: showContacts,
      continuationContacts: showContacts ? [
        profile.resumeContinuationContactVisibility.email ? profile.email : "",
        profile.resumeContinuationContactVisibility.phone ? formatPhoneForDisplay(profile.phone) : "",
      ] : [],
      photoScale: withPhoto ? getResumePhotoScale(profile) : 0,
      contentWidthMm: geometry.text.mainW * scale.mainRatio,
      namePt: context.overrides?.headingSizePt ?? einspaltigDefaults.typography.nameSizePt,
      titlePt: context.overrides?.subheadingSizePt ?? einspaltigDefaults.typography.titleSizePt,
      bodyPt: geometry.text.bulletFont * scale.font / PT_TO_MM,
      lineHeight: geometry.text.lineRatio * scale.line,
      sectionHeadingPt: context.overrides?.sectionHeadingPt ?? einspaltigDefaults.typography.sectionHeadingSizePt,
      sectionGapMm: sectionGap,
      titleGapMm: context.overrides?.sectionTitleGapMm ?? einspaltigDefaults.layout.sectionTitleGapMm,
      ats: context.atsMode,
    })
    : undefined;
  const top1 = atsHeaderTop("first") ?? gepflegtHeaderTop(showContacts) ?? tabellarischHeaderTop(false) ?? klassischHeaderTop(false) ?? einspaltigHeaderTop(false) ?? (templateId === "kreativ" && profile && !context.atsMode
    ? estimateKreativHeaderTop(profile, showContacts, withPhoto,
        geometry.text.bulletFont * scale.font * 72 / 25.4, geometry.text.lineRatio * scale.line, scale.marginInset)
    : templateId === "stilvoll" && profile && !context.atsMode
    ? estimateStilvollHeaderTop(profile, showContacts, withPhoto,
        geometry.text.bulletFont * scale.font * 72 / 25.4, geometry.text.lineRatio * scale.line, scale.marginInset,
        context.overrides?.headingSizePt, context.overrides?.subheadingSizePt)
    : templateId === "elegant" && profile && !context.atsMode
    ? estimateElegantHeaderTop(profile, showContacts, scale.marginInset, sectionGap,
        context.overrides?.pageMarginMm ?? elegantDefaults.layout.mainLeftMm,
        context.overrides?.columnGapMm ?? elegantDefaults.layout.columnGapMm,
        geometry.text.lineRatio * scale.line, context.overrides?.headingSizePt,
        context.overrides?.subheadingSizePt, context.overrides?.bodySizePt)
    : templateId === "kompakt" && !context.atsMode
      ? geometry.top1 + photoGrowth.main
      : grownTop((context.atsMode ? stackedHeight ?? geometry.atsTop1 : geometry.top1) + kompaktContactHeight + photoGrowth.main, false));
  const gepflegtName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
  // Gepflegt repeats name and Berufsbezeichnung on every page: top2 holds one line of each (measured 38.5-39.9 mm), every
  // further line adds its line box (name 24 pt × 1.08, title 13 pt × 1.25; characters per line of the main column).
  const gepflegtMainContinuationGrowth = templateId === "gepflegt" && !context.atsMode
    ? Math.max(0, Math.ceil(gepflegtName.length / (17 * scale.mainRatio)) - 1) * 9.14
      + Math.max(0, Math.ceil((profile?.title ?? "").length / (38 * scale.mainRatio)) - 1) * 5.73
    : 0;
  const top2 = atsHeaderTop("cont") ?? gepflegtHeaderTop(false) ?? tabellarischHeaderTop(true) ?? klassischHeaderTop(true) ?? einspaltigHeaderTop(true) ?? ((templateId === "kreativ" || templateId === "stilvoll" || templateId === "gepflegt") && !context.atsMode
    ? geometry.top2 + gepflegtMainContinuationGrowth
    : templateId === "elegant" && !context.atsMode
    ? elegantDefaults.layout.mainTopMm + scale.marginInset + 18.2 + sectionGap
    : templateId === "kompakt" && !context.atsMode
      ? geometry.top2 + (contactOnContinuation ? 5.5 : 0)
    // Türkis Profil's later pages repeat a compact header of their own above the one-column flow (measured: 42 mm in the
    // PDF, the preview starts higher); page one has no header above its main column.
    : templateId === "tuerkis-profil" && !context.atsMode
      ? geometry.top2
      : grownTop((context.atsMode ? stackedHeight ?? geometry.atsTop2 : geometry.top1) + kompaktContactHeight + photoGrowth.main, true));
  const verticalInset = templateId === "elegant" && !context.atsMode
    ? scale.marginInset
    : templateId === "stilvoll" && !context.atsMode
      ? Math.max(0, scale.marginInset) : 2 * scale.marginInset;

  const mainCap1 = (geometry.limit - top1 - verticalInset - (geometry.reserveMm ?? 0)) * (geometry.safety ?? SAFETY);
  const mainCap2 = (geometry.limit - top2 - verticalInset - (geometry.reserveMm ?? 0)) * (geometry.safety ?? SAFETY);
  // Where the first sidebar block starts depends on how many contact entries (and wrapped values) precede it.
  const sidebarHero = zoneFlow && hasSidebarHero(templateId);
  const contactItems = sidebarHero && find("personalData")?.visible !== false ? getPehlioneContacts(profile) : [];
  const contactValueWidth = geometry.text.sideW + scale.sideDelta - CONTACT_ICON_MM;
  const kompaktContacts = templateId === "kompakt" && !context.atsMode && showContacts
    ? getResumeHeaderContactTexts(profile) : [];
  // Kompakt prints contacts above the first managed sidebar block; account for their line boxes and gaps.
  const kompaktSidebarStart = kompaktContacts.length
    ? geometry.sideTop1! + photoGrowth.side + 13
      + kompaktContacts.reduce((height, value) => height + Math.max(1,
        wrappedLines(value, geometry.text.sideW + scale.sideDelta - 6.5, geometry.text.bulletFont * scale.font * .92, 400))
        * geometry.text.bulletFont * scale.font * geometry.text.lineRatio * scale.line, 0)
      + (kompaktContacts.length - 1) * (scale.entryGap ?? 3.2) * .8
    : geometry.sideTop1! + photoGrowth.side;
  /**
   * Türkis Profil's left column on page one (tuerkis-profil.css, measured): the turquoise hero (7 + 6 mm padding, the name
   * in capitals at its size × 1.03 and the Berufsbezeichnung 3 mm below it at its size × 1.25), the photo (3 + 53 mm),
   * the Kontakt list 6 mm below (its title row 9.32 mm; rows of 1 mm padding, the contact line at 1.2 and a 0.2 mm rule,
   * 1.2 mm apart), then the sections of the column from 4 mm below it: the Kurzprofil first, which may go on at the
   * next page like any section of the column.
   */
  const tuerkisHead = (() => {
    if (templateId !== "tuerkis-profil" || context.atsMode || flat || !profile) return undefined;
    const type = tuerkisProfilDefaults.typography;
    const name = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim().toLocaleUpperCase("de-DE");
    const title = (profile.title ?? "").trim();
    const contacts = showContacts ? getZweispaltigContactTexts(profile) : [];
    const inner = geometry.text.sideW + scale.sideDelta - 13;
    const nameMm = (context.overrides?.headingSizePt ?? type.nameSizePt) * PT_TO_MM;
    const titleMm = (context.overrides?.subheadingSizePt ?? type.professionSizePt) * PT_TO_MM;
    const hero = 13 + Math.max(1, wrappedLines(name, inner, nameMm, 750, 0.025)) * nameMm * 1.03
      + (title ? 3 + wrappedLines(title, inner, titleMm, 600, 0.02) * titleMm * 1.25 : 0);
    const photo = withPhoto ? tuerkisProfilDefaults.layout.photoGapMm + tuerkisProfilDefaults.layout.photoHeightMm : 0;
    const rowLine = type.contactSizePt * PT_TO_MM * 1.2;
    const rowWidth = geometry.text.sideW + scale.sideDelta - 4.7;
    const rows = contacts.map((value) => 2.2 + Math.max(1, wrappedLines(value, rowWidth, type.contactSizePt * PT_TO_MM)) * rowLine);
    // The list's title (14 pt capitals): every further line adds its line box. A part that goes on at a later page says
    // "· Fortsetzung" and stands across the page width there.
    const listTitle = getPersonalDataTitle(profile.resumeSemanticSections, templateId).toLocaleUpperCase("de-DE");
    const sectionTitleMm = 14 * PT_TO_MM;
    const titleExtra = (continued: boolean) => (Math.max(1, wrappedLines(continued ? `${listTitle} · FORTSETZUNG` : listTitle,
      continued ? geometry.text.fullW * (scale.fullRatio ?? 1) : geometry.text.sideW + scale.sideDelta, sectionTitleMm, 750, 0.16)) - 1) * sectionTitleMm;
    /** The rows `from`..`to` of the list with its title (and, opening it below the photo, its 6 mm). */
    const list = (from: number, to: number) => (from === 0 ? 6 : 0) + 9.32 + titleExtra(from > 0) + sumHeights(rows.slice(from, to), 1.2);
    return { top: geometry.top1 + hero + photo, rows, list };
  })();
  /**
   * A Kontakt list that does not fit below the hero and the photo of page one breaks between two rows like a section of
   * the column: it opens the Seitenspalte lane (`contactsLane`), its rest and the column's sections go on at the next page.
   */
  const tuerkisContactsBreak = Boolean(tuerkisHead?.rows.length)
    && tuerkisHead!.top + tuerkisHead!.list(0, tuerkisHead!.rows.length) > geometry.sideLimit - verticalInset;
  const tuerkisSideTop = !tuerkisHead ? undefined
    : tuerkisContactsBreak ? tuerkisHead.top
    : tuerkisHead.top + 4 + (tuerkisHead.rows.length ? tuerkisHead.list(0, tuerkisHead.rows.length) : 0);
  const sideTop1 = tuerkisSideTop !== undefined ? tuerkisSideTop
    : (templateId === "kreativ" || templateId === "stilvoll") && !context.atsMode
    ? top1
    : templateId === "kompakt" && !context.atsMode ? kompaktSidebarStart
    : sidebarHero && geometry.sideTop1 !== null
    ? SIDEBAR_HERO_MM + photoGrowth.side + (contactItems.length
      ? CONTACT_HEAD_MM
        + contactItems.reduce((total, item) => total + CONTACT_ITEM_MM
          + (listLines(item.value.length, contactValueWidth, CONTACT_FONT_MM * scale.font) - 1) * CONTACT_LINE_MM, 0)
        + CONTACT_GAP_MM
      : 0)
    : geometry.sideTop1 === null ? null
      : context.atsMode ? geometry.sideTop1 + photoGrowth.side
        : templateId === "kompakt" ? geometry.sideTop1 + photoGrowth.side
        : estimateResumeHeaderTop(templateId, profile, "side", geometry.sideTop1 + photoGrowth.side, showContacts, withPhoto) ?? geometry.sideTop1 + photoGrowth.side;
  const sideCap1 = sideTop1 === null || flat
    ? 0
    // Elegant's sidebar blocks are computed from its stylesheet: a fixed reserve for rounding instead of 3 % of the column.
    : elegantSidebar ? geometry.sideLimit - sideTop1 - verticalInset - ELEGANT_SIDE_RESERVE_MM
    : (geometry.sideLimit - sideTop1 - verticalInset) * (zoneFlow ? ZONE_FLOW_SIDEBAR_SAFETY : SAFETY);
  const dense = context.atsMode ? geometry.ats.density : geometry.density;

  /**
   * A template with a continuation sidebar lets its sidebar run through the pages as a lane of its own, independent
   * of the main column: the sections of the Seitenspalte keep their order, fill every page down to its usable
   * bottom, and a section that does not fit breaks at an item boundary and goes on in the sidebar of the next page.
   */
  const sidebarLane = (zoneFlow && supportsSidebarContinuation(templateId) || templateId === "elegant" && !context.atsMode)
    && sideCap1 > 0 && !flat;
  /**
   * The sections the plan places itself although the template draws them on page one (Kurzprofil, Stärken, Sprachen):
   * the output follows the plan for them (`placed`, `sectionOnPage`).
   */
  const selfPlaced = new Set<string>();
  // The plain layout of `atsFlowTemplates` (atsFlow) places its Sprachen and Zertifikate itself.
  // (Kreativ's and Türkis Profil's outputs place their Stärken by the plan too, so the templates draw them there.)
  if (atsFlow) for (const block of flow)
    if (block.id === "languages" || block.id === "certifications" || ((templateId === "kreativ" || templateId === "tuerkis-profil") && block.id === "strengths")) selfPlaced.add(block.id);
  // Word-processor flow of the Seitenspalte: when its sections do not all fit beside page one, every one of them
  // (also those the template draws on page one) joins the lane in the order of the section list. A section never
  // starts while the one before it still goes on: a Kurzprofil that breaks at the page end continues at the top of
  // the next page's sidebar, and Stärken and Sprachen follow it there.
  const sidebarStream = flow.filter((block) => block.zone === "sidebar" && !block.singleOnly && (block.home === "first" || block.hostable));
  /**
   * Türkis Profil's Bildungsweg in the Seitenspalte joins that stream at its place in the section list: the lane
   * breaks it between two entries like any other section of the column (its entries stay plan items; see `besideItems`).
   */
  const besideList = educationBeside ? items.filter((item) => !inMainFirst(item)) : [];
  const educationLane: FlowBlock | undefined = sidebarLane && besideList.length ? {
    id: "education", zone: "sidebar", home: "last", rank: managerRank("education"), hostable: true,
    height: besideHeight(besideList),
    sideSplit: { ends: besideList.map((_, index) => index + 1), height: (from, to) => besideHeight(besideList.slice(from, to)) },
  } : undefined;
  /**
   * Türkis Profil's Kontakt list where it breaks (`tuerkisContactsBreak`): the first block of the lane, its rows the
   * contacts. The output draws the rows of each page in the list's place (tuerkisProfilLayout).
   */
  const contactsLane: FlowBlock | undefined = sidebarLane && tuerkisContactsBreak && tuerkisHead ? {
    id: "personalData", zone: "sidebar", home: "last", hostable: true,
    height: tuerkisHead.list(0, tuerkisHead.rows.length),
    sideSplit: { ends: tuerkisHead.rows.map((_, index) => index + 1), height: (from, to) => tuerkisHead.list(from, to) },
  } : undefined;
  if (sidebarLane && sumHeights([...(contactsLane ? [contactsLane] : []), ...sidebarStream, ...(educationLane ? [educationLane] : [])]
    .map((block) => block.height + (block === educationLane ? 0 : sideTitleExtra(block.id))), sideGap) > sideCap1) {
    for (const block of sidebarStream) {
      if (block.home !== "first") continue;
      block.home = "last";
      block.hostable = true;
      selfPlaced.add(block.id);
    }
  }
  // A hand-arranged layout that puts a section of the main column behind the career sections: it follows the career
  // entries like any later block (it never stands on page one while the career goes on below it on the next page).
  // Türkis Profil arranges its page by the section list from the start (its default list has them behind the career).
  if ((zoneFlow || templateId === "elegant") && (customLayout || templateId === "tuerkis-profil") && !flat && templateId !== "kreativ") {
    for (const block of flow) {
      if (block.zone !== "main" || block.home !== "first" || block.singleOnly || managerRank(block.id) < careerRank) continue;
      block.home = "last";
      selfPlaced.add(block.id);
    }
  }

  /**
   * A column laid out as one stream in the order of the section list (`ids`), like a word processor: every section
   * starts below the one before it, a career entry breaks between bullets, a list block at a row and a paragraph at a
   * word (two lines on each side). The pages from `reserveFrom` on keep the closing's room.
   */
  type StreamPage = { plan: ResumePagePlan; used: number; lastKind?: ResumePageItem["kind"]; lastGap: number };
  type StreamSpec = {
    ids: readonly string[];
    capacity: (pageNumber: number, reserveFrom: number) => number;
    /** Metrics of the career entries on a page: beside a sidebar ("first") or across the page ("cont"). */
    mode: (pageNumber: number) => "first" | "cont";
    /** Height of a block, or of the rows `from`..`to` of a block that breaks, on a page. */
    blockHeight: (block: FlowBlock, pageNumber: number, from: number, to: number) => number;
    sidebar: (pageNumber: number) => boolean;
    /** Blocks that never start on page one (page one draws them in its sidebar). */
    laterPagesOnly?: ReadonlySet<string>;
  };
  const layoutStream = (spec: StreamSpec, reserveFrom: number) => {
    const pages: StreamPage[] = [];
    const capacity = (number: number) => Math.max(1, spec.capacity(number, reserveFrom));
    const nextPage = () => {
      const plan: ResumePagePlan = { pageNumber: pages.length + 1, items: [], blocks: [], density: "standard", sidebar: spec.sidebar(pages.length + 1),
        fill: { main: 0, sidebar: 0 } };
      const page: StreamPage = { plan, used: 0, lastGap: 0 };
      pages.push(page);
      return page;
    };
    let page = nextPage();
    const addBlock = (block: FlowBlock, from = 0, to = block.split?.ends.length ?? 0) => {
      const height = spec.blockHeight(block, page.plan.pageNumber, from, to);
      const gap = page.used > 0 ? sectionGap : 0;
      page.used += gap + height;
      page.plan.blocks!.push(block.id);
      if (block.split && (from > 0 || to < block.split.ends.length)) {
        const ends = block.split.ends;
        (page.plan.blockRanges ??= {})[block.id] = { from: from ? ends[from - 1] : 0,
          to: ends[to - 1], total: ends[ends.length - 1] };
      }
      page.lastKind = undefined;
    };
    const addItem = (item: MeasuredItem, from: number, to: number) => {
      const mode = spec.mode(page.plan.pageNumber);
      const shown = item.parts && (from > 0 || to < item.parts[mode].lines.length)
        ? { kind: item.kind, id: item.id, weight: Math.round(item.parts[mode].height(from, to) * 10) / 10,
          bullets: { from, to, total: item.parts[mode].lines.length } }
        : strip(item, mode);
      const gap = page.lastKind === item.kind ? page.lastGap : (page.used > 0 ? sectionGap : 0) + sectionHead(item.kind);
      page.used += gap + (item.parts ? item.parts[mode].height(from, to) : item[mode]);
      page.plan.items.push(shown);
      page.lastKind = item.kind;
      page.lastGap = item.gapAfter;
    };
    const seen = new Set<string>();
    for (const id of spec.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (id === "experience" || id === "education") {
        for (const item of items.filter((entry) => entry.kind === id)) {
          const total = item.parts?.first.lines.length ?? 0;
          let from = 0;
          while (true) {
            const mode = spec.mode(page.plan.pageNumber);
            const heading = page.lastKind === item.kind ? page.lastGap : (page.used > 0 ? sectionGap : 0) + sectionHead(item.kind);
            const fullHeight = item.parts ? item.parts[mode].height(from, total) : item[mode];
            if (page.used + heading + fullHeight <= capacity(page.plan.pageNumber) || (!page.used && !item.parts)) {
              addItem(item, from, total);
              break;
            }
            let end = from;
            if (item.parts) for (let candidate = from + 1; candidate < total; candidate += 1) {
              const before = item.parts[mode].lines.slice(from, candidate).reduce((sum, lines) => sum + lines, 0);
              const after = item.parts.cont.lines.slice(candidate).reduce((sum, lines) => sum + lines, 0);
              if (before < minLinesBefore(item.kind) || after < MIN_SPLIT_LINES) continue;
              if (page.used + heading + item.parts[mode].height(from, candidate) <= capacity(page.plan.pageNumber)) end = candidate;
            }
            if (end > from) {
              addItem(item, from, end);
              from = end;
              page = nextPage();
            } else if (page.used > 0) page = nextPage();
            else {
              addItem(item, from, total);
              break;
            }
          }
        }
        continue;
      }
      const block = flow.find((entry) => entry.id === id);
      if (!block) continue;
      if (spec.laterPagesOnly?.has(block.id) && page.plan.pageNumber === 1) page = nextPage();
      if (!block.split) {
        if (page.used && page.used + sectionGap + spec.blockHeight(block, page.plan.pageNumber, 0, 0) > capacity(page.plan.pageNumber)) page = nextPage();
        addBlock(block);
        continue;
      }
      let from = 0;
      const { ends, lines } = block.split;
      while (from < ends.length) {
        const gap = page.used > 0 ? sectionGap : 0;
        let end = from;
        for (let candidate = from + 1; candidate <= ends.length; candidate += 1) {
          if (page.used + gap + spec.blockHeight(block, page.plan.pageNumber, from, candidate) > capacity(page.plan.pageNumber)) {
            // A paragraph's parts only grow with the words they take.
            if (lines) break;
            continue;
          }
          // A paragraph keeps two lines on either side of a break (no widow, no orphan).
          if (candidate === ends.length || paragraphBreakAllowed(lines, from, candidate, ends.length)) end = candidate;
        }
        if (end === from && page.used > 0) { page = nextPage(); continue; }
        if (end === from) end = from + 1;
        addBlock(block, from, end);
        from = end;
        if (from < ends.length) page = nextPage();
      }
    }
    return pages;
  };
  /** The stream with the closing below the last page's content: when it has no room there, that page and the following ones keep it. */
  const streamWithClosing = (spec: StreamSpec, lastPageClosing: boolean, closingRoom: number, pageCap: (number: number) => number) => {
    let pages = layoutStream(spec, lastPageClosing ? Number.POSITIVE_INFINITY : 1);
    for (let attempt = 0; lastPageClosing && closingRoom > 0 && attempt < 3; attempt += 1) {
      const last = pages[pages.length - 1];
      if (last.used + closingRoom <= pageCap(last.plan.pageNumber)) break;
      pages = layoutStream(spec, last.plan.pageNumber);
    }
    return pages;
  };

  // A hand-arranged single-column document is one stream, including blocks
  // between the two career sections. Their saved sidebar zones remain metadata.
  if (flat && (templateId === "tabellarisch" || (customLayout && !context.atsMode))) {
    // Tabellarisch keeps the closing's room on the last page only (where it is drawn); the other one-column layouts keep
    // it on every page.
    const lastPageClosing = templateId === "tabellarisch" && !context.atsMode;
    const closingRoom = lastPageClosing ? tabellarischClosingRoom : closingHeight;
    const pageCap = (number: number) => (number === 1 ? mainCap1 : mainCap2);
    const ids = context.sections?.filter((entry) => entry.visible && !["heading", "personalData", "photo", "closing"].includes(entry.id))
      .map((entry) => entry.id) ?? ["summary", "strengths", "experience", "education", ...flow.map((block) => block.id)];
    const pages = streamWithClosing({
      ids,
      capacity: (number, reserveFrom) => pageCap(number) - (!lastPageClosing || number >= reserveFrom ? closingRoom : 0),
      mode: (number) => (number === 1 ? "first" : "cont"),
      blockHeight: (block, _number, from, to) => (block.split ? block.split.height(from, to) : block.height),
      sidebar: () => false,
    }, lastPageClosing, closingRoom, pageCap);
    pages.forEach((entry, index) => {
      entry.plan.fill = { main: (entry.used + (index === pages.length - 1 ? closingRoom : 0)) /
        (index === 0 ? mainCap1 : mainCap2), sidebar: 0 };
    });
    return pages.map((entry) => entry.plan);
  }

  // Modern's generic sidebar block measurements include extra line reserve that its compact renderer does not draw.
  // Retain enough headroom for long sidebar text at the page boundary.
  const sidebarHeight = (block: FlowBlock) => templateId === "modern" ? block.height * 0.96 : block.height;
  const blockLoad =(blocksOfZone: FlowBlock[], zone: PaginationZone) => {
    const heights = blocksOfZone.filter((block) => block.zone === zone)
      .map((block) => zone === "sidebar" ? sidebarHeight(block) : block.height);
    return sumHeights(heights, zone === "sidebar" ? sideGap : sectionGap);
  };
  const firstBlocks = flow.filter((block) => block.home === "first" && !block.singleOnly);
  const singleOnlyBlocks = flow.filter((block) => block.singleOnly);
  const lastBlocks = flow.filter((block) => block.home === "last");
  const hostable = lastBlocks.filter((block) => block.hostable);
  // The sidebar fills in the order of the user's layout.
  // A sidebar lane is one stream in the order both outputs draw the column in: the order of a hand-arranged section
  // list, else the template's own order of its sidebar (`templateSidebarOrder`: a saved section layout's or the native
  // one; sections it does not draw itself join in the order of the list behind them).
  const sidebarOrder = customLayout ? undefined : templateSidebarOrder(profile, templateId);
  const laneRank = (id: string) => {
    const native = sidebarOrder?.indexOf(id) ?? -1;
    return native >= 0 ? native : 1000 + managerRank(id);
  };
  if (educationLane) hostable.push(educationLane);
  if (sidebarLane) hostable.sort((left, right) => laneRank(left.id) - laneRank(right.id));
  else if (zoneFlow && customLayout) hostable.sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0));
  // (the Kontakt list stands above every section of the column)
  if (contactsLane) hostable.unshift(contactsLane);

  const stack = (fixed: number, run: number) => fixed + run + (fixed > 0 && run > 0 ? sectionGap : 0);
  const wholeMain = () =>
    stack(blockLoad([...firstBlocks, ...singleOnlyBlocks], "main"), stack(itemsHeight(items.filter(inMainFirst), "first"), blockLoad(lastBlocks, "main"))) + closingHeight;
  const wholeSide = () => {
    const blocksLoad = blockLoad([...firstBlocks, ...singleOnlyBlocks, ...lastBlocks], "sidebar");
    const beside = besideHeight(items);
    return blocksLoad + beside + (blocksLoad > 0 && beside > 0 ? sideGap : 0);
  };

  const forced = options.firstPageItemCount;
  /** Every page names the sections the plan places itself (`selfPlaced`): the output draws them where `blocks` say. */
  const withPlaced = (plan: ResumePagePlan[]): ResumePagePlan[] => selfPlaced.size
    ? plan.map((page) => ({ ...page, placed: [...new Set([...(page.placed ?? []), ...selfPlaced])] }))
    : plan;
  const onePage = (density: ResumePagePlan["density"]): ResumePagePlan[] => withPlaced([
    {
      pageNumber: 1,
      items: items.map((item) => strip(item, "first")),
      density,
      blocks: flow.filter((block) => block.home === "last" || block.hostable || ordered || atsFlow).map((block) => block.id),
      sidebar: geometry.columns === 2 && !flat,
      fill: { main: wholeMain() / mainCap1, sidebar: sideCap1 ? wholeSide() / sideCap1 : 0 },
    },
  ]);
  const fitsOnePage = wholeMain() <= mainCap1 && (sideCap1 === 0 || wholeSide() <= sideCap1);
  if (fitsOnePage && forced === undefined) return onePage("standard");
  // A block shown on a single page only (Stärken derived from the skills) that the plain layout leaves out of a longer
  // résumé: it is placed nowhere, so neither surface draws it on its fallback page.
  if (atsFlow) for (const block of singleOnlyBlocks) selfPlaced.add(block.id);
  // A slightly compacted single page beats a second page that would be nearly empty,
  // but only with a real margin: the estimate must not be trusted to the last millimetre.
  // The lists of a zone-flow sidebar keep their size in every density: compaction earns that column nothing.
  const sideShrink = (factor: number) => (zoneFlow ? 1 : factor);
  const fitsCompact =
    wholeMain() * dense.compact <= mainCap1 * COMPACT_MARGIN &&
    (sideCap1 === 0 || wholeSide() * sideShrink(dense.compact) <= sideCap1 * COMPACT_MARGIN);

  // Sidebar blocks move to page one whenever that column has room for them.
  const hostedOnFirst = new Set<string>();
  type LaneSegment = { block: FlowBlock; from: number; to: number };
  const lanePages: LaneSegment[][] = [[]];
  const sideSegmentHeight = ({ block, from, to }: LaneSegment) => {
    const height = block.sideSplit ? block.sideSplit.height(from, to) : block.height;
    // (the Bildungsweg's lane block counts its title already)
    return (templateId === "elegant" && block.id === "knowledge" && !elegantSidebar ? height * 1.35 : height)
      + (block.id === "education" ? 0 : sideTitleExtra(block.id));
  };
  /**
   * Türkis Profil draws the rest of its Seitenspalte across the page width on the later pages: a list may take more
   * rows there (its grid follows the wider column) than in the column, so the taller of the two counts.
   */
  const segmentHeight = (segment: LaneSegment, page = 0) => {
    const side = sideSegmentHeight(segment);
    const { block, from, to } = segment;
    if (templateId !== "tuerkis-profil" || page === 0) return side;
    const ends = block.sideSplit?.ends;
    if (!block.split || !ends) return Math.max(side, from === 0 && to === (ends?.length ?? 1) ? block.contHeight ?? block.height : side);
    const fromItems = from > 0 ? ends[from - 1] : 0;
    const toItems = ends[to - 1];
    const start = block.split.ends.findIndex((end) => end > fromItems);
    const stop = block.split.ends.findIndex((end) => end >= toItems) + 1;
    return start < 0 || stop <= start ? side : Math.max(side, block.split.height(start, stop));
  };

  // Elegant and Gepflegt repeat only the page cue and optional contacts in the continuation sidebar (name and
  // Berufsbezeichnung stand in the header of the main column).
  const continuationSideContacts = (profile?.resumeContinuationContactVisibility.email && profile.email ? 1 : 0)
    + (profile?.resumeContinuationContactVisibility.phone && profile.phone ? 1 : 0);
  // Gepflegt: cue and contacts are small lines (max(9 pt, 0.88 × body) × line height) below the sidebar padding;
  // the first contact stands 3 mm, the next 2 mm below (measured: cue 14–18.4 mm, contacts to 32.3 mm).
  const gepflegtSmallLine = Math.max(9 * PT_TO_MM, geometry.text.bulletFont * scale.font * 0.88) * geometry.text.lineRatio * scale.line;
  const sideTop2 = templateId === "elegant" && !context.atsMode
    ? elegantDefaults.layout.sidebarTopMm + scale.marginInset + 4 + sectionGap + continuationSideContacts * 6
    : templateId === "gepflegt" && !context.atsMode
    ? gepflegtDefaults.sidebar.paddingTopMm + gepflegtSmallLine
      + (continuationSideContacts ? 1 + continuationSideContacts * (2 + gepflegtSmallLine) : 0)
      + GEPFLEGT_CONTINUATION_SIDE_RESERVE_MM
    : top2;
  const sideCap2 = (geometry.sideLimit - sideTop2 - verticalInset) * ZONE_FLOW_SIDEBAR_SAFETY;
  if (sidebarLane) {
    // Türkis Profil's later pages have one column: what the sidebar of page one has no room for opens the next page,
    // above its main column (tuerkisProfilLayout), and takes its room there (`laneRestOn`), as far down as that page goes.
    const capacity = (page: number) => page > 0 && templateId === "tuerkis-profil" ? mainCap2 - sectionGap
      : (page === 0 ? sideCap1 : sideCap2) * ZONE_FLOW_HOST_SHARE;
    let used = blockLoad(firstBlocks, "sidebar");
    for (const block of hostable) {
      const rows = block.sideSplit?.ends.length ?? 1;
      let from = 0;
      while (from < rows) {
        const page = lanePages.length - 1;
        const gap = used > 0 ? sideGap : 0;
        const whole = { block, from, to: rows };
        if (used + gap + segmentHeight(whole, page) <= capacity(page)) {
          lanePages[page].push(whole);
          used += gap + segmentHeight(whole, page);
          break;
        }
        // The part that fits: the heading and at least one row here, and a widow-free rest on the next page.
        let best = from;
        if (block.sideSplit) {
          // A Kurzprofil keeps a few words together on either side (its rows are words) and, where its lines are known,
          // at least two lines on each page (no widow, no orphan).
          const words = block.id === "summary" ? ELEGANT_SUMMARY_MIN_WORDS : 0;
          const { lines } = block.sideSplit;
          for (let end = from + Math.max(LANE_MIN_ROWS_BEFORE, words); end <= rows - Math.max(LANE_MIN_ROWS_AFTER, words); end += 1) {
            // The parts only grow with `end`: past the first one that is too tall none fits.
            if (used + gap + segmentHeight({ block, from, to: end }, page) > capacity(page)) break;
            if (paragraphBreakAllowed(lines, from, end, rows)) best = end;
          }
        }
        if (best > from) {
          lanePages[page].push({ block, from, to: best });
          lanePages.push([]);
          used = 0;
          from = best;
          continue;
        }
        // Not even the start fits below what the page already holds: the block starts on the next page. A block
        // that does not fit an empty page either is drawn there whole rather than looping. Türkis Profil's first
        // page is never empty (hero, photo and maybe Kontakt above the column): the next one has its full room.
        if (used === 0 && !(page === 0 && templateId === "tuerkis-profil")) {
          lanePages[page].push(whole);
          used = segmentHeight(whole, page);
          break;
        }
        lanePages.push([]);
        used = 0;
      }
    }
    for (const segment of lanePages[0]) hostedOnFirst.add(segment.block.id);
  } else if (sideCap1) {
    let sideLoad = blockLoad(firstBlocks, "sidebar");
    for (const block of hostable) {
      const next = sideLoad + (sideLoad > 0 ? sideGap : 0) + sidebarHeight(block);
      if (next <= sideCap1 * (zoneFlow ? ZONE_FLOW_HOST_SHARE : SIDEBAR_HOST_SHARE)) {
        hostedOnFirst.add(block.id);
        sideLoad = next;
      }
    }
  }
  // The Bildungsweg's entries are plan items: page one takes those its lane part covers, the rest opens the next page.
  const besideOnFirst = lanePages[0].find((segment) => segment.block === educationLane)?.to ?? 0;
  for (const [index, segments] of lanePages.entries()) lanePages[index] = segments.filter((segment) => segment.block !== educationLane);
  // An empty trailing page of the lane is no page.
  while (lanePages.length > 1 && !lanePages[lanePages.length - 1].length) lanePages.pop();
  /** The lane carries sidebar content beyond page one: the document needs a second page whatever the main column does. */
  const laneSpill = lanePages.length > 1;
  /**
   * A page that keeps its sidebar keeps its narrow main column: what the main column holds there is measured like on
   * page one, not like on a continuation page where the column takes the full width.
   */
  const laneOn = (page: number) => (templateId === "elegant" && !context.atsMode && page > 0)
    || (sidebarLane && Boolean(lanePages[page]?.length) && (page === 0 || templateId !== "tuerkis-profil"));
  const pageMode = (page: number): "first" | "cont" => (laneOn(page) ? "first" : "cont");
  const laneLoad = (page: number) => sumHeights(
    [...(page === 0 ? firstBlocks.filter((block) => block.zone === "sidebar").map((block) => block.height + sideTitleExtra(block.id)) : []), ...lanePages[page].map((segment) => segmentHeight(segment, page))],
    sideGap,
  );
  /**
   * Türkis Profil: the rest of the Seitenspalte stands above the main column of a later page and takes its room there,
   * with one more section gap for a main section that runs on above it (tuerkisProfilLayout).
   */
  const laneRestOn = (page: number) => templateId === "tuerkis-profil" && page > 0 && lanePages[page]?.length ? laneLoad(page) + sectionGap : 0;
  const laneRest = laneRestOn(1);
  // Zone flow and Elegant: the main column keeps the order of the user's layout. A block that stands above the
  // career sections belongs to page one; the others follow the career entries, and start on page one
  // for as long as it has room.
  const headBlocks = (zoneFlow || templateId === "elegant" || ordered) && customLayout && templateId !== "kreativ"
    ? lastBlocks.filter((block) => !hostedOnFirst.has(block.id) && block.zone === "main" && rankOf(block) < careerRank)
    : [];
  const pageOneFlow = [...firstBlocks, ...lastBlocks.filter((block) => hostedOnFirst.has(block.id) || headBlocks.includes(block))];
  // The sidebar lane places its blocks on every page itself: none of them flows into the main column.
  const inLane = (block: FlowBlock) => sidebarLane && lanePages.some((segments) => segments.some((segment) => segment.block === block));
  const pageTwoFlow = lastBlocks.filter((block) => !hostedOnFirst.has(block.id) && !headBlocks.includes(block) && !inLane(block));
  /** A zone-flow section of the Seitenspalte without room beside page one and without a lane: it goes on in the main column. */
  const spilled = (block: FlowBlock) => (zoneFlow || templateId === "elegant") && !sidebarLane && block.zone === "sidebar" && pageTwoFlow.includes(block);
  // The last page has no sidebar: a sidebar block that stays there flows into the full-width main column.
  const contOf = (block: FlowBlock) => block.contHeight ?? block.height;
  /** The height of a block of the main column on page `page` (0-based), by the width the column has there. */
  const heightOn = (block: FlowBlock, page: number) => (laneOn(page) ? block.height : contOf(block));
  const splitHeightOn = (split: NonNullable<FlowBlock["split"]>, from: number, to: number, page: number) =>
    laneOn(page) && split.narrowHeight ? split.narrowHeight(from, to) : split.height(from, to);
  // The blocks behind the career entries keep the order their template draws them in. Only
  // a leading run of blocks the plan can place (Pehlione's project highlight, the knowledge
  // list) may start on page one; everything after the first fixed block is drawn by the
  // template itself on the last page. A hand-arranged layout keeps its own order.
  const nativeTail = templateId === "tabellarisch" && !context.atsMode
    ? ["certifications", "languages", "knowledge"]
    : templateId === "gepflegt" && flat
      ? ["languages", "knowledge"]
      : ["projects", "knowledge", "languages", "certifications"];
  /** A plain layout that places its Sprachen section itself (a plain list the output draws, resumeManagedOutput). */
  const atsLanguages = Boolean(context.atsMode) && isPlainListSection(templateId, "languages");
  const tail: FlowBlock[] = [];
  if (zoneFlow || templateId === "elegant") {
    // Every block of the main column can start on page one: the project highlight and the knowledge
    // list first, then the free groups, the certificates and the special sections (the order the
    // template draws them in), or the order of the user's layout.
    const nativeRank = (id: string) =>
      id === "projects" ? 0 : id === "knowledge" ? 1 : id.startsWith("group:") ? 2 : id === "certifications" ? 3 : 4;
    // A section of the Seitenspalte that has no room beside page one and no lane to go on in (`spilled`) is drawn in
    // the main column of the later pages, at its place in the order: it joins that stream there, never after it.
    tail.push(
      ...pageTwoFlow
        .filter((block) => block.zone === "main" || spilled(block))
        .sort((left, right) => customLayout || ordered || templateId === "tuerkis-profil"
          ? byRank(left, right)
          : nativeRank(left.id) - nativeRank(right.id)),
    );
  } else if (atsFlow) {
    // Both outputs draw these blocks where the plan names them, in the order of the section list: the leading run of
    // the ones they can place on any page starts on page one, the rest follows on the next pages.
    const placeable = (block: FlowBlock) => ["knowledge", "languages", "certifications", "projects"].includes(block.id)
      || block.id.startsWith("special:") || block.id.startsWith("group:")
      // The ordered templates draw Kurzprofil and Stärken by the plan too; the output of a list that puts them behind the
      // career places them (a hand-arranged one, Kreativ's and Türkis Profil's own).
      || ((ordered || zonesFromList) && (block.id === "summary" || block.id === "strengths"));
    for (const block of [...pageTwoFlow].sort((left, right) => managerRank(left.id) - managerRank(right.id))) {
      if (!placeable(block)) break;
      tail.push(block);
    }
  } else if (!customLayout && atsLanguages) {
    // The output draws these blocks in the order of the section list (it inserts each by its rank): the leading run of the
    // ones it can place on any page may start on page one, up to the first block the template draws itself.
    const placeable = (block: FlowBlock) => ["projects", "knowledge", "languages"].includes(block.id)
      || block.id.startsWith("special:") || block.id.startsWith("group:");
    for (const block of [...pageTwoFlow].sort((left, right) => managerRank(left.id) - managerRank(right.id))) {
      if (!placeable(block)) break;
      tail.push(block);
    }
  } else if (!customLayout) {
    for (const id of nativeTail) {
      const block = pageTwoFlow.find((candidate) => candidate.id === id);
      if (!block) continue;
      if ((id === "projects" || id === "knowledge") && (flat || block.zone === "main")) tail.push(block);
      else break;
    }
  }
  const pinned = pageTwoFlow.filter((block) => !tail.includes(block));
  /** Page one draws a spilled sidebar section in its sidebar: the tail on page one stops before the first of them. */
  const tailOnFirst = tail.some(spilled) ? tail.findIndex(spilled) : tail.length;
  // The ordered one-column templates draw the blocks behind the career in the order of the list on every page.
  if (ordered) pinned.sort(byRank);
  const pinnedLoad = sumHeights(pinned.map((block) => heightOn(block, 1)), sectionGap);
  const load1Fixed = blockLoad(pageOneFlow, "main");
  const sideLoadOne = sidebarLane ? laneLoad(0) : blockLoad(pageOneFlow, "sidebar");
  const sideFill = sideCap1 ? sideLoadOne / sideCap1 : 0;

  // --- where page one ends ------------------------------------------------------
  /**
   * Page one ends after `count` whole entries, then `kept` bullets of the next experience,
   * then `tail` whole blocks, then `rows` grid rows of the next block.
   */
  type Cut = { count: number; kept: number; tail: number; rows: number };
  /**
   * The entries of the main column's stream that the cut walks through. Entries page one draws in its sidebar (Türkis
   * Profil's Bildungsweg) are no part of it: the main column goes on behind the career whatever they do, and page one
   * takes as many of them as its sidebar has room for (the rest opens the next page, which has one column).
   */
  const cutItems = educationBeside ? items.filter(inMainFirst) : items;
  const besideItems = besideList;
  let besideCount = educationLane ? besideOnFirst : 0;
  while (!educationLane && besideCount < besideItems.length) {
    const beside = besideHeight(besideItems.slice(0, besideCount + 1));
    if (sideLoadOne + (sideLoadOne > 0 ? sideGap : 0) + beside > sideCap1) break;
    besideCount += 1;
  }
  const besideFirst = besideItems.slice(0, besideCount);
  const besideRest = besideItems.slice(besideCount);
  /** What page one's sidebar holds with the entries it draws beside the career. */
  const sideLoadFirst = sideLoadOne + besideHeight(besideFirst) + (sideLoadOne > 0 && besideCount > 0 ? sideGap : 0);
  const totalBullets = (item: MeasuredItem) => item.parts?.first.lines.length ?? 0;
  /** Bullet counts after which an entry may break without leaving a widow or an orphan. */
  const breakPoints = (item: MeasuredItem): number[] => {
    if (!item.parts) return [];
    const points: number[] = [];
    for (let kept = 1; kept < totalBullets(item); kept += 1) {
      const before = item.parts.first.lines.slice(0, kept).reduce((total, value) => total + value, 0);
      const after = item.parts[pageMode(1)].lines.slice(kept).reduce((total, value) => total + value, 0);
      if (before >= minLinesBefore(item.kind) && after >= MIN_SPLIT_LINES) points.push(kept);
    }
    return points;
  };
  const shownFirst = ({ count, kept }: Cut): Shown[] => {
    const list = cutItems.slice(0, count).map((item) => wholeShown(item, "first"));
    const split = kept ? cutItems[count] : undefined;
    if (split?.parts) list.push({ kind: split.kind, height: split.parts.first.height(0, kept), gapAfter: split.gapAfter });
    return list;
  };
  const shownLast = ({ count, kept }: Cut): Shown[] => {
    const split = kept ? cutItems[count] : undefined;
    // The next page draws the sidebar's entries above the main column (tuerkisProfilLayout).
    const list: Shown[] = besideRest.map((item) => wholeShown(item, pageMode(1)));
    if (split?.parts) list.push({ kind: split.kind, height: split.parts[pageMode(1)].height(kept, totalBullets(split)), gapAfter: split.gapAfter });
    list.push(...cutItems.slice(count + (kept ? 1 : 0)).map((item) => wholeShown(item, pageMode(1))));
    return list;
  };
  /** Heights of the tail blocks drawn on page one / on the last page, including a block that breaks between them. */
  const tailFirst = ({ tail: whole, rows }: Cut) => [
    ...tail.slice(0, whole).map((block) => block.height),
    ...(rows && tail[whole]?.split ? [tail[whole].split!.firstHeight?.(tail[whole].split!.ends[rows - 1]) ?? tail[whole].split!.height(0, rows)] : []),
  ];
  const tailLast = ({ tail: whole, rows }: Cut) => [
    ...(rows && tail[whole]?.split ? [splitHeightOn(tail[whole].split!, rows, tail[whole].split!.ends.length, 1)] : []),
    ...tail.slice(whole + (rows ? 1 : 0)).map((block) => heightOn(block, 1)),
  ];
  const loadFirst = (cut: Cut) =>
    stack(load1Fixed, stack(runHeight(shownFirst(cut)), sumHeights(tailFirst(cut), sectionGap)));
  const loadLast = (cut: Cut) =>
    stack(laneRest, stack(stack(runHeight(shownLast(cut), true), sumHeights(tailLast(cut), sectionGap)), pinnedLoad)) + closingHeight;

  const cuts: Cut[] = [];
  for (let count = 0; count <= cutItems.length; count += 1) {
    cuts.push({ count, kept: 0, tail: 0, rows: 0 });
    const item = cutItems[count];
    if (item) for (const kept of breakPoints(item)) cuts.push({ count, kept, tail: 0, rows: 0 });
  }
  for (let whole = 1; whole <= tailOnFirst; whole += 1) {
    // A list block may end page one at a safe row boundary; a custom section needs its heading and one entry; a
    // paragraph keeps two lines on either side.
    const split = tail[whole - 1].split;
    if (split) for (let rows = split.minRows ?? 2; rows <= split.ends.length - (split.minRows ?? 2); rows += 1)
      if (paragraphBreakAllowed(split.lines, 0, rows, split.ends.length)) cuts.push({ count: cutItems.length, kept: 0, tail: whole - 1, rows });
    cuts.push({ count: cutItems.length, kept: 0, tail: whole, rows: 0 });
  }
  // The signature never travels alone: the last page needs something besides the closing block (the sidebar
  // lane that goes on there counts).
  const candidates = cuts.filter((cut) => shownLast(cut).length > 0 || tailLast(cut).length > 0 || pinned.length > 0 || laneSpill);

  const densityFactor = { standard: 1, compact: dense.compact, dense: dense.dense };
  const densityFor = (fill: number): { density: ResumePagePlan["density"]; overflow: number } => {
    if (fill <= 1) return { density: "standard", overflow: 0 };
    if (fill * dense.compact <= 1) return { density: "compact", overflow: 0 };
    return { density: "dense", overflow: Math.max(0, fill * dense.dense - 1) };
  };

  const assemble = (cut: Cut, densityOne: ResumePagePlan["density"], densityTwo: ResumePagePlan["density"]): ResumePagePlan[] => {
    const split = cut.kept ? cutItems[cut.count] : undefined;
    const part = (item: MeasuredItem, from: number, to: number, page: "first" | "cont"): ResumePageItem => ({
      kind: item.kind,
      id: item.id,
      weight: Math.round((item.parts?.[page].height(from, to) ?? 0) * 10) / 10,
      bullets: { from, to, total: totalBullets(item) },
    });
    const firstItems: ResumePageItem[] = cutItems.slice(0, cut.count).map((item) => strip(item, "first"));
    if (split) firstItems.push(part(split, 0, cut.kept, "first"));
    firstItems.push(...besideFirst.map((item) => strip(item, "first")));
    const lastItems: ResumePageItem[] = besideRest.map((item) => strip(item, pageMode(1)));
    if (split) lastItems.push(part(split, cut.kept, totalBullets(split), pageMode(1)));
    lastItems.push(...cutItems.slice(cut.count + (split ? 1 : 0)).map((item) => strip(item, pageMode(1))));
    // A list block that breaks between the pages is drawn on both, each with its own items.
    const broken = cut.rows ? tail[cut.tail] : undefined;
    const total = broken?.split?.ends.at(-1) ?? 0;
    const shown = broken?.split ? broken.split.ends[cut.rows - 1] : 0;
    const ranges = broken?.split
      ? { first: { [broken.id]: { from: 0, to: shown, total } }, last: { [broken.id]: { from: shown, to: total, total } } }
      : undefined;
    return [
      {
        pageNumber: 1,
        items: firstItems,
        density: densityOne,
        // An ordered one-column template also reads Kurzprofil and Stärken from the plan.
        blocks: [...pageOneFlow.filter((block) => block.home === "last" || ordered || atsFlow), ...tail.slice(0, cut.tail + (broken ? 1 : 0))].map((block) => block.id),
        ...(ranges ? { blockRanges: ranges.first } : {}),
        sidebar: geometry.columns === 2 && !flat,
        fill: { main: loadFirst(cut) / mainCap1, sidebar: educationBeside && sideCap1 ? sideLoadFirst / sideCap1 : sideFill },
      },
      {
        pageNumber: 2,
        items: lastItems,
        density: densityTwo,
        blocks: [...tail.slice(cut.tail), ...pinned].map((block) => block.id),
        ...(ranges ? { blockRanges: ranges.last } : {}),
        // Elegant retains its compact identity sidebar; remaining blocks use its narrow main column.
        sidebar: templateId === "elegant" && !context.atsMode,
        fill: { main: loadLast(cut) / mainCap2, sidebar: 0 },
      },
    ];
  };

  /** Blocks that lead the main column and go on from page one (`leadOverflow`): a page draws them before its career entries. */
  const leadIds = new Set<string>();
  /** Continue an overflowing second page through as many A4 sheets as its content needs. */
  const packContinuations = (plan: ResumePagePlan[], reserveClosing: boolean): ResumePagePlan[] => {
    const second = plan[1];
    // A page two that carries the rest of page one's leading blocks is always packed: they come before its career entries.
    if (!second || !leadIds.size && (second.fill?.main ?? 0) * densityFactor[second.density] <= 1) return plan;
    // The closing is appended only after the continuation pages are packed; `reserveClosing` keeps its height free on
    // every continuation page, so the last page cannot silently overflow.
    const continuationCap = reserveClosing ? mainCap2 - closingHeight : mainCap2;
    const itemById = new Map(items.map((item) => [item.id, item]));
    const blockById = new Map(flow.map((block) => [block.id, block]));
    type PendingItem = { source: MeasuredItem; from: number; to: number };
    const pendingItems: PendingItem[] = second.items.flatMap((item) => {
      const source = itemById.get(item.id);
      if (!source) return [];
      const range = item.bullets;
      return [{ source, from: range?.from ?? 0, to: range?.to ?? source.parts?.cont.lines.length ?? 0 }];
    });
    type PendingBlock = { source: FlowBlock; from: number; to: number };
    const rowAt = (block: FlowBlock, itemIndex: number) => itemIndex === 0 ? 0
      : (block.split?.ends.findIndex((end) => end === itemIndex) ?? -1) + 1;
    const pendingBlocks: PendingBlock[] = (second.blocks ?? []).flatMap((id) => {
      const source = blockById.get(id);
      if (!source) return [];
      const range = second.blockRanges?.[id];
      return [{ source, from: range ? rowAt(source, range.from) : 0,
        to: range ? rowAt(source, range.to) : source.split?.ends.length ?? 0 }];
    });
    // The page being filled (0-based): one that keeps its sidebar keeps its narrow main column.
    let pageIndex = 1;
    const blockHeight = (part: PendingBlock) => part.source.split
      ? splitHeightOn(part.source.split, part.from, part.to, pageIndex) : heightOn(part.source, pageIndex);
    const projectItem = (part: PendingItem): ResumePageItem => {
      const { source, from, to } = part;
      if (!source.parts) return strip(source, pageMode(pageIndex));
      const measured = source.parts[pageMode(pageIndex)];
      return { kind: source.kind, id: source.id,
        weight: Math.round(measured.height(from, to) * 10) / 10,
        ...(from > 0 || to < measured.lines.length
          ? { bullets: { from, to, total: measured.lines.length } } : {}),
      };
    };
    const continuations: ResumePagePlan[] = [];
    // At least one item or block is consumed on each pass; the guard also catches malformed input.
    while (pendingItems.length || pendingBlocks.length) {
      pageIndex = continuations.length + 1;
      const selectedItems: ResumePageItem[] = [];
      const selectedBlocks: string[] = [];
      const blockRanges: Record<string, KnowledgeRange> = {};
      let used = laneRestOn(pageIndex);
      let previous: ResumePageItem | undefined;
      /**
       * Fills the page with the pending blocks while `take` accepts the next one. A block that does not fit breaks at
       * a safe row (a paragraph keeps two lines on each side); the rest waits for the next page, so nothing behind it
       * may start here. Returns whether the page is full.
       */
      const takeBlocks = (take: (block: FlowBlock) => boolean) => {
        while (pendingBlocks.length && take(pendingBlocks[0].source)) {
          const next = pendingBlocks[0];
          const gap = used > 0 ? sectionGap : 0;
          const height = blockHeight(next);
          if (used + gap + height <= continuationCap) {
            selectedBlocks.push(next.source.id); used += gap + height; pendingBlocks.shift();
            if (next.source.split && (next.from > 0 || next.to < next.source.split.ends.length))
              blockRanges[next.source.id] = { from: next.from ? next.source.split.ends[next.from - 1] : 0,
                to: next.source.split.ends[next.to - 1], total: next.source.split.ends.at(-1)! };
            continue;
          }
          if (next.source.split) {
            const { lines } = next.source.split;
            let best = next.from;
            for (let end = next.from + 1; end < next.to; end += 1) {
              const minRows = next.source.split.minRows ?? 2;
              if (end - next.from < minRows || next.to - end < minRows) continue;
              if (used + gap + splitHeightOn(next.source.split, next.from, end, pageIndex) > continuationCap) {
                // A paragraph's parts only grow with `end`.
                if (lines) break;
                continue;
              }
              if (paragraphBreakAllowed(lines, next.from, end, next.to)) best = end;
            }
            if (best > next.from) {
              selectedBlocks.push(next.source.id);
              used += gap + splitHeightOn(next.source.split, next.from, best, pageIndex);
              blockRanges[next.source.id] = { from: next.from ? next.source.split.ends[next.from - 1] : 0,
                to: next.source.split.ends[best - 1], total: next.source.split.ends.at(-1)! };
              pendingBlocks[0] = { ...next, from: best };
            }
          }
          // A block taller than an empty page is drawn there whole (with the range of its rest) rather than looping. A page
          // that already holds the rest of Türkis Profil's Seitenspalte is not empty: the block goes on to the next page.
          if (!selectedBlocks.length && !selectedItems.length && used === 0) {
            selectedBlocks.push(next.source.id); used += gap + height; pendingBlocks.shift();
            if (next.source.split && next.from > 0)
              blockRanges[next.source.id] = { from: next.source.split.ends[next.from - 1],
                to: next.source.split.ends[next.to - 1], total: next.source.split.ends.at(-1)! };
          }
          return true;
        }
        return false;
      };
      // A block that leads the main column (a Kurzprofil that goes on from page one) comes before the career entries.
      const leadFull = takeBlocks((block) => leadIds.has(block.id));
      if (!leadFull && !pendingBlocks.some((part) => leadIds.has(part.source.id))) while (pendingItems.length) {
        const next = pendingItems[0];
        const item = projectItem(next);
        const heading = previous?.kind === item.kind ? next.source.gapAfter :
          (used > 0 ? sectionGap : 0) + sectionHead(item.kind, !selectedItems.length && !selectedBlocks.length);
        const needed = heading + item.weight;
        if (used + needed <= continuationCap) {
          selectedItems.push(item); used += needed; previous = item; pendingItems.shift();
          continue;
        }
        if (next.source.parts) {
          const measured = next.source.parts[pageMode(pageIndex)];
          const lines = measured.lines;
          let best = next.from;
          for (let end = next.from + 1; end < next.to; end += 1) {
            const before = lines.slice(next.from, end).reduce((sum, value) => sum + value, 0);
            const after = lines.slice(end, next.to).reduce((sum, value) => sum + value, 0);
            if (before < minLinesBefore(next.source.kind) || after < MIN_SPLIT_LINES) continue;
            if (used + heading + measured.height(next.from, end) <= continuationCap) best = end;
          }
          if (best > next.from) {
            const part = projectItem({ ...next, to: best });
            selectedItems.push(part); used += heading + part.weight;
            pendingItems[0] = { ...next, from: best };
          }
        }
        if (!selectedItems.length && used === 0) {
          // One indivisible metadata entry is taller than a sheet. Keep it visible
          // rather than looping forever; normal entries split at bullet boundaries.
          selectedItems.push(item); used += needed; pendingItems.shift();
        }
        break;
      }
      if (!pendingItems.length) takeBlocks(() => true);
      continuations.push({ pageNumber: continuations.length + 2, items: selectedItems,
        density: "standard", blocks: selectedBlocks,
        ...(Object.keys(blockRanges).length ? { blockRanges } : {}), sidebar: templateId === "elegant" && !context.atsMode,
        fill: { main: used / mainCap2, sidebar: 0 } });
    }
    if (continuations.length) continuations[continuations.length - 1].fill!.main += closingHeight / mainCap2;
    return [plan[0], ...continuations];
  };
  /**
   * Zweispaltig always reserves the closing. Gepflegt fills its continuation pages to the bottom and reserves the closing
   * only when the last page has no room left for it; so do the other templates when page one's leading blocks go on
   * (`leadIds`), where every later page is packed.
   */
  const continueAfterSecond = (plan: ResumePagePlan[]): ResumePagePlan[] => {
    const reserveClosing = templateId === "zweispaltig" || templateId === "tuerkis-profil" || Boolean(templateId?.startsWith("pehlione_"));
    if (templateId !== "gepflegt" && !leadIds.size) return packContinuations(plan, reserveClosing);
    const full = packContinuations(plan, reserveClosing);
    return full.length > 1 && (full[full.length - 1].fill?.main ?? 0) > 1 ? packContinuations(plan, true) : full;
  };

  /**
   * Lay the sidebar lane over the pages of the main column: every page that has sidebar content keeps its sidebar,
   * a section that breaks between two pages names its item range on both, and the lane may need more pages than the
   * main column does. Pages of the main column that have nothing pending in the sidebar keep their natural layout.
   */
  const withSidebarLane = (plan: ResumePagePlan[]): ResumePagePlan[] => {
    if (!sidebarLane) return withPlaced(plan);
    const pages: ResumePagePlan[] = plan.map((page) => ({ ...page, blocks: [...(page.blocks ?? [])], fill: { main: page.fill?.main ?? 0, sidebar: page.fill?.sidebar ?? 0 } }));
    while (pages.length < lanePages.length) {
      pages.push({ pageNumber: pages.length + 1, items: [], density: pages[pages.length - 1]?.density ?? "standard", blocks: [], sidebar: false, fill: { main: 0, sidebar: 0 } });
    }
    lanePages.forEach((segments, index) => {
      const page = pages[index];
      const ranges: Record<string, KnowledgeRange> = { ...page.blockRanges };
      for (const { block, from, to } of segments) {
        if (!page.blocks!.includes(block.id)) page.blocks!.push(block.id);
        const ends = block.sideSplit?.ends;
        if (ends && (from > 0 || to < ends.length)) ranges[block.id] = { from: from ? ends[from - 1] : 0, to: ends[to - 1], total: ends[ends.length - 1] };
      }
      if (Object.keys(ranges).length) page.blockRanges = ranges;
      if (index > 0) page.sidebar = segments.length > 0;
      page.fill = { main: page.fill!.main, sidebar: laneLoad(index) / (index === 0 ? sideCap1 : sideCap2) };
    });
    return withPlaced(pages);
  };

  /**
   * The blocks that lead the main column of page one (a long Kurzprofil, Stärken above the career) are taller than the
   * page: they flow like a Word document instead of running off the sheet. Page one takes them up to its usable bottom,
   * the block that does not fit breaks at a word (a paragraph keeps two lines on each side) and goes on at the top of
   * the next page; the blocks behind it and then the career entries follow there.
   */
  const leadOverflow = (): ResumePagePlan[] | undefined => {
    const lead = pageOneFlow.filter((block) => block.zone === "main").sort((left, right) => managerRank(left.id) - managerRank(right.id));
    if (load1Fixed <= mainCap1 || !lead.some((block) => block.split)) return undefined;
    let used = 0;
    const onFirst: string[] = [];
    const firstRanges: Record<string, KnowledgeRange> = {};
    const rest: Array<{ block: FlowBlock; from: number }> = [];
    for (const block of lead) {
      if (rest.length) { rest.push({ block, from: 0 }); continue; }
      const gap = used > 0 ? sectionGap : 0;
      if (used + gap + block.height <= mainCap1) { onFirst.push(block.id); used += gap + block.height; continue; }
      const split = block.split;
      let best = 0;
      if (split) {
        const minRows = split.minRows ?? 2;
        for (let end = minRows; end <= split.ends.length - minRows; end += 1) {
          const height = split.firstHeight?.(split.ends[end - 1]) ?? split.height(0, end);
          if (used + gap + height > mainCap1) { if (split.lines) break; continue; }
          if (paragraphBreakAllowed(split.lines, 0, end, split.ends.length)) best = end;
        }
      }
      if (split && best > 0) {
        onFirst.push(block.id);
        used += gap + (split.firstHeight?.(split.ends[best - 1]) ?? split.height(0, best));
        firstRanges[block.id] = { from: 0, to: split.ends[best - 1], total: split.ends[split.ends.length - 1] };
        rest.push({ block, from: best });
      } else if (used === 0) {
        // Taller than a page and not divisible: drawn whole rather than lost.
        onFirst.push(block.id);
        used += block.height;
      } else rest.push({ block, from: 0 });
    }
    if (!rest.length) return undefined;
    for (const block of lead) selfPlaced.add(block.id);
    for (const { block } of rest) leadIds.add(block.id);
    const moved = new Set(rest.filter((part) => part.from === 0).map((part) => part.block.id));
    const restRanges: Record<string, KnowledgeRange> = Object.fromEntries(rest.filter((part) => part.from > 0).map(({ block, from }) => {
      const ends = block.split!.ends;
      return [block.id, { from: ends[from - 1], to: ends[ends.length - 1], total: ends[ends.length - 1] }];
    }));
    const firstIds = [...new Set([...pageOneFlow.filter((block) => (block.home === "last" || ordered || atsFlow) && !moved.has(block.id)).map((block) => block.id), ...onFirst])];
    const pages: ResumePagePlan[] = [
      {
        pageNumber: 1, items: [], density: "standard", blocks: firstIds,
        ...(Object.keys(firstRanges).length ? { blockRanges: firstRanges } : {}),
        sidebar: geometry.columns === 2 && !flat,
        fill: { main: used / mainCap1, sidebar: sideFill },
      },
      {
        pageNumber: 2, items: items.map((item) => strip(item, pageMode(1))), density: "standard",
        blocks: [...rest.map((part) => part.block.id), ...[...tail, ...pinned].map((block) => block.id)],
        ...(Object.keys(restRanges).length ? { blockRanges: restRanges } : {}),
        sidebar: templateId === "elegant" && !context.atsMode,
        fill: { main: 2, sidebar: 0 },
      },
    ];
    return withSidebarLane(continueAfterSecond(pages));
  };
  /**
   * A hand-arranged layout that puts a section of the main column between the two career sections (Berufserfahrung,
   * Sprachen, Bildungsweg): the main column is one stream in the order of the list, so the section starts once the
   * entries before it end and the entries behind it follow it, on whatever page that is. The sidebar keeps its own
   * flow (page one, or its lane).
   */
  const interleavedMain = (): ResumePagePlan[] | undefined => {
    if (!(zoneFlow || templateId === "elegant") || !customLayout || flat || templateId === "kreativ" || forced !== undefined) return undefined;
    const experienceRank = managerRank("experience");
    const educationRank = managerRank("education");
    if (!items.some((item) => item.kind === "experience") || !items.some((item) => item.kind === "education")) return undefined;
    const low = Math.min(experienceRank, educationRank);
    const high = Math.max(experienceRank, educationRank);
    const mainBlocks = flow.filter((block) => block.zone === "main" && !block.singleOnly);
    if (!mainBlocks.some((block) => managerRank(block.id) > low && managerRank(block.id) < high)) return undefined;
    // Sidebar sections without room beside page one (templates without a sidebar lane) join the stream at their place
    // in the list, from page two on.
    const spill = new Set(flow.filter(spilled).map((block) => block.id));
    const ids = (context.sections ?? []).map((entry) => entry.id)
      .filter((id) => id === "experience" || id === "education" || spill.has(id) || mainBlocks.some((block) => block.id === id));
    for (const block of mainBlocks) selfPlaced.add(block.id);
    const pageCap = (number: number) => (number === 1 ? mainCap1 : mainCap2);
    const pages = streamWithClosing({
      ids,
      capacity: (number, reserveFrom) => pageCap(number) - (number >= reserveFrom ? closingHeight : 0),
      mode: (number) => (number === 1 ? "first" : pageMode(number - 1)),
      blockHeight: (block, number, from, to) => {
        if (!block.split) return number === 1 ? block.height : heightOn(block, number - 1);
        if (number > 1) return splitHeightOn(block.split, from, to, number - 1);
        return from === 0 && block.split.firstHeight ? block.split.firstHeight(block.split.ends[to - 1]) : block.split.height(from, to);
      },
      sidebar: (number) => number === 1 || templateId === "elegant" && !context.atsMode,
      laterPagesOnly: spill,
    }, true, closingHeight, pageCap);
    pages.forEach((entry, index) => {
      // Page one also names the sidebar sections it hosts (without a lane; a lane names its own).
      if (index === 0) entry.plan.blocks = [...new Set([...entry.plan.blocks!, ...pageOneFlow.filter((block) => block.zone === "sidebar" && block.home === "last").map((block) => block.id)])];
      entry.plan.fill = { main: (entry.used + (index === pages.length - 1 ? closingHeight : 0)) / pageCap(index + 1), sidebar: index === 0 ? sideFill : 0 };
    });
    return withSidebarLane(pages.map((entry) => entry.plan));
  };
  const interleavedPlan = interleavedMain();
  if (interleavedPlan) return interleavedPlan;
  const leadPlan = leadOverflow();
  if (leadPlan) return leadPlan;

  // A manual page break keeps whole entries on either side of it.
  if (forced !== undefined) {
    const cut: Cut = { count: Math.min(Math.max(forced, 0), cutItems.length), kept: 0, tail: 0, rows: 0 };
    return withSidebarLane(continueAfterSecond(assemble(cut, densityFor(Math.max(loadFirst(cut) / mainCap1, sideFill)).density, densityFor(loadLast(cut) / mainCap2).density)));
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
  // More than two pages of content use normal reading density and continue on
  // additional pages instead of compressing page two beyond its A4 capacity.
  if (density === "dense" && loadLast(candidates[greedy("standard")]) > mainCap2)
    return withSidebarLane(continueAfterSecond(assemble(candidates[greedy("standard")], "standard", "standard")));
  // A last page that is only a stub takes back trailing content from page one. Modern keeps the
  // latest safe break instead: moving an entire special section leaves usable space above the break.
  const factor = densityFactor[density];
  // (A last page that carries the sidebar lane is no stub, whatever the main column puts there.)
  while (templateId !== "kreativ" && templateId !== "modern" && !laneSpill && index > 0 && loadLast(candidates[index]) / mainCap2 < MIN_LAST_FILL) {
    const earlier = candidates[index - 1];
    if (loadFirst(earlier) / mainCap1 < MIN_FIRST_FILL || loadLast(earlier) * factor > mainCap2) break;
    index -= 1;
  }
  const best = candidates[index];

  if (fitsCompact && (density !== "standard" || loadLast(best) / mainCap2 < COMPACT_INSTEAD_OF_LAST_BELOW)) return onePage("compact");

  return withSidebarLane(continueAfterSecond(assemble(best, density, density)));
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
