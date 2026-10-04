import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { interestEntryText, renderCustomSectionContent } from "../../shared/resumeCustomSections";
import { InterestsEditor } from "./InterestsEditor";

const now = "2026-10-02T10:00:00.000Z";
const source = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
  specialSections: [{ id: crypto.randomUUID(), kind: "interests", title: "Freizeitaktivitäten", isVisible: true,
    contentType: "text", entries: [{ id: crypto.randomUUID(), title: "Fotografie", description: "Architektur und Landschaft" }] },
    { id: crypto.randomUUID(), kind: "interests", title: "Alte Interessen", isVisible: true,
      entries: [{ id: crypto.randomUUID(), description: "Schach" }] }],
});

describe("interests profile editor", () => {
  it("edits the canonical section and leaves duplicate legacy sections visible for recovery", () => {
    const { document } = parseHTML(`<html><body>${renderToStaticMarkup(<InterestsEditor profile={source} onChange={() => undefined} />)}</body></html>`);
    expect(document.querySelector('input[list="interest-title-suggestions"]')?.getAttribute("value")).toBe("Freizeitaktivitäten");
    expect(document.body.textContent).toContain("Fotografie");
    expect(document.body.textContent).toContain("Architektur und Landschaft");
    expect(document.body.textContent).toContain("Weitere ältere Interessen-Bereiche");
    expect(document.body.textContent).toContain("Interesse hinzufügen");
    expect(document.querySelectorAll(".special-entry-card")).toHaveLength(1);
  });
  it("keeps title and description in shared output and ignores blank entries", () => {
    const section = source.specialSections[0];
    expect(interestEntryText(section.entries[0])).toBe("Fotografie – Architektur und Landschaft");
    const { document } = parseHTML(`<html><body>${renderCustomSectionContent(section)}</body></html>`);
    expect(document.body.textContent).toContain("Fotografie");
    expect(document.body.textContent).toContain("Architektur und Landschaft");
    expect(renderCustomSectionContent({ ...section, entries: [{ ...section.entries[0], title: " ", description: " " }] })).toBe("");
  });
});
