import type { ApplicantProfile, Application } from "../shared/schema";
import { flattenKnowledgeNames } from "../features/knowledge/knowledge.utils";
import { getLanguageLevelScore, parseLanguageEntry } from "../features/languages/language-levels";
import { isResumeSectionVisible, type ResumeSectionType } from "../features/resume-sections/resume-sections";
import { baseGroupType } from "../features/resume-sections/resume-manager";
import type { ResumeKnowledgeGroup } from "../features/resume-sections/resume-section-system";
import { resolveExperience } from "../shared/resumeCareer";
import { resolveEducationPresentation } from "../shared/resumeEducation";
import { normalizeCustomSection, renderCustomSectionContent } from "../shared/resumeCustomSections";

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
/** Where a requirement was found: a saved list (Kenntnisse, Stärken), the text of the Lebenslauf or the Anschreiben. */
export type EvidenceSource = "Kenntnisse" | "Stärken" | "Lebenslauf" | "Anschreiben";
export type MatchedRequirement = { label: string; kind: RequirementKind; evidence?: string; source?: EvidenceSource };
/**
 * The documents of the Bewerbung besides the profile (resolveCvDocument's `profile`, with the chosen projects and
 * certificates): the effective Kurzprofil, the Anschreiben text as printed, the Lebenslauf's sections with their
 * visibility (`managerSections`) and the template's knowledge groups (`knowledgeGroups`).
 */
export type KeywordMatchDocuments = {
  summary?: string;
  coverLetter?: string;
  sections?: ReadonlyArray<{ id: string; visible: boolean }>;
  knowledgeGroups?: ReadonlyArray<ResumeKnowledgeGroup>;
};
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

/**
 * The profile as the Lebenslauf prints it: a hidden section or knowledge group proves nothing, and only the visible
 * items of a group count. Its Kurzprofil is the effective one. Which details of a station, an education entry or a
 * special section are printed is decided below by the resolvers the templates use.
 */
const printedProfile = (profile: ApplicantProfile | undefined, documents: KeywordMatchDocuments): ApplicantProfile | undefined => {
  if (!profile) return undefined;
  const { sections } = documents;
  const shown = (id: ResumeSectionType) => sections
    ? sections.find((entry) => entry.id === id)?.visible !== false
    : isResumeSectionVisible(profile, id);
  // A group stands in the section of its kind (Kenntnisse, Stärken, Sprachen, Zertifikate) or in a section of its own.
  const groupShown = (group: ResumeKnowledgeGroup) => {
    const base = baseGroupType(group.semanticType) as ResumeSectionType | undefined;
    return base ? shown(base) : sections?.find((entry) => entry.id === `group:${group.id}`)?.visible !== false;
  };
  const knowledge = shown("knowledge");
  return {
    ...profile,
    summary: shown("summary") ? documents.summary ?? profile.summary : "",
    strengths: shown("strengths") ? profile.strengths ?? [] : [],
    skills: knowledge ? profile.skills ?? [] : [],
    knowledgeSection: profile.knowledgeSection && { ...profile.knowledgeSection, isVisible: knowledge && profile.knowledgeSection.isVisible },
    resumeKnowledgeGroups: (documents.knowledgeGroups ?? profile.resumeKnowledgeGroups ?? [])
      .filter((group) => group.visible && groupShown(group))
      .map((group) => ({ ...group, items: group.items.filter((item) => item.visible && item.text.trim()) })),
    experiences: shown("experience") ? profile.experiences ?? [] : [],
    education: shown("education") ? profile.education ?? [] : [],
    languages: shown("languages") ? profile.languages ?? [] : [],
    certifications: shown("certifications") ? profile.certifications ?? [] : [],
    specialSections: (profile.specialSections ?? []).filter((section) => section.isVisible !== false &&
      sections?.find((entry) => entry.id === `special:${section.id}`)?.visible !== false),
  };
};

/** A titled part of the Lebenslauf or the Anschreiben whose texts may name a requirement. */
type TextSource = { label: string; source: "Lebenslauf" | "Anschreiben"; texts: string[] };
const titled = (prefix: string, title: string | undefined) => (title?.trim() ? `${prefix}: ${title.trim()}` : prefix);
const specialPrefix = (section: ApplicantProfile["specialSections"][number]) => section.kind === "projects" ? "Projekt" : section.title;

/** The text of the shared special-section markup, exactly what the preview and the PDF print. */
const printedText = (html: string) => html.replace(/<[^>]+>/g, "\n")
  .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

/**
 * The whole Lebenslauf (not only the knowledge lists) and then the Anschreiben, in reading order. Every section is
 * read as the templates draw it: a station through resolveExperience (employer, place, every printed detail; the
 * heading only for a Kompakt station), an education entry through resolveEducationPresentation with its switches, a
 * special section through its shared markup (a project prints its title, technologies and description).
 */
