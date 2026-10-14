import { describe, expect, it } from "vitest";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { applicationSchema } from "../src/shared/schema";
import { calendarEventCommitLabel, describeApplicationChange, statusCommitLabel } from "./application-git-description";

const application = applicationSchema.parse({
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000001", folderName: "Muster_GmbH",
  company: { name: "Muster GmbH", street: "", postalCode: "10115", city: "Berlin", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: "Entwicklerin", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid",
    contractType: "Unbefristet", salaryExpectation: "" },
  status: "Entwurf", templateId: "modern", accentColor: "#155e58", designSettings: defaultDocumentDesign,
  documents: {}, statusHistory: [], createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z",
});

describe("application Git descriptions", () => {
  it("names only changed fields across Bewerbung, documents and dates", () => {
    const after = structuredClone(application);
    after.notes = "Privater langer Bewerbungstext";
    after.sentAt = "2026-10-12T12:00:00.000Z";
    after.interviewAt = "2026-10-19T09:00:00.000Z";
    after.documents.coverMainBody = "Vertrauliches Anschreiben";
    after.documents.deckblattStatement = "Vertrauliches Deckblatt";
    after.documents.motivationIntroduction = "Vertrauliche Motivation";
    after.documents.resumeProfile = "Vertraulicher Lebenslauf";
    expect(describeApplicationChange(application, after)).toEqual([
      { action: "update", details: ["Notizen", "Bewerbungsdatum"] },
      { action: "termin", details: ["Vorstellungsgespräch"] },
      { action: "anschreiben", details: ["Haupttext"] },
      { action: "lebenslauf", details: ["Kurzprofil"] },
      { action: "deckblatt", details: ["Text"] },
      { action: "motivation", details: ["Einleitung"] },
    ]);
    expect(JSON.stringify(describeApplicationChange(application, after))).not.toContain("Vertraulich");
  });

  it("ignores timestamps and unchanged values", () => {
    expect(describeApplicationChange(application, { ...application, updatedAt: "2026-10-12T11:00:00.000Z" }))
      .toEqual([]);
  });

  it("labels saved CV template and design changes without serializing settings", () => {
    const after = { ...application, templateId: "zweispaltig",
      designSettings: { ...application.designSettings, fontId: "georgia" as const } };
    expect(describeApplicationChange(application, after)).toEqual([{ action: "lebenslauf", details: ["Vorlage", "Design"] }]);
  });

  it("names saved Lebenslauf sections, layout and selections separately from the design", () => {
    const after = structuredClone(application);
    after.designSettings.resumePresentation = {
      sections: { experience: { order: 2, visible: false } },
      layoutMode: "two-column",
      selectedCertificateIds: [],
      personalFields: { familyStatus: false },
    };
    after.designSettings.columnLayout = application.designSettings.columnLayout;
    expect(describeApplicationChange(application, after))
      .toEqual([{ action: "lebenslauf", details: ["Abschnitte", "Layout", "Zertifikate", "Persönliche Daten"] }]);
  });

  it("names position, job advert, status and appointments like the forms", () => {
    const after = structuredClone(application);
    after.job.title = "Architektin";
    after.job.fullText = "Lange vertrauliche Stellenanzeige";
    after.status = "Beworben";
    after.secondInterviewAt = "2026-10-22T09:00:00.000Z";
    const changes = describeApplicationChange(application, after);
    expect(changes).toEqual([
      { action: "termin", details: ["Zweites Gespräch"] },
      { action: "update", details: ["Position", "Stellenanzeige"] },
      { action: "status", details: ["Bewerbung gesendet"] },
    ]);
    expect(JSON.stringify(changes)).not.toContain("vertraulich");
    expect(statusCommitLabel("Vorstellungsgespräch")).toBe("Vorstellungsgespräch");
    expect(calendarEventCommitLabel("follow-up-call")).toBe("Nachfassen");
  });

  it("labels both advertisement sections without including their text", () => {
    const after = structuredClone(application);
    after.job.tasksText = "Vertrauliche Aufgabenbeschreibung";
    after.job.requirementsText = "Vertrauliche Anforderungen";
    const changes = describeApplicationChange(application, after);
    expect(changes).toEqual([{ action: "update", details: ["Aufgaben", "Anforderungen"] }]);
    expect(JSON.stringify(changes)).not.toContain("Vertrauliche");
  });
});
