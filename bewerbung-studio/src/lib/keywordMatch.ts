import type { ApplicantProfile, Application } from "../shared/schema";

const stopWords = new Set([
  "aber",
  "alle",
  "als",
  "auch",
  "auf",
  "aus",
  "bei",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "ein",
  "eine",
  "einer",
  "eines",
  "für",
  "ihre",
  "ihren",
  "ihres",
  "ist",
  "mit",
  "oder",
  "sich",
  "sie",
  "sind",
  "und",
  "von",
  "wir",
  "werden",
  "zu",
  "zum",
  "zur",
  "über",
  "sowie",
  "gute",
  "guten",
  "mehr",
  "jahre",
  "kenntnisse",
  "erfahrung",
  "aufgaben",
  "profil",
  "team",
  "arbeit",
]);

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const includesPhrase = (haystack: string, phrase: string) =>
  normalize(haystack).includes(normalize(phrase));

export type KeywordMatchResult = {
  score: number;
  matchedSkills: string[];
  unmatchedSkills: string[];
  suggestions: string[];
};

export const analyzeKeywordMatch = (
  application: Application,
  profile?: ApplicantProfile,
): KeywordMatchResult => {
  const advertisement = `${application.job.title} ${application.job.fullText}`;
  const skills = profile?.skills.filter(Boolean) ?? [];
  const matchedSkills = skills.filter((skill) =>
    includesPhrase(advertisement, skill),
  );
  const unmatchedSkills = skills.filter(
    (skill) => !includesPhrase(advertisement, skill),
  );
  const tokens = normalize(advertisement).match(/[a-z0-9+#.-]{3,}/g) ?? [];
  const frequency = new Map<string, number>();
  tokens.forEach((token) => {
    if (stopWords.has(token) || /^\d+$/.test(token)) return;
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  });
  const suggestions = [...frequency.entries()]
    .filter(
      ([token]) =>
        !skills.some((skill) => normalize(skill).includes(token)) &&
        !matchedSkills.some((skill) => normalize(skill).includes(token)),
    )
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([token]) => token);
  const score = skills.length
    ? Math.round((matchedSkills.length / skills.length) * 100)
    : 0;
  return { score, matchedSkills, unmatchedSkills, suggestions };
};
