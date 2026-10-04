import { describe, expect, it } from "vitest";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

const profile = maximalProfile({
  languages: ["Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1"],
  resumeLanguageDisplay: { dots: true, level: true, description: true },
});

const grid = (pages: Element[]) => pages.map((page) => page.querySelector('[data-managed-section="languages"] .resume-language-grid')).find(Boolean) as Element;

describe("Sprachen columns in preview and PDF", () => {
  it.each(resumeTemplateIds)("uses the same language cards in %s for auto, one and two columns", (templateId) => {
    for (const mode of ["auto", 1, 2] as const) {
      const result = renderCv(templateId, profile, { overrides: { languagesColumns: mode } });
      const preview = grid(result.previewPages);
      const pdf = grid(result.pdfPages);
      expect(preview, `${templateId} preview`).toBeTruthy();
      expect(pdf, `${templateId} PDF`).toBeTruthy();
      expect(pdf.getAttribute("data-columns")).toBe(preview.getAttribute("data-columns"));
      if (mode !== "auto") expect(preview.getAttribute("data-columns")).toBe(String(mode));
      for (const surface of [preview, pdf]) {
        const cards = Array.from(surface.querySelectorAll(":scope > .resume-language-item"));
        expect(cards).toHaveLength(4);
        expect(cards.map((item) => item.querySelector(".resume-language-primary")?.textContent)).toEqual([
          "Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1",
        ]);
        expect(cards.every((item) => item.querySelector("[data-resume-language-dots]") && item.querySelector(".resume-language-description"))).toBe(true);
        if (!templateId.startsWith("pehlione_"))
          expect(cards[0].querySelector("[data-resume-language-dots]")?.className, `${templateId}: native dot style`).not.toBe("resume-language-dots");
      }
    }
  });

  it.each(["klassisch", "tabellarisch", "modern", "zeitgenoessisch", "zweispaltig", "elegant"])(
    "honors three and four columns in %s", (templateId) => {
      for (const count of [3, 4] as const) {
        const result = renderCv(templateId, profile, { overrides: { languagesColumns: count } });
        expect(grid(result.previewPages).getAttribute("data-columns")).toBe(String(count));
        expect(grid(result.pdfPages).getAttribute("data-columns")).toBe(String(count));
      }
    },
  );

  it("keeps ATS as one plain text column for every visual choice", () => {
    for (const count of [1, 2, 3, 4] as const) {
      const result = renderCv("klassisch", profile, { ats: true, overrides: { languagesColumns: count } });
      for (const pages of [result.previewPages, result.pdfPages]) {
        const section = pages.map((page) => page.querySelector('[data-managed-section="languages"]')).find(Boolean) as Element;
        expect(section.querySelector(".resume-language-grid")).toBeNull();
        expect(section.querySelector(".resume-language-ats")?.getAttribute("data-columns")).toBe("1");
        expect(section.textContent).toContain("Deutsch – C1 (verhandlungssicher)");
      }
    }
  });

  it("keeps a language without a level free of dots and empty punctuation", () => {
    const result = renderCv("klassisch", maximalProfile({ languages: ["Latein"] }), { overrides: { languagesColumns: 4 } });
    for (const pages of [result.previewPages, result.pdfPages]) {
      const card = grid(pages).querySelector(".resume-language-item")!;
      expect(card.querySelector(".resume-language-primary")?.textContent).toBe("Latein");
      expect(card.querySelector("[data-resume-language-dots]")).toBeNull();
    }
  });

  it("keeps a long sidebar language atomic in a four-track grid", () => {
    const longProfile = maximalProfile({ languages: [
      "Deutsch – C1", "Türkisch – C2", "Englisch – B2", "Französisch – B1", "Bosnisch-Kroatisch-Serbisch – C1",
    ] });
    const result = renderCv("pehlione_white", longProfile, { overrides: { languagesColumns: 4 } });
    for (const pages of [result.previewPages, result.pdfPages]) {
      const languageGrid = grid(pages);
      expect(languageGrid.getAttribute("data-columns")).toBe("4");
      const cards = languageGrid.querySelectorAll(":scope > .resume-language-item");
      expect(cards).toHaveLength(5);
      expect(cards[4].getAttribute("style")).toContain("grid-column:span 2");
    }
  });
});
