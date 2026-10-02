import { describe, expect, it } from "vitest";
import {
  getResumeSemanticSection,
  resolveResumeSectionInstances,
  validateRequiredResumeSections,
} from "../features/resume-sections/resume-section-system";
import { getManagerSections, updateManagerSection } from "../features/resume-sections/resume-manager";
import { getResumeIdentityVisibilityCss } from "./resumeIdentityVisibility";
import {
  copyResumeHeading,
  normalizeResumeHeading,
  resolveResumeHeading,
  setResumeHeading,
  validateResumeHeading,
} from "./resumeHeading";
import { profileSchema } from "./schema";

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(),
    isDefault: true,
    firstName: "Mustafa",
    lastName: "Özdemir",
    title: "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung",
    updatedAt: new Date().toISOString(),
    ...extra,
  });

describe("resolveResumeHeading", () => {
  it("is Lebenslauf by default", () => {
    expect(resolveResumeHeading(profile())).toMatchObject({
      mode: "default",
      title: "Lebenslauf",
      continuationTitle: "Lebenslauf · Fortsetzung",
    });
    expect(resolveResumeHeading(undefined).title).toBe("Lebenslauf");
  });

  it("builds Lebenslauf + Name from the current profile name, never from a stored string", () => {
    const withName = setResumeHeading(profile(), { mode: "with-name" });
    expect(resolveResumeHeading(withName)).toMatchObject({
      mode: "with-name",
      title: "Lebenslauf Mustafa Özdemir",
      continuationTitle: "Lebenslauf Mustafa Özdemir · Fortsetzung",
    });
    // The name changes later: the heading follows, no snapshot of the old name remains.
    const renamed = { ...withName, lastName: "Yılmaz" };
    expect(resolveResumeHeading(renamed).title).toBe("Lebenslauf Mustafa Yılmaz");
    expect(JSON.stringify(withName.resumeSemanticSections)).not.toContain("Özdemir");
    expect(getResumeSemanticSection(withName.resumeSemanticSections, "heading").customTitle).toBe("");
  });

  it("does not repeat the name in a slot that already prints it", () => {
    const withName = setResumeHeading(profile(), { mode: "with-name" });
    const heading = resolveResumeHeading(withName);
    expect(heading.kicker).toBe("Lebenslauf");
    expect(heading.continuationKicker).toBe("Lebenslauf · Fortsetzung");
    expect(resolveResumeHeading(setResumeHeading(profile(), { mode: "curriculum-vitae" })).kicker).toBe("Curriculum Vitae");
  });

  it("falls back to plain Lebenslauf while with-name has no name yet", () => {
    const nameless = { ...setResumeHeading(profile(), { mode: "with-name" }), firstName: " ", lastName: "" };
    expect(resolveResumeHeading(nameless).title).toBe("Lebenslauf");
  });

  it("supports Curriculum Vitae", () => {
    const cv = setResumeHeading(profile(), { mode: "curriculum-vitae" });
    expect(resolveResumeHeading(cv)).toMatchObject({
      mode: "curriculum-vitae",
      title: "Curriculum Vitae",
      continuationTitle: "Curriculum Vitae · Fortsetzung",
    });
  });

  it("supports a custom heading and keeps its text while another mode is active", () => {
    const custom = setResumeHeading(profile(), { mode: "custom", customTitle: "Mein Lebenslauf" });
    expect(resolveResumeHeading(custom)).toMatchObject({
      mode: "custom",
      title: "Mein Lebenslauf",
      continuationTitle: "Mein Lebenslauf · Fortsetzung",
      customTitleMissing: false,
    });
    const other = setResumeHeading(custom, { mode: "curriculum-vitae" });
    expect(resolveResumeHeading(other)).toMatchObject({ title: "Curriculum Vitae", customTitle: "Mein Lebenslauf" });
    expect(resolveResumeHeading(setResumeHeading(other, { mode: "custom" })).title).toBe("Mein Lebenslauf");
  });

  it("never yields an empty heading: a custom mode without text falls back and fails validation", () => {
    const empty = setResumeHeading(profile(), { mode: "custom", customTitle: "   " });
    const heading = resolveResumeHeading(empty);
    expect(heading).toMatchObject({ mode: "custom", title: "Lebenslauf", customTitleMissing: true });
    expect(validateResumeHeading(empty)).toMatch(/Überschrift/);
    expect(validateResumeHeading(setResumeHeading(empty, { customTitle: "Mein CV" }))).toBeUndefined();
    expect(validateResumeHeading(setResumeHeading(empty, { mode: "default" }))).toBeUndefined();
  });

  it("trims the stored custom text on save and leaves the other sections alone", () => {
    const typed = setResumeHeading(profile(), { mode: "custom", customTitle: "  Mein CV  " });
    expect(getResumeSemanticSection(normalizeResumeHeading(typed).resumeSemanticSections, "heading").customTitle).toBe("Mein CV");
    const section = (type: "personalData" | "photo") => getResumeSemanticSection(typed.resumeSemanticSections, type);
    const base = { ...typed, resumeSemanticSections: typed.resumeSemanticSections.map((item) => item.semanticType === "photo" ? { ...item, visible: true } : item) };
    const copied = copyResumeHeading(typed, base);
    expect(getResumeSemanticSection(copied.resumeSemanticSections, "heading").customTitle).toBe("  Mein CV  ");
    expect(getResumeSemanticSection(copied.resumeSemanticSections, "photo").visible).toBe(true);
    expect(section("personalData").visible).toBe(true);
  });
});

