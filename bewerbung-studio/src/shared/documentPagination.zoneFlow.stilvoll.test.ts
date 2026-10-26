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
    expect(pageOf(behind(2), "certifications")).toBe(1);
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

/** A fictional Kurzprofil of `sentences` sentences (about 120 characters each). */
const longSummary = (sentences: number) => Array.from({ length: sentences }, (_, index) =>
  `Satz ${index + 1} beschreibt fiktive Erfahrung mit Prozessanalyse, Produktionssteuerung und strukturierter Abstimmung im Team.`).join(" ");
const withSummary = (sentences: number, experiences = 3) => profileSchema.parse({ ...makeProfile(experiences), summary: longSummary(sentences) });
const pagesOf = (pages: ReturnType<typeof plan>, id: string) => pages.flatMap((page, index) => (page.blocks?.includes(id) ? [index] : []));
const words = (text: string) => text.split(/\s+/).filter(Boolean);
/** The Kurzprofil parts in reading order: they go on exactly where the page before stopped and cover the whole text. */
const expectSummaryFlows = (pages: ReturnType<typeof plan>, summary: string) => {
  const on = pagesOf(pages, "summary");
  expect(on.length).toBeGreaterThan(0);
  on.forEach((page, index) => index > 0 && expect(page).toBe(on[index - 1] + 1));
  const ranges = on.map((page) => pages[page].blockRanges?.summary ?? { from: 0, to: summary.length, total: summary.length });
  expect(ranges[0].from).toBe(0);
  expect(ranges.at(-1)!.to).toBe(summary.trim().length);
  ranges.forEach((range, index) => index > 0 && expect(range.from).toBe(ranges[index - 1].to));
  // nothing lost, nothing repeated, and no page holds a stray word or two (a part keeps at least two lines)
  expect(ranges.flatMap((range) => words(summary.slice(range.from, range.to)))).toEqual(words(summary));
  if (ranges.length > 1) for (const range of ranges) expect(words(summary.slice(range.from, range.to)).length).toBeGreaterThanOrEqual(8);
  return on;
};

describe("stilvoll: a long Kurzprofil flows like a word processor in the sidebar", () => {
  it("fills page one's sidebar with the Kurzprofil and continues it at the top of page two, Stärken and Sprachen behind it", () => {
    const profile = withSummary(14);
    const pages = plan(profile);
    const on = expectSummaryFlows(pages, profile.summary);
    expect(on).toEqual([0, 1]);
    expect(pages).toHaveLength(2);
    // page one: the Kurzprofil alone, up to the usable bottom of the column
    expect(pages[0].blocks).not.toContain("strengths");
    expect(pages[0].blocks).not.toContain("languages");
    expect(pages[0].fill!.sidebar).toBeGreaterThan(0.9);
    expect(pages[0].fill!.sidebar).toBeLessThanOrEqual(1);
    // page two: the rest of the Kurzprofil, then Stärken, then Sprachen (the order of the section list)
    expect(pages[1].blocks!.filter((id) => ["summary", "strengths", "knowledge", "certifications", "languages"].includes(id)))
      .toEqual(["summary", "strengths", "certifications", "languages"]);
    expect(pages[1].placed).toEqual(expect.arrayContaining(["summary", "strengths", "languages"]));
  });

  it("keeps a short Kurzprofil, Stärken and Sprachen together on page one (no extra page)", () => {
    const pages = plan(makeProfile(3));
    expect(pages).toHaveLength(1);
    expect(pages[0].blockRanges?.summary).toBeUndefined();
    expect(pages[0].placed).toBeUndefined();
  });

  it("runs a Kurzprofil over several pages without letting a later section start before it ends", () => {
    for (const sentences of [30, 45]) {
      const profile = withSummary(sentences);
      const pages = plan(profile);
      const on = expectSummaryFlows(pages, profile.summary);
      expect(on.length, `${sentences} sentences`).toBeGreaterThanOrEqual(3);
      for (const id of ["strengths", "certifications", "languages"])
        expect(Math.min(...pagesOf(pages, id)), `${sentences} sentences: ${id}`).toBeGreaterThanOrEqual(on.at(-1)!);
      for (const page of pages) expect(page.fill!.sidebar, `${sentences} sentences, page ${page.pageNumber}`).toBeLessThanOrEqual(1);
    }
  });

  it("follows the section list the user arranged: Sprachen above the Kurzprofil stay on page one, Stärken follow it", () => {
    const profile = place(withSummary(14), "languages", "sidebar", 0);
    const pages = plan(profile);
    const on = expectSummaryFlows(pages, profile.summary);
    expect(pagesOf(pages, "languages")).toEqual([0]);
    expect(Math.min(...pagesOf(pages, "strengths"))).toBeGreaterThanOrEqual(on.at(-1)!);
  });

  it("keeps the rule with other page margins, the sidebar on the right and in the plain (ATS) layout", () => {
    // The plain layout sets the Kurzprofil across the page width: it needs more text to go on at the next page.
    const sentences: Record<string, number> = { ats: 40 };
    const cases: Array<[string, Record<string, unknown>]> = [
      ["margin 25 mm", { cvOverrides: { spacing: { pageMarginMm: 25 } } }],
      ["margin 10 mm", { cvOverrides: { spacing: { pageMarginMm: 10 } } }],
      ["sidebar right", { resumePresentation: { sidebarSide: "right" } }],
      ["ats", { resumeOutputMode: "ats" }],
    ];
    for (const [label, settings] of cases) {
      const profile = withSummary(sentences[label] ?? 20);
      const pages = resolveCvDocument({ profile, templateId, settings: { ...getTemplateDocumentDesignDefaults(templateId), ...settings } }).pagePlan;
      const on = expectSummaryFlows(pages, profile.summary);
      expect(on.length, label).toBeGreaterThanOrEqual(2);
      for (const id of ["strengths", "languages"]) {
        const at = pagesOf(pages, id);
        // a section the template draws on page one itself appears in the plan once the plan moves it
        if (at.length) expect(Math.min(...at), `${label}: ${id}`).toBeGreaterThanOrEqual(on.at(-1)!);
      }
      // the career entries of the plain layout start below the Kurzprofil
      if (label === "ats") expect(pages.findIndex((page) => page.items.length), label).toBeGreaterThanOrEqual(on.at(-1)!);
    }
  });
});
