import type { Workspace } from "./schema";
import { resolveApplicationProfile } from "./profileSelection";

/** One-time, lossless migration from application Kurzprofil copies to the linked ApplicantProfile. */
export function migrateLegacyResumeProfiles(workspace: Workspace): Workspace {
  const profiles = workspace.profiles.map((profile) => ({ ...profile }));
  const applications = workspace.applications.map((application) => ({
    ...application, documents: { ...application.documents },
  }));
  const promoted = new Map<string, string>();
  for (const application of [...applications].sort((left, right) => left.id.localeCompare(right.id))) {
    const oldText = application.documents.resumeProfile.trim();
    if (!oldText) continue;
    const linked = resolveApplicationProfile(profiles, application.profileId);
    if (linked && !linked.summary.trim() && !promoted.has(linked.id)) promoted.set(linked.id, oldText);
    application.documents.legacyResumeProfile ||= application.documents.resumeProfile;
    application.documents.resumeProfile = "";
  }
  for (const profile of profiles) {
    const oldText = promoted.get(profile.id);
    if (oldText && !profile.summary.trim()) {
      profile.summary = oldText;
      profile.updatedAt = new Date().toISOString();
    }
  }
  return { ...workspace, profiles, applications };
}
