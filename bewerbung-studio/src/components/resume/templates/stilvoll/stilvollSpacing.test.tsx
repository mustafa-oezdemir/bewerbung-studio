import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { StilvollResume } from "./StilvollResume";
import { stilvollDefaults } from "./stilvoll.defaults";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { createDocumentDesignDraft } from "../../../../shared/documentEditorState";
import { applyResumeSpacingPreset, getResumeSpacingPresetValues } from "../../../../shared/resumeSpacing";
import { applyManagedResumeOutput } from "../../../../shared/resumeManagedOutput";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";

const template = getTemplate("stilvoll");
const now = "2026-09-28T12:00:00.000Z";
const projectId = "81000000-0000-4000-8000-000000000001";
const interestsId = "81000000-0000-4000-8000-000000000002";

const baseProfile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", updatedAt: now,
  summary: "Erfahrung mit verlässlichen Webanwendungen.",
  strengths: [{ id: crypto.randomUUID(), title: "Teamarbeit" }],
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
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "Stilvoll QA", company: { name: "Firma", city: "Berlin" },
  contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "stilvoll",
  accentColor: template.accent, secondaryColor: template.secondary, documents: {},
  statusHistory: [], createdAt: now, updatedAt: now,
});

const renderSurfaces = (profile = baseProfile, settings = getTemplateDocumentDesignDefaults("stilvoll")) => {
  const resolved = resolveCvDocument({ profile, templateId: "stilvoll", settings });
  const plan = resolved.pagePlan[0];
  const previewHtml = renderToStaticMarkup(createElement(StilvollResume, {
    profile: resolved.profile, name: "Mina Kaya", atsMode: false, plan,
    totalPages: resolved.pagePlan.length, accentColor: template.accent,
    secondaryColor: template.secondary, backgroundId: settings.backgroundId,
    photoSource: null, resumeProfile: "", sections: resolved.sections,
  }));
  const preview = applyManagedResumeOutput(previewHtml, resolved.profile, "stilvoll", 1, resolved.pagePlan.length, settings, resolved);
  const pdf = buildDocumentHtml({ ...application, designSettings: settings }, profile, "lebenslauf");
  return [preview, pdf] as const;
};

describe("Stilvoll spacing and section output", () => {
  it("uses one native gap source and keeps user-placed sections styled in both surfaces", () => {
    let profile = moveManagerSection(baseProfile, "stilvoll", `special:${projectId}`, "main", 2);
    profile = moveManagerSection(profile, "stilvoll", `special:${interestsId}`, "sidebar", 2);
    const [preview, pdf] = renderSurfaces(profile);
    for (const html of [preview, pdf]) {
      const { document } = parseHTML(html);
      const root = document.querySelector(".stilvoll-template,.stilvoll-pdf")!;
      const columns = root.querySelector(".stilvoll-content,.stilvoll-pdf-columns")!;
      const main = columns.querySelector("main")!;
      const sidebar = columns.querySelector("aside")!;
      const experience = main.querySelector('[data-managed-section="experience"]')!;
      const education = main.querySelector('[data-managed-section="education"]')!;
      const project = main.querySelector(`[data-managed-section="special:${projectId}"]`)!;
      const interests = sidebar.querySelector(`[data-managed-section="special:${interestsId}"]`)!;
      expect(root.textContent).toContain("Mina Kaya");
      expect(sidebar.textContent).toContain(baseProfile.summary);
      expect(experience.querySelectorAll("article")).toHaveLength(2);
      expect(education.querySelectorAll("article")).toHaveLength(2);
      expect(project.getAttribute("data-custom-template")).toBe("stilvoll");
      expect(interests.getAttribute("data-custom-template")).toBe("stilvoll");
      expect(project.querySelector('[data-custom-role="heading"]')).not.toBeNull();
      expect(interests.querySelector('[data-custom-role="heading"]')).not.toBeNull();
      expect(project.textContent).toContain("Open Source");
      expect(interests.textContent).toContain("Fotografie");
      expect(Array.from(main.children).indexOf(project)).toBeGreaterThan(Array.from(main.children).indexOf(experience));
      expect(html).toContain(`--stilvoll-header-content-gap:${stilvollDefaults.layout.headerToContentGapMm}mm`);
      expect(html).toContain(`--stilvoll-entry-gap-base:${stilvollDefaults.layout.entryGapMm}mm`);
      expect(html).toContain(`--stilvoll-section-title-gap:${stilvollDefaults.layout.sectionTitleGapMm}mm`);
    }
  });

  it.each(["compact", "standard", "large"] as const)("keeps %s entry and section controls independent in preview and PDF", (preset) => {
    const draft = applyResumeSpacingPreset(createDocumentDesignDraft(application), preset);
    const [preview, pdf] = renderSurfaces(baseProfile, draft.settings);
    for (const html of [preview, pdf]) {
      const { document } = parseHTML(html);
      const scope = document.querySelector(".stilvoll-template,.stilvoll-pdf")!;
      const careerLists = scope.querySelectorAll(".stilvoll-career__list,.managed-pdf-list");
      expect(careerLists).toHaveLength(2);
      if (preset === "standard") {
        expect(scope.hasAttribute("data-resume-spacing-entry-gap")).toBe(false);
      } else {
        const expected = getResumeSpacingPresetValues("stilvoll", preset);
        expect(scope.getAttribute("style")).toContain(`--stilvoll-entry-gap-base:${expected.spacing.entryGapMm}mm`);
        expect(scope.getAttribute("style")).toContain(`--stilvoll-section-gap-base:${expected.spacing.sectionGapMm}mm`);
        expect(scope.getAttribute("style")).toContain(`--doc-line-height:${expected.lineHeight}`);
        expect(scope.hasAttribute("data-resume-spacing-entry-gap")).toBe(true);
        expect(scope.hasAttribute("data-resume-spacing-section-gap")).toBe(true);
        for (const list of careerLists) expect(list.querySelector('[data-resume-spacing-entry-following]')).not.toBeNull();
      }
    }
  });

  it("retains old section-spacing slider values without altering entry spacing", () => {
    const settings = { ...getTemplateDocumentDesignDefaults("stilvoll"), sectionSpacingLevel: 8 as const };
    for (const html of renderSurfaces(baseProfile, settings)) {
      const { document } = parseHTML(html);
      const scope = document.querySelector(".stilvoll-template,.stilvoll-pdf")!;
      expect(scope.getAttribute("style")).toContain("--stilvoll-section-gap-base:7.8mm");
      expect(scope.hasAttribute("data-resume-spacing-entry-gap")).toBe(false);
    }
  });
});
