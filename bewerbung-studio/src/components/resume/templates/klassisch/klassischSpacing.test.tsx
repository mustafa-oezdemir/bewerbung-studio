import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { updateManagerSection } from "../../../../features/resume-sections/resume-manager";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { createDocumentDesignDraft } from "../../../../shared/documentEditorState";
import { applyResumeSpacingPreset, getResumeSpacingPresetValues } from "../../../../shared/resumeSpacing";
import { applyManagedResumeOutput } from "../../../../shared/resumeManagedOutput";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { KlassischResume } from "./KlassischResume";
import { klassischDefaults } from "./klassisch.defaults";

const template = getTemplate("klassisch");
const now = "2026-09-28T12:00:00.000Z";
const projectId = "82000000-0000-4000-8000-000000000001";
const interestsId = "82000000-0000-4000-8000-000000000002";

const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", updatedAt: now,
  email: "mina@example.com", city: "Marburg", summary: "Erfahrung mit verlässlichen Anwendungen.",
  strengths: [{ id: crypto.randomUUID(), title: "Teamarbeit" }], languages: ["Deutsch – C1"], certifications: ["Kurs"],
  experiences: [
    { id: crypto.randomUUID(), role: "Praktikum", company: "Beispiel GmbH", from: "2024", to: "2025", achievements: ["Produkt gebaut"] },
    { id: crypto.randomUUID(), role: "Prozessplanerin", company: "Zukunft GmbH", from: "2022", to: "2023", achievements: ["Abläufe verbessert"] },
  ],
  education: [
    { id: crypto.randomUUID(), degree: "Fachinformatikerin", institution: "IAD GmbH", from: "2020", to: "2022" },
    { id: crypto.randomUUID(), degree: "Abitur", institution: "Gymnasium", from: "2017", to: "2020" },
  ],
  specialSections: [
    { id: projectId, kind: "projects", title: "Projekt-Highlight", contentType: "list", entries: [{ id: crypto.randomUUID(), title: "Open Source" }] },
    { id: interestsId, kind: "interests", title: "Hobbys & Interesses", contentType: "text", entries: [{ id: crypto.randomUUID(), title: "Fotografie" }] },
  ],
});

const application = applicationSchema.parse({
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "Klassisch QA", company: { name: "Firma", city: "Berlin" },
  contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "klassisch",
  accentColor: template.accent, secondaryColor: template.secondary, documents: {},
  statusHistory: [], createdAt: now, updatedAt: now,
});

const renderSurfaces = (source = profile, settings = getTemplateDocumentDesignDefaults("klassisch")) => {
  const resolved = resolveCvDocument({ profile: source, templateId: "klassisch", settings });
  // Every page of the preview (the 11 pt layout may need a second page), like the PDF.
  const preview = resolved.pagePlan.map((plan) => applyManagedResumeOutput(renderToStaticMarkup(createElement(KlassischResume, {
    profile: resolved.profile, name: "Mina Kaya", atsMode: false, plan,
    totalPages: resolved.pagePlan.length, accentColor: template.accent,
    secondaryColor: template.secondary, backgroundId: settings.backgroundId,
    photoSource: source.photoPath || null, resumeProfile: "", sections: resolved.sections,
  })), resolved.profile, "klassisch", plan.pageNumber, resolved.pagePlan.length, settings, resolved)).join("");
  const pdf = buildDocumentHtml({ ...application, designSettings: settings }, source, "lebenslauf");
  return [preview, pdf] as const;
};

