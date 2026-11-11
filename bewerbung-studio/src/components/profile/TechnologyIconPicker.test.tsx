import { act, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profileSchema } from "../../shared/schema";
import { categorySymbolOptions, getStrengthSymbolMarkup } from "../../shared/strengthSymbols";
import { getTechnologyBrandIconMarkup } from "../../shared/technologyBrand";
import { dotnetIconOptions } from "../../shared/deviconCatalog";
import { goFrameworkIconOptions } from "../../shared/goFrameworkIcons";
import { filterCatalogIcons, TechnologyIconPicker } from "./TechnologyIconPicker";

const categoryLabels = [
  "API", "Backend", "Frontend", "Datenbank", "Monitoring", "CI (Continuous Integration)", "CD (Continuous Deployment)", "Test", "Cloud", "DevOps",
  "Linux Shell", "PowerShell", "GPO (Gruppenrichtlinien)", "Active Directory",
];
const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const categoryButtons = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('[aria-label="Kategorie-Symbole"] button'));
const preview = (root: ParentNode) => root.querySelector(".technology-icon-picker__preview svg");

describe("TechnologyIconPicker category symbols", () => {
  it("lists sourced .NET family icons and previews ASP.NET", () => {
    const document = dom(renderToStaticMarkup(<TechnologyIconPicker technologyTitle="ASP.NET" value="" onChange={vi.fn()} />));
    const group = Array.from(document.querySelectorAll("optgroup"))
      .find((entry) => entry.getAttribute("label") === "C# / .NET")!;
    expect(dotnetIconOptions.map((option) => option.id)).toEqual([
      "aspnet", "blazor", "csharp", "dotnet", "dotnetcore",
      "entityframeworkcore", "fsharp", "nuget", "visualbasic", "xamarin",
    ]);
    expect(Array.from(group.querySelectorAll("option"), (option) => option.getAttribute("value")))
      .toEqual(dotnetIconOptions.map((option) => option.id));
    expect(dotnetIconOptions.map((option) => option.label)).toContain("ASP.NET");
    expect(dotnetIconOptions.map((option) => option.label)).toContain("C#");
    expect(preview(document)?.getAttribute("data-brand")).toBe("aspnet");
  });

  it("offers the Go frameworks for manual selection and previews their own icons automatically", () => {
    const document = dom(renderToStaticMarkup(<TechnologyIconPicker technologyTitle="Gin" value="" onChange={vi.fn()} />));
    const group = Array.from(document.querySelectorAll("optgroup"))
      .find((entry) => entry.getAttribute("label") === "Go-Frameworks und Tools")!;
    expect(Array.from(group.querySelectorAll("option"), (option) => option.getAttribute("value")))
      .toEqual(goFrameworkIconOptions.map((option) => option.id));
    expect(preview(document)?.getAttribute("data-brand")).toBe("gin");
    const selected = dom(renderToStaticMarkup(<TechnologyIconPicker technologyTitle="Go" value="go-framework:gin" onChange={vi.fn()} />));
    expect(preview(selected)?.getAttribute("data-brand")).toBe("gin");
  });

  it("offers the nine categories as labelled, keyboard-reachable buttons that show their icon", () => {
    const document = dom(renderToStaticMarkup(<TechnologyIconPicker technologyTitle="Datenbank" value="symbol:database" onChange={vi.fn()} />));
    const buttons = categoryButtons(document);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(categoryLabels);
    for (const [index, button] of buttons.entries()) {
      expect(button.getAttribute("type")).toBe("button");
      expect(button.hasAttribute("tabindex")).toBe(false);
      expect(button.getAttribute("title")).toBe(categoryLabels[index]);
      expect(button.innerHTML.replaceAll(" />", "/>")).toBe(getStrengthSymbolMarkup(categorySymbolOptions[index]!.id));
    }
    expect(buttons.filter((button) => button.getAttribute("aria-pressed") === "true").map((button) => button.getAttribute("aria-label")))
      .toEqual(["Datenbank"]);
    const group = Array.from(document.querySelectorAll("optgroup")).find((entry) => entry.getAttribute("label") === "Kategorie-Symbole")!;
    expect(Array.from(group.querySelectorAll("option"), (option) => option.getAttribute("value")))
      .toEqual(categorySymbolOptions.map((option) => option.id));
  });

  it("shows the detected category while no icon is saved", () => {
    const document = dom(renderToStaticMarkup(<TechnologyIconPicker technologyTitle="Cloud" value="" onChange={vi.fn()} />));
    expect(preview(document)?.getAttribute("data-strength-symbol")).toBe("symbol:cloud");
    expect(categoryButtons(document).some((button) => button.getAttribute("aria-pressed") === "true")).toBe(false);
  });
});

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});

