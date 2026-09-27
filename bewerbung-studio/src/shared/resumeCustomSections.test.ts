import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { normalizeCustomSection, renderCustomSectionContent } from "./resumeCustomSections";
import { resumeCustomContentTypes } from "./resumeCustomSectionTypes";
import { parseHTML } from "linkedom";
const section = (extra = {}) => profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(), specialSections: [{ id: crypto.randomUUID(), kind: "custom", title: "Beliebige Überschrift", entries: [{ id: crypto.randomUUID(), title: "demo" }], ...extra }] }).specialSections[0];
describe("custom section normalization", () => {
  it("keeps entry title, organization and date in distinct semantic roles", () => {
    const { document } = parseHTML(renderCustomSectionContent(section({ contentType: "entries", entries: [{
      id: crypto.randomUUID(), title: "Fachinformatiker für Anwendungsentwicklung", subtitle: "IAD GmbH", date: "07/2023 – 11/2025",
    }] })));
    expect(document.querySelector('[data-custom-role="entry-title"]')?.textContent).toBe("Fachinformatiker für Anwendungsentwicklung");
    expect(document.querySelector('[data-custom-role="supporting"]')?.textContent).toBe("IAD GmbH");
    expect(document.querySelector('[data-custom-role="metadata"]')?.textContent).toBe("07/2023 – 11/2025");
  });
  it("separates legacy body content from the main heading without inspecting title spelling", () => {
    const original = section();
    const snapshot = JSON.stringify(original);
    expect(normalizeCustomSection(original)).toMatchObject({ sectionType: "main-section", contentType: "text" });
    const { document } = parseHTML(renderCustomSectionContent(original));
    expect(document.querySelector("h3")).toBeNull();
    expect(document.querySelector("p")?.textContent).toBe("demo");
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(normalizeCustomSection({ ...original, title: "Projekt-Highlight" }).contentType).toBe("text");
  });
  it.each(resumeCustomContentTypes)("preserves %s through storage and renders every content field", contentType => {
    const value = section({ contentType, entries: [{ id: crypto.randomUUID(), title: "Bezeichnung", subtitle: "Organisation", from: "2020", to: "2024", location: "Berlin", url: "https://example.com", description: "Beschreibung", bullets: ["Ergebnis"] }] });
    const restored = JSON.parse(JSON.stringify(value));
    expect(normalizeCustomSection(restored).contentType).toBe(contentType);
    const html = renderCustomSectionContent(restored);
    for (const text of ["Bezeichnung", "Organisation", "2020", "2024", "Berlin", "https://example.com", "Beschreibung", "Ergebnis"]) expect(html).toContain(text);
    const { document } = parseHTML(html);
    expect(Boolean(document.querySelector("h3"))).toBe(["entries", "timeline"].includes(contentType));
    if (contentType === "timeline") expect(document.querySelectorAll("ol > li")).toHaveLength(1);
  });
  it("drops empty output entries and escapes user text", () => {
    expect(renderCustomSectionContent(section({ entries: [{ id: crypto.randomUUID(), title: "  ", bullets: [" "] }] }))).toBe("");
    const html = renderCustomSectionContent(section({ entries: [{ id: crypto.randomUUID(), title: "<script>alert(1)</script>", description: '<img src=x onerror="x">' }] }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
  it("recognizes legacy metadata as an entry", () => {
    expect(normalizeCustomSection(section({ entries: [{ id: crypto.randomUUID(), title: "Arbeit", subtitle: "Verein" }] })).contentType).toBe("entries");
  });
});
