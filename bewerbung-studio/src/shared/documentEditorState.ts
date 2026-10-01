import type { ApplicantProfile, Application } from "./schema";
import { getTemplate, resolveTemplateId } from "./templates";
import { compactCvDesignOverrides, getTemplateDocumentDesignDefaults } from "./cvDesign";
import type { CvDesignTokens, ResumeDesignLayer } from "./cvDesignSchema";
import type { ResumeAppearance } from "./resumeAppearance";
import {
  compactResumeAppearance, compactResumeDesignLayer, mergeCvDesignOverrides, mergeResumeAppearance,
  resolveResumeAppearance, resolveResumeDesignView,
} from "./resumeDesignSystem";

export const createDocumentDesignDraft = (application: Application) => ({
  applicationId: application.id,
  templateId: application.templateId,
  accentColor: application.accentColor,
  secondaryColor: application.secondaryColor,
  settings: application.designSettings,
  templateDesigns: application.templateDesigns,
});

export type DocumentDesignDraft = ReturnType<typeof createDocumentDesignDraft>;

const snapshotTemplateOverrides = (current: DocumentDesignDraft, global?: ResumeDesignLayer): Application["templateDesigns"][string] => {
  const template = getTemplate(current.templateId);
  const defaults = getTemplateDocumentDesignDefaults(template.id);
  const { cvOverrides, resumeAppearance, ...settings } = current.settings;
  // What the document inherits is the template's own design with the shared layer on top; only differences are kept.
  const inherited = resolveResumeDesignView(template.id, current.settings, global).inherited;
  const compact = compactCvDesignOverrides(template.id, cvOverrides ?? {}, inherited.tokens);
  const appearance = compactResumeAppearance(resumeAppearance ?? {}, inherited.appearance);
  return {
    ...(current.accentColor.toLowerCase() !== template.accent.toLowerCase() ? { accentColor: current.accentColor } : {}),
    ...(current.secondaryColor.toLowerCase() !== template.secondary.toLowerCase() ? { secondaryColor: current.secondaryColor } : {}),
    settings: {
      ...Object.fromEntries(Object.entries(settings).filter(([key, value]) =>
        value !== undefined && value !== defaults[key as keyof typeof defaults])),
      ...(Object.keys(compact).length ? { cvOverrides: compact } : {}),
      ...(Object.keys(appearance).length ? { resumeAppearance: appearance } : {}),
    },
  };
};

/**
 * Switching templates keeps the document's overrides of the template it leaves (sparse, per template) and starts the
 * new one from its own design. The shared Lebenslauf layer lives outside the document, so it simply keeps applying.
 */
export const selectDocumentTemplate = (
  current: DocumentDesignDraft,
  templateId: string,
  global?: ResumeDesignLayer,
): DocumentDesignDraft => {
  if (current.templateId === templateId) return current;
  const template = getTemplate(templateId);
  if (resolveTemplateId(current.templateId) === template.id) return { ...current, templateId: template.id };
  const savedKey = Object.keys(current.templateDesigns).find((key) => resolveTemplateId(key) === template.id);
  const saved = savedKey ? current.templateDesigns[savedKey] : undefined;
  const templateDesigns = { ...current.templateDesigns };
  const snapshot = snapshotTemplateOverrides(current, global);
  const previousId = resolveTemplateId(current.templateId);
  delete templateDesigns[current.templateId];
  delete templateDesigns[previousId];
  if (snapshot.accentColor || snapshot.secondaryColor || Object.keys(snapshot.settings).length) {
    templateDesigns[previousId] = snapshot;
  }
  if (savedKey) delete templateDesigns[savedKey];
  delete templateDesigns[template.id];
  return {
    ...current,
    templateId: template.id,
    templateDesigns,
    accentColor: saved?.accentColor ?? template.accent,
    secondaryColor: saved?.secondaryColor ?? template.secondary,
    settings: {
      ...getTemplateDocumentDesignDefaults(template.id),
      ...Object.fromEntries(Object.entries(saved?.settings ?? {}).filter(([, value]) => value !== undefined)),
    },
  };
};

export const resetDocumentDesign = (current: DocumentDesignDraft): DocumentDesignDraft => {
  const template = getTemplate(current.templateId);
  const templateDesigns = { ...current.templateDesigns };
  delete templateDesigns[current.templateId];
  delete templateDesigns[template.id];
  return {
    ...current, templateDesigns,
    accentColor: template.accent,
    secondaryColor: template.secondary,
    settings: getTemplateDocumentDesignDefaults(template.id),
  };
};

