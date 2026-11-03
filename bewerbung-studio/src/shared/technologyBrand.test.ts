import { describe, expect, it } from "vitest";
import { categorySymbolOptions, getStrengthSymbolMarkup } from "./strengthSymbols";
import {
  getDeckblattTechnologyIconMarkup, getTechnologyBrandIconMarkup, getThemedTechnologyIconMarkup, normalizeTechnologyName, resolveDeckblattTechnologyIcon, resolveTechnologyIcon,
} from "./technologyBrand";
import { goFrameworkIconOptions } from "./goFrameworkIcons";
import { deviconOptions, getOriginalDeviconMarkup } from "./deviconCatalog";
import { getAutomaticMaterialIconId, getMaterialIconMarkup } from "./materialIconCatalog";

const automaticBrand = (name: string, oldBrand: string) => getAutomaticMaterialIconId(normalizeTechnologyName(name)) ?? oldBrand;

describe("technology brand icons", () => {
  it("recognizes the five Go frameworks and keeps their marks in the PDF and preview resolver", () => {
    const names = ["Echo", "Fiber", "Chi", "Buffalo", "Gin Web Framework"];
    const brands = ["echo", "devicon:fiber", "chi", "buffalo", "gin"];
    for (const [index, name] of names.entries()) {
      const automatic = resolveTechnologyIcon(name);
      expect(automatic.source, name).toBe("auto");
      expect(automatic.markup, name).toContain(`data-brand="${brands[index]}"`);
      expect(automatic.markup, name).toContain('class="technology-brand-svg"');
      expect(automatic.markup, name).not.toMatch(/<script|<foreignObject|<image|\son\w+=|href=|url\(/i);
      expect(getTechnologyBrandIconMarkup(name, goFrameworkIconOptions[index]!.id), name)
        .toBe(automatic.markup);
      expect(getTechnologyBrandIconMarkup("Go", goFrameworkIconOptions[index]!.id), name)
        .toBe(automatic.markup);
      expect(getThemedTechnologyIconMarkup(name), name).toContain(`data-brand="${brands[index]}"`);
    }
    expect(new Set(names.map((name) => getTechnologyBrandIconMarkup(name))).size).toBe(5);
    expect(resolveTechnologyIcon("Go Fiber").markup).toBe(getTechnologyBrandIconMarkup("Fiber"));
    expect(resolveTechnologyIcon("Go-Chi").markup).toBe(getTechnologyBrandIconMarkup("Chi"));
    expect(resolveTechnologyIcon("Gin", "symbol:check").source).toBe("manual");
    expect(resolveTechnologyIcon("Go Framework").markup).toContain('data-brand="framework"');
  });

  it("covers the remaining named Go tools without treating documentation pages as separate products", () => {
    const products = [
      ["Fyne", "fyne"], ["HUGO", "devicon:hugo"], ["Gorilla, the golang web toolkit", "gorilla"],
      ["Beego", "beego"], ["Revel - Go Web Framework", "revel"],
      ["Go kit - A toolkit for microservices", "gokit"], ["krakend", "krakend"],
      ["Fx", "fx"], ["goa.design", "goa"], ["Iris Web Framework", "iris"],
      ["Flamingo Documentations", "flamingo"],
    ] as const;
    expect(goFrameworkIconOptions).toHaveLength(16);
    for (const [index, [name, brand]] of products.entries()) {
      const automatic = resolveTechnologyIcon(name);
      expect(automatic.source, name).toBe("auto");
      expect(automatic.markup, name).toContain(`data-brand="${brand}"`);
      expect(automatic.markup, name).not.toMatch(/<script|<foreignObject|<image|\son\w+=|href=|url\(/i);
      expect(getTechnologyBrandIconMarkup("Go", goFrameworkIconOptions[index + 5]!.id), name)
        .toBe(automatic.markup);
    }
    expect(getTechnologyBrandIconMarkup("chi 👋 Introduction")).toBe(getTechnologyBrandIconMarkup("Chi"));
    expect(new Set(goFrameworkIconOptions.map(({ id }) => getTechnologyBrandIconMarkup("Go", id))).size).toBe(16);
  });

  it("renders branded marks for Go, JavaScript, and PHP", () => {
    const go = getTechnologyBrandIconMarkup("Golang");
    const javascript = getTechnologyBrandIconMarkup("JavaScript");
    const php = getTechnologyBrandIconMarkup("PHP");

    expect(go).toContain('data-brand="material:file:go"');
    expect(javascript).toContain('data-brand="material:file:javascript"');
    expect(php).toContain('data-brand="material:file:php"');
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
        `data-brand="${automaticBrand(technology, brand)}"`,
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
    ["ASP.NET", "aspnet"], ["ASP.NET Core", "aspnet"],
    ["Blazor", "devicon:blazor"], ["Blazor WebAssembly", "devicon:blazor"],
    ["C#", "devicon:csharp"], ["C Sharp", "devicon:csharp"],
    [".NET", "dotnet"], [".NET Core", "devicon:dotnetcore"],
    ["F#", "devicon:fsharp"], ["VB.NET", "devicon:visualbasic"],
    ["EF Core", "devicon:entityframeworkcore"],
    ["NuGet", "devicon:nuget"], ["Xamarin", "devicon:xamarin"],
  ])("uses the sourced .NET family logo for %s", (name, brand) => {
    const result = resolveTechnologyIcon(name);
    expect(result.source).toBe("auto");
    expect(result.markup).toContain(`data-brand="${automaticBrand(name, brand)}"`);
    expect(result.markup).not.toContain("<text ");
    expect(getThemedTechnologyIconMarkup(name)).toContain("currentColor");
    expect(result.markup).not.toContain("<image");
  });

  it("keeps a manually selected .NET family icon ahead of the title", () => {
    const chosen = resolveTechnologyIcon("ASP.NET", "blazor");
    expect(chosen.source).toBe("manual");
    expect(chosen.markup).toContain('data-brand="devicon:blazor"');
    expect(getThemedTechnologyIconMarkup("ASP.NET")).toContain("currentColor");
  });

  it("uses the central icon colour for Angular in automatic and manual selection", () => {
    const automatic = resolveTechnologyIcon("Angular");
    expect(automatic.source).toBe("auto");
    expect(automatic.markup).toContain('data-brand="material:file:angular"');
    expect(resolveTechnologyIcon("Other", "angular").markup).toContain('data-brand="devicon:angular"');
    expect(getThemedTechnologyIconMarkup("Angular")).toContain("currentColor");
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
    expect(getTechnologyBrandIconMarkup(alias)).toContain(`data-brand="${automaticBrand(canonical, brand)}"`);
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

  it("draws the fourteen category symbols as distinct, static 32×32 marks in the template's icon colour", () => {
    expect(categorySymbolOptions.map((option) => option.id)).toEqual([
      "symbol:api", "symbol:backend", "symbol:frontend", "symbol:database", "symbol:monitoring",
      "symbol:ci", "symbol:cd", "symbol:test", "symbol:cloud", "symbol:devops",
      "symbol:linux-shell", "symbol:powershell", "symbol:gpo", "symbol:active-directory",
    ]);
    const marks = categorySymbolOptions.map((option) => getStrengthSymbolMarkup(option.id));
    expect(new Set(marks).size).toBe(14);
    expect(new Set(categorySymbolOptions.map((option) => option.shape)).size).toBe(14);
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
    ["DevOps", "symbol:devops"], ["Dev-Ops", "symbol:devops"], ["DevSecOps", "symbol:devops"],
    ["Linux Shell", "symbol:linux-shell"], ["Linux-Shell", "symbol:linux-shell"], ["Bash", "symbol:linux-shell"], ["Shell", "symbol:linux-shell"],
    ["Zsh", "symbol:linux-shell"], ["Shell-Scripting", "symbol:linux-shell"], ["Terminal", "symbol:linux-shell"], ["CLI", "symbol:linux-shell"],
    ["Kommandozeile", "symbol:linux-shell"],
    ["PowerShell", "symbol:powershell"], ["Power Shell", "symbol:powershell"], ["Windows PowerShell", "symbol:powershell"],
    ["PowerShell-Skripting", "symbol:powershell"], ["pwsh", "symbol:powershell"],
    ["GPO", "symbol:gpo"], ["GPOs", "symbol:gpo"], ["Gruppenrichtlinien", "symbol:gpo"], ["Gruppenrichtlinien (GPO)", "symbol:gpo"],
    ["Group Policy", "symbol:gpo"],
    ["Active Directory", "symbol:active-directory"], ["Active Directory (AD)", "symbol:active-directory"], ["AD", "symbol:active-directory"],
    ["AD DS", "symbol:active-directory"], ["Verzeichnisdienst", "symbol:active-directory"],
  ])("detects the category of %s without a saved icon", (title, symbol) => {
    const materialId = getAutomaticMaterialIconId(normalizeTechnologyName(title));
    expect(resolveTechnologyIcon(title)).toEqual({ source: "auto", markup: materialId ? getMaterialIconMarkup(materialId) : getStrengthSymbolMarkup(symbol) });
    expect(resolveTechnologyIcon(title, "")).toEqual(resolveTechnologyIcon(title));
  });

  it("keeps brand marks: categories match whole names only, never a part of them", () => {
    const brands = {
      Go: "go", React: "react", Docker: "devicon:docker", Grafana: "devicon:grafana", Prometheus: "devicon:prometheus",
      Jenkins: "devicon:jenkins", "GitHub Actions": "devicon:githubactions", "Google Cloud": "devicon:googlecloud", "Azure DevOps": "devicon:azuredevops", SQL: "generic",
      Linux: "devicon:linux", Ubuntu: "devicon:ubuntu",
    };
    for (const [technology, brand] of Object.entries(brands)) {
      const markup = getTechnologyBrandIconMarkup(technology);
      expect(markup, technology).toContain(`data-brand="${automaticBrand(technology, brand)}"`);
      expect(markup, technology).not.toContain("data-strength-symbol");
    }
    for (const title of ["React Testing Library", "Cloudflare Workers", "Datenbankadministrator mit Go", "Continuous Learning", "Linux-Administration", "Azure AD Connect"])
      expect(resolveTechnologyIcon(title).markup, title).not.toContain("data-strength-symbol");
  });

  it("never overrides a saved choice with a category, and a chosen category beats the brand", () => {
    expect(resolveTechnologyIcon("Datenbank", "symbol:check")).toEqual({ source: "manual", markup: getStrengthSymbolMarkup("symbol:check") });
    expect(resolveTechnologyIcon("Cloud", "react").markup).toContain('data-brand="devicon:react"');
    expect(resolveTechnologyIcon("Go", "symbol:cloud")).toEqual({ source: "manual", markup: getStrengthSymbolMarkup("symbol:cloud") });
    expect(resolveTechnologyIcon("Monitoring", "symbol:unbekannt")).toEqual({ source: "auto", markup: getStrengthSymbolMarkup("symbol:monitoring") });
  });
});

describe("Deckblatt technology icons in their brand colours", () => {
  const unsafe = /<script|<foreignObject|<image|\son\w+=|javascript:/i;

  it("defaults to Material Angular while an old manual Devicon keeps its published colours", () => {
    const deckblatt = resolveDeckblattTechnologyIcon("Angular");
    expect(deckblatt.source).toBe("auto");
    expect(deckblatt.markup).toContain('data-brand="material:file:angular"');
    expect(deckblatt.markup).not.toContain("currentColor");
    const legacy = resolveDeckblattTechnologyIcon("Frontend-Framework", "angular");
    expect(legacy.source).toBe("manual");
    expect(legacy.markup).toContain('data-brand="devicon:angular"');
    expect(legacy.markup).toContain('<stop offset="0" stop-color="#e40035"/>');
    expect(legacy.markup).toContain('<path fill="url(#devicon-original-angular-a)"');
    expect(getThemedTechnologyIconMarkup("Angular")).toContain("currentColor");
  });

  it.each([
    ["JavaScript", "javascript", "#ffd92f"], ["React", "react", "#61dafb"], ["TypeScript", "typescript", "#3178c6"],
    ["Golang", "go", "#00add8"], ["Java", "java", "#e76f00"], ["HTML", "html", "#e44d26"],
  ])("keeps the already coloured mark of %s", (name, brand, color) => {
    const markup = getDeckblattTechnologyIconMarkup(name);
    expect(markup).toBe(getTechnologyBrandIconMarkup(name));
    expect(markup).toContain(`data-brand="${automaticBrand(name, brand)}"`);
    if (getAutomaticMaterialIconId(normalizeTechnologyName(name))) expect(markup).toBe(getMaterialIconMarkup(automaticBrand(name, brand)));
    else expect(markup).toContain(color);
    expect(markup).not.toContain("currentColor");
  });

  it.each([
    ["Docker", "devicon:docker", "#019BC6"], ["Git", "devicon:git", "#F34F29"], ["Spring Boot", "devicon:spring", "#77bc1f"],
    ["Python", "devicon:python", "#FFD43B"], ["Electron", "devicon:electron", "#47848f"], ["C++", "devicon:cplusplus", "#00599c"],
    ["Kotlin", "devicon:kotlin", "#7f52ff"], ["C#", "devicon:csharp", "#9B4F96"], ["Blazor", "devicon:blazor", "#5c2d91"],
    [".NET Core", "devicon:dotnetcore", "#623697"], ["F#", "devicon:fsharp", "#378BBA"], ["VB.NET", "devicon:visualbasic", "#004e8c"],
    ["EF Core", "devicon:entityframeworkcore", "#512bd4"], ["Xamarin", "devicon:xamarin", "#3498DB"], [".NET", "dotnet", "#512bd4"],
  ])("draws %s in its published colours", (name, brand, color) => {
    const result = resolveDeckblattTechnologyIcon(name, brand.startsWith("devicon:") ? brand.slice(8) : brand);
    expect(result.source).toBe("manual");
    expect(result.markup).toMatch(/^<svg class="technology-brand-svg" data-brand="/);
    expect(result.markup).toContain(`data-brand="${brand}"`);
    expect(result.markup).toContain(color);
    expect(result.markup).not.toContain("currentColor");
    expect(result.markup).not.toMatch(unsafe);
    for (const id of result.markup.match(/\bid="([^"]+)"/g) ?? []) expect(id).toMatch(/^id="devicon-original-/);
  });

  it("leaves category symbols, Aufzählungszeichen, unbranded marks and the fallback exactly as in the Lebenslauf", () => {
    for (const [name, icon] of [
      ["API", ""], ["Datenbank", ""], ["Backend", ""], ["CI/CD", ""], ["Bash", ""], ["PowerShell", ""], ["Go", "symbol:cloud"],
      ["Docker", "symbol:check"], ["SQL", ""], ["ASP.NET", ""], ["Go kit", ""], ["Objective-C", ""], ["Unbekannt", ""], ["<b>", "invalid"],
    ]) {
      expect(resolveDeckblattTechnologyIcon(name!, icon), name).toEqual(resolveTechnologyIcon(name!, icon));
    }
    expect(getDeckblattTechnologyIconMarkup("Go", "symbol:cloud")).toBe(getStrengthSymbolMarkup("symbol:cloud"));
    expect(getDeckblattTechnologyIconMarkup("Docker", "symbol:check")).toContain('style="color:inherit"');
  });

  it("prepares every original Devicon logo safely, with its own ids", () => {
    const originals = deviconOptions.map(({ id }) => [id, getOriginalDeviconMarkup(id)] as const).filter(([, markup]) => markup);
    expect(originals.length).toBeGreaterThan(400);
    for (const [id, markup] of originals) {
      expect(markup, id).toMatch(/^<svg class="technology-brand-svg" data-brand="/);
      expect(markup, id).not.toMatch(/<\?xml|<!--/);
      expect(markup, id).not.toMatch(unsafe);
      for (const [, name] of markup!.matchAll(/\bid="([^"]+)"/g)) {
        expect(name, id).toMatch(new RegExp(`^devicon-original-${id}-`));
        expect(markup, id).not.toMatch(new RegExp(`url\\(#${name!.slice(`devicon-original-${id}-`.length)}\\)`));
      }
    }
    expect(getOriginalDeviconMarkup("aspnet")).toBeUndefined();
    expect(getOriginalDeviconMarkup(" Angular ")).toBe(getOriginalDeviconMarkup("angular"));
  });
});
