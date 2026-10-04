import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCv } from "../../__parityHarness";
import { makeEducationFlowProfile, bulletText } from "../../../../shared/__educationFlowFixture";
import { zweispaltigDefaults, zweispaltigPageVariables } from "../../../../shared/cvTemplateDefaults/zweispaltig.defaults";
import { getPaginationGeometry } from "../../../../shared/resumePaginationGeometry";

const career = (page: Element) => Array.from(page.querySelectorAll('[data-managed-section="experience"] article'));
const processEntry = (page: Element) => career(page).find((entry) => entry.querySelector("h3,h4")?.textContent?.includes("Prozessplaner"));
const bullets = (entry: Element | undefined) => Array.from(entry?.querySelectorAll("li") ?? []).map((item) => item.textContent?.trim());

describe("Zweispaltig DIN page and career flow", () => {
  it("starts a long entry in the remaining space and renders the same bullet ranges on both surfaces", () => {
    const profile = makeEducationFlowProfile({ bullets: [5, 8, 2], educationCount: 0 });
    const rendered = renderCv("zweispaltig", profile);
    const parts = rendered.resolved.pagePlan.flatMap((page) => page.items.map((item) => ({ page: page.pageNumber, item })))
      .filter(({ item }) => item.id === profile.experiences[1].id);
    expect(parts).toHaveLength(2);
    expect(parts[0].page).toBe(1);
    expect(parts[1].page).toBe(2);
    expect(parts[0].item.bullets).toMatchObject({ from: 0, total: 8 });
    expect(parts[0].item.bullets!.to).toBeGreaterThan(0);
    expect(parts[0].item.bullets!.to).toBeLessThan(8);
    expect(parts[1].item.bullets).toMatchObject({ from: parts[0].item.bullets!.to, to: 8, total: 8 });
    expect(rendered.resolved.pagePlan[1].items.map((item) => item.id).at(-1)).toBe(profile.experiences[2].id);

    const distribution = (pages: Element[]) => pages.map((page) => bullets(processEntry(page)));
    expect(distribution(rendered.previewPages)).toEqual(distribution(rendered.pdfPages));
    for (const pages of [rendered.previewPages, rendered.pdfPages]) {
      expect(pages).toHaveLength(rendered.resolved.pagePlan.length);
      expect(distribution(pages).flat()).toEqual(Array.from({ length: 8 }, (_, index) => bulletText("B", index)));
      expect(pages[0].textContent).not.toContain("Fortsetzung");
      expect(processEntry(pages[1])?.hasAttribute("data-resume-entry-continued")).toBe(true);
      const section = pages[1].querySelector('[data-managed-section="experience"]');
      expect(section?.querySelector("h2,h3")?.textContent).toContain("Fortsetzung");
      expect(career(pages[1]).at(-1)?.textContent).toContain("Transportpilot");
    }
  });

  it("continues one experience through more than three pages without gaps or overlaps", () => {
    const profile = makeEducationFlowProfile({ bullets: [5, 50, 2], educationCount: 0 });
    const rendered = renderCv("zweispaltig", profile);
    const plan = rendered.resolved.pagePlan;
    expect(plan.length).toBeGreaterThanOrEqual(4);
    const parts = plan.flatMap((page) => page.items).filter((item) => item.id === profile.experiences[1].id);
    let next = 0;
    for (const part of parts) {
      expect(part.bullets?.from).toBe(next);
      expect(part.bullets?.total).toBe(50);
      next = part.bullets!.to;
    }
    expect(next).toBe(50);
    for (const pages of [rendered.previewPages, rendered.pdfPages])
      expect(pages.flatMap((page) => bullets(processEntry(page)))).toEqual(Array.from({ length: 50 }, (_, index) => bulletText("B", index)));
  });

  it("uses the same A4 content edges in the native page, planner, preview and PDF", () => {
    const { page, layout } = zweispaltigDefaults;
    const geometry = getPaginationGeometry("zweispaltig");
    expect([page.widthMm, page.heightMm, layout.marginLeftMm, layout.marginRightMm]).toEqual([210, 297, 25, 20]);
    expect(layout.marginBottomMm).toBeGreaterThanOrEqual(15);
    expect(geometry.contentLeft).toBe(layout.marginLeftMm);
    expect(geometry.contentRight).toBe(page.widthMm - layout.marginRightMm);
    expect(geometry.limit).toBe(page.heightMm - layout.marginBottomMm);
    expect(geometry.text.contW).toBe(page.widthMm - layout.marginLeftMm - layout.marginRightMm);
    const rendered = renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [1, 1, 1], educationCount: 0 }));
    for (const surface of [rendered.previewPages, rendered.pdfPages]) {
      const content = surface[0].querySelector(".zweispaltig-page__visual,.zweispaltig-pdf") as HTMLElement;
      for (const [name, value] of Object.entries(zweispaltigPageVariables)) expect(content.getAttribute("style") ?? content.parentElement?.getAttribute("style") ?? "").toContain(`${name}:${value}`);
    }
  });

  it("takes strength text line height and entry gap from the central design on both surfaces", () => {
    const css = readFileSync(new URL("./zweispaltig.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.zweispaltig-strength h3\s*\{[^}]*line-height:\s*var\(--zweispaltig-line-height\)/s);
    expect(css).not.toMatch(/\.zweispaltig-strength\s*\{[^}]*padding:\s*0 0 3mm/s);
    for (const lineHeight of [1.1, 1.4]) {
      const rendered = renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [1, 1, 1], educationCount: 0 }), {
        overrides: { cvOverrides: { typography: { lineHeight } } },
      });
      for (const pages of [rendered.previewPages, rendered.pdfPages]) {
        const scope = pages[0].querySelector(".zweispaltig-template,.zweispaltig-pdf") as HTMLElement;
        expect(scope.getAttribute("style")).toContain(`--doc-line-height:${lineHeight}`);
        expect(pages[0].querySelector('[data-managed-section="strengths"]')).not.toBeNull();
      }
    }
  });

  it("keeps previously saved document typography choices on both surfaces", () => {
    const rendered = renderCv("zweispaltig", makeEducationFlowProfile({ bullets: [1, 1, 1], educationCount: 0 }), {
      overrides: { fontSize: "small", lineHeightLevel: 2 },
    });
    for (const pages of [rendered.previewPages, rendered.pdfPages]) {
      const scope = pages[0].querySelector(".zweispaltig-template,.zweispaltig-pdf") as HTMLElement;
      expect(scope.getAttribute("style")).toContain("--doc-body-size:8.4pt");
      expect(scope.getAttribute("style")).toContain("--doc-line-height:1.05");
    }
  });
});
