import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeLanguageLevel } from "./language-levels";

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [join(dir, entry.name)] : []);

describe("Sprachen: every template asks the shared resolver", () => {
  const templates = sourceFiles("src/components/resume/templates");
  const output = [...templates, "electron/documents.ts", "src/shared/resumeManagedOutput.ts", "src/views/DocumentsView.tsx"];

  it("keeps no template-local bracketing, level parsing or raw stored language text", () => {
    for (const file of output) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file}: bracket format`).not.toMatch(/bracketLanguageLevel|languageLevelText\(/);
      // the stored "Name – Niveau" text is split by the resolver only
      expect(source, `${file}: local split`).not.toMatch(/raw\.split\(\s*\/\\s\+/);
      expect(source, `${file}: raw language`).not.toMatch(/<li key=\{language\}>\{language\}<\/li>|<p>\{language\.raw\}<\/p>|<li>\$\{escapeHtml\(language\.raw\)\}<\/li>/);
      expect(source, `${file}: fixed dots`).not.toContain("●●●●○");
    }
  });
});

describe("describeLanguageLevel", () => {
  it("gives the words of a level and nothing else", () => {
    expect(describeLanguageLevel("C1")).toBe("Verhandlungssicher");
    expect(describeLanguageLevel("C1 (Verhandlungssicher)")).toBe("Verhandlungssicher");
    expect(describeLanguageLevel("A2")).toBe("Grundlegende Kenntnisse");
    expect(describeLanguageLevel("Muttersprache")).toBe("Muttersprache");
    expect(describeLanguageLevel("C2 (Muttersprache)")).toBe("Muttersprache");
    expect(describeLanguageLevel("gute Kenntnisse")).toBe("gute Kenntnisse");
    expect(describeLanguageLevel("  ")).toBe("");
  });
});