/** A field-level reset uses undefined; it never writes a copy of native defaults. */
export const updateCvDesignField = <Group extends keyof CvDesignTokens, Key extends keyof CvDesignTokens[Group]>(
  current: DocumentDesignDraft, group: Group, key: Key, value: CvDesignTokens[Group][Key] | undefined,
  global?: ResumeDesignLayer,
): DocumentDesignDraft => {
  const { cvOverrides, resumeAppearance, ...settings } = current.settings;
  const inherited = resolveResumeDesignView(current.templateId, current.settings, global).inherited.tokens;
  const compact = compactCvDesignOverrides(current.templateId, {
    ...cvOverrides,
    [group]: { ...cvOverrides?.[group], [key]: value },
  }, inherited);
  // The old appearance field "Abstand danach" is the same CSS margin as the title gap: an explicit edit replaces it.
  const titleGap = group === "spacing" && key === "sectionTitleGapMm";
  const { sectionHeadingMarginAfterMm: _legacy, ...appearanceRest } = resumeAppearance ?? {};
  const appearance = titleGap ? appearanceRest : resumeAppearance;
  return { ...current, settings: {
    ...settings,
    ...(Object.keys(compact).length ? { cvOverrides: compact } : {}),
    ...(appearance && Object.keys(appearance).length ? { resumeAppearance: appearance } : {}),
  } };
};

export const updateResumeAppearanceField = <Key extends keyof ResumeAppearance>(
  current: DocumentDesignDraft, key: Key, value: ResumeAppearance[Key], global?: ResumeDesignLayer,
): DocumentDesignDraft => {
  const { resumeAppearance: previous, ...settings } = current.settings;
  // The divider decision is one pair: setting either half replaces the other.
  const dividerKey = key === "sectionDividerVisible" || key === "sectionDividerPosition";
  const base: ResumeAppearance = dividerKey
    ? mergeResumeAppearance({ ...previous, sectionDividerVisible: undefined, sectionDividerPosition: undefined })
    : { ...previous };
  const next = compactResumeAppearance({ ...base, [key]: value }, resolveResumeAppearance(current.templateId, global?.resumeAppearance));
  return { ...current, settings: { ...settings, ...(Object.keys(next).length ? { resumeAppearance: next } : {}) } };
};

/** Where a design edit is stored: the shared Lebenslauf layer (every template, every Bewerbung) or this document only. */
export type DesignScope = "global" | "document";

/** The document's design draft together with the shared layer it is edited against. */
export type DesignEditState = { draft: DocumentDesignDraft; global: ResumeDesignLayer | undefined };

/**
 * One design edit. In the shared scope the value joins the workspace layer and the document drops its own value of
 * the same field, so the edit is what this document shows; other documents keep what they overrode themselves.
 */
export const editCvDesignField = <Group extends keyof CvDesignTokens, Key extends keyof CvDesignTokens[Group]>(
  state: DesignEditState, scope: DesignScope, group: Group, key: Key, value: CvDesignTokens[Group][Key] | undefined,
): DesignEditState => {
  if (scope === "document") return { ...state, draft: updateCvDesignField(state.draft, group, key, value, state.global) };
  // An undefined value removes the field from the layer; it is never merged away.
  const { [key]: _replaced, ...rest } = (state.global?.cvOverrides?.[group] ?? {}) as Record<keyof CvDesignTokens[Group], unknown>;
  const global = compactResumeDesignLayer({
    ...state.global,
    cvOverrides: mergeCvDesignOverrides({ ...state.global?.cvOverrides, [group]: undefined }, { [group]: { ...rest, ...(value === undefined ? {} : { [key]: value }) } }),
  });
  return { global, draft: updateCvDesignField(state.draft, group, key, undefined, global) };
};

export const editResumeAppearanceField = <Key extends keyof ResumeAppearance>(
  state: DesignEditState, scope: DesignScope, key: Key, value: ResumeAppearance[Key],
): DesignEditState => {
  if (scope === "document") return { ...state, draft: updateResumeAppearanceField(state.draft, key, value, state.global) };
  const dividerKey = key === "sectionDividerVisible" || key === "sectionDividerPosition";
  const shared: Record<string, unknown> = { ...state.global?.resumeAppearance };
  if (dividerKey) { delete shared.sectionDividerVisible; delete shared.sectionDividerPosition; }
  if (value === undefined) delete shared[key]; else shared[key] = value;
  const global = compactResumeDesignLayer({ ...state.global, resumeAppearance: shared as ResumeAppearance });
  return { global, draft: updateResumeAppearanceField(state.draft, key, undefined as ResumeAppearance[Key], global) };
};

/**
 * "Vorlagenwerte wiederherstellen": in the shared scope the workspace layer goes, and with it every template's detour
 * from its own design, together with this document's design overrides; in the document scope only the document's go.
 */
export const resetResumeDesign = (state: DesignEditState, scope: DesignScope): DesignEditState => {
  const { cvOverrides: _cv, resumeAppearance: _appearance, ...settings } = state.draft.settings;
  return {
    global: scope === "global" ? undefined : state.global,
    draft: { ...state.draft, settings },
  };
};

/** Save profile content before publishing the application snapshot or exporting. */
export const persistDocumentDraft = async (
  application: Application,
  profile: ApplicantProfile | undefined,
  saveProfile: (profile: ApplicantProfile) => Promise<void>,
  saveApplication: (application: Application) => Promise<void>,
) => {
  if (profile && profile.id === application.profileId)
    await saveProfile(profile);
  await saveApplication(application);
};
