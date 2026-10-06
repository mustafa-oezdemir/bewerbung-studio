import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { kreativLetterCss } from "../shared/kreativDesign";
import { DocumentsView } from "./DocumentsView";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

describe("Kreativ Anschreiben and Lebenslauf", () => {
  it("shares profile data and resolved design across preview and PDF", () => {
    const now = "2026-10-04T12:00:00.000Z";
    const profile = profileSchema.parse({
      id: "b1000000-0000-4000-8000-000000000001", isDefault: true,
      firstName: "Mina", lastName: "Kaya", title: "Prozessplanerin", city: "Musterstadt",
      street: "Beispielweg 4", postalCode: "12345", email: "mina@example.com",
      phone: "+49 30 1234567", experiences: [], education: [], updatedAt: now,
    });
    const settings = {
      ...getTemplateDocumentDesignDefaults("kreativ"),
      cvOverrides: { typography: { bodySizePt: 11, lineHeight: 1.3 }, colors: { sectionHeading: "#193568" } },
    };
    const application = applicationSchema.parse({
      schemaVersion: 1, id: "b1000000-0000-4000-8000-000000000002", profileId: profile.id,
      folderName: "Beispiel", company: { name: "Beispielwerke GmbH", city: "Musterstadt" }, contact: {},
      job: { title: "Fachkraft Produktion" }, status: "Entwurf", templateId: "kreativ",
      accentColor: "#2457A6", secondaryColor: "#DCE7F8", designSettings: settings,
      documents: { coverSenderName: "Alter Name", coverSenderTitle: "Alter Titel", coverSenderContact: "Alte Kontaktzeile" },
      statusHistory: [], createdAt: now, updatedAt: now,
    });
    const previous = testStore.state;
    try {
      testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [profile],
        events: [], attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
      const preview = parseHTML(`<html><body>${renderToStaticMarkup(createElement(DocumentsView))}</body></html>`).document
        .querySelector<HTMLElement>(".document-anschreiben.kreativ-letter");
      const pdfLetterHtml = buildDocumentHtml(application, profile, "anschreiben");
      const pdfLetter = parseHTML(pdfLetterHtml).document.querySelector<HTMLElement>(".letter-page.kreativ-letter");
      const pdfCv = parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document
        .querySelector<HTMLElement>(".kreativ-pdf");
      expect(preview).not.toBeNull();
      expect(pdfLetter).not.toBeNull();
      expect(pdfCv).not.toBeNull();
      for (const property of ["--kreativ-primary", "--kreativ-primary-dark", "--kreativ-heading", "--kreativ-divider",
        "--doc-font", "--doc-heading-font", "--letter-body-size", "--letter-subject-size"]) {
        expect(preview?.style.getPropertyValue(property), property).toBe(pdfLetter?.style.getPropertyValue(property));
        expect(pdfCv?.style.getPropertyValue(property), property).toBe(pdfLetter?.style.getPropertyValue(property));
      }
      expect(preview?.style.getPropertyValue("--kreativ-primary")).toBe("#2457A6");
      expect(preview?.style.getPropertyValue("--kreativ-primary-dark")).not.toBe("#075D4E");
      expect(preview?.style.getPropertyValue("--kreativ-heading")).toBe("#193568");
      expect(preview?.style.getPropertyValue("--letter-subject-size")).toBe("13pt");
      expect(preview?.style.getPropertyValue("--letter-body-size")).toBe("11pt");
      expect(pdfCv?.style.getPropertyValue("--doc-body-size")).toBe("11pt");
      expect(pdfCv?.style.getPropertyValue("--doc-line-height")).toBe("1.3");
      expect(pdfLetterHtml).toContain(kreativLetterCss);
      expect(kreativLetterCss).toContain("text-transform:none");
      expect(profile.firstName).toBe("Mina");
      expect(pdfCv?.querySelector(".kreativ-pdf-identity h1")?.textContent).toBe("Mina Kaya");
      expect(pdfCv?.querySelector(".kreativ-pdf-identity h2")?.textContent).toBe("Prozessplanerin");
      expect(pdfCv?.querySelector('[data-contact-kind="email"]')?.textContent).toContain("mina@example.com");
      for (const letter of [preview, pdfLetter]) {
        expect(letter?.querySelector(".sender-name")?.textContent).toBe("Mina Kaya");
        expect(letter?.querySelector(".sender-title")?.textContent).toBe("Prozessplanerin");
        expect(letter?.querySelector(".sender-contact")?.textContent).toContain("mina@example.com");
        expect(letter?.textContent).not.toContain("Alter Name");
        expect(letter?.textContent).toContain("Fachkraft Produktion");
      }
      const paragraphs = (letter: HTMLElement | null) => Array.from(letter?.querySelectorAll(".letter-body") ?? [])
        .map((node) => node.textContent?.trim());
      expect(paragraphs(preview)).toEqual(paragraphs(pdfLetter));
    } finally {
      testStore.state = previous;
    }
  });
});
