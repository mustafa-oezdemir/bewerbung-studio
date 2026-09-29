import { renderCustomSectionContent } from "./resumeCustomSections";
import { applyResumePageLayout, getResumeLayoutHost } from "./resumeLayoutEngine";
import { applyResumeSpacingOutput, resumeSpacingCss } from "./resumeSpacing";
import { applyResumeMetadataLayout, resumeMetadataCss } from "./resumeMetadataLayout";
import { applyResumeClosingOutput, resumeClosingCss } from "./resumeClosing";
import { applyPehlioneAppearance, pehlioneAppearanceCss } from "./pehlioneAppearance";
import {
  keepDatesOnOneLine,
  normalizeContinuationHeader,
  ensureResumeHeaderContacts,
  repeatResumeHeader,
  removeContinuationSidebar,
  removeEmptyCareerSections,
  resumeContinuationCss,
} from "./resumeContinuation";
import { applyGeneralResumeAppearance, resumeAppearanceSchema } from "./resumeAppearance";
import { resolveTemplateId } from "./templates";
import { resumeSectionStyleSources } from "./resumeSectionStyleInheritance";
import { parseHTML } from "linkedom";
import type { ApplicantProfile } from "./schema";
import {
  type ManagerSection,
} from "../features/resume-sections/resume-manager";
import { getProfileMediaSource } from "./profileMedia";
import { getThemedTechnologyIconMarkup } from "./technologyBrand";
import { defaultDocumentDesign, type DocumentDesignSettings } from "./documentDesign";
import { resolveCvDocument, type ResolvedCvDocument } from "./resolveCvDocument";
import { getPaginationGeometry } from "./resumePaginationGeometry";
import { resolveSectionColumns } from "./resumeSectionLayout";
import { getCvDesignVariables } from "./cvDesign";
import type { CvDesignTokens } from "./cvDesignSchema";
import { ensureKnowledgeSection } from "../features/knowledge/knowledge.service";
import { visibleKnowledgeItems, formatKnowledgeItem } from "../features/knowledge/knowledge.utils";
import { knowledgeLevelScores } from "../features/knowledge/knowledge.constants";
import type { KnowledgeItem, KnowledgeCategory, KnowledgeDisplayMode } from "../features/knowledge/knowledge.types";

const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const aliases: Record<string, string[]> = {
  summary: ["Zusammenfassung", "Kurzprofil", "Profil"],
  strengths: ["Stärken", "Kernkompetenzen"],
  experience: ["Berufserfahrung", "Erfahrung", "Beruflicher Werdegang"],
  education: ["Ausbildung", "Bildungsweg"],
  knowledge: [
    "Kenntnisse",
    "Fähigkeiten",
    "Technische Schwerpunkte",
    "Besondere Kenntnisse",
  ],
  certifications: [
    "Zertifikate",
    "Weiterbildungen",
    "Weiterbildungen (Auswahl)",
    "Erfolge",
  ],
  languages: ["Sprachen"],
  projects: ["Projekt-Highlight"],
};
// Templates write the continuation cue with or without the middle dot.
const continuationCue = /\s*(?:·\s*)?Fortsetzung/i;
const normalize = (value: string) =>
  value
    .replace(continuationCue, "")
    .trim()
    .toLocaleLowerCase("de-DE");

const zeitgenoessischExtraIcon = (id: string, profile: ApplicantProfile): string => {
  if (id === "strengths") return '<path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>';
  const section = id.startsWith("special:")
    ? profile.specialSections.find(item => item.id === id.slice(8))
    : undefined;
  if (section?.kind === "interests" || /hobbys|interessen/.test(normalize(section?.title ?? ""))) return '<path d="M20.8 8.6c0 4.4-8.8 10.4-8.8 10.4S3.2 13 3.2 8.6a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8z"/>';
  if (section?.kind === "projects" || /projekt/.test(normalize(section?.title ?? ""))) return '<path d="M4 7h16v12H4zM9 7V4h6v3M4 12h16M10 12v2h4v-2"/>';
  return '<path d="M12 3a6 6 0 0 0-3.5 10.9V18h7v-4.1A6 6 0 0 0 12 3ZM9 21h6"/>';
};

const setHeadingText = (heading: Element, title: string) => {
  if (heading.textContent?.trim() === title.trim()) return;
  const label = heading.querySelector("b") ?? Array.from(heading.children).find(child => child.tagName === "SPAN" && !child.querySelector("svg")) ?? heading;
  label.textContent = title;
};

