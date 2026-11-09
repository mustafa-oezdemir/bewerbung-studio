import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { firstPageOnlyPhotoTemplates } from "../../shared/resumeContinuation";
import { estimateKreativContinuationTop, estimateRepeatedHeaderTop } from "../../shared/resumeHeaderGeometry";
import { setResumePhotoVisible } from "../../shared/resumePhoto";
import { tabellarischContinuationCss } from "../../shared/tabellarischDesign";
import { maximalProfile, maximalProfileInput, minimalProfile } from "./__parityFixture";
import { harnessApplication, renderCv } from "./__parityHarness";

const photoPath = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=";
const title = "Softwareentwicklerin | Fachinformatikerin für Anwendungsentwicklung";

const stations = (count: number) => {
  const [first, second] = maximalProfileInput().experiences;
  return Array.from({ length: count }, (_, index) => ({
    ...(index % 2 ? second : first),
    id: `9c000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    from: `01/${2005 + index}`, to: `12/${2005 + index}`, isCurrent: false,
    tasks: ["Konzeption zentraler Funktionen", "Abstimmung mit Fachbereichen", "Betreuung der Anwender"],
  }));
};
const withPhoto = (count: number, extra: Record<string, unknown> = {}) =>
  setResumePhotoVisible(maximalProfile({ title, photoPath, experiences: stations(count), ...extra }), true);

/** A page of the output as the preview and the PDF draw it; the photo is given to the preview like in the app. */
const surfaces = (templateId: string, profile: ReturnType<typeof withPhoto>, ats = false) => {
  const output = renderCv(templateId, profile, { ats, photoSource: profile.photoPath || null });
  return [["preview", output.previewPages], ["pdf", output.pdfPages]] as const;
};
const photoSelector = "header img,[class*='__photo'],.zweispaltig-pdf-photo,.modern-pdf-photo,.tuerkis-profil-photo";

describe.each(Array.from(firstPageOnlyPhotoTemplates))("the photo of %s", (templateId) => {
  it("stands on the first of two pages only, with name and title repeated", () => {
    for (const [surface, pages] of surfaces(templateId, withPhoto(5))) {
      expect(pages.length, surface).toBeGreaterThan(1);
      expect(pages[0].querySelector(photoSelector), `${surface} p1`).not.toBeNull();
      pages.slice(1).forEach((page, index) => {
        const label = `${surface} p${index + 2}`;
        expect(page.querySelector(photoSelector), label).toBeNull();
        const header = page.querySelector("header")!;
        expect(header.querySelector("h1")?.textContent?.trim(), label).toBeTruthy();
        expect(header.textContent, label).toContain(title);
      });
    }
  }, 30_000);

  it("stands on no later page of a long Lebenslauf", () => {
    for (const [surface, pages] of surfaces(templateId, withPhoto(16))) {
      expect(pages.length, surface).toBeGreaterThan(2);
      pages.slice(1).forEach((page, index) => expect(page.querySelector(photoSelector), `${surface} p${index + 2}`).toBeNull());
    }
  }, 30_000);

  it("stays where it is on a single page", () => {
    const profile = setResumePhotoVisible({ ...minimalProfile(), title, photoPath }, true);
    for (const [surface, pages] of surfaces(templateId, profile)) {
      expect(pages, surface).toHaveLength(1);
      expect(pages[0].querySelector(photoSelector), surface).not.toBeNull();
    }
  }, 30_000);

  it("leaves no frame behind when it is hidden or missing", () => {
    for (const profile of [setResumePhotoVisible(withPhoto(5), false), maximalProfile({ title, photoPath: "", experiences: stations(5) })])
      for (const [surface, pages] of surfaces(templateId, profile))
        pages.forEach((page, index) => expect(page.querySelector(photoSelector), `${surface} p${index + 1}`).toBeNull());
  }, 30_000);

  it("does not reach later pages with its size", () => {
    const header = (size: string) => surfaces(templateId, withPhoto(5, { resumePhotoSize: size }))
      .map(([, pages]) => pages[1].querySelector("header")!.outerHTML);
    const medium = header("medium");
    expect(header("large")).toEqual(medium);
    expect(header("small")).toEqual(medium);
    for (const [surface, pages] of surfaces(templateId, withPhoto(5, { resumePhotoSize: "large" })))
      expect(pages[1].outerHTML, surface).not.toContain("--resume-photo-scale");
  }, 60_000);

  it("is absent from the plain output, whose name still comes before the title", () => {
    for (const [surface, pages] of surfaces(templateId, withPhoto(9), true))
      pages.forEach((page, index) => {
        const label = `${surface} p${index + 1}`;
        const text = page.querySelector("header")!.textContent ?? "";
        expect(page.querySelector("header img"), label).toBeNull();
        expect(text.indexOf(title), label).toBeGreaterThan(-1);
      });
  }, 30_000);
});

describe("the first-page photo rule", () => {
  it("applies to exactly the three templates", () => {
    expect(Array.from(firstPageOnlyPhotoTemplates).sort()).toEqual(["modern", "tuerkis-profil", "zweispaltig"]);
  });
});

const heads = {
  tabellarisch: { preview: ".tabellarisch-continuation-header", pdf: ".tabellarisch-pdf-continuation", first: ".tabellarisch-header,.tabellarisch-pdf-header" },
  kreativ: { preview: ".kreativ-header--compact", pdf: ".kreativ-pdf-header.compact", first: ".kreativ-header:not(.kreativ-header--compact),.kreativ-pdf-header:not(.compact)" },
} as const;

describe.each(["tabellarisch", "kreativ"] as const)("the head of later %s pages", (templateId) => {
  const contacts = { resumeContinuationContactVisibility: { email: true, phone: true } };
  const email = maximalProfileInput().email;

  it("reads name, title, chosen contacts from top to bottom, with the profile's own title", () => {
    const longTitle = "Senior Softwareentwicklerin und Fachinformatikerin für Anwendungsentwicklung mit Schwerpunkt verteilte Plattformen";
    for (const profile of [withPhoto(9, contacts), withPhoto(9, { ...contacts, title: longTitle })])
      for (const [surface, pages] of surfaces(templateId, profile)) {
        expect(pages[0].querySelector(heads[templateId].first), `${surface} p1`).not.toBeNull();
        expect(pages.length, surface).toBeGreaterThan(1);
        pages.slice(1).forEach((page, index) => {
          const label = `${surface} p${index + 2}`;
          const head = page.querySelector(heads[templateId][surface])!;
          expect(head, label).not.toBeNull();
          const text = head.textContent ?? "";
          const name = `${profile.firstName} ${profile.lastName}`;
          expect(text.indexOf(name), label).toBeGreaterThan(-1);
          expect(text.indexOf(profile.title), label).toBeGreaterThan(text.indexOf(name));
          expect(text.indexOf(email), label).toBeGreaterThan(text.indexOf(profile.title));
        });
      }
  }, 30_000);
});

describe("stacked continuation heads in the stylesheets", () => {
  it("Tabellarisch has one left-aligned column", () => {
    const css = tabellarischContinuationCss(".head");
    expect(css).toContain("grid-template-columns:minmax(0,1fr);");
    expect(css).not.toContain("fit-content");
    expect(css).not.toContain("text-align:right");
    expect(css).not.toContain("flex-end");
  });

  it("Kreativ has no side-by-side layout left, in the preview and the PDF", () => {
    const preview = readFileSync("src/components/resume/templates/kreativ/kreativ.css", "utf8");
    expect(preview).toMatch(/\.kreativ-header--compact \{\s*display: block;/);
    expect(preview).not.toContain("display: contents");
    const pdf = buildDocumentHtml(harnessApplication("kreativ"), withPhoto(1), "lebenslauf");
    expect(pdf).toContain(".kreativ-pdf-header.compact{display:block;");
    expect(pdf).not.toContain(".kreativ-pdf-header.compact .kreativ-pdf-identity{display:contents}");
  });
});

describe("the planner's later-page tops", () => {
  const options = { name: "Mina Kaya", title: "Softwareentwicklerin", contacts: [] as string[], widthMm: 180, gapAfterMm: 6.5 };

  it("follow the repeated header: name, title, chosen contacts and the gap below", () => {
    const pt = 25.4 / 72;
    expect(estimateRepeatedHeaderTop("zweispaltig", options)).toBeCloseTo(20 + 24 * pt + 1.5 + 11.5 * pt * 1.2 + 6.5 + 0.5, 1);
    expect(estimateRepeatedHeaderTop("zweispaltig", { ...options, contacts: ["mina@example.com", "+49 170 1234567"] }))
      .toBeCloseTo(20 + 24 * pt + 1.5 + 11.5 * pt * 1.2 + 1.5 + 8 * pt * 1.25 + 6.5 + 0.5, 1);
    // Modern gives up the height it kept for the photo.
    expect(estimateRepeatedHeaderTop("modern", { ...options, gapAfterMm: 4 })).toBeCloseTo(14 + 24 * pt + 2 + 12 * pt * 1.18 + 4 + 0.5, 1);
    expect(estimateRepeatedHeaderTop("kompakt", options)).toBeUndefined();
  });

  it("grow with every wrapped line", () => {
    const base = estimateRepeatedHeaderTop("zweispaltig", options)!;
    expect(estimateRepeatedHeaderTop("zweispaltig", { ...options, title: "Senior Softwareentwicklerin ".repeat(8) })).toBeGreaterThan(base + 4);
    expect(estimateRepeatedHeaderTop("zweispaltig", { ...options, name: "Maximiliane Alexandra Friederike von Hohenzollern-Sigmaringen" })).toBeGreaterThan(base + 8);
  });

  it("place Kreativ's content below its stacked head", () => {
    const profile = maximalProfile({ firstName: "Mina", lastName: "Kaya", title: "Softwareentwicklerin" });
    const pt = 25.4 / 72;
    const stacked = 12 + 7.3 * pt * 1.26 + 1.5 + 15 * pt + 1 + 10.5 * 0.88 * pt * 1.26 + 4 + 0.4 + 7 + 0.5;
    expect(estimateKreativContinuationTop(profile, [], 10.5, 1.26)).toBeCloseTo(stacked, 1);
    expect(estimateKreativContinuationTop(profile, ["mina@example.com"], 10.5, 1.26)).toBeCloseTo(stacked + 1.5 + 8 * pt * 1.25, 1);
  });
});
