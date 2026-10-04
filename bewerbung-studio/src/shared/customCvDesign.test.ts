import { describe, expect, it, vi } from "vitest";
import { applyCustomCvDesign, createCustomCvDesign, duplicateCustomCvDesign, updateCustomCvDesign } from "./customCvDesign";
import { defaultDocumentDesign } from "./documentDesign";
import type { DocumentDesignDraft } from "./documentEditorState";

const draft: DocumentDesignDraft = {
  applicationId: "10000000-0000-4000-8000-000000000001", templateId: "modern",
  accentColor: "#123456", secondaryColor: "#abcdef",
  settings: { ...defaultDocumentDesign, resumePresentation: { layoutMode: "two-column", sidebarSide: "right", sidebarWidthPercent: 30 } },
  templateDesigns: {},
};

describe("custom CV designs", () => {
  it("captures and reapplies the complete resolved editor state", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("20000000-0000-4000-8000-000000000001");
    const design = createCustomCvDesign("Mein Design", draft, "2026-09-29T10:00:00.000Z");
    const applied = applyCustomCvDesign(design, { ...draft, templateId: "klassisch", accentColor: "#000000" });
    expect(applied.templateId).toBe("modern");
    expect(applied.settings.resumePresentation?.sidebarWidthPercent).toBe(30);
    expect(applied.settings).not.toBe(design.settings);
  });

  it("updates, renames and duplicates without sharing identities", () => {
    const design = createCustomCvDesign("Erste Fassung", draft, "2026-09-29T10:00:00.000Z");
    const updated = updateCustomCvDesign(design, "Final", { ...draft, accentColor: "#654321" }, "2026-09-29T11:00:00.000Z");
    vi.spyOn(crypto, "randomUUID").mockReturnValue("30000000-0000-4000-8000-000000000001");
    const copy = duplicateCustomCvDesign(updated, "2026-09-29T12:00:00.000Z");
    expect(updated.name).toBe("Final");
    expect(updated.accentColor).toBe("#654321");
    expect(copy.name).toBe("Final (Kopie)");
    expect(copy.id).not.toBe(updated.id);
  });
});