const documentSources = (profile: ApplicantProfile | undefined, documents: KeywordMatchDocuments): TextSource[] => {
  const sources: TextSource[] = [];
  const cv = (label: string, texts: Array<string | undefined>) =>
    sources.push({ label, source: "Lebenslauf", texts: texts.filter((value): value is string => Boolean(value?.trim())) });
  if (profile) {
    cv("Berufsbezeichnung", [profile.title]);
    cv("Kurzprofil", [profile.summary]);
    for (const strength of profile.strengths ?? []) cv(titled("Stärke", strength.title), [strength.title, strength.description]);
    for (const group of profile.resumeKnowledgeGroups ?? []) cv(titled("Kenntnisse", group.title), group.items.flatMap((item) => [item.text, item.description]));
    for (const job of profile.experiences ?? []) {
      const station = resolveExperience(job);
      cv(titled("Werdegang", station.role), [station.role, station.organization, station.location, ...station.bullets]);
    }
    for (const entry of profile.education ?? []) {
      const education = resolveEducationPresentation(entry, profile.resumeEducationFieldVisibility);
      cv(titled("Bildungsweg", education.title), [education.title, education.institution, education.location, ...education.details]);
    }
    cv("Sprachen", profile.languages ?? []);
    for (const section of profile.specialSections ?? [])
      normalizeCustomSection(section).entries.forEach((entry, index) => cv(titled(specialPrefix(section), entry.title),
        [printedText(renderCustomSectionContent(section, { from: index, to: index + 1 }))]));
    for (const certificate of profile.certifications ?? []) cv(titled("Zertifikat", certificate), [certificate]);
  }
  if (documents.coverLetter?.trim()) sources.push({ label: "Anschreiben", source: "Anschreiben", texts: [documents.coverLetter] });
  return sources.filter((entry) => entry.texts.length);
};

/**
 * The technologies printed in the Werdegang (not for a Kompakt station) and the Projekte count like saved knowledge
 * when the ad names them verbatim.
 */
const documentTechnologies = (profile?: ApplicantProfile) => profile ? [
  ...(profile.experiences ?? []).filter((job) => !job.compact)
    .flatMap((job) => (job.technologies ?? []).map((value) => ({ value, label: titled("Werdegang", job.role) }))),
  ...(profile.specialSections ?? []).filter((section) => section.kind === "projects").flatMap((section) => section.entries
    .flatMap((entry) => (entry.technologies ?? []).map((value) => ({ value, label: titled(specialPrefix(section), entry.title) })))),
].map((entry) => ({ ...entry, value: entry.value.trim() })).filter((entry) => entry.value) : [];

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

const strengthGroupTypes = new Set(["strengths", "soft-skills"]);
const savedStrengths = (profile?: ApplicantProfile) => profile ? [
  ...profile.strengths.map((item) => item.title),
  ...profile.resumeKnowledgeGroups.filter((group) => group.visible && strengthGroupTypes.has(group.semanticType))
    .flatMap((group) => group.items.filter((item) => item.visible).map((item) => item.text)),
].map((entry) => entry.trim()).filter(Boolean) : [];
const recordedStrengths = (profile?: ApplicantProfile) => profile ? [...savedStrengths(profile), ...profile.skills].filter(Boolean) : [];

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

/**
 * Checks the requirements of the job ad against the whole Bewerbung: first the saved knowledge and strengths, then every
 * text of the Lebenslauf (Kurzprofil, Werdegang, Bildungsweg, Projekte and the other sections, Zertifikate) and the
 * Anschreiben. Languages and degrees keep their own level checks. Hidden sections and the details of Kompakt stations
 * are not printed and do not count.
 */
export const analyzeKeywordMatch = (application: Application, savedProfile?: ApplicantProfile, documents: KeywordMatchDocuments = {}): KeywordMatchResult => {
  const text = application.job.requirementsText ?? "";
  const profile = printedProfile(savedProfile, documents);
  const knowledge = recordedKnowledge(profile);
  const strengths = recordedStrengths(profile);
  const sources = documentSources(profile, documents);
  const found = new Map<string, MatchedRequirement>();
  const add = (key: string, label: string, kind: RequirementKind, evidence?: string, source?: EvidenceSource) => {
    if (!found.has(key)) found.set(key, { label, kind, evidence, ...(evidence && source ? { source } : {}) });
  };
  /** The saved list first, else the first part of the Lebenslauf or the Anschreiben that names the requirement. */
  const locate = (values: string[], listSource: EvidenceSource, aliases: string[]) => {
    const listed = evidenceFor(values, aliases);
    if (listed) return { evidence: listed, source: listSource };
    const part = sources.find((entry) => entry.texts.some((value) => aliases.some((alias) => includesKeywordPhrase(value, alias))));
    return part ? { evidence: part.label, source: part.source } : { evidence: undefined, source: undefined };
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
    const { evidence, source } = entry.kind === "strength" ? locate(strengths, "Stärken", aliases) : locate(knowledge, "Kenntnisse", aliases);
    add(entry.label, `${entry.label}${version ? ` ${version}` : ""}`, entry.kind, evidence, source);
  }

  // Saved uncommon skills and strengths, and the technologies of the Werdegang and the Projekte, can be checked when
  // the requirement names them verbatim.
  const uncommon = [
    ...knowledge.map((value) => ({ value, evidence: value, source: "Kenntnisse" as const, kind: "knowledge" as const })),
    ...documentTechnologies(profile).map(({ value, label }) => ({ value, evidence: label, source: "Lebenslauf" as const, kind: "knowledge" as const })),
    ...savedStrengths(profile).map((value) => ({ value, evidence: value, source: "Stärken" as const, kind: "strength" as const })),
  ];
  for (const { value, evidence, source, kind } of uncommon) {
    if (value.length < 3 || !includesKeywordPhrase(text, value)) continue;
    if (catalog.some((entry) => entry.aliases.some((alias) => includesKeywordPhrase(value, alias)))) continue;
    add(`custom:${normalizeKeywordText(value)}`, value, kind, evidence, source);
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
    // A knowledge found in a saved list is named as saved; one found in the documents by the requirement's name.
    matchedSkills: [...new Set(met.filter((item) => item.kind === "knowledge")
      .map((item) => item.source === "Kenntnisse" ? item.evidence! : item.label))],
  };
};
