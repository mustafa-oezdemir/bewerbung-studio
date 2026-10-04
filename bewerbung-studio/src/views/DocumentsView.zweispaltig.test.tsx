import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { DocumentsView } from "./DocumentsView";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

describe("Zweispaltig Anschreiben preview and PDF", () => {
  it("uses the same CV sender and resolved identity variables on both surfaces", () => {
    const now = "2026-10-04T12:00:00.000Z";
    const profile = profileSchema.parse({
      id: "a1000000-0000-4000-8000-000000000001", isDefault: true,
      firstName: "Mustafa", lastName: "Özdemir", title: "Prozessplaner", city: "Marburg",
      email: "mustafa@example.com", experiences: [], education: [], updatedAt: now,
    });
    const application = applicationSchema.parse({
      schemaVersion: 1, id: "a1000000-0000-4000-8000-000000000002", profileId: profile.id,
      folderName: "Test", company: { name: "Beispiel GmbH", city: "Marburg" }, contact: {},
      job: { title: "Mitarbeiter Produktion" }, status: "Entwurf", templateId: "zweispaltig",
      accentColor: "#123456", secondaryColor: "#ABCDEF",
      designSettings: getTemplateDocumentDesignDefaults("zweispaltig"),
      documents: { coverSenderName: "Alter Name", coverSenderTitle: "Alter Titel", coverSenderContact: "Alte Kontaktzeile" },
      statusHistory: [], createdAt: now, updatedAt: now,
    });
    const previous = testStore.state;
    try {
      testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [profile],
        events: [], attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
      const previewHtml = renderToStaticMarkup(createElement(DocumentsView));
      const previewDocument = parseHTML(`<html><body>${previewHtml}</body></html>`).document;
      const preview = previewDocument.querySelector<HTMLElement>(".document-anschreiben.zweispaltig-letter");
      const pdf = parseHTML(buildDocumentHtml(application, profile, "anschreiben")).document
        .querySelector<HTMLElement>(".letter-page.zweispaltig-letter");
      expect(preview).not.toBeNull();
      expect(pdf).not.toBeNull();
      for (const variable of [
        "--letter-identity-primary", "--letter-identity-accent", "--letter-identity-divider",
        "--letter-identity-font", "--letter-identity-name-size", "--letter-body-size", "--letter-subject-size",
      ]) expect(preview?.style.getPropertyValue(variable), variable).toBe(pdf?.style.getPropertyValue(variable));
      expect(preview?.querySelector(".sender-name")?.textContent).toBe("Mustafa Özdemir");
      expect(pdf?.querySelector(".sender-name")?.textContent).toBe("Mustafa Özdemir");
      expect(preview?.querySelector(".sender-title")?.textContent).toBe("Prozessplaner");
      expect(pdf?.querySelector(".sender-title")?.textContent).toBe("Prozessplaner");
      expect(previewDocument.querySelector('input[name="coverSenderName"]')?.outerHTML).toContain("readOnly");
      expect(preview?.textContent).not.toContain("Alter Name");
      expect(pdf?.textContent).not.toContain("Alter Name");
      expect(preview?.querySelector(".letter-subject")?.textContent).toContain("Mitarbeiter Produktion");
      expect(pdf?.querySelector(".subject")?.textContent).toContain("Mitarbeiter Produktion");
    } finally {
      testStore.state = previous;
    }
  });
});