describe("legacy profiles", () => {
  it("opens a profile without any semantic sections as Lebenslauf", () => {
    const legacy = profile();
    expect(legacy.resumeSemanticSections).toEqual([]);
    expect(resolveResumeHeading(legacy).title).toBe("Lebenslauf");
  });

  it("opens a heading entry that has no mode as default", () => {
    const legacy = profile({ resumeSemanticSections: [{ semanticType: "heading", customTitle: "", visible: true, enabled: true, order: 0 }] });
    expect(resolveResumeHeading(legacy)).toMatchObject({ mode: "default", title: "Lebenslauf" });
  });

  it("keeps a custom heading a user already entered and reads it as custom", () => {
    const legacy = profile({ resumeSemanticSections: [{ semanticType: "heading", customTitle: "Mein CV", visible: true, enabled: true, order: 0 }] });
    expect(resolveResumeHeading(legacy)).toMatchObject({ mode: "custom", title: "Mein CV", continuationTitle: "Mein CV · Fortsetzung" });
    // Switching to another mode and back never loses it.
    expect(resolveResumeHeading(setResumeHeading(setResumeHeading(legacy, { mode: "default" }), { mode: "custom" })).title).toBe("Mein CV");
  });

  it("accepts and keeps the mode through the schema", () => {
    const saved = profile({ resumeSemanticSections: setResumeHeading(profile(), { mode: "with-name" }).resumeSemanticSections });
    expect(resolveResumeHeading(saved).title).toBe("Lebenslauf Mustafa Özdemir");
    expect(() => profile({ resumeSemanticSections: [{ semanticType: "heading", customTitle: "", headingMode: "nonsense", visible: true, enabled: true, order: 0 }] })).toThrow();
  });
});

describe("the Überschrift is Pflicht", () => {
  const hiddenSaved = [{ semanticType: "heading" as const, customTitle: "", visible: false, enabled: false, order: 0 }];

  it("stays visible and enabled whatever an older save says", () => {
    expect(getResumeSemanticSection(hiddenSaved, "heading")).toMatchObject({ visible: true, enabled: true });
    expect(resolveResumeSectionInstances(hiddenSaved).find((item) => item.semanticType === "heading")).toMatchObject({ visible: true, enabled: true });
    expect(validateRequiredResumeSections(hiddenSaved)).toEqual([]);
  });

  it("cannot be hidden or renamed through the section manager", () => {
    const base = profile({ resumeSemanticSections: hiddenSaved, resumeManagerOverrides: { heading: { title: "Weg", visible: false } } });
    const entry = getManagerSections(base, "modern").find((item) => item.id === "heading")!;
    expect(entry).toMatchObject({ title: "Überschrift", visible: true, required: true, fixed: true });
    const original = profile();
    const attempted = updateManagerSection(original, "modern", "heading", { visible: false, title: "Weg" });
    expect(attempted).toBe(original);
    expect(resolveResumeHeading(attempted).title).toBe("Lebenslauf");
    expect(getManagerSections(attempted, "modern").find((item) => item.id === "heading")?.visible).toBe(true);
  });

  it("no longer hides the name and Berufsbezeichnung through the identity visibility CSS", () => {
    expect(getResumeIdentityVisibilityCss(hiddenSaved)).toBe("");
    const personalOff = resolveResumeSectionInstances([]).map((item) => item.semanticType === "personalData" ? { ...item, visible: false } : item);
    expect(getResumeIdentityVisibilityCss(personalOff)).toContain("display:none!important");
    expect(getResumeIdentityVisibilityCss(personalOff)).not.toContain("__name");
  });
});

describe("profile.title stays the Berufsbezeichnung", () => {
  it("is never read or written by the heading", () => {
    const title = "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung";
    for (const mode of ["default", "with-name", "curriculum-vitae", "custom"] as const) {
      const changed = setResumeHeading(profile(), { mode, customTitle: "Mein Lebenslauf" });
      expect(changed.title).toBe(title);
      const heading = resolveResumeHeading(changed);
      expect(heading.title).not.toContain("Softwareentwickler");
      expect(heading.kicker).not.toContain("Softwareentwickler");
    }
    // Even a Berufsbezeichnung that looks like a heading does not leak into it.
    const lookalike = { ...profile(), title: "Curriculum Vitae Mustafa Özdemir" };
    expect(resolveResumeHeading(lookalike).title).toBe("Lebenslauf");
  });
});
