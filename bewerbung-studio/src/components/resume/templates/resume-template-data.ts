import { ensureKnowledgeSection } from "../../../features/knowledge/knowledge.service";
import {
  formatKnowledgeItem,
  visibleKnowledgeItems,
} from "../../../features/knowledge/knowledge.utils";
import type { ResumePagePlan } from "../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../shared/schema";
import {
  getLanguageLevelScore,
  parseLanguageEntry,
} from "../../../features/languages/language-levels";
import { externalUrl } from "../../../shared/contactPresentation";
import { resolveResumeSummary } from "../../../shared/resumeSummary";
import { formatCareerPeriod } from "../../../shared/resumeCareer";
import { toTemplateEducationItem } from "../../../shared/resumeEducation";
import { toTemplateExperienceItem } from "../../../shared/resumeCareer";
import { resolveResumeStrengths, type ResumeStrength } from "../../../shared/resumeStrengths";

export type TemplateCareerItem = {
  id: string;
  from: string;
  to: string;
  title: string;
  organization: string;
  city?: string;
  achievements: string[];
};

export type TemplateLanguage = {
  raw: string;
  name: string;
  level: string;
  score: number;
};

export type TemplateStrength = ResumeStrength;

const selectedIds = (
  plan: ResumePagePlan,
  kind: ResumePagePlan["items"][number]["kind"],
) =>
  new Set(
    plan.items
      .filter((item) => item.kind === kind)
      .map((item) => item.id),
  );

export const createTemplatePageData = (
  profile: ApplicantProfile | undefined,
  plan: ResumePagePlan,
) => {
  const experienceIds = selectedIds(plan, "experience");
  const educationIds = selectedIds(plan, "education");
  return {
    experiences: (profile?.experiences ?? [])
      .filter((entry) => experienceIds.has(entry.id))
      .map((entry): TemplateCareerItem => toTemplateExperienceItem(entry)),
    education: (profile?.education ?? [])
      .filter((entry) => educationIds.has(entry.id))
      .map((entry) => toTemplateEducationItem(entry, profile?.resumeEducationFieldVisibility)),
    isContinuation: plan.pageNumber > 1,
  };
};

/** The one Kurzprofil resolver (`shared/resumeSummary.ts`): a template never decides the source itself. */
export const resolveTemplateSummary = resolveResumeSummary;

/** One date range for every template and the PDF: `MM/JJJJ – MM/JJJJ`, `MM/JJJJ – heute` (`shared/resumeCareer.ts`). */
export const formatTemplateDateRange = formatCareerPeriod;

/** One URL normalisation for every profile link: `externalUrl`. */
export const toTemplateExternalHref = externalUrl;

export const uniqueTemplateValues = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

/** The one Stärken resolver (`shared/resumeStrengths.ts`), the same for the preview and the PDF. */
export const parseTemplateStrengths = resolveResumeStrengths;

export const parseTemplateLanguage = (raw: string): TemplateLanguage => {
  const { raw: normalized, name, level } = parseLanguageEntry(raw);
  return {
    raw: normalized,
    name,
    level,
    score: getLanguageLevelScore(level),
  };
};

export const getTemplateKnowledge = (
  profile: ApplicantProfile | undefined,
) => {
  const knowledge = ensureKnowledgeSection(
    profile?.knowledgeSection,
    profile?.skills ?? [],
  );
  if (!knowledge.isVisible) return [];
  const legacyKnowledge = uniqueTemplateValues(
    knowledge.categories
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
      ]),
  );
  const flexibleKnowledge = (profile?.resumeKnowledgeGroups ?? [])
    .filter((group) => group.visible)
    .sort((left, right) => left.order - right.order)
    .flatMap((group) => group.items
      .filter((item) => item.visible && item.text.trim())
      .sort((left, right) => left.order - right.order)
      .map((item) => item.description
        ? `${item.text} – ${item.description}`
        : item.text));
  return uniqueTemplateValues([...flexibleKnowledge, ...legacyKnowledge]);
};