export const managedResumeCss = `
.managed-item-grid{display:grid!important;grid-template-columns:repeat(var(--section-columns,1),minmax(0,1fr))!important;gap:2mm 3mm;min-width:0;padding:0;list-style:none}
.managed-item-grid>*,.managed-item-text{min-width:0;overflow-wrap:anywhere;break-inside:avoid}
.managed-item{display:grid;grid-template-columns:4mm minmax(0,1fr);align-items:start;gap:1.5mm;margin:0;min-width:0}
.managed-item>svg{width:4mm;height:4mm;color:var(--doc-accent,var(--accent,currentColor))}
.managed-item-text{display:block;white-space:pre-line}
.managed-knowledge-category{margin-bottom:3mm;min-width:0}
.managed-knowledge-category h4,.managed-knowledge-category h5{margin:1.5mm 0;font:inherit;font-weight:700}
.managed-item-level{display:block;width:100%;height:1mm;margin-top:1mm;background:var(--doc-line-color,var(--line-color,currentColor))}
.managed-item-level b{display:block;height:100%;background:var(--doc-accent,var(--accent,currentColor))}
.managed-ats .managed-strength-card,.managed-ats .managed-item{grid-template-columns:minmax(0,1fr)}
.managed-ats .managed-strength-card strong,.managed-ats .managed-strength-card p{grid-column:1}

.managed-extra:not([data-custom-template]){margin:0 0 4mm;break-inside:avoid;color:inherit;font:inherit}
.managed-extra:not([data-custom-template]) h3{margin:0 0 2mm;font-size:1.08em;color:inherit}
.managed-extra ul{padding-left:4mm;margin:0}.managed-extra li{margin-bottom:1mm}
.managed-extra:not([data-custom-template]) small{display:block;font-size:.92em}.managed-extra:not([data-custom-template]) p{margin:1mm 0}
.managed-extra .managed-tags{display:flex;flex-wrap:wrap;gap:1.5mm}
.managed-extra .managed-tags span{border:1px solid currentColor;border-radius:2mm;padding:.7mm 1.5mm}
.managed-extra .managed-columns{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
:where([data-custom-template]){min-width:0}
:where([data-custom-template]) [data-custom-role="heading"]{margin:0 0 2mm;break-after:avoid;page-break-after:avoid}
:where([data-custom-template="zeitgenoessisch"]) [data-custom-role="heading"]{margin:0}
:where([data-custom-template]) [data-custom-role="heading-label"]{grid-column:1 / -1}
:where([data-custom-template]) [data-custom-role="entries"]{display:grid;gap:3mm;margin:0;padding:0;min-width:0}
:where([data-custom-template]) :is(ul,ol)[data-custom-role="entries"]{padding-left:4mm}
:where([data-custom-template]) [data-custom-role="entry"]{display:block;min-width:0;break-inside:avoid;overflow-wrap:anywhere}
:where([data-custom-template]) :is(p,h3,h4,h5){margin:0}
:where([data-custom-template]) .resume-special-output__meta{opacity:1}
:where([data-custom-template="kreativ"]) [data-content-type="list"]>[data-custom-role="entry"]{display:list-item}
:where([data-custom-template="kreativ"]) [data-content-type="list"]>[data-custom-role="entry"]::marker{color:var(--kreativ-primary,var(--accent,currentColor))}
[data-managed-section]{break-inside:avoid}
[data-managed-section][data-custom-template]{break-inside:avoid}
[data-managed-moved], [data-managed-moved] :is(p,li,small){color:inherit!important}
[data-managed-section="strengths"] .managed-strengths-grid{display:grid;grid-template-columns:repeat(var(--section-columns,1),minmax(0,1fr));gap:3mm;list-style:none;margin:0;padding:0}
[data-managed-section="strengths"] .managed-strength-card{display:grid;grid-template-columns:4mm minmax(0,1fr);align-items:start;gap:1mm 1.5mm;min-width:0;margin:0;padding:0;border:0;break-inside:avoid;overflow-wrap:anywhere}
[data-managed-section="strengths"] .managed-strength-card>svg{width:4mm;height:4mm;grid-column:1;grid-row:1 / span 2;color:var(--doc-accent,var(--accent,currentColor))}
[data-managed-section="strengths"] .managed-strength-card strong{grid-column:2;min-width:0;font-size:1em;line-height:1.3}
[data-managed-section="strengths"] .managed-strength-card p{grid-column:2;min-width:0;margin:0;white-space:pre-line;font-size:.92em;line-height:1.4;color:inherit}
${resumeSpacingCss}
${resumeMetadataCss}
${resumeClosingCss}
${resumeContinuationCss}
${pehlioneAppearanceCss}`;

/** Resolve section-title colors by column role on both HTML surfaces. */
export const applyResumeSectionHeadingColors = (root: Element, settings: DocumentDesignSettings): void => {
  const appearance = resumeAppearanceSchema.parse(settings.resumeAppearance ?? {});
  const sidebarColor = appearance.sidebarSectionHeadingColor ?? appearance.sidebarTextColor;
  const mainColor = settings.cvOverrides?.colors?.sectionHeading;
  if (!sidebarColor && !mainColor) return;
  const sidebar = root.querySelector(
    '[data-resume-layout-zone="sidebar"],.pehlione-sidebar,.pehlione-pdf-sidebar,.elegant-sidebar,.elegant-pdf-sidebar,.gepflegt-sidebar,.gepflegt-pdf-sidebar,.zeitgenoessisch-sidebar,.zeit-pdf-sidebar,.kreativ-sidebar,.kreativ-pdf-sidebar,.zweispaltig-sidebar,.zweispaltig-pdf-sidebar,.modern-resume-right-column,.modern-pdf-right,.kompakt-right,.kompakt-pdf-columns>aside,.stilvoll-content>aside,.stilvoll-pdf-columns>aside,aside',
  );
  const colorize = (heading: Element, color: string) => {
    (heading as HTMLElement).style.setProperty("color", color, "important");
    for (const icon of heading.querySelectorAll("svg")) {
      (icon as SVGElement).style.setProperty("color", color, "important");
      (icon as SVGElement).style.setProperty("stroke", color, "important");
    }
    for (const label of heading.querySelectorAll("b,strong,span,[data-custom-role='heading-label']"))
      if (!label.querySelector("svg") && label.textContent?.trim())
        (label as HTMLElement).style.setProperty("color", color, "important");
  };
  if (sidebar && sidebarColor) for (const heading of sidebar.querySelectorAll("h2,h3")) {
    const section = heading.closest("section");
    if (section && section.querySelector("h2,h3") !== heading) continue;
    if (!section && heading.parentElement !== sidebar) continue;
    const entry = heading.closest("article");
    if (entry && sidebar.contains(entry)) continue;
    colorize(heading, sidebarColor);
  }
  if (mainColor) for (const section of root.querySelectorAll("[data-managed-section]")) {
    if (sidebar?.contains(section)) continue;
    const heading = section.querySelector("h2,h3");
    if (!heading || heading.closest("article") && section.contains(heading.closest("article"))) continue;
    colorize(heading, mainColor);
  }
};

