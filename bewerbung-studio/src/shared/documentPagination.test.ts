import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { defaultDocumentDesign } from "./documentDesign";
import { resolveCvDocument } from "./resolveCvDocument";
import { createResumePagePlan, getLetterPageStatus, type ResumePagePlan } from "./documentPagination";
import { getPaginationGeometry } from "./resumePaginationGeometry";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";

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

const idsOf = (plan: ResumePagePlan[]) => plan.flatMap((page) => page.items.map((item) => item.id));
const filled = (plan: ResumePagePlan[], index: number) => plan[index].fill?.main ?? 0;

describe("A4 document pagination", () => {
  it("keeps compact resumes on one page", () => {
    expect(createResumePagePlan(makeProfile(1, 1, 0))).toHaveLength(1);
  });

  it.each(templateIds)("A. keeps a short CV on a single page in %s", (id) => {
    const plan = resolve(makeProfile(1, 2, 1), id).pagePlan;
    expect(plan).toHaveLength(1);
    expect(plan[0].density).toBe("standard");
    expect(filled(plan, 0)).toBeLessThan(0.8);
  });

  it("moves whole resume entries to a second page and never creates a third", () => {
    const profile = makeProfile(9, 5, 0);
    for (const id of templateIds) {
      const plan = resolve(profile, id).pagePlan;
      expect(plan).toHaveLength(2);
      expect(idsOf(plan)).toEqual(profile.experiences.map((item) => item.id));
    }
    const generic = createResumePagePlan(profile);
    expect(generic).toHaveLength(2);
    expect(new Set(idsOf(generic)).size).toBe(profile.experiences.length);
  });

  it("uses the measured geometry of each template instead of one shared capacity", () => {
    const profile = makeProfile(4, 3, 3);
    // Wide two-column layouts fit the whole CV on one page; a narrow main column next to a tall sidebar does not.
    expect(resolve(profile, "kreativ").pagePlan).toHaveLength(1);
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

  it.each(templateIds)("B. distributes a normal two-page CV without an empty second page in %s", (id) => {
    const profile = makeProfile(5, 4, 3);
    const plan = resolve(profile, id).pagePlan;
    expect(idsOf(plan)).toEqual([...profile.experiences, ...profile.education].map((item) => item.id));
    if (plan.length === 2) {
      // Never “page one 95 % full, page two 30 % full”.
      expect(filled(plan, 1)).toBeGreaterThanOrEqual(0.35);
      expect(filled(plan, 0)).toBeGreaterThanOrEqual(0.45);
      expect(filled(plan, 0) - filled(plan, 1)).toBeLessThan(0.5);
    }
  });

  it.each(["zweispaltig"])("prefers a section boundary when the pages stay reasonably balanced in %s", (id) => {
    const plan = resolve(makeProfile(3, 3, 4), id).pagePlan;
    expect(plan).toHaveLength(2);
    expect(plan[0].items.every((item) => item.kind === "experience")).toBe(true);
    expect(plan[1].items.every((item) => item.kind === "education")).toBe(true);
  });

  it("splits a section between two entries instead of leaving one page nearly empty", () => {
    // Five long roles do not fit on one page; the first page must not swallow four of them.
    const plan = resolve(makeProfile(5, 5, 1), "modern").pagePlan;
    expect(plan).toHaveLength(2);
    expect(plan[0].items.length).toBeGreaterThan(0);
    expect(plan[1].items.length).toBeGreaterThan(0);
    expect(filled(plan, 1)).toBeGreaterThanOrEqual(0.35);
  });

  it.each(templateIds)("C. keeps entries whole and in reading order for very long roles in %s", (id) => {
    const profile = makeProfile(6, 6, 2);
    const plan = resolve(profile, id).pagePlan;
    expect(plan).toHaveLength(2);
    expect(idsOf(plan)).toEqual([...profile.experiences, ...profile.education].map((item) => item.id));
    // Career items never come back: once education starts, no experience follows.
    const kinds = plan.flatMap((page) => page.items.map((item) => item.kind));
    expect(kinds.join(",")).not.toMatch(/education,experience/);
    for (const page of plan) expect(page.items.length).toBeGreaterThan(0);
  });

  it("D. never leaves a page without content when the education is long", () => {
    for (const id of templateIds) {
      const plan = resolve(makeProfile(2, 2, 10), id).pagePlan;
      expect(idsOf(plan)).toHaveLength(12);
      for (const page of plan) expect(page.items.length).toBeGreaterThan(0);
      // The last experience and the first education entry never share a lonely page tail.
      if (plan.length === 2) expect(filled(plan, 1)).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("keeps long one-page visual-template profiles on at most two balanced pages", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir",
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
    for (const id of ["kreativ", "kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league", "zweispaltig"]) {
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
    const kinds = plan.flatMap((page) => page.items.map((item) => item.kind));
    expect(plan).toHaveLength(2);
    expect(kinds).toEqual([...Array(6).fill("experience"), ...Array(2).fill("education")]);
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
    const fill = (profile: ReturnType<typeof makeProfile>) => resolve(profile, "einspaltig").pagePlan[0].fill!.main;
    expect(fill(longSummary)).toBeGreaterThan(fill(shortSummary) + 0.05);
    const withProject = (projects: string[]) => makeProfile(1, 3, 0, { experiences: [{
      id: crypto.randomUUID(), from: "2024", to: "2025", role: "Praktikum", company: "Stadt",
      projects, achievements: [bullet(0), bullet(1), bullet(2)],
    }] });
    const projectFill = resolve(withProject(["Grafana Datasource Plugin"]), "pehlione_white_blue").pagePlan[0].fill!.main;
    const withoutProjects = resolve(withProject([]), "pehlione_white_blue").pagePlan[0].fill!.main;
    expect(projectFill).toBeGreaterThan(withoutProjects);
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

  it.each(sidebarTemplates)("F. moves an oversized sidebar list to the last page instead of overflowing in %s", (id) => {
    const many = Array.from({ length: 40 }, (_, index) => `Technologie ${index + 1} im Produktivbetrieb`);
    const profile = makeProfile(5, 4, 3, { skills: many });
    const plan = resolve(profile, id).pagePlan;
    expect(plan).toHaveLength(2);
    expect(plan[0].fill!.sidebar).toBeLessThanOrEqual(1);
    expect(plan[0].blocks).not.toContain("knowledge");
    expect(plan[1].blocks).toContain("knowledge");
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
      expect(plan).toHaveLength(2);
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
      expect(plan.length).toBeLessThanOrEqual(2);
      for (const page of plan) expect(page.sidebar).toBe(false);
      expect(idsOf(plan)).toHaveLength(8);
      if (plan.length === 2) expect(plan[1].blocks).toContain("knowledge");
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
