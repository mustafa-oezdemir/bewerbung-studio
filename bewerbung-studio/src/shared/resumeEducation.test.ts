import { describe, expect, it } from "vitest";
import { resolveEducationPresentation, sortEducationLatestFirst, toTemplateEducationItem, type Education } from "./resumeEducation";

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
