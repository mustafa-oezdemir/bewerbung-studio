import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { reorderManagerSection } from "../../features/resume-sections/resume-manager";
import { renderCv } from "./__parityHarness";

const templates = ["tabellarisch", "klassisch", "einspaltig", "ivy-league"] as const;
const specialId = "ad000000-0000-4000-8000-000000000099";
const profile = () => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  updatedAt: "2026-10-07T10:00:00.000Z", summary: "Kurzprofil mit Erfahrung in der Entwicklung und Dokumentation.",
  strengths: [{ id: crypto.randomUUID(), title: "Teamarbeit", description: "" }],
  languages: ["Deutsch – C1"],
  specialSections: [{ id: specialId, kind: "custom", title: "Fiktives Projekt", isVisible: true,
    contentType: "list", entries: [{ id: crypto.randomUUID(), title: "Planungswerkzeug", description: "", bullets: [] }] }],
  experiences: Array.from({ length: 8 }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`,
    role: `Fiktive Position ${index + 1}`, company: `Beispielbetrieb ${index + 1}`, city: "Musterstadt",
    achievements: Array.from({ length: 5 }, (_, bullet) =>
      `Aufgabe ${index + 1}.${bullet + 1}: ${"Prozessanalyse und Dokumentation ".repeat(6)}`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2008", to: "2012", degree: "Industrieingenieurwesen", institution: "Muster Hochschule" }],
});

const ids = (pages: Element[]) => pages.flatMap((page) => Array.from(page.querySelectorAll("[data-managed-section]"),
  (section) => section.getAttribute("data-managed-section")!));

describe("single-column manager order across career pages", () => {
  it("uses one order when a native two-column template is set to single", () => {
    const base = profile();
    const arranged = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts, modern: [
      { id: "experience", zone: "main" as const }, { id: "summary", zone: "sidebar" as const },
      { id: "education", zone: "main" as const },
    ] } };
    const result = renderCv("modern", arranged, { overrides: { resumePresentation: { layoutMode: "single" } } });
    const order = ids(result.previewPages);
    expect(ids(result.pdfPages)).toEqual(order);
    expect(order.lastIndexOf("experience")).toBeLessThan(order.indexOf("summary"));
    expect(order.indexOf("summary")).toBeLessThan(order.indexOf("education"));
    expect(result.resolved.layout.mode).toBe("single");
  });
  it.each(templates)("renders mixed career and block order in %s preview and PDF", (templateId) => {
    const base = profile();
    const withSavedZones = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts,
      [templateId]: [
        { id: "experience", zone: "main" as const }, { id: "summary", zone: "sidebar" as const },
        { id: "education", zone: "main" as const }, { id: "knowledge", zone: "sidebar" as const },
        { id: `special:${specialId}`, zone: "sidebar" as const },
      ],
    } };
    const arranged = reorderManagerSection(withSavedZones, templateId, "summary", 1);
    const result = renderCv(templateId, arranged);
    const preview = ids(result.previewPages);
    const pdf = ids(result.pdfPages);
    expect(result.previewPages.length).toBeGreaterThan(1);
    expect(pdf).toEqual(preview);
    result.resolved.pagePlan.forEach((page, index) => {
      for (const id of ["summary", "strengths", "languages"]) {
        expect(Boolean(result.previewPages[index].querySelector(`[data-managed-section="${id}"]`)), `${templateId} page ${index + 1} ${id}`)
          .toBe(Boolean(page.blocks?.includes(id)));
      }
    });
    expect(preview.lastIndexOf("experience")).toBeLessThan(preview.indexOf("summary"));
    expect(preview.indexOf("summary")).toBeLessThan(preview.indexOf("education"));
    expect(preview.filter((id) => id === "summary")).toHaveLength(1);
    expect(preview.filter((id) => id === "education")).toHaveLength(1);
    expect(preview.filter((id) => id === "strengths")).toHaveLength(1);
    expect(preview.filter((id) => id === "languages")).toHaveLength(1);
    expect(preview.filter((id) => id === `special:${specialId}`)).toHaveLength(1);
    expect(preview.indexOf("education")).toBeLessThan(preview.indexOf(`special:${specialId}`));
    expect(arranged.resumeManagerLayouts[templateId].find((entry) => entry.id === "summary")?.zone).toBe("sidebar");
  });
  it.each(templates)("keeps the saved sidebar zone when %s switches to two columns", (templateId) => {
    const base = profile();
    const arranged = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts,
      [templateId]: [
        { id: "experience", zone: "main" as const },
        { id: "summary", zone: "sidebar" as const },
        { id: "education", zone: "main" as const },
      ],
    } };
    const result = renderCv(templateId, arranged, { overrides: { resumePresentation: { layoutMode: "two-column" } } });
    expect(result.resolved.layout.mode).toBe("two-column");
    for (const pages of [result.previewPages, result.pdfPages]) {
      const summary = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section="summary"]')));
      expect(summary).toHaveLength(1);
      expect(summary[0].closest('[data-resume-layout-zone="sidebar"]')).not.toBeNull();
    }
  });
});
