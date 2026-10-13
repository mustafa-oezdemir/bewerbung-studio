import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { certificateEntries } from "../shared/certificates";
import { resolveCvDocument } from "../shared/resolveCvDocument";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { templates } from "../shared/templates";
import { DocumentsView } from "./DocumentsView";
import { ResumeSectionsPanel } from "../components/resume/ResumeSectionsPanel";
import { CertificateSelection } from "../components/resume/CertificateSelection";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

const now = "2026-10-10T09:00:00.000Z";
// Fictional certificates only (no real person's data).
const titles = ["Fiktives Cloud-Zertifikat", "Erdachter Datenkurs", "Musterkurs Sicherheit", "Beispielkurs Agile", "Testzertifikat Netzwerke"];
const certificateText = (title: string, index: number) => `0${(index % 9) + 1}/2026 · ${title} · Akademie Nord`;
const profileWith = (certifications: string[]) => profileSchema.parse({
  id: "e1000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Lena", lastName: "Beispiel",
  title: "Entwicklerin", city: "Kassel", email: "lena@example.test", updatedAt: now,
  certifications,
  resumeSectionTitles: { certifications: "Nachweise und Kurse" },
});
const profile = profileWith(titles.map(certificateText));
const ids = certificateEntries(profile).map((entry) => entry.id);
const applicationFor = (templateId: string, selectedCertificateIds?: string[], current = profile) => applicationSchema.parse({
  schemaVersion: 1, id: "e1000000-0000-4000-8000-000000000002", profileId: current.id, folderName: "Fiktiv",
  company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf",
  templateId, accentColor: "#123456", secondaryColor: "#e6eef5",
  designSettings: { ...getTemplateDocumentDesignDefaults(templateId),
    ...(selectedCertificateIds ? { resumePresentation: { selectedCertificateIds } } : {}) },
  documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});

/** The certificate titles in the order a text shows them. */
const shownTitles = (text: string, candidates = titles) =>
  candidates.filter((title) => text.includes(title)).sort((left, right) => text.indexOf(left) - text.indexOf(right));
const previewText = (application: ReturnType<typeof applicationFor>, current = profile) => {
  const previous = testStore.state;
  try {
    testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [current], events: [],
      attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
    const document = parseHTML(`<html><body>${renderToStaticMarkup(createElement(DocumentsView, { initialTab: "lebenslauf" }))}</body></html>`).document;
    return [...document.querySelectorAll(".document-lebenslauf")].map((page) => page.textContent ?? "").join("\n");
  } finally {
    testStore.state = previous;
  }
};
const pdfText = (application: ReturnType<typeof applicationFor>, current = profile) =>
  parseHTML(buildDocumentHtml(application, current, "lebenslauf")).document.body.textContent ?? "";

describe("Lebenslauf: Zertifikate einzeln auswählen", () => {
  it.each(templates.map((template) => template.id))("%s: preview and PDF show exactly the chosen certificates in the chosen order", (templateId) => {
    // Without a choice: every certificate, in the profile's order (the behaviour before the selection existed).
    for (const text of [previewText(applicationFor(templateId)), pdfText(applicationFor(templateId))]) {
      expect(shownTitles(text)).toEqual(titles);
    }
    // One certificate.
    const single = applicationFor(templateId, [ids[3]]);
    expect(shownTitles(previewText(single))).toEqual([titles[3]]);
    expect(shownTitles(pdfText(single))).toEqual([titles[3]]);
    // Several, in an order of their own.
    const several = applicationFor(templateId, [ids[4], ids[0], ids[2]]);
    for (const text of [previewText(several), pdfText(several)]) {
      expect(shownTitles(text)).toEqual([titles[4], titles[0], titles[2]]);
      expect(text).toMatch(/Nachweise und Kurse/i);
    }
    // Nothing chosen: neither certificates nor an empty heading.
    const none = applicationFor(templateId, []);
    for (const text of [previewText(none), pdfText(none)]) {
      expect(shownTitles(text)).toEqual([]);
      expect(text).not.toMatch(/Nachweise und Kurse/i);
    }
  });

  it.each(templates.map((template) => template.id))("%s: a long chosen list is printed completely, nothing is cut", (templateId) => {
    const many = Array.from({ length: 16 }, (_, index) => `Erfundenes Zertifikat Nummer ${index + 1}`);
    const longProfile = profileWith(many.map(certificateText));
    const longIds = certificateEntries(longProfile).map((entry) => entry.id);
    const chosen = [...longIds.slice(2, 14)].reverse();
    const expected = [...many.slice(2, 14)].reverse();
    const application = applicationFor(templateId, chosen, longProfile);
    // "Nummer 1" is a prefix of "Nummer 10"…: match whole titles only.
    const exact = (text: string) => many.filter((title) => new RegExp(`${title}(?!\\d)`).test(text))
      .sort((left, right) => text.search(new RegExp(`${left}(?!\\d)`)) - text.search(new RegExp(`${right}(?!\\d)`)));
    expect(exact(pdfText(application, longProfile))).toEqual(expected);
    expect(exact(previewText(application, longProfile))).toEqual(expected);
    // The page plan measures only the chosen certificates.
    const plan = resolveCvDocument({ profile: longProfile, templateId, settings: application.designSettings }).profile;
    expect(plan?.certifications.map((text) => text.replace(/^\d{2}\/2026 · | · Akademie Nord$/g, ""))).toEqual(expected);
  });

  it("keeps each Bewerbung's choice to itself and every certificate in the profile", () => {
    const first = resolveCvDocument({ profile, templateId: "modern", settings: applicationFor("modern", [ids[1]]).designSettings });
    const second = resolveCvDocument({ profile, templateId: "modern", settings: applicationFor("modern", [ids[2], ids[0]]).designSettings });
    expect(first.profile?.certifications).toEqual([profile.certifications[1]]);
    expect(second.profile?.certifications).toEqual([profile.certifications[2], profile.certifications[0]]);
    expect(profile.certifications).toHaveLength(5);
  });

  it("offers the choice inside the Zertifikate card of the Lebenslauf, above the certificate list", () => {
    const html = renderToStaticMarkup(createElement(ResumeSectionsPanel, {
      profile, templateId: "modern", singlePageExceeded: false, initialExpanded: "certifications",
      onSave: async () => undefined, onPreview: () => undefined,
      certificateSelection: createElement(CertificateSelection, {
        entries: certificateEntries(profile), selectedIds: [ids[1]], onChange: () => undefined,
      }),
    }));
    const selection = html.indexOf('class="certificate-selection"');
    expect(selection).toBeGreaterThan(-1);
    expect(html.indexOf('class="certificate-list-editor"')).toBeGreaterThan(selection);
    expect(html).toContain("Ausgewählt: 1 von 5 Zertifikaten");
  });
});
