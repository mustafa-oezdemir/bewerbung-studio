import {
  applicationGreeting, applicationPostalContactLines, applicationRecipientLines, contactFullName, fallbackGreeting,
} from "./applicationContacts";
import { createCoverSubject } from "./coverLetter";
import type { Application, DocumentDraft } from "./schema";

/**
 * The Anschreiben's Empfänger, Betreff and Anrede follow the Bewerbung's data (Unternehmen & Position, Ansprechpartner)
 * like the Motivationsschreiben's Anrede does: a stored value is only the user's own text. Every reader (preview, PDF,
 * DOCX, Markdown, Deckblatt) takes the letter through `resolveCoverLetterDocuments`, every save through
 * `storeCoverLetterDocuments`.
 */
type LetterSource = Pick<Application, "company" | "job" | "contact" | "additionalContacts">;

export type CoverLetterBasis = NonNullable<DocumentDraft["coverLetterBasis"]>;

type HeaderDocuments = Pick<DocumentDraft, "coverRecipientAddress" | "coverSubject" | "coverGreeting" | "coverIntroduction" | "coverLetterBasis">;

/** The values the Bewerbung's data gives the letter head. */
export const coverLetterAuto = (application: LetterSource): CoverLetterBasis => ({
  recipient: applicationRecipientLines(application).join("\n"),
  subject: createCoverSubject(application.job.title),
  greeting: applicationGreeting(application),
});

/** The Einleitung a new Bewerbung starts with. */
export const defaultCoverIntroduction = (application: Pick<Application, "company" | "job">) =>
  `die Position als ${application.job.title} bei ${application.company.name} verbindet genau die Aufgaben, in denen ich meine Erfahrung gezielt einbringen möchte.`;

const defaultIntroductionPattern = /^die Position als .+ bei .+ verbindet genau die Aufgaben, in denen ich meine Erfahrung gezielt einbringen möchte\.$/;

const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
const lines = (value: string) => value.split(/\r?\n/).map(normalize).filter(Boolean);
const same = (left: string, right: string) => normalize(left) === normalize(right);

/** `phrase` stands in `text` as whole words (case and spacing ignored). */
const mentions = (text: string, phrase: string) => {
  const needle = normalize(phrase);
  if (!needle) return false;
  const haystack = normalize(text);
  for (let index = haystack.indexOf(needle); index >= 0; index = haystack.indexOf(needle, index + 1)) {
    const before = haystack.slice(0, index).at(-1) ?? "";
    const after = haystack.charAt(index + needle.length);
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
  }
  return false;
};

const postalContactLine = /^(herrn|frau) \S/;

/**
 * An Empfänger text fits the data when it names the Unternehmen (also shortened or longer), its Postleitzahl and
 * exactly the Ansprechpartner; street spellings and extra lines (Personalabteilung) are the user's.
 */
const recipientFits = (stored: string, application: LetterSource) => {
  const present = lines(stored);
  const company = application.company.name.trim();
  const postalCode = application.company.postalCode.trim();
  const contacts = applicationPostalContactLines(application).map(normalize);
  return (!company || present.some((line) => mentions(line, company) || mentions(company, line)))
    && (!postalCode || mentions(stored, postalCode))
    && contacts.every((line) => present.includes(line))
    && present.every((line) => !postalContactLine.test(line) || contacts.includes(line));
};

/** A Betreff fits the data when it names the Stellenbezeichnung. */
const subjectFits = (stored: string, application: LetterSource) =>
  !application.job.title.trim() || mentions(stored, application.job.title);

const generatedGreetingPart = /^(?:sehr geehrte frau|sehr geehrter herr|guten tag) (.+)$/i;

const greetingParts = (greeting: string) =>
  greeting.trim().replace(/,$/, "").split(/,\s*/).map((part) => part.trim()).filter(Boolean);

/**
 * An Anrede fits the data when it addresses the Ansprechpartner. One built like the automatic Anrede (or the fallback)
 * must name exactly them; an own wording (»Liebes Recruiting-Team«) only must not miss every one of them.
 */
const greetingFits = (stored: string, application: LetterSource) => {
  const contacts = [application.contact, ...application.additionalContacts].filter((contact) => contactFullName(contact));
  if (same(stored, fallbackGreeting) || same(`${stored},`, fallbackGreeting)) return !contacts.length;
  const named = greetingParts(stored).map((part) => generatedGreetingPart.exec(part)?.[1]);
  if (named.length && named.every(Boolean)) {
    const addresses = (name: string) => contacts.some((contact) =>
      (contact.lastName && mentions(name, contact.lastName)) || mentions(name, contactFullName(contact)));
    return named.every((name) => addresses(name!))
      && contacts.every((contact) => mentions(stored, contact.lastName || contactFullName(contact)));
  }
  return !contacts.length || contacts.some((contact) =>
    [contact.lastName, contact.firstName].some((name) => name && mentions(stored, name)));
};

