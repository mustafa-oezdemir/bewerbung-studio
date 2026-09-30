import type { ApplicantProfile } from "./schema";
import { defaultDocumentDesign, type DocumentDesignSettings } from "./documentDesign";
import { resolveTemplateId } from "./templates";
import { resolveResumePresentation } from "./resumePresentation";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import { resolveResumeLayout } from "./resumeLayoutEngine";
import { resolveEffectiveResumeSpacing } from "./resumeSpacing";
import { getProfileMediaSource } from "./profileMedia";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import { createResumePagePlan, type ResumePlanContext } from "./documentPagination";

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
  const closingSection = managerSections.find((entry) => entry.id === "closing");
  const overrides = settings.cvOverrides;
  const planContext: ResumePlanContext = {
    atsMode,
    layout: {
      mode: layout.mode,
      sidebarWidthPercent: layout.sidebarWidthPercent,
      overridden: layout.overridden,
      // The geometry was measured with the template's default sidebar; a profile column ratio widens it.
      nativeSidebarWidthPercent: resolveResumeLayout(templateId, undefined, false).sidebarWidthPercent,
    },
    sections: managerSections.map(({ id, visible, zone }) => ({ id, visible, zone })),
    closing: profile && {
      visible:
        closingSection?.visible !== false &&
        (profile.resumeClosing.showPlace || profile.resumeClosing.showDate || profile.resumeClosing.showSignature),
      signature: profile.resumeClosing.showSignature && Boolean(getProfileMediaSource(profile.signaturePath)),
    },
    overrides: {
      bodySizePt: overrides?.typography?.bodySizePt,
      lineHeight: overrides?.typography?.lineHeight,
      pageMarginMm: overrides?.spacing?.pageMarginMm,
      sectionGapMm: overrides?.spacing?.sectionGapMm,
      entryGapMm: overrides?.spacing?.entryGapMm,
    },
    settings,
  };
  const pagePlan = createResumePagePlan(
    paginatedProfile, paginationSummary || resumeProfile, {}, templateId, planContext,
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
