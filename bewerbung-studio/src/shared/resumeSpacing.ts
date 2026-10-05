import { compactCvDesignOverrides, getCvDesignVariables, getTemplateDocumentDesignDefaults, resolveCvDesign, resolveTemplateCvDesign } from "./cvDesign";
import { cvDesignLimits, type CvDesignTokens, type ResumeDesignLayer } from "./cvDesignSchema";
import { fontSizeToPt, lineHeightLevelToValue, marginLevelToMm, sectionSpacingLevelToMm, type DocumentDesignSettings } from "./documentDesign";
import type { DocumentDesignDraft } from "./documentEditorState";
import { resolveEffectiveDesignTokens, resolveResumeDesignView } from "./resumeDesignSystem";
import { resumeSectionStyleSources } from "./resumeSectionStyleInheritance";
import { resolveTemplateId } from "./templates";
import { getResumeColumnsHost, getResumeLayoutHost } from "./resumeLayoutEngine";

type Spacing = CvDesignTokens["spacing"];
export type ResumeSpacingPreset = "compact" | "standard" | "large" | "custom";
export const resumeSpacingFields: { key: keyof Spacing; label: string }[] = [
  { key: "pageMarginMm", label: "Seitenränder" },
  { key: "innerPaddingMm", label: "Innenabstand" },
  { key: "sectionGapMm", label: "Abschnittsabstand" },
  { key: "entryGapMm", label: "Eintragsabstand" },
  { key: "sectionTitleGapMm", label: "Abstand nach Abschnittstitel" },
  { key: "entryContentGapMm", label: "Abstand nach Eintragstitel" },
  { key: "columnGapMm", label: "Spaltenabstand" },
];

const clamp = (key: keyof typeof cvDesignLimits, value: number) =>
  Math.round(Math.max(cvDesignLimits[key][0], Math.min(cvDesignLimits[key][1], value)) * 10) / 10;

/** Kompakt/Groß scale the template's own values, with the shared Lebenslauf layer on top (never the legacy sliders). */
const presetBase = (templateId: string, global?: ResumeDesignLayer) => resolveCvDesign(templateId, global?.cvOverrides);

export const getResumeSpacingPresetValues = (templateId: string, preset: "compact" | "large", base?: CvDesignTokens) => {
  const defaults = base ?? resolveTemplateCvDesign(templateId);
  const factor = preset === "compact" ? 0.8 : 1.2;
  const spacing = Object.fromEntries(resumeSpacingFields.map(({ key }) => [key,
    clamp(key, defaults.spacing[key] * factor)])) as Spacing;
  return { spacing, lineHeight: clamp("lineHeight", defaults.typography.lineHeight + (preset === "compact" ? -0.1 : 0.1)) };
};

export const getResumeSpacingPreset = (templateId: string, settings: DocumentDesignSettings, global?: ResumeDesignLayer): ResumeSpacingPreset => {
  const defaults = getTemplateDocumentDesignDefaults(templateId);
  const legacyChanged = (["marginLevel", "paddingLevel", "sectionSpacingLevel", "lineHeightLevel"] as const)
    .some((key) => settings[key] !== defaults[key]);
  const spacing = settings.cvOverrides?.spacing;
  const lineHeight = settings.cvOverrides?.typography?.lineHeight;
  if (!spacing && lineHeight === undefined) return legacyChanged ? "custom" : "standard";
  const inherited = resolveResumeDesignView(templateId, settings, global).inherited.tokens;
  for (const preset of ["compact", "large"] as const) {
    const expected = getResumeSpacingPresetValues(templateId, preset, presetBase(templateId, global));
    // A preset value that equals the inherited one is never stored, so a missing field counts as that value.
    if ((lineHeight ?? inherited.typography.lineHeight) === expected.lineHeight
      && resumeSpacingFields.every(({ key }) => (spacing?.[key] ?? inherited.spacing[key]) === expected.spacing[key])) return preset;
  }
  return "custom";
};

