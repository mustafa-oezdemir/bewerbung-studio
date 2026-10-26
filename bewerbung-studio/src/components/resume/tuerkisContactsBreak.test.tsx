import { describe, expect, it } from "vitest";
import { maximalProfile } from "./__parityFixture";
import { renderCv } from "./__parityHarness";
import { setResumePhotoVisible } from "../../shared/resumePhoto";
import { getZweispaltigContactTexts } from "../../shared/resumePersonalData";

/**
 * The template QA's "long" profile: the hero (seven lines of the name, five of the Berufsbezeichnung), the photo and the
 * twelve contacts of the Kontakt list are taller than page one's left column.
 */
const longProfile = () => setResumePhotoVisible(maximalProfile({
  photoPath: "data:image/png;base64,AA==",
  firstName: "Mustafa-Alexander", lastName: "Özdemir-Schmidt-Wolkenstein",
  title: "Senior Softwareentwickler und Fachinformatiker für Anwendungsentwicklung mit Schwerpunkt Plattformen",
  linkedin: "https://www.linkedin.com/in/mustafa-alexander-oezdemir-schmidt-wolkenstein-1234567890",
  portfolio: "https://www.mustafa-alexander-oezdemir-portfolio-und-projekte.example.org/projekte/open-source",
}), true);

const contactRows = (page: Element) => Array.from(page.querySelectorAll(".tuerkis-profil-contacts > :not(.tuerkis-profil-contacts__title)"))
  .map((row) => (row.textContent ?? "").trim());

describe("Türkis Profil: the Kontakt list", () => {
  it("breaks between two rows where it is taller than page one and goes on above page two's Seitenspalte, in the preview and the PDF", () => {
    const { resolved, previewPages, pdfPages } = renderCv("tuerkis-profil", longProfile());
    const contacts = getZweispaltigContactTexts(resolved.profile);
    const [first, second] = resolved.pagePlan;
    const head = first.blockRanges?.personalData;
    expect(head).toMatchObject({ from: 0, total: contacts.length });
    expect(head!.to).toBeGreaterThan(0);
    expect(head!.to).toBeLessThan(contacts.length);
    expect(second.blockRanges?.personalData).toEqual({ from: head!.to, to: contacts.length, total: contacts.length });
    // The column's sections never start below a list that goes on: Kurzprofil and Sprachen follow it on page two.
    expect(first.blocks).not.toContain("summary");
    expect(first.blocks).not.toContain("languages");
    expect(second.blocks).toEqual(expect.arrayContaining(["personalData", "summary"]));
    expect(second.sidebar).toBe(true);
    expect(first.fill!.sidebar).toBeLessThanOrEqual(1);
    for (const pages of [previewPages, pdfPages]) {
      const rows = pages.map(contactRows);
      // every contact once, in the order both renderers draw the list (the planner measures the same rows)
      expect(rows.flat()).toEqual(contacts);
      expect(rows[0]).toHaveLength(head!.to);
      expect(rows[1]).toHaveLength(contacts.length - head!.to);
      expect(pages.map((page) => page.querySelector(".tuerkis-profil-contacts__title")?.textContent ?? null))
        .toEqual(["Kontakt", "Kontakt · Fortsetzung", ...pages.slice(2).map(() => null)]);
      const side = pages[1].querySelector(".zweispaltig-sidebar,.zweispaltig-pdf-sidebar")!;
      expect(side.firstElementChild?.matches(".tuerkis-profil-contacts")).toBe(true);
      expect(side.querySelector('[data-managed-section="summary"]')).not.toBeNull();
    }
  });

  it("stays whole on page one where it fits there", () => {
    const { resolved, previewPages, pdfPages } = renderCv("tuerkis-profil", setResumePhotoVisible(maximalProfile({ photoPath: "data:image/png;base64,AA==" }), true));
    const contacts = getZweispaltigContactTexts(resolved.profile);
    expect(resolved.pagePlan.some((page) => page.blocks?.includes("personalData"))).toBe(false);
    for (const pages of [previewPages, pdfPages]) {
      expect(contactRows(pages[0])).toEqual(contacts);
      expect(pages.slice(1).flatMap(contactRows)).toEqual([]);
    }
  });
});
