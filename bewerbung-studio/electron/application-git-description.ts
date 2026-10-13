import type { Application, ApplicationStatus, CalendarEventType } from "../src/shared/schema";
import type { ApplicationGitAction } from "./application-git-queue";

export type ApplicationGitChange = { action: ApplicationGitAction; details: string[] };
const changed = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);

/** The status as the commit names it: both "sent" states read "Bewerbung gesendet". */
export const statusCommitLabel = (status: ApplicationStatus) =>
  status === "Beworben" || status === "Gesendet" ? "Bewerbung gesendet" : status;

const calendarEventLabels: Record<CalendarEventType, string> = {
  "application-sent": "Bewerbungsdatum",
  "application-rejected": "Absage",
  "application-deadline": "Bewerbungsfrist",
  interview: "Vorstellungsgespräch",
  "second-interview": "Zweites Gespräch",
  "phone-interview": "Telefoninterview",
  "online-interview": "Online-Interview",
  "trial-work": "Probearbeit",
  assessment: "Assessment-Center",
  "follow-up-call": "Nachfassen",
  "follow-up-email": "Nachfassen",
  "contract-start": "Vertragsbeginn",
  "contract-end": "Vertragsende",
  "fixed-term-end": "Befristungsende",
  "probation-end": "Probezeitende",
  custom: "Termin",
};

/** The appointment as the commit names it (the event's own title may hold personal text and is never used). */
export const calendarEventCommitLabel = (type: CalendarEventType) => calendarEventLabels[type] ?? "Termin";

// Field labels follow the forms of the app (Termine: "Bewerbungsdatum", "Zweites Gespräch", …).
const applicationFields: Array<[keyof Application, ApplicationGitAction, string]> = [
  ["company", "update", "Firma"],
  ["contact", "update", "Kontakt"], ["additionalContacts", "update", "Kontakte"],
  ["notes", "update", "Notizen"], ["profileId", "update", "Profil"],
  ["sentAt", "update", "Bewerbungsdatum"], ["deadlineAt", "update", "Bewerbungsfrist"],
  ["interviewAt", "termin", "Vorstellungsgespräch"],
  ["secondInterviewAt", "termin", "Zweites Gespräch"],
  ["startAt", "termin", "Vertragsbeginn"], ["contractEndAt", "termin", "Vertragsende"],
  ["fixedTermEndAt", "termin", "Befristungsende"], ["probationEndAt", "termin", "Probezeitende"],
  ["templateId", "lebenslauf", "Vorlage"], ["templateDesigns", "lebenslauf", "Design"],
  ["accentColor", "lebenslauf", "Farben"], ["secondaryColor", "lebenslauf", "Farben"],
  ["attachmentIds", "anlagen", "Verknüpfungen"],
];

const jobLabels: Partial<Record<keyof Application["job"], string>> = {
  title: "Position",
  fullText: "Stellenanzeige",
};

// Saved Lebenslauf layout of the Bewerbung: section order/visibility, personal data, closing and layout are named on
// their own; every other design value (fonts, colours, spacing, overrides) is "Design".
const presentationLabels: Record<string, string> = {
  sections: "Abschnitte", blocks: "Abschnitte", showKnowledgeTitle: "Abschnitte",
  personalFields: "Persönliche Daten", closing: "Abschluss",
  selectedProjectEntryIds: "Projekte", selectedCertificateIds: "Zertifikate",
  layoutMode: "Layout", sidebarSide: "Layout", sidebarWidthPercent: "Layout",
};
const designLabels: Record<string, string> = { columnLayout: "Layout", metadataLayout: "Layout", metadataOrder: "Layout" };