/** Show legacy saved slider values accurately until an explicit semantic field replaces them. */
export const resolveEffectiveResumeSpacing = (templateId: string, settings: DocumentDesignSettings): CvDesignTokens =>
  resolveEffectiveDesignTokens(templateId, settings);

export const applyResumeSpacingPreset = (
  draft: DocumentDesignDraft,
  preset: "compact" | "standard" | "large",
  global?: ResumeDesignLayer,
): DocumentDesignDraft => {
  const defaults = getTemplateDocumentDesignDefaults(draft.templateId);
  const current = draft.settings.cvOverrides ?? {};
  const { lineHeight: _lineHeight, ...typography } = current.typography ?? {};
  const base = presetBase(draft.templateId, global);
  const next = preset === "standard" ? { ...current, spacing: undefined, typography } : (() => {
    const values = getResumeSpacingPresetValues(draft.templateId, preset, base);
    return { ...current, spacing: values.spacing, typography: { ...typography, lineHeight: values.lineHeight } };
  })();
  const compact = compactCvDesignOverrides(draft.templateId, next, base);
  return { ...draft, settings: {
    ...draft.settings,
    ...(preset === "standard" ? {
      marginLevel: defaults.marginLevel, paddingLevel: defaults.paddingLevel,
      sectionSpacingLevel: defaults.sectionSpacingLevel, lineHeightLevel: defaults.lineHeightLevel,
    } : {}),
    cvOverrides: Object.keys(compact).length ? compact : undefined,
  } };
};

export const resumeSpacingCss = `
[data-resume-spacing-section-gap] [data-resume-spacing-section]{margin-block-end:0!important}
[data-resume-spacing-section-gap] [data-resume-spacing-section-following]{margin-block-start:var(--doc-section-gap)!important}
[data-resume-spacing-section-gap] [data-resume-spacing-section-stack]{row-gap:0!important}
[data-resume-spacing-entry-gap] [data-resume-spacing-list]{row-gap:0!important}
[data-resume-spacing-entry-gap] [data-resume-spacing-entry]{margin-block-end:0!important}
[data-resume-spacing-entry-gap] [data-resume-spacing-entry-following]{margin-block-start:var(--doc-entry-gap)!important}
[data-resume-spacing-title-gap] [data-resume-spacing-title]{margin-block-end:var(--doc-section-title-gap)!important}
[data-resume-spacing-content-gap] [data-resume-spacing-entry-title]{margin-block-end:var(--doc-entry-content-gap)!important}
[data-resume-spacing-line-height] :is(p,li){line-height:var(--doc-line-height)!important}
[data-resume-spacing-text] [data-managed-section] > :not([data-resume-background-layer]){box-sizing:border-box;margin-inline:calc(var(--resume-page-text-shift,0mm) + var(--resume-inner-text-inset,0mm))!important}
[data-resume-spacing-text]:is(.pehlione-resume,.pehlione-pdf) .pehlione-contacts{box-sizing:border-box;margin-inline:calc(var(--resume-page-text-shift,0mm) + var(--resume-inner-text-inset,0mm))!important}
[data-resume-spacing-text] [data-resume-spacing-edge-start] > :first-child{padding-block-start:max(0mm,calc(var(--resume-page-text-shift,0mm) + var(--resume-inner-text-inset,0mm)))!important;margin-block-start:min(0mm,calc(var(--resume-page-text-shift,0mm) + var(--resume-inner-text-inset,0mm)))!important}
[data-resume-spacing-text] [data-resume-spacing-edge-end] > :last-child{padding-block-end:max(0mm,calc(var(--resume-page-text-shift,0mm) + var(--resume-inner-text-inset,0mm)))!important;margin-block-end:min(0mm,calc(var(--resume-page-text-shift,0mm) + var(--resume-inner-text-inset,0mm)))!important}
[data-resume-spacing-text] [data-resume-spacing-edge-start][data-resume-spacing-after-content] > :first-child{margin-block-start:0mm!important}
[data-resume-spacing-text] [data-resume-spacing-edge-end][data-resume-spacing-before-content] > :last-child{margin-block-end:0mm!important}
`;

