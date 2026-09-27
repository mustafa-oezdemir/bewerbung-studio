import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "./schema";
import { getTemplate, templates } from "./templates";
import { defaultDocumentDesign } from "./documentDesign";
import { resolveResumeLayout } from "./resumeLayoutEngine";
import { applyManagedResumeOutput } from "./resumeManagedOutput";
import { buildDocumentHtml } from "../../electron/documents";

const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(),
  summary: "Kurzprofil", experiences: [{ id: crypto.randomUUID(), role: "Entwicklerin", company: "Beispiel", from: "2023", to: "2025", achievements: [] }],
});

describe("shared resume layout engine", () => {
  it.each(templates)("keeps $name native without an override", ({ id, sidebarWidthRatio }) => {
    const resolved = resolveResumeLayout(id, undefined);
    expect(resolved.overridden).toBe(false);
    expect(resolved.sidebarWidthPercent).toBe(Math.round((sidebarWidthRatio ?? .3) * 100));
  });

  it("accepts safe ratios, orientation, ATS and serialization", () => {
    for (const percent of [20, 25, 30, 35, 40] as const) {
      const settings = { layoutMode: "two-column" as const, sidebarSide: "left" as const, sidebarWidthPercent: percent };
      expect(resolveResumeLayout("einspaltig", JSON.parse(JSON.stringify(settings)))).toMatchObject({
        mode: "two-column", sidebarSide: "left", sidebarWidthPercent: percent, overridden: true,
      });
      expect(resolveResumeLayout("einspaltig", settings, true).mode).toBe("single");
    }
  });

  it("keeps a saved Pehlione profile ratio when only the side changes", () => {
    expect(resolveResumeLayout("pehlione_white", { sidebarSide: "right" }, false, 40)).toMatchObject({
      mode: "two-column", sidebarSide: "right", sidebarWidthPercent: 40,
    });
  });

  it("moves a native sidebar with the same result in preview and PDF", () => {
    const id = "zweispaltig";
    const settings = { ...defaultDocumentDesign, resumePresentation: { layoutMode: "two-column" as const, sidebarSide: "left" as const, sidebarWidthPercent: 25 as const } };
    const preview = '<div class="zweispaltig-columns"><main><section><h3>Berufserfahrung</h3></section></main><aside><section><h3>Zusammenfassung</h3></section></aside></div>';
    const now = new Date().toISOString();
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Layout", company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: id, accentColor: getTemplate(id).accent, secondaryColor: getTemplate(id).secondary, designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
    const documents = [parseHTML(applyManagedResumeOutput(preview, profile, id, 1, 1, settings)).document,
      parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document];
    for (const document of documents) {
      const host = document.querySelector('[data-resume-layout="two-column"]')!;
      expect(host.getAttribute("data-resume-sidebar-side")).toBe("left");
      expect(host.getAttribute("style")).toContain("25fr");
      expect(host.querySelector("aside")?.getAttribute("style")).toContain("grid-column:1");
      expect(host.querySelector("main")?.getAttribute("style")).toContain("grid-column:2");
    }
  });

  it("creates two columns for a native single-column CV while keeping its header full width", () => {
    const html = '<article class="einfach-template"><div class="einfach-content"><header>Lebenslauf</header><section data-managed-section="summary"><h2>Zusammenfassung</h2></section><section data-managed-section="experience"><h2>Berufserfahrung</h2></section></div></article>';
    const settings = { ...defaultDocumentDesign, resumePresentation: { layoutMode: "two-column" as const, sidebarSide: "right" as const, sidebarWidthPercent: 40 as const } };
    const document = parseHTML(applyManagedResumeOutput(html, profile, "einspaltig", 1, 1, settings)).document;
    const host = document.querySelector('[data-resume-layout="two-column"]')!;
    expect(host.querySelector("header")?.getAttribute("style")).toContain("grid-column:1 / -1");
    expect(host.querySelector('[data-resume-layout-zone="sidebar"] [data-managed-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-resume-layout-zone="main"] [data-managed-section="experience"]')).not.toBeNull();
    expect(host.getAttribute("style")).toContain("40fr");
  });
});
