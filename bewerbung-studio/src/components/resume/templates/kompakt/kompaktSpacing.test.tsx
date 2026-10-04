import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { KompaktResume } from "./KompaktResume";
import { kompaktDefaults } from "./kompakt.defaults";
import { moveManagerSection, updateManagerSection } from "../../../../features/resume-sections/resume-manager";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "../../../../shared/cvDesign";
import { createDocumentDesignDraft } from "../../../../shared/documentEditorState";
import { applyResumeSpacingPreset, getResumeSpacingPresetValues } from "../../../../shared/resumeSpacing";
import { applyManagedResumeOutput } from "../../../../shared/resumeManagedOutput";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";

const template = getTemplate("kompakt");
const now = "2026-09-28T12:00:00.000Z";
const projectId = "81000000-0000-4000-8000-000000000001";
const interestsId = "81000000-0000-4000-8000-000000000002";

const baseProfile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", updatedAt: now,
  phone: "+49 176 12345678", email: "mina.long.address@example-application-company.com",
  linkedin: "https://www.linkedin.com/in/mina-kaya-application-development-profile-2026",
  portfolio: "https://www.example-software-portfolio.dev/projects/development",
  city: "Marburg", country: "Deutschland",
  summary: "Erfahrung mit verlässlichen Webanwendungen.",
  languages: ["Deutsch – C1"],
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
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "Kompakt QA", company: { name: "Firma", city: "Berlin" },
  contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "kompakt",
  accentColor: template.accent, secondaryColor: template.secondary, documents: {},
  statusHistory: [], createdAt: now, updatedAt: now,
});

const renderSurfaces = (profile = baseProfile, settings = getTemplateDocumentDesignDefaults("kompakt")) => {
  const resolved = resolveCvDocument({ profile, templateId: "kompakt", settings });
  const plan = resolved.pagePlan[0];
  const previewHtml = renderToStaticMarkup(createElement(KompaktResume, {
    profile: resolved.profile, name: "Mina Kaya", atsMode: false, plan,
    totalPages: resolved.pagePlan.length, accentColor: template.accent,
    secondaryColor: template.secondary, backgroundId: settings.backgroundId,
    photoSource: resolved.profile?.photoPath || null, resumeProfile: "", sections: resolved.sections,
  }));
  const preview = applyManagedResumeOutput(previewHtml, resolved.profile, "kompakt", 1, resolved.pagePlan.length, settings, resolved);
  const pdf = buildDocumentHtml({ ...application, designSettings: settings }, profile, "lebenslauf");
  return [preview, pdf] as const;
};

