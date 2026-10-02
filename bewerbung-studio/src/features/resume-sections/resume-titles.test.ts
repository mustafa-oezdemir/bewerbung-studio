import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { getResumeSectionTitle, setResumeSectionTitle } from "./resume-sections";
import { getManagerSections, updateManagerSection } from "./resume-manager";
import { applyManagedResumeOutput } from "../../shared/resumeManagedOutput";

const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
describe("shared visible section titles", () => {
  it("updates a title from the profile editor after an earlier manager rename", () => {
    const old = updateManagerSection(profile, "modern", "experience", { title: "Alte Überschrift", visible: true });
    const changed = setResumeSectionTitle(old, "experience", "Berufliche Praxis");
    expect(getResumeSectionTitle(changed, "experience")).toBe("Berufliche Praxis");
    expect(getManagerSections(changed, "modern").find((entry) => entry.id === "experience")?.title).toBe("Berufliche Praxis");
    expect(changed.resumeSemanticSections.find((entry) => entry.semanticType === "career")?.customTitle).toBe("Berufliche Praxis");
    const html = applyManagedResumeOutput('<section data-element-id="modern.experience"><h2>Erfahrung</h2><p>Inhalt</p></section>', changed, "modern");
    expect(html).toContain("Berufliche Praxis");
    expect(html).toContain("Inhalt");
    expect(old.resumeSectionTitles.experience).toBe("Alte Überschrift");
  });

  it("resets custom values, preserves visibility and supports typing spaces", () => {
    const changed = setResumeSectionTitle(updateManagerSection(profile, "modern", "experience", { visible: false, title: "Alt" }), "experience", "Berufliche ");
    expect(getResumeSectionTitle(changed, "experience")).toBe("Berufliche ");
    const reset = setResumeSectionTitle(changed, "experience", "");
    expect(getResumeSectionTitle(reset, "experience")).toBe("Beruflicher Werdegang");
    expect(reset.resumeManagerOverrides.experience.title).toBeUndefined();
    expect(reset.resumeManagerOverrides.experience.visible).toBe(false);
    expect(reset.resumeSemanticSections.find((entry) => entry.semanticType === "career")?.customTitle).toBe("");
    expect(profileSchema.parse(reset)).toEqual(reset);
  });
});
