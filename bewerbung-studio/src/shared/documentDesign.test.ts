import { describe, expect, it } from "vitest";
import {
  getDocumentDesignVariables,
  letterFontSizeToPt,
  documentBackgrounds,
  programmingLanguageBackgroundTokens,
} from "./documentDesign";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { resolveEffectiveDesignTokens } from "./resumeDesignSystem";

describe("Dokumenthintergründe", () => {
  it("registers the programming-languages background as a printable technical option", () => {
    const background = documentBackgrounds.find(
      (item) => item.id === "programming-languages-bg",
    );

    expect(background).toMatchObject({
      name: "Programmiersprachen",
      category: "technical",
      previewType: "css",
      previewValue: "corner-cluster",
      supportsPrint: true,
      atsFriendly: false,
    });
    expect(programmingLanguageBackgroundTokens).toContain("Java");
    expect(programmingLanguageBackgroundTokens).toContain("C++");
    expect(programmingLanguageBackgroundTokens).toContain("Go");
    expect(programmingLanguageBackgroundTokens).toContain("PHP");
    expect(programmingLanguageBackgroundTokens).toHaveLength(14);
  });
});

describe("Anschreiben typography", () => {
  it.each(["small", "medium", "large"] as const)("uses a readable letter size for %s while keeping the CV linked to the shared size setting", (size) => {
    const defaults = getTemplateDocumentDesignDefaults("einspaltig");
    const settings = { ...defaults, fontSize: size };
    const variables = getDocumentDesignVariables(settings);
    expect(variables["--letter-body-size"]).toBe(`${letterFontSizeToPt[size]}pt`);
    expect(letterFontSizeToPt[size]).toBeGreaterThanOrEqual(10);
    expect(letterFontSizeToPt[size]).toBeLessThanOrEqual(12);
    if (size !== defaults.fontSize) {
      expect(resolveEffectiveDesignTokens("einspaltig", settings).typography.bodySizePt)
        .not.toBe(resolveEffectiveDesignTokens("einspaltig", defaults).typography.bodySizePt);
    }
    // Klassisch keeps its 11 pt Lebenslauf: the document-wide size belongs to the Anschreiben and the Deckblatt there.
    const klassisch = getTemplateDocumentDesignDefaults("klassisch");
    expect(resolveEffectiveDesignTokens("klassisch", { ...klassisch, fontSize: size }).typography.bodySizePt).toBe(11);
    expect(getDocumentDesignVariables({ ...klassisch, fontSize: size })["--letter-body-size"]).toBe(`${letterFontSizeToPt[size]}pt`);
  });
});
