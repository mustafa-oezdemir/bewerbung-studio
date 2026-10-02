import type { ApplicantProfile } from "./schema";
import { formatCareerDate, formatCareerPeriod, isCurrentCareerValue, parseCareerDate } from "./resumeCareer";

export type Education = ApplicantProfile["education"][number];
const clean = (value: string | undefined) => value?.trim() ?? "";

export const educationTypeOptions = [
  "Studium", "Berufsausbildung", "Schulbildung", "Umschulung",
  "Duales Studium", "Weiterbildung mit Abschluss", "Ausland / Auslandssemester", "Sonstiges",
] as const;
export const educationStatusOptions = ["Abgeschlossen", "Laufend", "Ohne Abschluss", "Sonstiges"] as const;

export const isEducationWithoutDegree = (entry: Education) =>
  /^(?:ohne\s+abschluss|nicht\s+abgeschlossen|abgebrochen|studienabbruch)$/i.test(clean(entry.status));

export const resolveEducationPresentation = (entry: Education) => {
  const incomplete = isEducationWithoutDegree(entry);
  const type = clean(entry.type);
  const field = clean(entry.fieldOfStudy);
  const degree = clean(entry.degree);
  const institution = clean(entry.institution);
  const city = clean(entry.city);
  const country = clean(entry.country);
  const grade = clean(entry.grade);
  const description = clean(entry.description);
  const current = isCurrentCareerValue(entry.to) || /^laufend$/i.test(clean(entry.status));
  // A qualification that was not obtained cannot be presented as an awarded degree.
  const title = incomplete
    ? [type || "Ausbildung", field].filter(Boolean).join(" – ")
    : degree || [type, field].filter(Boolean).join(" – ");
  const details = [
    ...(!incomplete && field && !title.toLocaleLowerCase("de-DE").includes(field.toLocaleLowerCase("de-DE"))
      ? [`Fachrichtung: ${field}`] : []),
    ...(!incomplete && grade ? [`Abschlussnote: ${grade}`] : []),
    ...(description ? [description] : []),
  ];
  return {
    id: entry.id,
    title,
    institution,
    location: [city, country].filter(Boolean).join(", "),
    from: formatCareerDate(entry.from),
    to: current ? "heute" : formatCareerDate(entry.to),
    dateRange: formatCareerPeriod(entry.from, current ? "heute" : entry.to),
    type,
    status: clean(entry.status),
    details,
    incomplete,
  };
};

export const createEducation = (): Education => ({
  id: crypto.randomUUID(), from: "", to: "", degree: "", institution: "", city: "",
  country: "", type: "", fieldOfStudy: "", grade: "", status: "", description: "",
});

/** New entries go on top; existing manual order is never changed. */
export const sortEducationLatestFirst = (entries: Education[]) => [...entries].sort((a, b) => {
  const key = (entry: Education) => {
    if (isCurrentCareerValue(entry.to) || /^laufend$/i.test(clean(entry.status))) return Number.MAX_SAFE_INTEGER;
    const date = parseCareerDate(entry.to) ?? parseCareerDate(entry.from);
    return date ? date.year * 12 + (date.month ?? 12) : -1;
  };
  return key(b) - key(a);
});

export const toTemplateEducationItem = (entry: Education) => {
  const item = resolveEducationPresentation(entry);
  return {
    id: item.id, from: item.from, to: item.to, title: item.title,
    organization: item.institution, city: item.location, achievements: item.details,
  };
};
