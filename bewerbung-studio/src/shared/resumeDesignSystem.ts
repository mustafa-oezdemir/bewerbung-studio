import { cvDesignOverridesSchema, type CvDesignOverrides, type CvDesignTokens, type ResumeDesignLayer } from "./cvDesignSchema";
import {
  getTemplateDocumentDesignDefaults, resolveCvDesign, resolveTemplateCvDesign, resolveTemplateResumeAppearance,
} from "./cvDesign";
import {
  fontSizeToPt, lineHeightLevelToValue, marginLevelToMm, paddingLevelToMm, sectionSpacingLevelToMm,
  type DocumentDesignSettings,
} from "./documentDesign";
import {
  defaultSectionDividerWidthMm, resumeAppearanceSchema, type ResolvedResumeAppearance, type ResumeAppearance,
} from "./resumeAppearance";
import { resolveTemplateId } from "./templates";

/**
 * The Lebenslauf design system in one place.
 *
 * Every Lebenslauf value is resolved through the same layers, lowest first:
 *   1. the template's own design (typed, complete: `getNativeResumeDesign`)
 *   2. the legacy slider/font levels of the document, where they differ from the template's defaults
 *   3. the shared Lebenslauf layer of the workspace (`settings.resumeDesign`), valid for every template
 *   4. the document's own sparse overrides (`designSettings.cvOverrides` / `resumeAppearance`, which also hold
 *      the per-template snapshots a document keeps when its template changes)
 * A layer only holds what the user changed; a missing value always means "inherit".
 */

export type ResumeDesignSource = "template" | "global" | "document";

const definedFields = <T extends object>(fields: T | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(fields ?? {}).filter(([, value]) => value !== undefined)) as Partial<T>;

const tokenGroups = ["colors", "typography", "spacing"] as const;

/** Later layers win field by field; empty groups disappear. */
export const mergeCvDesignOverrides = (...layers: (CvDesignOverrides | undefined)[]): CvDesignOverrides => {
  const merged: CvDesignOverrides = {};
  for (const group of tokenGroups) {
    const fields = Object.assign({}, ...layers.map((layer) => definedFields(layer?.[group])));
    if (Object.keys(fields).length) Object.assign(merged, { [group]: fields });
  }
  return merged;
};

/** "Line visible" and "line position" describe one decision, so a layer that names either one replaces both. */
const dividerKeys = ["sectionDividerVisible", "sectionDividerPosition"] as const;

export const mergeResumeAppearance = (...layers: (ResumeAppearance | undefined)[]): ResumeAppearance => {
  let merged: ResumeAppearance = {};
  for (const layer of layers) {
    const fields = definedFields(layer);
    if (dividerKeys.some((key) => fields[key] !== undefined)) merged = definedFields({ ...merged, sectionDividerVisible: undefined, sectionDividerPosition: undefined });
    merged = { ...merged, ...fields };
  }
  return merged;
};

export const isEmptyResumeDesignLayer = (layer: ResumeDesignLayer | undefined) =>
  !layer || (!Object.keys(mergeCvDesignOverrides(layer.cvOverrides)).length
    && !Object.keys(mergeResumeAppearance(layer.resumeAppearance)).length);

/** A layer with its empty parts removed, ready to persist; `undefined` when nothing is left. */
export const compactResumeDesignLayer = (layer: ResumeDesignLayer | undefined): ResumeDesignLayer | undefined => {
  if (!layer) return undefined;
  const cvOverrides = mergeCvDesignOverrides(cvDesignOverridesSchema.parse(layer.cvOverrides ?? {}));
  const resumeAppearance = mergeResumeAppearance(resumeAppearanceSchema.parse(layer.resumeAppearance ?? {}));
  const compact: ResumeDesignLayer = {
    ...(Object.keys(cvOverrides).length ? { cvOverrides } : {}),
    ...(Object.keys(resumeAppearance).length ? { resumeAppearance } : {}),
  };
  return Object.keys(compact).length ? compact : undefined;
};

/**
 * The document's settings with the shared layer folded in below the document's own overrides. This is the one place
 * where the shared layer reaches an output: the preview, the PDF, the page planner and the design panel all resolve
 * from the settings this returns, so none of them can disagree. Without a layer the very same object comes back.
 */
