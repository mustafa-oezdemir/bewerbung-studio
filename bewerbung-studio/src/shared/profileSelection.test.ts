import { describe, expect, it } from "vitest";
import { applicationSchema, profileSchema, type ApplicantProfile } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { setResumeHeading } from "./resumeHeading";
import { applyMainProfileToApplication, getMainProfileLinkLabel, getProfessionalTitle, resolveApplicationProfile, resolveSelectedProfile } from "./profileSelection";

const profile = (
  id: string,
  firstName: string,
  isDefault = false,
): ApplicantProfile =>
  ({ id, firstName, isDefault }) as ApplicantProfile;

describe("resolveSelectedProfile", () => {
  const defaultProfile = profile("default", "Standard", true);
  const applicationProfile = profile("application", "Bewerbung");
  const selectedProfile = profile("selected", "Ausgewählt");
  const profiles = [defaultProfile, applicationProfile, selectedProfile];

  it("uses the profile explicitly selected by the user", () => {
    expect(
      resolveSelectedProfile(profiles, selectedProfile.id, applicationProfile.id),
    ).toBe(selectedProfile);
  });

  it("falls back to the profile assigned to the application", () => {
    expect(resolveSelectedProfile(profiles, undefined, applicationProfile.id)).toBe(
      applicationProfile,
    );
  });

  it("falls back to the default profile for an unknown selection", () => {
    expect(resolveSelectedProfile(profiles, "missing", "also-missing")).toBe(
      defaultProfile,
    );
  });
});

describe("resolveApplicationProfile", () => {
  const defaultProfile = profile("default", "Standard", true);
  const linked = profile("linked", "Verknüpft");
  const profiles = [defaultProfile, linked];

  it("is the profile the application is linked to, whatever the profile editor has selected", () => {
    expect(resolveApplicationProfile(profiles, linked.id)).toBe(linked);
  });

  it("falls back to the default profile for a missing or deleted link, then to the first profile", () => {
    expect(resolveApplicationProfile(profiles, undefined)).toBe(defaultProfile);
    expect(resolveApplicationProfile(profiles, "deleted")).toBe(defaultProfile);
    expect(resolveApplicationProfile([linked], "deleted")).toBe(linked);
    expect(resolveApplicationProfile([], "deleted")).toBeUndefined();
  });

  it("is what the profile editor falls back to when it has no choice of its own", () => {
    expect(resolveSelectedProfile(profiles, undefined, linked.id)).toBe(resolveApplicationProfile(profiles, linked.id));
    expect(resolveSelectedProfile(profiles, "unknown", "deleted")).toBe(resolveApplicationProfile(profiles, "deleted"));
  });
});

describe("getProfessionalTitle", () => {
  it("is the trimmed title of the profile and nothing else", () => {
    expect(getProfessionalTitle({ title: "  Softwareentwickler | Fachinformatiker  " })).toBe("Softwareentwickler | Fachinformatiker");
    expect(getProfessionalTitle({ title: "" })).toBe("");
    expect(getProfessionalTitle(undefined)).toBe("");
  });
});

describe("getMainProfileLinkLabel", () => {
  const source = profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya",
    title: "Softwareentwicklerin", updatedAt: new Date().toISOString(),
  });

  it("shows the saved own heading ahead of the professional title, even when another mode is active", () => {
    const custom = setResumeHeading(source, { mode: "default", customTitle: "  Basis Lebenslauf  " });
    expect(getMainProfileLinkLabel(custom)).toBe("Mina Kaya · Basis Lebenslauf");
    expect(getMainProfileLinkLabel({ ...custom, profileLabel: "Kopie" }))
      .toBe("Mina Kaya · Basis Lebenslauf · Kopie");
  });

  it("keeps the profession as a fallback when there is no own heading", () => {
    expect(getMainProfileLinkLabel(source)).toBe("Mina Kaya · Softwareentwicklerin");
    expect(getMainProfileLinkLabel({ ...source, title: "" }))
      .toBe("Mina Kaya · Keine eigene Überschrift");
  });
});

describe("applyMainProfileToApplication", () => {
  it("replaces profile content while preserving document data and clearing obsolete entry selections", () => {
    const oldProject = crypto.randomUUID();
    const newProject = crypto.randomUUID();
    const oldSection = crypto.randomUUID();
    const newSection = crypto.randomUUID();
    const original = profileSchema.parse({ id: crypto.randomUUID(), isDefault: false, firstName: "Fiktiv", lastName: "Alt",
      updatedAt: "2026-10-01T10:00:00.000Z", summary: "Alte Daten", certifications: ["Altes Zertifikat"],
      specialSections: [{ id: oldSection, kind: "projects", title: "Alte Projekte", entries: [{ id: oldProject, title: "Alt" }] }] });
    const selected = profileSchema.parse({ id: crypto.randomUUID(), isDefault: false, firstName: "Fiktiv", lastName: "Neu",
      updatedAt: "2026-10-02T10:00:00.000Z", summary: "Neue Daten", skills: ["C#"], certifications: ["Neues Zertifikat"],
      specialSections: [{ id: newSection, kind: "projects", title: "Neue Projekte", entries: [{ id: newProject, title: "Neu" }] }] });
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId: "modern", accentColor: "#123456", secondaryColor: "#234567",
      designSettings: { ...defaultDocumentDesign, resumePresentation: {
        selectedProjectEntryIds: [oldProject], selectedCertificateIds: ["veraltetes-zertifikat"],
        selectedSpecialEntryIds: { [oldSection]: [oldProject] },
        sections: { [`special:${oldSection}`]: { visible: false }, summary: { title: "Alte Überschrift", visible: false, zone: "sidebar" } },
        layoutMode: "single",
      } },
      templateDesigns: { kompakt: { settings: { resumePresentation: { selectedProjectEntryIds: [oldProject] } } } },
      documents: { coverSubject: "Eigener Anschreibentext" }, profileId: original.id, profileSnapshot: original,
      statusHistory: [], createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z" });
    const transferred = applyMainProfileToApplication(application, [original, selected], selected.id);
    expect(transferred.profileSnapshot).toEqual(selected);
    expect(transferred.profileSnapshot).not.toBe(selected);
    expect(transferred.designSettings.resumePresentation).toMatchObject({ layoutMode: "single" });
    expect(transferred.designSettings.resumePresentation?.selectedProjectEntryIds).toBeUndefined();
    expect(transferred.designSettings.resumePresentation?.selectedCertificateIds).toBeUndefined();
    expect(transferred.designSettings.resumePresentation?.selectedSpecialEntryIds).toBeUndefined();
    expect(transferred.designSettings.resumePresentation?.sections?.summary).toEqual({ zone: "sidebar" });
    expect(transferred.templateDesigns.kompakt.settings.resumePresentation?.selectedProjectEntryIds).toBeUndefined();
    expect(transferred.documents).toEqual(application.documents);
    expect(transferred.accentColor).toBe(application.accentColor);
    expect(original.summary).toBe("Alte Daten");
    expect(selected.summary).toBe("Neue Daten");
  });
});
