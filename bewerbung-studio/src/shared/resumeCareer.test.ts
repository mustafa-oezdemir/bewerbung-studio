import { describe, expect, it } from "vitest";
import {
  countExperiencePoints,
  findCareerGaps,
  findUnreadableCareerDates,
  formatCareerDate,
  formatCareerOrganization,
  formatCareerPeriod,
  getBulletRange,
  isCurrentCareerValue,
  isLatestFirst,
  normalizeExperience,
  parseCareerDate,
  resolveExperience,
  setExperienceCurrent,
  setExperienceEnd,
  sortExperiencesLatestFirst,
  toTemplateExperienceItem,
  type Experience,
} from "./resumeCareer";
import { profileSchema } from "./schema";

let counter = 0;
/** A station through the schema, so the defaults of older records are the real ones. */
const station = (fields: Record<string, unknown> = {}): Experience => {
  counter += 1;
  const profile = profileSchema.parse({
    id: "8d000000-0000-4000-8000-000000000001",
    isDefault: true,
    firstName: "Mina",
    lastName: "Kaya",
    updatedAt: "2026-10-02T10:00:00.000Z",
    experiences: [
      {
        id: `8d000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
        from: "11/2021",
        to: "10/2024",
        role: "Entwicklerin",
        company: "Muster",
        achievements: [],
        ...fields,
      },
    ],
  });
  return profile.experiences[0];
};

describe("5. Beruflicher Werdegang: dates", () => {
  it("A. prints a current position as MM/JJJJ – heute", () => {
    const current = resolveExperience(station({ from: "11/2024", to: "", isCurrent: true }));
    expect(current.period).toBe("11/2024 – heute");
    expect(current.to).toBe("heute");
    expect(current.isCurrent).toBe(true);
  });

  it("B. prints a closed position as MM/JJJJ – MM/JJJJ", () => {
    expect(resolveExperience(station({ from: "11/2021", to: "10/2024" })).period).toBe("11/2021 – 10/2024");
    expect(resolveExperience(station({ from: "1/2021", to: "2024-03-15" })).period).toBe("01/2021 – 03/2024");
  });

  it("K. an effective 'heute' for a current station never destroys the stored end date", () => {
    const entry = station({ from: "11/2021", to: "10/2024", isCurrent: true });
    expect(resolveExperience(entry).period).toBe("11/2021 – heute");
    const closed = setExperienceCurrent(entry, false);
    expect(closed.to).toBe("10/2024");
    expect(resolveExperience(closed).period).toBe("11/2021 – 10/2024");
    // Only the word itself is cleared when the toggle goes off.
    expect(setExperienceCurrent(station({ to: "Heute", isCurrent: true }), false).to).toBe("");
    expect(setExperienceEnd(station({ isCurrent: true }), "heute").isCurrent).toBe(true);
    expect(setExperienceEnd(station({ isCurrent: true }), "09/2025").isCurrent).toBe(false);
  });

  it("L. a bare year or an older 'Heute' neither crashes nor gets rewritten", () => {
    expect(resolveExperience(station({ from: "2019", to: "2023" })).period).toBe("2019 – 2023");
    expect(resolveExperience(station({ from: "2019", to: "Heute" })).period).toBe("2019 – heute");
    expect(resolveExperience(station({ from: "Sommer 2019", to: "irgendwann" })).period).toBe("Sommer 2019 – irgendwann");
    expect(resolveExperience(station({ from: "", to: "" })).period).toBe("");
    expect(resolveExperience(station({ from: "2023", to: "" })).period).toBe("2023");
    expect(parseCareerDate("13/2023")).toBeUndefined();
    expect(formatCareerDate("  07.2023 ")).toBe("07/2023");
    expect(formatCareerPeriod("07/2023", "heute")).toBe("07/2023 – heute");
    for (const word of ["heute", "Aktuell", "jetzt", "laufend", "present"]) expect(isCurrentCareerValue(word)).toBe(true);
  });

  it("reports an unreadable date and nothing for readable or 'heute' values", () => {
    expect(findUnreadableCareerDates(station({ from: "Sommer 2019", to: "heute" }))).toEqual(["Sommer 2019"]);
    expect(findUnreadableCareerDates(station({ from: "2019", to: "10/2020" }))).toEqual([]);
    expect(findUnreadableCareerDates(station({ from: "01/2020", to: "wirr", isCurrent: true }))).toEqual([]);
  });
});

describe("5. Beruflicher Werdegang: employer", () => {
  it("D/M. adds the legal form, and never doubles it", () => {
    expect(formatCareerOrganization("Muster", "GmbH")).toBe("Muster GmbH");
    expect(formatCareerOrganization("Muster GmbH", "GmbH")).toBe("Muster GmbH");
    expect(formatCareerOrganization("Muster gmbh", "GmbH")).toBe("Muster gmbh");
    expect(formatCareerOrganization("Muster GmbH & Co. KG", "KG")).toBe("Muster GmbH & Co. KG");
    expect(formatCareerOrganization("Muster", "UG (haftungsbeschränkt)")).toBe("Muster UG (haftungsbeschränkt)");
    expect(formatCareerOrganization("Muster", "")).toBe("Muster");
    expect(formatCareerOrganization("", "GmbH")).toBe("");
    expect(resolveExperience(station({ company: "Muster GmbH", legalForm: "GmbH" })).organization).toBe("Muster GmbH");
    // A legal form that is part of another word is not a duplicate.
    expect(formatCareerOrganization("Agency", "AG")).toBe("Agency AG");
    expect(station({ company: "Muster GmbH", legalForm: "GmbH" }).company).toBe("Muster GmbH");
  });

  it("shows the employment type next to the city and keeps free text", () => {
    expect(resolveExperience(station({ city: "Berlin", employmentType: "Teilzeit" })).location).toBe("Berlin · Teilzeit");
    expect(resolveExperience(station({ employmentType: "Teilzeit · 20 Std./Woche" })).location).toBe("Teilzeit · 20 Std./Woche");
    expect(resolveExperience(station({ city: "Berlin" })).location).toBe("Berlin");
  });
});

describe("5. Beruflicher Werdegang: details", () => {
  it("E/F/G/H. tasks, projects, achievements and technologies all reach the Lebenslauf, in this order", () => {
    const resolved = resolveExperience(
      station({
        description: "Plattformteam im Bereich Zahlungen.",
        teamSize: "5 Personen",
        tasks: ["Backend entwickelt"],
        projects: ["Migration der Abrechnung"],
        achievements: ["Ladezeit um 40 % gesenkt"],
        technologies: ["TypeScript", "PostgreSQL"],
      }),
    );
    expect(resolved.bullets).toEqual([
      "Plattformteam im Bereich Zahlungen.",
      "Team / Verantwortung: 5 Personen",
      "Backend entwickelt",
      "Migration der Abrechnung",
      "Ladezeit um 40 % gesenkt",
      "Technologien: TypeScript, PostgreSQL",
    ]);
    expect(resolved.details.map((detail) => detail.type)).toEqual(["description", "team", "task", "project", "achievement", "technologies"]);
    expect(toTemplateExperienceItem(station({ tasks: ["Aufgabe"], city: "Bonn" }))).toMatchObject({
      title: "Entwicklerin",
      organization: "Muster",
      city: "Bonn",
      achievements: ["Aufgabe"],
    });
  });

  it("I. empty and blank entries never become a bullet", () => {
    const resolved = resolveExperience(station({ tasks: ["", "  "], projects: [" "], achievements: [""], technologies: ["", " "], description: " ", teamSize: " " }));
    expect(resolved.bullets).toEqual([]);
    expect(resolved.details).toEqual([]);
    const tidy = normalizeExperience(station({ tasks: [" Eins ", ""], technologies: [" "], role: " Rolle " }));
    expect(tidy.tasks).toEqual(["Eins"]);
    expect(tidy.technologies).toEqual([]);
    expect(tidy.role).toBe("Rolle");
  });

  it("a compact station is one line: its details stay in the profile and out of the Lebenslauf", () => {
    const entry = station({ compact: true, tasks: ["Aufgabe"], achievements: ["Erfolg"], technologies: ["Go"], description: "Text" });
    expect(resolveExperience(entry).bullets).toEqual([]);
    expect(resolveExperience(entry).compact).toBe(true);
    expect(entry.tasks).toEqual(["Aufgabe"]);
  });

  it("J. recommends 3–6 points, hints softly outside, and never decides anything", () => {
    expect(countExperiencePoints(station({ tasks: ["a", "b"], projects: ["c"], achievements: ["", "d"] }))).toBe(4);
    expect(getBulletRange(0)).toBe("none");
    expect(getBulletRange(2)).toBe("few");
    expect(getBulletRange(3)).toBe("ok");
    expect(getBulletRange(6)).toBe("ok");
    expect(getBulletRange(7)).toBe("many");
    // More than six points is still saved and rendered completely.
    const many = station({ tasks: Array.from({ length: 9 }, (_, index) => `Aufgabe ${index + 1}`) });
    expect(resolveExperience(many).bullets).toHaveLength(9);
  });
});

describe("5. Beruflicher Werdegang: order and gaps", () => {
  const dated = (from: string, to: string, extra: Record<string, unknown> = {}) => station({ from, to, ...extra });

  it("C. sorts newest first only when asked, a current station on top, and keeps an unreadable one in place", () => {
    const old = dated("01/2015", "12/2017");
    const middle = dated("01/2018", "06/2021");
    const current = dated("07/2021", "", { isCurrent: true });
    const unreadable = dated("Sommer", "Winter");
    const sorted = sortExperiencesLatestFirst([old, unreadable, current, middle]);
    expect(sorted).toEqual([current, middle, old, unreadable]);
    expect(isLatestFirst([current, middle, old])).toBe(true);
    // A manual order is a valid order: nothing re-sorts it by itself.
    const manual = [old, current, middle];
    expect(isLatestFirst(manual)).toBe(false);
    expect(manual.map((entry) => entry.id)).toEqual([old.id, current.id, middle.id]);
  });

  it("finds an obvious gap by dates, not by list order, and invents nothing", () => {
    const gaps = findCareerGaps([dated("01/2022", "heute"), dated("01/2015", "12/2017"), dated("01/2018", "06/2019")]);
    expect(gaps).toEqual([{ from: "06/2019", to: "01/2022" }]);
    expect(findCareerGaps([dated("01/2018", "06/2019"), dated("07/2019", "01/2020")])).toEqual([]);
    expect(findCareerGaps([dated("Sommer", "Winter"), dated("01/2018", "06/2019")])).toEqual([]);
  });
});

describe("5. Beruflicher Werdegang: older records", () => {
  it("R. a record with only from, to, role, company and achievements still loads and renders", () => {
    const profile = profileSchema.parse({
      id: "8d000000-0000-4000-8000-000000000099",
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      updatedAt: "2026-10-02T10:00:00.000Z",
      experiences: [
        { id: "8d000000-0000-4000-8000-0000000000a1", from: "2019", to: "Heute", role: "Entwickler", company: "Alt GmbH", achievements: ["Alt gepflegt"] },
      ],
    });
    const [entry] = profile.experiences;
    expect(entry).toMatchObject({ isCurrent: false, compact: false, tasks: [], projects: [], technologies: [] });
    const resolved = resolveExperience(entry);
    expect(resolved).toMatchObject({ role: "Entwickler", organization: "Alt GmbH", period: "2019 – heute", bullets: ["Alt gepflegt"] });
    // Reading a record never rewrites it.
    expect(entry.to).toBe("Heute");
  });
});
