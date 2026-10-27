import type { ApplicantProfile, Application } from "./schema";

/**
 * A saved Bewerbung owns its profile. The legacy id lookup is used only while an old workspace is upgraded.
 */
export const resolveApplicationProfile = (
  profiles: ApplicantProfile[],
  application: Pick<Application, "profileId" | "profileSnapshot"> | string | undefined,
) =>
  (typeof application === "object" ? application.profileSnapshot : undefined) ??
  profiles.find((profile) => profile.id === (typeof application === "object" ? application.profileId : application)) ??
  profiles.find((profile) => profile.isDefault) ??
  profiles[0];

/**
 * The profile shown in the profile editor: the one picked there, else the profile of the selected application.
 * Document views do not use this: they always use `resolveApplicationProfile`.
 */
export const resolveSelectedProfile = (
  profiles: ApplicantProfile[],
  selectedProfileId?: string,
  applicationProfileId?: string,
) =>
  profiles.find((profile) => profile.id === selectedProfileId) ??
  resolveApplicationProfile(profiles, applicationProfileId);

/**
 * The professional title of the applicant, e.g. under the name. It is the `title` of the selected profile and
 * nothing else: the job title of the application is the position applied for, a different thing, and no
 * document falls back to a title of its own.
 */
export const getProfessionalTitle = (profile: Pick<ApplicantProfile, "title"> | undefined) =>
  profile?.title?.trim() ?? "";