/** Apply only explicit semantic overrides. Native template CSS remains the
 * default, while preview and PDF receive the same resolved values. */
export const applyResumeDesignOverrides = (
  root: Element,
  templateId: string,
  surface: "preview" | "pdf",
  settings: DocumentDesignSettings,
  design: CvDesignTokens,
): void => {
  const overrides = settings.cvOverrides;
  if (!overrides || (!overrides.colors && !overrides.typography)) return;
  const scope = (surface === "pdf" ? root.querySelector(".page-content") : root.firstElementChild) ?? root;
  const variables = getCvDesignVariables(design);
  const set = (element: Element, property: string, value: string) =>
    (element as HTMLElement).style.setProperty(property, value, "important");
  for (const [name, value] of Object.entries(variables))
    (scope as HTMLElement).style.setProperty(name, value);

  const prefix = ({
    modern: "modern", elegant: "elegant", gepflegt: "gepflegt",
    "ivy-league": "ivy", klassisch: "klassisch", kompakt: "kompakt",
    kreativ: "kreativ", stilvoll: "stilvoll", tabellarisch: "tabellarisch",
    zeitgenoessisch: "zeit", zweispaltig: "zweispaltig", einspaltig: "einfach",
    pehlione_white: "pehlione", pehlione_white_blue: "pehlione",
  } as Record<string, string>)[resolveTemplateId(templateId)];
  const nativeNames: Partial<Record<keyof CvDesignTokens["colors"], string[]>> = prefix ? {
    text: [`--${prefix}-text`], muted: [`--${prefix}-muted`],
    divider: [`--${prefix}-divider`, `--${prefix}-line`],
    background: [`--${prefix}-paper`, `--${prefix}-page-bg`, `--${prefix}-page-background`],
    accent: [`--${prefix}-accent`, `--${prefix}-primary`],
    surface: [`--${prefix}-soft`, `--${prefix}-secondary`, `--${prefix}-pattern`],
  } : {};
  for (const [key, value] of Object.entries(settings.cvOverrides?.colors ?? {})) {
    if (value === undefined) continue;
    for (const property of nativeNames[key as keyof typeof nativeNames] ?? [])
      (scope as HTMLElement).style.setProperty(property, String(value));
  }
  if (settings.cvOverrides?.colors?.accent) (scope as HTMLElement).style.setProperty("--accent", design.colors.accent);
  if (settings.cvOverrides?.colors?.surface) (scope as HTMLElement).style.setProperty("--secondary", design.colors.surface);

  const colors = overrides.colors;
  if (colors?.background) {
    set(root, "background-color", design.colors.background);
    set(scope, "background-color", design.colors.background);
  }
  if (colors?.text) set(scope, "color", design.colors.text);
  if (colors?.paragraph) for (const node of scope.querySelectorAll("p,li")) set(node, "color", design.colors.paragraph);
  if (colors?.muted) for (const node of scope.querySelectorAll("small,time,[class*='meta'],[class*='date']")) set(node, "color", design.colors.muted);
  if (colors?.icon) for (const node of scope.querySelectorAll("svg")) {
    set(node, "color", design.colors.icon);
    set(node, "stroke", design.colors.icon);
  }

  const header = scope.querySelector("header,[class*='header']");
  const name = header?.querySelector("h1");
  const subtitle = header?.querySelector("h2");
  if (name && colors?.heading) set(name, "color", design.colors.heading);
  if (subtitle && colors?.subheading) set(subtitle, "color", design.colors.subheading);

  const sources = resumeSectionStyleSources[surface][resolveTemplateId(templateId) as keyof typeof resumeSectionStyleSources.preview];
  const sectionHeadings = sources ? scope.querySelectorAll(`${sources[1]},[data-custom-role='heading']`) : scope.querySelectorAll("[data-managed-section]>h2,[data-managed-section]>h3");
  const entryHeadings = sources ? scope.querySelectorAll(`${sources[2]},[data-custom-role='entry'] h3,[data-custom-role='entry'] h4`) : scope.querySelectorAll("article h3,article h4");
  const supporting = sources ? scope.querySelectorAll(sources[3]) : scope.querySelectorAll("[class*='company'],[class*='organization']");
  if (colors?.sectionHeading) for (const node of sectionHeadings) set(node, "color", design.colors.sectionHeading);
  if (colors?.entryHeading) for (const node of entryHeadings) set(node, "color", design.colors.entryHeading);
  if (colors?.divider) for (const node of sectionHeadings) set(node, "border-color", design.colors.divider);
  if (colors?.accent) for (const node of supporting) set(node, "color", design.colors.accent);
  if (colors?.surface) for (const node of scope.querySelectorAll("[class*='project'],[class*='card'],[class*='tag'],[class*='chip']"))
    set(node, "background-color", design.colors.surface);

  const typography = overrides.typography;
  if (!typography) return;
  if (typography.fontId !== undefined) set(scope, "font-family", variables["--doc-font"]);
  if (typography.bodySizePt !== undefined) set(scope, "font-size", `${design.typography.bodySizePt}pt`);
  if (name) {
    if (typography.headingFontId !== undefined) set(name, "font-family", variables["--doc-heading-font"]);
    if (typography.headingSizePt !== undefined) set(name, "font-size", `${design.typography.headingSizePt}pt`);
    if (typography.headingWeight !== undefined) set(name, "font-weight", String(design.typography.headingWeight));
  }
  if (subtitle) {
    if (typography.headingFontId !== undefined) set(subtitle, "font-family", variables["--doc-heading-font"]);
    if (typography.subheadingSizePt !== undefined) set(subtitle, "font-size", `${design.typography.subheadingSizePt}pt`);
    if (typography.subheadingWeight !== undefined) set(subtitle, "font-weight", String(design.typography.subheadingWeight));
  }
  for (const node of sectionHeadings) {
    if (typography.headingFontId !== undefined) set(node, "font-family", variables["--doc-heading-font"]);
    if (typography.sectionHeadingSizePt !== undefined) set(node, "font-size", `${design.typography.sectionHeadingSizePt}pt`);
    if (typography.sectionHeadingWeight !== undefined) set(node, "font-weight", String(design.typography.sectionHeadingWeight));
    if (typography.sectionHeadingUppercase !== undefined)
      set(node, "text-transform", design.typography.sectionHeadingUppercase ? "uppercase" : "none");
  }
  if (typography.entryHeadingSizePt !== undefined)
    for (const node of entryHeadings) set(node, "font-size", `${design.typography.entryHeadingSizePt}pt`);
  if (typography.headingFontId !== undefined)
    for (const node of entryHeadings) set(node, "font-family", variables["--doc-heading-font"]);
};

