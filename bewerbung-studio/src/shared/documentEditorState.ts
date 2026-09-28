import type { ApplicantProfile, Application } from "./schema";
import { getTemplate, resolveTemplateId } from "./templates";
import { compactCvDesignOverrides, getTemplateDocumentDesignDefaults } from "./cvDesign";
import type { CvDesignTokens } from "./cvDesignSchema";
import type { ResumeAppearance } from "./resumeAppearance";

export const createDocumentDesignDraft = (application: Application) => ({
  applicationId: application.id,
  templateId: application.templateId,
  accentColor: application.accentColor,
  secondaryColor: application.secondaryColor,
  settings: application.designSettings,
  templateDesigns: application.templateDesigns,
});

export type DocumentDesignDraft = ReturnType<typeof createDocumentDesignDraft>;

const snapshotTemplateOverrides = (current: DocumentDesignDraft): Application["templateDesigns"][string] => {
  const template = getTemplate(current.templateId);
  const defaults = getTemplateDocumentDesignDefaults(template.id);
  const { cvOverrides, ...settings } = current.settings;
  const compact = compactCvDesignOverrides(template.id, cvOverrides ?? {});
  return {
    ...(current.accentColor.toLowerCase() !== template.accent.toLowerCase() ? { accentColor: current.accentColor } : {}),
    ...(current.secondaryColor.toLowerCase() !== template.secondary.toLowerCase() ? { secondaryColor: current.secondaryColor } : {}),
    settings: {
      ...Object.fromEntries(Object.entries(settings).filter(([key, value]) =>
        value !== undefined && value !== defaults[key as keyof typeof defaults])),
      ...(Object.keys(compact).length ? { cvOverrides: compact } : {}),
    },
  };
};

export const selectDocumentTemplate = (
  current: DocumentDesignDraft,
  templateId: string,
): DocumentDesignDraft => {
  if (current.templateId === templateId) return current;
  const template = getTemplate(templateId);
  if (resolveTemplateId(current.templateId) === template.id) return { ...current, templateId: template.id };
  const savedKey = Object.keys(current.templateDesigns).find((key) => resolveTemplateId(key) === template.id);
  const saved = savedKey ? current.templateDesigns[savedKey] : undefined;
  const templateDesigns = { ...current.templateDesigns };
  const snapshot = snapshotTemplateOverrides(current);
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
): DocumentDesignDraft => {
  const { cvOverrides, ...settings } = current.settings;
  const compact = compactCvDesignOverrides(current.templateId, {
    ...cvOverrides,
    [group]: { ...cvOverrides?.[group], [key]: value },
  });
  return { ...current, settings: { ...settings, ...(Object.keys(compact).length ? { cvOverrides: compact } : {}) } };
};

export const updateResumeAppearanceField = <Key extends keyof ResumeAppearance>(
  current: DocumentDesignDraft, key: Key, value: ResumeAppearance[Key],
): DocumentDesignDraft => {
  const next: ResumeAppearance = { ...current.settings.resumeAppearance, [key]: value };
  if (key === "sectionDividerVisible" && value === true) delete next.sectionDividerVisible;
  if (key === "photoDecorationVisible" && value === true) delete next.photoDecorationVisible;
  // Native values differ by template; these explicit colors/widths must remain
  // saved even when they happen to match a different template's default.
  if (key === "contactDividerColor" && value === "#ffffff") delete next.contactDividerColor;
  const { resumeAppearance: _previous, ...settings } = current.settings;
  return { ...current, settings: { ...settings, ...(Object.keys(next).length ? { resumeAppearance: next } : {}) } };
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
