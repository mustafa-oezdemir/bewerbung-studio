import { z } from "zod";
import type { ApplicantProfile } from "./schema";
import { externalUrl, formatPhoneForDisplay, formatUrlForDisplay, phoneHref } from "./contactPresentation";

/**
 * The central presentation of the "Persönliche Daten" of a profile. The profile fields themselves
 * (firstName, lastName, street, postalCode, city, country, phone, email, linkedin, github, portfolio,
 * onlineProfiles, birthDate, birthPlace, nationality, familyStatus, children) stay the only data; this module
 * turns them into text for the editor, the preview and the PDF, so no template spells a format itself.
 * Which values reach a template at all is decided by `getResumeDisplayProfile` (visibility); empty values
 * produce no text and therefore never an empty contact line.
 */
export type ResumePersonalSource = Partial<
  Pick<
    ApplicantProfile,
    | "firstName"
    | "lastName"
    | "street"
    | "postalCode"
    | "city"
    | "country"
    | "phone"
    | "email"
    | "birthDate"
    | "birthPlace"
    | "nationality"
    | "familyStatus"
    | "children"
    | "onlineProfiles"
  >
>;

const clean = (value: string | undefined) => value?.trim() ?? "";

/** Effective full name: always resolved from firstName and lastName, never stored. */
export const getResumeFullName = (profile: ResumePersonalSource | undefined) =>
  [profile?.firstName, profile?.lastName].map(clean).filter(Boolean).join(" ");

// --- Address --------------------------------------------------------------------------------------------

export type ResumeAddressOptions = {
  /** Print "Straße und Hausnummer" as the first part (default: yes, a visible address is printed completely). */
  street?: boolean;
  /** Print the postal code in front of the city ("12345 Stuttgart"; default: yes). */
  postalCode?: boolean;
};

/**
 * The address as lines: `["Musterstraße 10", "12345 Stuttgart, Deutschland"]`. Without a street or a postal
 * code the part is left out; a template that wants a short location asks for neither.
 */
export const resumeAddressLines = (
  profile: ResumePersonalSource | undefined,
  { street = true, postalCode = true }: ResumeAddressOptions = {},
) => {
  const place = [postalCode ? clean(profile?.postalCode) : "", clean(profile?.city)]
    .filter(Boolean)
    .join(" ");
  const locality = [place, clean(profile?.country)].filter(Boolean).join(", ");
  return [street ? clean(profile?.street) : "", locality].filter(Boolean);
};

/** One line: "Musterstraße 10, 12345 Stuttgart, Deutschland" (or "Stuttgart, Deutschland" for a short location). */
export const formatResumeAddress = (
  profile: ResumePersonalSource | undefined,
  options?: ResumeAddressOptions,
) => resumeAddressLines(profile, options).join(", ");

// --- Dates and birth ------------------------------------------------------------------------------------

/**
 * German date for the CV: "1990-11-25", "25/11/1990" and "5.3.1990" become "25.11.1990". Anything else (a legacy
 * free text such as "Mai 1990") is shown as the user wrote it; the stored value is never changed.
 */
export const formatGermanDate = (value: string | undefined) => {
  const text = clean(value);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const german = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  const [day, month, year] = iso
    ? [iso[3], iso[2], iso[1]]
    : german
      ? [german[1], german[2], german[3]]
      : [];
  return day && month && year
    ? `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`
    : text;
};

/**
 * "25.11.1990 in Gerze" (or "Geb. 25.11.1990 in Gerze" for a template that labels the line). Date only and
 * place only ("Geboren in Gerze") work too; with neither the result is empty.
 */
export const formatResumeBirth = (
  profile: ResumePersonalSource | undefined,
  { prefix = false }: { prefix?: boolean } = {},
) => {
  const date = formatGermanDate(profile?.birthDate);
  const place = clean(profile?.birthPlace);
  if (!date && !place) return "";
  // Only the place (the date is hidden or empty) needs its own words to be understood on its own.
  if (!date) return prefix ? `Geb. in ${place}` : `Geboren in ${place}`;
  const text = place ? `${date} in ${place}` : date;
  return prefix ? `Geb. ${text}` : text;
};

