import type { ApplicantProfile } from "./schema";

export type ResumeStrength = { title: string; description: string; iconId: string };

const unique = (values: readonly string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

/**
 * The Stärken of the Lebenslauf, for every template and both surfaces: the profile's own strengths; an older
 * profile without any shows its first skills ("Titel – Beschreibung") instead. Nothing is invented.
 */
export const resolveResumeStrengths = (profile: ApplicantProfile | undefined, maximum = 4): ResumeStrength[] => {
  const explicit = (profile?.strengths ?? [])
    .map((strength) => ({ title: strength.title.trim(), description: strength.description.trim(), iconId: strength.iconId.trim() }))
    .filter((strength) => strength.title);
  if (explicit.length) return explicit.slice(0, maximum);
  return unique(profile?.skills ?? [])
    .slice(0, maximum)
    .map((value) => {
      const [title, ...description] = value.split(/\s+(?:–|—|:)\s+/);
      return { title: title.trim(), description: description.join(" – ").trim(), iconId: "" };
    });
};
