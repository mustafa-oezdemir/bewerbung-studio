import type { ApplicantProfile, Application } from "../shared/schema";
import { flattenKnowledgeNames } from "../features/knowledge/knowledge.utils";
import { getLanguageLevelScore, parseLanguageEntry } from "../features/languages/language-levels";

export const normalizeKeywordText = (value: string) =>
  value.toLocaleLowerCase("de-DE").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss")
    .replace(/[._–—-]/g, " ").replace(/\s+/gu, " ").trim();

/** Match complete words and phrases, including short names such as Go. */
export const includesKeywordPhrase = (haystack: string, phrase: string) => {
  const text = normalizeKeywordText(haystack);
  const needle = normalizeKeywordText(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(text);
};

type RequirementKind = "knowledge" | "language" | "education" | "strength";
export type MatchedRequirement = { label: string; kind: RequirementKind; evidence?: string };
export type KeywordMatchResult = {
  score: number | null;
  met: MatchedRequirement[];
  missing: MatchedRequirement[];
  furtherReview: string[];
  matchedSkills: string[];
};

type CatalogEntry = { label: string; aliases: string[]; kind: "knowledge" | "strength" };
const catalog: CatalogEntry[] = [
  { label: "TypeScript", aliases: ["typescript"], kind: "knowledge" },
  { label: "JavaScript", aliases: ["javascript"], kind: "knowledge" },
  { label: "Vue.js", aliases: ["vue.js", "vuejs"], kind: "knowledge" },
  { label: "React", aliases: ["react"], kind: "knowledge" },
  { label: "Angular", aliases: ["angular"], kind: "knowledge" },
  { label: "Go", aliases: ["golang", "go"], kind: "knowledge" },
  { label: "SQL", aliases: ["sql"], kind: "knowledge" },
  { label: "Python", aliases: ["python"], kind: "knowledge" },
  { label: "Java", aliases: ["java"], kind: "knowledge" },
  { label: "C#", aliases: ["c#"], kind: "knowledge" },
  { label: "C++", aliases: ["c++"], kind: "knowledge" },
  { label: "Bootstrap", aliases: ["bootstrap"], kind: "knowledge" },
  { label: "Scrum", aliases: ["scrum"], kind: "knowledge" },
  { label: "Docker", aliases: ["docker"], kind: "knowledge" },
  { label: "Kubernetes", aliases: ["kubernetes"], kind: "knowledge" },
  { label: "Git", aliases: ["git"], kind: "knowledge" },
  { label: "Datenbanken", aliases: ["datenbanken", "datenbankkenntnisse", "database"], kind: "knowledge" },
  { label: "Objektorientierte Programmierung", aliases: ["objektorientierte programmierung", "objektorientierten programmierung", "oop"], kind: "knowledge" },
  { label: "Analytische Fähigkeiten", aliases: ["analytische fähigkeiten", "analytisches denken"], kind: "strength" },
  { label: "Verantwortungsbewusstsein", aliases: ["verantwortungsbewusstsein"], kind: "strength" },
];

const evidenceFor = (values: string[], aliases: string[]) =>
  values.find((value) => aliases.some((alias) => includesKeywordPhrase(value, alias)));

const knowledgeGroupTypes = new Set([
  "core-competencies", "technical-focus", "professional-knowledge", "it-knowledge",
  "software-knowledge", "tools", "technologies", "methods", "hard-skills",
  "industry-knowledge", "other-knowledge",
]);
const recordedKnowledge = (profile?: ApplicantProfile) => profile ? [
  ...profile.skills,
  ...(profile.knowledgeSection?.isVisible ? flattenKnowledgeNames(profile.knowledgeSection) : []),
  ...(profile.resumeKnowledgeGroups ?? []).filter((group) => group.visible && knowledgeGroupTypes.has(group.semanticType))
    .flatMap((group) => group.items.filter((item) => item.visible).map((item) => item.text)),
].map((entry) => entry.trim()).filter(Boolean) : [];

const recordedStrengths = (profile?: ApplicantProfile) => profile ? [
  ...profile.strengths.map((item) => item.title),
  ...profile.skills,
  ...profile.resumeKnowledgeGroups.filter((group) => group.visible && ["strengths", "soft-skills"].includes(group.semanticType))
    .flatMap((group) => group.items.filter((item) => item.visible).map((item) => item.text)),
].filter(Boolean) : [];

const completedEducation = (entry: ApplicantProfile["education"][number]) => {
  if (/laufend|geplant|abgebrochen|ongoing|in progress/i.test(entry.status)) return false;
  if (/abgeschlossen|bestanden|completed|graduated/i.test(entry.status)) return true;
  const year = /(?:19|20)\d{2}/.exec(entry.to)?.[0];
  return Boolean(year && Number(year) <= new Date().getFullYear());
};

const languageNames = ["Deutsch", "Englisch", "Französisch", "Spanisch", "Italienisch", "Türkisch"];
const minimumLanguageScore = (line: string) => {
  const explicit = /\b(A1|A2|B1|B2|C1|C2)\b/i.exec(line)?.[1];
  if (explicit) return getLanguageLevelScore(explicit);
  if (/muttersprache|muttersprachlich/i.test(line)) return 6;
  if (/verhandlungssicher|sehr gut|hervorragend/i.test(line)) return 5;
  if (/fließend|fliessend/i.test(line)) return 4;
  if (/\bgut(?:e|en|er|es)?\b/i.test(line)) return 3;
  if (/grundkenntnisse/i.test(line)) return 2;
  return 0;
};

export const analyzeKeywordMatch = (application: Application, profile?: ApplicantProfile): KeywordMatchResult => {
  const text = application.job.requirementsText ?? "";
  const knowledge = recordedKnowledge(profile);
  const strengths = recordedStrengths(profile);
  const found = new Map<string, MatchedRequirement>();
  const add = (key: string, label: string, kind: RequirementKind, evidence?: string) => {
    if (!found.has(key)) found.set(key, { label, kind, evidence });
  };

  for (const entry of catalog) {
    if (!entry.aliases.some((alias) => includesKeywordPhrase(text, alias))) continue;
    const version = entry.kind === "knowledge"
      ? entry.aliases.map((alias) => {
          const escaped = normalizeKeywordText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
          return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}\\s+(\\d+)(?![\\p{L}\\p{N}])`, "u").exec(normalizeKeywordText(text))?.[1];
        }).find(Boolean)
      : undefined;
    const aliases = version ? entry.aliases.map((alias) => `${alias} ${version}`) : entry.aliases;
    add(entry.label, `${entry.label}${version ? ` ${version}` : ""}`, entry.kind,
      evidenceFor(entry.kind === "strength" ? strengths : knowledge, aliases));
  }

  // Saved uncommon skills can be checked when the requirement names them verbatim.
  for (const value of knowledge) {
    if (value.length < 3 || !includesKeywordPhrase(text, value)) continue;
    if (catalog.some((entry) => entry.aliases.some((alias) => includesKeywordPhrase(value, alias)))) continue;
    add(`custom:${normalizeKeywordText(value)}`, value, "knowledge", value);
  }

  const lines = text.split(/\r?\n|;/).map((line) => line.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  for (const name of languageNames) {
    const line = lines.find((part) => includesKeywordPhrase(part, name) || includesKeywordPhrase(part, `${name}kenntnisse`));
    if (!line) continue;
    const minimum = minimumLanguageScore(line);
    const evidence = profile?.languages.find((raw) => {
      const stored = parseLanguageEntry(raw);
      const documentedLevel = /\b(?:A1|A2|B1|B2|C1|C2)\b|muttersprache|native|verhandlung|fließ|fliess|fortgeschritten|advanced|erweitert|versiert|gut|mittelstufe|grundkennt|anfänger|anfaenger|einsteiger|beginner/i.test(stored.level);
      return normalizeKeywordText(stored.name) === normalizeKeywordText(name) &&
        (!minimum || documentedLevel && getLanguageLevelScore(stored.level) >= minimum);
    });
    add(`language:${name}`, `${name}${minimum ? ` (mindestens ${["", "A1", "A2", "B1", "B2", "C1", "C2"][minimum]})` : ""}`, "language", evidence);
  }

  if (/\b(?:abgeschlossen(?:es|en|er)?\s+)?(?:studium|hochschulabschluss|universitätsabschluss)\b/i.test(text)) {
    const informatics = /informatik|computer science/i.test(text);
    const evidence = profile?.education.find((entry) => Boolean(entry.degree.trim()) && completedEducation(entry) &&
      (!informatics || /informatik|computer science/i.test(`${entry.fieldOfStudy} ${entry.degree}`)));
    add("education:degree", informatics ? "Abgeschlossenes Studium der Informatik" : "Abgeschlossenes Studium", "education",
      evidence ? [evidence.degree, evidence.fieldOfStudy].filter(Boolean).join(" – ") : undefined);
  }

  const furtherReview = new Set<string>();
  if (includesKeywordPhrase(text, "Reisebereitschaft")) furtherReview.add("Reisebereitschaft");
  for (const line of lines) {
    if (/^(?:dein profil|anforderungen|wir erwarten|ihr profil)\s*:?$/i.test(line)) continue;
    if (![...found.values()].some((item) => includesKeywordPhrase(line, item.label.replace(/ \(mindestens .*\)$/, ""))) &&
        !catalog.some((entry) => entry.aliases.some((alias) => includesKeywordPhrase(line, alias))) &&
        !languageNames.some((name) => includesKeywordPhrase(line, name) || includesKeywordPhrase(line, `${name}kenntnisse`)) &&
        !/studium|hochschulabschluss|universitätsabschluss/i.test(line) && line.length > 3) furtherReview.add(line);
  }
  const requirements = [...found.values()];
  const met = requirements.filter((item) => Boolean(item.evidence));
  return {
    score: requirements.length ? Math.round(met.length / requirements.length * 100) : null,
    met,
    missing: requirements.filter((item) => !item.evidence),
    furtherReview: [...furtherReview],
    matchedSkills: [...new Set(met.filter((item) => item.kind === "knowledge").map((item) => item.evidence!))],
  };
};
