import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { resolveCvDocument } from "./resolveCvDocument";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { createResumePagePlan, type ResumePagePlan } from "./documentPagination";
import { sidebarContinuationTemplates, supportsSidebarContinuation } from "./resumeSectionPresentation";
import { makeSidebarLaneInput, type SidebarLaneOptions } from "./__sidebarLaneFixture";
const uid = (n: number) => `9d000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const plan = (templateId: string, options: SidebarLaneOptions = {}) =>
  resolveCvDocument({
    profile: profileSchema.parse(makeSidebarLaneInput(templateId, options)), templateId,
    settings: getTemplateDocumentDesignDefaults(templateId),
  }).pagePlan;

const range = (page: ResumePagePlan, id: string) => page.blockRanges?.[id];
/** The items of one block that every page names: `from..to` (exclusive) or the whole list. */
const itemsOnPages = (pages: ResumePagePlan[], id: string, total: number) =>
  pages.map((page) => (page.blocks?.includes(id) ? (range(page, id) ? range(page, id)!.to - range(page, id)!.from : total) : 0));

describe("sidebar lane", () => {
  it("is on for the templates that draw a continuation sidebar", () => {
    expect(sidebarContinuationTemplates).toContain("zeitgenoessisch");
    for (const id of sidebarContinuationTemplates) expect(supportsSidebarContinuation(id)).toBe(true);
    expect(supportsSidebarContinuation("modern")).toBe(false);
    expect(supportsSidebarContinuation(undefined)).toBe(false);
  });

  describe.each(sidebarContinuationTemplates)("%s", (id) => {
    it("A. fills page one's sidebar and continues the rest on page two instead of moving the whole block", () => {
      const pages = plan(id, { knowledge: 24 });
      expect(pages.length).toBeGreaterThanOrEqual(2);
      const first = range(pages[0], "knowledge");
      expect(pages[0].blocks).toContain("knowledge");
      // a part of the list stands on page one: its heading and at least one row, never all of it
      expect(first).toBeDefined();
      expect(first!.from).toBe(0);
      expect(first!.to).toBeGreaterThan(0);
      expect(first!.to).toBeLessThan(24);
      expect(first!.total).toBe(24);
      // the rest goes on in the sidebar of page two: an exact partition, nothing twice, nothing lost
      const second = range(pages[1], "knowledge");
      expect(second).toBeDefined();
      expect(second!.from).toBe(first!.to);
      expect(pages[1].sidebar).toBe(true);
      expect(itemsOnPages(pages, "knowledge", 24).reduce((sum, count) => sum + count, 0)).toBe(24);
      expect(pages[0].fill!.sidebar).toBeLessThanOrEqual(1);
    });

    it("never leaves a heading alone and never a single stray row (heading + a row, a rest of two or more)", () => {
      for (let count = 4; count <= 40; count += 1) {
        const pages = plan(id, { knowledge: count });
        for (const page of pages) {
          const part = range(page, "knowledge");
          if (!part) continue;
          expect(part.to - part.from, `${count} items`).toBeGreaterThanOrEqual(1);
          if (part.from > 0) expect(part.to - part.from, `${count} items, a later part`).toBeGreaterThanOrEqual(1);
        }
        // when the list breaks, the part that goes on has two or more items
        const first = range(pages[0], "knowledge");
        if (first) expect(first.total - first.to, `${count} items`).toBeGreaterThanOrEqual(2);
        expect(itemsOnPages(pages, "knowledge", count).reduce((sum, value) => sum + value, 0), `${count} items`).toBe(count);
      }
    });

    it("B. a list that does not fit even in part starts on page two (no orphan heading on page one)", () => {
      // Strengths fill the column so that not even the heading and one row fit below them.
      const pages = plan(id, { knowledge: 6, strengths: 12 });
      const hosted = pages[0].blocks?.includes("knowledge") ?? false;
      const first = range(pages[0], "knowledge");
      if (hosted && first) expect(first.to).toBeGreaterThanOrEqual(1);
      expect(pages.some((page) => page.blocks?.includes("knowledge"))).toBe(true);
      expect(itemsOnPages(pages, "knowledge", 6).reduce((sum, value) => sum + value, 0)).toBe(6);
    });

    it("B2. as the column fills, the list goes from whole to broken to page two, and a part is never empty", () => {
      const outcomes = new Set<string>();
      for (const strengths of [0, 6, 12, 18, 24, 30]) for (const certifications of [0, 6, 12]) for (const specials of [0, 2, 4]) {
        const pages = plan(id, { knowledge: 9, strengths, certifications, specials, specialEntries: 7 });
        const hosted = pages[0].blocks?.includes("knowledge") ?? false;
        const first = range(pages[0], "knowledge");
        outcomes.add(!hosted ? "page two" : first ? "broken" : "whole");
        const label = `${strengths} strengths, ${certifications} certificates, ${specials} special sections`;
        if (first) expect(first.to - first.from, label).toBeGreaterThanOrEqual(1);
        expect(itemsOnPages(pages, "knowledge", 9).reduce((sum, value) => sum + value, 0), label).toBe(9);
      }
      expect(outcomes.has("whole")).toBe(true);
      expect(outcomes.has("page two")).toBe(true);
    });

    it("C. a list that fits keeps whole on page one: no range and no second page for it", () => {
      const pages = plan(id, { knowledge: 3, stations: 1, bullets: 2, education: 1 });
      expect(pages).toHaveLength(1);
      expect(pages[0].blocks).toContain("knowledge");
      expect(range(pages[0], "knowledge")).toBeUndefined();
    });

    it("D. the sidebar persists on every page that still has sidebar content and collapses where it has none", () => {
      const pages = plan(id, { knowledge: 24 });
      for (const page of pages.slice(1)) expect(page.sidebar, `page ${page.pageNumber}`).toBe(Boolean(page.blocks?.includes("knowledge")));
      const idle = plan(id, { knowledge: 3, stations: 5, bullets: 5, education: 4 });
      for (const page of idle.slice(1)) expect(page.sidebar, `page ${page.pageNumber}`).toBe(false);
    });

    it("E. the main column and the sidebar flow independently: both continue on page two", () => {
      const pages = plan(id, { knowledge: 24, stations: 5, bullets: 6, education: 4 });
      expect(pages[1].items.length).toBeGreaterThan(0);
      expect(pages[1].blocks).toContain("knowledge");
      expect(pages[1].sidebar).toBe(true);
      expect(pages[1].fill!.sidebar).toBeGreaterThan(0);
      expect(pages[1].fill!.main).toBeGreaterThan(0);
    });

    it("F. three pages: the sidebar lane runs on, every item exactly once, ranges chain without a gap", () => {
      const pages = plan(id, { knowledge: 60 });
      expect(pages.length).toBeGreaterThanOrEqual(3);
      let next = 0;
      for (const page of pages) {
        const part = range(page, "knowledge");
        if (!page.blocks?.includes("knowledge")) continue;
        expect(page.sidebar || page.pageNumber === 1, `page ${page.pageNumber}`).toBe(true);
        expect(part?.from ?? 0).toBe(next);
        next = part?.to ?? 60;
      }
      expect(next).toBe(60);
    });

    it("G. a Seitenspalte assignment holds on every page: a knowledge section in the main column never joins the lane", () => {
      const pages = plan(id, { knowledge: 30, zone: "main" });
      for (const page of pages.slice(1)) {
        if (!page.sidebar) continue;
        // only sidebar blocks may keep a continuation sidebar alive; the main-column knowledge list does not
        expect(page.blocks?.includes("knowledge") ?? false).toBe(false);
      }
    });

    it("H. special sections and certificates of the sidebar break at their entries, nothing twice", () => {
      const pages = plan(id, { knowledge: 14, specials: 2, specialEntries: 7, certifications: 8 });
      const specials = [uid(400), uid(401)].map((value) => `special:${value}`);
      for (const block of ["certifications", ...specials]) {
        const total = block === "certifications" ? 8 : 7;
        const counts = itemsOnPages(pages, block, total);
        // placed on one or more pages; where a block breaks, its parts add up to the whole
        if (counts.some((count) => count > 0)) expect(counts.reduce((sum, count) => sum + count, 0), block).toBe(total);
      }
      for (const page of pages.slice(1)) {
        const sidebarBlocks = (page.blocks ?? []).filter((block) => block === "knowledge" || block === "certifications" || block.startsWith("special:"));
        expect(page.sidebar, `page ${page.pageNumber}`).toBe(sidebarBlocks.length > 0);
      }
    });
  });

  describe.each(sidebarContinuationTemplates)("%s: the main column beside a continuation sidebar", (id) => {
    it("I. is measured narrow: the main-column list on page two takes more room beside the lane than on a full-width page", () => {
      // The same page-two content (the career entries and a knowledge list in the main column). Special sections and
      // certificates in the sidebar keep page two's sidebar alive in one résumé and not in the other.
      const same = (left: ResumePagePlan, right: ResumePagePlan) =>
        JSON.stringify(left.items.map((item) => [item.id, "bullets" in item ? item.bullets : undefined])) === JSON.stringify(right.items.map((item) => [item.id, "bullets" in item ? item.bullets : undefined]));
      let compared = 0;
      for (const knowledge of [10, 14, 18]) for (const stations of [3, 4]) for (const bullets of [5, 7]) {
        const content = { knowledge, zone: "main", stations, bullets, education: 4, strengths: 6 } as const;
        const beside = plan(id, { ...content, specialsZone: "sidebar", specials: 2, specialEntries: 16, certifications: 8 });
        const alone = plan(id, content);
        const second = (pages: ResumePagePlan[]) => pages.find((page, index) => index > 0 && page.items.length > 0 && page.blocks?.includes("knowledge"));
        const withLane = second(beside);
        const without = second(alone);
        // (a page two with other entries on it is no comparison)
        if (!withLane || !without || !same(withLane, without) || !withLane.sidebar || without.sidebar) continue;
        compared += 1;
        const shown = (page: ResumePagePlan) => {
          const range = page.blockRanges?.knowledge;
          return range ? range.to - range.from : knowledge;
        };
        if (shown(withLane) < shown(without))
          expect(shown(withLane), `${knowledge} knowledge, ${stations} stations x ${bullets}`).toBeLessThan(shown(without));
        else expect(withLane.fill!.main, `${knowledge} knowledge, ${stations} stations x ${bullets}`).toBeGreaterThan(without.fill!.main);
      }
      expect(compared, "at least one comparable pair").toBeGreaterThan(0);
    });

    it("J. never loses or doubles an item of the main column that spills over the pages beside the lane", () => {
      const pages = plan(id, { knowledge: 40, zone: "main", specialsZone: "sidebar", specials: 2, specialEntries: 9, stations: 6, bullets: 8, education: 4 });
      expect(pages.length).toBeGreaterThanOrEqual(2);
      expect(itemsOnPages(pages, "knowledge", 40).reduce((sum, count) => sum + count, 0)).toBe(40);
      for (const page of pages.slice(1)) if (page.sidebar) expect(page.fill!.main, `page ${page.pageNumber}`).toBeLessThanOrEqual(1.02);
    });
  });

  it("a special section of Zweispaltig and Zeitgenössisch takes the room its entries really take in the sidebar", () => {
    // Measured on the PDF: five one-line entries. Zweispaltig 9.03 + 0.5 + 5 x 3.11 + 4 x 7.7 + 0.5 (with the divider
    // padding), Zeitgenössisch 9.5 + 0.5 + 5 x 3.11 + 4 x 6 + 0.5.
    const sidebarLoad = (id: string, entries: number) => {
      const pages = plan(id, { knowledge: 0, strengths: 0, specials: 1, specialEntries: entries, zone: "sidebar" });
      return pages[0].fill!.sidebar;
    };
    for (const id of ["zweispaltig", "zeitgenoessisch"]) expect(sidebarLoad(id, 6), id).toBeGreaterThan(sidebarLoad(id, 3));
  });

  it("a template without a continuation sidebar keeps the whole list on its own page, as before", () => {
    const pages = plan("modern", { knowledge: 40 });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages.slice(1)) expect(page.sidebar).toBe(false);
    expect(range(pages[0], "knowledge")).toBeUndefined();
  });

  it("ATS output stays a single column: no sidebar lane", () => {
    const profile = profileSchema.parse(makeSidebarLaneInput("zeitgenoessisch", { knowledge: 40 }));
    const pages = createResumePagePlan(profile, "", {}, "zeitgenoessisch", { atsMode: true, layout: { mode: "single", sidebarWidthPercent: 30 } });
    for (const page of pages) expect(page.sidebar).not.toBe(true);
    expect(pages.some((page) => page.blockRanges?.knowledge && page.sidebar)).toBe(false);
  });
});
