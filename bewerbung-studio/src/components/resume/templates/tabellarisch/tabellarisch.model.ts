import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";
import type { TabellarischTimelineItem } from "./tabellarisch.types";
import { externalUrl } from "../../../../shared/contactPresentation";
import { resolveResumeSummary } from "../../../../shared/resumeSummary";
import { formatCareerPeriod } from "../../../../shared/resumeCareer";
import { toTemplateEducationItem } from "../../../../shared/resumeEducation";
import { toTemplateExperienceItem } from "../../../../shared/resumeCareer";

export type TabellarischPageData = {
  education: TabellarischTimelineItem[];
  experiences: TabellarischTimelineItem[];
  isContinuation: boolean;
};

const selectedIds = (
  plan: ResumePagePlan,
  kind: ResumePagePlan["items"][number]["kind"],
) =>
  new Set(
    plan.items
      .filter((item) => item.kind === kind)
      .map((item) => item.id),
  );

export const createTabellarischPageData = (
  profile: ApplicantProfile | undefined,
  plan: ResumePagePlan,
): TabellarischPageData => {
  const experienceIds = selectedIds(plan, "experience");
  const educationIds = selectedIds(plan, "education");

  return {
    experiences: (profile?.experiences ?? [])
      .filter((experience) => experienceIds.has(experience.id))
      .map((experience) => {
        const item = toTemplateExperienceItem(experience);
        return { ...item, role: item.title };
      }),
    education: (profile?.education ?? [])
      .filter((education) => educationIds.has(education.id))
      .map((education) => {
        const item = toTemplateEducationItem(education, profile?.resumeEducationFieldVisibility);
        return { ...item, role: item.title };
      }),
    isContinuation: plan.pageNumber > 1,
  };
};

/** The one Kurzprofil resolver (`shared/resumeSummary.ts`): a template never decides the source itself. */
export const resolveTabellarischSummary = resolveResumeSummary;

/** One date range for every template and the PDF: `MM/JJJJ – MM/JJJJ`, `MM/JJJJ – heute` (`shared/resumeCareer.ts`). */
export const formatTabellarischDateRange = formatCareerPeriod;

/** One URL normalisation for every profile link: `externalUrl`. */
export const toExternalHref = externalUrl;
