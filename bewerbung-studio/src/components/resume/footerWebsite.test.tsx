import { describe, expect, it } from "vitest";
import { maximalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

const website = "https://mustafa-oezdemir.de";

/** The footer website of a page: inside a template footer, never one of the header contacts. */
const footerWebsites = (page: Element) =>
  Array.from(page.querySelectorAll("footer a")).filter((link) => !link.closest(".pehlione-closing,.pehlione-pdf-closing"))
    .map((link) => ({ text: link.textContent?.trim(), href: link.getAttribute("href") }));

const withWebsite = (showWebsite: boolean | undefined) => maximalProfile({
  resumeClosing: { showPlace: true, showDate: true, showSignature: false, ...(showWebsite === undefined ? {} : { showWebsite }) },
});

describe("footer website (Ort, Datum und Unterschrift → Website im Footer anzeigen)", () => {
  it.each(resumeTemplateIds)("%s: on every preview and PDF page when switched on", (templateId) => {
    const cv = renderCv(templateId, withWebsite(true));
    for (const page of [...cv.previewPages, ...cv.pdfPages]) {
      const found = footerWebsites(page);
      // Modern's preview footer prints the website as text (no link) like it always did.
      if (templateId === "modern" && cv.previewPages.includes(page)) {
        expect(page.querySelector(".modern-resume-footer__left")?.textContent).toBe(website);
        continue;
      }
      expect(found).toEqual([{ text: website, href: website }]);
    }
  });

  it.each(resumeTemplateIds)("%s: nowhere in a footer when switched off or never chosen", (templateId) => {
    for (const showWebsite of [false, undefined]) {
      const cv = renderCv(templateId, withWebsite(showWebsite));
      for (const page of [...cv.previewPages, ...cv.pdfPages]) {
        expect(footerWebsites(page)).toEqual([]);
        expect(page.querySelector(".modern-resume-footer__left")?.textContent ?? "").toBe("");
        expect(page.querySelector("[data-resume-page-footer]")).toBeNull();
      }
    }
  });

  it.each(resumeTemplateIds)("%s: not in the ATS output", (templateId) => {
    const cv = renderCv(templateId, withWebsite(true), { ats: true });
    for (const page of [...cv.previewPages, ...cv.pdfPages]) {
      expect(footerWebsites(page)).toEqual([]);
      expect(page.querySelector(".modern-resume-footer__left")?.textContent ?? "").toBe("");
    }
  });

  it("keeps the page numbers of the templates when the website is off", () => {
    const cv = renderCv("modern", withWebsite(false));
    expect(cv.pdf).toMatch(/Seite 1 \/ \d/);
    expect(cv.preview).toMatch(/Seite 1 \/ \d/);
  });
});
