import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { maximalProfile, maximalProfileInput } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";
import { GepflegtSidebar } from "./templates/gepflegt/GepflegtSidebar";

/**
 * The page-two header repeated the whole first-page header (the managed output cloned it and only removed the mailto
 * and tel links), so the address, the links and the birth and family data came back on every later page. A later page
 * carries the identity and, of the contacts, only the e-mail and the phone the user chose for it.
 */
const stations = (count: number) => {
  const [first, second] = maximalProfileInput().experiences;
  return Array.from({ length: count }, (_, index) => ({
    ...(index % 2 ? second : first),
    id: `9a000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    from: `01/${2000 + index}`, to: `12/${2000 + index}`, isCurrent: false,
    tasks: ["Konzeption zentraler Funktionen", "Abstimmung mit Fachbereichen", "Betreuung der Anwender", "Weiterentwicklung der Plattform"],
  }));
};
const profileOf = (count: number, extra: Record<string, unknown> = {}) => maximalProfile({ experiences: stations(count), ...extra });

const address = "Musterstraße 12";
const email = "mustafa@example.com";
const phoneDigits = "491701234567";
const digits = (value: string) => value.replace(/\D/g, "");

/** The texts of a page one by one, without the footer (its portfolio link is the template's footer, on every page). */
const leaves = (page: Element) =>
  Array.from(page.querySelectorAll("*"))
    .filter((node) => !node.closest("style,script,footer,[class*='footer']") && !Array.from(node.children).some((child) => (child.textContent ?? "").trim()))
    .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim());
const count = (page: Element, test: (text: string) => boolean) => leaves(page).filter(test).length;

const personalDetails = {
  address: (text: string) => text.includes(address),
  postalCode: (text: string) => text.includes("35037"),
  birth: (text: string) => text.includes("Ankara") || text.includes("17.05.1990"),
  nationality: (text: string) => text.includes("Staatsangehörigkeit") || text === "deutsch",
  family: (text: string) => text.includes("verheiratet") || text.includes("2 Kinder"),
  linkedin: (text: string) => text.includes("linkedin.com"),
  github: (text: string) => text.includes("github.com"),
  xing: (text: string) => text.includes("xing.com"),
  gitlab: (text: string) => text.includes("gitlab.com"),
  portfolio: (text: string) => text.includes("mustafa-oezdemir.de"),
};
const occurrences = (page: Element) => ({
  address: count(page, personalDetails.address),
  email: count(page, (text) => text.includes(email)),
  phone: count(page, (text) => digits(text).includes(phoneDigits)),
  name: count(page, (text) => text.includes("Mustafa")),
  title: count(page, (text) => text.includes("Fachinformatiker für Anwendungsentwicklung")),
});

describe("Gepflegt: the header of a later page", () => {
  const defaults = renderCv("gepflegt", profileOf(7));

  it("prints the address once on the first page and never on a later page, in the preview and the PDF", () => {
    for (const pages of [defaults.previewPages, defaults.pdfPages]) {
      expect(pages.length).toBeGreaterThan(1);
      expect(occurrences(pages[0]).address).toBe(1);
      for (const page of pages.slice(1)) expect(occurrences(page)).toMatchObject({ address: 0, email: 0, phone: 0 });
    }
  });

  it("keeps the name and the Berufsbezeichnung on every page", () => {
    for (const pages of [defaults.previewPages, defaults.pdfPages]) {
      for (const [index, page] of pages.entries()) {
        const header = page.querySelector("header");
        expect(header?.textContent, `page ${index + 1}`).toContain("Mustafa");
        expect(header?.textContent, `page ${index + 1}`).toContain("Softwareentwickler | Fachinformatiker für Anwendungsentwicklung");
        expect(page.querySelectorAll("header"), `page ${index + 1}`).toHaveLength(1);
      }
    }
  });

  it("adds only the e-mail and the phone the user chose, and still no address", () => {
    const only = (choice: { email: boolean; phone: boolean }) => renderCv("gepflegt", profileOf(7, { resumeContinuationContactVisibility: choice }));
    for (const [choice, expected] of [
      [{ email: true, phone: true }, { email: 1, phone: 1 }],
      [{ email: true, phone: false }, { email: 1, phone: 0 }],
      [{ email: false, phone: true }, { email: 0, phone: 1 }],
    ] as const) {
      const rendered = only(choice);
      for (const pages of [rendered.previewPages, rendered.pdfPages]) {
        expect(pages.length).toBeGreaterThan(1);
        // the first page still names both
        expect(occurrences(pages[0])).toMatchObject({ address: 1, email: 1, phone: 1 });
        for (const page of pages.slice(1)) expect(occurrences(page), JSON.stringify(choice)).toMatchObject({ address: 0, ...expected });
      }
    }
  });

  it("keeps the first-page visibility of the address apart from the continuation: shown on page one only, or on no page", () => {
    const shown = renderCv("gepflegt", profileOf(7, { resumePersonalFieldVisibility: { ...maximalProfile().resumePersonalFieldVisibility, address: true } }));
    const hidden = renderCv("gepflegt", profileOf(7, { resumePersonalFieldVisibility: { ...maximalProfile().resumePersonalFieldVisibility, address: false } }));
    for (const [pages, first] of [[shown.previewPages, 1], [shown.pdfPages, 1], [hidden.previewPages, 0], [hidden.pdfPages, 0]] as const) {
      expect(occurrences(pages[0]).address).toBe(first);
      for (const page of pages.slice(1)) expect(occurrences(page).address).toBe(0);
    }
  });

  it("leaves no address on page two and page three of a long Lebenslauf", () => {
    const long = renderCv("gepflegt", profileOf(15));
    for (const pages of [long.previewPages, long.pdfPages]) {
      expect(pages.length, "three or more pages").toBeGreaterThanOrEqual(3);
      expect(occurrences(pages[0]).address).toBe(1);
      for (const page of pages.slice(1)) expect(occurrences(page).address).toBe(0);
    }
  });

  it("carries no other first-page detail to a later page: birth, nationality, family, links", () => {
    for (const pages of [defaults.previewPages, defaults.pdfPages]) {
      // the first page shows them (the fixture fills every field and the visibility is on)
      for (const [kind, test] of Object.entries(personalDetails)) {
        if (kind === "postalCode" || kind === "portfolio") continue;
        expect(count(pages[0], test), `page 1 ${kind}`).toBeGreaterThan(0);
      }
      for (const page of pages.slice(1)) {
        for (const [kind, test] of Object.entries(personalDetails)) expect(count(page, test), `later page ${kind}`).toBe(0);
      }
    }
  });

  it("is the same on both surfaces: address, e-mail, phone, name and title of every page", () => {
    for (const choice of [{ email: false, phone: false }, { email: true, phone: true }]) {
      const rendered = renderCv("gepflegt", profileOf(15, { resumeContinuationContactVisibility: choice }));
      expect(rendered.pdfPages.length).toBe(rendered.previewPages.length);
      expect(rendered.previewPages.map(occurrences), JSON.stringify(choice)).toEqual(rendered.pdfPages.map(occurrences));
    }
  });

  it("does not delete or change the address of the profile", () => {
    const profile = profileOf(7);
    renderCv("gepflegt", profile);
    expect(profile).toMatchObject({ street: address, postalCode: "35037", city: "Marburg", country: "Deutschland" });
  });
});

describe("Gepflegt: the continuation sidebar follows the continuation visibility", () => {
  const sidebar = (choice: { email: boolean; phone: boolean }) => {
    const profile = maximalProfile({ resumeContinuationContactVisibility: choice });
    const markup = renderToStaticMarkup(
      <GepflegtSidebar profile={profile} name="Mustafa Özdemir" summary="" sections={profile.resumeSections} atsMode={false}
        photoSource={null} isContinuation pageNumber={2} totalPages={2} />,
    );
    return markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  };

  it("names no contact by default, and never the address or a link", () => {
    const text = sidebar({ email: false, phone: false });
    expect(text).toContain("Mustafa Özdemir");
    for (const value of [email, "1234567", address, "linkedin", "github"]) expect(text).not.toContain(value);
  });

  it("names the e-mail and the phone only when the user chose them", () => {
    expect(sidebar({ email: true, phone: false })).toContain(email);
    expect(sidebar({ email: true, phone: false })).not.toContain("1234567");
    expect(sidebar({ email: false, phone: true })).toContain("+49 170 1234567");
    expect(sidebar({ email: false, phone: true })).not.toContain(email);
    for (const choice of [{ email: true, phone: true }]) {
      const text = sidebar(choice);
      expect(text).toContain(email);
      expect(text).not.toContain(address);
      expect(text).not.toContain("linkedin");
    }
  });
});

describe.each(resumeTemplateIds)("%s: a later page repeats the identity, not the personal details of page one", (templateId) => {
  const rendered = renderCv(templateId, profileOf(9));
  const optedIn = renderCv(templateId, profileOf(9, { resumeContinuationContactVisibility: { email: true, phone: true } }));

  it("shows the address and the other details on page one at most where the template draws them, and on no later page", () => {
    for (const pages of [rendered.previewPages, rendered.pdfPages]) {
      expect(pages.length, "the Lebenslauf spans several pages").toBeGreaterThan(1);
      expect(count(pages[0], personalDetails.address), "page 1 address").toBeGreaterThan(0);
      for (const [index, page] of pages.slice(1).entries()) {
        for (const [kind, test] of Object.entries(personalDetails)) expect(count(page, test), `page ${index + 2} ${kind}`).toBe(0);
      }
    }
  });

  it("keeps the name on every page and the same occurrences in the preview and the PDF", () => {
    for (const result of [rendered, optedIn]) {
      for (const pages of [result.previewPages, result.pdfPages]) for (const [index, page] of pages.entries()) expect(occurrences(page).name, `page ${index + 1}`).toBeGreaterThan(0);
      expect(result.previewPages.map(occurrences), "preview = PDF").toEqual(result.pdfPages.map(occurrences));
    }
  });

  it("adds e-mail and phone to a later page only when the user chose them, still without the address", () => {
    for (const [result, expected] of [[rendered, { email: 0, phone: 0 }], [optedIn, { email: 1, phone: 1 }]] as const) {
      for (const pages of [result.previewPages, result.pdfPages]) {
        // a template whose Kontakte column on a later page already names them still prints each at most once
        for (const page of pages.slice(1)) {
          const found = occurrences(page);
          expect(found.address).toBe(0);
          expect(found.email).toBeLessThanOrEqual(1);
          expect(found.phone).toBeLessThanOrEqual(1);
          if (expected.email === 0) expect(found).toMatchObject({ email: 0, phone: 0 });
        }
      }
    }
  });

  it("is a plain single column without the first-page details on a later page in ATS mode too", () => {
    const ats = renderCv(templateId, profileOf(9), { ats: true });
    for (const pages of [ats.previewPages, ats.pdfPages]) {
      expect(pages.length).toBeGreaterThan(1);
      for (const page of pages.slice(1)) {
        for (const [kind, test] of Object.entries(personalDetails)) expect(count(page, test), `ATS later page ${kind}`).toBe(0);
      }
    }
  });
});
