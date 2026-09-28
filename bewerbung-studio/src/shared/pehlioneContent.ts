import type { ApplicantProfile } from "./schema";

const unique = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const profileEvidence = (profile?: ApplicantProfile) =>
  [
    profile?.title,
    profile?.summary,
    ...(profile?.strengths ?? []).flatMap((item) => [
      item.title,
      item.description,
    ]),
    ...(profile?.experiences ?? []).flatMap((item) => [
      item.role,
      item.company,
      ...item.technologies,
      ...item.achievements,
    ]),
    ...(profile?.education ?? []).flatMap((item) => [
      item.degree,
      item.institution,
    ]),
  ]
    .filter(Boolean)
    .join(" ");

/**
 * Creates concise sidebar labels only when the underlying profile contains
 * matching evidence. The source profile is never modified.
 */
export const getPehlioneCoreCompetencies = (profile?: ApplicantProfile) => {
  const evidence = profileEvidence(profile);
  const result: string[] = [];
  if (/prozess|abl[aä]uf|koordination/i.test(evidence))
    result.push("Prozessanalyse und Prozessoptimierung");
  if (/daten|monitoring|grafana|prtg/i.test(evidence))
    result.push("Datenanalyse und Monitoring");
  if (/dokumentation|dokumentiert/i.test(evidence))
    result.push("Technische Dokumentation");
  if (/api|schnittstelle|datenverarbeitung/i.test(evidence))
    result.push("API-Integration und Datenverarbeitung");
  if (/grafana|prtg/i.test(evidence)) result.push("Grafana / PRTG");
  if (/strukturiert|l[oö]sungsorientiert|probleml[oö]s/i.test(evidence))
    result.push("Strukturierte Problemlösung");
  if (/qualit[aä]t|sicherheit|verantwortung/i.test(evidence))
    result.push("Qualität, Sicherheit und verantwortungsbewusstes Arbeiten");
  if (/software|anwendungsentwick/i.test(evidence))
    result.push("Softwareentwicklung im technischen Umfeld");
  return unique(result).slice(0, 8);
};

export const getPehlioneTechnicalFocus = (profile?: ApplicantProfile) => {
  const evidence = profileEvidence(profile);
  const result: string[] = [];
  if (/grafana|prtg|monitoring/i.test(evidence))
    result.push("Monitoring & Visualisierung (Grafana, PRTG)");
  if (/api|schnittstelle|datenverarbeitung/i.test(evidence))
    result.push("API-Integration & Datenverarbeitung");
  if (/software|anwendungsentwick/i.test(evidence))
    result.push("Softwareentwicklung im technischen Umfeld");
  if (/daten|prozess/i.test(evidence))
    result.push("Datenanalyse & Prozessverständnis");
  if (/qualit[aä]t|sicherheit|verantwortung/i.test(evidence))
    result.push("Qualität, Sicherheit & verantwortungsbewusstes Arbeiten");
  if (/strukturiert|l[oö]sungsorientiert|probleml[oö]s/i.test(evidence))
    result.push("Strukturierte Analyse & Problemlösung");
  return unique(result).slice(0, 6);
};

export const getPehlioneProjectHighlight = (profile?: ApplicantProfile) => {
  const experiences = profile?.experiences ?? [];
  for (const experience of experiences) {
    const explicitTitle = experience.projects.find((title) => title.trim());
    const grafanaAchievement = experience.achievements.find((entry) =>
      /grafana.+prtg/i.test(entry),
    );
    const title =
      explicitTitle ||
      (grafanaAchievement ? "Grafana Datasource Plugin für PRTG" : "");
    if (title) {
      return {
        title,
        company: experience.company,
        technologies: experience.technologies.filter(Boolean),
        achievements: experience.achievements.filter(Boolean).slice(0, 3),
      };
    }
  }
  return undefined;
};

export const hasPehlioneCustomProjectHighlight = (profile?: ApplicantProfile) =>
  profile?.specialSections.some((section) =>
    section.isVisible && /projekt[\s-]*highlight/i.test(section.title),
  ) ?? false;
