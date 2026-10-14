import type { JobAdvertisement } from "./schema";

/** One export and consumer representation; the original text always remains intact. */
export const resolveJobAdvertisementText = (job: Pick<JobAdvertisement, "fullText" | "tasksText" | "requirementsText">) => {
  const sections = [
    job.tasksText?.trim() ? `Deine Aufgaben\n${job.tasksText.trim()}` : "",
    job.requirementsText?.trim() ? `Dein Profil / Anforderungen\n${job.requirementsText.trim()}` : "",
    job.fullText?.trim()
      ? (job.tasksText?.trim() || job.requirementsText?.trim()
          ? `Bisheriger Anzeigentext\n${job.fullText.trim()}`
          : job.fullText)
      : "",
  ];
  return sections.filter(Boolean).join("\n\n");
};