export const applyGlobalResumeDesign = <Settings extends DocumentDesignSettings>(
  settings: Settings,
  layer: ResumeDesignLayer | undefined,
): Settings => {
  if (isEmptyResumeDesignLayer(layer)) return settings;
  const cvOverrides = mergeCvDesignOverrides(layer?.cvOverrides, settings.cvOverrides);
  const resumeAppearance = mergeResumeAppearance(layer?.resumeAppearance, settings.resumeAppearance);
  // The old appearance field and the semantic spacing token address the same margin.
  // Resolve their layers before handing settings to preview, PDF and pagination.
  if (settings.cvOverrides?.spacing?.sectionTitleGapMm !== undefined && layer?.resumeAppearance?.sectionHeadingMarginAfterMm !== undefined)
    delete resumeAppearance.sectionHeadingMarginAfterMm;
  if (settings.resumeAppearance?.sectionHeadingMarginAfterMm !== undefined && settings.cvOverrides?.spacing?.sectionTitleGapMm === undefined &&
      layer?.cvOverrides?.spacing?.sectionTitleGapMm !== undefined) {
    const { sectionTitleGapMm: _inheritedGap, ...restSpacing } = cvOverrides.spacing ?? {};
    if (Object.keys(restSpacing).length) cvOverrides.spacing = restSpacing;
    else delete cvOverrides.spacing;
  }
  const { cvOverrides: _cv, resumeAppearance: _appearance, ...rest } = settings;
  return {
    ...rest,
    ...(Object.keys(cvOverrides).length ? { cvOverrides } : {}),
    ...(Object.keys(resumeAppearance).length ? { resumeAppearance } : {}),
  } as Settings;
};

const roundTenth = (value: number) => Math.round(value * 10) / 10;

/**
 * Templates whose Lebenslauf ignores the document-wide size sliders (Seitenrand-, Innenabstand-, Abschnitts-,
 * Zeilenhöhen- und Schriftgrößenstufe of the "Dokumentweit: Anschreiben und Deckblatt" group): their CV is drawn from
 * the native design plus the semantic Lebenslauf settings only. Klassisch: a new Bewerbung carries the app-wide slider
 * defaults, which would otherwise read as a choice and replace its DIN-oriented page (25 / 20 mm, 11 pt / 1.2).
 */
const nativeSizeTemplates = new Set(["klassisch"]);
export const foldsDocumentSizeSliders = (templateId: string) => !nativeSizeTemplates.has(resolveTemplateId(templateId));

/**
 * The tokens a document shows. Saved legacy slider/font levels still count while no semantic override names the same
 * value, so documents created before the semantic panel keep their look and are displayed accurately.
 */
export const resolveEffectiveDesignTokens = (templateId: string, settings: DocumentDesignSettings): CvDesignTokens => {
  const design = resolveCvDesign(templateId, settings.cvOverrides);
  const sliders = getTemplateDocumentDesignDefaults(templateId);
  // A template that ignores the size sliders compares them with themselves: no level counts as changed.
  const defaults = foldsDocumentSizeSliders(templateId) ? sliders : {
    ...sliders, marginLevel: settings.marginLevel, paddingLevel: settings.paddingLevel, sectionSpacingLevel: settings.sectionSpacingLevel,
    lineHeightLevel: settings.lineHeightLevel, fontSize: settings.fontSize,
  };
  const semantic = settings.cvOverrides;
  const spacing = { ...design.spacing };
  const typography = { ...design.typography };
  if (semantic?.spacing?.pageMarginMm === undefined && settings.marginLevel !== defaults.marginLevel)
    spacing.pageMarginMm = marginLevelToMm[settings.marginLevel];
  if (semantic?.spacing?.innerPaddingMm === undefined && settings.paddingLevel !== defaults.paddingLevel)
    spacing.innerPaddingMm = paddingLevelToMm[settings.paddingLevel];
  if (semantic?.spacing?.sectionGapMm === undefined && settings.sectionSpacingLevel !== defaults.sectionSpacingLevel)
    spacing.sectionGapMm = sectionSpacingLevelToMm[settings.sectionSpacingLevel];
  if (semantic?.typography?.lineHeight === undefined && settings.lineHeightLevel !== defaults.lineHeightLevel)
    typography.lineHeight = lineHeightLevelToValue[settings.lineHeightLevel];
  if (semantic?.typography?.fontId === undefined && settings.fontId !== defaults.fontId) typography.fontId = settings.fontId;
  if (semantic?.typography?.headingFontId === undefined && settings.headingFontId !== defaults.headingFontId)
    typography.headingFontId = settings.headingFontId;
  // Pehlione's stylesheet fixes its sizes; every other template follows the document font size linearly.
  if (semantic?.typography?.bodySizePt === undefined && settings.fontSize !== defaults.fontSize && !templateId.startsWith("pehlione_"))
    typography.bodySizePt = roundTenth(typography.bodySizePt + fontSizeToPt[settings.fontSize] - fontSizeToPt[defaults.fontSize]);
  if (semantic?.spacing?.sectionTitleGapMm === undefined && settings.resumeAppearance?.sectionHeadingMarginAfterMm !== undefined)
    spacing.sectionTitleGapMm = settings.resumeAppearance.sectionHeadingMarginAfterMm;
  return { ...design, spacing, typography };
};

