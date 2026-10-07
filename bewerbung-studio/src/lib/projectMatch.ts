import type { ApplicantProfile, Application } from "../shared/schema";
import { normalizeKeywordText } from "./keywordMatch";

type ProjectEntry = ApplicantProfile["specialSections"][number]["entries"][number];
export type ProjectMatch = { project: ProjectEntry; score: number; matchedTechnologies: string[] };

const aliases: Record<string, string[]> = {
  "asp.net core mvc": ["asp.net", ".net", "dotnet", "c#"],
  "entity framework core": ["entity framework", "ef core", ".net"],
  "spring boot": ["spring", "java"],
  "laravel 12": ["laravel", "php"],
  "symfony 7.4": ["symfony", "php"],
  "inertia react": ["react", "inertia"],
  "next.js": ["nextjs", "next.js", "react"],
  "go": ["golang"],
  "docker compose": ["docker"],
  "postgresql": ["postgres"],
};

const hasTerm = (text: string, term: string) => {
  const escaped = normalizeKeywordText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
};

const genericWords = new Set(["application", "platform", "project", "projekt", "developer", "full", "stack", "commerce", "software", "website", "backend", "frontend"]);

/** Stable, local recommendations. The caller owns selection; this function never changes it. */
export const matchProjects = (application: Application, profile?: ApplicantProfile): ProjectMatch[] => {
  const advertisement = normalizeKeywordText(`${application.job.title} ${application.job.fullText}`);
  const projects = profile?.specialSections.filter((section) => section.kind === "projects")
    .flatMap((section) => section.entries) ?? [];
  return projects.map((project, index) => {
    const matchedTechnologies = project.technologies.filter((technology) =>
      [technology, ...(aliases[normalizeKeywordText(technology)] ?? [])].some((term) => hasTerm(advertisement, term)));
    const evidence = normalizeKeywordText([project.title, project.description, ...project.bullets].join(" "))
      .match(/[a-z0-9+#.]{3,}/g) ?? [];
    const evidenceMatches = [...new Set(evidence)]
      .filter((word) => !genericWords.has(word) && hasTerm(advertisement, word));
    return { project, score: matchedTechnologies.length * 12 + Math.min(6, evidenceMatches.length), matchedTechnologies, index };
  }).sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ index: _index, ...match }) => match);
};
