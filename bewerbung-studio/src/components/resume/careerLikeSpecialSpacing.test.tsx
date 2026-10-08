import { describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "../../shared/cvDesign";
import { careerLikeEntryListSelector } from "../../shared/resumeCustomSections";
import { managedResumeCss } from "../../shared/resumeManagedOutput";
import { resumeSpacingCss } from "../../shared/resumeSpacing";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { profileSchema } from "../../shared/schema";
import { harnessApplication, renderCv, resumeTemplateIds } from "./__parityHarness";

const profile = profileSchema.parse({
  id: "a4000000-0000-4000-8000-000000000001", isDefault: true, updatedAt: "2026-10-08T10:00:00.000Z",
  firstName: "Lena", lastName: "Beispiel", title: "Entwicklerin",
  experiences: [
    { id: "a4000000-0000-4000-8000-000000000010", from: "01/2021", to: "02/2023", role: "Backend-Entwicklerin", company: "Beispiel AG", achievements: ["REST-Schnittstellen in Go"] },
    { id: "a4000000-0000-4000-8000-000000000011", from: "03/2023", to: "04/2025", role: "Entwicklerin", company: "Muster GmbH", achievements: ["Monitoring mit Prometheus"] },
  ],
  specialSections: [
    { id: "a4000000-0000-4000-8000-000000000002", kind: "projects", title: "Projekte", entries: [
      { id: "a4000000-0000-4000-8000-000000000003", title: "Go Ledger", technologies: ["Go", "PostgreSQL"], description: "Atomare Buchungen." },
      { id: "a4000000-0000-4000-8000-000000000004", title: "Shipping Service", technologies: ["Go"], description: "Sendungen und Retouren." },
      { id: "a4000000-0000-4000-8000-000000000005", title: "Dashboard", technologies: ["React"], description: "Lagerbestände." },
    ] },
    { id: "a4000000-0000-4000-8000-000000000006", kind: "interests", title: "Hobbys & Interessen", contentType: "entries", entries: [
      { id: "a4000000-0000-4000-8000-000000000007", title: "Code", description: "Verschiedene Weiterbildung" },
      { id: "a4000000-0000-4000-8000-000000000008", title: "Gartenarbeit", description: "Aktives Mitglied des Gartenvereins" },
    ] },
  ],
});

const settings = (templateId: string, spacing?: Record<string, number>) => ({
  ...getTemplateDocumentDesignDefaults(templateId), ...(spacing ? { cvOverrides: { spacing } } : {}),
});
const sectionsOf = (pages: Element[]) => pages.flatMap((page) =>
  Array.from(page.querySelectorAll('[data-custom-kind="projects"],[data-custom-kind="interests"]'))) as HTMLElement[];

describe("Projekte and Hobbys & Interessen keep the career entry rule", () => {
  it("drops only the generic list gap and the margins inside an entry", () => {
    expect(managedResumeCss).toContain(':where([data-custom-kind="projects"],[data-custom-kind="interests"]) [data-custom-role="entries"]{gap:0}');
    expect(managedResumeCss).not.toMatch(/data-custom-kind="interests"\]\) \[data-custom-role="entry"\]\{[^}]*padding:0/);
    expect(managedResumeCss).not.toMatch(/data-custom-kind="interests"\]\) \[data-custom-role="entries"\]\{row-gap:0/);
    // Pehlione's PDF spaces its entries by a padding above the next one: the chosen gap replaces it, as in its preview.
    expect(resumeSpacingCss).toContain(".pehlione-pdf[data-resume-spacing-entry-gap] [data-resume-spacing-entry-following]{padding-block-start:0!important}");
  });
});

