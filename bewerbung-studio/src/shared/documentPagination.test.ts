import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { resolveCvDocument } from "./resolveCvDocument";
import { createResumePagePlan, getLetterPageStatus, type ResumePagePlan } from "./documentPagination";
import { getPaginationGeometry } from "./resumePaginationGeometry";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { resolveResumeSectionInstances } from "../features/resume-sections/resume-section-system";
import { supportsSidebarContinuation } from "./resumeSectionPresentation";

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();
const signature = "data:image/png;base64,iVBORw0KGgo=";

const templateIds = [
  "pehlione_white_blue", "pehlione_white", "modern", "elegant", "zweispaltig", "zeitgenoessisch", "kreativ",
  "gepflegt", "kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league",
];
const sidebarTemplates = templateIds.filter((id) => getPaginationGeometry(id).columns === 2);
const singleColumnTemplates = templateIds.filter((id) => getPaginationGeometry(id).columns === 1);

const bullet = (index: number) =>
  `Messbares Ergebnis ${index + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`;

const makeProfile = (
  experiences: number,
  bullets: number,
  education: number,
  extra: Record<string, unknown> = {},
) =>
  profileSchema.parse({
    id: crypto.randomUUID(),
    isDefault: true,
    firstName: "Mina",
    lastName: "Kaya",
    title: "Entwicklerin",
    city: "Berlin",
    email: "mina@example.com",
    summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen und verlässlicher Zusammenarbeit.",
    skills: ["TypeScript", "React", "Node.js", "SQL"],
    // Without strengths of its own a résumé shows its skills as strengths; the fixtures keep both apart.
    strengths: ["Analytisches Denken", "Strukturierte Arbeitsweise", "Teamfähigkeit"].map((title) => ({ id: crypto.randomUUID(), title, description: "" })),
    languages: ["Deutsch – C1", "Englisch – B2"],
    experiences: Array.from({ length: experiences }, (_, index) => ({
      id: crypto.randomUUID(),
      from: `${2010 + index}`,
      to: `${2011 + index}`,
      role: `Position ${index + 1}`,
      company: `Unternehmen ${index + 1}`,
      city: "Berlin",
      achievements: Array.from({ length: bullets }, (_, item) => bullet(item)),
    })),
    education: Array.from({ length: education }, (_, index) => ({
      id: crypto.randomUUID(),
      from: `${2000 + index}`,
      to: `${2004 + index}`,
      degree: `Abschluss ${index + 1}`,
      institution: `Hochschule ${index + 1}`,
    })),
    updatedAt: now,
    ...extra,
  });

const resolve = (
  profile: ReturnType<typeof makeProfile>,
  templateId: string,
  settings: Partial<typeof defaultDocumentDesign> = {},
) => resolveCvDocument({ profile, templateId, settings: { ...getTemplateDocumentDesignDefaults(templateId), ...settings } });

/** Career entries in reading order; an entry that breaks between two pages is listed once. */
const idsOf = (plan: ResumePagePlan[]) => [...new Set(plan.flatMap((page) => page.items.map((item) => item.id)))];
const filled = (plan: ResumePagePlan[], index: number) => plan[index].fill?.main ?? 0;
/** The entries that continue on the next page, as [id, bullets on the first page, bullets on the second]. */
const brokenEntries = (plan: ResumePagePlan[]) =>
  plan[0].items.flatMap((item) => {
    const next = plan[1]?.items.find((other) => other.id === item.id);
    return item.kind === "experience" && item.bullets && next?.kind === "experience" && next.bullets
      ? [[item.id, item.bullets, next.bullets] as const]
      : [];
  });
/** Every bullet of every experience is drawn exactly once, whichever page it lands on. */
const expectEveryBulletOnce = (plan: ResumePagePlan[], experiences: { id: string; achievements: string[] }[]) => {
  for (const experience of experiences) {
    const total = experience.achievements.filter(Boolean).length;
    const parts = plan.flatMap((page) => page.items.filter((item) => item.id === experience.id));
    const ranges = parts.map((item) => (item.kind === "experience" && item.bullets ? [item.bullets.from, item.bullets.to] : [0, total]));
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(total);
    for (let index = 1; index < ranges.length; index += 1) expect(ranges[index][0]).toBe(ranges[index - 1][1]);
  }
};

