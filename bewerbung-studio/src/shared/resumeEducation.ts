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

/**
 * The details of a station the user can switch on or off for the Lebenslauf (`profile.resumeEducationFieldVisibility`,
 * "Im Lebenslauf anzeigen"). Abschluss, Institution, Ort and Zeitraum are the station itself and always shown.
 */
export const resumeEducationFieldKeys = ["country", "type", "fieldOfStudy", "grade", "status", "description"] as const;
export type ResumeEducationFieldKey = (typeof resumeEducationFieldKeys)[number];
export type ResumeEducationFieldVisibility = Record<ResumeEducationFieldKey, boolean>;

export const resumeEducationFieldLabels: Record<ResumeEducationFieldKey, string> = {
  country: "Land",
  type: "Art der Ausbildung",
  fieldOfStudy: "Fachrichtung / Schwerpunkt",
  grade: "Abschlussnote",
  status: "Status",
  description: "Weitere relevante Angaben",
};

/**
 * The output the Lebenslauf had before the switches existed: country, field, grade and further details are shown;
 * a separate line for the type and for the status was never printed, so those two start switched off.
 */
export const defaultResumeEducationFieldVisibility: ResumeEducationFieldVisibility = {
  country: true, type: false, fieldOfStudy: true, grade: true, status: false, description: true,
};

/** Older profiles know no such record: every missing or invalid key takes its default. */
export const resolveResumeEducationFieldVisibility = (value: unknown): ResumeEducationFieldVisibility => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    resumeEducationFieldKeys.map((key) => [key, typeof source[key] === "boolean" ? source[key] : defaultResumeEducationFieldVisibility[key]]),
  ) as ResumeEducationFieldVisibility;
};

/** Switches one detail on or off; the education entries themselves stay as they are. */
export const setResumeEducationFieldVisible = <Profile extends { resumeEducationFieldVisibility?: unknown }>(
  profile: Profile,
  key: ResumeEducationFieldKey,
  visible: boolean,
): Profile => ({
  ...profile,
  resumeEducationFieldVisibility: { ...resolveResumeEducationFieldVisibility(profile.resumeEducationFieldVisibility), [key]: visible },
});

/**
 * The one presentation of a station for every Lebenslauf (preview, PDF, page planner). The switches only decide
 * which details are printed; the meaning of the station never depends on them: a running station still ends
 * "heute" and a station without Abschluss is never presented as a degree, whether its status is shown or not.
 * The stored entry is not changed.
 */
export const resolveEducationPresentation = (entry: Education, visibility: unknown = defaultResumeEducationFieldVisibility) => {
  const show = resolveResumeEducationFieldVisibility(visibility);
  const incomplete = isEducationWithoutDegree(entry);
  const type = clean(entry.type);
  const field = clean(entry.fieldOfStudy);
  const degree = clean(entry.degree);
  const institution = clean(entry.institution);
  const city = clean(entry.city);
  const country = show.country ? clean(entry.country) : "";
  const grade = show.grade ? clean(entry.grade) : "";
  const status = clean(entry.status);
  const description = show.description ? clean(entry.description) : "";
  const current = isCurrentCareerValue(entry.to) || /^laufend$/i.test(status);
  // A qualification that was not obtained cannot be presented as an awarded degree. Without an Abschluss the title
  // is built from type and field whatever the switches say: they only govern the separate detail lines below.
  const title = incomplete
    ? [type || "Ausbildung", field].filter(Boolean).join(" – ")
    : degree || [type, field].filter(Boolean).join(" – ");
  const inTitle = (value: string) => title.toLocaleLowerCase("de-DE").includes(value.toLocaleLowerCase("de-DE"));
  const detailsBefore = [
    ...(show.type && type && !inTitle(type) ? [`Art: ${type}`] : []),
    ...(show.fieldOfStudy && !incomplete && field && !inTitle(field) ? [`Fachrichtung: ${field}`] : []),
    ...(!incomplete && grade ? [`Abschlussnote: ${grade}`] : []),
    ...(show.status && status ? [`Status: ${status}`] : []),
  ];
  const details = [...detailsBefore, ...(description ? [description] : [])];
  return {
    id: entry.id,
    title,
    institution,
    location: [city, country].filter(Boolean).join(", "),
    from: formatCareerDate(entry.from),
    to: current ? "heute" : formatCareerDate(entry.to),
    dateRange: formatCareerPeriod(entry.from, current ? "heute" : entry.to),
    type,
    status,
    details,
    /** Which of the details is the free description (the last one), or -1: the one a page break may go through. */
    descriptionIndex: description ? detailsBefore.length : -1,
    incomplete,
  };
};

