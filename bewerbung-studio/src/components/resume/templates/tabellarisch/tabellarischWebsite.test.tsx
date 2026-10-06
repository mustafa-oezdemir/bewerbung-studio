import { describe, expect, it } from "vitest";
import { renderCv } from "../../__parityHarness";
import { getResumeDisplayProfile } from "../../../../shared/resumeDisplayProfile";
import { getTabellarischHeaderContacts } from "../../../../shared/resumeHeaderGeometry";
import { makeTabellarischProfile, transportpilotBullets, type TabellarischFixtureOptions } from "../../../../shared/__tabellarischHeaderFixture";

/**
 * The Website checkbox of Lebenslauf → Persönliche Daten → Kontaktdaten (`resumePersonalFieldVisibility.website`) shows or
 * hides the Website and nothing else. A Website that joins the row GitHub is in adds no height to the header, so the
 * page break of the career must stay where it is, in the preview and in the PDF.
 */
const website = "pehlione.com";
const longWebsite = "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung";
const render = (options: TabellarischFixtureOptions) => renderCv("tabellarisch", makeTabellarischProfile(options));
const surfaces = (rendered: ReturnType<typeof render>) => ({ preview: rendered.previewPages, pdf: rendered.pdfPages });

const text = (page: Element) => (page.textContent ?? "").replace(/\s+/g, " ");
const pilotBulletsOn = (pages: Element[]) => pages.map((page) => transportpilotBullets.filter((bullet) => text(page).includes(bullet)).length);
const planShape = (rendered: ReturnType<typeof render>) =>
  rendered.resolved.pagePlan.map((page) => page.items.map((item) => `${item.id.slice(-2)}${"bullets" in item && item.bullets ? `[${item.bullets.from}-${item.bullets.to}]` : ""}`).join(","));

describe("Tabellarisch: the Website checkbox", () => {
  const off = render({ visibility: { website: false } });
  const on = render({ visibility: { website: true } });

  it("shows the Website only when its checkbox is on, in the header and in the footer, on every page", () => {
    for (const rendered of [off, on]) {
      const shown = rendered === on;
      for (const [surface, pages] of Object.entries(surfaces(rendered))) {
        pages.forEach((page, index) => expect(text(page).includes(website), `${surface} page ${index + 1} ${shown ? "on" : "off"}`).toBe(shown));
      }
    }
  });

  it("keeps GitHub independent of it: GitHub stays in the header, and in the footer when the Website is off", () => {
    for (const rendered of [off, on]) {
      for (const [surface, pages] of Object.entries(surfaces(rendered))) {
        expect(pages[0].querySelector('header [data-contact-kind="github"]'), surface).not.toBeNull();
        expect(text(pages[0].querySelector("header")!), surface).toContain("github.com/mina-beispiel-gh");
      }
    }
    // the footer link is the template's own: Website, else GitHub, else LinkedIn
    for (const pages of Object.values(surfaces(off))) expect(text(pages[0].querySelector("footer")!)).toContain("github.com/mina-beispiel-gh");
    for (const pages of Object.values(surfaces(on))) expect(text(pages[0].querySelector("footer")!)).toContain(website);
  });

  it("changes nothing else of the header: the other contacts, in the same order, in the preview and the PDF", () => {
    const withoutWebsite = (pages: Element[]) => Array.from(pages[0].querySelectorAll("header [data-contact-kind]")).map((node) => node.getAttribute("data-contact-kind"));
    for (const pages of Object.values(surfaces(off))) expect(withoutWebsite(pages)).toEqual(["phone", "email", "linkedin", "location", "github"]);
    for (const pages of Object.values(surfaces(on))) expect(withoutWebsite(pages)).toEqual(["phone", "email", "linkedin", "location", "github", "website"]);
  });

  it("draws in the header exactly the contacts the page planner measured", () => {
    for (const options of [{ visibility: { website: true } }, { visibility: { website: false } }, { visibility: { birthDate: true, nationality: true, children: true, xing: true, onlineProfiles: true } }] as TabellarischFixtureOptions[]) {
      const profile = makeTabellarischProfile(options);
      const planned = getTabellarischHeaderContacts(getResumeDisplayProfile(profile)).map((contact) => contact.text.replace(/\s+/g, " ").trim());
      const rendered = renderCv("tabellarisch", profile);
      for (const [surface, pages] of Object.entries(surfaces(rendered))) {
        const drawn = Array.from(pages[0].querySelectorAll("header [data-contact-kind]")).map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim());
        expect(drawn, surface).toEqual(planned);
      }
    }
  });
});

