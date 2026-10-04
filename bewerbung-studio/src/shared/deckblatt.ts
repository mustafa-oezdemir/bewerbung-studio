import type { ApplicantProfile, Application, Attachment } from "./schema";
import type { DocumentDraft } from "./schema";
import { getVisibleApplicationDocumentLabels } from "./applicationDocuments";

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
    `${application?.job.title ?? ""} ${application?.job.fullText ?? ""}`.toLocaleLowerCase(
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
) => getVisibleApplicationDocumentLabels(attachments, applicationId, settings);
