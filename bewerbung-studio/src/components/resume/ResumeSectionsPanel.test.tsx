import { act, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { getManagerSections } from "../../features/resume-sections/resume-manager";
import { getDefaultKnowledgeGroups } from "../../features/resume-sections/resume-section-system";
import { ResumeSectionsPanel } from "./ResumeSectionsPanel";

const singleColumnTemplates = ["tabellarisch", "klassisch", "einspaltig", "ivy-league"];
const blank = () => profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString() });
const movable = (profile: ApplicantProfile, templateId: string) => getManagerSections(profile, templateId).filter((entry) => !entry.fixed);
const render = (profile: ApplicantProfile, templateId: string, layoutMode?: "single" | "two-column") => renderToStaticMarkup(
  <ResumeSectionsPanel profile={profile} templateId={templateId} layoutMode={layoutMode}
    singlePageExceeded={false} onSave={vi.fn()} onPreview={vi.fn()} />,
);
/** The titles of the movable cards, in the order the panel lists them. */
const listed = (html: string) => Array.from(html.matchAll(/aria-label="([^"]+) nach oben"/g), (match) => match[1]);

describe("ResumeSectionsPanel flexible blocks", () => {
  it("renders editable Pehlione blocks, placement, renderer and item controls", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      resumeKnowledgeGroups: getDefaultKnowledgeGroups("pehlione_white_blue"),
      updatedAt: new Date().toISOString(),
    });

    const html = renderToStaticMarkup(
      <ResumeSectionsPanel
        profile={profile}
        templateId="pehlione_white_blue"
        singlePageExceeded={false}
        onSave={vi.fn()}
        onPreview={vi.fn()}
      />,
    );

    expect(html).toContain("Abschnitte neu ordnen");
    expect(html).toContain("Hauptspalte");
    expect(html).toContain("Seitenspalte");
    expect(html).not.toContain("9 Lebenslauf-Bereiche");
    expect(html).not.toContain("Besondere Kenntnisse · Bausteine");
    expect(html).not.toContain("Lebenslaufdaten bearbeiten");
    expect(html.match(/aria-label="Kernkompetenzen ausblenden"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Beruflicher Werdegang ausblenden" aria-pressed="true"');
    expect(html).toContain("Technische Schwerpunkte");
    expect(html).toContain("Bereich hinzufügen");
    expect(html).toContain("Pfeil hoch oder runter für Reihenfolge");
    expect(html).toContain('aria-label="Beruflicher Werdegang Position"');
  });

  it.each(singleColumnTemplates)("lists %s in one order without columns in its one-column layout", (templateId) => {
    const profile = blank();
    // The layout given by the document, and the template's own layout when none is given.
    for (const html of [render(profile, templateId, "single"), render(profile, templateId)]) {
      expect(html).toContain("Reihenfolge im Lebenslauf");
      expect(html).toContain("Im einspaltigen Layout werden alle Bereiche in einer gemeinsamen Reihenfolge angeordnet.");
      expect(html).not.toContain("Im einspaltigen Layout erscheinen beide Gruppen in einer Spalte.");
      expect(html).not.toContain("Hauptspalte");
      expect(html).not.toContain("Seitenspalte");
      expect(html).not.toMatch(/aria-label="[^"]+ Position"/);
      expect(html).not.toContain("Pfeil links oder rechts für Spalte");
      expect(html).toContain("Pfeil hoch oder runter für Reihenfolge");
      expect(html.match(/class="resume-section-zone/g)).toHaveLength(2);
      // Every movable section once, in the order of the Lebenslauf.
      expect(listed(html)).toEqual(movable(profile, templateId).map((entry) => entry.title));
      const titles = listed(html);
      expect(html).toContain(`aria-label="${titles[0]} nach oben" disabled`);
      expect(html).not.toContain(`aria-label="${titles[1]} nach oben" disabled`);
      expect(html).toContain(`aria-label="${titles.at(-1)} nach unten" disabled`);
      expect(html).not.toContain(`aria-label="${titles.at(-2)} nach unten" disabled`);
    }
  });

  it("never shows a section saved in the side column as a side-column group of a one-column layout", () => {
    const base = blank();
    const profile = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts,
      einspaltig: [
        { id: "experience", zone: "main" as const }, { id: "summary", zone: "sidebar" as const },
        { id: "education", zone: "main" as const }, { id: "strengths", zone: "sidebar" as const },
      ],
    } };
    const html = render(profile, "einspaltig", "single");
    expect(html).not.toContain("Seitenspalte");
    expect(listed(html).slice(0, 4)).toEqual(["Beruflicher Werdegang", "Kurzprofil", "Bildungsweg", "Stärken"]);
  });

  it("shows the columns, their placement and the column keys once a one-column template is set to two columns", () => {
    const base = blank();
    const profile = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts,
      einspaltig: [{ id: "experience", zone: "main" as const }, { id: "summary", zone: "sidebar" as const }],
    } };
    const html = render(profile, "einspaltig", "two-column");
    expect(html).toContain("Hauptspalte");
    expect(html).toContain("Seitenspalte");
    expect(html).toContain('aria-label="Beruflicher Werdegang Position"');
    expect(html).toContain("Pfeil links oder rechts für Spalte");
    expect(html).not.toContain("Reihenfolge im Lebenslauf");
    expect(html).not.toContain("Im einspaltigen Layout");
    // The saved side column is used again: Kurzprofil stands in it, behind the Hauptspalte group.
    expect(html.indexOf("Seitenspalte</span>")).toBeLessThan(html.indexOf('aria-label="Kurzprofil nach oben"'));
    expect(html.indexOf('aria-label="Beruflicher Werdegang nach oben"')).toBeLessThan(html.indexOf("Seitenspalte</span>"));
  });

  it("shows Tabellarisch in one movable order across saved zones", () => {
    const base = blank();
    const profile = { ...base, resumeManagerLayouts: { ...base.resumeManagerLayouts,
      tabellarisch: [
        { id: "experience", zone: "main" as const }, { id: "education", zone: "main" as const },
        { id: "summary", zone: "sidebar" as const }, { id: "strengths", zone: "sidebar" as const },
      ],
    } };
    const html = render(profile, "tabellarisch", "single");
    expect(html.indexOf('aria-label="Beruflicher Werdegang nach oben"')).toBeLessThan(html.indexOf('aria-label="Kurzprofil nach oben"'));
    expect(html).toContain('aria-label="Kurzprofil nach oben"');
    expect(html).not.toContain('aria-label="Kurzprofil nach oben" disabled');
    expect(html).toContain("Reihenfolge im Lebenslauf");
  });
});