describe("A4 document pagination", () => {
  it("keeps compact resumes on one page", () => {
    expect(createResumePagePlan(makeProfile(1, 1, 0))).toHaveLength(1);
  });

  // Tabellarisch draws the language dots and their descriptions in the narrow half column (about 13 mm more): these edge-of-the-page
  // fixtures are about the career flow, so they use the compact language line there.
  const compactLanguages = (id: string) => (id === "tabellarisch" ? { resumeLanguageDisplay: { dots: false, level: true, description: false } } : {});

  it.each(templateIds)("A. keeps a short CV on a single page in %s", (id) => {
    const plan = resolve(makeProfile(1, 2, 1, compactLanguages(id)), id).pagePlan;
    expect(plan).toHaveLength(1);
    expect(plan[0].density).toBe("standard");
    expect(filled(plan, 0)).toBeLessThan(0.85);
  });

  it("flows a long résumé across every page it needs", () => {
    const profile = makeProfile(9, 5, 0);
    for (const id of templateIds) {
      const plan = resolve(profile, id).pagePlan;
      expect(plan.length).toBeGreaterThanOrEqual(2);
      expect(plan.map((page) => page.pageNumber)).toEqual(plan.map((_, index) => index + 1));
      expect(plan.every((page) => (page.fill?.main ?? 0) <= 1.02), `${id}: ${plan.map((page) => page.fill?.main).join(", ")}`).toBe(true);
      expect(idsOf(plan)).toEqual(profile.experiences.map((item) => item.id));
      expectEveryBulletOnce(plan, profile.experiences);
    }
    const generic = createResumePagePlan(profile);
    expect(generic.length).toBeGreaterThanOrEqual(2);
    expect(idsOf(generic)).toHaveLength(profile.experiences.length);
  });

  it.each(sidebarTemplates)("continues a long career through at least three pages in %s", (id) => {
    const profile = makeProfile(24, 8, 4);
    const plan = resolve(profile, id).pagePlan;
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.map((page) => page.pageNumber)).toEqual(plan.map((_, index) => index + 1));
    expect(idsOf(plan)).toEqual([...profile.experiences, ...profile.education].map((entry) => entry.id));
    expectEveryBulletOnce(plan, profile.experiences);
    expect(plan[0].fill!.main).toBeGreaterThan(0.7);
    expect(plan.slice(1).every((page) => (page.fill?.main ?? 0) <= 1.05)).toBe(true);
  });

  it("uses the measured geometry of each template instead of one shared capacity", () => {
    const profile = makeProfile(4, 3, 3);
    // DIN margins and readable body text require a continuation page here.
    expect(resolve(profile, "kreativ").pagePlan).toHaveLength(2);
    expect(resolve(profile, "pehlione_white_blue").pagePlan).toHaveLength(2);
  });

  it("makes longer text taller and wider columns shorter", () => {
    const plain = makeProfile(1, 2, 0);
    const longer = makeProfile(1, 6, 0);
    const heightOf = (profile: ReturnType<typeof makeProfile>, id: string) =>
      createResumePagePlan(profile, "", {}, id)[0].items[0].weight;
    expect(heightOf(longer, "modern")).toBeGreaterThan(heightOf(plain, "modern"));
    // The same entry wraps into fewer lines in the wide single column of Klassisch.
    expect(heightOf(longer, "klassisch")).toBeLessThan(heightOf(longer, "pehlione_white_blue"));
  });

  it("measures the education details actually drawn in the CV", () => {
    const plain = makeProfile(0, 0, 1);
    const rich = profileSchema.parse({ ...plain, education: [{ ...plain.education[0],
      fieldOfStudy: "Software Engineering", grade: "1,8", country: "Deutschland",
      description: "Abschlussarbeit über sichere verteilte Systeme und zuverlässige APIs. ".repeat(5),
    }] });
    const fill = (profile: ReturnType<typeof makeProfile>) => createResumePagePlan(profile, "", {}, "einspaltig")[0].fill!.main;
    expect(fill(rich)).toBeGreaterThan(fill(plain));
  });

  it("measures visible knowledge levels and descriptions as rendered text", () => {
    const base = makeProfile(0, 0, 0, { skills: [] });
    const category = {
      id: crypto.randomUUID(), title: "IT-Kenntnisse", type: "it", subtitle: "",
      items: [{ id: crypto.randomUUID(), name: "Java", level: "advanced", yearsOfExperience: 4,
        lastUsedYear: 2025, description: "", isVisible: true, sortOrder: 0 }],
      subcategories: [], displayMode: "comma-separated", showLevels: true,
      showYearsOfExperience: true, isVisible: true, sortOrder: 0,
    };
    const short = profileSchema.parse({ ...base, knowledgeSection: { title: "Besondere Kenntnisse", categories: [category], isVisible: true } });
    const long = profileSchema.parse({ ...short, knowledgeSection: { ...short.knowledgeSection, categories: [{ ...category,
      items: [{ ...category.items[0], description: "Spring Boot, REST APIs und verteilte Plattformen. ".repeat(6) }],
    }] } });
    const fill = (profile: ReturnType<typeof makeProfile>) => createResumePagePlan(profile, "", {}, "einspaltig")[0].fill!.main;
    expect(fill(long)).toBeGreaterThan(fill(short));
  });

  it("scales estimates with the user's font size and layout overrides", () => {
    const profile = makeProfile(2, 3, 1);
    const weightOf = (context: Parameters<typeof createResumePagePlan>[4]) =>
      createResumePagePlan(profile, "", {}, "zweispaltig", context)[0].items[0].weight;
    expect(weightOf({ overrides: { bodySizePt: 14 } })).toBeGreaterThan(weightOf({}));
    expect(weightOf({ overrides: { lineHeight: 1.8 } })).toBeGreaterThan(weightOf({}));
    // Enlarged text fills the page more; it never silently stays as roomy as before.
    const totalWeight = (context: Parameters<typeof createResumePagePlan>[4]) =>
      createResumePagePlan(makeProfile(3, 3, 2), "", {}, "kompakt", context)
        .flatMap((page) => page.items).reduce((sum, item) => sum + item.weight, 0);
    expect(totalWeight({ overrides: { bodySizePt: 14 } })).toBeGreaterThan(totalWeight({}) * 1.1);
  });

  it("accounts for legacy font, line, margin and section levels in the measured plan", () => {
    const profile = makeProfile(3, 3, 1);
    const totalWeight = (settings: Partial<typeof defaultDocumentDesign>) => resolve(profile, "elegant", settings)
      .pagePlan.flatMap((page) => page.items).reduce((sum, item) => sum + item.weight, 0);
    const firstFill = (settings: Partial<typeof defaultDocumentDesign>) => filled(resolve(profile, "elegant", settings).pagePlan, 0);
    const baseWeight = totalWeight({});
    expect(totalWeight({ fontSize: "large" })).toBeGreaterThan(baseWeight * 1.15);
    expect(totalWeight({ lineHeightLevel: 8 })).toBeGreaterThan(baseWeight);
    expect(firstFill({ marginLevel: 8 })).toBeGreaterThan(firstFill({}));
    expect(firstFill({ sectionSpacingLevel: 8 })).toBeGreaterThan(firstFill({}));
    // The legacy inner-padding slider does not alter Elegant's flow geometry.
    expect(firstFill({ paddingLevel: 8 })).toBe(firstFill({}));
  });

  it("reserves explicit page-margin overrides in addition to native template margins", () => {
    const profile = makeProfile(2, 2, 1);
    const base = resolve(profile, "kreativ").pagePlan[0].fill!.main;
    const wide = resolve(profile, "kreativ", { cvOverrides: { spacing: { pageMarginMm: 24 } } }).pagePlan[0].fill!.main;
    expect(wide).toBeGreaterThan(base);
  });

  it.each(templateIds)("B. fills page one before it starts page two in %s", (id) => {
    const profile = makeProfile(5, 4, 3);
    const plan = resolve(profile, id).pagePlan;
    expect(idsOf(plan)).toEqual([...profile.experiences, ...profile.education].map((item) => item.id));
    expectEveryBulletOnce(plan, profile.experiences);
    if (plan.length === 2) {
      // Word-style flow: the first page is used up to the last entry or bullet group that fits.
      expect(filled(plan, 0)).toBeGreaterThanOrEqual(0.72);
      expect(filled(plan, 0)).toBeLessThanOrEqual(1.02);
      expect(plan[1].items.length + (plan[1].blocks?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("uses free space in Zweispaltig's first main column for education", () => {
    const plan = resolve(makeProfile(3, 3, 6), "zweispaltig").pagePlan;
    expect(plan).toHaveLength(2);
    expect(plan[0].items.slice(0, 3).every((item) => item.kind === "experience")).toBe(true);
    expect(plan[0].items.some((item) => item.kind === "education")).toBe(true);
    expect(plan[1].items.every((item) => item.kind === "education")).toBe(true);
    expect(plan[0].fill!.main).toBeLessThanOrEqual(1);
  });

  it("splits a section after the last entry that fits instead of moving it to page two", () => {
    // Five long roles do not fit on one page: Berufserfahrung continues on page two.
    const plan = resolve(makeProfile(5, 5, 1), "modern").pagePlan;
    expect(plan).toHaveLength(2);
    expect(plan[0].items.length).toBeGreaterThan(0);
    expect(plan[1].items.length).toBeGreaterThan(0);
    expect(filled(plan, 0)).toBeGreaterThanOrEqual(0.72);
  });

  it.each(templateIds)("starts the education on page one when there is room for it in %s", (id) => {
    // Three short roles leave space below them: Ausbildung must not wait for page two as a whole.
    const profile = makeProfile(3, 3, 8);
    const plan = resolve(profile, id).pagePlan;
    if (plan.length === 2) {
      expect(plan[0].items.some((item) => item.kind === "education")).toBe(true);
      expect(filled(plan, 0)).toBeGreaterThanOrEqual(0.72);
    }
  });

  it.each(templateIds)("C. lets a very long role continue on the next page in reading order in %s", (id) => {
    const profile = makeProfile(6, 6, 2, compactLanguages(id));
    const plan = resolve(profile, id).pagePlan;
    if (id === "zweispaltig" || id === "zeitgenoessisch" || id === "kreativ") expect(plan.length).toBeGreaterThanOrEqual(2);
    else expect(plan).toHaveLength(2);
    expect(idsOf(plan)).toEqual([...profile.experiences, ...profile.education].map((item) => item.id));
    expectEveryBulletOnce(plan, profile.experiences);
    // Career items never come back: once education starts, no experience follows.
    const kinds = plan.flatMap((page) => page.items.map((item) => item.kind));
    expect(kinds.join(",")).not.toMatch(/education,experience/);
    for (const page of plan) expect(page.items.length).toBeGreaterThan(0);
    // An entry breaks between bullets only: the header is repeated and both parts hold bullets.
    for (const [, first, second] of brokenEntries(plan)) {
      expect(first.to).toBeGreaterThan(first.from);
      expect(second.to).toBeGreaterThan(second.from);
      expect(second.from).toBe(first.to);
    }
  });

  it.each(["einspaltig", "modern", "pehlione_white_blue", "zweispaltig", "elegant", "tabellarisch"])("Test 2: a long role that does not fit is split between bullets, not moved as a whole in %s", (id) => {
    // Somewhere between a full page and two, the page ends inside a role: it continues on page two.
    let split: ResumePagePlan[] | undefined;
    let profile = makeProfile(1, 1, 0);
    for (const roles of [3, 4, 5, 6]) {
      for (const bullets of [4, 5, 6, 7, 8]) {
        const candidate = makeProfile(roles, bullets, 1);
        const plan = resolve(candidate, id).pagePlan;
        if (plan.length === 2 && brokenEntries(plan).length && !split) {
          split = plan;
          profile = candidate;
        }
      }
    }
    expect(split).toBeDefined();
    const [, first, second] = brokenEntries(split!)[0];
    expect(first.from).toBe(0);
    expect(second.to).toBe(first.total);
    expect(second.from).toBe(first.to);
    expectEveryBulletOnce(split!, profile.experiences);
  });

  it("never breaks an entry whose bullets are too short to leave two lines on either side", () => {
    // Three one-line bullets cannot be split (2 + 1 would leave a widow), four can (2 + 2).
    const short = (count: number) => makeProfile(9, count, 0, {
      experiences: Array.from({ length: 9 }, (_, index) => ({
        id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`,
        achievements: Array.from({ length: count }, (_, item) => `Aufgabe ${item + 1}`),
      })),
    });
    for (const id of templateIds) {
      expect(brokenEntries(resolve(short(3), id).pagePlan)).toHaveLength(0);
    }
    const four = resolve(short(4), "einspaltig").pagePlan;
    expect(four).toHaveLength(2);
    for (const [, first, second] of brokenEntries(four)) expect([first.to - first.from, second.to - second.from]).toEqual([2, 2]);
  });

  it("does not leave the signature alone on the last page", () => {
    for (const id of templateIds) {
      for (let roles = 3; roles <= 8; roles += 1) {
        const plan = resolve(makeProfile(roles, 4, 2), id).pagePlan;
        if (plan.length === 2) expect(plan[1].items.length + (plan[1].blocks?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it("D. never leaves a page without content when the education is long", () => {
    for (const id of templateIds) {
      const plan = resolve(makeProfile(2, 2, 10), id).pagePlan;
      expect(idsOf(plan)).toHaveLength(12);
      expect(plan[0].items.length).toBeGreaterThan(0);
      // The last page is never empty: it holds career entries or the blocks that follow them.
      if (plan.length === 2) expect(plan[1].items.length + (plan[1].blocks?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("keeps long one-page visual-template profiles on at most two balanced pages", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya",
      experiences: [[128, 170, 58], [80, 0, 105, 0, 121], [111, 0, 120, 0, 69]].map((lengths, index) => ({
        id: crypto.randomUUID(), from: `${2012 + index * 4}`, to: `${2016 + index * 4}`,
        role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`,
        achievements: lengths.map((length) => "A".repeat(length)),
      })),
      education: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(), from: `${2006 + index * 2}`, to: `${2008 + index * 2}`,
        degree: `Abschluss ${index + 1}`, institution: `Hochschule ${index + 1}`,
      })),
      updatedAt: now,
    });
    for (const id of templateIds) {
      const plan = createResumePagePlan(profile, "", {}, id);
      expect(idsOf(plan)).toHaveLength(6);
      expect(plan.length).toBeLessThanOrEqual(2);
      if (plan.length === 1) expect(plan[0].density).not.toBe("dense");
    }
    for (const id of ["kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league"]) {
      expect(createResumePagePlan(profile, "", {}, id)).toHaveLength(1);
    }
  });

  it("prefers a compacted single page over a nearly empty second page", () => {
    // Gepflegt compacts strongly; content just above one page fits after compaction.
    const profile = makeProfile(3, 3, 3);
    const plan = resolve(profile, "gepflegt").pagePlan;
    if (plan.length === 1) expect(plan[0].fill!.main).toBeLessThanOrEqual(1);
    else expect(filled(plan, 1)).toBeGreaterThanOrEqual(0.35);
  });

  it("keeps Modern career items in reading order after a manual page break", () => {
    const profile = makeProfile(3, 1, 1);
    const plan = createResumePagePlan(profile, "", { firstPageItemCount: 2 }, "modern");
    expect(plan).toHaveLength(2);
    expect(plan[0].items.map((item) => item.kind)).toEqual(["experience", "experience"]);
    expect(plan[1].items.map((item) => item.kind)).toEqual(["experience", "education"]);
  });

  it("keeps Einspaltig experience entries ahead of education after a page split", () => {
    const plan = createResumePagePlan(makeProfile(6, 4, 2), "", {}, "einspaltig");
    const first = new Map<string, string>();
    for (const item of plan.flatMap((page) => page.items)) if (!first.has(item.id)) first.set(item.id, item.kind);
    expect(plan).toHaveLength(2);
    expect([...first.values()]).toEqual([...Array(6).fill("experience"), ...Array(2).fill("education")]);
  });

  it("follows a custom section order from the layout manager", () => {
    const base = makeProfile(2, 1, 2);
    const profile = profileSchema.parse({
      ...base,
      resumeManagerLayouts: { modern: [{ id: "education", zone: "main" }, { id: "experience", zone: "main" }] },
    });
    const kinds = createResumePagePlan(profile, "", {}, "modern").flatMap((page) => page.items.map((item) => item.kind));
    expect(kinds).toEqual(["education", "education", "experience", "experience"]);
  });

  it("keeps a complete Pehlione career timeline on one page", () => {
    const plan = createResumePagePlan(makeProfile(3, 3, 1), "", {}, "pehlione_white_blue");
    expect(plan).toHaveLength(1);
    expect(plan[0].items.map((item) => item.kind)).toEqual(["experience", "experience", "experience", "education"]);
  });

  it("counts the summary, the project highlight and other page-one blocks", () => {
    const shortSummary = makeProfile(2, 2, 1, { summary: "Kurz." });
    const longSummary = makeProfile(2, 2, 1, { summary: "Ein sehr ausführliches Profil. ".repeat(40) });
    // A long summary may push the last entry to page two: compare the whole document, not page one alone.
    const fill = (profile: ReturnType<typeof makeProfile>) => resolve(profile, "einspaltig").pagePlan.reduce((sum, page) => sum + page.fill!.main, 0);
    expect(fill(longSummary)).toBeGreaterThan(fill(shortSummary) + 0.05);
    const withProject = (projects: string[]) => makeProfile(1, 3, 0, { experiences: [{
      id: crypto.randomUUID(), from: "2024", to: "2025", role: "Praktikum", company: "Stadt",
      projects, achievements: [bullet(0), bullet(1), bullet(2)],
    }] });
    // The project block may move to page two together with the signature: compare the whole document.
    const total = (projects: string[]) => resolve(withProject(projects), "pehlione_white_blue").pagePlan.reduce((sum, page) => sum + page.fill!.main, 0);
    expect(total(["Grafana Datasource Plugin"])).toBeGreaterThan(total([]));
  });

  it("keeps the order of the blocks behind the career entries: Tabellarisch draws languages before knowledge", () => {
    const many = Array.from({ length: 64 }, (_, index) => `Technologie ${index + 1} im Einsatz`);
    const profile = makeProfile(3, 3, 1, { skills: many });
    // Einspaltig draws knowledge first, so its list may start on page one ...
    const einspaltig = resolve(profile, "einspaltig").pagePlan;
    expect(einspaltig[0].blockRanges?.knowledge ?? einspaltig[0].blocks?.includes("knowledge")).toBeTruthy();
    // ... Tabellarisch draws the languages first: the knowledge list must not jump ahead of them.
    const tabellarisch = resolve(profile, "tabellarisch").pagePlan;
    expect(tabellarisch[0].blocks ?? []).not.toContain("knowledge");
    expect(tabellarisch[1].blocks).toContain("knowledge");
  });

  it("splits the knowledge list at a grid row and shares its items exactly", () => {
    const many = Array.from({ length: 64 }, (_, index) => `Technologie ${index + 1} im Einsatz`);
    const plan = resolve(makeProfile(3, 3, 1, { skills: many }), "einspaltig").pagePlan;
    const first = plan[0].blockRanges?.knowledge;
    const last = plan[1].blockRanges?.knowledge;
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    expect(first!.from).toBe(0);
    expect(last!.to).toBe(64);
    expect(last!.from).toBe(first!.to);
    // Whole grid rows (three columns) stay on page one, and two rows stay on either side.
    expect(first!.to % 3).toBe(0);
    expect(first!.to).toBeGreaterThanOrEqual(6);
    expect(64 - first!.to).toBeGreaterThanOrEqual(6);
  });

  it("widens the estimate for a broader sidebar: the profile column ratio takes width from the main column", () => {
    const narrow = resolve(makeProfile(3, 3, 1, { resumeColumnRatio: 30 }), "pehlione_white_blue").pagePlan;
    const wide = resolve(makeProfile(3, 3, 1, { resumeColumnRatio: 40 }), "pehlione_white_blue").pagePlan;
    const firstWeight = (plan: ResumePagePlan[]) => plan[0].items[0].weight;
    expect(firstWeight(wide)).toBeGreaterThan(firstWeight(narrow));
  });

  it("places certificates on the template's actual page and column", () => {
    const certificates = ["TÜV Sicherheit", "SAP Grundlagen"];
    const profile = makeProfile(5, 4, 3, { certifications: certificates });
    const elegant = resolve(profile, "elegant").pagePlan;
    const elegantWithout = resolve(makeProfile(5, 4, 3), "elegant").pagePlan;
    const pehlione = resolve(profile, "pehlione_white_blue").pagePlan;
    expect(elegant).toHaveLength(2);
    expect(pehlione).toHaveLength(2);
    expect(elegant[0].fill!.sidebar).toBeGreaterThan(elegantWithout[0].fill!.sidebar);
    expect(elegant[1].blocks).not.toContain("certifications");
    expect(pehlione[0].blocks).not.toContain("certifications");
    expect(pehlione[1].blocks).toContain("certifications");
  });

  it("uses the configured grid column count when a knowledge section moves to the main column", () => {
    const skills = Array.from({ length: 18 }, (_, index) => `Produktionssystem ${index + 1} mit Prozesssteuerung`);
    const profile = makeProfile(1, 1, 0, {
      skills,
      resumeManagerLayouts: { modern: [{ id: "experience", zone: "main" }, { id: "knowledge", zone: "main" }] },
    });
    const one = resolve(profile, "modern", { knowledgeColumns: 1 }).pagePlan[0].fill!.main;
    const three = resolve(profile, "modern", { knowledgeColumns: 3 }).pagePlan[0].fill!.main;
    expect(one).toBeGreaterThan(three);
  });

  it("measures language rows from the chosen columns, dots and wrapped descriptions", () => {
    const profile = makeProfile(0, 0, 0, {
      languages: ["Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1", "Bosnisch-Kroatisch-Serbisch – C1", "Italienisch – B2"],
      resumeManagerLayouts: { klassisch: [{ id: "languages", zone: "main" }] },
    });
    const fill = (columns: 1 | 3, dots: boolean) => resolve(profileSchema.parse({ ...profile, resumeLanguageDisplay: { dots, level: true, description: true } }),
      "klassisch", { languagesColumns: columns }).pagePlan.at(-1)!.fill!.main;
    expect(fill(1, true)).toBeGreaterThan(fill(3, true));
    expect(fill(1, true)).toBeGreaterThan(fill(1, false));
  });

  it("counts Pehlione's configured entry gap between career entries", () => {
    const profile = makeProfile(2, 1, 0);
    const base = resolve(profile, "pehlione_white_blue").pagePlan[0].fill!.main;
    const spaced = resolve(profile, "pehlione_white_blue", { cvOverrides: { spacing: { entryGapMm: 12 } } }).pagePlan[0].fill!.main;
    expect(spaced).toBeGreaterThan(base);
  });

  it("a first page never overflows by the model's own estimate unless nothing else fits", () => {
    for (const id of templateIds) {
      const plan = resolve(makeProfile(5, 4, 3), id).pagePlan;
      for (const page of plan) expect(page.fill!.main).toBeLessThanOrEqual(1.02);
    }
  });
});

describe("sidebar handling", () => {
  it.each(sidebarTemplates)("E. never keeps an idle sidebar on the continuation page in %s", (id) => {
    const plan = resolve(makeProfile(5, 4, 3), id).pagePlan;
    for (const page of plan.slice(1)) expect(page.sidebar).toBe(false);
    expect(plan[0].sidebar).toBe(true);
  });

  it.each(sidebarTemplates)("hosts small sidebar blocks on page one instead of a second-page sidebar in %s", (id) => {
    const plan = resolve(makeProfile(5, 4, 3), id).pagePlan;
    if (plan.length === 2) {
      const hostedFirst = plan[0].blocks?.includes("knowledge");
      const hostedLast = plan[1].blocks?.includes("knowledge");
      expect(Boolean(hostedFirst) !== Boolean(hostedLast)).toBe(true);
      if (hostedFirst) expect(plan[0].fill!.sidebar).toBeLessThanOrEqual(1);
    }
  });

  // Templates with a continuation sidebar break the list at its rows instead (documentPagination.sidebarLane.test.ts).
  it.each(sidebarTemplates.filter((id) => !supportsSidebarContinuation(id)))("F. moves an oversized sidebar list to the last page instead of overflowing in %s", (id) => {
    const many = Array.from({ length: 40 }, (_, index) => `Technologie ${index + 1} im Produktivbetrieb`);
    const profile = makeProfile(5, 4, 3, { skills: many });
    const plan = resolve(profile, id).pagePlan;
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan[0].fill!.sidebar).toBeLessThanOrEqual(1);
    expect(plan[0].blocks).not.toContain("knowledge");
    expect(plan.slice(1).some((page) => page.blocks?.includes("knowledge"))).toBe(true);
  });

  it("uses the native column of a section until the user arranges the layout", () => {
    // Modern draws the summary in the main column even though the manager lists it beside the sidebar.
    const profile = makeProfile(3, 3, 0, { summary: "Ein sehr ausführliches Profil. ".repeat(25) });
    const native = resolve(profile, "modern").pagePlan[0].fill!;
    const arranged = resolve(
      profileSchema.parse({ ...profile, resumeManagerLayouts: { modern: [{ id: "summary", zone: "sidebar" }, { id: "experience", zone: "main" }] } }),
      "modern",
    ).pagePlan[0].fill!;
    expect(native.main).toBeGreaterThan(arranged.main);
  });
});

