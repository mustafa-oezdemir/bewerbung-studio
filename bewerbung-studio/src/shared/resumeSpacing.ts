import { compactCvDesignOverrides, getCvDesignVariables, getTemplateDocumentDesignDefaults, resolveCvDesign, resolveTemplateCvDesign } from "./cvDesign";
import { cvDesignLimits, type CvDesignTokens, type ResumeDesignLayer } from "./cvDesignSchema";
import { sectionSpacingLevelToMm, type DocumentDesignSettings } from "./documentDesign";
import type { DocumentDesignDraft } from "./documentEditorState";
import { resolveEffectiveDesignTokens, resolveResumeDesignView } from "./resumeDesignSystem";
import { resumeSectionStyleSources } from "./resumeSectionStyleInheritance";
import { resolveTemplateId } from "./templates";
import { getResumeLayoutHost } from "./resumeLayoutEngine";

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
`;

/** These templates pad their whole page by `--doc-margin` themselves, so a chosen margin is simply that variable. */
const marginFromVariable: ReadonlySet<string> = new Set(["zweispaltig", "zeitgenoessisch"]);

/**
 * How a chosen page margin reaches a template. A template draws its margin through containers of its own, so the
 * value moves the margin the template really has (typed in its native design) to the chosen one: the edge shifts by
 * the difference, on every side alike. Templates that pad their page by `--doc-margin` simply take the variable.
 */
export const getPageMarginAdjustment = (templateId: string, marginMm: number) => ({
  viaVariable: marginFromVariable.has(resolveTemplateId(templateId)),
  shiftMm: Math.round((marginMm - resolveTemplateCvDesign(templateId).spacing.pageMarginMm) * 100) / 100,
});

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
  const nativeSectionGap = id === "kreativ" || id === "stilvoll" || id === "kompakt";
  const legacyNativeSectionGap = nativeSectionGap && settings.sectionSpacingLevel !== getTemplateDocumentDesignDefaults(id).sectionSpacingLevel;
  if (!spacing && lineHeight === undefined && !legacyNativeSectionGap) return;
  const scope = (surface === "pdf" ? page.querySelector(".page-content") : page.firstElementChild) as HTMLElement | null;
  if (!scope) return;
  if (nativeSectionGap) {
    const property = `--${id}-section-gap-base`;
    const defaultGap = resolveTemplateCvDesign(id).spacing.sectionGapMm;
    const legacyGap = id === "kompakt"
      ? Math.max(3.5, sectionSpacingLevelToMm[settings.sectionSpacingLevel] - 1)
      : sectionSpacingLevelToMm[settings.sectionSpacingLevel];
    const gap = spacing?.sectionGapMm ?? (legacyNativeSectionGap ? legacyGap : defaultGap);
    scope.style.setProperty(property, `${gap}mm`);
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
  if (spacing?.pageMarginMm !== undefined) {
    const { viaVariable, shiftMm } = getPageMarginAdjustment(id, spacing.pageMarginMm);
    if (viaVariable) scope.style.setProperty("--doc-margin", variables["--doc-page-margin"]);
    else if (shiftMm >= 0) scope.style.padding = `${shiftMm}mm`;
    else {
      // A smaller margin widens the content box beyond the sheet by the same amount on every side.
      scope.style.margin = `${shiftMm}mm`;
      scope.style.width = `calc(100% + ${-2 * shiftMm}mm)`;
      scope.style.height = `calc(100% + ${-2 * shiftMm}mm)`;
    }
  }
  if (spacing?.innerPaddingMm !== undefined) scope.style.setProperty("--doc-padding", variables["--doc-inner-padding"]);
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
  if (spacing?.sectionGapMm !== undefined) for (const section of sections) {
    section.setAttribute("data-resume-spacing-section", "");
    // A column that spaces its sections with a gap of its own (Gepflegt, Modern) hands that spacing over to the chosen one.
    section.parentElement?.setAttribute("data-resume-spacing-section-stack", "");
    const previous = section.previousElementSibling;
    if (previous?.hasAttribute("data-managed-section")) section.setAttribute("data-resume-spacing-section-following", "");
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
  if (spacing?.innerPaddingMm !== undefined) {
    const zones = host ? Array.from(host.children).filter(child => child.matches('main,aside,[data-resume-layout-zone],[class*="-content"],[class*="-column"],[class*="-sidebar"]')) : [];
    if (zones.length) for (const zone of zones) (zone as HTMLElement).style.paddingInline = variables["--doc-inner-padding"];
    else if (host && host !== scope) host.style.paddingInline = variables["--doc-inner-padding"];
  }
};
