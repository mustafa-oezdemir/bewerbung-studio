import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { getManagerSections, managerAllowedZones, managerZones, moveManagerSection, reorderManagerSection, updateManagerSection } from "./resume-manager";
import { resolveResumeSectionInstances } from "./resume-section-system";

const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
describe("unified resume manager", () => {
  it("merges semantic controls with profile data and template-specific defaults without duplicates", () => {
    const entries = getManagerSections(profile, "pehlione_white");
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.filter((entry) => entry.title === "Kernkompetenzen")).toHaveLength(1);
    expect(entries.some((entry) => entry.title === "Projekt-Highlight")).toBe(true);
    expect(getManagerSections(profile, "modern").some((entry) => entry.title === "Projekt-Highlight")).toBe(false);
  });
  it("syncs required-section toggles and titles with both legacy and semantic renderers", () => {
    const changed = updateManagerSection(profile, "modern", "experience", { visible: false, title: "Praxis" });
    expect(changed.resumeSections.experience).toBe(false);
    expect(changed.resumeSectionTitles.experience).toBe("Praxis");
    expect(resolveResumeSectionInstances(changed.resumeSemanticSections).find((entry) => entry.semanticType === "career")).toMatchObject({ visible: false, customTitle: "Praxis" });
    expect(updateManagerSection(changed, "modern", "experience", { visible: true }).resumeSections.experience).toBe(true);
  });
  it("keeps layouts per template and allows every section in either column", () => {
    const changed = moveManagerSection(profile, "modern", "education", "main", 0);
    expect(changed.resumeManagerLayouts.modern.filter((entry) => entry.zone === "main")[0].id).toBe("education");
    expect(changed.resumeManagerLayouts.kompakt).toBeUndefined();
    const moved = moveManagerSection(changed, "modern", "experience", "sidebar", 0);
    expect(getManagerSections(moved, "modern").find((entry) => entry.id === "experience")?.zone).toBe("sidebar");
    expect(getManagerSections(moveManagerSection(moved, "einspaltig", "summary", "sidebar", 0), "einspaltig")
      .find((entry) => entry.id === "summary")?.zone).toBe("sidebar");
    expect(profile.resumeManagerLayouts).toEqual({});
  });
  it.each(["tabellarisch", "klassisch", "einspaltig", "ivy-league"])("reorders %s globally while preserving saved zones", (templateId) => {
    const arranged = { ...profile, resumeManagerLayouts: { ...profile.resumeManagerLayouts,
      [templateId]: [
        { id: "experience", zone: "main" as const },
        { id: "education", zone: "main" as const },
        { id: "summary", zone: "sidebar" as const },
        { id: "strengths", zone: "sidebar" as const },
      ],
    } };
    const once = reorderManagerSection(arranged, templateId, "summary", 1);
    const twice = reorderManagerSection(once, templateId, "summary", 0);
    expect(getManagerSections(once, templateId).filter((entry) => !entry.fixed).slice(0, 4).map((entry) => entry.id))
      .toEqual(["experience", "summary", "education", "strengths"]);
    expect(getManagerSections(twice, templateId).filter((entry) => !entry.fixed).slice(0, 4).map((entry) => entry.id))
      .toEqual(["summary", "experience", "education", "strengths"]);
    expect(getManagerSections(twice, templateId).find((entry) => entry.id === "summary")?.zone).toBe("sidebar");
    expect(twice.resumeManagerLayouts.modern).toBeUndefined();
    expect(managerZones(templateId, "single")).toEqual(["main"]);
    expect(managerAllowedZones(templateId, "summary", "single")).toEqual(["main"]);
    expect(managerZones(templateId, "two-column")).toEqual(["main", "sidebar"]);
  });
});
