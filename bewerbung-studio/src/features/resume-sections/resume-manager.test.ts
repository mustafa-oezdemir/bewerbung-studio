import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import {
  effectiveManagerZone, getManagerSections, managerAllowedZones, managerZones, moveManagerSection, reorderManagerSection, updateManagerSection,
} from "./resume-manager";
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
  it("moves Tabellarisch Kurzprofil above career across saved zones", () => {
    const arranged = { ...profile, resumeManagerLayouts: { ...profile.resumeManagerLayouts,
      tabellarisch: [
        { id: "experience", zone: "main" as const },
        { id: "education", zone: "main" as const },
        { id: "summary", zone: "sidebar" as const },
        { id: "strengths", zone: "sidebar" as const },
      ],
    } };
    const once = reorderManagerSection(arranged, "tabellarisch", "summary", 1);
    const twice = reorderManagerSection(once, "tabellarisch", "summary", 0);
    expect(getManagerSections(once, "tabellarisch").filter((entry) => !entry.fixed).slice(0, 4).map((entry) => entry.id))
      .toEqual(["experience", "summary", "education", "strengths"]);
    expect(getManagerSections(twice, "tabellarisch").filter((entry) => !entry.fixed).slice(0, 4).map((entry) => entry.id))
      .toEqual(["summary", "experience", "education", "strengths"]);
    expect(getManagerSections(twice, "tabellarisch").find((entry) => entry.id === "summary")?.zone).toBe("sidebar");
  });
  it("offers one column in a one-column layout and both columns in a two-column layout", () => {
    for (const templateId of ["tabellarisch", "klassisch", "einspaltig", "ivy-league", "modern"]) {
      expect(managerZones(templateId, "single")).toEqual(["main"]);
      expect(managerAllowedZones(templateId, "summary", "single")).toEqual(["main"]);
      expect(managerZones(templateId, "two-column")).toEqual(["main", "sidebar"]);
      expect(managerAllowedZones(templateId, "summary", "two-column")).toEqual(["main", "sidebar"]);
    }
    expect(effectiveManagerZone("sidebar", "single")).toBe("main");
    expect(effectiveManagerZone("sidebar", "two-column")).toBe("sidebar");
    expect(effectiveManagerZone("main", "two-column")).toBe("main");
  });
  it.each(["tabellarisch", "klassisch", "einspaltig", "ivy-league"])(
    "reorders the whole one-column list of %s and keeps every saved zone", (templateId) => {
      const movable = (value: typeof profile) => getManagerSections(value, templateId).filter((entry) => !entry.fixed);
      const before = movable(profile);
      const zones = new Map(before.map((entry) => [entry.id, entry.zone]));
      // Across the old main/side boundary: a side-column section moves behind a main-column one and back.
      const sideIndex = before.findIndex((entry) => entry.zone === "sidebar");
      const mainIndex = before.findIndex((entry, index) => index > sideIndex && entry.zone === "main");
      const down = reorderManagerSection(profile, templateId, before[sideIndex]!.id, mainIndex);
      const expected = before.map((entry) => entry.id);
      expected.splice(mainIndex, 0, ...expected.splice(sideIndex, 1));
      expect(movable(down).map((entry) => entry.id)).toEqual(expected);
      expect(new Map(movable(down).map((entry) => [entry.id, entry.zone]))).toEqual(zones);
      expect(down.resumeManagerLayouts[templateId]).toEqual(movable(down).map(({ id, zone }) => ({ id, zone })));
      // Only this template's order is saved; the others keep theirs.
      expect(Object.keys(down.resumeManagerLayouts)).toEqual([templateId]);
      const back = reorderManagerSection(down, templateId, before[sideIndex]!.id, sideIndex);
      expect(movable(back).map((entry) => entry.id)).toEqual(before.map((entry) => entry.id));
      // The ends: nothing moves above the first or below the last position.
      const first = movable(back)[0]!.id;
      const last = movable(back).at(-1)!.id;
      expect(reorderManagerSection(back, templateId, first, -1)).toBe(back);
      expect(reorderManagerSection(back, templateId, last, movable(back).length)).toBe(back);
      expect(movable(reorderManagerSection(back, templateId, first, 99)).at(-1)!.id).toBe(first);
      expect(reorderManagerSection(back, templateId, "missing", 0)).toBe(back);
      // No section is lost or doubled.
      expect([...movable(down).map((entry) => entry.id)].sort()).toEqual([...before.map((entry) => entry.id)].sort());
    });
});
