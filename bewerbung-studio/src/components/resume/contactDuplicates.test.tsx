import { describe, expect, it } from "vitest";
import { maximalProfile, maximalProfileInput } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

/** A Lebenslauf long enough for two or more pages in every template: the case in which the header got its copy. */
const longProfile = (extra: Record<string, unknown> = {}) => {
  const [first, second] = maximalProfileInput().experiences;
  const stations = Array.from({ length: 7 }, (_, index) => ({
    ...(index % 2 ? second : first),
    id: `9a000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    from: `01/${2010 + index}`, to: `12/${2010 + index}`, isCurrent: false,
    tasks: ["Konzeption zentraler Funktionen", "Abstimmung mit Fachbereichen", "Betreuung der Anwender"],
  }));
  return maximalProfile({ experiences: stations, ...extra });
};

const email = "mustafa@example.com";
const phoneDigits = "491701234567";
const digits = (value: string) => value.replace(/\D/g, "");
/** The texts of a page one by one, so a value counts once per place it is printed. */
const leaves = (page: Element) =>
  Array.from(page.querySelectorAll("*"))
    .filter((node) => !node.closest("style,script") && !Array.from(node.children).some((child) => (child.textContent ?? "").trim()))
    .map((node) => node.textContent ?? "");
const count = (page: Element) => ({
  email: leaves(page).filter((text) => text.includes(email)).length,
  phone: leaves(page).filter((text) => digits(text).includes(phoneDigits)).length,
});

/** Templates whose own Kontakte / Kontaktdaten column lists e-mail and phone (the others name them in the header). */
const contactColumnTemplates = ["zeitgenoessisch", "kompakt", "pehlione_white", "pehlione_white_blue"];

describe.each(resumeTemplateIds)("contact details in %s", (templateId) => {
  const result = renderCv(templateId, longProfile());

  it("print e-mail and phone at most once per page, in the preview and the PDF alike", () => {
    expect(result.pdfPages.length, "the profile spans several pages").toBeGreaterThan(1);
    for (const surface of ["preview", "pdf"] as const) {
      const pages = surface === "preview" ? result.previewPages : result.pdfPages;
      pages.forEach((page, index) => {
        const { email: emails, phone } = count(page);
        expect(emails, `${surface} p${index + 1}: e-mail`).toBeLessThanOrEqual(1);
        expect(phone, `${surface} p${index + 1}: phone`).toBeLessThanOrEqual(1);
      });
      // The first page always names both; later pages follow the user's separate visibility choice.
      expect(count(pages[0]), `${surface} p1`).toEqual({ email: 1, phone: 1 });
      expect(result.previewPages.map(count), "preview = PDF").toEqual(result.pdfPages.map(count));
    }
  });

  it.runIf(contactColumnTemplates.includes(templateId))("keeps the first-page header to name, title and photo when a Kontakte column lists the contacts", () => {
    for (const pages of [result.previewPages, result.pdfPages]) {
      const header = pages[0].querySelector("header");
      expect(header?.textContent ?? "").not.toContain(email);
      expect(digits(header?.textContent ?? "")).not.toContain(phoneDigits);
      expect(header?.querySelector("[data-resume-header-extra-contact]")).toBeNull();
    }
  });

  it.runIf(templateId === "elegant")("keeps Elegant's first-page contacts under the name", () => {
    for (const pages of [result.previewPages, result.pdfPages]) {
      const header = pages[0].querySelector("header");
      expect(header?.textContent).toContain(email);
      expect(digits(header?.textContent ?? "")).toContain(phoneDigits);
      expect(pages[0].querySelector("aside")?.textContent).not.toContain(email);
    }
  });

  it.runIf(["zeitgenoessisch", "kompakt", "elegant"].includes(templateId))("shows e-mail and phone on later pages only when selected", () => {
    const selected = renderCv(templateId, longProfile({
      resumeContinuationContactVisibility: { email: true, phone: true },
    }));
    for (const surface of ["preview", "pdf"] as const) {
      const defaults = surface === "preview" ? result.previewPages : result.pdfPages;
      const optedIn = surface === "preview" ? selected.previewPages : selected.pdfPages;
      expect(defaults.length).toBeGreaterThan(1);
      expect(optedIn.length).toBe(defaults.length);
      defaults.slice(1).forEach((page) => expect(count(page)).toEqual({ email: 0, phone: 0 }));
      optedIn.slice(1).forEach((page) => expect(count(page)).toEqual({ email: 1, phone: 1 }));
    }
  });

  it("honours the personal switches in the header, the Kontakte column and the PDF", () => {
    const hidden = renderCv(templateId, longProfile({ resumePersonalFieldVisibility: { phone: false, email: false } }));
    for (const surface of ["preview", "pdf"] as const) {
      const pages = surface === "preview" ? hidden.previewPages : hidden.pdfPages;
      for (const page of pages) expect(count(page), surface).toEqual({ email: 0, phone: 0 });
    }
  });
});
