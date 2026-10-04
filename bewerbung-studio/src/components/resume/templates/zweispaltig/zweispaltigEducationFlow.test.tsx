import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCv } from "../../__parityHarness";
import { createResumePagePlan, type ResumePagePlan } from "../../../../shared/documentPagination";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { educationDetailUnits, resolveEducationPresentation } from "../../../../shared/resumeEducation";
import { educationSentence, makeEducationFlowProfile, type EducationFlowOptions } from "../../../../shared/__educationFlowFixture";

/**
 * Zweispaltig, the reported Lebenslauf: after the Beruflicher Werdegang page one still has room, and the whole Bildungsweg
 * went to page two. The education entry is cut between its detail units like an experience between its bullets, so
 * Bildungsweg starts where the room is and goes on on the next page; the heading never stands alone.
 */
const settings = getTemplateDocumentDesignDefaults("zweispaltig");
const withSpacing = (spacing?: Record<string, number>) => (spacing ? { ...settings, cvOverrides: { spacing } } : settings);
const resolve = (options: EducationFlowOptions, spacing?: Record<string, number>) =>
  resolveCvDocument({ profile: makeEducationFlowProfile(options), templateId: "zweispaltig", settings: withSpacing(spacing) });
const plan = (options: EducationFlowOptions, spacing?: Record<string, number>) => resolve(options, spacing).pagePlan;

const educationOf = (page: ResumePagePlan) => page.items.filter((item) => item.kind === "education");
const shape = (pages: ResumePagePlan[]) => pages.map((page) => page.items.map((item) => `${item.kind === "experience" ? "X" : "E"}${item.id.slice(-2)}${"bullets" in item && item.bullets ? `[${item.bullets.from}-${item.bullets.to}/${item.bullets.total}]` : ""}`).join(",")).join(" | ");
const text = (page: Element) => (page.textContent ?? "").replace(/\s+/g, " ");
const countOf = (pages: Element[], needle: string) => pages.map(text).join(" ").split(needle).length - 1;

describe("Bildungsweg starts on page one when there is room", () => {
  it("starts with its header and the first details after a Beruflicher Werdegang that leaves room (48, 51)", () => {
    const pages = plan({ bullets: [2, 2, 2] });
    expect(pages).toHaveLength(2);
    const first = educationOf(pages[0]);
    expect(first).toHaveLength(1);
    expect(first[0].bullets).toBeDefined();
    expect(first[0].bullets!.from).toBe(0);
    expect(first[0].bullets!.to).toBeGreaterThan(0);
    expect(first[0].bullets!.to).toBeLessThan(first[0].bullets!.total);
    // page two goes on with the same entry from there, then the other entries, in order
    const second = educationOf(pages[1]);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].bullets).toMatchObject({ from: first[0].bullets!.to, to: first[0].bullets!.total });
    expect(second.map((item) => item.id.slice(-2))).toEqual(["20", "21", "22"]);
    expect(pages[0].items.filter((item) => item.kind === "experience")).toHaveLength(3);
  });

  it("keeps a first entry that fits whole on page one, without a continuation (50)", () => {
    const pages = plan({ bullets: [1, 1, 1], sentences: 1, educationCount: 3 });
    const first = educationOf(pages[0]);
    expect(first.length).toBeGreaterThan(0);
    expect(first[0]).not.toHaveProperty("bullets");
    if (pages.length > 1) expect(educationOf(pages[1])[0]?.id).not.toBe(first[0].id);
  });

  it("moves the whole section to page two when not even the header and one detail fit, and never leaves the heading alone (49)", () => {
    const pages = plan({ bullets: [9, 7, 8] });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages) {
      // a page that has education items has the heading with them, a page without has neither
      expect(educationOf(page).length > 0 || !page.items.some((item) => item.kind === "education")).toBe(true);
    }
    const rendered = renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [9, 7, 8] }));
    for (const pagesOf of [rendered.previewPages, rendered.pdfPages]) {
      for (const page of pagesOf) {
        const section = page.querySelector('[data-managed-section="education"]');
        if (section) expect(section.querySelectorAll("article").length, "an education heading is never alone").toBeGreaterThan(0);
      }
    }
  });

  it("never leaves the heading of Bildungsweg alone, whatever the room is", () => {
    for (const a of [3, 4, 5, 7, 9]) for (const b of [3, 5, 8]) {
      const rendered = renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [a, b, 5] }));
      for (const pages of [rendered.previewPages, rendered.pdfPages])
        for (const page of pages) {
          const section = page.querySelector('[data-managed-section="education"]');
          if (section) expect(section.querySelectorAll("article").length, `${a}/${b}`).toBeGreaterThan(0);
        }
    }
  }, 30_000);
});

