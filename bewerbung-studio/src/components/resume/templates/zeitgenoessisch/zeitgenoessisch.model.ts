import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";
import {
  getLanguageLevelScore,
  parseLanguageEntry,
} from "../../../../features/languages/language-levels";
import type {
  ZeitgenoessischCareerItem,
  ZeitgenoessischLanguage,
} from "./zeitgenoessisch.types";
import { externalUrl } from "../../../../shared/contactPresentation";
import { resolveResumeSummary } from "../../../../shared/resumeSummary";
import { formatCareerPeriod } from "../../../../shared/resumeCareer";
import { toTemplateEducationItem } from "../../../../shared/resumeEducation";
import { toTemplateExperienceItem } from "../../../../shared/resumeCareer";

export type ZeitgenoessischPageData = {
  education: ZeitgenoessischCareerItem[];
  experiences: ZeitgenoessischCareerItem[];
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

export const createZeitgenoessischPageData = (
  profile: ApplicantProfile | undefined,
  plan: ResumePagePlan,
): ZeitgenoessischPageData => {
  const experienceIds = selectedIds(plan, "experience");
  const educationIds = selectedIds(plan, "education");

  return {
    experiences: (profile?.experiences ?? [])
      .filter((entry) => experienceIds.has(entry.id))
      .map(toTemplateExperienceItem),
    education: (profile?.education ?? [])
      .filter((entry) => educationIds.has(entry.id))
      .map((entry) => toTemplateEducationItem(entry, profile?.resumeEducationFieldVisibility)),
    isContinuation: plan.pageNumber > 1,
  };
};

/** The one Kurzprofil resolver (`shared/resumeSummary.ts`): a template never decides the source itself. */
export const resolveZeitgenoessischSummary = resolveResumeSummary;

/** One date range for every template and the PDF: `MM/JJJJ – MM/JJJJ`, `MM/JJJJ – heute` (`shared/resumeCareer.ts`). */
export const formatZeitgenoessischDateRange = formatCareerPeriod;

/** One URL normalisation for every profile link: `externalUrl`. */
export const toZeitgenoessischExternalHref = externalUrl;

export const uniqueZeitgenoessischValues = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const parseZeitgenoessischLanguage = (
  raw: string,
): ZeitgenoessischLanguage => {
  const { raw: normalized, name, level } = parseLanguageEntry(raw);
  return {
    raw: normalized,
    name,
    level,
    score: getLanguageLevelScore(level),
  };
};