/** Native appearance with the given sparse layers on top; "template" choices and no value both mean native. */
export const resolveResumeAppearance = (templateId: string, ...layers: (ResumeAppearance | undefined)[]): ResolvedResumeAppearance => {
  const native = resolveTemplateResumeAppearance(templateId);
  const saved = mergeResumeAppearance(...layers.map((layer) => resumeAppearanceSchema.parse(layer ?? {})));
  const position = saved.sectionDividerVisible === false ? "none" : saved.sectionDividerPosition ?? native.sectionDividerPosition;
  const pick = <Key extends keyof typeof native>(key: Key) => (saved as Partial<typeof native>)[key] ?? native[key];
  const width = saved.sectionDividerWidthMm ?? (position !== "none" && native.sectionDividerWidthMm === 0 ? defaultSectionDividerWidthMm : native.sectionDividerWidthMm);
  return {
    sidebarBackgroundColor: pick("sidebarBackgroundColor"),
    sidebarTextColor: pick("sidebarTextColor"),
    sidebarSectionHeadingColor: saved.sidebarSectionHeadingColor ?? saved.sidebarTextColor ?? native.sidebarSectionHeadingColor,
    mainBackgroundColor: pick("mainBackgroundColor"),
    sectionDividerPosition: position,
    sectionDividerVisible: position !== "none",
    sectionDividerWidthMm: width,
    sectionHeadingAlignment: pick("sectionHeadingAlignment"),
    sectionHeadingMarginBeforeMm: pick("sectionHeadingMarginBeforeMm"),
    photoDecorationVisible: saved.photoDecorationVisible ?? native.photoDecorationVisible,
    photoDecorationColor: pick("photoDecorationColor"),
    contactDividerColor: pick("contactDividerColor"),
    photoLayout: saved.photoLayout && saved.photoLayout !== "template" ? saved.photoLayout : native.photoLayout,
    headerLayout: saved.headerLayout && saved.headerLayout !== "template" ? saved.headerLayout : native.headerLayout,
  };
};

/** Drop the appearance values that equal what the document inherits anyway. */
export const compactResumeAppearance = (
  appearance: ResumeAppearance,
  inherited: ResolvedResumeAppearance,
): ResumeAppearance => {
  const parsed = resumeAppearanceSchema.parse(appearance);
  const same = (key: keyof ResolvedResumeAppearance, value: unknown) => {
    const current = inherited[key];
    return typeof current === "string" ? String(value).toLowerCase() === current.toLowerCase() : value === current;
  };
  const kept = Object.fromEntries(Object.entries(parsed).filter(([key, value]) => {
    if (value === undefined) return false;
    if (key === "photoLayout" || key === "headerLayout") return value !== "template" && !same(key, value);
    if (key === "sectionHeadingMarginAfterMm") return true;
    if (key === "sectionDividerVisible") return !same("sectionDividerVisible", value);
    return !same(key as keyof ResolvedResumeAppearance, value);
  })) as ResumeAppearance;
  return kept;
};

export type ResumeDesignView = {
  templateId: string;
  /** What the template draws by itself. */
  native: { tokens: CvDesignTokens; appearance: ResolvedResumeAppearance };
  /** Template plus shared layer only: the value edited in global scope. */
  editableGlobal: { tokens: CvDesignTokens; appearance: ResolvedResumeAppearance };
  /** What the document shows if it drops all of its own overrides: the template with the shared layer on top. */
  inherited: { tokens: CvDesignTokens; appearance: ResolvedResumeAppearance };
  /** What the document shows now; every input of the design panel displays this. */
  effective: { tokens: CvDesignTokens; appearance: ResolvedResumeAppearance };
  sourceOfToken: <Group extends keyof CvDesignTokens>(group: Group, key: keyof CvDesignTokens[Group]) => ResumeDesignSource;
  sourceOfAppearance: (key: keyof ResumeAppearance) => ResumeDesignSource;
  /** True while the shared layer or the document holds any value. */
  hasGlobalOverrides: boolean;
  hasDocumentOverrides: boolean;
};

