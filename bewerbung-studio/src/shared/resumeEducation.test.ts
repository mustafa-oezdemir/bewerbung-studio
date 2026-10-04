import { describe, expect, it } from "vitest";
import {
  defaultResumeEducationFieldVisibility, resolveEducationPresentation, resolveResumeEducationFieldVisibility, resumeEducationFieldKeys,
  sortEducationLatestFirst, toTemplateEducationItem, type Education,
} from "./resumeEducation";
import { profileSchema } from "./schema";

const education = (patch: Partial<Education> = {}): Education => ({
  id: crypto.randomUUID(), from: "08/2018", to: "07/2022",
  degree: "Bachelor of Science Informatik", institution: "Universität Stuttgart",
  city: "Stuttgart", country: "Deutschland", type: "Studium",
  fieldOfStudy: "Informatik", grade: "1,8", status: "Abgeschlossen",
  description: "Abschlussarbeit: Sichere APIs", ...patch,
});

describe("education presentation", () => {
  it("keeps degree, institution, details, dates and location distinct", () => {
    const view = resolveEducationPresentation(education());
    expect(view.title).toBe("Bachelor of Science Informatik");
    expect(view.institution).toBe("Universität Stuttgart");
    expect(view.location).toBe("Stuttgart, Deutschland");
    expect(view.dateRange).toBe("08/2018 – 07/2022");
    expect(view.details).toEqual(["Abschlussnote: 1,8", "Abschlussarbeit: Sichere APIs"]);
    expect(toTemplateEducationItem(education()).achievements).toEqual(view.details);
  });

  it("presents ongoing education as heute and hides empty details", () => {
    const view = resolveEducationPresentation(education({ to: "heute", grade: "", description: "", country: "" }));
    expect(view.dateRange).toBe("08/2018 – heute");
    expect(view.location).toBe("Stuttgart");
    expect(view.details).toEqual([]);
  });

  it("does not claim an unearned degree or show a grade", () => {
    const view = resolveEducationPresentation(education({
      degree: "Bachelor of Science Maschinenbau", type: "Studium", fieldOfStudy: "Maschinenbau",
      status: "Ohne Abschluss", grade: "1,8",
    }));
    expect(view.title).toBe("Studium – Maschinenbau");
    expect(view.title).not.toContain("Bachelor");
    expect(view.details).not.toContain("Abschlussnote: 1,8");
    expect(view.dateRange).toBe("08/2018 – 07/2022");
  });

  it("only sorts on request, keeping the entries intact", () => {
    const old = education({ to: "2015" });
    const current = education({ to: "heute" });
    expect(sortEducationLatestFirst([old, current])).toEqual([current, old]);
    expect([old, current]).toEqual([old, current]);
  });
});

