import type { ApplicantProfile } from "../../shared/schema";

// These settings belong to the section editor. Keep them when the profile-data
// editor and section editor both supply live drafts for the same profile.
export const getResumeEditorSettings = (profile: ApplicantProfile) => ({
  resumeSections: profile.resumeSections,
  resumeSectionLayout: profile.resumeSectionLayout,
  resumeSectionLayouts: profile.resumeSectionLayouts,
  resumeManagerLayouts: profile.resumeManagerLayouts,
  resumeManagerOverrides: profile.resumeManagerOverrides,
  resumeSemanticSections: profile.resumeSemanticSections,
  resumePersonalFieldVisibility: profile.resumePersonalFieldVisibility,
  resumeContinuationContactVisibility: profile.resumeContinuationContactVisibility,
  resumeKnowledgeGroups: profile.resumeKnowledgeGroups,
  resumeKnowledgeContainer: profile.resumeKnowledgeContainer,
  resumeColumnRatio: profile.resumeColumnRatio,
  resumeClosing: profile.resumeClosing,
});

export const mergeResumeSectionDraft = (
  base: ApplicantProfile,
  sectionDraft: ApplicantProfile,
): ApplicantProfile => ({ ...base, ...getResumeEditorSettings(sectionDraft) });

export const mergeResumeDataDraft = (
  dataDraft: ApplicantProfile,
  sectionDraft?: ApplicantProfile,
): ApplicantProfile => sectionDraft
  ? { ...dataDraft, ...getResumeEditorSettings(sectionDraft) }
  : dataDraft;
