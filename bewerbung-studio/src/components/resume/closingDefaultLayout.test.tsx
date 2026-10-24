import { describe, expect, it } from "vitest";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

const signed = () => maximalProfile({
  applicationPlace: "Marburg", signaturePath: "data:image/png;base64,AA==",
  resumeClosing: { showPlace: true, showDate: true, showSignature: true },
});

/** The closing of the last page and whether it stands in the page footer or inside the content. */
const closingOf = (pages: Element[]) => {
  const blocks = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-resume-closing]")));
  return blocks.map((block) => ({
    placement: block.getAttribute("data-resume-closing-placement"),
    alignment: block.getAttribute("data-resume-closing-align"),
    onLastPage: pages[pages.length - 1].contains(block),
  }));
};

describe("Lebenslauf closing (Ort, Datum und Unterschrift) without a choice of the user", () => {
  const ownClosing = resumeTemplateIds.filter((id) => !id.startsWith("pehlione_"));

  it.each(ownClosing)("%s: stands in the main column, right-aligned, on preview and PDF", (templateId) => {
    const cv = renderCv(templateId, signed());
    for (const pages of [cv.previewPages, cv.pdfPages]) {
      expect(closingOf(pages)).toEqual([{ placement: "main", alignment: "right", onLastPage: true }]);
    }
  });

  it.each(ownClosing)("%s: follows the text of the last page (no section after it in the main column)", (templateId) => {
    const cv = renderCv(templateId, signed());
    for (const pages of [cv.previewPages, cv.pdfPages]) {
      const last = pages[pages.length - 1];
      const closing = last.querySelector("[data-resume-closing]")!;
      // the sections of the closing's own column that stand behind it (in document order)
      const column = Array.from(closing.parentElement!.querySelectorAll("*"));
      const after = column.slice(column.indexOf(closing) + 1).filter((node) => node.hasAttribute("data-managed-section") && !closing.contains(node));
      expect(after.map((section) => section.getAttribute("data-managed-section")), templateId).toEqual([]);
    }
  });

  it.each(ownClosing)("%s: keeps a placement and alignment the user chose", (templateId) => {
    const cv = renderCv(templateId, signed(), { overrides: { resumePresentation: { closing: { placement: "footer", alignment: "left" } } } });
    for (const pages of [cv.previewPages, cv.pdfPages]) {
      expect(closingOf(pages)).toEqual([{ placement: "footer", alignment: "left", onLastPage: true }]);
    }
  });

  it("leaves Pehlione's own closing as it was", () => {
    for (const templateId of resumeTemplateIds.filter((id) => id.startsWith("pehlione_"))) {
      const cv = renderCv(templateId, signed());
      for (const pages of [cv.previewPages, cv.pdfPages]) {
        expect(pages.some((page) => page.querySelector("[data-resume-closing]")), templateId).toBe(false);
      }
    }
  });
});