describe("education details switched on or off for the Lebenslauf", () => {
  const all = { country: true, type: true, fieldOfStudy: true, grade: true, status: true, description: true };
  const only = (key: keyof typeof all) => Object.fromEntries(Object.keys(all).map((other) => [other, other === key]));
  const station = () => education({ degree: "Bachelor of Science", type: "Studium", fieldOfStudy: "Informatik" });
  const tokens = {
    country: (view: ReturnType<typeof resolveEducationPresentation>) => view.location.includes("Deutschland"),
    type: (view: ReturnType<typeof resolveEducationPresentation>) => view.details.includes("Art: Studium"),
    fieldOfStudy: (view: ReturnType<typeof resolveEducationPresentation>) => view.details.includes("Fachrichtung: Informatik"),
    grade: (view: ReturnType<typeof resolveEducationPresentation>) => view.details.includes("Abschlussnote: 1,8"),
    status: (view: ReturnType<typeof resolveEducationPresentation>) => view.details.includes("Status: Abgeschlossen"),
    description: (view: ReturnType<typeof resolveEducationPresentation>) => view.details.includes("Abschlussarbeit: Sichere APIs"),
  };

  it.each(resumeEducationFieldKeys)("%s: printed while on, left out while off, the stored entry unchanged", (key) => {
    const entry = station();
    const before = structuredClone(entry);
    expect(tokens[key](resolveEducationPresentation(entry, all)), `${key} on`).toBe(true);
    expect(tokens[key](resolveEducationPresentation(entry, { ...all, [key]: false })), `${key} off`).toBe(false);
    // Only this switch on: exactly its detail.
    const alone = resolveEducationPresentation(entry, only(key));
    for (const other of resumeEducationFieldKeys) expect(tokens[other](alone), `${key} alone, ${other}`).toBe(other === key);
    expect(entry).toEqual(before);
    // The station itself always stays.
    expect(alone).toMatchObject({ title: "Bachelor of Science", institution: "Universität Stuttgart", dateRange: "08/2018 – 07/2022" });
    expect(alone.location.startsWith("Stuttgart")).toBe(true);
  });

  it("prints no label for a switched-on detail without value", () => {
    const view = resolveEducationPresentation(education({ degree: "Bachelor", type: "", fieldOfStudy: "", grade: "", status: "", description: "", country: "" }), all);
    expect(view.details).toEqual([]);
    expect(view.location).toBe("Stuttgart");
  });

  it("keeps the meaning of the status when its line is hidden", () => {
    const running = resolveEducationPresentation(education({ to: "", status: "Laufend" }), { ...all, status: false });
    expect(running.to).toBe("heute");
    expect(running.dateRange).toBe("08/2018 – heute");
    expect(running.details.some((detail) => detail.startsWith("Status"))).toBe(false);
    const dropped = resolveEducationPresentation(education({ status: "Ohne Abschluss" }), { ...all, status: false });
    expect(dropped.incomplete).toBe(true);
    expect(dropped.title).not.toContain("Bachelor of Science");
    expect(dropped.details.join(" ")).not.toContain("Abschlussnote");
    expect(dropped.details.some((detail) => detail.startsWith("Status"))).toBe(false);
  });

  it("still builds the title from type and field when there is no Abschluss, whatever their switches say", () => {
    const view = resolveEducationPresentation(education({ degree: "", type: "Berufsausbildung", fieldOfStudy: "Anwendungsentwicklung" }), { ...all, type: false, fieldOfStudy: false });
    expect(view.title).toBe("Berufsausbildung – Anwendungsentwicklung");
    // Already in the title: no repeated detail line, switched on or not.
    expect(resolveEducationPresentation(education({ degree: "", type: "Berufsausbildung", fieldOfStudy: "Anwendungsentwicklung" }), all).details.filter((detail) => /^(?:Art|Fachrichtung):/.test(detail))).toEqual([]);
  });

  it("keeps the output of older profiles: defaults for a missing or broken record", () => {
    expect(defaultResumeEducationFieldVisibility).toEqual({ country: true, type: false, fieldOfStudy: true, grade: true, status: false, description: true });
    expect(resolveResumeEducationFieldVisibility(undefined)).toEqual(defaultResumeEducationFieldVisibility);
    expect(resolveResumeEducationFieldVisibility({ grade: false, status: "ja", unknown: true })).toEqual({ ...defaultResumeEducationFieldVisibility, grade: false });
    const legacyEntry = education();
    expect(resolveEducationPresentation(legacyEntry)).toEqual(resolveEducationPresentation(legacyEntry, defaultResumeEducationFieldVisibility));
    expect(toTemplateEducationItem(education(), { ...defaultResumeEducationFieldVisibility, grade: false }).achievements).toEqual(["Abschlussarbeit: Sichere APIs"]);
  });

  it("is stored on the profile, validated by the schema, without touching the education entries", () => {
    const base = { id: crypto.randomUUID(), isDefault: true, firstName: "A", lastName: "B", updatedAt: "2026-10-02T10:00:00.000Z", education: [education()] };
    const legacy = profileSchema.parse(base);
    expect(legacy.resumeEducationFieldVisibility).toEqual(defaultResumeEducationFieldVisibility);
    expect(legacy.education[0]).toMatchObject({ country: "Deutschland", type: "Studium", fieldOfStudy: "Informatik", grade: "1,8", status: "Abgeschlossen", description: "Abschlussarbeit: Sichere APIs" });
    const chosen = profileSchema.parse({ ...base, resumeEducationFieldVisibility: { country: false, grade: true, description: true, status: false, type: false, fieldOfStudy: false } });
    expect(chosen.resumeEducationFieldVisibility.country).toBe(false);
    expect(profileSchema.parse({ ...base, resumeEducationFieldVisibility: { grade: false } }).resumeEducationFieldVisibility).toEqual({ ...defaultResumeEducationFieldVisibility, grade: false });
  });
});