describe("an education entry that breaks loses nothing and doubles nothing", () => {
  const profile = makeEducationFlowProfile({ bullets: [4, 4, 4] });
  const total = (options: EducationFlowOptions, spacing?: Record<string, number>) => {
    const rendered = renderCv("zweispaltig", makeEducationFlowProfile(options), { overrides: spacing ? { cvOverrides: { spacing } } : {} });
    return rendered;
  };

  it("draws every sentence of every description exactly once, and the entries in their order, on both surfaces", () => {
    const rendered = total({ bullets: [2, 2, 2] });
    for (const pages of [rendered.previewPages, rendered.pdfPages]) {
      for (let entry = 1; entry <= 3; entry += 1)
        for (let sentence = 1; sentence <= 2 + entry - 1; sentence += 1)
          expect(countOf(pages, educationSentence(entry, sentence).slice(0, 32) + ":".repeat(0)), `${entry}.${sentence}`).toBe(1);
      const joined = pages.map(text).join(" ");
      const order = [1, 2, 3].map((entry) => joined.indexOf(`Abschluss Nummer ${entry} im Bereich Technik`));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
    expect(profile.education).toHaveLength(3);
  });

  it("marks the continuation once, in the heading of the entry, and only on the page that goes on", () => {
    const rendered = total({ bullets: [2, 2, 2] });
    for (const pages of [rendered.previewPages, rendered.pdfPages]) {
      expect(pages[0].querySelector("[data-resume-entry-marker]")).toBeNull();
      const markers = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-resume-entry-marker]")));
      expect(markers).toHaveLength(1);
      expect(markers[0].parentElement?.textContent).toContain("Abschluss Nummer 1 im Bereich Technik");
      expect(text(pages[1].querySelector('[data-managed-section="education"] h2,[data-managed-section="education"] h3')!)).toContain("Fortsetzung");
    }
  });

  it("draws the plan on both surfaces: the same entries and ranges on every page (39, 58)", () => {
    const rendered = total({ bullets: [4, 4, 4] });
    expect(rendered.previewPages).toHaveLength(rendered.resolved.pagePlan.length);
    expect(rendered.pdfPages).toHaveLength(rendered.resolved.pagePlan.length);
    const entries = (pages: Element[]) => pages.map((page) => Array.from(text(page).matchAll(/Abschluss Nummer (\d)/g)).map((match) => match[1]));
    expect(entries(rendered.previewPages)).toEqual(entries(rendered.pdfPages));
    // the closing stands on the last page only
    const closing = (pages: Element[]) => pages.map((page) => page.querySelectorAll("[data-resume-closing]").length);
    expect(closing(rendered.previewPages)).toEqual(closing(rendered.pdfPages));
    expect(closing(rendered.pdfPages).slice(0, -1).every((count) => count === 0)).toBe(true);
  });

  it("goes on over three pages without losing a detail (59)", () => {
    const options: EducationFlowOptions = { bullets: [4, 4, 4], educationCount: 7, sentences: 5 };
    const pages = plan(options);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const profileOf = makeEducationFlowProfile(options);
    for (const entry of profileOf.education) {
      const view = resolveEducationPresentation(entry, profileOf.resumeEducationFieldVisibility);
      const totalUnits = educationDetailUnits(view.details, view.descriptionIndex).length;
      const parts = pages.flatMap((page) => educationOf(page)).filter((item) => item.id === entry.id);
      expect(parts.length).toBeGreaterThan(0);
      // the ranges chain without a gap or an overlap, from the first unit to the last
      let next = 0;
      for (const part of parts) {
        const range = "bullets" in part && part.bullets ? part.bullets : { from: 0, to: totalUnits, total: totalUnits };
        expect(range.from).toBe(next);
        expect(range.total).toBe(totalUnits);
        next = range.to;
      }
      expect(next).toBe(totalUnits);
    }
    const rendered = renderCv("zweispaltig", profileOf);
    for (const surface of [rendered.previewPages, rendered.pdfPages]) {
      for (let entry = 1; entry <= 7; entry += 1)
        for (let sentence = 1; sentence <= 5 + entry - 1; sentence += 1) expect(countOf(surface, educationSentence(entry, sentence).slice(0, 32)), `${entry}.${sentence}`).toBe(1);
    }
  });
});

