import type { ApplicantProfile } from "./schema";
import { applyResumeCareerFieldVisibility } from "./resumeCareer";
import {
  defaultResumePersonalFieldVisibility,
  getResumeSemanticSection,
} from "../features/resume-sections/resume-section-system";

export const getResumeDisplayProfile = (
  profile: ApplicantProfile | undefined,
): ApplicantProfile | undefined => {
  if (!profile) return undefined;
  const visible = {
    ...defaultResumePersonalFieldVisibility,
    ...profile.resumePersonalFieldVisibility,
  };
  return {
    ...profile,
    street: visible.address ? profile.street : "",
    postalCode: visible.address ? profile.postalCode : "",
    city: visible.address ? profile.city : "",
    country: visible.address ? profile.country : "",
    phone: visible.phone ? profile.phone : "",
    email: visible.email ? profile.email : "",
    linkedin: visible.linkedin ? profile.linkedin : "",
    github: visible.github ? profile.github : "",
    portfolio: visible.website ? profile.portfolio : "",
    birthDate: visible.birthDate ? profile.birthDate : "",
    birthPlace: visible.birthPlace ? profile.birthPlace : "",
    nationality: visible.nationality ? profile.nationality : "",
    experiences: applyResumeCareerFieldVisibility(profile.experiences, profile.resumeCareerFieldVisibility),
    familyStatus: visible.familyStatus ? profile.familyStatus : "",
    children: visible.children ? profile.children : "",
    photoPath: getResumeSemanticSection(profile.resumeSemanticSections, "photo")
      .visible
      ? profile.photoPath
      : "",
    onlineProfiles: profile.onlineProfiles.filter((entry) =>
      /xing/i.test(entry.label) ? visible.xing : visible.onlineProfiles,
    ),
  };
};