describe("Kompakt spacing and section output", () => {
  it("uses one native gap source and keeps user-placed sections styled in both surfaces", () => {
    let profile = moveManagerSection(baseProfile, "kompakt", `special:${projectId}`, "main", 2);
    profile = moveManagerSection(profile, "kompakt", `special:${interestsId}`, "sidebar", 2);
    const [preview, pdf] = renderSurfaces(profile);
    for (const html of [preview, pdf]) {
      const { document } = parseHTML(html);
      const root = document.querySelector(".kompakt-template,.kompakt-pdf")!;
      const columns = root.querySelector(".kompakt-content,.kompakt-pdf-columns")!;
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
      expect(project.getAttribute("data-custom-template")).toBe("kompakt");
      expect(interests.getAttribute("data-custom-template")).toBe("kompakt");
      expect(project.querySelector('[data-custom-role="heading"]')).not.toBeNull();
      expect(interests.querySelector('[data-custom-role="heading"]')).not.toBeNull();
      expect(project.textContent).toContain("Open Source");
      expect(interests.textContent).toContain("Fotografie");
      expect(Array.from(main.children).indexOf(project)).toBeGreaterThan(Array.from(main.children).indexOf(experience));
      expect(html).toContain(`--kompakt-header-content-gap:${kompaktDefaults.layout.headerToContentGapMm}mm`);
      expect(html).toContain(`--kompakt-entry-gap-base:${kompaktDefaults.layout.entryGapMm}mm`);
      expect(html).toContain(`--kompakt-section-title-gap:${kompaktDefaults.layout.sectionTitleGapMm}mm`);
    }
  });

  it("keeps the native 62/38 columns and independent default project and interests sections", () => {
    expect(template.sidebarWidthRatio).toBe(0.38);
    expect(template.supportsPhoto).toBe(true);
    for (const html of renderSurfaces()) {
      const { document } = parseHTML(html);
      const main = document.querySelector(".kompakt-content main,.kompakt-pdf-columns main")!;
      const project = main.querySelector(`[data-managed-section="special:${projectId}"]`)!;
      const interests = main.querySelector(`[data-managed-section="special:${interestsId}"]`)!;
      expect(project.parentElement).toBe(main);
      expect(interests.parentElement).toBe(main);
      expect(main.querySelector('[data-managed-section="languages"]')?.contains(project)).toBe(false);
      expect(project.querySelector('[data-custom-role="heading"]')?.textContent).toBe("Projekt-Highlight");
      expect(interests.querySelector('[data-custom-role="heading"]')?.textContent).toBe("Hobbys & Interesses");
    }
  });

  it("hides contacts and summary without erasing profile data", () => {
    const hidden = updateManagerSection(updateManagerSection(baseProfile, "kompakt", "personalData", { visible: false }), "kompakt", "summary", { visible: false });
    expect(hidden.email).toBe(baseProfile.email);
    for (const html of renderSurfaces(hidden)) {
      const { document } = parseHTML(html);
      expect(document.querySelector(".kompakt-content address,.kompakt-pdf-columns address")).toBeNull();
      expect(document.querySelector('[data-managed-section="summary"]')).toBeNull();
      expect(document.querySelector(".kompakt-content,.kompakt-pdf-columns")?.textContent).not.toContain("Kontaktdaten");
    }
  });

  it("renders the profile photo and respects its visibility setting", () => {
    const photoPath = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=";
    const withPhoto = updateManagerSection(profileSchema.parse({ ...baseProfile, photoPath }), "kompakt", "photo", { visible: true });
    for (const html of renderSurfaces(withPhoto)) {
      const { document } = parseHTML(html);
      expect(document.querySelector(".kompakt-header__photo,.kompakt-pdf-photo")?.getAttribute("src")).toBe(photoPath);
    }
    const hidden = updateManagerSection(withPhoto, "kompakt", "photo", { visible: false });
    for (const html of renderSurfaces(hidden)) {
      const { document } = parseHTML(html);
      expect(document.querySelector(".kompakt-header__photo,.kompakt-pdf-photo")).toBeNull();
    }
  });

  it("keeps a chosen column ratio on both outputs", () => {
    const settings = { ...getTemplateDocumentDesignDefaults("kompakt"), resumePresentation: { sidebarWidthPercent: 35 as const } };
    for (const html of renderSurfaces(baseProfile, settings)) {
      const { document } = parseHTML(html);
      const host = document.querySelector('[data-resume-layout="two-column"]')!;
      expect(host.getAttribute("data-resume-sidebar-side")).toBe("right");
      expect(host.getAttribute("style")).toContain("65fr");
      expect(host.getAttribute("style")).toContain("35fr");
    }
  });

  it("does not leave an empty Ausbildung heading at a PDF page break", () => {
    const long = "Koordination und Dokumentation komplexer Abläufe mit mehreren Beteiligten und termingerechter Umsetzung.";
    const heavy = profileSchema.parse({ ...baseProfile, experiences: baseProfile.experiences.map((item) => ({
      ...item, achievements: [...item.achievements, ...Array.from({ length: 30 }, () => long)],
    })) });
    const { document } = parseHTML(buildDocumentHtml(application, heavy, "lebenslauf"));
    const pages = document.querySelectorAll('.cv-sheet[data-template="kompakt"]');
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) for (const section of page.querySelectorAll('[data-managed-section="experience"],[data-managed-section="education"]'))
      expect(section.querySelector(".managed-pdf-entry")).not.toBeNull();
  });

  it.each(["compact", "standard", "large"] as const)("keeps %s entry and section controls independent in preview and PDF", (preset) => {
    const draft = applyResumeSpacingPreset(createDocumentDesignDraft(application), preset);
    const [preview, pdf] = renderSurfaces(baseProfile, draft.settings);
    for (const html of [preview, pdf]) {
      const { document } = parseHTML(html);
      const scope = document.querySelector(".kompakt-template,.kompakt-pdf")!;
      const careerLists = scope.querySelectorAll(".kompakt-career__list,.managed-pdf-list");
      expect(careerLists).toHaveLength(2);
      if (preset === "standard") {
        expect(scope.hasAttribute("data-resume-spacing-entry-gap")).toBe(false);
      } else {
        const expected = getResumeSpacingPresetValues("kompakt", preset);
        expect(scope.getAttribute("style")).toContain(`--kompakt-entry-gap-base:${expected.spacing.entryGapMm}mm`);
        expect(scope.getAttribute("style")).toContain(`--kompakt-section-gap-base:${expected.spacing.sectionGapMm}mm`);
        // Kompakt's native line height already sits at the lower limit, so "compact" leaves it alone.
        if (expected.lineHeight !== resolveTemplateCvDesign("kompakt").typography.lineHeight)
          expect(scope.getAttribute("style")).toContain(`--doc-line-height:${expected.lineHeight}`);
        expect(scope.hasAttribute("data-resume-spacing-entry-gap")).toBe(true);
        expect(scope.hasAttribute("data-resume-spacing-section-gap")).toBe(true);
        for (const list of careerLists) expect(list.querySelector('[data-resume-spacing-entry-following]')).not.toBeNull();
      }
    }
  });

  it("retains old section-spacing slider values without altering entry spacing", () => {
    const settings = { ...getTemplateDocumentDesignDefaults("kompakt"), sectionSpacingLevel: 8 as const };
    for (const html of renderSurfaces(baseProfile, settings)) {
      const { document } = parseHTML(html);
      const scope = document.querySelector(".kompakt-template,.kompakt-pdf")!;
      expect(scope.getAttribute("style")).toContain("--kompakt-section-gap-base:6.8mm");
      expect(scope.hasAttribute("data-resume-spacing-entry-gap")).toBe(false);
    }
  });
});