/**
 * What a page break may fall between inside one education entry. The header of the entry (Abschluss, Institution,
 * Zeitraum, Ort) always stays together; the details after it (Fachrichtung, Abschlussnote, Status, …) are one unit each;
 * a long description is cut at its sentences (and, for one very long sentence, at a word), so a long text can go on
 * on the next page without leaving a gap behind. The units are what a plan range (`bullets: { from, to, total }`)
 * counts, for the page planner and for the output alike.
 */
export type EducationDetailUnit = { detail: number; text: string };

const abbreviations = /(?:^|\s)(?:ca|bzw|z|B|d|h|u|a|v|vgl|ggf|evtl|usw|inkl|Nr|Dr|Prof|Std|Abs|Art|St|Hr|Fr|z\.B|u\.a|d\.h|etc|sog|bspw)\.$/;
const LONG_SENTENCE = 200;
const CHUNK = 110;

const splitSentences = (text: string): string[] => {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?…]+\s+(?=[A-ZÄÖÜ„"'(0-9])/gu)) {
    const end = match.index + match[0].trimEnd().length;
    if (abbreviations.test(text.slice(start, end))) continue;
    sentences.push(text.slice(start, end).trim());
    start = match.index + match[0].length;
  }
  if (text.slice(start).trim()) sentences.push(text.slice(start).trim());
  // A very long sentence goes on at a word, never in the middle of one.
  return sentences.flatMap((sentence) => {
    if (sentence.length <= LONG_SENTENCE) return [sentence];
    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    let current = "";
    for (const word of words) {
      if (current && current.length + 1 + word.length > CHUNK) {
        chunks.push(current);
        current = word;
      } else current = current ? `${current} ${word}` : word;
    }
    if (current) chunks.push(current);
    return chunks;
  });
};

export const educationDetailUnits = (details: readonly string[], descriptionIndex: number): EducationDetailUnit[] =>
  details.flatMap((text, detail) => (detail === descriptionIndex ? splitSentences(text) : [text]).map((part) => ({ detail, text: part })));

/**
 * The details of an entry that belong to the units `from`..`to` (exclusive): every detail whole, a description with
 * the sentences of its range joined (the single description is a paragraph that goes on where the page ended).
 */
export const sliceEducationDetails = (
  details: readonly string[],
  descriptionIndex: number,
  range?: { from: number; to: number },
): string[] => {
  if (!range) return [...details];
  const units = educationDetailUnits(details, descriptionIndex).slice(range.from, range.to);
  // join the units of the description into one paragraph
  const description = units.filter((unit) => unit.detail === descriptionIndex).map((unit) => unit.text);
  const others = units.filter((unit) => unit.detail !== descriptionIndex).map((unit) => unit.text);
  return description.length ? [...others, description.join(" ")] : others;
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

export const toTemplateEducationItem = (entry: Education, visibility: unknown = defaultResumeEducationFieldVisibility) => {
  const item = resolveEducationPresentation(entry, visibility);
  return {
    id: item.id, from: item.from, to: item.to, title: item.title,
    organization: item.institution, city: item.location, achievements: item.details,
  };
};
