import { describe, expect, it } from "vitest";
import { getManagerSections, reorderManagerSection } from "../../features/resume-sections/resume-manager";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { maximalProfile } from "./__parityFixture";
import { renderCv } from "./__parityHarness";

const singleColumnTemplates = ["tabellarisch", "klassisch", "einspaltig", "ivy-league"];
const uid = (index: number) => `5c000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const special = `special:${uid(40)}`;
/** A synthetic Lebenslauf with every kind of section that stands on one page in every one-column template. */
const onePage = () => profileSchema.parse({
  id: uid(1), isDefault: true, updatedAt: "2026-10-07T10:00:00.000Z", firstName: "Lena", lastName: "Beispiel", title: "Planerin",
  email: "lena@example.com", city: "Berlin", summary: "Planerin mit Blick für klare Abläufe.",
  strengths: [{ id: uid(2), title: "Planung", description: "Strukturierte Abläufe" }],
  experiences: [{ id: uid(10), from: "2020", to: "2024", role: "Planerin", company: "Beispiel GmbH", achievements: ["Abläufe verbessert."] }],
  education: [{ id: uid(20), from: "2016", to: "2019", degree: "Ausbildung", institution: "Beispielschule" }],
  skills: ["Tabellen"], languages: ["Deutsch – C1"], certifications: ["Fiktive Weiterbildung"],
  specialSections: [{ id: uid(40), kind: "custom", title: "Ehrenamt", contentType: "list", isVisible: true,
    entries: [{ id: uid(41), title: "Vereinsarbeit", bullets: [] }] }],
});
const movable = (profile: ApplicantProfile, templateId: string) => getManagerSections(profile, templateId).filter((entry) => !entry.fixed);
const drawn = (pages: Element[]) => pages.flatMap((page) => Array.from(page.querySelectorAll("[data-managed-section]"),
  (node) => node.getAttribute("data-managed-section")!));
const firstSeen = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) === index);
/** The one order of the panel, as far as the Lebenslauf draws it. */
const panelOrder = (profile: ApplicantProfile, templateId: string, shown: string[]) =>
  movable(profile, templateId).map((entry) => entry.id).filter((id) => shown.includes(id));
/** Moves `id` right before or after `anchor` in the one order of the panel. */
const place = (profile: ApplicantProfile, templateId: string, id: string, anchor: string, after = false) => {
  const rest = movable(profile, templateId).filter((entry) => entry.id !== id);
  return reorderManagerSection(profile, templateId, id, rest.findIndex((entry) => entry.id === anchor) + (after ? 1 : 0));
};
/** Moves sections across the old column boundary: Kurzprofil (side) behind the career, Sprachen (side) ahead of it, a custom section to the top. */
const rearranged = (templateId: string, source = onePage()) => {
  let profile = place(source, templateId, "summary", "experience", true);
  profile = reorderManagerSection(profile, templateId, special, 0);
  return place(profile, templateId, "languages", "experience");
};

describe.each(singleColumnTemplates)("one section order in %s (one-column layout)", (templateId) => {
  it("draws the order of the panel in the preview and the PDF", () => {
    // Ivy League draws an untouched Lebenslauf in its own visual order, which is not its default list (see the report of
    // this change); every arranged order is the one of the panel.
    for (const profile of templateId === "ivy-league" ? [rearranged(templateId)] : [onePage(), rearranged(templateId)]) {
      const result = renderCv(templateId, profile);
      expect(result.resolved.layout.mode).toBe("single");
      expect(result.previewPages).toHaveLength(1);
      expect(result.pdfPages).toHaveLength(1);
      const preview = firstSeen(drawn(result.previewPages));
      expect(firstSeen(drawn(result.pdfPages))).toEqual(preview);
      expect(preview).toEqual(panelOrder(profile, templateId, preview));
      // Every visible section once.
      expect(drawn(result.previewPages)).toHaveLength(new Set(drawn(result.previewPages)).size);
      expect(preview).toEqual(expect.arrayContaining(["summary", "strengths", "experience", "education", "languages", "certifications", special]));
    }
  });

  it("keeps the saved side column of a section without drawing it as a column", () => {
    const profile = rearranged(templateId);
    expect(movable(profile, templateId).find((entry) => entry.id === "summary")?.zone).toBe("sidebar");
    const result = renderCv(templateId, profile);
    expect(result.resolved.managerSections.every((entry) => entry.zone === "main")).toBe(true);
    for (const page of [...result.previewPages, ...result.pdfPages]) {
      expect(page.querySelector("[data-resume-layout-zone]")).toBeNull();
      expect(page.querySelector('[data-resume-layout="two-column"]')).toBeNull();
    }
    const order = firstSeen(drawn(result.previewPages));
    expect(order[0]).toBe(special);
    expect(order.indexOf("languages")).toBe(order.indexOf("experience") - 1);
    expect(order.indexOf("summary")).toBe(order.indexOf("experience") + 1);
  });

  it("loses and doubles no section of a multi-page Lebenslauf, visual and ATS", () => {
    const profile = rearranged(templateId, maximalProfile());
    for (const ats of [false, true]) {
      const result = renderCv(templateId, profile, { ats });
      expect(result.pdfPages.length).toBe(result.previewPages.length);
      for (const surface of [result.previewPages, result.pdfPages]) {
        const ids = drawn(surface);
        expect(new Set(ids)).toEqual(new Set(drawn(result.previewPages)));
        // A section stands on one page, or on consecutive pages when the plan breaks it.
        for (const id of new Set(ids)) {
          const pages = surface.map((page, index) => (page.querySelector(`[data-managed-section="${id}"]`) ? index : -1)).filter((index) => index >= 0);
          expect(pages, `${ats ? "ats" : "visual"} ${id}`).toEqual(Array.from({ length: pages.length }, (_, step) => pages[0]! + step));
        }
      }
      expect(result.pdfPages.map((page) => firstSeen(drawn([page])))).toEqual(result.previewPages.map((page) => firstSeen(drawn([page]))));
    }
  });

  it("splits the saved columns again in a two-column layout", () => {
    const profile = rearranged(templateId);
    const result = renderCv(templateId, profile, { overrides: { resumePresentation: { layoutMode: "two-column" } } });
    expect(result.resolved.layout.mode).toBe("two-column");
    const zones = new Map(movable(profile, templateId).map((entry) => [entry.id, entry.zone]));
    for (const pages of [result.previewPages, result.pdfPages]) {
      const page = pages[0]!;
      expect(page.querySelector('[data-resume-layout="two-column"]')).not.toBeNull();
      const side = drawn(Array.from(page.querySelectorAll('[data-resume-layout-zone="sidebar"]')));
      const main = drawn(Array.from(page.querySelectorAll('[data-resume-layout-zone="main"]')));
      expect(side.length).toBeGreaterThan(0);
      for (const id of side) expect(zones.get(id), id).toBe("sidebar");
      for (const id of main) expect(zones.get(id), id).toBe("main");
    }
    expect(firstSeen(drawn(result.pdfPages))).toEqual(firstSeen(drawn(result.previewPages)));
  });
});

describe("one section order of a two-column template in ATS", () => {
  it("follows the whole list instead of drawing the side column behind the main column", () => {
    const templateId = "zweispaltig";
    let profile = onePage();
    const at = (id: string) => movable(profile, templateId).findIndex((entry) => entry.id === id);
    // Stärken (side column) between Werdegang and Bildungsweg (main column).
    profile = reorderManagerSection(profile, templateId, "experience", 0);
    profile = reorderManagerSection(profile, templateId, "strengths", at("experience") + 1);
    profile = reorderManagerSection(profile, templateId, "education", at("strengths") + 1);
    const result = renderCv(templateId, profile, { ats: true });
    const order = firstSeen(drawn(result.previewPages));
    expect(firstSeen(drawn(result.pdfPages))).toEqual(order);
    expect(order.slice(0, 3)).toEqual(["experience", "strengths", "education"]);
    expect(movable(profile, templateId).find((entry) => entry.id === "strengths")?.zone).toBe("sidebar");
    // The visual two-column layout keeps its columns.
    const visual = renderCv(templateId, profile);
    expect(visual.resolved.layout.mode).toBe("two-column");
    expect(visual.resolved.managerSections.find((entry) => entry.id === "strengths")?.zone).toBe("sidebar");
  });
});
