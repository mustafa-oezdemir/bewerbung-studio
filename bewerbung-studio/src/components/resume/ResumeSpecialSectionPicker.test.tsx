import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResumeSpecialSectionKind } from "../../shared/schema";
import { ResumeSpecialSectionPicker } from "./ResumeSpecialSectionPicker";

/** The 13 Lebenslauf-Bereiche in the order both screens must show them. */
const expectedSpecialSectionLabels = [
  "Projekte", "Praktika", "Weiterbildungen", "Auslandserfahrung", "Stipendien", "Auszeichnungen", "Veröffentlichungen",
  "Ehrenamt", "Interessen und Hobbys", "Führerschein", "Zusatzangaben", "Referenzen", "Eigener Abschnitt",
];

const dom = (html: string) => parseHTML(`<html><body>${html}</body></html>`).document;
const options = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLButtonElement>(".special-section-option"));
const label = (button: Element) => button.querySelector("span")?.textContent;
const markup = (kinds: ResumeSpecialSectionKind[] = []) =>
  dom(renderToStaticMarkup(<ResumeSpecialSectionPicker sections={kinds.map((kind) => ({ kind }))} onAdd={vi.fn()} />));

describe("ResumeSpecialSectionPicker", () => {
  it("shows exactly the 13 Bereiche in order as keyboard-reachable toggle cards", () => {
    const document = markup();
    expect(options(document).map(label)).toEqual(expectedSpecialSectionLabels);
    for (const button of options(document)) {
      expect(button.getAttribute("type")).toBe("button");
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.hasAttribute("tabindex")).toBe(false);
    }
    expect(document.querySelector("select")).toBeNull();
    const group = document.querySelector("[role=group]")!;
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)?.textContent).toBe("Bereich auswählen");
    expect(document.getElementById(group.getAttribute("aria-describedby")!)?.textContent)
      .toBe("Wählen Sie einen passenden Bereich für Ihren Lebenslauf.");
    const add = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Bereich hinzufügen"))!;
    expect(add.hasAttribute("disabled")).toBe(true);
  });

  it("marks Projekte as already added once a Projekte section exists, and keeps the other kinds addable", () => {
    const document = markup(["projects", "custom", "internships"]);
    const [projects, ...rest] = options(document);
    expect(projects!.hasAttribute("disabled")).toBe(true);
    expect(projects!.textContent).toBe("ProjekteBereits hinzugefügt");
    expect(rest.every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });
});

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});

describe("ResumeSpecialSectionPicker in a real React tree", () => {
  it("selects a card, adds its kind and starts over; Eigener Abschnitt stays addable", async () => {
    const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
    Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(window.document.getElementById("root")!);
    const onAdd = vi.fn();
    await act(async () => { root.render(<ResumeSpecialSectionPicker sections={[{ kind: "custom" }]} onAdd={onAdd} />); });
    const card = (text: string) => options(window.document).find((button) => label(button) === text)!;
    const add = () => Array.from(window.document.querySelectorAll("button")).find((button) => button.textContent?.includes("Bereich hinzufügen"))!;
    const click = (target: Element) => act(async () => { target.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true })); });

    await click(card("Praktika"));
    expect(card("Praktika").getAttribute("aria-pressed")).toBe("true");
    expect(options(window.document).filter((button) => button.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    expect(add().hasAttribute("disabled")).toBe(false);
    expect(window.document.querySelector("[aria-live]")?.textContent).toContain("Praktika");
    // A second click on the chosen card clears the choice.
    await click(card("Praktika"));
    expect(card("Praktika").getAttribute("aria-pressed")).toBe("false");
    expect(add().hasAttribute("disabled")).toBe(true);

    await click(card("Eigener Abschnitt"));
    await click(add());
    expect(onAdd).toHaveBeenLastCalledWith("custom");
    expect(card("Eigener Abschnitt").getAttribute("aria-pressed")).toBe("false");
    await click(card("Eigener Abschnitt"));
    await click(add());
    expect(onAdd.mock.calls).toEqual([["custom"], ["custom"]]);
    await act(async () => root.unmount());
  });
});