/** The Stellenbezeichnung an automatic Betreff was made of. */
const subjectTitle = (subject: string) => subject.trim().replace(/^Bewerbung\s+als\s+/i, "");

/** The names an automatic Anrede addresses. */
const greetingNames = (greeting: string) =>
  greetingParts(greeting).map((part) => generatedGreetingPart.exec(part)?.[1] ?? "").filter(Boolean);

/**
 * Whether an own text still carries data the Bewerbung no longer has: an address line, Stellenbezeichnung or
 * Ansprechpartner of the automatic value it was written next to (`basis`) that the current one dropped.
 */
const carriesOldData = {
  recipient: (stored: string, basis: string, auto: string) =>
    lines(basis).some((line) => !lines(auto).includes(line) && lines(stored).includes(line)),
  subject: (stored: string, basis: string, auto: string) => {
    const before = subjectTitle(basis);
    const now = subjectTitle(auto);
    return Boolean(before) && mentions(stored, before) && !mentions(now, before);
  },
  greeting: (stored: string, basis: string, auto: string) =>
    greetingNames(basis).some((name) => mentions(stored, name) && !mentions(auto, name)),
};

/**
 * Whether a stored head value is the user's text for this data. Written against the same data (`basis`): kept.
 * Written for data that changed since: kept unless it carries the old data or no longer fits. Written by an older
 * version (no basis, e.g. an automatic value saved as text and carried into a copy): kept while it fits.
 */
const keeps = (field: keyof typeof carriesOldData, stored: string, auto: string, basis: string | undefined, fits: () => boolean) => {
  if (!stored.trim() || same(stored, auto)) return false;
  if (basis !== undefined && same(basis, auto)) return true;
  if (basis !== undefined && carriesOldData[field](stored, basis, auto)) return false;
  return fits();
};

/**
 * The letter as it is printed for the Bewerbung's current data: Empfänger, Betreff and Anrede the user's text where it
 * still belongs to this data, else the automatic values; the generated Einleitung of a new Bewerbung follows
 * Unternehmen and Position. The result is in sync, so its basis is the current data.
 */
export const resolveCoverLetterDocuments = <T extends HeaderDocuments>(application: LetterSource, documents: T): T => {
  const auto = coverLetterAuto(application);
  const basis = documents.coverLetterBasis;
  const recipient = documents.coverRecipientAddress ?? "";
  const subject = documents.coverSubject ?? "";
  const greeting = documents.coverGreeting ?? "";
  const introduction = documents.coverIntroduction ?? "";
  return {
    ...documents,
    coverRecipientAddress: keeps("recipient", recipient, auto.recipient, basis?.recipient, () => recipientFits(recipient, application)) ? recipient : auto.recipient,
    coverSubject: keeps("subject", subject, auto.subject, basis?.subject, () => subjectFits(subject, application))
      ? createCoverSubject(application.job.title, subject) : auto.subject,
    coverGreeting: keeps("greeting", greeting, auto.greeting, basis?.greeting, () => greetingFits(greeting, application)) ? greeting : auto.greeting,
    coverIntroduction: defaultIntroductionPattern.test(introduction.trim()) ? defaultCoverIntroduction(application) : introduction,
    coverLetterBasis: auto,
  };
};

/**
 * The letter as it is saved: a head value equal to the automatic one is stored empty (it keeps following the data);
 * an own text is stored with the data it was written for.
 */
export const storeCoverLetterDocuments = <T extends HeaderDocuments>(application: LetterSource, documents: T): T => {
  const auto = coverLetterAuto(application);
  const own = (value: string | undefined, automatic: string) => (value?.trim() && !same(value, automatic) ? value : "");
  const stored = {
    ...documents,
    coverRecipientAddress: own(documents.coverRecipientAddress, auto.recipient),
    coverSubject: own(documents.coverSubject, auto.subject),
    coverGreeting: own(documents.coverGreeting, auto.greeting),
  };
  const { coverLetterBasis: _basis, ...rest } = stored;
  return (stored.coverRecipientAddress || stored.coverSubject || stored.coverGreeting
    ? { ...rest, coverLetterBasis: auto } : rest) as T;
};
