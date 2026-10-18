import { describe, expect, it } from "vitest";
import { categorySymbolOptions, getStrengthSymbolMarkup } from "./strengthSymbols";
import { getTechnologyBrandIconMarkup, getThemedTechnologyIconMarkup, resolveTechnologyIcon } from "./technologyBrand";

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

  it("draws the nine category symbols as distinct, static 32×32 marks in the template's icon colour", () => {
    expect(categorySymbolOptions.map((option) => option.id)).toEqual([
      "symbol:api", "symbol:backend", "symbol:frontend", "symbol:database", "symbol:monitoring",
      "symbol:ci", "symbol:cd", "symbol:test", "symbol:cloud",
    ]);
    const marks = categorySymbolOptions.map((option) => getStrengthSymbolMarkup(option.id));
    expect(new Set(marks).size).toBe(9);
    expect(new Set(categorySymbolOptions.map((option) => option.shape)).size).toBe(9);
    for (const [index, markup] of marks.entries()) {
      expect(markup).toContain(`data-strength-symbol="${categorySymbolOptions[index]!.id}"`);
      expect(markup).toContain('viewBox="0 0 32 32" fill="none" stroke="currentColor"');
      // Unlike the Aufzählungszeichen they do not force the text colour, so they look like the other technology marks.
      expect(markup).not.toContain("color:inherit");
      expect(markup).not.toMatch(/<script|<foreignObject|<image|\son\w+=|href=|url\(|#[0-9a-f]{3,6}/i);
      // Stroke-only: a template that recolours the stroke reaches the whole mark.
      expect(markup).not.toMatch(/fill="(?!none")/);
      expect(getThemedTechnologyIconMarkup("X", categorySymbolOptions[index]!.id)).toBe(markup);
    }
  });

  it.each([
    ["API", "symbol:api"], ["REST-API", "symbol:api"], ["apis", "symbol:api"],
    ["Backend", "symbol:backend"], ["Back-End", "symbol:backend"], ["Backend-Entwicklung", "symbol:backend"],
    ["Frontend", "symbol:frontend"], ["front end", "symbol:frontend"],
    ["Datenbank", "symbol:database"], ["DATENBANKEN", "symbol:database"], ["Database", "symbol:database"],
    ["Monitoring", "symbol:monitoring"], ["Observability", "symbol:monitoring"], ["Monitoring & Logging", "symbol:monitoring"],
    ["CI", "symbol:ci"], ["Continuous Integration", "symbol:ci"],
    ["CI/CD", "symbol:ci"], ["ci / cd", "symbol:ci"], ["CI-CD", "symbol:ci"], ["CICD", "symbol:ci"], ["CI/CD-Pipelines", "symbol:ci"],
    ["CD", "symbol:cd"], ["Continuous Deployment", "symbol:cd"], ["Continuous Delivery", "symbol:cd"],
    ["Test", "symbol:test"], ["Tests", "symbol:test"], ["Testing", "symbol:test"], ["  testing  ", "symbol:test"], ["Testautomatisierung", "symbol:test"],
    ["Cloud", "symbol:cloud"], ["Cloud Computing", "symbol:cloud"], ["cloud-native", "symbol:cloud"],
  ])("detects the category of %s without a saved icon", (title, symbol) => {
    expect(resolveTechnologyIcon(title)).toEqual({ source: "auto", markup: getStrengthSymbolMarkup(symbol) });
    expect(resolveTechnologyIcon(title, "")).toEqual(resolveTechnologyIcon(title));
  });

  it("keeps brand marks: categories match whole names only, never a part of them", () => {
    const brands = {
      Go: "go", React: "react", Docker: "devicon:docker", Grafana: "devicon:grafana", Prometheus: "devicon:prometheus",
      Jenkins: "devicon:jenkins", "GitHub Actions": "devicon:githubactions", "Google Cloud": "devicon:googlecloud", SQL: "generic",
    };
    for (const [technology, brand] of Object.entries(brands)) {
      const markup = getTechnologyBrandIconMarkup(technology);
      expect(markup, technology).toContain(`data-brand="${brand}"`);
      expect(markup, technology).not.toContain("data-strength-symbol");
    }
    for (const title of ["React Testing Library", "Cloudflare Workers", "Datenbankadministrator mit Go", "Continuous Learning"])
      expect(resolveTechnologyIcon(title).markup, title).not.toContain("data-strength-symbol");
  });

  it("never overrides a saved choice with a category, and a chosen category beats the brand", () => {
    expect(resolveTechnologyIcon("Datenbank", "symbol:check")).toEqual({ source: "manual", markup: getStrengthSymbolMarkup("symbol:check") });
    expect(resolveTechnologyIcon("Cloud", "react").markup).toContain('data-brand="devicon:react"');
    expect(resolveTechnologyIcon("Go", "symbol:cloud")).toEqual({ source: "manual", markup: getStrengthSymbolMarkup("symbol:cloud") });
    expect(resolveTechnologyIcon("Monitoring", "symbol:unbekannt")).toEqual({ source: "auto", markup: getStrengthSymbolMarkup("symbol:monitoring") });
  });
});
