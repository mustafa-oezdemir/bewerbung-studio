import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import type { ResumePagePlan } from "../../shared/documentPagination";
import { makeSidebarLaneInput, type SidebarLaneOptions } from "../../shared/__sidebarLaneFixture";
import { renderCv } from "./__parityHarness";

/**
 * Elegant's right sidebar is one lane: page one's sidebar holds whatever fits there (Kurzprofil, Stärken, Kenntnisse,
 * Zertifikate, Sprachen in the order of the section list), only a real overflow goes on in the sidebar of page two,
 * broken between two items, and the preview and the PDF draw the same items on the same pages.
 */
const LANE = ["summary", "strengths", "knowledge", "languages", "certifications"];
const LANGUAGES = ["Deutsch", "Englisch", "Türkisch"];

const cv = (options: SidebarLaneOptions, cvOverrides?: Record<string, unknown>) => renderCv("elegant",
  profileSchema.parse(makeSidebarLaneInput("elegant", { specialsZone: "main", ...options })),
  cvOverrides ? { overrides: { cvOverrides } as never } : {});
const range = (page: ResumePagePlan, id: string) => page.blockRanges?.[id];
const sidebarIds = (page: ResumePagePlan) => (page.blocks ?? []).filter((id) => LANE.includes(id));

/** The certificates and languages each page draws in its sidebar, by number / name. */
const drawn = (pages: Element[]) => pages.map((page) => {
  const text = (id: string) => Array.from(page.querySelectorAll(`[data-managed-section="${id}"]`))
    .filter((node) => node.closest(".elegant-sidebar,.elegant-pdf-sidebar,.elegant-pdf-continuation,aside"))
    .map((node) => node.textContent ?? "").join(" ");
  return {
    certificates: [...text("certifications").matchAll(/Zertifikat (\d+) der/g)].map((match) => Number(match[1])),
    languages: LANGUAGES.filter((name) => text("languages").includes(name)),
  };
});

/** Every item of a broken block once, in order: the ranges of the pages join up without a gap or a double. */
const expectContiguous = (pages: ResumePagePlan[], id: string, total: number) => {
  const parts = pages.filter((page) => page.blocks?.includes(id))
    .map((page) => range(page, id) ?? { from: 0, to: total, total });
  expect(parts[0].from, id).toBe(0);
  for (let index = 1; index < parts.length; index += 1) expect(parts[index].from, id).toBe(parts[index - 1].to);
  expect(parts[parts.length - 1].to, id).toBe(total);
  for (const part of parts) expect(part.to - part.from, `${id}: never a heading alone`).toBeGreaterThanOrEqual(1);
};

describe("Elegant sidebar lane", () => {
  it("keeps Zertifikate and Sprachen on page one when they fit, while the main column runs on to page two", () => {
    const result = cv({ knowledge: 3, certifications: 4, strengths: 3, stations: 4, bullets: 6, specials: 1 });
    const pages = result.resolved.pagePlan;
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].blocks).toEqual(expect.arrayContaining(["certifications", "languages", "knowledge", "strengths"]));
    expect(range(pages[0], "certifications")).toBeUndefined();
    expect(range(pages[0], "languages")).toBeUndefined();
    for (const page of pages.slice(1)) expect(sidebarIds(page), `page ${page.pageNumber}`).toEqual([]);
    for (const surface of [result.previewPages, result.pdfPages]) {
      const items = drawn(surface);
      expect(items[0]).toEqual({ certificates: [1, 2, 3, 4], languages: LANGUAGES });
      for (const page of items.slice(1)) expect(page).toEqual({ certificates: [], languages: [] });
    }
  });

  it.each([30, 38, 45])("fills page one's sidebar before it continues (sidebar %s percent)", (percent) => {
    const result = renderCv("elegant", profileSchema.parse(makeSidebarLaneInput("elegant", {
      knowledge: 5, certifications: 14, strengths: 8, stations: 4, specials: 1, specialsZone: "main",
    })), { overrides: { resumePresentation: { layoutMode: "two-column", sidebarSide: "right", sidebarWidthPercent: percent } } as never });
    const pages = result.resolved.pagePlan;
    // the overflow breaks a list between two items where the heading and an item still fit: page two goes on from there
    const broken = LANE.find((id) => range(pages[0], id) && range(pages[0], id)!.to < range(pages[0], id)!.total);
    if (broken) expect(range(pages[1], broken)?.from).toBe(range(pages[0], broken)!.to);
    expect(broken !== undefined || percent === 30, `${percent} %`).toBe(true);
    expect(pages[0].fill!.sidebar).toBeGreaterThan(0.85);
    expect(pages[0].fill!.sidebar).toBeLessThanOrEqual(1);
    expectContiguous(pages, "certifications", 14);
    expectContiguous(pages, "strengths", 8);
  });

  it("breaks Zertifikate and Sprachen between items: nothing lost, nothing twice, same pages in preview and PDF", () => {
    for (const options of [
      { knowledge: 5, certifications: 14, strengths: 8, stations: 4, specials: 1 },
      { knowledge: 5, certifications: 4, strengths: 3, stations: 4, specials: 1 },
      { knowledge: 24, certifications: 10, strengths: 6 },
    ]) {
      const result = cv(options);
      const pages = result.resolved.pagePlan;
      expectContiguous(pages, "certifications", options.certifications);
      expectContiguous(pages, "languages", 3);
      expectContiguous(pages, "knowledge", options.knowledge);
      const preview = drawn(result.previewPages);
      const pdf = drawn(result.pdfPages);
      expect(pdf, JSON.stringify(options)).toEqual(preview);
      expect(preview.flatMap((page) => page.certificates)).toEqual(Array.from({ length: options.certifications }, (_, index) => index + 1));
      expect(preview.flatMap((page) => page.languages)).toEqual(LANGUAGES);
      // the planned part of each page is what that page draws
      pages.forEach((page, index) => {
        const part = range(page, "certifications");
        const count = page.blocks?.includes("certifications") ? (part ? part.to - part.from : options.certifications) : 0;
        expect(preview[index].certificates, `page ${index + 1}`).toHaveLength(count);
      });
    }
  });

  it("keeps the order of the section list across the pages", () => {
    const pages = cv({ knowledge: 24, certifications: 10, strengths: 6 }).resolved.pagePlan;
    const sequence = pages.flatMap((page) => sidebarIds(page).filter((id) => id !== "summary" && id !== "strengths"))
      .filter((id, index, all) => all.indexOf(id) === index);
    expect(sequence).toEqual(["knowledge", "certifications", "languages"]);
  });

  it("plans with the Lebenslauf-Design: a larger body text moves sidebar items to page two", () => {
    const options = { knowledge: 3, certifications: 4, strengths: 3, stations: 4, bullets: 6, specials: 1 };
    const base = cv(options).resolved.pagePlan;
    const larger = cv(options, { typography: { bodySizePt: 13 }, spacing: { sectionGapMm: 10 } }).resolved.pagePlan;
    expect(larger).not.toEqual(base);
    const onFirst = (pages: ResumePagePlan[]) => {
      const part = range(pages[0], "certifications");
      return pages[0].blocks?.includes("certifications") ? (part ? part.to - part.from : 4) : 0;
    };
    expect(onFirst(larger)).toBeLessThanOrEqual(onFirst(base));
    expectContiguous(larger, "certifications", 4);
    expectContiguous(larger, "languages", 3);
  });
});
