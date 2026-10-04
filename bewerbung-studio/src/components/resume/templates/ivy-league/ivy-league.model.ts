import { ensureKnowledgeSection } from "../../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../../features/knowledge/knowledge.utils";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";
import {
  getLanguageLevelScore,
  parseLanguageEntry,
} from "../../../../features/languages/language-levels";
import type {
  IvyLeagueCareerItem,
  IvyLeagueLanguage,
  IvyLeagueStrength,
} from "./ivy-league.types";
import { externalUrl } from "../../../../shared/contactPresentation";
import { resolveResumeSummary } from "../../../../shared/resumeSummary";
import { formatCareerPeriod } from "../../../../shared/resumeCareer";
import { toTemplateEducationItem } from "../../../../shared/resumeEducation";
import { toTemplateExperienceItem } from "../../../../shared/resumeCareer";

const selectedIds = (
  plan: ResumePagePlan,
  kind: ResumePagePlan["items"][number]["kind"],
) =>
  new Set(
    plan.items
      .filter((item) => item.kind === kind)
      .map((item) => item.id),
  );

export const createIvyLeaguePageData = (
  profile: ApplicantProfile | undefined,
  plan: ResumePagePlan,
) => {
  const experienceIds = selectedIds(plan, "experience");
  const educationIds = selectedIds(plan, "education");

  return {
    experiences: (profile?.experiences ?? [])
      .filter((entry) => experienceIds.has(entry.id))
      .map((entry): IvyLeagueCareerItem => toTemplateExperienceItem(entry)),
    education: (profile?.education ?? [])
      .filter((entry) => educationIds.has(entry.id))
      .map((entry) => toTemplateEducationItem(entry, profile?.resumeEducationFieldVisibility)),
    isContinuation: plan.pageNumber > 1,
  };
};

/** The one Kurzprofil resolver (`shared/resumeSummary.ts`): a template never decides the source itself. */
export const resolveIvyLeagueSummary = resolveResumeSummary;

/** One date range for every template and the PDF: `MM/JJJJ – MM/JJJJ`, `MM/JJJJ – heute` (`shared/resumeCareer.ts`). */
export const formatIvyLeagueDateRange = formatCareerPeriod;

/** One URL normalisation for every profile link: `externalUrl`. */
export const toIvyLeagueExternalHref = externalUrl;

export const uniqueIvyLeagueValues = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const parseIvyLeagueStrengths = (
  profile: ApplicantProfile | undefined,
): IvyLeagueStrength[] => {
  const explicitStrengths = (profile?.strengths ?? [])
    .map(({ title, description }) => ({
      title: title.trim(),
      description: description.trim(),
    }))
    .filter(({ title }) => title);
  if (explicitStrengths.length) return explicitStrengths.slice(0, 6);
  return uniqueIvyLeagueValues(profile?.skills ?? [])
    .slice(0, 6)
    .map((value) => {
      const [title, ...description] = value.split(/\s+(?:–|—|:)\s+/);
      return {
        title: title.trim(),
        description: description.join(" – ").trim(),
      };
    });
};

export const parseIvyLeagueLanguage = (
  raw: string,
): IvyLeagueLanguage => {
  const { raw: normalized, name, level } = parseLanguageEntry(raw);
  return {
    raw: normalized,
    name,
    level,
    score: getLanguageLevelScore(level),
  };
};

export const getIvyLeagueKnowledge = (
  profile: ApplicantProfile | undefined,
) => {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    profile?.skills ?? [],
  );
  if (!knowledge.isVisible) return [];
  return knowledge.categories
    .filter((category) => category.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((category) => [
      ...visibleKnowledgeItems(category.items).map((item) =>
        formatKnowledgeItem(
          item,
          category.showLevels,
          category.showYearsOfExperience,
          "comma-separated",
        ),
      ),
      ...category.subcategories
        .filter((subcategory) => subcategory.isVisible)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .flatMap((subcategory) =>
          visibleKnowledgeItems(subcategory.items).map((item) =>
            formatKnowledgeItem(
              item,
              category.showLevels,
              category.showYearsOfExperience,
              "comma-separated",
            ),
          ),
        ),
    ])
    .filter(Boolean);
};
