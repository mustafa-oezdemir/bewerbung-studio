import type { ApplicantProfile } from "./schema";

/**
 * The profile a Bewerbung is written with. `application.profileId` is the one persistent link; a missing or
 * deleted link falls back to the default profile. The app, the preview and every export (Anschreiben, Deckblatt,
 * Lebenslauf, Mappe, Word, e-mail) resolve the profile with this function, so they can never disagree.
 */
export const resolveApplicationProfile = (
  profiles: ApplicantProfile[],
  applicationProfileId?: string,
) =>
  profiles.find((profile) => profile.id === applicationProfileId) ??
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
