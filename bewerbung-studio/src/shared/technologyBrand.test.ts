import { describe, expect, it } from "vitest";
import { getTechnologyBrandIconMarkup, resolveTechnologyIcon } from "./technologyBrand";

describe("technology brand icons", () => {
  it("renders branded marks for Go, JavaScript, and PHP", () => {
    const go = getTechnologyBrandIconMarkup("Golang");
    const javascript = getTechnologyBrandIconMarkup("JavaScript");
    const php = getTechnologyBrandIconMarkup("PHP");

    expect(go).toContain('data-brand="go"');
    expect(go).toContain("#00add8");
    expect(javascript).toContain('data-brand="javascript"');
    expect(javascript).toContain("#ffd92f");
    expect(php).toContain('data-brand="php"');
    expect(php).toContain("<ellipse");
    expect(new Set([go, javascript, php]).size).toBe(3);
  });

  it("uses dedicated icons for requested web technologies and frameworks", () => {
    const expectedBrands = {
      HTML: "html",
      CSS: "css",
      React: "react",
      TypeScript: "typescript",
      Java: "java",
      Framework: "framework",
    };

    for (const [technology, brand] of Object.entries(expectedBrands)) {
      expect(getTechnologyBrandIconMarkup(technology)).toContain(
        `data-brand="${brand}"`,
      );
    }
  });

  it("provides stable SVG marks for common programming languages", () => {
    const languages = [
      "Java",
      "JavaScript",
      "TypeScript",
      "Python",
      "PHP",
      "C#",
      "C++",
      "Go",
      "Rust",
      "Kotlin",
      "Swift",
      "Ruby",
      "SQL",
      "Bash",
      "PowerShell",
    ];

    for (const language of languages) {
      const first = getTechnologyBrandIconMarkup(language);
      expect(first).toContain('class="technology-brand-svg"');
      expect(getTechnologyBrandIconMarkup(language)).toBe(first);
    }
  });

  it.each([
    ["Golang", "Go", "go"], ["Java", "Java", "java"], ["JS", "JavaScript", "javascript"],
    ["TypeScript (TS)", "TypeScript", "typescript"], ["ReactJS", "React", "react"],
    ["Spring Boot", "Spring", "devicon:spring"], ["Python 3", "Python", "python"],
    ["PHP 8", "PHP", "php"], ["Docker Compose", "Docker", "devicon:docker"],
    ["Git", "Git", "devicon:git"], ["Git Hub", "GitHub", "devicon:github"],
  ])("resolves %s through the shared alias map", (alias, canonical, brand) => {
    expect(resolveTechnologyIcon(alias).source).toBe("auto");
    expect(getTechnologyBrandIconMarkup(alias)).toBe(getTechnologyBrandIconMarkup(canonical));
    expect(getTechnologyBrandIconMarkup(alias)).toContain(`data-brand="${brand}"`);
  });

  it("keeps a valid manual icon ahead of automatic detection and falls back safely", () => {
    expect(resolveTechnologyIcon("Go", "symbol:check")).toMatchObject({ source: "manual" });
    expect(resolveTechnologyIcon("Go", "symbol:check").markup).toContain('data-strength-symbol="symbol:check"');
    expect(resolveTechnologyIcon("Unknown skill", "react").markup).toContain('data-brand="devicon:react"');
    expect(resolveTechnologyIcon("Go", "invalid-icon").source).toBe("auto");
    const fallback = resolveTechnologyIcon('<script>', "invalid-icon");
    expect(fallback.source).toBe("fallback");
    expect(fallback.markup).not.toContain("<script>");
    expect(fallback.markup).toContain("&lt;SC");
  });
});
