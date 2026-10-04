import type { ApplicantProfile } from "./schema";
import { externalUrl } from "./contactPresentation";
import { normalizeResumeHeading, validateResumeHeading } from "./resumeHeading";
import { normalizeSummaryText } from "./resumeSummary";
import { normalizeExperience } from "./resumeCareer";
import { getBlockingPersonalFields } from "./resumePersonalData";
import { syncLegacySkills } from "../features/knowledge/knowledge.service";
import { validateKnowledgeSection } from "../features/knowledge/knowledge.validation";

/** One save pipeline for Profil and the Lebenslauf editor. A preview never changes updatedAt. */
export function normalizeApplicantProfileForSave(profile: ApplicantProfile): ApplicantProfile {
  return normalizeResumeHeading({
    ...profile,
    summary: normalizeSummaryText(profile.summary),
    experiences: profile.experiences.map(normalizeExperience),
    linkedin: externalUrl(profile.linkedin),
    github: externalUrl(profile.github),
    portfolio: externalUrl(profile.portfolio),
    onlineProfiles: profile.onlineProfiles
      .map((entry) => ({ ...entry, url: externalUrl(entry.url) }))
      .filter((entry) => entry.label.trim() || entry.url),
    resumeSemanticSections: profile.resumeSemanticSections.map((section) => ({
      ...section, customTitle: section.customTitle.trim(),
    })),
    resumeSectionTitles: Object.fromEntries(
      Object.entries(profile.resumeSectionTitles).map(([key, title]) => [key, title.trim()]),
    ) as ApplicantProfile["resumeSectionTitles"],
    strengths: profile.strengths.map((strength) => ({
      ...strength,
      title: strength.title.trim(),
      description: strength.description.trim(),
      iconId: strength.iconId.trim(),
    })).filter((strength) => strength.title),
    languages: profile.languages.map((language) => language.trim()).filter(Boolean),
    certifications: profile.certifications.map((certificate) => certificate.trim()).filter(Boolean),
    specialSections: profile.specialSections.map((section) => ({
      ...section,
      title: section.title.trim(),
      entries: section.entries.map((entry) => ({
        ...entry,
        title: entry.title.trim(),
        description: entry.description.trim(),
        url: externalUrl(entry.url),
        bullets: entry.bullets.map((bullet) => bullet.trim()).filter(Boolean),
      })),
    })),
    skills: syncLegacySkills(profile.knowledgeSection),
    updatedAt: new Date().toISOString(),
  });
}

export function validateApplicantProfile(profile: ApplicantProfile): string[] {
  const issues: string[] = [];
  const personal = getBlockingPersonalFields(profile);
  if (personal.length) issues.push(`personal:${personal[0]}`);
  const heading = validateResumeHeading(profile);
  if (heading) issues.push(heading);
  if (profile.specialSections.some((section) => !section.title.trim()))
    issues.push("Bitte jedem besonderen Bereich eine Überschrift geben.");
  if (profile.strengths.some((strength) => !strength.title.trim()))
    issues.push("Bitte jeder Stärke eine Bezeichnung geben.");
  if (Object.values(profile.resumeSectionTitles).some((title) => !title.trim()))
    issues.push("Bitte jedem Lebenslauf-Abschnitt eine Überschrift geben.");
  const knowledge = validateKnowledgeSection(profile.knowledgeSection);
  if (knowledge.length) issues.push(knowledge[0].message);
  return issues;
}

/** Apply only locally changed fields to the latest stored revision, so stale drafts do not revert unrelated edits. */
export function rebaseApplicantProfileDraft(
  baseline: ApplicantProfile,
  draft: ApplicantProfile,
  latest: ApplicantProfile,
): ApplicantProfile {
  if (baseline.id !== draft.id || draft.id !== latest.id) return draft;
  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const merge = (base: unknown, edit: unknown, saved: unknown): unknown => {
    if (JSON.stringify(base) === JSON.stringify(edit)) return saved;
    if (isObject(base) && isObject(edit) && isObject(saved)) {
      const result = { ...saved };
      for (const key of Object.keys(edit)) result[key] = merge(base[key], edit[key], saved[key]);
      return result;
    }
    return edit;
  };
  return { ...(merge(baseline, draft, latest) as ApplicantProfile), id: latest.id, updatedAt: latest.updatedAt };
}
