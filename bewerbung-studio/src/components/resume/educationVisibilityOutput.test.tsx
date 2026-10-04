import { describe, expect, it } from "vitest";
import { resumeCareerFieldKeys, type ResumeCareerFieldKey } from "../../shared/resumeCareer";
import { resumeEducationFieldKeys, type ResumeEducationFieldKey } from "../../shared/resumeEducation";
import { createResumePagePlan } from "../../shared/documentPagination";
import { maximalProfile, maximalProfileInput } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

/** One station with a value in every switchable detail; every value a token of its own. */
const station = maximalProfileInput().education[0];
const educationEntry = { ...station, country: "Österreich", type: "Berufsausbildung", fieldOfStudy: "Softwaretechnik" };
const educationTokens: Record<ResumeEducationFieldKey, string> = {
  country: "Österreich",
  type: "Art: Berufsausbildung",
  fieldOfStudy: "Fachrichtung: Softwaretechnik",
  grade: "Abschlussnote: 1,8",
  status: "Status: Abgeschlossen",
  description: "Abschlussprojekt: Monitoring-Plattform",
};
const careerTokens: Record<ResumeCareerFieldKey, string> = {
  employmentType: "Vollzeit",
  description: "Entwicklung interner Plattformen",
  teamSize: "Team mit 5 Personen",
  tasks: "Konzeption zentraler Funktionen",
  projects: "Grafana-Datasource-Plugin",
  technologies: "Technologien: TypeScript, React, Grafana",
  achievements: "Open-Source-Veröffentlichung des Plugins",
};
const switches = <Key extends string>(keys: readonly Key[], on: (key: Key) => boolean) => Object.fromEntries(keys.map((key) => [key, on(key)]));
const withEducation = (visibility: Record<string, boolean>, entry: Record<string, unknown> = educationEntry) =>
  maximalProfile({ education: [entry], resumeEducationFieldVisibility: visibility });

describe.each(resumeTemplateIds)("Bildungsweg switches in %s", (templateId) => {
  it("prints an education detail only while its switch is on (preview and PDF), and never deletes it", () => {
    const all = renderCv(templateId, withEducation(switches(resumeEducationFieldKeys, () => true)));
    for (const surface of ["preview", "pdf"] as const)
      for (const key of resumeEducationFieldKeys) expect(all[surface], `all on / ${key} / ${surface}`).toContain(educationTokens[key]);
    for (const key of resumeEducationFieldKeys) {
      const profile = withEducation(switches(resumeEducationFieldKeys, (other) => other !== key));
      const result = renderCv(templateId, profile);
      for (const surface of ["preview", "pdf"] as const) {
        expect(result[surface], `${key} off / ${surface}`).not.toContain(educationTokens[key]);
        for (const other of resumeEducationFieldKeys.filter((candidate) => candidate !== key))
          expect(result[surface], `${key} off, ${other} stays / ${surface}`).toContain(educationTokens[other]);
        // The station itself is always there.
        expect(result[surface], `${key} off / ${surface}: degree`).toContain("Fachinformatiker für Anwendungsentwicklung");
      }
      expect(profile.education[0]).toMatchObject({ country: "Österreich", type: "Berufsausbildung", fieldOfStudy: "Softwaretechnik", grade: "1,8", status: "Abgeschlossen" });
    }
  });

  it("prints no label for a detail that is switched on but empty", () => {
    const empty = withEducation(switches(resumeEducationFieldKeys, () => true), { ...educationEntry, country: "", type: "", fieldOfStudy: "", grade: "", status: "", description: "" });
    const result = renderCv(templateId, empty);
    for (const surface of ["preview", "pdf"] as const)
      for (const label of ["Art:", "Fachrichtung:", "Abschlussnote", "Status:", "undefined"]) expect(result[surface], `${surface}: ${label}`).not.toContain(label);
  });

  it("prints no label for a career detail that is switched on but empty", () => {
    const empty = maximalProfile({
      resumeCareerFieldVisibility: switches(resumeCareerFieldKeys, () => true),
      experiences: [{ ...maximalProfileInput().experiences[0], employmentType: "", description: "", teamSize: "", tasks: [], projects: [], technologies: [], achievements: [] }],
    });
    const result = renderCv(templateId, empty);
    for (const surface of ["preview", "pdf"] as const) {
      for (const label of ["Technologien:", "Projekte:", "Erfolge:", "Team:", "undefined"]) expect(result[surface], `${surface}: ${label}`).not.toContain(label);
      const pages = surface === "preview" ? result.previewPages : result.pdfPages;
      const emptyItems = pages.flatMap((page) => Array.from(page.querySelectorAll("li,p"))).filter((node) => !node.querySelector("img,svg") && !(node.textContent ?? "").trim() && !node.closest("style,script"));
      const career = "[data-element-id^=experience], [data-managed-section=experience]";
      expect(pages.some((page) => page.querySelector(career)), `${surface}: career found`).toBe(true);
      expect(emptyItems.filter((node) => node.closest(career)).length, `${surface}: empty li/p in career`).toBe(0);
    }
  });

  it("shows only the chosen details of career and education, the same in preview and PDF", () => {
    const profile = maximalProfile({
      education: [educationEntry],
      resumeCareerFieldVisibility: switches(resumeCareerFieldKeys, (key) => key === "tasks"),
      resumeEducationFieldVisibility: switches(resumeEducationFieldKeys, (key) => key === "grade" || key === "description"),
    });
    const result = renderCv(templateId, profile);
    for (const surface of ["preview", "pdf"] as const) {
      expect(result[surface], surface).toContain(careerTokens.tasks);
      for (const key of resumeCareerFieldKeys.filter((other) => other !== "tasks")) expect(result[surface], `${surface}: career ${key}`).not.toContain(careerTokens[key]);
      for (const key of resumeEducationFieldKeys)
        expect(result[surface].includes(educationTokens[key]), `${surface}: education ${key}`).toBe(key === "grade" || key === "description");
    }
  });
});

describe("Bildungsweg switches and the page planner", () => {
  it("measures only the details that are printed", () => {
    const weightOf = (visibility: Record<string, boolean>, entry: Record<string, unknown> = educationEntry) => {
      const plan = createResumePagePlan(withEducation(visibility, entry), "", {}, "einspaltig");
      return plan.flatMap((page) => page.items).find((item) => item.kind === "education")!.weight;
    };
    const allOn = weightOf(switches(resumeEducationFieldKeys, () => true));
    const allOff = weightOf(switches(resumeEducationFieldKeys, () => false));
    expect(allOff).toBeLessThan(allOn);
    // Hidden details weigh exactly as much as details that are not there.
    const blank = { ...educationEntry, country: "", type: "", fieldOfStudy: "", grade: "", status: "", description: "" };
    expect(allOff).toBe(weightOf(switches(resumeEducationFieldKeys, () => true), blank));
  });

  it("is the very state the Profil and the Lebenslauf editor show", () => {
    const profile = withEducation({ grade: false });
    expect(profile.resumeEducationFieldVisibility).toEqual({ country: true, type: false, fieldOfStudy: true, grade: false, status: false, description: true });
  });
});