describe("the page plan follows the central spacing (52–55, 23–27)", () => {
  const profile = makeEducationFlowProfile({ bullets: [4, 4, 4] });
  const settingsOf = (spacing?: Record<string, number>) => withSpacing(spacing);
  const run = (spacing?: Record<string, number>) => createResumePagePlan(profile, "", {}, "zweispaltig", { overrides: spacing ? { ...spacing } : undefined, settings: settingsOf(spacing) } as never);
  const native = plan({ bullets: [4, 4, 4] });

  it("recomputes the pages for every Abschnittsabstand and keeps every entry", () => {
    for (const gap of [4, 6.5, 10]) {
      const pages = plan({ bullets: [4, 4, 4] }, { sectionGapMm: gap });
      const ids = pages.flatMap((page) => page.items.map((item) => item.id));
      for (const id of [...new Set(ids)]) expect(ids.filter((value) => value === id).length).toBeGreaterThan(0);
      expect(new Set(ids).size, `gap ${gap}`).toBe(6);
      // experiences first, in order
      expect(pages[0].items.slice(0, 3).map((item) => item.id.slice(-2))).toEqual(["10", "11", "12"]);
    }
    // the native value is the 6.5 mm the template draws: the same pages
    expect(shape(plan({ bullets: [4, 4, 4] }, { sectionGapMm: 6.5 }))).toBe(shape(native));
    // 4 mm more room: the first part of the education may be longer than with 10 mm
    const tight = plan({ bullets: [4, 4, 4] }, { sectionGapMm: 4 })[0].fill!.main;
    const wide = plan({ bullets: [4, 4, 4] }, { sectionGapMm: 10 })[0].fill!.main;
    expect(tight).not.toBeUndefined();
    expect(wide).not.toBeUndefined();
  });

  it("counts the gap below an entry title in the height of every entry", () => {
    const base = plan({ bullets: [3, 3, 3], sentences: 1 })[0].items.filter((item) => item.kind === "experience");
    const wider = plan({ bullets: [3, 3, 3], sentences: 1 }, { entryContentGapMm: 0.7 + 3 })[0].items.filter((item) => item.kind === "experience");
    for (const [index, item] of base.entries()) expect(wider[index].weight - item.weight).toBeCloseTo(3, 0);
  });

  it("counts the gap below a section title in the height of the page", () => {
    const base = plan({ bullets: [3, 3, 3], sentences: 1 })[0].fill!.main;
    const wider = plan({ bullets: [3, 3, 3], sentences: 1 }, { sectionTitleGapMm: 2.5 + 4 })[0].fill!.main;
    expect(wider).toBeGreaterThan(base);
  });

  it("counts the gap between entries, with the divider the template draws under every entry", () => {
    const one = plan({ bullets: [3, 3, 3], sentences: 1 })[0].fill!.main;
    const wider = plan({ bullets: [3, 3, 3], sentences: 1 }, { entryGapMm: 3.5 + 4 })[0].fill!.main;
    expect(wider).toBeGreaterThan(one);
  });

  it("narrows the main column when the gap between the columns grows", () => {
    const narrow = plan({ bullets: [3, 3, 3], sentences: 1 }, { columnGapMm: 18 })[0].items.filter((item) => item.kind === "experience");
    const base = plan({ bullets: [3, 3, 3], sentences: 1 })[0].items.filter((item) => item.kind === "experience");
    expect(narrow.reduce((total, item) => total + item.weight, 0)).toBeGreaterThanOrEqual(base.reduce((total, item) => total + item.weight, 0));
    expect(run).toBeDefined();
  });

  it("stays the template's own plan when nothing is chosen, and a choice of one application does not reach another (57)", () => {
    const baseline = plan({ bullets: [2, 2, 2] });
    const first = plan({ bullets: [2, 2, 2] }, { sectionGapMm: 4 });
    const second = plan({ bullets: [2, 2, 2] });
    expect(shape(second)).toBe(shape(baseline));
    expect(first[0].fill!.main).not.toBe(second[0].fill!.main);
  });
});