// Both the React preview and the PDF use this pure HTML projection. It only
// rearranges section nodes, retaining each template's header, artwork and CSS.
export const applyManagedResumeOutput = (
  html: string,
  profile: ApplicantProfile | undefined,
  templateId: string,
  pageNumber = 1,
  totalPages = 1,
  designSettings: DocumentDesignSettings = defaultDocumentDesign,
  resolvedCv?: ResolvedCvDocument,
  firstPageHtml?: string,
) => {
  if (!profile) return html;
  const resolved = resolvedCv ?? resolveCvDocument({
    profile, templateId, settings: designSettings, presentationAlreadyApplied: true,
  });
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const entries = resolved.managerSections;
  const groups = resolved.knowledgeGroups;
  const pages = Array.from(document.querySelectorAll(".cv-sheet"));
  const roots = pages.length ? pages : [document.body];
  let firstPageHeader: Element | null = firstPageHtml
    ? parseHTML(`<html><body>${firstPageHtml}</body></html>`).document.querySelector("header")
    : null;
  roots.forEach((root, rootIndex) => {
    const enabled = (id: string) =>
      entries.find((entry) => entry.id === id)?.visible !== false;
    if (!enabled("photo")) {
      const source = getProfileMediaSource(profile.photoPath);
      root.querySelectorAll("img").forEach((img) => {
        if (
          img.getAttribute("src") === source ||
          /photo|foto/i.test(img.className) ||
          /photo|foto/i.test(img.getAttribute("alt") ?? "")
        ) {
          const frame = img.closest(
            '[class*="__photo"],[class*="-header__photo"],[class*="-header-photo"]',
          );
          (frame ?? img).remove();
        }
      });
    }
    if (!enabled("closing"))
      root
        .querySelectorAll('footer.pehlione-closing,footer.pehlione-pdf-closing,[data-resume-closing]')
        .forEach((node) => node.remove());
    if (!enabled("personalData")) {
      if (resolved.templateId === "kompakt" && root.matches(".cv-sheet"))
        root.querySelector(".kompakt-pdf-contacts")?.closest("section")?.remove();
      root
        .querySelectorAll(
          'address,[data-element-id$=".contacts"],[data-resume-personal],.resume-personal-data,.pehlione-contacts,.pehlione-ats-contact,.pehlione-pdf-ats-contact,.zeitgenoessisch-contacts,section:has(>.modern-contact-list)',
        )
        .forEach((node) => node.remove());
    }
    const number = pages.length > 1 ? rootIndex + 1 : pageNumber;
    const last =
      pages.length > 1 ? rootIndex === pages.length - 1 : number === totalPages;
    // The page plan decides where the movable blocks live (a sidebar block moves
    // to page one when that column has room). Blocks unknown to the plan keep
    // their historic home on the last page.
    const planned = resolved.pagePlan;
    const hosts = (id: string) => {
      const movable = id === "knowledge" || id.startsWith("group:") || id.startsWith("special:");
      if (!movable || !planned.some((page) => page.blocks?.includes(id))) return last;
      return Boolean(planned[number - 1]?.blocks?.includes(id));
    };
    if (number > 1) removeContinuationSidebar(root);
    const nodes = new Map<string, Element[]>();
    const sectionNodes = Array.from(
      root.querySelectorAll("section:not(.page)"),
    );
    for (const node of sectionNodes) {
      const heading = node.querySelector("h2,h3");
      if (
        !heading ||
        heading.closest("section") !== node ||
        (heading.closest("article") &&
          node.contains(heading.closest("article")))
      )
        continue;
      const title = normalize(heading.textContent ?? "");
      const elementId = node.getAttribute("data-element-id") ?? "";
      const entry =
        entries.find(
          (entry) =>
            entry.id.startsWith("special:") &&
            elementId === `special.${entry.id.slice(8)}`,
        ) ??
        entries.find(
          (entry) => !entry.fixed && !entry.id.startsWith("special:") && normalize(entry.title) === title,
        ) ??
        entries.find((entry) =>
          (aliases[entry.id] ?? []).some((alias) => normalize(alias) === title),
        ) ??
        entries.find(
          (entry) => !entry.fixed && elementId.endsWith(`.${entry.id}`),
        );
      if (entry) {
        node.setAttribute("data-managed-section", entry.id);
        if (entry.id.startsWith("special:")) node.setAttribute("data-section-type", "main-section");
        nodes.set(entry.id, [...(nodes.get(entry.id) ?? []), node]);
      }
    }
    const isAts = designSettings.resumeOutputMode === "ats" || designSettings.columnLayout === "compact-ats" || Boolean(
      root.querySelector('[data-renderer="ats"], [class*="-ats"]'),
    );
    const main =
      root.querySelector(
        ".pehlione-main,.pehlione-pdf-main,.elegant-main,.elegant-pdf-main,.modern-resume-left-column,.modern-pdf-left,.zweispaltig-main,.zweispaltig-pdf-main,.zeitgenoessisch-main,.zeit-pdf-main,.kreativ-main,.kreativ-pdf-main,.gepflegt-main,.gepflegt-pdf-main,.kompakt-left,.kompakt-pdf-columns>main,main",
      ) ??
      // Single-column templates flow every section through one content host, also
      // on pages that carry no experience entry (where nothing else would name it).
      (["einspaltig", "ivy-league", "klassisch", "tabellarisch"].includes(resolved.templateId)
        ? getResumeLayoutHost(root, resolved.templateId, root.matches(".cv-sheet") ? "pdf" : "preview")
        : null) ??
      nodes.get("experience")?.[0]?.parentElement ??
      root.querySelector(".page-content") ??
      root;
    const sidebar = isAts
      ? main
      : (root.querySelector(
          "aside,.modern-resume-right-column,.modern-pdf-right,.elegant-sidebar,.elegant-pdf-sidebar,.zeitgenoessisch-sidebar,.zeit-pdf-sidebar,.kreativ-sidebar,.kreativ-pdf-sidebar,.zweispaltig-sidebar,.zweispaltig-pdf-sidebar,.gepflegt-sidebar,.gepflegt-pdf-sidebar,.kompakt-right",
        ) ?? main);
    const columnsFor = (entry: ManagerSection, values: {title: string; description?: string}[], strengths = false) =>
      resolveSectionColumns(strengths ? designSettings.strengthsColumns : designSettings.knowledgeColumns, templateId,
        entry.zone, values, designSettings, sidebar !== main && !isAts);
    const grid = (entry: ManagerSection, values: {title: string; description?: string}[], content: string, strengths = false) => {
      const columns = columnsFor(entry, values, strengths);
      return `<div class="${strengths ? "managed-strengths-grid" : "managed-item-grid"}" data-columns="${columns}" style="--section-columns:${columns}">${content}</div>`;
    };
    const renderKnowledge = (entry: ManagerSection) => {
      const knowledge = ensureKnowledgeSection(profile.knowledgeSection, profile.skills);
      if (!knowledge.isVisible) return "";
      const list = (items: KnowledgeItem[], category: KnowledgeCategory, mode: KnowledgeDisplayMode) => {
        const visible = visibleKnowledgeItems(items);
        if (isAts) return `<p>${visible.map((item) => escape(formatKnowledgeItem(item, category.showLevels, category.showYearsOfExperience, "comma-separated"))).join(", ")}</p>`;
        const content = visible.map((item) => {
          const text = escape(formatKnowledgeItem(item, category.showLevels, category.showYearsOfExperience, mode));
          const bar = !isAts && category.showLevels && mode === "level-bars" ? `<i class="managed-item-level" aria-hidden="true"><b style="width:${knowledgeLevelScores[item.level] * 20}%"></b></i>` : "";
          return `<div class="managed-item">${isAts ? "" : getThemedTechnologyIconMarkup(item.name, item.iconId)}<span class="managed-item-text">${text}${bar}</span></div>`;
        }).join("");
        return grid(entry, visible.map((item) => ({title: item.name, description: item.description})), content);
      };
      return knowledge.categories.filter((item) => item.isVisible).sort((a,b) => a.sortOrder-b.sortOrder).map((category) =>
        `<div class="managed-knowledge-category"><h4>${escape(category.title)}</h4>${category.subtitle ? `<small>${escape(category.subtitle)}</small>` : ""}${list(category.items, category, category.displayMode)}${category.subcategories.filter((sub) => sub.isVisible).sort((a,b) => a.sortOrder-b.sortOrder).map((sub) => `<h5>${escape(sub.title)}</h5>${list(sub.items, category, sub.displayMode ?? category.displayMode)}`).join("")}</div>`
      ).join("");
    };
    const container = (entry: ManagerSection) =>
      entry.zone === "sidebar" ? sidebar : main;
    const appendSection = (entry: ManagerSection, node: Element) => {
      const destination = container(entry);
      const closing = Array.from(destination.children).find(child => child.matches("footer,[class*='closing']"));
      destination.insertBefore(node, closing ?? null);
    };
    for (const entry of entries.filter((item) => !item.fixed)) {
      const existing = nodes.get(entry.id) ?? [];
      const group = groups.find((group) => group.id === entry.groupId);
      const items =
        group?.items
          .filter((item) => item.visible && item.text.trim())
          .sort((a, b) => a.order - b.order) ?? [];
      if (!entry.visible) {
        existing.forEach((node) => node.remove());
        nodes.delete(entry.id);
        continue;
      }
      // Template-independent blocks appear once; native career entries remain
      // on their planned pages and are never copied across page boundaries.
      let content = "";
      if (entry.id === "strengths") {
        if (number !== 1) {
          existing.forEach((node) => node.remove());
          nodes.delete(entry.id);
          continue;
        }
        // Read canonical records here: individual templates historically truncated
        // this list or omitted entries without descriptions.
        const explicit = profile.strengths.filter((item) => item.title.trim());
        if (!explicit.length && !items.length && !existing.length) continue;
        const strengths = items.length
          ? items.map((item) => ({
              title: item.text,
              description: item.description ?? "",
              iconId: item.icon || explicit.find((strength) => strength.title === item.text)?.iconId || "",
            }))
          : explicit.length
            ? explicit
            : [
                ...new Set(
                  profile.skills.map((value) => value.trim()).filter(Boolean),
                ),
              ].map((value) => {
                const [title, ...description] = value.split(/\s+(?:–|—|:)\s+/);
                return {
                  title,
                  description: description.join(" – "),
                  iconId: "",
                };
              });
        if (strengths.length) {
          const node = existing[0] ?? document.createElement("section");
          const heading =
            node.querySelector("h2,h3")?.outerHTML ??
            `<h3>${escape(entry.title)}</h3>`;
          node.setAttribute("data-managed-section", "strengths");
          if (!existing.length) node.className = "managed-extra";
          if (isAts) node.classList.add("managed-ats");
          node.innerHTML = `${heading}${grid(entry, strengths, strengths.map((item) => `<article class="managed-strength-card">${isAts ? "" : getThemedTechnologyIconMarkup(item.title, item.iconId)}<strong>${escape(item.title)}</strong>${item.description ? `<p>${escape(item.description)}</p>` : ""}</article>`).join(""), true)}`;
          setHeadingText(node.querySelector("h2,h3")!, entry.title);
          existing.slice(1).forEach((duplicate) => duplicate.remove());
          if (!existing.length) appendSection(entry, node);
          nodes.set(entry.id, [node]);
        }
        continue;
      }
      if (entry.id === "knowledge" && !items.length) {
        if (!hosts(entry.id)) {
          existing.forEach((node) => node.remove());
          nodes.delete(entry.id);
          continue;
        }
        content = renderKnowledge(entry);
        if (!content) {
          existing.forEach((node) => node.remove());
          nodes.delete(entry.id);
          continue;
        }
      } else if (items.length && hosts(entry.id)) {
        if (entry.id === "knowledge" || /knowledge|skills|technologies|tools|methods|technical/.test(group?.semanticType ?? "")) {
        const itemHtml = items.map((item) => `<div class="managed-item">${isAts ? "" : item.icon ? `<span aria-hidden="true">${escape(item.icon)}</span>` : getThemedTechnologyIconMarkup(item.text)}<span class="managed-item-text">${escape(item.text)}${item.level ? ` <small>${escape(item.level)}</small>` : ""}${item.description ? `<small>${escape(item.description)}</small>` : ""}</span></div>`);
        content = grid(entry, items.map((item) => ({title: item.text, description: item.description})), itemHtml.join(""));
        } else {
        const itemHtml = items.map(
          (item) =>
            `${group?.rendererType === "icon-list" && item.icon ? `<span aria-hidden="true">${escape(item.icon)}</span> ` : ""}${escape(item.text)}${item.level ? ` <small>${escape(item.level)}</small>` : ""}${item.description ? `<small>${escape(item.description)}</small>` : ""}`,
        );
        content =
          group?.rendererType === "tag-list"
            ? `<div class="managed-tags">${itemHtml.map((item) => `<span>${item}</span>`).join("")}</div>`
            : ["two-column-list", "compact-grid"].includes(
                  group?.rendererType ?? "",
                )
              ? `<div class="managed-columns">${itemHtml.map((item) => `<div>${item}</div>`).join("")}</div>`
              : group?.rendererType === "text-list"
                ? itemHtml.map((item) => `<p>${item}</p>`).join("")
                : `<ul>${itemHtml.map((item) => `<li>${item}</li>`).join("")}</ul>`;
        }
      } else if (entry.id.startsWith("special:") && (hosts(entry.id) || existing.length)) {
        const special = profile.specialSections.find(item => item.id === entry.id.slice(8));
        content = special ? renderCustomSectionContent(special) : "";
        if (!content) {
          existing.forEach(node => node.remove());
          nodes.delete(entry.id);
          continue;
        }
      }

      if (content && (entry.id === "knowledge" || entry.id.startsWith("special:")) && existing.length) {
        const node = existing[0];
        const heading = node.querySelector("h2,h3")?.outerHTML ?? `<h3>${escape(entry.title)}</h3>`;
        node.innerHTML = heading + content;
        if (entry.id.startsWith("special:")) node.setAttribute("data-section-type", "main-section");
        setHeadingText(node.querySelector("h2,h3")!, entry.title);
        if (isAts) node.classList.add("managed-ats");
        existing.slice(1).forEach((duplicate) => duplicate.remove());
        nodes.set(entry.id, [node]);
      } else if (content) {
        existing.forEach((node) => node.remove());
        const node = document.createElement("section");
        node.className = `managed-extra${isAts ? " managed-ats" : ""}`;
        node.setAttribute("data-managed-section", entry.id);
        if (entry.id.startsWith("special:")) node.setAttribute("data-section-type", "main-section");
        node.innerHTML = `<h3>${escape(entry.title)}</h3>${content}`;
        if (group?.pageBreakBefore) node.style.breakBefore = "page";
        appendSection(entry, node);
        nodes.set(entry.id, [node]);
      } else if (items.length && !hosts(entry.id)) {
        existing.forEach((node) => node.remove());
        nodes.delete(entry.id);
      } else {
        for (const node of existing) {
          const heading = node.querySelector("h2,h3");
          if (heading) {
            const continuation = /Fortsetzung/i.test(
              heading.textContent ?? "",
            )
              ? " · Fortsetzung"
              : "";
            setHeadingText(heading, entry.title + continuation);
          }
        }
      }
    }
    // Semantic hooks let both outputs inherit native styles without copying data
    // or assuming a user-provided section title has a particular meaning.
    for (const [id, sections] of nodes) {
      for (const node of sections) {
        if (!id.startsWith("special:") && !node.classList.contains("managed-extra")) continue;
        const resolvedId = resolveTemplateId(templateId);
        const surface = root.matches(".cv-sheet") ? "pdf" : "preview";
        const sources = resumeSectionStyleSources[surface][resolvedId as keyof typeof resumeSectionStyleSources.preview];
        node.setAttribute("data-custom-template", resolvedId);
        // Legacy fallback selectors must not override the native style contract.
        node.classList.remove("managed-extra");
        for (const [role, index] of [["entry-title", 2], ["supporting", 3]] as const) {
          const source = sources?.[index];
          if (!source) continue;
          const native = Array.from(root.querySelectorAll(source)).find(element => !element.closest("[data-custom-template]"));
          const tag = native?.tagName.toLowerCase() ?? source.match(/(?:^|[ >])([a-z][a-z0-9]*)$/)?.[1];
          if (!tag) continue;
          node.querySelectorAll(`[data-custom-role="${role}"]`).forEach(element => {
            if (element.tagName.toLowerCase() === tag) return;
            const replacement = document.createElement(tag);
            for (const attribute of Array.from(element.attributes)) replacement.setAttribute(attribute.name, attribute.value);
            replacement.innerHTML = element.innerHTML;
            element.replaceWith(replacement);
          });
        }
        const heading = node.querySelector("h2,h3");
        if (!heading) continue;
        heading.setAttribute("data-custom-role", "heading");
        if (resolvedId.startsWith("pehlione_")) {
          node.classList.add(surface === "pdf" ? "pehlione-pdf-section" : "pehlione-main-section");
          if (surface === "preview") heading.classList.add("pehlione-section-heading");
          const icon = document.createElement(surface === "pdf" ? "i" : "span");
          if (surface === "pdf") icon.className = "pehlione-pdf-section-icon";
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2 3 12l9 10 9-10Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
          const label = document.createElement(surface === "pdf" ? "span" : "b");
          label.setAttribute("data-custom-role", "heading-label");
          label.textContent = heading.textContent;
          heading.replaceChildren(icon, label);
        }
        if (resolvedId === "zeitgenoessisch") {
          node.classList.add(surface === "pdf" ? "zeit-pdf-section" : "zeitgenoessisch-section");
          const wrapper = document.createElement("header");
          wrapper.className = surface === "pdf" ? "zeit-pdf-heading" : "zeitgenoessisch-section-heading";
          wrapper.setAttribute("data-custom-role", "heading-wrapper");
          const icon = document.createElement(surface === "pdf" ? "i" : "span");
          if (surface === "preview") icon.className = "zeitgenoessisch-section-heading__icon";
          icon.setAttribute("aria-hidden", "true");
          icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">${zeitgenoessischExtraIcon(id, profile)}</svg>`;
          wrapper.appendChild(icon);
          const headingTag = surface === "pdf" ? "H3" : "H2";
          const nativeHeading = heading.tagName !== headingTag
            ? document.createElement(headingTag.toLowerCase())
            : heading;
          if (nativeHeading !== heading) {
            for (const attribute of Array.from(heading.attributes)) nativeHeading.setAttribute(attribute.name, attribute.value);
            nativeHeading.innerHTML = heading.innerHTML;
          }
          if (surface === "preview") nativeHeading.classList.add("zeitgenoessisch-section-heading__title");
          heading.replaceWith(wrapper);
          wrapper.appendChild(nativeHeading);
        }
      }
    }
    // An anchor preserves the template's header/contact/photo and footer order.
    const placementOrder = main === sidebar && profile.resumeManagerLayouts?.[templateId]?.length
      ? [...entries.filter((entry) => entry.zone === "main"), ...entries.filter((entry) => entry.zone === "sidebar")]
      : entries;
    for (const destination of profile.resumeManagerLayouts?.[templateId]?.length
      ? new Set([main, sidebar])
      : []) {
      const moving = placementOrder
        .filter(
          (entry) =>
            !entry.fixed && entry.visible && container(entry) === destination,
        )
        .flatMap((entry) => nodes.get(entry.id) ?? []);
      if (!moving.length) continue;
      const anchor = document.createComment("managed-sections");
      const first = Array.from(destination.children).find(
        (child) =>
          moving.includes(child) || child.matches("footer,[class*='closing']"),
      );
      destination.insertBefore(anchor, first ?? null);
      for (const node of moving) {
        if (node.parentElement !== destination) {
          node.setAttribute("data-managed-moved", "true");
        }
        destination.insertBefore(node, anchor);
        if (resolved.templateId === "pehlione_white" && root.matches(".cv-sheet") && destination === sidebar)
          node.querySelector("h3")?.classList.add("pehlione-pdf-sidebar-heading");
      }
      anchor.remove();
    }
    const specialWrapperSelector = resolved.templateId === "kompakt"
      ? ".kompakt-left > .resume-special-output-list"
      : resolved.templateId === "klassisch"
        ? ".klassisch-content > .resume-special-output-list"
        : null;
    if (specialWrapperSelector) for (const wrapper of root.querySelectorAll(specialWrapperSelector)) {
      const parent = wrapper.parentElement;
      if (!parent) continue;
      while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
      wrapper.remove();
    }
    // A section moved to the sidebar can carry the native PDF closing with it.
    // Keep the closing with the main column after section placement.
    if (resolved.templateId.startsWith("pehlione_") && root.matches(".cv-sheet")) {
      const closing = root.querySelector("footer.pehlione-pdf-closing");
      if (closing && closing.parentElement !== main) main.appendChild(closing);
    }
    // Quality rules shared by every template: no orphan headings, the same
    // header on both pages, no idle continuation sidebar, and unwrapped dates.
    // A career heading is an orphan only when its entries live on another page.
    const pagePlan = planned[number - 1];
    const careerPresent = (kind: "experience" | "education") =>
      !pagePlan ||
      pagePlan.items.some((item) => item.kind === kind) ||
      !planned.some((page) => page.items.some((item) => item.kind === kind));
    removeEmptyCareerSections(root, { experience: careerPresent("experience"), education: careerPresent("education") });
    if (number === 1 && (pages.length > 1 || totalPages > 1))
      ensureResumeHeaderContacts(root, enabled("personalData") ? profile : undefined);
    else if (firstPageHeader) repeatResumeHeader(root, firstPageHeader);
    else normalizeContinuationHeader(root, number, pages.length > 1 ? pages.length : totalPages,
      enabled("personalData") ? profile : undefined);
    keepDatesOnOneLine(root);
    applyResumePageLayout(root, templateId, root.matches(".cv-sheet") ? "pdf" : "preview", designSettings,
      profile.resumeColumnRatio, new Map(entries.map((entry) => [entry.id, entry.zone])), resolved.layout);
    const surface = root.matches(".cv-sheet") ? "pdf" : "preview";
    applyResumeSpacingOutput(root, templateId, surface, designSettings, resolved.design);
    applyResumeDesignOverrides(root, templateId, surface, designSettings, resolved.design);
    applyResumeMetadataLayout(root, profile, templateId, root.matches(".cv-sheet") ? "pdf" : "preview", designSettings);
    // A footer closing must stay inside the main column when a sidebar shares the page.
    const geometry = getPaginationGeometry(resolved.templateId);
    const hasSidebar =
      !isAts && resolved.layout.mode === "two-column" && geometry.columns === 2 &&
      (number === 1 ? planned[0]?.sidebar !== false : Boolean(root.querySelector("aside")));
    const sidebarMm = resolved.layout.sidebarWidthPercent * 2.1;
    const closingInset = !hasSidebar ? undefined
      : resolved.layout.overridden
        ? { left: resolved.layout.sidebarSide === "left" ? Math.round(sidebarMm + 8) : 12, right: resolved.layout.sidebarSide === "right" ? Math.round(sidebarMm + 8) : 12 }
        : { left: Math.max(12, Math.round(geometry.contentLeft)), right: Math.max(12, Math.round(210 - geometry.contentRight)) };
    applyResumeClosingOutput(root, main, profile, templateId, designSettings, last, enabled("closing"), closingInset);
    applyGeneralResumeAppearance(root, resolved.templateId, designSettings, main, sidebar);
    applyPehlioneAppearance(root, resolved.templateId, designSettings);
    applyResumeSectionHeadingColors(root, designSettings);
    if (number === 1) firstPageHeader = root.querySelector("header")?.cloneNode(true) as Element | null;
  });
  return document.body.innerHTML;
};
