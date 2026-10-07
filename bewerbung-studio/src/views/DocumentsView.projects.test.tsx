import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { DocumentsView } from "./DocumentsView";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

describe("application project selection", () => {
  it("stands below the resume section ordering controls", () => {
    const now = "2026-10-07T10:00:00.000Z";
    const profile = profileSchema.parse({
      id: "a2000000-0000-4000-8000-000000000001", isDefault: true,
      firstName: "Lena", lastName: "Beispiel", updatedAt: now,
      specialSections: [{ id: "a2000000-0000-4000-8000-000000000002", kind: "projects", title: "Projekte",
        entries: [{ id: "a2000000-0000-4000-8000-000000000003", title: "Go Ledger", technologies: ["Go"] }] }],
    });
    const application = applicationSchema.parse({
      schemaVersion: 1, id: "a2000000-0000-4000-8000-000000000004", profileId: profile.id,
      folderName: "Test", company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {},
      job: { title: "Go Entwicklerin" }, status: "Entwurf", templateId: "modern",
      accentColor: "#123456", secondaryColor: "#234567",
      designSettings: getTemplateDocumentDesignDefaults("modern"),
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    const previous = testStore.state;
    try {
      testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [profile],
        events: [], attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
      const html = renderToStaticMarkup(createElement(DocumentsView, { initialTab: "lebenslauf" }));
      const ordering = html.indexOf('aria-label="Abschnitte neu ordnen"');
      const selection = html.indexOf('class="application-projects"');
      expect(ordering).toBeGreaterThanOrEqual(0);
      expect(selection).toBeGreaterThan(ordering);
      expect(html.slice(selection)).toContain("Go Ledger");
    } finally {
      testStore.state = previous;
    }
  });
});