describe("Klassisch spacing and section output", () => {
  it("renders profile entries and independent custom sections on both surfaces", () => {
    for (const html of renderSurfaces()) {
      const { document } = parseHTML(html);
      const root = document.querySelector(".klassisch-template,.klassisch-pdf")!;
      const experience = root.querySelector('[data-managed-section="experience"]')!;
      const education = root.querySelector('[data-managed-section="education"]')!;
      const project = document.querySelector(`[data-managed-section="special:${projectId}"]`)!;
      const interests = document.querySelector(`[data-managed-section="special:${interestsId}"]`)!;
      expect(root.textContent).toContain("Mina Kaya");
      expect(root.textContent).toContain(profile.summary);
      expect(experience.querySelectorAll("article")).toHaveLength(2);
      expect(education.querySelectorAll("article")).toHaveLength(2);
      // Custom sections flow in the same content host as the career sections, on whichever page the plan puts them.
      const host = ".klassisch-content,.klassisch-pdf-content";
      expect(project.parentElement?.matches(host)).toBe(true);
      expect(interests.parentElement?.matches(host)).toBe(true);
      expect(experience.parentElement?.matches(host)).toBe(true);
      expect(education.parentElement?.matches(host)).toBe(true);
      expect(project.querySelector('[data-custom-role="heading"]')?.textContent).toBe("Projekt-Highlight");
      expect(interests.querySelector('[data-custom-role="heading"]')?.textContent).toBe("Hobbys & Interesses");
      expect(project.textContent).toContain("Open Source");
      expect(interests.textContent).toContain("Fotografie");
      expect(html).toContain(`--klassisch-entry-gap-base:${klassischDefaults.layout.entryGapMm}mm`);
      expect(html).toContain(`--klassisch-section-title-gap:${klassischDefaults.layout.sectionTitleGapMm}mm`);
    }
  });

  it("honors visibility without changing stored profile values", () => {
    let hidden = updateManagerSection(profile, "klassisch", "summary", { visible: false });
    hidden = updateManagerSection(hidden, "klassisch", "personalData", { visible: false });
    hidden = updateManagerSection(hidden, "klassisch", `special:${projectId}`, { visible: false });
    expect(hidden.email).toBe(profile.email);
    expect(hidden.summary).toBe(profile.summary);
    for (const html of renderSurfaces(hidden)) {
      const { document } = parseHTML(html);
      expect(document.querySelector('[data-managed-section="summary"]')).toBeNull();
      expect(document.querySelector(`[data-managed-section="special:${projectId}"]`)).toBeNull();
      expect(document.querySelector(".klassisch-header address,.klassisch-pdf-contacts")).toBeNull();
      expect(document.querySelector(`[data-managed-section="special:${interestsId}"]`)).not.toBeNull();
    }
  });

  it("keeps photo visibility and a chosen section-title color in both outputs", () => {
    const photoPath = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=";
    const withPhoto = updateManagerSection(profileSchema.parse({ ...profile, photoPath }), "klassisch", "photo", { visible: true });
    const settings = { ...getTemplateDocumentDesignDefaults("klassisch"), cvOverrides: { colors: { sectionHeading: "#B52323" } } };
    for (const html of renderSurfaces(withPhoto, settings)) {
      const { document } = parseHTML(html);
      expect(document.querySelector(".klassisch-header img,.klassisch-pdf-photo")?.getAttribute("src")).toBe(photoPath);
      for (const heading of document.querySelectorAll('[data-managed-section="experience"] > h2,[data-managed-section="experience"] > h3,[data-managed-section="special:82000000-0000-4000-8000-000000000001"] [data-custom-role="heading"]'))
        expect(heading.getAttribute("style")).toContain("#B52323");
    }
    const hidden = updateManagerSection(withPhoto, "klassisch", "photo", { visible: false });
    for (const html of renderSurfaces(hidden)) {
      const { document } = parseHTML(html);
      expect(document.querySelector(".klassisch-header img,.klassisch-pdf-photo")).toBeNull();
    }
  });

  it.each(["compact", "standard", "large"] as const)("applies %s spacing independently to entries and sections", (preset) => {
    const draft = applyResumeSpacingPreset(createDocumentDesignDraft(application), preset);
    for (const html of renderSurfaces(profile, draft.settings)) {
      const { document } = parseHTML(html);
      const root = document.querySelector(".klassisch-template,.klassisch-pdf")!;
      const lists = root.querySelectorAll(".klassisch-career>div,.klassisch-pdf-list");
      expect(lists).toHaveLength(2);
      if (preset === "standard") {
        expect(root.hasAttribute("data-resume-spacing-entry-gap")).toBe(false);
      } else {
        const expected = getResumeSpacingPresetValues("klassisch", preset);
        expect(root.getAttribute("style")).toContain(`--doc-entry-gap:${expected.spacing.entryGapMm}mm`);
        expect(root.getAttribute("style")).toContain(`--doc-line-height:${expected.lineHeight}`);
        expect(root.hasAttribute("data-resume-spacing-entry-gap")).toBe(true);
        expect(root.hasAttribute("data-resume-spacing-section-gap")).toBe(true);
        for (const list of lists) expect(list.querySelector('[data-resume-spacing-entry-following]')).not.toBeNull();
        expect(document.querySelector(`[data-managed-section="special:${projectId}"] [data-resume-spacing-title]`)).not.toBeNull();
      }
    }
  });
});
