import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { anschreibenPrintCss } from "../../electron/anschreibenPrintCss";
import { anschreibenCvTypographyCss, anschreibenSubjectCss, letterBodySizePt, letterMinimumBetreffGapMm, letterMinimumLineHeight, letterSpacingFitSource } from "../shared/anschreibenDocument";
import { getTemplateDocumentDesignDefaults } from "../shared/cvDesign";
import { applicationSchema, defaultSettings, profileSchema } from "../shared/schema";
import { templates } from "../shared/templates";
import { DocumentsView } from "./DocumentsView";
import { resolveCvDocument } from "../shared/resolveCvDocument";
import { resolveLetterTitleColor, resolveResumeNameColor } from "../shared/resumeTitleColor";

const testStore = vi.hoisted(() => ({ state: undefined as Record<string, unknown> | undefined }));
vi.mock("../store/useAppStore", () => {
  const useAppStore = (selector: (state: Record<string, unknown>) => unknown) => selector(testStore.state ?? {});
  useAppStore.getState = () => testStore.state;
  return { useAppStore, selectCurrentApplication: (state: { workspace: { applications: unknown[] } }) => state.workspace.applications[0] };
});

const now = "2026-10-12T09:00:00.000Z";
const profile = profileSchema.parse({
  id: "d1000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  street: "Gartenweg 7", postalCode: "35039", city: "Marburg", phone: "+49 170 1234567", email: "mina@example.test",
  signaturePath: "data:image/png;base64,AA==", updatedAt: now,
});
const applicationFor = (templateId: string, gap: number) => applicationSchema.parse({
  schemaVersion: 1, id: "d1000000-0000-4000-8000-000000000002", profileId: profile.id, folderName: "Fiktiv",
  company: { name: "Scherer Staffing GmbH", city: "Nürnberg" }, contact: { salutation: "Frau", lastName: "Zander" },
  job: { title: "Fullstack-Softwareentwickler Go / Cloud" }, status: "Entwurf", templateId,
  accentColor: "#0f766e", secondaryColor: "#e6f4f1", designSettings: getTemplateDocumentDesignDefaults(templateId),
  documents: {
    coverSubjectGapReduction: gap, coverIntroduction: "Einleitung mit <Zeichen> & mehr.", coverMainBody: "Hauptteil.",
    coverExtraParagraph: "Zusatz.", coverCompanyFit: "Unternehmensbezug.", coverClosing: "Schluss.",
  },
  statusHistory: [], createdAt: now, updatedAt: now,
});

/** Tag, classes, attributes (style as a declaration list) and text of every node; stylesheets by their text. */
const tree = (node: Element): unknown => ({
  tag: node.tagName.toLowerCase(),
  attributes: Object.fromEntries(Array.from(node.attributes).map((attribute) => [attribute.name,
    attribute.name === "style" ? attribute.value.split(";").map((part) => part.trim()).filter(Boolean) : attribute.value])),
  children: Array.from(node.childNodes).map((child) => child.nodeType === 3 ? child.textContent : tree(child as Element)),
});