const documentFields: Record<string, [ApplicationGitAction, string]> = {
  coverSenderName: ["anschreiben", "Absender"], coverSenderTitle: ["anschreiben", "Absender"],
  coverSenderContact: ["anschreiben", "Absender"], coverRecipientAddress: ["anschreiben", "Empfänger"],
  coverSubject: ["anschreiben", "Betreff"], coverSubjectGapReduction: ["anschreiben", "Layout"],
  coverGreeting: ["anschreiben", "Anrede"], coverIntroduction: ["anschreiben", "Einleitung"],
  coverMainBody: ["anschreiben", "Haupttext"], coverMotivation: ["anschreiben", "Motivation"],
  coverQualification: ["anschreiben", "Qualifikation"], coverCompanyFit: ["anschreiben", "Unternehmensbezug"],
  coverExtraParagraph: ["anschreiben", "Zusatzabsatz"], coverClosing: ["anschreiben", "Schluss"],
  coverSheetProfessionalTitle: ["deckblatt", "Berufsbezeichnung"], coverSheetDesign: ["deckblatt", "Layout"],
  coverSheetContactVisibility: ["deckblatt", "Kontakte"], deckblattStatement: ["deckblatt", "Text"],
  resumeProfile: ["lebenslauf", "Kurzprofil"], legacyResumeProfile: ["lebenslauf", "Kurzprofil"],
  motivationEnabled: ["motivation", "Aktivierung"], motivationHeading: ["motivation", "Überschrift"],
  motivationHeadingGapReduction: ["motivation", "Layout"],
  motivationIntroduction: ["motivation", "Einleitung"], motivationMainBody: ["motivation", "Haupttext"],
  motivationEvidence: ["motivation", "Erfahrung"], motivationGoals: ["motivation", "Ziele"],
  motivationClosing: ["motivation", "Schluss"],
  documentListSettings: ["anlagen", "Dokumentenliste"],
  emailSubject: ["update", "E-Mail"], emailMessage: ["update", "E-Mail"],
  emailAttachmentNote: ["update", "E-Mail"], emailAttachmentMode: ["update", "E-Mail"],
  emailPackageFileName: ["update", "E-Mail"], showCoverLetterAttachments: ["update", "E-Mail"],
};

const changedKeys = <T extends object>(before: T | undefined, after: T | undefined) =>
  [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
    .filter((key) => changed(before?.[key as keyof T], after?.[key as keyof T]));

/** Only field names and enum labels enter Git history; user-authored document text never does. */
export const describeApplicationChange = (before: Application, after: Application): ApplicationGitChange[] => {
  const groups = new Map<ApplicationGitAction, Set<string>>();
  const add = (action: ApplicationGitAction, label: string) => {
    const labels = groups.get(action) ?? new Set<string>();
    labels.add(label);
    groups.set(action, labels);
  };
  const covered = new Set<string>(["id", "schemaVersion", "folderName", "createdAt", "updatedAt", "documents",
    "job", "designSettings"]);
  for (const [field, action, label] of applicationFields) {
    covered.add(field);
    if (changed(before[field], after[field])) add(action, label);
  }
  for (const key of changedKeys(before.job, after.job))
    add("update", jobLabels[key as keyof Application["job"]] ?? "Stelle");
  for (const key of changedKeys(before.designSettings, after.designSettings)) {
    if (key !== "resumePresentation") {
      add("lebenslauf", designLabels[key] ?? "Design");
      continue;
    }
    for (const part of changedKeys(before.designSettings?.resumePresentation, after.designSettings?.resumePresentation))
      add("lebenslauf", presentationLabels[part] ?? "Design");
  }
  if (before.status !== after.status) add("status", statusCommitLabel(after.status));
  covered.add("status");
  for (const field of ["statusHistory", "rejectionAt", "rejectionReason", "acceptedAt", "withdrawnAt", "archivedAt"] as const)
    covered.add(field);
  for (const key of changedKeys(before.documents, after.documents)) {
    const [action, label] = documentFields[key] ?? ["update", "Dokumente"];
    add(action, label);
  }
  for (const key of Object.keys(after) as Array<keyof Application>)
    if (!covered.has(key) && changed(before[key], after[key])) add("update", "Weitere Angaben");
  return [...groups].map(([action, details]) => ({ action, details: [...details] }));
};
