import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { anschreibenPrintCss, extractAnschreibenPreviewRules } from "./anschreibenPrintCss";
import { anschreibenPreviewRules } from "./anschreibenPreviewRules";

const generatedFile = resolve(__dirname, "anschreibenPreviewRules.ts");
const generatedSource = (rules: string) =>
  "// Generated from src/app.css by anschreibenPrintCss.test.ts (UPDATE_ANSCHREIBEN_CSS=1). Do not edit by hand.\n"
  + `export const anschreibenPreviewRules = ${JSON.stringify(rules)};\n`;

describe("Anschreiben PDF stylesheet", () => {
  it("is exactly the preview's letter rules of app.css", () => {
    const current = extractAnschreibenPreviewRules(readFileSync(resolve(__dirname, "../src/app.css"), "utf8"));
    if (process.env.UPDATE_ANSCHREIBEN_CSS === "1" && current !== anschreibenPreviewRules) writeFileSync(generatedFile, generatedSource(current));
    // When this fails, the preview's letter rules changed: rerun with UPDATE_ANSCHREIBEN_CSS=1 so the PDF follows.
    expect(anschreibenPreviewRules).toBe(current);
  });

  it("keeps the rules that place the Betreff and the letter's text area", () => {
    const css = anschreibenPrintCss();
    expect(css).toContain(".document-anschreiben.letter-gap-4 .letter-preview .paper-date{margin-bottom:4mm}");
    expect(css).toContain(".document-anschreiben.letter-dense.letter-gap-4 .letter-preview .paper-date{margin-bottom:0}");
    expect(css).toMatch(/\.document-anschreiben \.letter-preview\{[^}]*transform-origin:top left/);
    // Only top-level rules: nothing of the app's narrow-window or print views.
    expect(css).not.toMatch(/zoom:0\.(78|48)/);
  });
});