describe.each(resumeTemplateIds)("Projekte and Hobbys & Interessen in %s", (templateId) => {
  it("keep the Abstand nach Eintragstitel below their titles on both surfaces", () => {
    const native = `${resolveTemplateCvDesign(templateId).spacing.entryContentGapMm}mm`;
    for (const [spacing, expected] of [[undefined, native], [{ entryContentGapMm: 4 }, "4mm"]] as const) {
      const result = renderCv(templateId, profile, { overrides: settings(templateId, spacing) });
      for (const pages of [result.previewPages, result.pdfPages]) {
        const sections = sectionsOf(pages);
        expect(sections, "projects + interests").toHaveLength(2);
        for (const section of sections) expect(section.style.getPropertyValue("--resume-entry-content-gap")).toBe(expected);
      }
    }
  });

  it("follow the chosen Eintragsabstand like the career entries", () => {
    const result = renderCv(templateId, profile, { overrides: settings(templateId, { entryGapMm: 8 }) });
    for (const [surface, pages] of [["preview", result.previewPages], ["pdf", result.pdfPages]] as const) {
      const lists = pages.flatMap((page) => Array.from(page.querySelectorAll(careerLikeEntryListSelector)));
      expect(lists, surface).toHaveLength(2);
      if (templateId === "elegant") continue; // Elegant gets every spacing value through its own design variables.
      if (templateId === "tabellarisch") {
        // The timeline padding below an entry is the gap: its variable takes the chosen value, no margin is added.
        const root = pages[0].querySelector(surface === "pdf" ? ".tabellarisch-pdf" : ".tabellarisch-template") as HTMLElement;
        expect(root.style.getPropertyValue(surface === "pdf" ? "--tab-entry-gap" : "--tabellarisch-entry-gap")).toBe("8mm");
        expect(pages[0].querySelector("[data-resume-spacing-entry-following]")).toBeNull();
        continue;
      }
      for (const list of lists) {
        const entries = Array.from(list.children).filter((child) => child.matches('[data-custom-role="entry"]'));
        expect(list.hasAttribute("data-resume-spacing-list"), surface).toBe(true);
        expect(entries.map((entry) => entry.hasAttribute("data-resume-spacing-entry-following")), surface)
          .toEqual(entries.map((_, index) => index > 0));
      }
    }
  });

  it("are measured with both gaps in the page plan", () => {
    // Without career entries only the two sections answer to the entry gaps.
    const sectionsOnly = profileSchema.parse({ ...profile, experiences: [] });
    const fill = (spacing?: Record<string, number>) => {
      const application = harnessApplication(templateId, settings(templateId, spacing));
      return resolveCvDocument({ profile: sectionsOnly, templateId, settings: application.designSettings, application }).pagePlan
        .reduce((sum, page) => sum + (page.fill?.main ?? 0) + (page.fill?.sidebar ?? 0), 0);
    };
    const native = resolveTemplateCvDesign(templateId).spacing;
    const base = fill({ entryGapMm: native.entryGapMm, entryContentGapMm: native.entryContentGapMm });
    expect(fill({ entryGapMm: native.entryGapMm + 6, entryContentGapMm: native.entryContentGapMm })).toBeGreaterThan(base);
    expect(fill({ entryGapMm: native.entryGapMm, entryContentGapMm: native.entryContentGapMm + 3 })).toBeGreaterThan(base);
  });

  it("break a long list between two entries, every entry drawn once on both surfaces", () => {
    const long = profileSchema.parse({ ...profile, experiences: [], specialSections: [{ ...profile.specialSections[0],
      entries: Array.from({ length: 16 }, (_, index) => ({ ...profile.specialSections[0].entries[0],
        id: `a4000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`, title: `Projekt ${index + 1}`,
        description: "Full-Stack-Anwendung mit Go-Backend, PostgreSQL und Next.js-Frontend sowie atomarem Double-Entry-Ledger." })) }] });
    const result = renderCv(templateId, long);
    const ranges = result.resolved.pagePlan.map((page) => page.blockRanges?.[`special:${long.specialSections[0].id}`]);
    for (const pages of [result.previewPages, result.pdfPages]) {
      const drawn = pages.map((page) => Array.from(page.querySelectorAll('[data-custom-kind="projects"] [data-custom-role="entry"]'))
        .map((entry) => entry.getAttribute("data-entry-id")));
      expect(drawn.flat()).toEqual(long.specialSections[0].entries.map((entry) => entry.id));
      // Each page draws the range its plan names.
      ranges.forEach((range, index) => { if (range) expect(drawn[index]).toHaveLength(range.to - range.from); });
    }
  });
});