// --- Freiwillige Angaben --------------------------------------------------------------------------------

export const resumePersonalDetailKinds = ["nationality", "familyStatus", "children"] as const;
export type ResumePersonalDetailKind = (typeof resumePersonalDetailKinds)[number] | "onlineProfile";

export const resumePersonalDetailLabels: Record<(typeof resumePersonalDetailKinds)[number], string> = {
  nationality: "Staatsangehörigkeit",
  familyStatus: "Familienstand",
  children: "Kinder",
};

export type ResumePersonalDetail = {
  kind: ResumePersonalDetailKind;
  label: string;
  value: string;
  /** "Familienstand: ledig": for a template that draws one text per line. */
  text: string;
  /** Link target of an online profile (the complete URL); empty for the other details. */
  href: string;
};

/**
 * The online profiles (Xing, GitLab, Stack Overflow, any other professional URL) as "label + URL". The text is a
 * short readable form of the URL, the target is the complete one; a profile without a URL is not listed.
 */
export const getResumeOnlineProfiles = (
  profile: ResumePersonalSource | undefined,
): ResumePersonalDetail[] =>
  (profile?.onlineProfiles ?? []).flatMap((entry) => {
    const href = externalUrl(entry.url);
    if (!href) return [];
    const label = clean(entry.label);
    const value = formatUrlForDisplay(href);
    return [{ kind: "onlineProfile" as const, label, value, text: label ? `${label}: ${value}` : value, href }];
  });

/**
 * The professional links of the profile, every one on its own (LinkedIn, GitHub, Website = `portfolio`): a template
 * that has one slot for "the link" must not drop the others. Display text is the short URL, the target the full one.
 */
export type ResumeLinkKind = "linkedin" | "github" | "website";
export const getResumeLinkContacts = (
  profile: (ResumePersonalSource & { linkedin?: string; github?: string; portfolio?: string }) | undefined,
): Array<Omit<ResumePersonalDetail, "kind"> & { kind: ResumeLinkKind }> =>
  ([["linkedin", "LinkedIn", profile?.linkedin], ["github", "GitHub", profile?.github], ["website", "Website", profile?.portfolio]] as const).flatMap(
    ([kind, label, url]) => {
      const href = externalUrl(url);
      if (!href) return [];
      const value = formatUrlForDisplay(href);
      return [{ kind, label, value, text: `${label}: ${value}`, href }];
    },
  );

/**
 * The filled voluntary details in CV order (Staatsangehörigkeit, Familienstand, Kinder) followed by the online
 * profiles; an empty value is not listed. Visibility is applied before (`getResumeDisplayProfile`).
 */
export const getResumePersonalDetails = (
  profile: ResumePersonalSource | undefined,
): ResumePersonalDetail[] => [
  ...resumePersonalDetailKinds.flatMap((kind): ResumePersonalDetail[] => {
    const value = clean(profile?.[kind]);
    const label = resumePersonalDetailLabels[kind];
    return value ? [{ kind, label, value, text: `${label}: ${value}`, href: "" }] : [];
  }),
  ...getResumeOnlineProfiles(profile),
];

/** Controlled Familienstand choices; "" is "Keine Angabe". A legacy free text stays selectable. */
export const familyStatusOptions = ["Ledig", "Verheiratet", "Geschieden", "Verwitwet"] as const;

export const personalDataTitleOptions = [
  "Persönliche Daten",
  "Angaben zur Person",
  "Persönliche Angaben",
  "Über mich",
] as const;

// --- Pflichtangaben and validation ----------------------------------------------------------------------