describe("Anschreiben: the PDF prints the preview's page", () => {
  it.each(templates.flatMap((template) => [[template.id, 0], [template.id, 4]] as const))(
    "%s (Abstand vor Betreff %s): same element tree, classes, style variables and stylesheets",
    (templateId, gap) => {
      const application = applicationFor(templateId, gap);
      const previous = testStore.state;
      try {
        testStore.state = { workspace: { schemaVersion: 1, applications: [application], profiles: [profile], events: [],
          attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
        const preview = parseHTML(`<html><body>${renderToStaticMarkup(createElement(DocumentsView, { initialTab: "anschreiben" }))}</body></html>`)
          .document.querySelector(".document-paper.document-anschreiben")!;
        const html = buildDocumentHtml(application, profile, "anschreiben");
        const pdf = parseHTML(html).document.querySelector("section.letter-page > .document-paper.document-anschreiben")!;
        expect(pdf).not.toBeNull();
        expect(tree(pdf)).toEqual(tree(preview));
        expect(pdf.classList.contains(`letter-gap-${gap}`)).toBe(true);
        // The Betreff is 13 pt in every template: the shared rule is the last stylesheet of the page.
        expect([...pdf.querySelectorAll(":scope > style")].at(-1)?.textContent).toBe(anschreibenSubjectCss);
        // …in the colour of the Lebenslauf's professional title.
        const cv = resolveCvDocument({ profile, templateId, settings: application.designSettings, application });
        expect((pdf as HTMLElement).style.getPropertyValue("--letter-subject-color"))
          .toBe(resolveLetterTitleColor(cv, { accentColor: application.accentColor, secondaryColor: application.secondaryColor }));
        // The preview's own rules (the gap rule included) are the PDF's stylesheet.
        expect(html).toContain(anschreibenPrintCss());
        expect(html).toContain(`.document-anschreiben.letter-gap-${gap === 0 ? 4 : gap} .letter-preview .paper-date{margin-bottom:4mm}`);
        expect(pdf.querySelector('[data-part], script')).toBeNull();
        expect(pdf.querySelector(".letter-body")?.textContent).toBe("Einleitung mit <Zeichen> & mehr.");
        // Sizes and colours follow karrierebibel and the Lebenslauf.
        const style = (pdf as HTMLElement).style;
        expect(style.getPropertyValue("--letter-body-size")).toBe(`${letterBodySizePt(cv.design.typography.bodySizePt)}pt`);
        expect(style.getPropertyValue("--letter-cv-line-height")).toBe(String(cv.design.typography.lineHeight));
        const identity = ["zweispaltig", "zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt", "kompakt"].includes(templateId);
        expect(pdf.classList.contains("letter-cv-colors")).toBe(!identity);
        if (!identity) expect(style.getPropertyValue("--letter-name-color"))
          .toBe(templateId === "tuerkis-profil" ? "#3F464B"
            : resolveResumeNameColor(cv, { accentColor: application.accentColor, secondaryColor: application.secondaryColor }));
        expect([...pdf.querySelectorAll(":scope > style")].map((node) => node.textContent)).toContain(anschreibenCvTypographyCss);
      } finally {
        testStore.state = previous;
      }
    },
  );
});

describe("Anschreiben typography (karrierebibel.de)", () => {
  it("sets 11 pt Fließtext with the Lebenslauf's line spacing, a 10 pt Briefkopf, a 15 pt name and a 13 pt bold Betreff in one font", () => {
    const css = anschreibenCvTypographyCss;
    expect(css).toContain(".document-anschreiben .letter-preview,.document-anschreiben .letter-preview *{font-family:var(--cv-body-font)!important}");
    expect(css).toContain(".sender-name{font-size:15pt!important");
    expect(css).toContain(":is(.sender-title,.sender-contact){font-size:10pt!important");
    // The line spacing is the Lebenslauf's (its design's Zeilenabstand).
    expect(css).toMatch(/:is\(\.letter-salutation,\.letter-body,[^)]*\)\{font-size:var\(--letter-body-size\)!important;line-height:var\(--letter-line-height,var\(--letter-cv-line-height\)\)!important\}/);
    expect(anschreibenSubjectCss).toContain("font-size:13pt!important;font-weight:700!important");
    // The rule under the Briefkopf: the Bewerbung's chosen colour, 1.25 pt (user: 1–1.5 pt).
    expect(css).toContain(".letter-rule{height:1.25pt!important;min-height:0!important;border:0!important;background:var(--doc-accent)!important}");
    // 11 pt is the floor; a larger Lebenslauf text is followed up to 12 pt.
    expect([9.2, 11, 11.5, 14].map(letterBodySizePt)).toEqual([11, 11, 11.5, 12]);
  });

  it("lets a long letter give up the space above the Betreff first, then line spacing, before anything is scaled", () => {
    // „Standardabstand“ must never change the type: the white space under the date shrinks first (down to the
    // „4 Zeilen“ setting's 4 mm), the line spacing (1.5 → 1.3) only after that, in the preview and the PDF alike.
    expect(letterMinimumLineHeight).toBe(1.3);
    expect(letterMinimumBetreffGapMm).toBe(4);
    const shrinkGap = letterSpacingFitSource.indexOf("date.style.setProperty('margin-bottom'");
    expect(shrinkGap).toBeGreaterThan(-1);
    expect(shrinkGap).toBeLessThan(letterSpacingFitSource.indexOf("content.style.setProperty('--letter-line-height'"));
    // The line spacing starts at the Lebenslauf's and never goes below 1.3 (nor below the Lebenslauf's own).
    expect(letterSpacingFitSource).toContain("getPropertyValue('--letter-cv-line-height')");
    expect(letterSpacingFitSource).toContain("step >= Math.min(base, 1.3) - 0.001");
    expect(letterSpacingFitSource).toContain("Math.max(4, current - over() / mm - 0.2)");
    const html = buildDocumentHtml(applicationFor("modern", 0), profile, "anschreiben");
    expect(html).toContain(letterSpacingFitSource);
    expect(html.indexOf(letterSpacingFitSource)).toBeLessThan(html.indexOf("const heightRatio = page.clientHeight"));
  });
});

describe("Anschreiben follows Unternehmen & Position and Ansprechpartner (copied Bewerbung)", () => {
  const letterTexts = (page: Element) => ({
    recipient: [...page.querySelectorAll("address > span")].map((line) => line.textContent),
    subject: page.querySelector(".letter-preview > h3")?.textContent,
    greeting: page.querySelector(".letter-salutation")?.textContent,
    body: [...page.querySelectorAll(".letter-body")].map((paragraph) => paragraph.textContent),
  });

  it.each(["modern", "zweispaltig"])("%s: preview and PDF show the copy's new data and keep the own paragraphs", (templateId) => {
    // A copy of „HDI AG“ whose letter head still holds the source's values (saved as text by the old editor).
    const source = applicationFor(templateId, 0);
    const copy = applicationSchema.parse({
      ...source,
      company: { name: "Klingelnberg GmbH", street: "Peterstraße 45", postalCode: "42499", city: "Hückeswagen" },
      contact: { salutation: "Frau", firstName: "Yasmin", lastName: "Baumstark" },
      job: { title: "Anwendungsingenieur" },
      documents: {
        ...source.documents,
        coverRecipientAddress: "HDI AG\nHerrn Aref Olya\nHDI-Platz 1\n30659 Hannover",
        coverSubject: "Bewerbung als Sachbearbeiter IT",
        coverGreeting: "Sehr geehrter Herr Olya,",
      },
    });
    const previous = testStore.state;
    try {
      testStore.state = { workspace: { schemaVersion: 1, applications: [copy], profiles: [profile], events: [],
        attachments: [], todos: [], customCvDesigns: [], settings: defaultSettings, updatedAt: now } };
      const view = parseHTML(`<html><body>${renderToStaticMarkup(createElement(DocumentsView, { initialTab: "anschreiben" }))}</body></html>`).document;
      const preview = view.querySelector(".document-paper.document-anschreiben")!;
      const pdf = parseHTML(buildDocumentHtml(copy, profile, "anschreiben")).document
        .querySelector("section.letter-page > .document-paper.document-anschreiben")!;
      const expected = {
        recipient: ["Klingelnberg GmbH", "Frau Yasmin Baumstark", "Peterstraße 45", "42499 Hückeswagen"],
        subject: "Bewerbung als Anwendungsingenieur",
        greeting: "Sehr geehrte Frau Baumstark,",
        body: ["Einleitung mit <Zeichen> & mehr.", "Hauptteil.", "Zusatz.", "Unternehmensbezug.", "Schluss."],
      };
      expect(letterTexts(preview)).toEqual(expected);
      expect(letterTexts(pdf)).toEqual(expected);
      // The editor fields show the same values, so saving them freezes nothing old.
      expect(view.querySelector('textarea[name="coverRecipientAddress"]')?.textContent).toBe(expected.recipient.join("\n"));
      expect(view.querySelector('input[name="coverSubject"]')?.getAttribute("value")).toBe(expected.subject);
      expect(view.querySelector('input[name="coverGreeting"]')?.getAttribute("value")).toBe(expected.greeting);
      // The Bewerbungsmappe prints the same letter.
      const mappe = parseHTML(buildDocumentHtml(copy, profile, "mappe")).document
        .querySelector("section.letter-page > .document-paper.document-anschreiben")!;
      expect(letterTexts(mappe)).toEqual(expected);
    } finally {
      testStore.state = previous;
    }
  });
});
