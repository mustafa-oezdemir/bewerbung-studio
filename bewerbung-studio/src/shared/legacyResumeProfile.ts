import type { Workspace } from "./schema";
import { resolveApplicationProfile } from "./profileSelection";

/** One-time, lossless migration of old application content into independent profile copies. */
export function migrateLegacyResumeProfiles(workspace: Workspace): Workspace {
  const applications = workspace.applications.map((application) => {
    if (application.profileSnapshot) return application;
    const source = resolveApplicationProfile(workspace.profiles, application.profileId);
    if (!source || (application.profileId && source.id !== application.profileId))
      throw new Error(`Für die Bewerbung ${application.id} fehlt das verknüpfte Profil. Die Daten wurden nicht geändert.`);
    const profileSnapshot = structuredClone(source);
    const oldText = application.documents.resumeProfile;
    if (oldText.trim()) profileSnapshot.summary = oldText;
    return {
      ...application,
      profileSnapshot,
      documents: oldText.trim()
        ? { ...application.documents, legacyResumeProfile: application.documents.legacyResumeProfile || oldText, resumeProfile: "" }
        : application.documents,
    };
  });
  return { ...workspace, applications };
}