const withoutOwnDesign = <Settings extends DocumentDesignSettings>(settings: Settings): Settings => {
  const { cvOverrides: _cv, resumeAppearance: _appearance, ...rest } = settings;
  return rest as Settings;
};

/** Everything the design panel needs to tell template value, shared value, own override and effective value apart. */
export const resolveResumeDesignView = (
  templateId: string,
  settings: DocumentDesignSettings,
  global?: ResumeDesignLayer,
): ResumeDesignView => {
  const globalLayer = compactResumeDesignLayer(global);
  const native = { tokens: resolveTemplateCvDesign(templateId), appearance: resolveResumeAppearance(templateId) };
  const editableGlobal = {
    tokens: resolveEffectiveDesignTokens(templateId, applyGlobalResumeDesign(getTemplateDocumentDesignDefaults(templateId), globalLayer)),
    appearance: resolveResumeAppearance(templateId, globalLayer?.resumeAppearance),
  };
  const inheritedSettings = applyGlobalResumeDesign(withoutOwnDesign(settings), globalLayer);
  const inherited = {
    tokens: resolveEffectiveDesignTokens(templateId, inheritedSettings),
    appearance: resolveResumeAppearance(templateId, globalLayer?.resumeAppearance),
  };
  const effectiveSettings = applyGlobalResumeDesign(settings, globalLayer);
  const effective = {
    tokens: resolveEffectiveDesignTokens(templateId, effectiveSettings),
    appearance: resolveResumeAppearance(templateId, globalLayer?.resumeAppearance, settings.resumeAppearance),
  };
  // The legacy appearance field "space below the title" is the same CSS margin as the spacing token.
  const legacyTitleGap = settings.resumeAppearance?.sectionHeadingMarginAfterMm;
  const defaults = getTemplateDocumentDesignDefaults(templateId);
  const sliders = foldsDocumentSizeSliders(templateId);
  const legacyLevel: Record<string, boolean> = {
    "spacing.pageMarginMm": sliders && settings.marginLevel !== defaults.marginLevel,
    "spacing.innerPaddingMm": sliders && settings.paddingLevel !== defaults.paddingLevel,
    "spacing.sectionGapMm": sliders && settings.sectionSpacingLevel !== defaults.sectionSpacingLevel,
    "typography.lineHeight": sliders && settings.lineHeightLevel !== defaults.lineHeightLevel,
    "typography.fontId": settings.fontId !== defaults.fontId,
    "typography.headingFontId": settings.headingFontId !== defaults.headingFontId,
    "typography.bodySizePt": sliders && settings.fontSize !== defaults.fontSize,
  };
  return {
    templateId, native, editableGlobal, inherited, effective,
    sourceOfToken: (group, key) => {
      const field = String(key);
      if ((settings.cvOverrides?.[group] as Record<string, unknown> | undefined)?.[field] !== undefined) return "document";
      if (group === "spacing" && field === "sectionTitleGapMm" && legacyTitleGap !== undefined) return "document";
      if ((globalLayer?.cvOverrides?.[group] as Record<string, unknown> | undefined)?.[field] !== undefined) return "global";
      if (group === "spacing" && field === "sectionTitleGapMm" && globalLayer?.resumeAppearance?.sectionHeadingMarginAfterMm !== undefined) return "global";
      return legacyLevel[`${group}.${field}`] ? "document" : "template";
    },
    sourceOfAppearance: (key) => {
      const own = settings.resumeAppearance as Record<string, unknown> | undefined;
      const shared = globalLayer?.resumeAppearance as Record<string, unknown> | undefined;
      const pair: string[] = key === "sectionDividerVisible" || key === "sectionDividerPosition" ? [...dividerKeys] : [key];
      if (pair.some((field) => own?.[field] !== undefined)) return "document";
      return pair.some((field) => shared?.[field] !== undefined) ? "global" : "template";
    },
    hasGlobalOverrides: !isEmptyResumeDesignLayer(globalLayer),
    hasDocumentOverrides: !isEmptyResumeDesignLayer({ cvOverrides: settings.cvOverrides, resumeAppearance: settings.resumeAppearance }),
  };
};
