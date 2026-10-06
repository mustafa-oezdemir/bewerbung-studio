import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";
import {
  getLanguageLevelScore,
  parseLanguageEntry,
} from "../../../../features/languages/language-levels";
import type {
  KreativCareerItem,
  KreativLanguage,
} from "./kreativ.types";
import { externalUrl } from "../../../../shared/contactPresentation";
import { resolveResumeSummary } from "../../../../shared/resumeSummary";
import { formatCareerPeriod } from "../../../../shared/resumeCareer";
import { toTemplateEducationItem, resolveEducationPresentation, sliceEducationDetails } from "../../../../shared/resumeEducation";
import { toTemplateExperienceItem } from "../../../../shared/resumeCareer";

export type KreativPageData = {
  education: KreativCareerItem[];
  experiences: KreativCareerItem[];
  isContinuation: boolean;
};

export const createKreativPageData = (
  profile: ApplicantProfile | undefined,
  plan: ResumePagePlan,
): KreativPageData => {
  return {
    experiences: plan.items.flatMap((item) => {
      if (item.kind !== "experience") return [];
      const entry = profile?.experiences.find((entry) => entry.id === item.id);
      if (!entry) return [];
      const view = toTemplateExperienceItem(entry);
      return [{ ...view, bullets: item.bullets,
        achievements: item.bullets ? view.achievements.slice(item.bullets.from, item.bullets.to) : view.achievements }];
    }),
    education: plan.items.flatMap((item) => {
      if (item.kind !== "education") return [];
      const entry = profile?.education.find((entry) => entry.id === item.id);
      if (!entry) return [];
      const view = resolveEducationPresentation(entry, profile?.resumeEducationFieldVisibility);
      return [{ ...toTemplateEducationItem(entry, profile?.resumeEducationFieldVisibility), bullets: item.bullets,
        achievements: sliceEducationDetails(view.details, view.descriptionIndex, item.bullets) }];
    }),
    isContinuation: plan.pageNumber > 1,
  };
};

/** The one Kurzprofil resolver (`shared/resumeSummary.ts`): a template never decides the source itself. */
export const resolveKreativSummary = resolveResumeSummary;

/** One date range for every template and the PDF: `MM/JJJJ – MM/JJJJ`, `MM/JJJJ – heute` (`shared/resumeCareer.ts`). */
export const formatKreativDateRange = formatCareerPeriod;

/** One URL normalisation for every profile link: `externalUrl`. */
export const toKreativExternalHref = externalUrl;

export const uniqueKreativValues = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const parseKreativLanguage = (raw: string): KreativLanguage => {
  const { raw: normalized, name, level } = parseLanguageEntry(raw);
  return {
    raw: normalized,
    name,
    level,
    score: getLanguageLevelScore(level),
  };
};
