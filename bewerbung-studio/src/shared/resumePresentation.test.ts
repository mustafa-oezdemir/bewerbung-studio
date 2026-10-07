import { describe, expect, it } from "vitest";
import { profileSchema, documentDesignOverridesSchema } from "./schema";
import { keepResumeLayoutOverrides, resolveResumePresentation, separateResumeDraft } from "./resumePresentation";
import { getManagerSections, updateManagerSection, moveManagerSection } from "../features/resume-sections/resume-manager";

const makeProfile = () => profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
describe("resume content and template presentation", () => {
  it("keeps untouched legacy profiles unchanged", () => {
    const original = makeProfile();
    expect(resolveResumePresentation(original, "modern", undefined)).toBe(original);
    expect(separateResumeDraft(original, original, "modern").presentation).toEqual({});
  });
  it("keeps title and visibility from the shared profile", () => {
    const original = makeProfile();
    const section = getManagerSections(original, "modern").find(item => !item.fixed)!;
    const draft = { ...updateManagerSection(original, "modern", section.id, { title: "Meine Erfahrung", visible: false }), firstName: "Ada" };
    const result = separateResumeDraft(original, draft, "modern");
    expect(result.profile.firstName).toBe("Ada");
    expect(result.profile.resumeManagerOverrides).toEqual(original.resumeManagerOverrides);
    expect(result.profile.resumeSectionTitles).toEqual(original.resumeSectionTitles);
    const rendered = resolveResumePresentation(draft, "modern", result.presentation)!;
    expect(getManagerSections(rendered, "modern").find(item => item.id === section.id)).toMatchObject({ title: "Meine Erfahrung", visible: false });
    expect(getManagerSections(result.profile, "modern").find(item => item.id === section.id)).toEqual(section);
    expect(original.firstName).toBe("Mina");
  });
  it("round trips order without changing the saved profile", () => {
    const original = makeProfile();
    const sections = getManagerSections(original, "einspaltig").filter(item => !item.fixed);
    const draft = moveManagerSection(original, "einspaltig", sections.at(-1)!.id, "main", 0);
    const result = separateResumeDraft(original, draft, "einspaltig");
    expect(result.profile.resumeManagerLayouts).toEqual(original.resumeManagerLayouts);
    expect(getManagerSections(resolveResumePresentation(result.profile, "einspaltig", result.presentation)!, "einspaltig").map(item => item.id)).toEqual(getManagerSections(draft, "einspaltig").map(item => item.id));
  });
  it("round trips placement, order and visibility across templates", () => {
    const original = makeProfile();
    let draft = moveManagerSection(original, "einspaltig", "experience", "sidebar", 0);
    draft = moveManagerSection(draft, "einspaltig", "strengths", "sidebar", 1);
    draft = updateManagerSection(draft, "einspaltig", "education", { visible: false });
    const { profile, presentation } = separateResumeDraft(original, draft, "einspaltig");
    const saved = documentDesignOverridesSchema.parse(JSON.parse(JSON.stringify({ resumePresentation: presentation })));
    const restored = resolveResumePresentation(draft, "einspaltig", saved.resumePresentation)!;
    expect(getManagerSections(restored, "einspaltig").filter(item => !item.fixed).map(item => [item.id, item.zone, item.visible]))
      .toEqual(getManagerSections(draft, "einspaltig").filter(item => !item.fixed).map(item => [item.id, item.zone, item.visible]));
    expect(getManagerSections(profile, "einspaltig").find(item => item.id === "experience")?.zone).toBe("main");
    expect(getManagerSections(profile, "klassisch").find(item => item.id === "experience")?.zone).toBe("main");
  });
  it("retains layout controls when the section editor saves", () => {
    expect(keepResumeLayoutOverrides({ sections: { summary: { zone: "sidebar" } } },
      { layoutMode: "two-column", sidebarSide: "left", sidebarWidthPercent: 35 }))
      .toEqual({ sections: { summary: { zone: "sidebar" } }, layoutMode: "two-column", sidebarSide: "left", sidebarWidthPercent: 35 });
    expect(keepResumeLayoutOverrides({ sidebarWidthPercent: 40, sections: { summary: { visible: false } } }, undefined))
      .toEqual({ sections: { summary: { visible: false } } });
  });
  it("keeps per-application project selection when section content is saved", () => {
    expect(keepResumeLayoutOverrides({ sections: {} }, { selectedProjectEntryIds: [] }).selectedProjectEntryIds).toEqual([]);
    expect(keepResumeLayoutOverrides({ sections: {} }, { selectedProjectEntryIds: ["project-a"] }).selectedProjectEntryIds).toEqual(["project-a"]);
  });
  it("retains closing placement and alignment while independently saving visibility", () => {
    const previous = { closing: { placement: "main" as const, alignment: "right" as const, showDate: false } };
    const merged = keepResumeLayoutOverrides({ closing: { showPlace: false } }, previous);
    expect(merged.closing).toEqual({ showPlace: false, placement: "main", alignment: "right" });
    const saved = documentDesignOverridesSchema.parse(JSON.parse(JSON.stringify({ resumePresentation: merged })));
    const projected = resolveResumePresentation(makeProfile(), "modern", saved.resumePresentation)!;
    expect(projected.resumeClosing).toMatchObject({ showPlace: true, showDate: true });
  });
  it("persists sparse personal-field, closing and column overrides", () => {
    const original = makeProfile();
    const draft = { ...original, resumePersonalFieldVisibility: { ...original.resumePersonalFieldVisibility, email: false }, resumeClosing: { ...original.resumeClosing, showDate: false }, resumeColumnRatio: 40 as const };
    const result = separateResumeDraft(original, draft, "modern");
    const saved = documentDesignOverridesSchema.parse(JSON.parse(JSON.stringify({ resumePresentation: result.presentation })));
    const restored = resolveResumePresentation(draft, "modern", saved.resumePresentation)!;
    expect(restored.resumePersonalFieldVisibility.email).toBe(false);
    expect(restored.resumeClosing.showDate).toBe(false);
    expect(restored.resumeColumnRatio).toBe(40);
    expect(result.profile.resumePersonalFieldVisibility).toEqual(original.resumePersonalFieldVisibility);
    expect(resolveResumePresentation(result.profile, "kompakt", undefined)?.resumeClosing).toEqual(original.resumeClosing);
  });
});

