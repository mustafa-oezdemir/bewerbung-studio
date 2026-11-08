import type { ApplicantProfile, Application } from "./schema";
import { resolveResumeHeading } from "./resumeHeading";
import { certificateEntries } from "./certificates";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import type { ResumePresentation } from "./resumePresentationSchema";

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

/** Copy the current main profile into one Bewerbung, keeping its independent document design. */
export const applyMainProfileToApplication = (
  application: Application,
  profiles: ApplicantProfile[],
  profileId: string,
): Application => {
  const source = profiles.find((profile) => profile.id === profileId);
  if (!source) throw new Error("Das gewählte Hauptprofil ist nicht mehr vorhanden. Das Bewerbungsprofil bleibt erhalten.");
  const profileSnapshot = structuredClone(source);
  // Selections are application-specific. Keep IDs that still exist, but let a completely new
  // catalogue appear when every selected ID belonged to the previous main profile.
  const retain = (selected: string[] | undefined, available: Set<string>) => {
    if (selected === undefined || selected.length === 0) return selected;
    const valid = selected.filter((id) => available.has(id));
    return valid.length ? valid : undefined;
  };
  const projectIds = new Set(profileSnapshot.specialSections
    .filter((section) => section.kind === "projects")
    .flatMap((section) => section.entries.map((entry) => entry.id)));
  const certificateIds = new Set(certificateEntries(profileSnapshot).map((entry) => entry.id));
  const transferPresentation = (presentation: ResumePresentation | undefined, templateId: string) => {
    if (!presentation) return presentation;
    const specialEntries = Object.fromEntries(Object.entries(presentation.selectedSpecialEntryIds ?? {})
      .flatMap(([sectionId, selected]) => {
        const section = profileSnapshot.specialSections.find((item) => item.id === sectionId);
        if (!section) return [];
        const valid = retain(selected, new Set(section.entries.map((entry) => entry.id)));
        return valid === undefined ? [] : [[sectionId, valid]];
      }));
    const sectionIds = new Set(getManagerSections(profileSnapshot, templateId).map((section) => section.id));
    const sections = Object.fromEntries(Object.entries(presentation.sections ?? {})
      .filter(([id]) => sectionIds.has(id))
      .flatMap(([id, settings]) => settings.zone ? [[id, { zone: settings.zone }]] : []));
    const blockIds = new Set(resolveKnowledgeGroups(templateId, profileSnapshot.resumeKnowledgeGroups).map((block) => block.id));
    const blocks = Object.fromEntries(Object.entries(presentation.blocks ?? {}).filter(([id]) => blockIds.has(id)));
    const { sections: _sections, personalFields: _personalFields, blocks: _blocks,
      showKnowledgeTitle: _showKnowledgeTitle, closing: _closing, ...layout } = presentation;
    const closing = presentation.closing && {
      placement: presentation.closing.placement,
      alignment: presentation.closing.alignment,
    };
    return {
      ...layout,
      selectedProjectEntryIds: retain(presentation.selectedProjectEntryIds, projectIds),
      selectedCertificateIds: retain(presentation.selectedCertificateIds, certificateIds),
      selectedSpecialEntryIds: Object.keys(specialEntries).length ? specialEntries : undefined,
      sections: Object.keys(sections).length ? sections : undefined,
      blocks: Object.keys(blocks).length ? blocks : undefined,
      closing: closing?.placement || closing?.alignment ? closing : undefined,
    };
  };
  return {
    ...application, profileId, profileSnapshot,
    designSettings: { ...application.designSettings,
      resumePresentation: transferPresentation(application.designSettings.resumePresentation, application.templateId) },
    templateDesigns: Object.fromEntries(Object.entries(application.templateDesigns).map(([templateId, design]) => [
      templateId, { ...design, settings: { ...design.settings,
        resumePresentation: transferPresentation(design.settings.resumePresentation, templateId) } },
    ])),
  };
};

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

/** Show the profile's own CV heading in the main-profile link, not its professional title. */
export const getMainProfileLinkLabel = (profile: ApplicantProfile) => {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const ownHeading = resolveResumeHeading(profile).customTitle;
  const detail = ownHeading || getProfessionalTitle(profile) || "Keine eigene Überschrift";
  return [name, detail, profile.profileLabel?.trim()].filter(Boolean).join(" · ");
};
