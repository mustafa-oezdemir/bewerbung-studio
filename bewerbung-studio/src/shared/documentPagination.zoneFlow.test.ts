import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { resolveCvDocument } from "./resolveCvDocument";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { moveManagerSection } from "../features/resume-sections/resume-manager";

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();
const bullet = (index: number) =>
  `Messbares Ergebnis ${index + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`;

const makeProfile = (experiences: number, extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", city: "Berlin", email: "mina@example.com",
    summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
    strengths: ["Analytisches Denken", "Strukturierte Arbeitsweise"].map((title) => ({ id: crypto.randomUUID(), title, description: "" })),
    languages: ["Deutsch – C1", "Englisch – B2"],
    certifications: ["IBM Full Stack Software Developer", "DevOps and Software Engineering", "Apache Kafka"],
    experiences: Array.from({ length: experiences }, (_, index) => ({
      id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`, city: "Berlin",
      achievements: Array.from({ length: 3 }, (_, item) => bullet(item)),
    })),
    education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
    updatedAt: now,
    ...extra,
  });

type Profile = ReturnType<typeof makeProfile>;
const plan = (profile: Profile, templateId: string) =>
  resolveCvDocument({ profile, templateId, settings: getTemplateDocumentDesignDefaults(templateId) }).pagePlan;
const place = (profile: Profile, templateId: string, id: string, zone: "main" | "sidebar", index = 0) =>
  moveManagerSection(profile, templateId, id, zone, index);
const pageOf = (pages: ReturnType<typeof plan>, id: string) => pages.findIndex((page) => page.blocks?.includes(id)) + 1;

describe.each(["pehlione_white_blue", "pehlione_white"])("zone flow of %s", (template) => {
  const planOf = (profile: Profile) => plan(profile, template);
  const placed = (profile: Profile, id: string, zone: "main" | "sidebar", index = 0) => place(profile, template, id, zone, index);

  it("hosts a sidebar block on page one whenever that column has room, whatever the career is", () => {
    for (const experiences of [5, 6, 7]) {
      const pages = planOf(placed(makeProfile(experiences), "certifications", "sidebar"));
      expect(pages, `${experiences} experiences`).toHaveLength(2);
      expect(pageOf(pages, "certifications"), `${experiences} experiences`).toBe(1);
      expect(pages[1].sidebar).toBe(false);
    }
  });

  it("leaves a sidebar block on the last page only when the sidebar is full", () => {
    const summary = "Sehr ausführliche Beschreibung der Erfahrung in der Softwareentwicklung. ".repeat(11);
    const full = placed(placed(makeProfile(7, { summary }), "summary", "sidebar"), "certifications", "sidebar", 1);
    const pages = planOf(full);
    expect(pages).toHaveLength(2);
    expect(pageOf(pages, "certifications")).toBe(2);
    expect(pages[0].fill!.sidebar).toBeLessThanOrEqual(1);
  });

  it("starts a main-column block on page one behind the career entries for as long as page one has room", () => {
    // The last position of the main column: behind the career sections.
    const behind = (experiences: number) => planOf(placed(makeProfile(experiences), "certifications", "main", 99));
    expect(behind(3)).toHaveLength(1);
    expect(pageOf(behind(3), "certifications")).toBe(1);
    for (const experiences of [5, 6, 7]) {
      expect(behind(experiences), `${experiences} experiences`).toHaveLength(2);
      expect(pageOf(behind(experiences), "certifications"), `${experiences} experiences`).toBe(2);
    }
  });

  it("puts a main-column block that stands above the career sections on page one", () => {
    const pages = planOf(placed(makeProfile(7), "certifications", "main", 0));
    expect(pages).toHaveLength(2);
    expect(pageOf(pages, "certifications")).toBe(1);
    expect(pages[1].blocks).not.toContain("certifications");
  });

  it("moves the block along with the column: sidebar, main and back", () => {
    const base = makeProfile(6);
    const inSidebar = planOf(placed(base, "certifications", "sidebar"));
    const inMain = planOf(placed(placed(base, "certifications", "sidebar"), "certifications", "main"));
    const backInSidebar = planOf(placed(placed(placed(base, "certifications", "sidebar"), "certifications", "main"), "certifications", "sidebar"));
    expect(pageOf(inSidebar, "certifications")).toBe(1);
    expect(pageOf(inMain, "certifications")).toBeGreaterThan(0);
    expect(backInSidebar).toEqual(inSidebar);
  });

  it("brings a block that the pagination pushed to page two back to page one when the user moves it", () => {
    // Behind seven career entries the certificates end up on page two; moving them above the career or into the
    // sidebar plans them onto page one again, and putting them back behind the career sends them down again.
    const base = makeProfile(7);
    expect(pageOf(planOf(placed(base, "certifications", "main", 99)), "certifications")).toBe(2);
    expect(pageOf(planOf(placed(base, "certifications", "sidebar")), "certifications")).toBe(1);
    expect(pageOf(planOf(placed(base, "certifications", "main", 0)), "certifications")).toBe(1);
    const moved = placed(placed(base, "certifications", "sidebar"), "certifications", "main", 99);
    expect(pageOf(planOf(moved), "certifications")).toBe(2);
  });

  it("draws every block exactly once on exactly one page", () => {
    const profile = placed(placed(placed(makeProfile(7), "certifications", "sidebar"), "languages", "main"), "summary", "sidebar", 1);
    const pages = planOf(profile);
    const blocks = pages.flatMap((page) => page.blocks ?? []);
    expect(new Set(blocks).size).toBe(blocks.length);
    expect(blocks).toContain("certifications");
  });

  it("keeps the certificates in the main column, behind the career, by default", () => {
    const pages = planOf(makeProfile(5));
    expect(pages).toHaveLength(2);
    expect(pageOf(pages, "certifications")).toBe(2);
  });
});

describe("zone flow of the templates that have not joined", () => {
  it("does not plan the certificates as a movable block: they keep the historic home on the last page", () => {
    const profile = place(makeProfile(7), "elegant", "certifications", "sidebar", 0);
    expect(plan(profile, "elegant").flatMap((page) => page.blocks ?? [])).not.toContain("certifications");
  });
});