/**
 * Whether a column shows something of its own (a header, a photo, a footer) before or after the section, outside
 * every managed section. Such a section does not stand at the column edge.
 */
const zoneHasOwnContent = (zone: Element, section: Element, side: "before" | "after") => {
  const nodes = Array.from(zone.querySelectorAll("*"));
  const at = nodes.indexOf(section);
  return (side === "before" ? nodes.slice(0, at) : nodes.slice(at + 1)).some((node) =>
    !node.contains(section) && !section.contains(node)
    && !node.closest("[data-managed-section],style,script,[data-resume-background-layer]")
    && (node.matches("img,svg,figure") || Array.from(node.childNodes).some((child) => child.nodeType === 3 && (child.textContent ?? "").trim() !== "")));
};

export const getPageMarginAdjustment = (templateId: string, marginMm: number) => ({
  viaVariable: false,
  shiftMm: Math.round((marginMm - resolveTemplateCvDesign(templateId).spacing.pageMarginMm) * 100) / 100,
});

const managedSelector = "[data-managed-section]";
const managedIn = (node: Element) => (node.matches(managedSelector) ? [node] : []).concat(Array.from(node.querySelectorAll(managedSelector)));

/**
 * The section that stands directly above `section` in its column. A template may hold every section in a wrapper element
 * of its own (Zweispaltig's `zweispaltig-ordered-section`): the section is then the only child of its wrapper, and the one
 * above it is the last section inside the wrapper before. A wrapper that holds nothing is skipped; content of the column
 * that is no section (a header, a photo) between the two means there is no section above.
 */
export const getSectionAbove = (section: Element, scope: Element, host: Element | null = null): Element | null => {
  let node: Element = section;
  while (node !== scope) {
    let sibling = node.previousElementSibling;
    while (sibling) {
      const inner = managedIn(sibling);
      if (inner.length) return inner[inner.length - 1];
      if ((sibling.textContent ?? "").trim() || sibling.querySelector("img,svg,figure")) return null;
      sibling = sibling.previousElementSibling;
    }
    const parent: Element | null = node.parentElement;
    // Only a wrapper that holds this section alone leads on; a column of the layout (a child of the columns host) never does:
    // the section is the first of its column.
    if (!parent || parent === scope || (host && (parent === host || parent.parentElement === host)) || managedIn(parent).length !== managedIn(node).length) return null;
    node = parent;
  }
  return null;
};

/** The element that holds the sections of one column: the first ancestor of the section that holds more than one. */
const getSectionStack = (section: Element): Element | null => {
  let node: Element | null = section.parentElement;
  while (node && managedIn(node).length <= 1) node = node.parentElement;
  return node;
};

