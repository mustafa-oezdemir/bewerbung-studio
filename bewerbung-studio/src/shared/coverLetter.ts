import type { Application, Attachment, DocumentDraft } from "./schema";
import { getApplicationDocumentItems } from "./applicationDocuments";
import { splitLetterParagraphs, type LetterSections } from "./letterText";

export const getCoverLetterMainBody = (
  documents: Pick<
    DocumentDraft,
    "coverMainBody" | "coverMotivation" | "coverQualification"
  >,
) => {
  const main = splitLetterParagraphs(documents.coverMainBody);
  const legacy = [documents.coverMotivation, documents.coverQualification].flatMap(splitLetterParagraphs);
  return [...main, ...legacy.filter((paragraph) => !main.includes(paragraph))].join("\n\n");
};

export const coverLetterSections = (documents: DocumentDraft): LetterSections => {
  const main = getCoverLetterMainBody(documents);
  return {
    introduction: splitLetterParagraphs(documents.coverIntroduction).join("\n\n"),
    mainBody: [main, splitLetterParagraphs(documents.coverExtraParagraph).join("\n\n")].filter(Boolean).join("\n\n"),
    companyFit: splitLetterParagraphs(documents.coverCompanyFit).join("\n\n"),
    closing: splitLetterParagraphs(documents.coverClosing).join("\n\n"),
  };
};

export const coverLetterSectionPatch = (sections: LetterSections): Partial<DocumentDraft> => ({
  coverIntroduction: sections.introduction,
  coverMainBody: sections.mainBody,
  coverCompanyFit: sections.companyFit,
  coverClosing: sections.closing,
  coverExtraParagraph: "",
  coverMotivation: "",
  coverQualification: "",
});

export const coverLetterBodyParagraphs = (sections: LetterSections) => [
  ...[sections.introduction, sections.mainBody, sections.companyFit]
    .flatMap(splitLetterParagraphs).map((text) => ({ text, closing: false })),
  ...splitLetterParagraphs(sections.closing).map((text) => ({ text, closing: true })),
];

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
  includeMotivation = false,
) =>
  getApplicationDocumentItems(attachments, applicationId, settings, includeMotivation)
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
  | "Motivation"
  | "Lebenslauf"
  | "Bewerbungsunterlagen"
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
