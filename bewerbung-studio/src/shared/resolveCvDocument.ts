import type { ApplicantProfile } from "./schema";
import { defaultDocumentDesign, type DocumentDesignSettings } from "./documentDesign";
import { resolveTemplateId } from "./templates";
import { resolveResumePresentation } from "./resumePresentation";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import { resolveResumeLayout } from "./resumeLayoutEngine";
import { resolveEffectiveResumeSpacing } from "./resumeSpacing";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import {
  createResumePagePlan,
  einspaltigPaginationOptions,
  elegantPaginationOptions,
  gepflegtPaginationOptions,
  ivyLeaguePaginationOptions,
  klassischPaginationOptions,
  kompaktPaginationOptions,
  kreativPaginationOptions,
  modernPaginationOptions,
  pehlionePaginationOptions,
  stilvollPaginationOptions,
  tabellarischPaginationOptions,
  zeitgenoessischPaginationOptions,
  zweispaltigPaginationOptions,
  type ResumePaginationOptions,
} from "./documentPagination";

const paginationOptions: Record<string, ResumePaginationOptions> = {
  elegant: elegantPaginationOptions,
  zweispaltig: zweispaltigPaginationOptions,
  kompakt: kompaktPaginationOptions,
  kreativ: kreativPaginationOptions,
  gepflegt: gepflegtPaginationOptions,
  zeitgenoessisch: zeitgenoessischPaginationOptions,
  "ivy-league": ivyLeaguePaginationOptions,
  stilvoll: stilvollPaginationOptions,
  einspaltig: einspaltigPaginationOptions,
  klassisch: klassischPaginationOptions,
  tabellarisch: tabellarischPaginationOptions,
  modern: modernPaginationOptions,
  pehlione_white_blue: pehlionePaginationOptions,
  pehlione_white: pehlionePaginationOptions,
};

type CvDocumentInput = {
  profile: ApplicantProfile | undefined;
  templateId: string;
  settings?: DocumentDesignSettings;
  resumeProfile?: string;
  deckblattStatement?: string;
  jobTitle?: string;
  /** Live section-editor previews have already applied presentation overrides. */
  presentationAlreadyApplied?: boolean;
};

/** The sole CV projection used by both preview and print renderers. */
export const resolveCvDocument = ({
  profile: sourceProfile,
  templateId: requestedTemplateId,
  settings = defaultDocumentDesign,
  resumeProfile = "",
  deckblattStatement = "",
  jobTitle = "",
  presentationAlreadyApplied = false,
}: CvDocumentInput) => {
  const templateId = resolveTemplateId(requestedTemplateId);
  const projected = presentationAlreadyApplied
    ? sourceProfile
    : resolveResumePresentation(sourceProfile, templateId, settings.resumePresentation);
  const profile = getResumeDisplayProfile(projected);
  const sections = {
    ...(profile?.resumeSections ?? {
      profile: true,
      strengths: true,
      experience: true,
      education: true,
      skills: true,
      languages: true,
      certifications: true,
    }),
  };
  const managerSections = profile ? getManagerSections(profile, templateId) : [];
  const knowledgeGroups = profile
    ? resolveKnowledgeGroups(templateId, profile.resumeKnowledgeGroups)
    : [];
  const atsMode = settings.resumeOutputMode === "ats" || settings.columnLayout === "compact-ats";
  const layout = resolveResumeLayout(
    templateId, settings.resumePresentation, atsMode, sourceProfile?.resumeColumnRatio,
  );
  const design = resolveEffectiveResumeSpacing(templateId, settings);
  const paginationSummary = templateId.startsWith("pehlione_")
    ? resumeProfile || (/kundenservice|sachbearbeit/i.test(jobTitle) ? deckblattStatement : "") || profile?.summary || ""
    : resumeProfile;
  const paginatedProfile = profile && {
    ...profile,
    experiences: sections.experience ? profile.experiences : [],
    education: sections.education ? profile.education : [],
  };
  const pagePlan = createResumePagePlan(
    paginatedProfile, paginationSummary, paginationOptions[templateId], templateId,
  );
  return {
    templateId,
    settings,
    profile,
    sections,
    managerSections,
    knowledgeGroups,
    atsMode,
    layout,
    design,
    paginationSummary,
    pagePlan,
  };
};

export type ResolvedCvDocument = ReturnType<typeof resolveCvDocument>;