/** Annotate only explicitly changed fields; untouched templates keep native CSS. */
export const applyResumeSpacingOutput = (
  page: Element,
  templateId: string,
  surface: "preview" | "pdf",
  settings: DocumentDesignSettings,
  resolvedDesign?: CvDesignTokens,
): void => {
  const overrides = settings.cvOverrides;
  const spacing = overrides?.spacing;
  const lineHeight = overrides?.typography?.lineHeight;
  const id = resolveTemplateId(templateId);
  const defaults = getTemplateDocumentDesignDefaults(id);
  const zweispaltigLegacyTypography = id === "zweispaltig" &&
    (settings.fontSize !== defaults.fontSize || settings.lineHeightLevel !== defaults.lineHeightLevel);
  const zweispaltigLegacyMargin = id === "zweispaltig" && settings.marginLevel !== defaults.marginLevel;
  const nativeSectionGap = id === "kreativ" || id === "stilvoll" || id === "kompakt" || id === "zweispaltig";
  const legacyNativeSectionGap = nativeSectionGap && settings.sectionSpacingLevel !== defaults.sectionSpacingLevel;
  if (!spacing && lineHeight === undefined && !legacyNativeSectionGap && !zweispaltigLegacyTypography && !zweispaltigLegacyMargin) return;
  const scope = (surface === "pdf" ? page.querySelector(".page-content") : page.firstElementChild) as HTMLElement | null;
  if (!scope) return;
  if (zweispaltigLegacyTypography) {
    if (settings.fontSize !== defaults.fontSize && overrides?.typography?.bodySizePt === undefined)
      scope.style.setProperty("--doc-body-size", `${fontSizeToPt[settings.fontSize]}pt`);
    if (settings.lineHeightLevel !== defaults.lineHeightLevel && lineHeight === undefined)
      scope.style.setProperty("--doc-line-height", String(lineHeightLevelToValue[settings.lineHeightLevel]));
  }
  if (nativeSectionGap) {
    const property = `--${id}-section-gap-base`;
    const defaultGap = resolveTemplateCvDesign(id).spacing.sectionGapMm;
    const legacyGap = id === "kompakt"
      ? Math.max(3.5, sectionSpacingLevelToMm[settings.sectionSpacingLevel] - 1)
      : sectionSpacingLevelToMm[settings.sectionSpacingLevel];
    const gap = spacing?.sectionGapMm ?? (legacyNativeSectionGap ? legacyGap : defaultGap);
    // Zweispaltig spaces its following sections by the central Abschnittsabstand (below); the first section keeps the
    // template's own distance to the header, so only a legacy slider value moves the base.
    if (id !== "zweispaltig" || (spacing?.sectionGapMm === undefined && legacyNativeSectionGap)) scope.style.setProperty(property, `${gap}mm`);
  }
  if (id === "stilvoll" && spacing?.entryGapMm !== undefined)
    scope.style.setProperty("--stilvoll-entry-gap-base", `${spacing.entryGapMm}mm`);
  if (id === "kompakt" && spacing?.entryGapMm !== undefined)
    scope.style.setProperty("--kompakt-entry-gap-base", `${spacing.entryGapMm}mm`);
  const design = resolvedDesign ?? resolveCvDesign(id, overrides);
  const variables = getCvDesignVariables(design);
  for (const { key } of resumeSpacingFields) if (spacing?.[key] !== undefined) {
    const name = `--doc-${key.replace(/Mm$/, "").replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
    scope.style.setProperty(name, variables[name]);
  }
  if (id === "zweispaltig" && (spacing?.pageMarginMm !== undefined || zweispaltigLegacyMargin)) {
    // Header, columns and footer share the same physical page box. A changed margin is symmetric;
    // the native 25/20 mm asymmetry stays intact when no margin was chosen.
    const margin = spacing?.pageMarginMm ?? marginLevelToMm[settings.marginLevel];
    scope.style.setProperty("--zweispaltig-margin-left", `${margin}mm`);
    scope.style.setProperty("--zweispaltig-margin-right", `${margin}mm`);
  } else if (spacing?.pageMarginMm !== undefined && id !== "zeitgenoessisch") {
    scope.style.setProperty("--resume-page-text-shift", `${getPageMarginAdjustment(id, spacing.pageMarginMm).shiftMm}mm`);
  }
  if (spacing?.innerPaddingMm !== undefined) {
    scope.style.setProperty("--doc-padding", variables["--doc-inner-padding"]);
    const nativePadding = resolveTemplateCvDesign(id).spacing.innerPaddingMm;
    scope.style.setProperty("--resume-inner-text-inset", `${Math.round((spacing.innerPaddingMm - nativePadding) * 100) / 100}mm`);
  }
  if ((id !== "zweispaltig" && id !== "zeitgenoessisch" && spacing?.pageMarginMm !== undefined) || spacing?.innerPaddingMm !== undefined)
    scope.setAttribute("data-resume-spacing-text", "");
  if (spacing?.sectionGapMm !== undefined) scope.setAttribute("data-resume-spacing-section-gap", "");
  if (spacing?.entryGapMm !== undefined) scope.setAttribute("data-resume-spacing-entry-gap", "");
  if (spacing?.sectionTitleGapMm !== undefined) scope.setAttribute("data-resume-spacing-title-gap", "");
  if (spacing?.entryContentGapMm !== undefined) scope.setAttribute("data-resume-spacing-content-gap", "");
  if (lineHeight !== undefined) {
    scope.style.setProperty("--doc-line-height", String(lineHeight));
    scope.style.setProperty("--body-line", String(lineHeight));
    scope.setAttribute("data-resume-spacing-line-height", "");
  }

  const sections = Array.from(scope.querySelectorAll("[data-managed-section]"));
  if ((id !== "zweispaltig" && id !== "zeitgenoessisch" && spacing?.pageMarginMm !== undefined) || spacing?.innerPaddingMm !== undefined) {
    const zones = new Map<Element, Element[]>();
    const layoutHost = getResumeLayoutHost(scope, id, surface);
    for (const section of sections) {
      let zone: Element = scope;
      if (layoutHost?.contains(section)) {
        let child = section;
        while (child.parentElement && child.parentElement !== layoutHost) child = child.parentElement;
        zone = child;
      }
      zones.set(zone, [...(zones.get(zone) ?? []), section]);
    }
    for (const [zone, zoneSections] of zones) {
      const first = zoneSections[0];
      const last = zoneSections[zoneSections.length - 1];
      first?.setAttribute("data-resume-spacing-edge-start", "");
      last?.setAttribute("data-resume-spacing-edge-end", "");
      // A header or photo of the column stands before (or a footer after) the section: the section is not at the
      // column edge, so a smaller margin or padding never pulls it onto that block.
      if (first && zoneHasOwnContent(zone, first, "before")) first.setAttribute("data-resume-spacing-after-content", "");
      if (last && zoneHasOwnContent(zone, last, "after")) last.setAttribute("data-resume-spacing-before-content", "");
    }
  }
  const sectionHost = getResumeColumnsHost(scope, id, surface);
  if (spacing?.sectionGapMm !== undefined) for (const section of sections) {
    section.setAttribute("data-resume-spacing-section", "");
    // A column that spaces its sections with a gap of its own (Gepflegt, Modern) hands that spacing over to the chosen one.
    (getSectionStack(section) ?? section.parentElement)?.setAttribute("data-resume-spacing-section-stack", "");
    if (getSectionAbove(section, scope, sectionHost)) section.setAttribute("data-resume-spacing-section-following", "");
  }
  const sources = resumeSectionStyleSources[surface][id as keyof typeof resumeSectionStyleSources.preview];
  if (sources) {
    if (spacing?.sectionTitleGapMm !== undefined) {
      // The headings a zone-flow template rebuilds (`data-cv-heading`) keep following the title gap.
      const titleSelector = `${id === "klassisch"
        ? `${sources[1]},[data-custom-template="klassisch"] [data-custom-role="heading"]`
        : sources[1]},[data-cv-heading]`;
      scope.querySelectorAll(titleSelector).forEach(node => node.setAttribute("data-resume-spacing-title", ""));
    }
    if (spacing?.entryContentGapMm !== undefined)
      scope.querySelectorAll(sources[2]).forEach(node => node.setAttribute("data-resume-spacing-entry-title", ""));
    if (spacing?.entryGapMm !== undefined) {
      const entries = Array.from(scope.querySelectorAll(sources[6]));
      const wrappers = sources[5] ? Array.from(scope.querySelectorAll(sources[5]))
        .filter(node => entries.some(entry => node.contains(entry))) : [];
      const items = wrappers.some(node => node.previousElementSibling && wrappers.includes(node.previousElementSibling))
        ? wrappers : entries;
      for (const item of items) {
        item.setAttribute("data-resume-spacing-entry", "");
        if (item.previousElementSibling && items.includes(item.previousElementSibling))
          item.setAttribute("data-resume-spacing-entry-following", "");
        item.parentElement?.setAttribute("data-resume-spacing-list", "");
      }
    }
  }
  const host = getResumeLayoutHost(scope, id, surface) as HTMLElement | null;
  if (spacing?.columnGapMm !== undefined && host) host.style.columnGap = variables["--doc-column-gap"];
};
