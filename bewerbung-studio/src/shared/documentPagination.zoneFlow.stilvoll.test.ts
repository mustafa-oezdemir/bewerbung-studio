import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { resolveCvDocument } from "./resolveCvDocument";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { moveManagerSection } from "../features/resume-sections/resume-manager";

const templateId = "stilvoll";
const now = new Date("2026-07-19T10:00:00.000Z").toISOString();
const bullet = (index: number) =>
  `Messbares Ergebnis ${index + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`;

const makeProfile = (experiences: number, certifications = ["IBM Full Stack Software Developer", "DevOps and Software Engineering", "Apache Kafka"]) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", city: "Berlin", email: "mina@example.com",
    summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
    strengths: ["Analytisches Denken", "Strukturierte Arbeitsweise"].map((title) => ({ id: crypto.randomUUID(), title, description: "" })),
    languages: ["Deutsch – C1", "Englisch – B2"],
    certifications,
    experiences: Array.from({ length: experiences }, (_, index) => ({
      id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`, city: "Berlin",
      achievements: Array.from({ length: 3 }, (_, item) => bullet(item)),
    })),
    education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
    updatedAt: now,
  });

type Profile = ReturnType<typeof makeProfile>;
const plan = (profile: Profile) =>
  resolveCvDocument({ profile, templateId, settings: getTemplateDocumentDesignDefaults(templateId) }).pagePlan;
const place = (profile: Profile, id: string, zone: "main" | "sidebar", index = 0) => moveManagerSection(profile, templateId, id, zone, index);
const pageOf = (pages: ReturnType<typeof plan>, id: string) => pages.findIndex((page) => page.blocks?.includes(id)) + 1;

describe("zone flow of stilvoll", () => {
  it("plans the certificates, which the template geometry used to leave out, into the sidebar of page one", () => {
    for (const experiences of [3, 5, 7]) expect(pageOf(plan(makeProfile(experiences)), "certifications"), `${experiences} experiences`).toBe(1);
  });

  it("does not plan a block for a résumé without certificates", () => {
    expect(plan(makeProfile(3, [])).flatMap((page) => page.blocks ?? [])).not.toContain("certifications");
  });

  it("lets a main-column block follow the career: page one while there is room, then page two", () => {
    const behind = (experiences: number) => plan(place(makeProfile(experiences), "certifications", "main", 99));
    expect(pageOf(behind(5), "certifications")).toBe(1);
    for (const experiences of [6, 7]) {
      expect(behind(experiences), `${experiences} experiences`).toHaveLength(2);
      expect(pageOf(behind(experiences), "certifications"), `${experiences} experiences`).toBe(2);
    }
  });

  it("puts a block above the career sections on page one and brings a pushed block back when the user moves it", () => {
    const base = makeProfile(6);
    expect(pageOf(plan(place(base, "certifications", "main", 0)), "certifications")).toBe(1);
    const pushed = place(base, "certifications", "main", 99);
    expect(pageOf(plan(pushed), "certifications")).toBe(2);
    const back = place(pushed, "certifications", "sidebar", 0);
    expect(pageOf(plan(back), "certifications")).toBe(1);
    expect(plan(back)).toEqual(plan(base));
  });

  it("draws every block exactly once", () => {
    const profile = place(place(makeProfile(6), "certifications", "main", 99), "languages", "main", 0);
    const blocks = plan(profile).flatMap((page) => page.blocks ?? []);
    expect(new Set(blocks).size).toBe(blocks.length);
    expect(blocks).toContain("certifications");
  });
});
