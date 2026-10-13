import { describe, expect, it } from "vitest";
import {
  certificateEntries, certificateFields, legacyCertificateId, parseCertificate, parseCertificateLines, selectCertificateEntries,
} from "./certificates";
import { normalizeApplicantProfileForSave } from "./profileEditor";
import { keepResumeLayoutOverrides } from "./resumePresentation";
import { applicationSchema, profileSchema } from "./schema";
import { resumePresentationSchema } from "./resumePresentationSchema";

const now = "2026-10-10T09:00:00.000Z";
// Fictional certificates only.
const legacyProfile = profileSchema.parse({
  id: "f1000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Lena", lastName: "Beispiel", updatedAt: now,
  certifications: ["01/2026 · Fiktiver Kurs A · Akademie Nord", "02/2026 · Fiktiver Kurs B · Akademie Süd", "01/2026 · Fiktiver Kurs A · Akademie Nord"],
});

describe("certificate ids", () => {
  it("opens older profiles unchanged and gives their certificates stable, unique ids", () => {
    expect(legacyProfile.certifications).toHaveLength(3);
    expect(legacyProfile.certificationIds).toBeUndefined();
    const first = certificateEntries(legacyProfile);
    expect(first.map((entry) => entry.id)).toEqual(certificateEntries(legacyProfile).map((entry) => entry.id));
    expect(new Set(first.map((entry) => entry.id)).size).toBe(3);
    expect(first[0].id).toBe(legacyCertificateId("01/2026 · Fiktiver Kurs A · Akademie Nord"));
    expect(first[2].id).toBe(legacyCertificateId("01/2026 · Fiktiver Kurs A · Akademie Nord", 1));
  });

  it("keeps a certificate's id when its text is edited, the list reordered or an empty row dropped on save", () => {
    const [a, b] = certificateEntries(legacyProfile);
    const edited = certificateFields([{ ...b, text: "02/2026 · Umbenannter Kurs B · Akademie Süd" }, { id: "cert-empty", text: "  " }, a]);
    const saved = normalizeApplicantProfileForSave({ ...legacyProfile, ...edited });
    expect(saved.certifications).toEqual(["02/2026 · Umbenannter Kurs B · Akademie Süd", "01/2026 · Fiktiver Kurs A · Akademie Nord"]);
    expect(saved.certificationIds).toEqual([b.id, a.id]);
    // After the save the ids are part of the record and no longer depend on the text.
    expect(certificateEntries(saved).map((entry) => entry.id)).toEqual([b.id, a.id]);
    expect(profileSchema.parse(saved).certificationIds).toEqual([b.id, a.id]);
  });

  it("selects: absent = all in the profile's order, a list = those in its order, [] = none, unknown ids ignored", () => {
    const entries = certificateEntries(legacyProfile);
    expect(selectCertificateEntries(entries, undefined)).toEqual(entries);
    expect(selectCertificateEntries(entries, [entries[1].id])).toEqual([entries[1]]);
    expect(selectCertificateEntries(entries, [entries[2].id, entries[0].id, "cert-geloescht", entries[2].id])).toEqual([entries[2], entries[0]]);
    expect(selectCertificateEntries(entries, [])).toEqual([]);
  });

  it("stores the choice per Bewerbung and keeps it through section edits", () => {
    const presentation = resumePresentationSchema.parse({ selectedCertificateIds: ["cert-a", "cert-b"] });
    expect(presentation.selectedCertificateIds).toEqual(["cert-a", "cert-b"]);
    expect(keepResumeLayoutOverrides({ sections: {} }, presentation).selectedCertificateIds).toEqual(["cert-a", "cert-b"]);
    const legacyApplication = applicationSchema.parse({
      schemaVersion: 1, id: "f1000000-0000-4000-8000-000000000002", folderName: "Alt", company: { name: "Alt GmbH", city: "Kassel" },
      contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern", accentColor: "#123456", secondaryColor: "#234567",
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    expect(legacyApplication.designSettings.resumePresentation?.selectedCertificateIds).toBeUndefined();
  });
});

describe("certificate lines pasted into the Profil", () => {
  it("reads one certificate per line in both formats and skips duplicates and existing ones", () => {
    const lines = parseCertificateLines([
      "03/2026 · Fiktiver Kurs C · Akademie West",
      "Fiktiver Kurs D | Akademie Ost | 04/2026",
      "- 05/2026 · Fiktiver Kurs E · Akademie Mitte",
      "",
      "03/2026 · Fiktiver Kurs C · Akademie West",
      "01/2026 · Fiktiver Kurs A · Akademie Nord",
    ].join("\n"), legacyProfile.certifications);
    expect(lines).toEqual([
      "03/2026 · Fiktiver Kurs C · Akademie West",
      "04/2026 · Fiktiver Kurs D · Akademie Ost",
      "05/2026 · Fiktiver Kurs E · Akademie Mitte",
    ]);
    expect(parseCertificate(lines[1])).toEqual({ date: "04/2026", title: "Fiktiver Kurs D", provider: "Akademie Ost" });
  });
});
