import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { buildMotivationModel, motivationCss, renderMotivationMarkup } from "../../shared/motivationDocument";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { setResumePhotoVisible } from "../../shared/resumePhoto";
import { applicationSchema, documentDraftSchema, profileSchema } from "../../shared/schema";
import { getTemplate, templates } from "../../shared/templates";
import { MotivationPage } from "./MotivationPage";
import { MotivationPreview } from "./MotivationPreview";

const image = "data:image/png;base64,AA==";
const profile = setResumePhotoVisible(profileSchema.parse({
  id: "00000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  street: "Weg 1", postalCode: "10115", city: "Berlin", phone: "030 123", email: "mina@example.test", photoPath: image,
  signaturePath: image, updatedAt: "2026-10-09T09:00:00.000Z",
}), true);
const documents = documentDraftSchema.parse({
  motivationHeading: 'Meine <b>Motivation</b> & "mehr"',
  motivationIntroduction: "<script>alert(1)</script> Einleitung",
  motivationMainBody: "Absatz eins.\nZeile zwei.\n\nAbsatz zwei.",
  motivationEvidence: "Belegbarer Erfolg.",
  motivationGoals: "Ziele",
  motivationClosing: "Schluss",
});
const modelFor = (templateId: string) => {
  const settings = getTemplateDocumentDesignDefaults(templateId);
  const application = applicationSchema.parse({
    schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", folderName: "Fiktiv",
    company: { name: "Fiktiv GmbH", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf",
    templateId, accentColor: getTemplate(templateId).accent, secondaryColor: getTemplate(templateId).secondary,
    designSettings: settings, documents, statusHistory: [], createdAt: "2026-10-09T09:00:00.000Z", updatedAt: "2026-10-09T09:00:00.000Z",
  });
  return buildMotivationModel({ application, profile, documents, resolvedCv: resolveCvDocument({ profile, templateId, settings }) });
};

/** Tag, classes, attributes (style as a declaration list) and text of every node: what both surfaces draw. */
const tree = (html: string) => {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const walk = (node: Node): unknown => {
    if (node.nodeType === 3) return node.textContent;
    const element = node as Element;
    const attributes = Object.fromEntries(Array.from(element.attributes).map((attribute) => [attribute.name,
      attribute.name === "style" ? attribute.value.split(";").map((part) => part.trim()).filter(Boolean) : attribute.value]));
    return { tag: element.tagName.toLowerCase(), attributes, children: Array.from(element.childNodes).map(walk) };
  };
  return walk(document.body.firstElementChild!);
};

describe("Motivationsschreiben preview = PDF markup", () => {
  it.each(templates.map((template) => template.id))("%s: the React page draws the export's element tree", (templateId) => {
    const model = modelFor(templateId);
    expect(tree(renderToStaticMarkup(<MotivationPage model={model} />))).toEqual(tree(renderMotivationMarkup(model)));
  });

  it("prints user text as text nodes, never as HTML", () => {
    const html = renderToStaticMarkup(<MotivationPage model={modelFor("modern")} />);
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector(".mv-heading b")).toBeNull();
    expect(document.querySelector(".mv-heading")?.textContent).toBe('Meine <b>Motivation</b> & "mehr"');
    expect(document.querySelector('[data-part="introduction"]')?.textContent).toBe("<script>alert(1)</script> Einleitung");
  });

  it("the preview carries the PDF stylesheet and a page-break mark that is not part of the text", () => {
    const html = renderToStaticMarkup(<MotivationPreview model={modelFor("modern")} />);
    expect(html).toContain(motivationCss.trim().slice(0, 40));
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    expect(document.querySelector(".motivation .motivation-page-break")).toBeNull();
    expect(document.querySelector(".motivation-host > .motivation-page-break")).not.toBeNull();
  });
});
