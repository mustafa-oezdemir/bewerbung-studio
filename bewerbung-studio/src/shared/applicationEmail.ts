import { formatApplicationDate } from "./applicationDate";
import { applicationGreeting } from "./applicationContacts";
import { createCoverSubject } from "./coverLetter";
import type { ApplicantProfile, Application, DocumentDraft } from "./schema";

const contactName = (contact: Application["contact"]) =>
  [contact.salutation, contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ");

export const defaultApplicationEmail = (
  application: Pick<Application, "company" | "job">,
) => ({
  emailSubject: createCoverSubject(application.job.title),

  emailMessage: `anbei übersende ich Ihnen meine Bewerbung für die ausgeschriebene Position als ${application.job.title.replace(
    /^Bewerbung\s+als\s+/i,
    "",
  )} bei ${application.company.name}.`,

  emailGreeting: "Mit freundlichen Grüßen",
});

export const resolveApplicationEmailAttachments = (
  documents: Pick<
    DocumentDraft,
    "emailAttachmentMode" | "emailPackageFileName"
  >,
  visibleDocuments: readonly string[],
) =>
  documents.emailAttachmentMode === "package"
    ? [documents.emailPackageFileName.trim() || "Bewerbungsunterlagen.pdf"]
    : visibleDocuments.map((item) =>
        /\.pdf$/i.test(item) ? item : `${item}.pdf`,
      );

export const validateEmailClosingDuplication = (
  message: string,
  closing = "",
) => {
  const combined = `${message} ${closing}`.toLocaleLowerCase("de-DE");

  const personalPhrase = "persönlich(?:e|en|es|em|er)?";

  const hasExchange = new RegExp(`${personalPhrase}\\s+austausch`).test(
    combined,
  );

  const conversationMatches =
    combined.match(new RegExp(`${personalPhrase}\\s+gespräch`, "g"))?.length ??
    0;

  if (hasExchange && conversationMatches) {
    return [
      "Die Abschlussformulierung wiederholt den Wunsch nach einem persönlichen Austausch/Gespräch.",
    ];
  }

  if (conversationMatches > 1) {
    return ["Die Formulierung zum persönlichen Gespräch kommt mehrfach vor."];
  }

  return [];
};

export const getApplicationEmail = (
  application: Pick<
    Application,
    | "additionalContacts"
    | "company"
    | "contact"
    | "createdAt"
    | "documents"
    | "job"
    | "sentAt"
  >,
  profile?: Pick<ApplicantProfile, "firstName" | "lastName" | "email">,
  attachments: readonly string[] = [],
) => {
  const defaults = defaultApplicationEmail(application);

  const recipient =
    [application.contact, ...application.additionalContacts].find((contact) =>
      Boolean(contact.email || contact.firstName || contact.lastName),
    ) ?? application.contact;

  const message =
    application.documents.emailMessage?.trim() || defaults.emailMessage;
  const greeting = defaults.emailGreeting;

  const resolvedAttachments = Array.from(
    new Set(attachments.map((item) => item.trim()).filter(Boolean)),
  );

  return {
    applicationDate: formatApplicationDate(application),

    companyName: application.company.name,
    jobTitle: application.job.title,

    recipientName: contactName(recipient),
    recipientEmail: recipient.email,

    senderName: profile
      ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
      : "",

    senderEmail: profile?.email ?? "",

    subject: createCoverSubject(
      application.job.title,
      application.documents.emailSubject || defaults.emailSubject,
    ),

    salutation: applicationGreeting(application),

    message,
    body: message,

    greeting,

    attachments: resolvedAttachments,

    warnings: validateEmailClosingDuplication(message),
  };
};

export const buildApplicationEmailMarkdown = (
  application: Parameters<typeof getApplicationEmail>[0],
  profile?: Parameters<typeof getApplicationEmail>[1],
  attachments: Parameters<typeof getApplicationEmail>[2] = [],
) => {
  const email = getApplicationEmail(application, profile, attachments);

  const header = [
    "# Bewerbungs-E-Mail",
    "",
    `- Bewerbungsdatum: ${email.applicationDate}`,
    `- Firma: ${email.companyName}`,
    `- Stellenbezeichnung: ${email.jobTitle}`,
    `- Empfänger: ${email.recipientName || "Nicht angegeben"}`,
    `- E-Mail-Adresse: ${email.recipientEmail || "Nicht angegeben"}`,
    `- Absender: ${email.senderName || "Nicht angegeben"}`,
    `- Absender-E-Mail: ${email.senderEmail || "Nicht angegeben"}`,
    `- Betreff: ${email.subject}`,
  ];

  const message = [
    "",
    "## Nachricht",
    "",
    email.salutation,
    "",
    email.body,
    "",
    email.greeting,
    "",
    email.senderName,
  ];

  const attachmentSection = email.attachments.length
    ? [
        "## Anlagen",
        "",
        ...email.attachments.map((attachment) => `- ${attachment}`),
      ]
    : [];

  return [...header, ...message, ...attachmentSection, ""].join("\n");
};
