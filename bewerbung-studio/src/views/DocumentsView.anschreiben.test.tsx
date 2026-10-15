import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { buildDocumentHtml } from "../../electron/documents";
import { anschreibenPrintCss } from "../../electron/anschreibenPrintCss";
import { anschreibenCvTypographyCss, anschreibenSubjectCss, letterBodySizePt, letterLineHeightSteps } from "../shared/anschreibenDocument";
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
        const identity = ["zweispaltig", "zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt", "kompakt"].includes(templateId);
        expect(pdf.classList.contains("letter-cv-colors")).toBe(!identity);
        if (!identity) expect(style.getPropertyValue("--letter-name-color"))
          .toBe(resolveResumeNameColor(cv, { accentColor: application.accentColor, secondaryColor: application.secondaryColor }));
        expect([...pdf.querySelectorAll(":scope > style")].map((node) => node.textContent)).toContain(anschreibenCvTypographyCss);
      } finally {
        testStore.state = previous;
      }
    },
  );
});

describe("Anschreiben typography (karrierebibel.de)", () => {
  it("sets 11 pt Fließtext with one and a half lines, a 10 pt Briefkopf, a 15 pt name and a 13 pt bold Betreff in one font", () => {
    const css = anschreibenCvTypographyCss;
    expect(css).toContain(".document-anschreiben .letter-preview,.document-anschreiben .letter-preview *{font-family:var(--cv-body-font)!important}");
    expect(css).toContain(".sender-name{font-size:15pt!important");
    expect(css).toContain(":is(.sender-title,.sender-contact){font-size:10pt!important");
    expect(css).toMatch(/:is\(\.letter-salutation,\.letter-body,[^)]*\)\{font-size:var\(--letter-body-size\)!important;line-height:var\(--letter-line-height,1\.5\)!important\}/);
    expect(anschreibenSubjectCss).toContain("font-size:13pt!important;font-weight:700!important");
    // 11 pt is the floor; a larger Lebenslauf text is followed up to 12 pt.
    expect([9.2, 11, 11.5, 14].map(letterBodySizePt)).toEqual([11, 11, 11.5, 12]);
  });

  it("gives up line spacing (1.5 down to 1.3) before the PDF scales a long letter, as the preview does", () => {
    expect([...letterLineHeightSteps]).toEqual(["1.5", "1.45", "1.4", "1.35", "1.3"]);
    const html = buildDocumentHtml(applicationFor("modern", 0), profile, "anschreiben");
    expect(html).toContain(`for (const lineHeight of ${JSON.stringify(letterLineHeightSteps)})`);
    expect(html).toContain('content.style.setProperty("--letter-line-height", lineHeight)');
  });
});
