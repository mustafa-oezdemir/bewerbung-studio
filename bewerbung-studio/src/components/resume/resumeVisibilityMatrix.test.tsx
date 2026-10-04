import { describe, expect, it } from "vitest";
import { resumePersonalFieldKeys, type ResumePersonalFieldKey } from "../../features/resume-sections/resume-section-system";
import { resumeCareerFieldKeys, type ResumeCareerFieldKey } from "../../shared/resumeCareer";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

/** What each switch of "Persönliche Daten" governs, as text the Lebenslauf prints. */
const personalTokens: Record<ResumePersonalFieldKey, string[]> = {
  address: ["Musterstraße 12", "35037 Marburg"],
  phone: ["+49 170 1234567"],
  email: ["mustafa@example.com"],
  linkedin: ["linkedin.com/in/mustafa-oezdemir"],
  github: ["github.com/mustafa-oezdemir"],
  website: ["mustafa-oezdemir.de"],
  onlineProfiles: ["gitlab.com/mustafa-oezdemir"],
  birthDate: ["17.05.1990"],
  birthPlace: ["Ankara"],
  nationality: ["deutsch"],
  familyStatus: ["verheiratet"],
  children: ["2 Kinder"],
  xing: ["xing.com/profile/Mustafa_Oezdemir"],
  drivingLicense: [],
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

const visibleKeys = resumePersonalFieldKeys.filter((key) => personalTokens[key].length);
const withVisibility = (key: ResumePersonalFieldKey, value: boolean) =>
  maximalProfile({
    resumePersonalFieldVisibility: Object.fromEntries(resumePersonalFieldKeys.map((other) => [other, other === key ? value : !value])),
  });

describe.each(resumeTemplateIds)("visibility switches in %s", (templateId) => {
  it("prints a personal value only while its switch is on (preview and PDF), and never deletes it", () => {
    for (const key of visibleKeys) {
      // Everything else is on and this one is off: exactly its tokens disappear.
      const profile = maximalProfile({
        resumePersonalFieldVisibility: Object.fromEntries(resumePersonalFieldKeys.map((other) => [other, other !== key])),
      });
      const result = renderCv(templateId, profile);
      for (const surface of ["preview", "pdf"] as const) {
        for (const token of personalTokens[key]) {
          // The address also holds the postal code of other values; a token only counts for its own switch.
          expect(result[surface], `${key} off / ${surface}: ${token}`).not.toContain(token);
        }
        for (const other of visibleKeys.filter((candidate) => candidate !== key && !["address", "birthDate", "birthPlace"].includes(candidate)))
          for (const token of personalTokens[other]) expect(result[surface], `${key} off, ${other} stays / ${surface}`).toContain(token);
      }
      expect(profile.birthDate).toBe("1990-05-17");
    }
  });

  it("prints no label, icon text or separator for a value that is switched on but empty", () => {
    const empty = maximalProfile({
      street: "", postalCode: "", city: "", country: "", phone: "", email: "", linkedin: "", github: "", portfolio: "", onlineProfiles: [],
      birthDate: "", birthPlace: "", nationality: "", familyStatus: "", children: "",
    });
    const result = renderCv(templateId, empty);
    for (const surface of ["preview", "pdf"] as const) {
      for (const label of ["Familienstand", "Staatsangehörigkeit", "Kinder:", "Geburtsort", "Geboren", "Geb.", "Telefon:", "undefined", "null", "mailto:"])
        expect(result[surface], `${surface}: ${label}`).not.toContain(label);
    }
  });

  it("prints a career detail only while its switch is on, and never deletes it", () => {
    for (const key of resumeCareerFieldKeys) {
      const profile = maximalProfile({
        resumeCareerFieldVisibility: Object.fromEntries(resumeCareerFieldKeys.map((other) => [other, other !== key])),
      });
      const result = renderCv(templateId, profile);
      for (const surface of ["preview", "pdf"] as const) {
        expect(result[surface], `${key} off / ${surface}`).not.toContain(careerTokens[key]);
        for (const other of resumeCareerFieldKeys.filter((candidate) => candidate !== key))
          expect(result[surface], `${key} off, ${other} stays / ${surface}`).toContain(careerTokens[other]);
      }
      expect(profile.experiences[0].tasks).toEqual(["Konzeption zentraler Funktionen"]);
    }
  });
});

describe("career detail defaults", () => {
  it("show everything a station holds except the team size, and an older profile takes those defaults", () => {
    const fresh = maximalProfile({ resumeCareerFieldVisibility: undefined });
    expect(fresh.resumeCareerFieldVisibility).toMatchObject({ employmentType: true, tasks: true, projects: true, technologies: true, achievements: true, teamSize: false });
    expect(maximalProfile({ resumeCareerFieldVisibility: { tasks: false } }).resumeCareerFieldVisibility).toMatchObject({ tasks: false, achievements: true, teamSize: false });
    const result = renderCv("einspaltig", fresh);
    expect(result.pdf).not.toContain("Team mit 5 Personen");
    expect(result.pdf).toContain("Konzeption zentraler Funktionen");
  });
});
