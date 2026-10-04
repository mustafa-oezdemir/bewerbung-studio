import type { ApplicantProfile } from "./schema";

/**
 * The berufliche Stationen of the Lebenslauf, resolved once.
 *
 * `profile.experiences` is the only source of the career. Every output (React preview, PDF, the page planner,
 * the metadata layout, the Word export) reads a station through `resolveExperience`, so a template never decides
 * what a date, a company, a bullet or a technology means. The raw record is never changed: this module only
 * presents it (and never invents a task, an achievement, a technology or a date).
 */
export type Experience = ApplicantProfile["experiences"][number];

const clean = (value: string | undefined) => value?.trim() ?? "";

// --- dates ----------------------------------------------------------------------------------------------

export type CareerDate = { year: number; month?: number };

/** Words that mean "until now" in a legacy "Bis" field. */
const currentWords = /^(?:heute|aktuell|aktuelle(?:\s+position)?|jetzt|laufend|gegenwart|present|now|bis\s+heute|seit\s+heute)$/i;
export const isCurrentCareerValue = (value: string | undefined) => currentWords.test(clean(value));

/**
 * Reads the forms a "Von" / "Bis" field has held: "07/2023", "7/2023", "07.2023", "2023-07", "2023-07-15" and a
 * plain year "2023". Anything else (free text, "Sommer 2023") is not readable and is shown exactly as written.
 */
export const parseCareerDate = (value: string | undefined): CareerDate | undefined => {
  const text = clean(value);
  const monthFirst = /^(\d{1,2})\s*[./-]\s*(\d{4})$/.exec(text);
  const yearFirst = /^(\d{4})\s*[./-]\s*(\d{1,2})(?:[./-]\d{1,2})?$/.exec(text);
  const dayFirst = /^\d{1,2}\.(\d{1,2})\.(\d{4})$/.exec(text);
  const year = /^(\d{4})$/.exec(text);
  const [y, m] = monthFirst
    ? [monthFirst[2], monthFirst[1]]
    : yearFirst
      ? [yearFirst[1], yearFirst[2]]
      : dayFirst
        ? [dayFirst[2], dayFirst[1]]
        : year
          ? [year[1], undefined]
          : [];
  if (!y) return undefined;
  const month = m === undefined ? undefined : Number(m);
  if (month !== undefined && (month < 1 || month > 12)) return undefined;
  return { year: Number(y), ...(month === undefined ? {} : { month }) };
};

/** "MM/JJJJ" for a month, "JJJJ" for a year that was only a year, "heute" for a current end, else the text as is. */
export const formatCareerDate = (value: string | undefined) => {
  const text = clean(value);
  if (isCurrentCareerValue(text)) return "heute";
  const date = parseCareerDate(text);
  if (!date) return text;
  return date.month === undefined ? String(date.year) : `${String(date.month).padStart(2, "0")}/${date.year}`;
};

/** "07/2023 – 11/2025" or "07/2023 – heute"; one side alone stands alone. */
export const formatCareerPeriod = (from: string | undefined, to: string | undefined) => {
  const start = formatCareerDate(from);
  const end = formatCareerDate(to);
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
};

const monthIndex = (date: CareerDate, edge: "start" | "end") =>
  date.year * 12 + (date.month ?? (edge === "start" ? 1 : 12));

// --- employer and type ------------------------------------------------------------------------------------

/**
 * "Muster" + "GmbH" = "Muster GmbH". A company that already carries its legal form ("Muster GmbH" + "GmbH")
 * is not doubled; the stored company text is never changed.
 */