describe("Tabellarisch: the career breaks the same with the Website on and off", () => {
  const off = render({ visibility: { website: false } });
  const on = render({ visibility: { website: true } });

  it("plans the same pages: the same entries and bullets on every page", () => {
    expect(planShape(on)).toEqual(planShape(off));
    expect(on.resolved.pagePlan[0].items.map((item) => item.id.slice(-2))).toEqual(["10", "11", "12"]);
  });

  it("keeps all four Transportpilot bullets once, on the same pages in preview and PDF", () => {
    const allocation = pilotBulletsOn(off.previewPages);
    for (const rendered of [off, on]) {
      for (const [surface, pages] of Object.entries(surfaces(rendered))) {
        expect(pilotBulletsOn(pages), surface).toEqual(allocation);
        expect(allocation.reduce((sum, count) => sum + count, 0)).toBe(4);
        for (const bullet of transportpilotBullets) expect(pages.map(text).join(" ").split(bullet).length - 1, `${surface} ${bullet.slice(0, 20)}`).toBe(1);
      }
    }
  });

  it("marks a continuation exactly when the plan splits an entry", () => {
    for (const rendered of [off, on]) {
      const continuations = rendered.resolved.pagePlan.flatMap((page) => page.items)
        .filter((item) => (item.bullets?.from ?? 0) > 0).length;
      for (const [surface, pages] of Object.entries(surfaces(rendered))) {
        expect(pages.flatMap((page) => Array.from(page.querySelectorAll("[data-resume-entry-marker]"))), surface).toHaveLength(continuations);
      }
    }
  });

  it("keeps education after the complete career run on both surfaces", () => {
    for (const rendered of [off, on]) {
      for (const [surface, pages] of Object.entries(surfaces(rendered))) {
        const ids = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-managed-section]"), (section) => section.getAttribute("data-managed-section")));
        expect(ids.lastIndexOf("experience"), surface).toBeLessThan(ids.indexOf("education"));
      }
    }
  });
});

describe("Tabellarisch: a Website that makes the header taller is followed", () => {
  const grown = render({ visibility: { website: true }, fields: { portfolio: longWebsite } });
  const normal = render({ visibility: { website: true } });

  it("moves bullets to page two when the wrapped Website really needs the room", () => {
    expect(planShape(grown)).not.toEqual(planShape(normal));
  });

  it("loses and doubles no bullet, marks the split once and ties the marker to its heading", () => {
    for (const [surface, pages] of Object.entries(surfaces(grown))) {
      for (const bullet of transportpilotBullets) expect(pages.map(text).join(" ").split(bullet).length - 1, `${surface} ${bullet.slice(0, 20)}`).toBe(1);
      const markers = pages.flatMap((page) => Array.from(page.querySelectorAll("[data-resume-entry-marker]")));
      const continuations = grown.resolved.pagePlan.flatMap((page) => page.items)
        .filter((item) => (item.bullets?.from ?? 0) > 0).length;
      expect(markers, surface).toHaveLength(continuations);
      for (const marker of markers)
        expect(marker.parentElement?.textContent?.replace(/\s+/g, " ").trim(), surface).toMatch(/· Fortsetzung$/);
      expect(pilotBulletsOn(pages).reduce((total, count) => total + count, 0), surface).toBe(4);
    }
  });

  it("splits at the same bullet in the preview and the PDF", () => {
    expect(pilotBulletsOn(grown.previewPages)).toEqual(pilotBulletsOn(grown.pdfPages));
  });
});
