export const resumeCustomContentTypes = ["text", "list", "entries", "skills", "timeline"] as const;
export type ResumeCustomContentType = typeof resumeCustomContentTypes[number];
export const resumeCustomContentLabels: Record<ResumeCustomContentType, string> = {
  text: "Text", list: "Liste", entries: "Einträge", skills: "Skills", timeline: "Timeline",
};
