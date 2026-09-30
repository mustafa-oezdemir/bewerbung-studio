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
export const zoneFlowTemplates: readonly string[] = ["pehlione_white_blue", "pehlione_white"];

export const isZoneFlowTemplate = (templateId: string | undefined): boolean =>
  Boolean(templateId && zoneFlowTemplates.includes(templateId));

/** The closing of these templates prints the application date (`Ort, YYYY-MM-DD`), not a profile field. */
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
  /** Space under the heading and under the divider line (mm). */
  marginBottom: { standard: number; compact: number };
  labelPadding: { standard: number; compact: number };
  color: string;
  dividerColor: string;
  iconColor: string;
  iconBackground: string;
  /** Space behind the whole section (mm). */
  sectionGap: { standard: number; compact: number };
};

export type SectionListTokens = {
  fontSizePt: { standard: number; compact: number };
  lineHeight: { standard: number; compact: number };
  /** Line height of the entries themselves, when it differs from the list's. */
  itemLineHeight?: number;
  /** Space between two entries (mm): the item margin in the main column, the grid gap in the sidebar. */
  itemGap: { standard: number; compact: number };
  indent: number;
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
const pehlioneWhiteBlue: TemplateTokens = {
  main: {
    icons: true,
    heading: {
      iconBox: 9, iconGap: 3, iconRadius: 1.2, glyphSize: 5.5, glyphStroke: 1.9,
      fontSizePt: { standard: 13, compact: 11.2 }, fontWeight: 700, lineHeight: 1.1,
      letterSpacing: "0", textTransform: "uppercase",
      marginBottom: { standard: 3, compact: 2 }, labelPadding: { standard: 1.2, compact: 0.8 },
      color: "var(--pehlione-section-color,var(--pehlione-primary,#0b3d86))",
      dividerColor: "var(--pehlione-divider-color,var(--pehlione-primary,#0b3d86))",
      iconColor: "#fff", iconBackground: "var(--pehlione-primary,#0b3d86)",
      sectionGap: { standard: 6, compact: 3.1 },
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
      fontSizePt: { standard: 9.7, compact: 9.7 }, fontWeight: 700, lineHeight: 1.1,
      letterSpacing: "0", textTransform: "uppercase",
      marginBottom: { standard: 2, compact: 2 }, labelPadding: { standard: 1.2, compact: 1.2 },
      color: "var(--pehlione-sidebar-text,#fff)",
      dividerColor: "var(--pehlione-divider-color,#b8d2f4)",
      iconColor: "#fff", iconBackground: "var(--pehlione-primary,#0b3d86)",
      sectionGap: { standard: 4.5, compact: 4.5 },
    },
    list: {
      fontSizePt: { standard: 7.8, compact: 7.8 }, lineHeight: { standard: 1.2, compact: 1.2 }, itemLineHeight: 1.25,
      itemGap: { standard: 1.35, compact: 1.35 }, indent: 4,
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
      color: "var(--pehlione-section-color,var(--pehlione-primary,#08245c))",
      dividerColor: "var(--pehlione-divider-color,var(--pehlione-primary,#08245c))",
      iconBackground: "var(--pehlione-primary,#08245c)",
    },
  },
  sidebar: {
    ...pehlioneWhiteBlue.sidebar,
    heading: {
      ...pehlioneWhiteBlue.sidebar.heading,
      iconBox: 8, iconGap: 2, iconRadius: 0, glyphSize: 7, glyphStroke: 1.9,
      color: "var(--pehlione-primary,#08245c)",
      dividerColor: "var(--pehlione-divider-color,var(--pehlione-primary,#08245c))",
      iconColor: "var(--pehlione-primary,#08245c)", iconBackground: "transparent",
    },
  },
};

const tokensByTemplate: Record<string, TemplateTokens> = {
  pehlione_white_blue: pehlioneWhiteBlue,
  pehlione_white: pehlioneWhite,
};

const PT_TO_MM = 0.3528;

/** Millimetres the page planner needs to size a plain list section (heading, entries) drawn in `zone`. */
export const sectionListMetrics = (templateId: string, zone: SectionZone) => {
  const tokens = tokensByTemplate[templateId]?.[zone];
  if (!tokens) return undefined;
  const { heading, list } = tokens;
  const fontMm = list.fontSizePt.standard * PT_TO_MM;
  return {
    headingMm: heading.iconBox + heading.marginBottom.standard,
    fontMm,
    lineMm: fontMm * (list.itemLineHeight ?? list.lineHeight.standard),
    gapMm: list.itemGap.standard,
    indentMm: list.indent,
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

const templateCss = (templateId: string, tokens: TemplateTokens) => {
  const host = `:is(.pehlione-resume,.cv-sheet)[data-template="${templateId}"]`;
  const compact = (suffix: string) =>
    `.pehlione-resume[data-template="${templateId}"][data-density="compact"] ${suffix},.cv-sheet[data-template="${templateId}"] .pehlione-pdf[data-density="compact"] ${suffix}`;
  const hidden = (suffix: string) =>
    `.pehlione-resume[data-template="${templateId}"][data-section-divider="hidden"] ${suffix},.cv-sheet[data-template="${templateId}"] .pehlione-pdf[data-section-divider="hidden"] ${suffix}`;
  const { main, sidebar } = tokens;
  const zoneRules = (zone: SectionZone, { heading, list }: TemplateTokens[SectionZone]) => {
    const scope = `[data-cv-zone="${zone}"]`;
    const listSelector = `${scope} [data-cv-list]`;
    const gridList = zone === "sidebar";
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
      `${host} ${scope}{margin:0 0 ${mm(heading.sectionGap.standard)}}`,
      heading.sectionGap.compact !== heading.sectionGap.standard
        ? `${compact(scope)}{margin-bottom:${mm(heading.sectionGap.compact)}}` : "",
      `${host} ${scope}>.cv-heading{margin:0 0 ${mm(heading.marginBottom.standard)};color:${heading.color};font-size:${heading.fontSizePt.standard}pt;--cv-divider:${heading.dividerColor};--cv-icon-color:${heading.iconColor};--cv-icon-bg:${heading.iconBackground}}`,
      `${host} ${scope}>.cv-heading .cv-heading__label{padding-bottom:${mm(heading.labelPadding.standard)}}`,
      heading.marginBottom.compact !== heading.marginBottom.standard || heading.fontSizePt.compact !== heading.fontSizePt.standard
        ? `${compact(`${scope}>.cv-heading`)}{margin-bottom:${mm(heading.marginBottom.compact)};font-size:${heading.fontSizePt.compact}pt}` : "",
      heading.labelPadding.compact !== heading.labelPadding.standard
        ? `${compact(`${scope}>.cv-heading .cv-heading__label`)}{padding-bottom:${mm(heading.labelPadding.compact)}}` : "",
      `${host} ${listSelector}{${gridList ? `display:grid;gap:${mm(list.itemGap.standard)};` : ""}margin:0;padding:0 0 0 ${mm(list.indent)};color:inherit;font-size:${list.fontSizePt.standard}pt;line-height:${list.lineHeight.standard};list-style:disc}`,
      `${host} ${listSelector} li{${gridList ? "margin:0;" : `margin:${mm(list.itemGap.standard)} 0;`}color:inherit;font-size:inherit;line-height:${list.itemLineHeight ?? "inherit"};hyphens:auto;break-inside:avoid;page-break-inside:avoid}`,
      list.fontSizePt.compact !== list.fontSizePt.standard || list.lineHeight.compact !== list.lineHeight.standard
        ? `${compact(listSelector)}{font-size:${list.fontSizePt.compact}pt;line-height:${list.lineHeight.compact}}` : "",
      !gridList && list.itemGap.compact !== list.itemGap.standard
        ? `${compact(`${listSelector} li`)}{margin:${mm(list.itemGap.compact)} 0}` : "",
    ].filter(Boolean).join("\n");
  };
  const { heading } = main;
  return `
${host} .cv-heading{display:grid;grid-template-columns:${mm(heading.iconBox)} minmax(0,1fr);gap:${mm(heading.iconGap)};align-items:center;box-sizing:border-box;padding:0;border:0;font-style:normal;font-weight:${heading.fontWeight};line-height:${heading.lineHeight};letter-spacing:${heading.letterSpacing};text-transform:${heading.textTransform};break-after:avoid;page-break-after:avoid}
${host} .cv-heading:not(:has(.cv-heading__icon)){grid-template-columns:minmax(0,1fr)}
${host} .cv-heading__icon{display:grid;box-sizing:border-box;width:${mm(heading.iconBox)};height:${mm(heading.iconBox)};place-items:center;border-radius:${mm(heading.iconRadius)};color:var(--cv-icon-color,${heading.iconColor});background:var(--cv-icon-bg,${heading.iconBackground});font-style:normal}
${host} .cv-heading__icon svg{display:block;width:${mm(heading.glyphSize)};height:${mm(heading.glyphSize)};fill:none;stroke:currentColor;stroke-width:${heading.glyphStroke};stroke-linecap:round;stroke-linejoin:round}
${host} .cv-heading__label{display:block;min-width:0;border-bottom:var(--pehlione-divider-width,.3mm) solid var(--cv-divider,${heading.dividerColor});color:inherit;font-weight:inherit}
${hidden(".cv-heading__label")}{border-bottom:0}
${zoneRules("main", main)}
${zoneRules("sidebar", sidebar)}
${host} [data-cv-zone="main"]:has(+ ${closingSelector}){margin-bottom:0}
${compact(`[data-cv-zone="main"]:has(+ ${closingSelector})`)}{margin-bottom:0}
${host} [data-cv-zone="sidebar"] :is(h4,h5,strong,p,li,small){color:inherit}
${host} [data-cv-zone="sidebar"] p{text-align:left}
`;
};

export const resumeSectionPresentationCss = Object.entries(tokensByTemplate)
  .map(([templateId, tokens]) => templateCss(templateId, tokens))
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
      previous.replaceWith(buildSectionHeading(document, presentation, title, previous));
    }
  }
};