const previousWindow = globalThis.window;
const previousDocument = globalThis.document;
const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  Object.assign(globalThis, { window: previousWindow, document: previousDocument, IS_REACT_ACT_ENVIRONMENT: previousActEnvironment });
});
const noop = () => {};

/** The panel in a real React tree (linkedom), with the draft it writes. */
const mount = async (templateId: string, layoutMode: "single" | "two-column", initial: ApplicantProfile) => {
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
  // Cards are 40 px high from the top of the page: a drop at y 10 lands on the upper half of a card.
  Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", { configurable: true,
    value: () => ({ top: 0, height: 40, left: 0, width: 300, bottom: 40, right: 300, x: 0, y: 0 }) });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(window.document.getElementById("root")!);
  let draft = initial;
  function Harness() {
    const [current, setCurrent] = useState(initial);
    draft = current;
    return <ResumeSectionsPanel profile={initial} templateId={templateId} layoutMode={layoutMode} singlePageExceeded={false}
      onSave={async () => {}} onPreview={noop} controlledDraft={current} onDraftChange={setCurrent} />;
  }
  await act(async () => { root.render(<Harness />); });
  const find = (label: string) => window.document.querySelector(`[aria-label="${label}"]`)!;
  const fire = async (target: Element, type: string, properties: Record<string, unknown> = {}) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value });
    await act(async () => { target.dispatchEvent(event); });
  };
  const transfer = () => {
    const data = new Map<string, string>();
    return { setData: (type: string, value: string) => data.set(type, value), getData: (type: string) => data.get(type) ?? "", effectAllowed: "", dropEffect: "" };
  };
  return {
    draft: () => draft,
    order: () => movable(draft, templateId).map((entry) => entry.id),
    zone: (id: string) => movable(draft, templateId).find((entry) => entry.id === id)?.zone,
    click: (label: string) => fire(find(label), "click"),
    key: (title: string, key: string) => fire(find(`${title} verschieben: Pfeil hoch oder runter für Reihenfolge${layoutMode === "single" ? "" : ", Pfeil links oder rechts für Spalte"}`), "keydown", { key }),
    drag: async (sourceTitle: string, targetTitle: string) => {
      const card = (title: string) => find(`${title} ausblenden`).closest("article")!;
      const dataTransfer = transfer();
      await fire(card(sourceTitle), "dragstart", { dataTransfer });
      await fire(card(targetTitle), "dragover", { dataTransfer, clientY: 10 });
      await fire(card(targetTitle), "drop", { dataTransfer, clientY: 10 });
    },
    unmount: () => act(async () => root.unmount()),
  };
};

describe("ResumeSectionsPanel order in a real React tree", () => {
  it.each(singleColumnTemplates)("moves %s sections through the whole one-column order and keeps their saved zones", async (templateId) => {
    const profile = blank();
    const start = movable(profile, templateId);
    const zones = new Map(start.map((entry) => [entry.id, entry.zone]));
    const panel = await mount(templateId, "single", profile);
    const ids = start.map((entry) => entry.id);
    // A side-column section moves down past a main-column section: one step of the whole list.
    const side = start.findIndex((entry, index) => entry.zone === "sidebar" && start[index + 1]?.zone === "main");
    expect(side).toBeGreaterThanOrEqual(0);
    await panel.click(`${start[side]!.title} nach unten`);
    const down = [...ids];
    down.splice(side + 1, 0, ...down.splice(side, 1));
    expect(panel.order()).toEqual(down);
    // Up again, by the keyboard.
    await panel.key(start[side]!.title, "ArrowUp");
    expect(panel.order()).toEqual(ids);
    // Left and right do nothing in one column.
    await panel.key(start[side]!.title, "ArrowRight");
    await panel.key(start[side]!.title, "ArrowLeft");
    expect(panel.order()).toEqual(ids);
    // Drag and drop: the last section onto the upper half of the first one.
    await panel.drag(start.at(-1)!.title, start[0]!.title);
    expect(panel.order()).toEqual([ids.at(-1), ...ids.slice(0, -1)]);
    // No zone changed, no section was lost or doubled, and only this template's order was saved.
    for (const [id, zone] of zones) expect(panel.zone(id)).toBe(zone);
    expect([...panel.order()].sort()).toEqual([...ids].sort());
    expect(Object.keys(panel.draft().resumeManagerLayouts)).toEqual([templateId]);
    await panel.unmount();
  });

  it("keeps the column moves of a two-column layout", async () => {
    const panel = await mount("einspaltig", "two-column", blank());
    expect(panel.zone("experience")).toBe("main");
    await panel.key("Beruflicher Werdegang", "ArrowRight");
    expect(panel.zone("experience")).toBe("sidebar");
    await panel.key("Beruflicher Werdegang", "ArrowLeft");
    expect(panel.zone("experience")).toBe("main");
    await panel.unmount();
  });
});
