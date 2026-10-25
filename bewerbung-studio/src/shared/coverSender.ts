import type { ApplicantProfile, DocumentDraft } from "./schema";
import { getProfessionalTitle } from "./profileSelection";

/**
 * The sender block of the Anschreiben. Name, title and contact line come from the profile of the application;
 * the fields of the document draft only hold what the user typed on purpose, never a copy of the profile.
 */
export type CoverSender = { name: string; title: string; contact: string };

export const senderContactLine = (profile: ApplicantProfile | undefined) =>
  profile
    ? [profile.street, `${profile.postalCode} ${profile.city}`.trim(), profile.email, profile.phone]
        .filter(Boolean)
        .join(" | ")
    : "";

/** What the profile alone yields for the sender block. */
export const coverSenderFromProfile = (profile: ApplicantProfile | undefined): CoverSender => ({
  name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Vorname Nachname",
  title: getProfessionalTitle(profile),
  contact: profile ? senderContactLine(profile) : "E-Mail · Telefon",
});

type SenderOverrides = Pick<DocumentDraft, "coverSenderName" | "coverSenderTitle" | "coverSenderContact">;

export const resolveCoverSender = (
  profile: ApplicantProfile | undefined,
  documents: SenderOverrides,
): CoverSender => {
  const derived = coverSenderFromProfile(profile);
  return {
    name: documents.coverSenderName.trim() || derived.name,
    title: documents.coverSenderTitle.trim() || derived.title,
    contact: documents.coverSenderContact.trim() || derived.contact,
  };
};

/** Keeps what differs from the profile: a value equal to the profile's own is not an override. */
export const keepCoverSenderOverrides = (
  typed: CoverSender,
  profile: ApplicantProfile | undefined,
): SenderOverrides => {
  const derived = coverSenderFromProfile(profile);
  const keep = (value: string, own: string) => (value.trim() === own.trim() ? "" : value);
  return {
    coverSenderName: keep(typed.name, derived.name),
    coverSenderTitle: keep(typed.title, derived.title),
    coverSenderContact: keep(typed.contact, derived.contact),
  };
};

/** Fields of the document draft that only ever held a copy of profile data. */
export const profileDerivedDocumentFields = [
  "coverSenderName",
  "coverSenderTitle",
  "coverSenderContact",
  "coverSheetProfessionalTitle",
] as const;

/** An application that moves to another profile must not keep the old profile's sender and title. */
export const clearProfileDerivedDocumentFields = (documents: DocumentDraft): DocumentDraft => ({
  ...documents,
  ...Object.fromEntries(profileDerivedDocumentFields.map((field) => [field, ""])),
});

const derivedValues = (profile: ApplicantProfile) => {
  const sender = coverSenderFromProfile(profile);
  return {
    coverSenderName: sender.name,
    coverSenderTitle: sender.title,
    coverSenderContact: sender.contact,
    coverSheetProfessionalTitle: sender.title,
  };
};

/**
 * Drops saved copies of another profile's data: a value that equals what a different profile would print, and
 * not what the profile of the application prints, is a leftover of an earlier profile choice.
 */
export const dropStaleProfileCopies = (
  documents: DocumentDraft,
  profile: ApplicantProfile | undefined,
  otherProfiles: ApplicantProfile[],
): DocumentDraft => {
  const own = profile ? derivedValues(profile) : undefined;
  const others = otherProfiles.filter((other) => other.id !== profile?.id).map(derivedValues);
  const next = { ...documents };
  for (const field of profileDerivedDocumentFields) {
    const value = documents[field].trim();
    if (!value || value === own?.[field]?.trim()) continue;
    if (others.some((other) => other[field].trim() === value)) next[field] = "";
  }
  return next;
};
