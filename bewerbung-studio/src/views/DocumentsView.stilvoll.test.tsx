import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { stilvollLetterCss, stilvollResolvedCss } from "../shared/stilvollDesign";
import { DocumentsView } from "./DocumentsView";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

describe("Stilvoll Anschreiben and Lebenslauf", () => {
  it("shares the profile and resolved palette, typography and spacing across preview and PDF", () => {
    const now = "2026-10-05T12:00:00.000Z";
    const profile = profileSchema.parse({
      id: "a1000000-0000-4000-8000-000000000001", isDefault: true,
      firstName: "Mina", lastName: "Kaya", title: "Prozessplanerin", street: "Musterweg 4", postalCode: "12345", city: "Beispielstadt",
      email: "mina.kaya@example.com", phone: "+49 30 1234567", linkedin: "https://linkedin.com/in/mina-kaya",
      experiences: [], education: [], updatedAt: now,
    });
    const settings = {
      ...getTemplateDocumentDesignDefaults("stilvoll"),
      cvOverrides: { typography: { bodySizePt: 11, lineHeight: 1.4 }, spacing: { pageMarginMm: 10, columnGapMm: 8 },
        colors: { accent: "#2457A6", entryHeading: "#173A6B" } },
    };
    const application = applicationSchema.parse({
      schemaVersion: 1, id: "a1000000-0000-4000-8000-000000000002", profileId: profile.id,
      folderName: "Beispiel", company: { name: "Beispielwerke GmbH", city: "Beispielstadt" }, contact: { name: "Frau Beispiel" },
      job: { title: "Fachkraft Produktion" }, status: "Entwurf", templateId: "stilvoll",
      accentColor: "#2457A6", secondaryColor: "#173A6B", designSettings: settings,
      documents: { coverSenderName: "Alter Name", coverSenderTitle: "Alter Titel", coverSenderContact: "Alte Kontaktzeile",
        coverRecipientAddress: "Frau Beispiel\nBeispielwerke GmbH\nWerkstraße 8\n54321 Beispielstadt",
        coverIntroduction: "mit großem Interesse bewerbe ich mich als Fachkraft in der Produktion Ihres Unternehmens.",
        coverMainBody: "In meiner bisherigen Tätigkeit habe ich Produktionsabläufe koordiniert, Daten ausgewertet und Qualitätsstandards zuverlässig umgesetzt. Dabei habe ich eng mit angrenzenden Teams zusammengearbeitet.",
        coverCompanyFit: "Ihr Fokus auf saubere Prozesse und verlässliche Ergebnisse passt zu meiner strukturierten Arbeitsweise.",
        coverClosing: "Über eine Einladung zu einem persönlichen Gespräch freue ich mich sehr." },
      statusHistory: [], createdAt: now, updatedAt: now,
    });
    const previous = testStore.state;
    try {
      testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [profile],
        events: [], attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
      const preview = parseHTML(`<html><body>${renderToStaticMarkup(createElement(DocumentsView))}</body></html>`).document
        .querySelector<HTMLElement>(".document-anschreiben.stilvoll-letter");
      const pdfLetterHtml = buildDocumentHtml(application, profile, "anschreiben");
      const pdfLetter = parseHTML(pdfLetterHtml).document.querySelector<HTMLElement>(".letter-page.stilvoll-letter");
      const pdfCvHtml = buildDocumentHtml(application, profile, "lebenslauf");
      const pdfCv = parseHTML(pdfCvHtml).document.querySelector<HTMLElement>(".stilvoll-pdf");
      expect(preview).not.toBeNull();
      expect(pdfLetter).not.toBeNull();
      expect(pdfCv).not.toBeNull();
      for (const property of ["--stilvoll-primary", "--stilvoll-primary-dark", "--stilvoll-text", "--stilvoll-muted",
        "--stilvoll-section-heading", "--stilvoll-divider", "--stilvoll-pattern", "--stilvoll-inactive",
        "--stilvoll-margin-left", "--stilvoll-margin-right", "--stilvoll-column-gap", "--doc-font", "--doc-heading-font",
        "--doc-body-size", "--doc-line-height", "--letter-body-size", "--letter-subject-size"]) {
        expect(preview?.style.getPropertyValue(property), property).toBe(pdfLetter?.style.getPropertyValue(property));
        expect(pdfCv?.style.getPropertyValue(property), property).toBe(pdfLetter?.style.getPropertyValue(property));
      }
      expect(pdfCv?.style.getPropertyValue("--stilvoll-primary")).toBe("#2457A6");
      expect(pdfCv?.style.getPropertyValue("--stilvoll-primary-dark")).toBe("#173A6B");
      expect(pdfCv?.style.getPropertyValue("--stilvoll-margin-left")).toBe("15mm");
      expect(pdfCv?.style.getPropertyValue("--stilvoll-margin-right")).toBe("10mm");
      expect(pdfCv?.style.getPropertyValue("--doc-body-size")).toBe("11pt");
      expect(pdfCv?.style.getPropertyValue("--doc-line-height")).toBe("1.4");
      expect(pdfLetter?.style.getPropertyValue("--letter-subject-size")).toBe("13pt");
      expect(pdfLetter?.style.getPropertyValue("--letter-body-size")).toBe("11pt");
      expect(pdfCvHtml).toContain(stilvollResolvedCss);
      expect(pdfLetterHtml).toContain(stilvollLetterCss);
      expect(stilvollLetterCss).toContain("text-transform:uppercase");
      expect(profile.firstName).toBe("Mina");
      expect(pdfCv?.querySelector(".stilvoll-pdf-header h1")?.textContent).toBe("Mina Kaya");
      expect(pdfCv?.querySelector(".stilvoll-pdf-header h2")?.textContent).toBe("Prozessplanerin");
      for (const letter of [preview, pdfLetter]) {
        expect(letter?.querySelector(".sender-name")?.textContent).toBe("Mina Kaya");
        expect(letter?.querySelector(".sender-title")?.textContent).toBe("Prozessplanerin");
        expect(letter?.querySelector(".sender-contact")?.textContent).toContain("mina.kaya@example.com");
        expect(letter?.querySelector(".sender-contact")?.textContent).toContain("linkedin.com/in/mina-kaya");
        expect(letter?.textContent).toContain("Fachkraft Produktion");
        expect(letter?.textContent).not.toContain("Alter Name");
      }
      const paragraphs = (letter: HTMLElement | null) => Array.from(letter?.querySelectorAll(".letter-body") ?? [])
        .map(node => node.textContent?.trim());
      expect(paragraphs(preview)).toEqual(paragraphs(pdfLetter));
    } finally {
      testStore.state = previous;
    }
  });
});
