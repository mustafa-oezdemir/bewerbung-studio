import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { getManagerSections, moveManagerSection, updateManagerSection } from "./resume-manager";
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
});
