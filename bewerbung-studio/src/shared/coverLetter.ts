import type { Application, Attachment, DocumentDraft } from "./schema";
import { getApplicationDocumentItems } from "./applicationDocuments";

export const getCoverLetterMainBody = (
  documents: Pick<
    DocumentDraft,
    "coverMainBody" | "coverMotivation" | "coverQualification"
  >,
) =>
  documents.coverMainBody.trim() ||
  [documents.coverMotivation, documents.coverQualification]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n\n");

/** Kreativ's preview and PDF use the same Bewerbung text, including empty-draft placeholders. */
export const resolveKreativCoverLetterParagraphs = (
  application: Pick<Application, "company" | "job">,
  documents: DocumentDraft,
) => ({
  introduction: documents.coverIntroduction ||
    `die ausgeschriebene Position als ${application.job.title} bei ${application.company.name} spricht mich besonders an, weil sie fachliche Verantwortung mit konkretem Gestaltungsspielraum verbindet.`,
  mainBody: getCoverLetterMainBody(documents) || "Hauptteil im Dokumenteditor ergänzen.",
  companyFit: documents.coverCompanyFit ||
    `An ${application.company.name} überzeugt mich besonders die Verbindung aus professionellem Anspruch und zukunftsorientierter Arbeitsweise.`,
  closing: documents.coverClosing ||
    "Gerne überzeuge ich Sie in einem persönlichen Gespräch davon, welchen konkreten Beitrag ich in Ihrem Team leisten kann. Auf Ihren Terminvorschlag freue ich mich.",
});

export const createCoverSubject = (jobTitle: string, current = "") => {
  const subject = current.trim();
  if (subject) {
    return subject.replace(/^(?:Bewerbung\s+als\s+){2,}/i, "Bewerbung als ");
  }
  const title = jobTitle.trim();
  return /^Bewerbung\b/i.test(title) ? title : `Bewerbung als ${title}`;
};

export const getCoverLetterAttachments = (
  attachments: readonly Attachment[],
  applicationId: string,
  settings: DocumentDraft["documentListSettings"] = [],
) =>
  getApplicationDocumentItems(attachments, applicationId, settings)
    .filter((item) => item.key !== "anschreiben" && item.isVisible)
    .map((item) => item.label);

export const coverLetterApplicantFileName = (
  application: Pick<Application, "company" | "createdAt" | "sentAt">,
  applicantName: string,
) => {
  const sanitize = (value: string) =>
    value
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");
  const safeApplicantName = sanitize(applicantName);
  const safeCompanyName = sanitize(application.company.name);
  return ["Anschreiben", safeApplicantName, safeCompanyName]
    .filter(Boolean)
    .join("_");
};

export type ApplicationDocumentKind =
  | "Anschreiben"
  | "Deckblatt"
  | "Lebenslauf"
  | "Mappe";

export const applicantDocumentFileName = (
  kind: ApplicationDocumentKind,
  application: Pick<Application, "company" | "createdAt" | "sentAt">,
  applicantName: string,
) =>
  coverLetterApplicantFileName(application, applicantName).replace(
    /^Anschreiben/,
    kind,
  );