describe("TechnologyIconPicker in a real React tree", () => {
  it("combines source, kind and search filters without replacing a saved choice", async () => {
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(window.document.getElementById("root")!);
    const saved: string[] = [];
    function Harness() {
      const [value, setValue] = useState("vscode:folder:api");
      return <TechnologyIconPicker technologyTitle="API" value={value} onChange={(next) => { saved.push(next); setValue(next); }} />;
    }
    await act(async () => { root.render(<Harness />); });
    const groupButton = (group: string, label: string) => Array.from(window.document.querySelectorAll<HTMLButtonElement>(`[aria-label="${group}"] button`))
      .find((button) => button.textContent === label)!;
    await act(async () => { groupButton("Icon-Quelle", "Material Icon Theme").click(); });
    expect(saved).toEqual([]);
    expect(preview(window.document)?.getAttribute("data-brand")).toBe("vscode:folder:api");
    await act(async () => { groupButton("Icon-Typ", "Ordner-Icons").click(); });
    const materialApi = window.document.querySelector<HTMLButtonElement>('[aria-label="folder-api, Material Icon Theme, Ordner-Icon"]');
    expect(materialApi).not.toBeNull();
    await act(async () => { materialApi?.click(); });
    expect(saved).toEqual(["material:folder:folder-api"]);
    await act(async () => { groupButton("Icon-Quelle", "vscode-icons").click(); });
    const vscodeApi = window.document.querySelector<HTMLButtonElement>('[aria-label="api, vscode-icons, Ordner-Icon"]');
    expect(vscodeApi?.disabled).toBe(false);
    expect(saved).toEqual(["material:folder:folder-api"]);
    await act(async () => { vscodeApi?.click(); });
    expect(saved).toEqual(["material:folder:folder-api", "vscode:folder:api"]);
    expect(Array.from(window.document.querySelectorAll(".technology-icon-picker__preview svg"), (svg) => svg.getAttribute("data-brand")))
      .toEqual(["vscode:folder:api", "vscode:folder:api"]);
    for (const iconId of saved) {
      const reopened = profileSchema.parse(JSON.parse(JSON.stringify(profileSchema.parse({
        id: crypto.randomUUID(), firstName: "Mina", lastName: "Kaya", isDefault: true, updatedAt: new Date().toISOString(),
        strengths: [{ id: crypto.randomUUID(), title: "API", iconId }],
      }))));
      expect(reopened.strengths[0]!.iconId).toBe(iconId);
      expect(getTechnologyBrandIconMarkup("API", iconId)).toContain(`data-brand="${iconId}"`);
    }
    await act(async () => root.unmount());
  });

  it("prefers one exact catalog name within the active source and kind", () => {
    expect(filterCatalogIcons(" Java ", "all", "all").map((entry) => entry.id))
      .toEqual(["material:file:java"]);
    expect(filterCatalogIcons("java", "material", "all").map((entry) => entry.id))
      .toEqual(["material:file:java"]);
    expect(filterCatalogIcons("java", "vscode", "all").map((entry) => entry.id))
      .toEqual(["vscode:file:java"]);
    expect(filterCatalogIcons("java", "material", "folder").map((entry) => entry.id))
      .toEqual(["material:folder:folder-java"]);
    expect(filterCatalogIcons("typescript", "all", "all").map((entry) => entry.id))
      .toEqual(["material:file:typescript"]);
    expect(filterCatalogIcons("javascript", "all", "file").filter((entry) => entry.available)
      .map((entry) => entry.id)).toEqual(["material:file:javascript"]);
    expect(filterCatalogIcons("javascript", "vscode", "file").map((entry) => entry.id))
      .toEqual(["vscode:file:js"]);
    expect(filterCatalogIcons("javascript", "material", "folder").map((entry) => entry.id))
      .toEqual(["material:folder:folder-javascript"]);
    expect(filterCatalogIcons("folder-java", "all", "all").map((entry) => entry.id))
      .toEqual(["material:folder:folder-java"]);
    expect(filterCatalogIcons("javacla", "all", "file").map((entry) => entry.id))
      .toContain("material:file:javaclass");
    expect(filterCatalogIcons("not-existing-icon", "all", "all")).toEqual([]);
  });

  it("initializes and refreshes the query from the Stärke while preserving manual search across source tabs", async () => {
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(window.document.getElementById("root")!);
    const render = async (title: string) => act(async () => {
      root.render(<TechnologyIconPicker technologyTitle={title} value="" onChange={vi.fn()} />);
    });
    const search = () => window.document.querySelector<HTMLInputElement>('[aria-label="Icons durchsuchen"]')!;
    const results = () => Array.from(window.document.querySelectorAll<HTMLButtonElement>('[aria-label="Icon-Katalog"] button'),
      (button) => button.getAttribute("aria-label"));
    const source = (label: string) => Array.from(window.document.querySelectorAll<HTMLButtonElement>('[aria-label="Icon-Quelle"] button'))
      .find((button) => button.textContent === label)!;

    await render("Java");
    expect(search().value).toBe("java");
    expect(results()).toEqual(["java, Material Icon Theme, Datei-Icon"]);
    await act(async () => { source("vscode-icons").click(); });
    expect(search().value).toBe("java");
    expect(results()).toEqual(["java, vscode-icons, Datei-Icon, nicht verfügbar"]);
    await act(async () => { source("Alle Quellen").click(); });
    expect(results()).toEqual(["java, Material Icon Theme, Datei-Icon"]);

    await act(async () => {
      const input = search();
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set?.call(input, "react");
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    expect(search().value).toBe("react");
    expect(results()).toEqual(["react, Material Icon Theme, Datei-Icon"]);
    await render("Docker");
    expect(search().value).toBe("docker");
    expect(results()).toEqual(["docker, Material Icon Theme, Datei-Icon"]);
    await act(async () => root.unmount());
  });

  it("updates the preview at once and keeps the choice in the saved Stärke", async () => {
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(window.document.getElementById("root")!);
    const saved: string[] = [];
    function Harness() {
      const [value, setValue] = useState("");
      return <TechnologyIconPicker technologyTitle="Go" value={value} onChange={(next) => { saved.push(next); setValue(next); }} />;
    }
    await act(async () => { root.render(<Harness />); });
    expect(preview(window.document)?.getAttribute("data-brand")).toBe("material:file:go");
    const button = (label: string) => categoryButtons(window.document).find((entry) => entry.getAttribute("aria-label") === label)!;
    await act(async () => { button("Monitoring").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true })); });
    expect(saved).toEqual(["symbol:monitoring"]);
    expect(button("Monitoring").getAttribute("aria-pressed")).toBe("true");
    expect(preview(window.document)?.getAttribute("data-strength-symbol")).toBe("symbol:monitoring");
    await act(async () => root.unmount());

    // Saved with the profile and opened again: the manual choice still wins over the brand.
    const reopened = profileSchema.parse(JSON.parse(JSON.stringify(profileSchema.parse({
      id: crypto.randomUUID(), firstName: "Mina", lastName: "Kaya", isDefault: true, updatedAt: new Date().toISOString(),
      strengths: [{ id: crypto.randomUUID(), title: "Go", iconId: saved.at(-1) }],
    }))));
    expect(reopened.strengths[0]!.iconId).toBe("symbol:monitoring");
    expect(getTechnologyBrandIconMarkup("Go", reopened.strengths[0]!.iconId)).toBe(getStrengthSymbolMarkup("symbol:monitoring"));
  });
});
