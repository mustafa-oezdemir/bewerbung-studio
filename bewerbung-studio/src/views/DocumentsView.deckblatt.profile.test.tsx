import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { DocumentsView } from "./DocumentsView";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

describe("Deckblatt profile source", () => {
  it("shows the active Bewerbung's profile copy in the preview", () => {
    const now = "2026-10-27T10:00:00.000Z";
    const master = profileSchema.parse({ id: "a1000000-0000-4000-8000-000000000001", isDefault: true,
      firstName: "Mina", lastName: "Kaya", title: "Softwareentwicklerin", email: "mina@example.com", updatedAt: now });
    const applicationProfile = profileSchema.parse({ ...master, firstName: "Elif", lastName: "Arslan",
      title: "Datenanalystin", email: "elif@example.com", skills: ["SQL", "Python", "Power BI"] });
    const application = applicationSchema.parse({ schemaVersion: 1, id: "a1000000-0000-4000-8000-000000000002",
      profileId: master.id, profileSnapshot: applicationProfile, folderName: "Beispiel", company: { name: "Beispiel GmbH", city: "Berlin" },
      contact: {}, job: { title: "Data Analyst" }, status: "Entwurf", templateId: "modern", accentColor: "#155e58",
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
    const previous = testStore.state;
    try {
      testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [master],
        events: [], attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
      const page = parseHTML(renderToStaticMarkup(createElement(DocumentsView, { initialTab: "deckblatt" })))
        .document.querySelector(".deckblatt");
      expect(page?.textContent).toContain("Elif Arslan");
      expect(page?.textContent).toContain("Datenanalystin");
      expect(page?.textContent).toContain("elif@example.com");
      expect(page?.textContent).toContain("SQL");
      expect(page?.textContent).not.toContain("Mina Kaya");
      expect(page?.textContent).not.toContain("mina@example.com");
    } finally {
      testStore.state = previous;
    }
  });
});