export const formatCareerOrganization = (company: string | undefined, legalForm: string | undefined) => {
  const name = clean(company);
  const form = clean(legalForm);
  if (!name || !form) return name;
  const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s,(])${escaped}(?:$|[\\s,.)])`, "i").test(name) ? name : `${name} ${form}`;
};

/** Suggestions only: any text stays valid, so an older free text (or "Teilzeit · 20 Std./Woche") is never lost. */
export const employmentTypeOptions = [
  "Vollzeit", "Teilzeit", "Werkstudent", "Praktikum", "Minijob", "Nebenjob", "Ferienjob",
  "Selbstständig", "Freiberuflich", "Ausbildung", "Sonstiges",
] as const;

// --- the bullets a station shows ------------------------------------------------------------------------------

export type ExperienceDetailType = "description" | "team" | "task" | "project" | "achievement" | "technologies";
export type ExperienceDetail = { type: ExperienceDetailType; text: string };

const texts = (values: readonly string[] | undefined) => (values ?? []).map(clean).filter(Boolean);

export type ResolvedExperience = {
  id: string;
  role: string;
  company: string;
  /** Company with its legal form, without doubling it. */
  organization: string;
  city: string;
  employmentType: string;
  /** Where the station happened: the city, then the type of employment when one was entered. */
  location: string;
  /** Effective dates as shown ("07/2023", "heute"). */
  from: string;
  to: string;
  period: string;
  isCurrent: boolean;
  /** The station is shown in one line only (Kompakt); the details stay in the profile. */
  compact: boolean;
  /** What the Lebenslauf draws under the heading, in order. Empty for a compact station. */
  details: ExperienceDetail[];
  /** `details` as the list of bullet texts every template renders and the planner measures. */
  bullets: string[];
};

/** A station is current when it says so or when its "Bis" is one of the words for "now" (older records). */
export const isCurrentExperience = (entry: Pick<Experience, "isCurrent" | "to">) =>
  Boolean(entry.isCurrent) || isCurrentCareerValue(entry.to);

export const resolveExperienceDetails = (entry: Experience): ExperienceDetail[] => {
  if (entry.compact) return [];
  const technologies = texts(entry.technologies);
  return [
    ...texts([entry.description]).map((text): ExperienceDetail => ({ type: "description", text })),
    ...(clean(entry.teamSize) ? [{ type: "team" as const, text: `Team / Verantwortung: ${clean(entry.teamSize)}` }] : []),
    ...texts(entry.tasks).map((text): ExperienceDetail => ({ type: "task", text })),
    ...texts(entry.projects).map((text): ExperienceDetail => ({ type: "project", text })),
    ...texts(entry.achievements).map((text): ExperienceDetail => ({ type: "achievement", text })),
    ...(technologies.length ? [{ type: "technologies" as const, text: `Technologien: ${technologies.join(", ")}` }] : []),
  ];
};

export const resolveExperience = (entry: Experience): ResolvedExperience => {
  const isCurrent = isCurrentExperience(entry);
  const from = formatCareerDate(entry.from);
  const to = isCurrent ? "heute" : formatCareerDate(entry.to);
  const city = clean(entry.city);
  const employmentType = clean(entry.employmentType);
  const details = resolveExperienceDetails(entry);
  return {
    id: entry.id,
    role: clean(entry.role),
    company: clean(entry.company),
    organization: formatCareerOrganization(entry.company, entry.legalForm),
    city,
    employmentType,
    location: [city, employmentType].filter(Boolean).join(" · "),
    from,
    to,
    period: formatCareerPeriod(from, to),
    isCurrent,
    compact: Boolean(entry.compact),
    details,
    bullets: details.map((detail) => detail.text),
  };
};

/** "Aktuelle Position" on or off. A real end date stays stored while a station is current; only the word "heute" is cleared. */
export const setExperienceCurrent = (entry: Experience, isCurrent: boolean): Experience => ({
  ...entry,
  isCurrent,
  ...(!isCurrent && isCurrentCareerValue(entry.to) ? { to: "" } : {}),
});

/** A typed "Bis": one of the words for "now" makes the station current. */
export const setExperienceEnd = (entry: Experience, to: string): Experience => ({
  ...entry,
  to,
  isCurrent: isCurrentCareerValue(to),
});

/** A station as every template draws it: resolved dates, employer with legal form, every detail as one bullet. */
export const toTemplateExperienceItem = (entry: Experience) => {
  const item = resolveExperience(entry);
  return {
    id: item.id, from: item.from, to: item.to, title: item.role,
    organization: item.organization, city: item.location, achievements: item.bullets,
  };
};

/** Tidies a station before it is saved: no stray spaces, no empty list entries. Wording and order stay as written. */
export const normalizeExperience = (entry: Experience): Experience => ({
  ...entry,
  from: clean(entry.from),
  to: clean(entry.to),
  role: clean(entry.role),
  company: clean(entry.company),
  city: clean(entry.city),
  legalForm: clean(entry.legalForm),
  employmentType: clean(entry.employmentType),
  description: clean(entry.description),
  teamSize: clean(entry.teamSize),
  tasks: texts(entry.tasks),
  projects: texts(entry.projects),
  technologies: texts(entry.technologies),
  achievements: texts(entry.achievements),
});

// --- which details of a station the Lebenslauf shows ------------------------------------------------------------

/**
 * The details of a station the user can switch on or off for the Lebenslauf (`profile.resumeCareerFieldVisibility`,
 * the one source for every template, the PDF and the planner). Switching one off never deletes the value.
 */
export const resumeCareerFieldKeys = ["employmentType", "description", "teamSize", "tasks", "projects", "technologies", "achievements"] as const;
export type ResumeCareerFieldKey = (typeof resumeCareerFieldKeys)[number];
export type ResumeCareerFieldVisibility = Record<ResumeCareerFieldKey, boolean>;

export const resumeCareerFieldLabels: Record<ResumeCareerFieldKey, string> = {
  employmentType: "Beschäftigungsart",
  description: "Kurze Beschreibung",
  teamSize: "Team / Verantwortung",
  tasks: "Aufgaben",
  projects: "Projekte",
  technologies: "Technologien",
  achievements: "Erfolge",
};

/** Everything a station holds is shown, except the team size: that is a detail the user adds on purpose. */
export const defaultResumeCareerFieldVisibility: ResumeCareerFieldVisibility = {
  employmentType: true, description: true, teamSize: false, tasks: true, projects: true, technologies: true, achievements: true,
};

/** Older profiles know no such record: every missing or invalid key takes its default. */
export const resolveResumeCareerFieldVisibility = (value: unknown): ResumeCareerFieldVisibility => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    resumeCareerFieldKeys.map((key) => [key, typeof source[key] === "boolean" ? source[key] : defaultResumeCareerFieldVisibility[key]]),
  ) as ResumeCareerFieldVisibility;
};

/** The stations as the Lebenslauf shows them: a detail that is switched off is left out (the stored value stays). */
export const applyResumeCareerFieldVisibility = (experiences: readonly Experience[], visibility: ResumeCareerFieldVisibility): Experience[] =>
  experiences.map((entry) => ({
    ...entry,
    employmentType: visibility.employmentType ? entry.employmentType : "",
    description: visibility.description ? entry.description : "",
    teamSize: visibility.teamSize ? entry.teamSize : "",
    tasks: visibility.tasks ? entry.tasks : [],
    projects: visibility.projects ? entry.projects : [],
    technologies: visibility.technologies ? entry.technologies : [],
    achievements: visibility.achievements ? entry.achievements : [],
  }));

// --- guidance in the editor --------------------------------------------------------------------------------------

export const careerBulletRecommendation = { min: 3, max: 6 } as const;

/** The points the user wrote as tasks, projects and achievements (the ones worth counting; no description, no technologies). */
export const countExperiencePoints = (entry: Pick<Experience, "tasks" | "projects" | "achievements">) =>
  texts(entry.tasks).length + texts(entry.projects).length + texts(entry.achievements).length;

export type BulletRange = "none" | "few" | "ok" | "many";
export const getBulletRange = (count: number): BulletRange =>
  count === 0 ? "none" : count < careerBulletRecommendation.min ? "few" : count > careerBulletRecommendation.max ? "many" : "ok";

// --- order and gaps -------------------------------------------------------------------------------------------------

const endKey = (entry: Experience) =>
  isCurrentExperience(entry)
    ? Number.POSITIVE_INFINITY
    : (parseCareerDate(entry.to) ? monthIndex(parseCareerDate(entry.to)!, "end") : undefined);
const startKey = (entry: Experience) => (parseCareerDate(entry.from) ? monthIndex(parseCareerDate(entry.from)!, "start") : undefined);

/**
 * Newest station first (by its end, a current station first, then by its start). A sort the user asks for, never
 * applied on its own. Stations without a readable date keep their relative order and follow the others.
 */
export const sortExperiencesLatestFirst = <T extends Experience>(experiences: readonly T[]): T[] => {
  const keyed = experiences.map((entry, index) => ({ entry, index, end: endKey(entry) ?? startKey(entry), start: startKey(entry) }));
  const dated = keyed.filter((item) => item.end !== undefined || item.start !== undefined);
  const undated = keyed.filter((item) => item.end === undefined && item.start === undefined);
  dated.sort((a, b) => ((b.end ?? 0) - (a.end ?? 0)) || ((b.start ?? 0) - (a.start ?? 0)) || a.index - b.index);
  return [...dated, ...undated].map((item) => item.entry);
};

export const isLatestFirst = (experiences: readonly Experience[]) =>
  sortExperiencesLatestFirst(experiences).every((entry, index) => entry === experiences[index]);

export type CareerGap = { from: string; to: string };
/** A gap shorter than this many months between two stations is not reported. */
export const careerGapMonths = 3;

const formatMonth = (index: number) => `${String((((index - 1) % 12) + 12) % 12 + 1).padStart(2, "0")}/${Math.floor((index - 1) / 12)}`;

/**
 * Obvious gaps between stations (an editor aid only; nothing is saved or invented for them). A gap is the time
 * between the end of the later-ending earlier station and the start of the next one, found by dates, not by list order.
 */
export const findCareerGaps = (experiences: readonly Experience[]): CareerGap[] => {
  const spans = experiences.flatMap((entry) => {
    const start = parseCareerDate(entry.from);
    const end = isCurrentExperience(entry) ? Number.POSITIVE_INFINITY : parseCareerDate(entry.to) ? monthIndex(parseCareerDate(entry.to)!, "end") : undefined;
    return start && end !== undefined ? [{ start: monthIndex(start, "start"), end }] : [];
  }).sort((a, b) => a.start - b.start);
  const gaps: CareerGap[] = [];
  let reach = spans[0]?.end;
  for (const span of spans.slice(1)) {
    if (reach !== undefined && Number.isFinite(reach) && span.start - reach - 1 >= careerGapMonths)
      gaps.push({ from: formatMonth(reach), to: formatMonth(span.start) });
    reach = Math.max(reach ?? span.end, span.end);
  }
  return gaps;
};

/** A "Von"/"Bis" the editor cannot read: kept as written, only mentioned. */
export const findUnreadableCareerDates = (entry: Pick<Experience, "from" | "to" | "isCurrent">) =>
  [entry.from, ...(entry.isCurrent ? [] : [entry.to])].map(clean).filter(
    (value) => value && !isCurrentCareerValue(value) && !parseCareerDate(value),
  );
