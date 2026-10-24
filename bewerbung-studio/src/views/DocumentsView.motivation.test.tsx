import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { documentTopMarginMm, letterSideMarginCss, letterTopMarginCss } from "../shared/documentSideMargins";
import { getDocumentFont } from "../shared/documentDesign";
import { resolveCvDocument } from "../shared/resolveCvDocument";
import { motivationCss } from "../shared/motivationDocument";
import { DocumentsView } from "./DocumentsView";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

const now = "2026-10-09T09:00:00.000Z";
const profile = profileSchema.parse({
  id: "c1000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  street: "Gartenweg 7", postalCode: "34117", city: "Kassel", phone: "+49 170 1234567", email: "mina@example.test", updatedAt: now,
});
const applicationWith = (contact: Record<string, unknown>, cvOverrides?: Record<string, unknown>) => applicationSchema.parse({
  schemaVersion: 1, id: "c1000000-0000-4000-8000-000000000002", profileId: profile.id, folderName: "Fiktiv",
  company: { name: "Scherer Staffing GmbH", city: "Erlangen" }, contact,
  job: { title: "Fullstack-Softwareentwickler Go / Cloud" }, status: "Entwurf", templateId: "modern",
  accentColor: "#0f766e", secondaryColor: "#e6f4f1",
  designSettings: { ...getTemplateDocumentDesignDefaults("modern"), ...(cvOverrides ? { cvOverrides } : {}) },
  documents: { motivationEnabled: true, motivationIntroduction: "Mein <eigener> Einstieg.", motivationClosing: "Bis bald." },
  statusHistory: [], createdAt: now, updatedAt: now,
});

const renderTab = (application: ReturnType<typeof applicationWith>, initialTab: "deckblatt" | "anschreiben" | "motivation") => {
  const previous = testStore.state;
  try {
    testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [profile], events: [],
      attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
    return parseHTML(`<html><body>${renderToStaticMarkup(createElement(DocumentsView, { initialTab }))}</body></html>`).document;
  } finally {
    testStore.state = previous;
  }
};
const renderMotivationTab = (application: ReturnType<typeof applicationWith>) => renderTab(application, "motivation");

/** Tag, classes, attributes and text of every node. */
const tree = (node: Element): unknown => ({
  tag: node.tagName.toLowerCase(),
  attributes: Object.fromEntries(Array.from(node.attributes).map((attribute) => [attribute.name,
    attribute.name === "style" ? attribute.value.split(";").map((part) => part.trim()).filter(Boolean) : attribute.value])),
  children: Array.from(node.childNodes).map((child) => child.nodeType === 3 ? child.textContent : tree(child as Element)),
});

