import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../src/shared/schema";
import { buildDocumentHtml } from "./documents";

const now = "2026-11-02T12:00:00.000Z";
const profile = profileSchema.parse({
  id: "2fe09038-f9ba-45d6-af84-6d2ac90f5c74", isDefault: true,
  firstName: "Mina", lastName: "Kaya", email: "mina@example.com", updatedAt: now,
  strengths: [{ id: "e7b44770-0be7-46e6-89fb-3cf8c7a5cc7f", title: "API", iconId: "vscode:folder:api" }],
});
const application = applicationSchema.parse({
  schemaVersion: 1,
  id: "9493aafb-0773-4b82-a38a-68798afcd931", folderName: "Beispiel", company: { name: "Beispiel GmbH", city: "Berlin" },
  contact: {}, job: { title: "Softwareentwicklerin" }, status: "Entwurf", templateId: "modern-sidebar",
  accentColor: "#ee7b24", secondaryColor: "#1d4ed8",
  documents: { coverSheetDesign: "kopfband" }, statusHistory: [], createdAt: now, updatedAt: now,
});

describe("vscode-icons in document HTML", () => {
  it("keeps one selected ID with original paint in the Deckblatt and, without a chosen colour, in the Lebenslauf", () => {
    const document = parseHTML(buildDocumentHtml(application, profile, "mappe")).document;
    const cover = document.querySelector('.deckblatt svg[data-brand="vscode:folder:api"]');
    const cv = document.querySelector('.cv-sheet svg[data-brand="vscode:folder:api"]');
    expect(cover?.outerHTML).toContain('fill="#a0bf55"');
    expect(cover?.outerHTML).toContain('fill="#fff"');
    expect(cv?.outerHTML).toContain('fill="#a0bf55"');
    expect(cv?.outerHTML).not.toContain("currentColor");
    expect(cv?.closest("[data-strength-icon-mode]")?.getAttribute("data-strength-icon-mode")).toBe("original");
    expect(document.querySelector("style")?.textContent).toContain(':not([data-strength-icon-mode] svg)');
  });

  it("applies either selected Stärken-Symbole colour without changing the original Deckblatt SVG", () => {
    const render = (strengthIcon: string) => parseHTML(buildDocumentHtml(application, profile, "mappe", [],
      { cvOverrides: { colors: { strengthIcon } } })).document;
    const orange = render("#c2410c");
    const blue = render("#1d4ed8");
    const cover = (document: Document) => document.querySelector('.deckblatt svg[data-brand="vscode:folder:api"]')?.outerHTML;
    const cv = (document: Document) => document.querySelector('.cv-sheet svg[data-brand="vscode:folder:api"]')?.outerHTML;
    expect(cover(orange)).toBe(cover(blue));
    expect(cv(orange)).toContain("#c2410c");
    expect(cv(blue)).toContain("#1d4ed8");
    expect(cv(orange)).not.toBe(cv(blue));
    // The catalogue rule keeps the template's colour; the Stärken icon carries the chosen one inline.
    expect(orange.querySelector("style")?.textContent).not.toContain('{color:#c2410c!important}');
  });

  it("keeps Stärken and Deckblatt icons out of Symbole", () => {
    const render = (icon?: string) => parseHTML(buildDocumentHtml(application, profile, "mappe", [],
      icon ? { cvOverrides: { colors: { icon } } } : undefined)).document;
    const native = render();
    const chosen = render("#2856b6");
    const cover = (document: Document) => document.querySelector('.deckblatt svg[data-brand="vscode:folder:api"]')?.outerHTML;
    const cv = (document: Document) => document.querySelector('.cv-sheet svg[data-brand="vscode:folder:api"]')?.outerHTML;
    expect(cover(chosen)).toBe(cover(native));
    expect(cv(chosen)).toBe(cv(native));
    expect(chosen.querySelector("style")?.textContent).not.toContain("#2856b6!important");
  });
});
