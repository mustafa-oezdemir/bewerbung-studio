import type { ApplicantProfile, Application } from "./schema";
import { getTemplate } from "./templates";

export const createDocumentDesignDraft = (application: Application) => ({
  applicationId: application.id,
  templateId: application.templateId,
  accentColor: application.accentColor,
  secondaryColor: application.secondaryColor,
  settings: application.designSettings,
  templateDesigns: application.templateDesigns,
});

export type DocumentDesignDraft = ReturnType<typeof createDocumentDesignDraft>;

export const selectDocumentTemplate = (
  current: DocumentDesignDraft,
  templateId: string,
): DocumentDesignDraft => {
  if (current.templateId === templateId) return current;
  const template = getTemplate(templateId);
  const saved = current.templateDesigns[templateId];
  const templateDesigns = {
    ...current.templateDesigns,
    [current.templateId]: {
      accentColor: current.accentColor,
      secondaryColor: current.secondaryColor,
      settings: current.settings,
    },
  };
  delete templateDesigns[templateId];
  return {
    ...current,
    templateId,
    templateDesigns,
    ...(saved ?? {
      accentColor: template.accent,
      secondaryColor: template.secondary,
      settings: { ...current.settings, strengthsColumns: "auto", knowledgeColumns: "auto", ...template.designDefaults },
    }),
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