describe("DocumentsView Motivation tab", () => {
  it("shows the CV name and reading font and size on all three previews and their PDF pages", () => {
    const application = applicationWith({}, { typography: {
      headingFontId: "montserrat", headingSizePt: 23, fontId: "georgia", bodySizePt: 12.2,
    } });
    const cv = resolveCvDocument({ profile, templateId: application.templateId, settings: application.designSettings, application });
    const pdf = parseHTML(buildDocumentHtml(application, profile, "mappe")).document;
    const expected = {
      nameFont: getDocumentFont(cv.design.typography.headingFontId).family,
      nameSize: `${cv.design.typography.headingSizePt}pt`,
      bodyFont: getDocumentFont(cv.design.typography.fontId).family,
      bodySize: `${cv.design.typography.bodySizePt}pt`,
    };
    const pairs = [
      [renderTab(application, "deckblatt").querySelector<HTMLElement>(".deckblatt")!, pdf.querySelector<HTMLElement>(".deckblatt")!,
        ["--heading-font", "--cv-name-size", "--body-font", "--body-size"]],
      [renderTab(application, "anschreiben").querySelector<HTMLElement>(".document-anschreiben")!, pdf.querySelector<HTMLElement>(".document-anschreiben")!,
        ["--cv-name-font", "--cv-name-size", "--cv-body-font", "--cv-body-size"]],
      // The Motivationsschreiben is drawn in the Anschreiben's frame and carries the same variables.
      [renderTab(application, "motivation").querySelector<HTMLElement>(".motivation > .letter-frame")!, pdf.querySelector<HTMLElement>(".motivation > .letter-frame")!,
        ["--cv-name-font", "--cv-name-size", "--cv-body-font", "--cv-body-size"]],
    ] as const;
    for (const [preview, printed, keys] of pairs) {
      for (const element of [preview, printed]) {
        expect(keys.map((key) => element.style.getPropertyValue(key))).toEqual([
          expected.nameFont, expected.nameSize, expected.bodyFont, expected.bodySize,
        ]);
      }
    }
  });

  it("shows the automatic Anrede read-only in the editor and on the page, and follows the Ansprechpartner", () => {
    const frau = renderMotivationTab(applicationWith({ salutation: "Frau", firstName: "Anna", lastName: "Schulz" }));
    expect(frau.querySelector(".document-motivation .letter-preview > .letter-salutation")?.textContent).toBe("Sehr geehrte Frau Schulz,");
    const editorValues = [...frau.querySelectorAll(".motivation-editor .motivation-generated-value")].map((node) => node.textContent);
    expect(editorValues).toContain("Sehr geehrte Frau Schulz,");
    expect(editorValues).toContain("Kassel, 9. Oktober 2026");
    expect(frau.querySelector('.motivation-editor [name*="salutation" i], .motivation-editor [name*="greeting" i]')).toBeNull();

    const herr = renderMotivationTab(applicationWith({ salutation: "Herr", lastName: "Berger" }));
    expect(herr.querySelector(".document-motivation .letter-preview > .letter-salutation")?.textContent).toBe("Sehr geehrter Herr Berger,");
    const none = renderMotivationTab(applicationWith({}));
    expect(none.querySelector(".document-motivation .letter-preview > .letter-salutation")?.textContent).toBe("Sehr geehrte Damen und Herren,");
  });

  it("lists the five parts in order, each with its short description and its fields", () => {
    const document = renderMotivationTab(applicationWith({}));
    const parts = [...document.querySelectorAll(".motivation-editor > section.motivation-part")].map((section) => [
      section.querySelector("header > .motivation-part-number")?.textContent,
      section.querySelector("header > b")?.textContent,
      section.querySelector("header > small")?.textContent,
      [...section.querySelectorAll("input[name], textarea[name]")].map((field) => field.getAttribute("name")),
    ]);
    // karrierebibel.de/motivationsschreiben: Briefkopf, Überschrift, Einleitung, Hauptteil, Schluss.
    expect(parts).toEqual([
      ["1", "Briefkopf", "Wie im Anschreiben: Name, Anschrift, Telefon, E-Mail", []],
      ["2", "Überschrift", "Persönlich: Ihre Motivation oder Eignung benennen", ["motivationHeading"]],
      ["3", "Einleitung", "Neugier wecken", ["motivationIntroduction"]],
      ["4", "Hauptteil", "Motivation und Passung verbinden", ["motivationMainBody"]],
      ["5", "Schluss", "Selbstbewusst beenden", ["motivationClosing"]],
    ]);
    // Only the switch section stands before the five parts; no own Anrede part, no separate Stärken/Ziele fields.
    expect([...document.querySelectorAll(".motivation-editor > section")].length).toBe(6);
    expect(document.querySelector('.motivation-editor [data-motivation-section="salutation"]')).toBeNull();
    expect(document.querySelector('.motivation-editor [name="motivationEvidence"], .motivation-editor [name="motivationGoals"]')).toBeNull();
    // The Briefkopf is the Anschreiben's: shown read-only with the sender, no Empfänger or Datum row.
    const letterhead = document.querySelector('.motivation-editor [data-motivation-section="letterhead"]')!;
    expect(letterhead.classList.contains("is-generated")).toBe(true);
    expect([...letterhead.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Absender"]);
    expect(letterhead.querySelector("dd")?.textContent).toContain("Mina Kaya");
    expect(letterhead.textContent).toContain("wie im Anschreiben");
    // Überschrift has its own part with its spacing control.
    const heading = document.querySelector('.motivation-editor [data-motivation-section="heading"]')!;
    expect(heading.querySelector(".cover-subject-spacing-control")?.textContent).toContain("Abstand vor Überschrift");
    // Schluss: Schlusssätze, Grußformel, Unterschrift, Ort und Datum.
    const closing = document.querySelector('.motivation-editor [data-motivation-section="closing"]')!;
    expect([...closing.querySelectorAll(".motivation-generated-row > span")].map((label) => label.textContent)).toEqual(["Grußformel", "Ort, Datum"]);
    expect(closing.textContent).toContain("Mit freundlichen Grüßen");
    expect(closing.textContent).toContain("Kassel, 9. Oktober 2026");
    expect(closing.querySelector(".document-media-inline")).not.toBeNull();
  });

  it("keeps stored texts in their fields and shows the Anrede at the start of the Einleitung", () => {
    const stored = renderMotivationTab(applicationWith({}));
    expect(stored.querySelector<HTMLTextAreaElement>('textarea[name="motivationIntroduction"]')?.textContent).toContain("eigener");
    expect(stored.querySelector<HTMLTextAreaElement>('textarea[name="motivationClosing"]')?.textContent).toBe("Bis bald.");
    const introduction = (document: ReturnType<typeof renderMotivationTab>) =>
      document.querySelector('.motivation-editor [data-motivation-section="introduction"]')!;
    // Anrede (read-only), its hint and its spacing control stand before the Einleitung text.
    const order = [...introduction(stored).querySelectorAll(".motivation-generated-row, .motivation-salutation-hint, .cover-subject-spacing-control, label.field")]
      .map((node) => node.className);
    expect(order).toEqual(["motivation-generated-row", "field-hint motivation-salutation-hint", "cover-subject-spacing-control", "field"]);
    expect(introduction(stored).querySelector(".motivation-generated-value")?.textContent).toBe("Sehr geehrte Damen und Herren,");
    const hint = (document: ReturnType<typeof renderMotivationTab>) => introduction(document).querySelector(".motivation-salutation-hint")?.textContent;
    expect(hint(stored)).toContain("nur eine Notlösung");
    expect(hint(renderMotivationTab(applicationWith({ salutation: "Frau", lastName: "Schulz" })))).not.toContain("Notlösung");
  });

  it("puts older Erfahrungen/Ziele texts into the one Hauptteil field, the page stays the same", () => {
    const base = applicationWith({});
    const legacy = applicationSchema.parse({ ...base, documents: { ...base.documents,
      motivationMainBody: "Warum diese Stelle.", motivationEvidence: "Ein Projektbeispiel.", motivationGoals: "Mein Ziel." } });
    const document = renderMotivationTab(legacy);
    expect(document.querySelector('textarea[name="motivationMainBody"]')?.textContent)
      .toBe("Warum diese Stelle.\n\nEin Projektbeispiel.\n\nMein Ziel.");
    const printed = [...document.querySelectorAll(".document-motivation .letter-preview > .letter-body")].map((node) => node.textContent);
    expect(printed).toEqual(["Mein <eigener> Einstieg.", "Warum diese Stelle.", "Ein Projektbeispiel.", "Mein Ziel.", "Bis bald."]);
  });

  it("offers an Anrede spacing control of its own and shares its setting with the PDF", () => {
    const standard = applicationWith({});
    const compact = applicationSchema.parse({ ...standard,
      documents: { ...standard.documents, motivationSalutationGapReduction: 3 } });
    const controls = (document: ReturnType<typeof renderMotivationTab>) =>
      [...document.querySelectorAll(".motivation-editor .cover-subject-spacing-control")];
    const [heading, salutation] = controls(renderMotivationTab(standard));
    expect(heading?.textContent).toContain("Abstand vor Überschrift");
    expect(salutation?.textContent).toContain("Abstand vor Anrede");
    expect(salutation?.textContent).toContain("Standardabstand");
    const preview = renderMotivationTab(compact);
    const [headingAfter, control] = controls(preview);
    expect(control?.textContent).toContain("3 Zeilen nach oben verschoben");
    expect(control?.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    // Each gap moves on its own.
    expect(headingAfter?.textContent).toContain("Standardabstand");
    // Counted in lines of the letter's Fließtext: its size and the Lebenslauf's line spacing.
    const previewGap = preview.querySelector<HTMLElement>(".document-motivation .motivation > .letter-frame")!
      .style.getPropertyValue("--mv-title-gap");
    const pdfGap = parseHTML(buildDocumentHtml(compact, profile, "motivation")).document
      .querySelector<HTMLElement>(".motivation > .letter-frame")!.style.getPropertyValue("--mv-title-gap");
    expect(previewGap).toBe("calc(var(--letter-body-size) * var(--letter-cv-line-height) * 1)");
    expect(pdfGap).toBe(previewGap);
  });

  it("offers the heading spacing control and shares its setting with the PDF", () => {
    const standard = applicationWith({});
    const compact = applicationSchema.parse({ ...standard,
      documents: { ...standard.documents, motivationHeadingGapReduction: 4 } });
    const editor = renderMotivationTab(standard);
    expect(editor.querySelector(".motivation-editor .cover-subject-spacing-control")?.textContent)
      .toContain("Standardabstand");
    const preview = renderMotivationTab(compact);
    const control = preview.querySelector(".motivation-editor .cover-subject-spacing-control");
    expect(control?.textContent).toContain("4 Zeilen nach oben verschoben");
    expect(control?.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    const previewGap = preview.querySelector<HTMLElement>(".document-motivation .motivation > .letter-frame")!
      .style.getPropertyValue("--mv-header-gap");
    const pdfGap = parseHTML(buildDocumentHtml(compact, profile, "motivation")).document
      .querySelector<HTMLElement>(".motivation > .letter-frame")!.style.getPropertyValue("--mv-header-gap");
    expect(previewGap).toBe("calc(var(--letter-body-size) * var(--letter-cv-line-height) * 4)");
    expect(pdfGap).toBe(previewGap);
  });

  it("draws exactly the PDF's page: same tree, same design values, no position or company line", () => {
    const application = applicationWith({ salutation: "Frau", lastName: "Schulz" },
      { typography: { bodySizePt: 12, lineHeight: 1.4 }, colors: { sectionHeading: "#234567" }, spacing: { pageMarginMm: 18 } });
    const preview = renderMotivationTab(application).querySelector(".document-motivation .motivation")!;
    const pdf = parseHTML(buildDocumentHtml(application, profile, "motivation")).document.querySelector(".motivation")!;
    expect(tree(preview)).toEqual(tree(pdf));
    const frame = preview.querySelector<HTMLElement>(":scope > .letter-frame")!;
    expect(frame.style.getPropertyValue("--letter-body-size")).toBe("12pt");
    expect(frame.style.getPropertyValue("--letter-cv-line-height")).toBe("1.4");
    expect(frame.style.getPropertyValue("--side-left")).toBe("18mm");
    expect(preview.textContent).not.toMatch(/Fullstack|Scherer|Erlangen|Bewerbung als/);
    // The preview never scales the page to fit.
    expect(renderMotivationTab(application).querySelector(".document-motivation")?.getAttribute("style")).not.toMatch(/transform|scale|zoom/);
  });

  it("gives the Deckblatt and Anschreiben previews the Lebenslauf's left and right margin, as the PDF does", () => {
    const application = applicationWith({}, { spacing: { pageMarginMm: 18 } });
    const pdf = parseHTML(buildDocumentHtml(application, profile, "mappe")).document;
    const deckblatt = renderTab(application, "deckblatt").querySelector<HTMLElement>(".document-deckblatt .deckblatt")!;
    const letter = renderTab(application, "anschreiben");
    const letterPaper = letter.querySelector<HTMLElement>(".document-paper.document-anschreiben")!;
    for (const [preview, printed] of [
      [deckblatt, pdf.querySelector<HTMLElement>(".cover-page .deckblatt")!],
      [letterPaper, pdf.querySelector<HTMLElement>("section.letter-page .document-anschreiben")!],
    ] as const) {
      expect(preview.style.getPropertyValue("--side-left")).toBe("18mm");
      expect(preview.style.getPropertyValue("--side-right")).toBe("18mm");
      expect(printed.style.getPropertyValue("--side-left")).toBe("18mm");
      expect(printed.style.getPropertyValue("--side-right")).toBe("18mm");
    }
    expect(letterPaper.querySelector(":scope > style")?.textContent).toBe(letterSideMarginCss);
  });

  it("never zooms the inherited Anschreiben frame a second time inside the zoomed preview page", () => {
    // app.css zooms every ".paper-stage .document-paper"; the Anschreiben frame inside the Motivation page is one too.
    const appCss = readFileSync(resolve(__dirname, "../app.css"), "utf8");
    expect(appCss).toMatch(/\.paper-stage \.document-paper \{\s*zoom:/);
    expect(motivationCss).toMatch(/\.motivation--letter>\.letter-frame\.document-paper\{zoom:1!important;/);
  });

  it("starts the Anschreiben as far from the top as the Motivationsschreiben, in preview and PDF", () => {
    const application = applicationWith({});
    // The Motivationsschreiben is drawn in the Anschreiben's frame and so carries the same top rule.
    const motivationStyles = [...renderMotivationTab(application).querySelectorAll(".document-motivation .letter-frame > style")]
      .map((style) => style.textContent);
    expect(motivationStyles).toContain(letterTopMarginCss);
    // 20 mm less one 11 pt line at one and a half spacing.
    expect(documentTopMarginMm).toBe(14.2);
    const letterStyles = [...renderTab(application, "anschreiben").querySelectorAll(".document-paper.document-anschreiben > style")]
      .map((style) => style.textContent);
    expect(letterStyles).toContain(letterTopMarginCss);
    expect(buildDocumentHtml(application, profile, "anschreiben")).toContain(letterTopMarginCss);
    // Beats every template letter style; only Kreativ keeps its band at the top edge.
    expect(letterTopMarginCss).toContain(`.document-paper.document-anschreiben:not(.kreativ-letter)>.letter-preview{padding-top:${documentTopMarginMm}mm!important}`);
  });
});