describe("closing block and output modes", () => {
  it("G/H. reserves room for a signature only when it is shown", () => {
    // The same split, so that only the closing block differs.
    const lastFill = (extra: Record<string, unknown>) => {
      const plan = createResumePagePlan(makeProfile(6, 5, 1, extra), "", { firstPageItemCount: 3 }, "klassisch");
      expect(plan.length).toBeGreaterThanOrEqual(2);
      return filled(plan, 1);
    };
    const withSignature = lastFill({ signaturePath: signature });
    const placeOnly = lastFill({ signaturePath: "", resumeClosing: { showPlace: true, showDate: true, showSignature: false } });
    const hidden = lastFill({ signaturePath: signature, resumeClosing: { showPlace: false, showDate: false, showSignature: false } });
    expect(withSignature).toBeGreaterThan(placeOnly);
    expect(placeOnly).toBeGreaterThan(hidden);
  });

  it("I. plans ATS as one flowing column without sidebar or hosted-on-page-one blocks", () => {
    for (const id of templateIds) {
      const plan = resolve(makeProfile(5, 4, 3), id, { resumeOutputMode: "ats" }).pagePlan;
      expect(plan.length).toBeGreaterThanOrEqual(1);
      for (const page of plan) expect(page.sidebar).toBe(false);
      expect(idsOf(plan)).toHaveLength(8);
      // Knowledge follows the career entries: it starts on page one only if page one has room left.
      expect(plan.flatMap((page) => page.blocks ?? [])).toContain("knowledge");
    }
  });

  it("treats a layout switched to a single column like a wide flowing column", () => {
    const long = `${bullet(0)} Zusätzlich wurden die Ergebnisse dokumentiert und im Team vorgestellt, um sie dauerhaft zu verankern.`;
    const profile = makeProfile(4, 1, 2, { experiences: Array.from({ length: 4 }, (_, index) => ({
      id: crypto.randomUUID(), from: "2010", to: "2011", role: `Position ${index + 1}`, company: "Unternehmen",
      achievements: [long, long, long],
    })) });
    const single = resolve(profile, "pehlione_white_blue", { resumePresentation: { layoutMode: "single" } });
    const native = resolve(profile, "pehlione_white_blue");
    expect(single.pagePlan[0].items[0].weight).toBeLessThan(native.pagePlan[0].items[0].weight);
  });

  describe("plain (ATS) layout", () => {
    const ats = { resumeOutputMode: "ats" } as const;
    const noKnowledge = { resumeSections: { profile: true, strengths: true, experience: true, education: true, skills: false, languages: true, certifications: true } };
    const contacts = { phone: "+49 30 123456", linkedin: "https://linkedin.com/in/mina", github: "https://github.com/mina", portfolio: "https://mina.example.com" };

    it("stacks the contacts of Elegant and Zweispaltig, so their header grows with every contact", () => {
      const few = makeProfile(1, 2, 0);
      const many = makeProfile(1, 2, 0, contacts);
      for (const id of ["zweispaltig", "elegant"]) {
        expect(filled(resolve(many, id, ats).pagePlan, 0)).toBeGreaterThan(filled(resolve(few, id, ats).pagePlan, 0) + 0.05);
      }
      // A hidden contact block leaves the header at its bare height.
      const hidden = makeProfile(1, 2, 0, {
        ...contacts,
        resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
          section.semanticType === "personalData" ? { ...section, visible: false } : section),
      });
      expect(filled(resolve(hidden, "zweispaltig", ats).pagePlan, 0)).toBeLessThan(filled(resolve(makeProfile(1, 2, 0, contacts), "zweispaltig", ats).pagePlan, 0) - 0.05);
      // The other plain layouts keep one measured header whatever the contacts are.
      expect(filled(resolve(many, "einspaltig", ats).pagePlan, 0)).toBeCloseTo(filled(resolve(few, "einspaltig", ats).pagePlan, 0), 6);
    });

    it("draws the knowledge list as one paragraph per category instead of a grid", () => {
      const skills = Array.from({ length: 60 }, (_, index) => `Technologie ${index + 1} im Einsatz`);
      const base = makeProfile(1, 2, 0);
      const rich = makeProfile(1, 2, 0, { skills });
      const growth = (settings: Partial<typeof defaultDocumentDesign>) =>
        resolve(rich, "einspaltig", settings).pagePlan.reduce((sum, page) => sum + (page.fill?.main ?? 0), 0)
        - resolve(base, "einspaltig", settings).pagePlan.reduce((sum, page) => sum + (page.fill?.main ?? 0), 0);
      expect(resolve(rich, "einspaltig", ats).pagePlan).toHaveLength(1);
      expect(growth(ats)).toBeGreaterThan(0.1);
      expect(growth(ats)).toBeLessThan(growth({}) * 0.75);
    });

    it("counts a paragraph line per wrapped line: longer skill lists take more room", () => {
      const list = (count: number) => makeProfile(1, 2, 0, { skills: Array.from({ length: count }, (_, index) => `Technologie ${index + 1} im Einsatz`) });
      const at = (count: number) => filled(resolve(list(count), "klassisch", ats).pagePlan, 0);
      expect(at(6)).toBeLessThan(at(24));
      expect(at(24)).toBeLessThan(at(48));
    });

    it("lists every certificate in the plain layouts, whatever the styled template shows of them", () => {
      const many = makeProfile(1, 2, 0, { certifications: Array.from({ length: 8 }, (_, index) => `Zertifikat ${index + 1} des Anbieters`) });
      const none = makeProfile(1, 2, 0);
      const growth = (id: string, settings: Partial<typeof defaultDocumentDesign> = {}) =>
        filled(resolve(many, id, settings).pagePlan, 0) - filled(resolve(none, id, settings).pagePlan, 0);
      // Stilvoll draws none, Kompakt two of them; the plain layouts print all eight.
      expect(growth("stilvoll")).toBeCloseTo(0, 6);
      expect(growth("stilvoll", ats)).toBeGreaterThan(0.08);
      expect(growth("kompakt", ats)).toBeGreaterThan(growth("kompakt") + 0.05);
    });

    it("measures languages as lines of text: each one costs about the same", () => {
      const languages = (count: number) => makeProfile(1, 2, 0, { languages: Array.from({ length: count }, (_, index) => `Sprache ${index + 1} – B2`) });
      const at = (id: string, count: number) => filled(resolve(languages(count), id, ats).pagePlan, 0);
      for (const id of ["einspaltig", "modern", "elegant"]) {
        const step = at(id, 4) - at(id, 2);
        expect(step).toBeGreaterThan(0.03);
        expect(at(id, 6) - at(id, 4)).toBeCloseTo(step, 2);
      }
    });

    it("reserves room for skills shown as strengths only where the template draws them", () => {
      const withSkills = makeProfile(1, 2, 0, { ...noKnowledge, strengths: [] });
      const withoutSkills = makeProfile(1, 2, 0, { ...noKnowledge, strengths: [], skills: [] });
      const growth = (id: string, settings: Partial<typeof defaultDocumentDesign> = {}) =>
        filled(resolve(withSkills, id, settings).pagePlan, 0) - filled(resolve(withoutSkills, id, settings).pagePlan, 0);
      expect(growth("einspaltig")).toBeGreaterThan(0.03);
      expect(growth("modern")).toBeCloseTo(0, 6);
      expect(growth("pehlione_white_blue", ats)).toBeCloseTo(0, 6);
      expect(growth("einspaltig", ats)).toBeGreaterThan(0.03);
      expect(growth("tabellarisch", ats)).toBeGreaterThan(0.03);
    });

    it("drops skills shown as strengths from a plain résumé that needs a second page", () => {
      const long = (skills: string[]) => makeProfile(9, 5, 0, { ...noKnowledge, strengths: [], skills });
      const withSkills = resolve(long(["TypeScript", "React", "Node.js", "SQL"]), "einspaltig", ats).pagePlan;
      const withoutSkills = resolve(long([]), "einspaltig", ats).pagePlan;
      expect(withSkills).toHaveLength(2);
      expect(withSkills.map((page) => page.items.map((item) => item.id).length)).toEqual(withoutSkills.map((page) => page.items.map((item) => item.id).length));
      expect(filled(withSkills, 0)).toBeCloseTo(filled(withoutSkills, 0), 6);
    });
  });

  it("supports a manual page break", () => {
    const profile = makeProfile(4, 1, 2);
    const plan = createResumePagePlan(profile, "", { firstPageItemCount: 1 }, "modern");
    expect(plan.map((page) => page.items.length)).toEqual([1, 5]);
  });
});

describe("letter pagination", () => {
  it("marks long cover letters for dense one-page rendering", () => {
    const status = getLetterPageStatus({
      coverSubject: "Bewerbung",
      coverIntroduction: "A".repeat(900),
      coverMainBody: "",
      coverMotivation: "B".repeat(900),
      coverQualification: "C".repeat(900),
      coverCompanyFit: "D".repeat(900),
      coverExtraParagraph: "",
      coverClosing: "E".repeat(900),
    });

    expect(status.density).toBe("dense");
    expect(status.isOverRecommendedLength).toBe(true);
  });
});
