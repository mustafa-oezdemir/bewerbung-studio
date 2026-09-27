import { describe, expect, it } from "vitest";
import { profileSchema, documentDesignOverridesSchema } from "./schema";
import { resolveResumePresentation, separateResumeDraft } from "./resumePresentation";
import { getManagerSections, updateManagerSection, moveManagerSection } from "../features/resume-sections/resume-manager";

const makeProfile = () => profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
describe("resume content and template presentation", () => {
  it("keeps untouched legacy profiles unchanged", () => {
    const original = makeProfile();
    expect(resolveResumePresentation(original, "modern", undefined)).toBe(original);
    expect(separateResumeDraft(original, original, "modern").presentation).toEqual({});
  });
  it("saves content while isolating titles and visibility", () => {
    const original = makeProfile();
    const section = getManagerSections(original, "modern").find(item => !item.fixed)!;
    const draft = { ...updateManagerSection(original, "modern", section.id, { title: "Meine Erfahrung", visible: false }), firstName: "Ada" };
    const result = separateResumeDraft(original, draft, "modern");
    expect(result.profile.firstName).toBe("Ada");
    expect(result.profile.resumeManagerOverrides).toEqual(original.resumeManagerOverrides);
    expect(result.profile.resumeSectionTitles).toEqual(original.resumeSectionTitles);
    const rendered = resolveResumePresentation(result.profile, "modern", result.presentation)!;
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
  it("persists sparse personal-field, closing and column overrides", () => {
    const original = makeProfile();
    const draft = { ...original, resumePersonalFieldVisibility: { ...original.resumePersonalFieldVisibility, email: false }, resumeClosing: { ...original.resumeClosing, showDate: false }, resumeColumnRatio: 40 as const };
    const result = separateResumeDraft(original, draft, "modern");
    const saved = documentDesignOverridesSchema.parse(JSON.parse(JSON.stringify({ resumePresentation: result.presentation })));
    const restored = resolveResumePresentation(result.profile, "modern", saved.resumePresentation)!;
    expect(restored.resumePersonalFieldVisibility.email).toBe(false);
    expect(restored.resumeClosing.showDate).toBe(false);
    expect(restored.resumeColumnRatio).toBe(40);
    expect(result.profile.resumePersonalFieldVisibility).toEqual(original.resumePersonalFieldVisibility);
    expect(resolveResumePresentation(result.profile, "kompakt", undefined)?.resumeClosing).toEqual(original.resumeClosing);
  });
});

