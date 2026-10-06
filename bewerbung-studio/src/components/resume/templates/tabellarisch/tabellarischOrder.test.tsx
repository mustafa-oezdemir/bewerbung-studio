import { describe, expect, it } from "vitest";
import { getManagerSections, moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { profileSchema } from "../../../../shared/schema";
import { renderCv } from "../../__parityHarness";

const specialId = "ad000000-0000-4000-8000-000000000030";
const profile = () => profileSchema.parse({
  id: "ad000000-0000-4000-8000-000000000001", isDefault: true,
  firstName: "Ayla", lastName: "Beispiel", title: "Planerin",
  updatedAt: "2026-10-06T10:00:00.000Z", summary: "Klare Prozesse und gute Zusammenarbeit.",
  strengths: [{ id: "ad000000-0000-4000-8000-000000000040", title: "Planung", description: "Strukturierte Abläufe" }],
  experiences: [{ id: "ad000000-0000-4000-8000-000000000010", role: "Prozessplanerin", company: "Beispiel GmbH",
    from: "2020", to: "2024", achievements: ["Ablauf verbessert."] }],
  education: [{ id: "ad000000-0000-4000-8000-000000000020", degree: "Ausbildung", institution: "Beispielschule",
    from: "2017", to: "2020" }],
  languages: ["Deutsch – C1"], certifications: ["Fiktive Weiterbildung"],
  specialSections: [{ id: specialId, kind: "projects", title: "Eigenes Projekt", contentType: "list",
    entries: [{ id: "ad000000-0000-4000-8000-000000000031", title: "Planungswerkzeug" }] }],
});

const order = (ids: string[]) => {
  const source = profile();
  const entries = getManagerSections(source, "tabellarisch").filter((entry) => !entry.fixed);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const arranged = [...ids, ...entries.map((entry) => entry.id).filter((id) => !ids.includes(id))];
  return { ...source, resumeManagerLayouts: { ...source.resumeManagerLayouts,
    tabellarisch: arranged.map((id) => ({ id, zone: byId.get(id)!.zone })) } };
};

const sections = (pages: Element[]) => pages.flatMap((page) => Array.from(
  page.querySelectorAll("[data-managed-section]"),
  (section) => section.getAttribute("data-managed-section"),
));
const visible = (ids: (string | null)[]) => ids.filter((id) => id &&
  ["summary", "strengths", "experience", "education", "languages", "certifications", `special:${specialId}`].includes(id));

describe("Tabellarisch manager section order", () => {
  it.each([
    ["summary", "strengths", "experience", "education", "languages", "certifications"],
    ["experience", "summary", "education", "strengths", "languages", "certifications"],
  ])("uses the selected order on both surfaces: %j", (...selected) => {
    const result = renderCv("tabellarisch", order(selected));
    const expected = [...selected, `special:${specialId}`];
    expect(visible(sections(result.previewPages))).toEqual(expected);
    expect(visible(sections(result.pdfPages))).toEqual(expected);
    expect(result.previewPages.length).toBe(result.pdfPages.length);
  });

  it("keeps the sequence across page breaks and omits hidden sections", () => {
    const source = order(["experience", "summary", "education", "strengths", `special:${specialId}`, "languages"]);
    const long = profileSchema.parse({ ...source,
      experiences: Array.from({ length: 6 }, (_, index) => ({ ...source.experiences[0],
        id: `ad000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
        role: `Prozessplanerin ${index + 1}`,
        achievements: Array.from({ length: 5 }, (_, bullet) => `Schritt ${index + 1}.${bullet + 1}: ${"Ablaufplanung ".repeat(13)}`),
      })),
      resumeManagerOverrides: { ...source.resumeManagerOverrides, languages: { visible: false } },
    });
    const result = renderCv("tabellarisch", long);
    expect(result.previewPages.length).toBeGreaterThan(1);
    expect(result.previewPages.length).toBe(result.pdfPages.length);
    const expected = visible(sections(result.previewPages));
    expect(visible(sections(result.pdfPages))).toEqual(expected);
    expect(expected).not.toContain("languages");
    expect(expected.lastIndexOf("experience")).toBeLessThan(expected.indexOf("summary"));
    expect(expected.indexOf("summary")).toBeLessThan(expected.indexOf("education"));
    expect(expected.indexOf("education")).toBeLessThan(expected.indexOf("strengths"));
    expect(expected.indexOf("strengths")).toBeLessThan(expected.indexOf(`special:${specialId}`));
    expect(expected.filter((id) => id === `special:${specialId}`)).toHaveLength(1);
    const bullets = (pages: Element[]) => pages.flatMap((page) => Array.from(
      page.querySelectorAll('[data-managed-section="experience"] li'), (item) => item.textContent?.trim(),
    ));
    const sourceBullets = long.experiences.flatMap((entry) => entry.achievements.map((item) => item.trim()));
    expect(bullets(result.previewPages)).toEqual(sourceBullets);
    expect(bullets(result.pdfPages)).toEqual(sourceBullets);
  });

  it("updates the preview order after a manager move while keeping saved zones", () => {
    const source = order(["summary", "experience", "education", "strengths"]);
    const before = visible(sections(renderCv("tabellarisch", source).previewPages));
    const moved = moveManagerSection(source, "tabellarisch", "strengths", "main", 2);
    const result = renderCv("tabellarisch", moved);
    expect(visible(sections(result.previewPages)).slice(0, 4)).toEqual(["summary", "experience", "strengths", "education"]);
    expect(visible(sections(result.previewPages))).not.toEqual(before);
    expect(visible(sections(result.pdfPages))).toEqual(visible(sections(result.previewPages)));
  });

  it("does not group a sidebar-zoned section ahead of the single-column manager order", () => {
    const source = order(["experience", "summary", "strengths", "education"]);
    const layout = source.resumeManagerLayouts.tabellarisch.map((entry) =>
      entry.id === "strengths" ? { ...entry, zone: "sidebar" as const } : entry);
    const result = renderCv("tabellarisch", { ...source, resumeManagerLayouts: {
      ...source.resumeManagerLayouts, tabellarisch: layout,
    } });
    expect(visible(sections(result.previewPages)).slice(0, 4)).toEqual(["experience", "summary", "strengths", "education"]);
    expect(visible(sections(result.pdfPages))).toEqual(visible(sections(result.previewPages)));
  });
});
