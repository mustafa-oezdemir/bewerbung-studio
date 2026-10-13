import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { ZweispaltigResume } from "./ZweispaltigResume";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { createDocumentDesignDraft } from "../../../../shared/documentEditorState";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { applicationSchema, profileSchema } from "../../../../shared/schema";

const now = "2026-10-13T09:00:00.000Z";
const profile = profileSchema.parse({
  id: "f1000000-0000-4000-8000-000000000001", isDefault: true,
  firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", city: "Berlin",
  email: "mina@example.test", updatedAt: now,
});
const application = (accentColor: string, secondaryColor: string, cvOverrides?: object) => applicationSchema.parse({
  schemaVersion: 1, id: "f1000000-0000-4000-8000-000000000002", profileId: profile.id,
  folderName: "Fiktiv", company: { name: "Fiktiv GmbH", city: "Berlin" }, contact: {},
  job: { title: "Entwicklung" }, status: "Entwurf", templateId: "zweispaltig",
  accentColor, secondaryColor, designSettings: { ...getTemplateDocumentDesignDefaults("zweispaltig"), cvOverrides },
  documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});

describe("Zweispaltig resolved colours", () => {
  it("keeps selected Akzent and Fläche after a saved application is reopened", () => {
    const saved = application("#EE7B24", "#9D4616");
    const reopened = applicationSchema.parse(JSON.parse(JSON.stringify(saved)));
    const draft = createDocumentDesignDraft(reopened);
    expect([draft.accentColor, draft.secondaryColor]).toEqual(["#EE7B24", "#9D4616"]);
    const resolved = resolveCvDocument({ profile, templateId: draft.templateId,
      settings: draft.settings, application: reopened });
    expect(resolved.zweispaltigVariables).toMatchObject({
      "--zweispaltig-primary": "#EE7B24",
      "--zweispaltig-accent": "#9D4616",
      "--zweispaltig-heading": "#EE7B24",
      "--zweispaltig-soft": "#EAF5FD",
      "--zweispaltig-text": resolved.design.colors.text,
    });
    const preview = parseHTML(renderToStaticMarkup(
      <ManagedResumePreview profile={resolved.profile} templateId="zweispaltig" pageNumber={1}
        totalPages={resolved.pagePlan.length} designSettings={resolved.settings} resolvedCv={resolved}>
        <ZweispaltigResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={resolved.pagePlan[0]}
          totalPages={resolved.pagePlan.length} accentColor={draft.accentColor}
          secondaryColor={draft.secondaryColor} designVariables={resolved.zweispaltigVariables}
          photoSource={null} resumeProfile={resolved.summary} sections={resolved.sections} />
      </ManagedResumePreview>,
    )).document.querySelector<HTMLElement>(".zweispaltig-template")!;
    const pdfHtml = buildDocumentHtml(reopened, profile, "lebenslauf");
    const pdf = parseHTML(pdfHtml).document.querySelector<HTMLElement>(".zweispaltig-pdf")!;
    for (const [property, value] of Object.entries(resolved.zweispaltigVariables!)) {
      expect(preview.style.getPropertyValue(property), `preview ${property}`).toBe(value);
      expect(pdf.style.getPropertyValue(property), `PDF ${property}`).toBe(value);
    }
    expect(pdfHtml).toContain("background:var(--zweispaltig-soft);object-fit:cover");
    expect(pdfHtml).not.toContain("background:#eaf5fd;object-fit:cover");
  });

  it("uses each newly selected palette without changing the default surface", () => {
    const selected = application("#2368C4", "#B46A19");
    const resolved = resolveCvDocument({ profile, templateId: "zweispaltig",
      settings: selected.designSettings, application: selected });
    expect(resolved.zweispaltigVariables).toMatchObject({
      "--zweispaltig-primary": "#2368C4",
      "--zweispaltig-accent": "#B46A19",
      "--zweispaltig-heading": "#2368C4",
      "--zweispaltig-soft": "#EAF5FD",
    });
  });

  it("carries the same chosen colours onto both preview and PDF pages", () => {
    const longProfile = profileSchema.parse({ ...profile, experiences: Array.from({ length: 9 }, (_, index) => ({
      id: `f1000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}`,
      from: String(2014 + index), to: String(2015 + index), role: `Entwicklerin ${index + 1}`,
      company: `Beispiel GmbH ${index + 1}`,
      achievements: ["Fiktive Anwendungen entwickelt und dokumentiert.",
        "Zusammenarbeit im fiktiven Team verbessert.", "Fiktive Prozesse analysiert und umgesetzt."],
    })) });
    const selected = application("#EE7B24", "#9D4616");
    const resolved = resolveCvDocument({ profile: longProfile, templateId: "zweispaltig",
      settings: selected.designSettings, application: selected });
    expect(resolved.pagePlan).toHaveLength(2);
    const pdfPages = parseHTML(buildDocumentHtml(selected, longProfile, "lebenslauf"))
      .document.querySelectorAll<HTMLElement>(".zweispaltig-pdf");
    expect(pdfPages).toHaveLength(2);
    for (const [index, plan] of resolved.pagePlan.entries()) {
      const preview = parseHTML(renderToStaticMarkup(
        <ZweispaltigResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={plan}
          totalPages={resolved.pagePlan.length} accentColor={selected.accentColor}
          secondaryColor={selected.secondaryColor} designVariables={resolved.zweispaltigVariables}
          photoSource={null} resumeProfile={resolved.summary} sections={resolved.sections} />,
      )).document.querySelector<HTMLElement>(".zweispaltig-template")!;
      for (const page of [preview, pdfPages[index]]) {
        expect(page.style.getPropertyValue("--zweispaltig-primary")).toBe("#EE7B24");
        expect(page.style.getPropertyValue("--zweispaltig-accent")).toBe("#9D4616");
        expect(page.style.getPropertyValue("--zweispaltig-heading")).toBe("#EE7B24");
      }
    }
  });

  it("keeps legacy defaults and explicit semantic overrides", () => {
    const legacy = application("#165DAA", "#EAF2FA");
    const native = resolveCvDocument({ profile, templateId: "zweispaltig", settings: legacy.designSettings, application: legacy });
    expect(native.zweispaltigVariables).toMatchObject({
      "--zweispaltig-primary": "#0B3D86",
      "--zweispaltig-accent": "#58B5F7",
      "--zweispaltig-soft": "#EAF5FD",
    });
    const selected = application("#EE7B24", "#9D4616", {
      colors: { heading: "#0060F0", accent: "#1DBF2F", surface: "#F2F2F2" },
    });
    const resolved = resolveCvDocument({ profile, templateId: "zweispaltig",
      settings: selected.designSettings, application: selected });
    expect(resolved.zweispaltigVariables).toMatchObject({
      "--zweispaltig-primary": "#0060F0",
      "--zweispaltig-heading": "#0060F0",
      "--zweispaltig-accent": "#1DBF2F",
      "--zweispaltig-soft": "#F2F2F2",
    });
    expect(resolveCvDocument({ profile, templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") })
      .zweispaltigVariables).toBeUndefined();
  });

  it("isolates employer ink from subtitle, legacy highlights and card surfaces", () => {
    const selected = application("#EE7B24", "#9D4616", {
      colors: { subheading: "#112233", accent: "#445566", employer: "#12E203", surface: "#51BD6C" },
    });
    const reopened = applicationSchema.parse(JSON.parse(JSON.stringify(selected)));
    const resolved = resolveCvDocument({ profile, templateId: "zweispaltig", settings: reopened.designSettings, application: reopened });
    expect(resolved.zweispaltigVariables).toMatchObject({
      "--zweispaltig-primary": "#EE7B24", "--zweispaltig-subheading": "#112233",
      "--zweispaltig-accent": "#112233", "--zweispaltig-employer": "#12E203", "--zweispaltig-soft": "#51BD6C",
    });
    const previous = { ...selected, designSettings: { ...selected.designSettings,
      cvOverrides: { colors: { subheading: "#112233", accent: "#445566", surface: "#51BD6C" } } } };
    const letterStyle = (value: typeof selected) => parseHTML(buildDocumentHtml(value, profile, "anschreiben"))
      .document.querySelector(".zweispaltig-letter")?.getAttribute("style");
    expect(letterStyle(selected)).toBe(letterStyle(previous));
    expect(selected.secondaryColor).toBe("#9D4616");
  });

  it("preserves old subtitle-only colour choices until an employer colour is explicitly chosen", () => {
    const old = application("#EE7B24", "#9D4616", { colors: { subheading: "#334455" } });
    const resolved = resolveCvDocument({ profile, templateId: "zweispaltig", settings: old.designSettings, application: old });
    expect(resolved.zweispaltigVariables).toMatchObject({
      "--zweispaltig-subheading": "#334455", "--zweispaltig-employer": "#334455", "--zweispaltig-accent": "#334455",
    });
    const edited = application("#EE7B24", "#9D4616", { colors: { subheading: "#334455", employer: "#12E203" } });
    expect(resolveCvDocument({ profile, templateId: "zweispaltig", settings: edited.designSettings, application: edited })
      .zweispaltigVariables).toMatchObject({ "--zweispaltig-subheading": "#334455", "--zweispaltig-employer": "#12E203" });
  });
});