export const personalRequiredFields = [
  "firstName",
  "lastName",
  "street",
  "postalCode",
  "city",
  "phone",
  "email",
] as const;
export type PersonalRequiredField = (typeof personalRequiredFields)[number];

export const personalRequiredFieldLabels: Record<PersonalRequiredField, string> = {
  firstName: "Vorname",
  lastName: "Nachname",
  street: "Straße und Hausnummer",
  postalCode: "PLZ",
  city: "Ort",
  phone: "Telefonnummer",
  email: "E-Mail-Adresse",
};

export const personalFieldMissingMessage = "Pflichtangabe fehlt";
export const invalidEmailMessage = "Bitte eine gültige E-Mail-Adresse eingeben.";

const emailSchema = z.email();
/** The same check the profile schema applies; an empty address is not an invalid one. */
export const isValidEmail = (value: string | undefined) =>
  !clean(value) || emailSchema.safeParse(clean(value)).success;

export type PersonalDataIssue = "missing" | "invalid";
export type PersonalDataIssues = Partial<Record<PersonalRequiredField, PersonalDataIssue>>;

/**
 * What the profile lacks for a complete CV header. This is a completeness check for the editor only: the
 * profile schema keeps accepting an older profile without address or phone, it just reports it here.
 */
export const getPersonalDataIssues = (
  profile: ResumePersonalSource | undefined,
): PersonalDataIssues => {
  const issues: PersonalDataIssues = {};
  for (const field of personalRequiredFields)
    if (!clean(profile?.[field])) issues[field] = "missing";
  if (!isValidEmail(profile?.email)) issues.email = "invalid";
  return issues;
};

/** What the profile schema cannot store: a missing name or an invalid e-mail address stops a save, nothing else does. */
export const getBlockingPersonalFields = (
  profile: ResumePersonalSource | undefined,
): PersonalRequiredField[] => {
  const issues = getPersonalDataIssues(profile);
  return (["firstName", "lastName", "email"] as const).filter((field) =>
    field === "email" ? issues.email === "invalid" : issues[field] === "missing",
  );
};

export const getMissingPersonalFields = (profile: ResumePersonalSource | undefined) =>
  personalRequiredFields.filter((field) => !clean(profile?.[field]));

export const isPersonalDataComplete = (profile: ResumePersonalSource | undefined) =>
  Object.keys(getPersonalDataIssues(profile)).length === 0;

/**
 * Every contact a CV header can carry, as the texts a template draws (phone, e-mail, the links, the address, the
 * birth and the voluntary details with their label). The page planner measures the header from these, so a header
 * that grows with the user's data never runs into the page content.
 */
export const getResumeHeaderContactTexts = (
  profile: (ResumePersonalSource & { linkedin?: string; github?: string; portfolio?: string }) | undefined,
) =>
  [
    formatPhoneForDisplay(profile?.phone),
    clean(profile?.email),
    ...getResumeLinkContacts(profile).map((link) => link.value),
    formatResumeAddress(profile),
    formatResumeBirth(profile),
    ...getResumePersonalDetails(profile).map((detail) => detail.text),
  ].filter(Boolean);

/**
 * The plain (ATS) "Persönliche Daten" paragraph: phone, e-mail, LinkedIn, location, birth and the voluntary
 * details on one line. Only filled values are listed, so there is never a separator or label for nothing.
 */
export const formatResumeContactLine = (
  profile: (ResumePersonalSource & { linkedin?: string; github?: string; portfolio?: string }) | undefined,
) =>
  [
    formatPhoneForDisplay(profile?.phone),
    clean(profile?.email),
    ...getResumeLinkContacts(profile).map((link) => link.value),
    formatResumeAddress(profile),
    formatResumeBirth(profile, { prefix: true }),
    ...getResumePersonalDetails(profile).map((detail) => detail.text),
  ]
    .filter(Boolean)
    .join(" · ");

export { externalUrl, formatPhoneForDisplay, phoneHref };
