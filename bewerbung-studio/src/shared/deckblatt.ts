import type { ApplicantProfile, Application, Attachment } from "./schema";
import type { DocumentDraft } from "./schema";
import { getVisibleApplicationDocumentLabels } from "./applicationDocuments";
import { resolveJobAdvertisementText } from "./jobAdvertisement";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import { formatResumeBirth, getResumePersonalDetails } from "./resumePersonalData";
import { isCurrentExperience, parseCareerDate, type CareerDate } from "./resumeCareer";
import { getTechnologyBrandIconMarkup } from "./technologyBrand";

export type DeckblattContact = {
  label: string;
  value: string;
  href?: string;
};

const externalHref = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;

export const getDeckblattContacts = (
  profile: ApplicantProfile | undefined,
  visibility: DocumentDraft["coverSheetContactVisibility"] = {
    address: true,
    phone: true,
    email: true,
    linkedin: true,
    github: true,
    website: true,
  },
): DeckblattContact[] => {
  if (!profile) return [];

  const address = [
    profile.street,
    `${profile.postalCode} ${profile.city}`.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  return [
    visibility.address && address
      ? { label: "Adresse", value: address }
      : undefined,
    visibility.phone && profile.phone
      ? {
          label: "Telefon",
          value: profile.phone,
          href: `tel:${profile.phone.replace(/[^\d+]/g, "")}`,
        }
      : undefined,
    visibility.email && profile.email
      ? {
          label: "E-Mail",
          value: profile.email,
          href: `mailto:${profile.email}`,
        }
      : undefined,
    visibility.linkedin && profile.linkedin
      ? {
          label: "LinkedIn",
          value: profile.linkedin,
          href: externalHref(profile.linkedin),
        }
      : undefined,
    visibility.github && profile.github
      ? {
          label: "GitHub",
          value: profile.github,
          href: externalHref(profile.github),
        }
      : undefined,
    visibility.website && profile.portfolio
      ? {
          label: "Website",
          value: profile.portfolio,
          href: externalHref(profile.portfolio),
        }
      : undefined,
  ].filter((contact): contact is DeckblattContact => Boolean(contact));
};

export const getDeckblattCompetencies = (
  profile: ApplicantProfile | undefined,
  application?: Pick<Application, "job">,
) => {
  const values = [
    ...(profile?.strengths ?? []).map((strength) => strength.title),
    ...(profile?.skills ?? []),
  ]
    .map((skill) => skill.split(/\s+(?:-|–|—|:)\s+/)[0].trim())
    .filter(Boolean);
  const unique = Array.from(
    new Map(
      values.map((value) => [value.toLocaleLowerCase("de-DE"), value]),
    ).values(),
  );
  const jobText =
    `${application?.job.title ?? ""} ${application ? resolveJobAdvertisementText(application.job) : ""}`.toLocaleLowerCase(
      "de-DE",
    );
  const ranked = unique
    .map((value, index) => ({
      value,
      index,
      matchesJob: jobText.includes(value.toLocaleLowerCase("de-DE")),
    }))
    .sort(
      (left, right) =>
        Number(right.matchesJob) - Number(left.matchesJob) ||
        left.index - right.index,
    )
    .slice(0, 5)
    .map(({ value }) => value);

  return ranked.length >= 3 ? ranked : [];
};

export const validateDeckblattData = (
  application: Pick<Application, "company" | "job">,
  profile: ApplicantProfile | undefined,
) => {
  const missing: string[] = [];
  if (!`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim()) {
    missing.push("Name der Bewerberin oder des Bewerbers");
  }
  if (!application.company.name.trim()) missing.push("Unternehmen");
  if (!application.job.title.trim()) missing.push("Stellenbezeichnung");
  if (missing.length) {
    throw new Error(
      `Deckblatt kann nicht erstellt werden. Bitte ergänzen Sie: ${missing.join(", ")}.`,
    );
  }
};

export const getDeckblattDocuments = (
  attachments: readonly Attachment[],
  applicationId: string,
  settings: DocumentDraft["documentListSettings"] = [],
  includeMotivation = false,
) => getVisibleApplicationDocumentLabels(attachments, applicationId, settings, includeMotivation);

/** Geburt, Staatsangehörigkeit, Familienstand, Kinder: the fields the Lebenslauf shows too (its visibility switches apply). */
export const getDeckblattPersonalDetails = (profile: ApplicantProfile | undefined) => {
  const visible = getResumeDisplayProfile(profile);
  const birth = formatResumeBirth(visible);
  return [
    ...(birth ? [birth.startsWith("Geboren") ? birth : `Geboren: ${birth}`] : []),
    ...getResumePersonalDetails(visible)
      .filter((detail) => detail.kind !== "onlineProfile")
      .map((detail) => detail.text),
  ];
};

// Stations that are not professional experience of their own.
const notCountedAsExperience = /^(praktikum|werkstudent|minijob|nebenjob|ferienjob|ausbildung)$/i;

const monthIndex = (date: CareerDate, end: boolean) => date.year * 12 + (date.month ?? (end ? 12 : 1)) - 1;

/** Whole years of professional experience; overlapping stations count once, gaps not at all. */
export const getDeckblattExperienceYears = (profile: ApplicantProfile | undefined, today = new Date()) => {
  const now = today.getFullYear() * 12 + today.getMonth();
  const ranges = (profile?.experiences ?? [])
    .filter((entry) => !notCountedAsExperience.test((entry.employmentType ?? "").trim()))
    .flatMap((entry) => {
      const from = parseCareerDate(entry.from);
      const to = isCurrentExperience(entry) ? undefined : parseCareerDate(entry.to);
      if (!from || (!to && !isCurrentExperience(entry))) return [];
      const start = monthIndex(from, false);
      const end = Math.min(to ? monthIndex(to, true) : now, now);
      return end >= start ? [[start, end] as const] : [];
    })
    .sort((left, right) => left[0] - right[0]);
  let months = 0;
  let reached = -Infinity;
  for (const [start, end] of ranges) {
    if (end <= reached) continue;
    months += end - Math.max(start, reached + 1) + 1;
    reached = end;
  }
  return Math.floor(months / 12);
};

/** The two latest degrees (`Abschluss Fachrichtung`) and the years of professional experience. */
export const getDeckblattQualifications = (profile: ApplicantProfile | undefined, today = new Date()) => {
  const degrees = (profile?.education ?? [])
    .filter((entry) => entry.degree.trim() && !/ohne abschluss/i.test(entry.status ?? ""))
    .map((entry, index) => {
      const end = parseCareerDate(entry.to);
      return { entry, index, end: /laufend/i.test(entry.status ?? "") || !end ? Infinity : monthIndex(end, true) };
    })
    .sort((left, right) => right.end - left.end || left.index - right.index)
    .slice(0, 2)
    .map(({ entry }) => {
      const field = (entry.fieldOfStudy ?? "").trim();
      const text = field && !entry.degree.toLocaleLowerCase("de-DE").includes(field.toLocaleLowerCase("de-DE")) ? `${entry.degree.trim()} ${field}` : entry.degree.trim();
      return /laufend/i.test(entry.status ?? "") ? `${text} (laufend)` : text;
    });
  const years = getDeckblattExperienceYears(profile, today);
  return [...degrees, ...(years >= 1 ? [`${years}+ ${years === 1 ? "Jahr" : "Jahre"} Berufserfahrung`] : [])];
};

/** The Stärken of the profile with the icon they have in the Lebenslauf. */
export const getDeckblattTechStack = (profile: ApplicantProfile | undefined) =>
  (profile?.strengths ?? [])
    .filter((strength) => strength.title.trim())
    .slice(0, 12)
    .map((strength) => ({ title: strength.title.trim(), icon: getTechnologyBrandIconMarkup(strength.title, strength.iconId) }));