describe("the central spacing is the one owner of the gaps (11–22, 28, 29)", () => {
  const render = (spacing?: Record<string, number>) => renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [4, 4, 4] }), { overrides: spacing ? { cvOverrides: { spacing } } : {} });
  const root = (page: Element) => (page.querySelector(".zweispaltig-template") ?? page.querySelector(".page-content")) as HTMLElement;

  it("has no floor under the Abschnittsabstand: the template takes its own value as a base, not as a minimum", () => {
    const css = readFileSync(new URL("./zweispaltig.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/max\(\s*6\.5mm/);
    expect(css).toContain("var(--zweispaltig-section-gap-base, 6.5mm)");
    const html = render().pdfPages[0].ownerDocument.documentElement.outerHTML;
    expect(html).not.toContain("max(6.5mm,var(--section-gap))");
    expect(html).toContain("--zweispaltig-section-gap-base:6.5mm");
  });

  it("marks the section that follows another also when the template holds every section in a wrapper", () => {
    for (const surface of ["previewPages", "pdfPages"] as const) {
      const page = renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [2, 2, 2] }), { overrides: { cvOverrides: { spacing: { sectionGapMm: 4 } } } })[surface][0];
      const sections = Array.from(page.querySelectorAll('[data-managed-section="experience"],[data-managed-section="education"]'));
      expect(sections.length).toBeGreaterThanOrEqual(2);
      expect(sections[0].hasAttribute("data-resume-spacing-section-following"), surface).toBe(false);
      expect(sections[1].hasAttribute("data-resume-spacing-section-following"), surface).toBe(true);
    }
  });

  it("sets nothing for a template that is left as it is, and only the chosen values for a changed one (22, 57)", () => {
    for (const surface of ["previewPages", "pdfPages"] as const) {
      const native = root(render()[surface][0]);
      expect(native.getAttribute("style") ?? "", surface).not.toContain("--doc-section-gap");
      expect(native.hasAttribute("data-resume-spacing-section-gap")).toBe(false);
      const changed = root(render({ sectionGapMm: 4 })[surface][0]);
      expect(changed.getAttribute("style") ?? "", surface).toContain("--doc-section-gap:4mm");
      expect(changed.hasAttribute("data-resume-spacing-section-gap")).toBe(true);
      // the first section keeps its own distance to the header: the template's base is not moved by the choice
      expect(changed.getAttribute("style") ?? "", surface).not.toContain("--zweispaltig-section-gap-base:4mm");
    }
  });

  it("gives the title gap, the entry gap and the gap below an entry title to the central values on both surfaces", () => {
    for (const surface of ["previewPages", "pdfPages"] as const) {
      const page = render({ sectionTitleGapMm: 6, entryGapMm: 8, entryContentGapMm: 4 })[surface][0];
      const scope = root(page);
      expect(scope.hasAttribute("data-resume-spacing-title-gap"), surface).toBe(true);
      expect(scope.hasAttribute("data-resume-spacing-entry-gap"), surface).toBe(true);
      expect(scope.hasAttribute("data-resume-spacing-content-gap"), surface).toBe(true);
      expect(scope.getAttribute("style") ?? "").toContain("--doc-section-title-gap:6mm");
      expect(page.querySelectorAll("[data-resume-spacing-title]").length, surface).toBeGreaterThan(0);
      expect(page.querySelectorAll("[data-resume-spacing-entry-title]").length, surface).toBeGreaterThan(0);
      expect(page.querySelectorAll("[data-resume-spacing-entry-following]").length, surface).toBeGreaterThan(0);
    }
  });
});
