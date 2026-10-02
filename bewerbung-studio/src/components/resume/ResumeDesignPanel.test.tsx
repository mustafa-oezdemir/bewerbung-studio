import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "../../shared/cvDesign";
import {
  createDocumentDesignDraft, editCvDesignField, editResumeAppearanceField, resetResumeDesign, selectDocumentTemplate, type DesignEditState,
} from "../../shared/documentEditorState";
import { resolveResumeDesignView } from "../../shared/resumeDesignSystem";
import { applicationSchema } from "../../shared/schema";
import { getTemplate, templates } from "../../shared/templates";
import { ResumeDesignPanel } from "./ResumeDesignPanel";

const now = new Date().toISOString();
const application = applicationSchema.parse({
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "Design", company: { name: "Firma", city: "Berlin" }, contact: {},
  job: { title: "Entwicklung" }, status: "Entwurf", templateId: "klassisch", accentColor: "#2B2F32", secondaryColor: "#00AFC5",
  documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});
const noop = () => undefined;
const stateFor = (templateId: string): DesignEditState => ({
  draft: createDocumentDesignDraft({ ...application, templateId, designSettings: getTemplateDocumentDesignDefaults(templateId) }), global: undefined,
});

const panel = (state: DesignEditState, hasSidebar = true) => parseHTML(`<body>${renderToStaticMarkup(createElement(ResumeDesignPanel, {
  templateId: state.draft.templateId, templateName: getTemplate(state.draft.templateId).name, settings: state.draft.settings, global: state.global,
  hasSidebar, onEditToken: noop, onEditAppearance: noop, onPreset: noop, onReset: noop,
}))}</body>`).document;

const controls = (document: Document) => Array.from(document.querySelectorAll("input,select")).map((node) => node.getAttribute("aria-label") ?? "");
const field = (document: Document, label: string) => {
  const node = Array.from(document.querySelectorAll("input,select")).find((item) => item.getAttribute("aria-label") === label);
  if (!node) throw new Error(`no control "${label}"`);
  return node;
};
const valueOf = (document: Document, label: string) => {
  const node = field(document, label);
  return node.tagName === "SELECT" ? node.querySelector("option[selected]")?.textContent ?? "" : node.getAttribute("value") ?? "";
};
const frameOf = (document: Document, label: string) => field(document, label).closest(".rds-field")!;

describe("Lebenslauf design panel", () => {
  it("offers the same controls for every template; only the values change", () => {
    const reference = controls(panel(stateFor(templates[0].id)));
    expect(reference.length).toBeGreaterThan(40);
    for (const { id } of templates) expect(controls(panel(stateFor(id))), id).toEqual(reference);
  });

  it("shows each setting once and keeps the three sections complete", () => {
    const document = panel(stateFor("klassisch"));
    const labels = controls(document);
    expect(labels.filter((label, index) => labels.indexOf(label) !== index)).toEqual([]);
    expect(Array.from(document.querySelectorAll(".rds-group > summary strong")).map((node) => node.textContent))
      .toEqual(["Farben und Dekoration", "Typografie im Detail", "Erweiterte Abstände"]);
    for (const label of [
      "Ausrichtung Abschnittstitel", "Abstand davor (mm)", "Abstand danach (mm)", "Schriftart", "Überschrift-Schriftart", "Lesetext (pt)",
      "Hauptüberschrift (pt)", "Unterüberschrift (pt)", "Abschnittsüberschrift (pt)", "Eintragstitel (pt)", "Zeilenhöhe", "Name – Gewicht",
      "Untertitel – Gewicht", "Abschnittstitel – Gewicht", "Seitenränder (mm)", "Innenabstand (mm)", "Abschnittsabstand (mm)",
      "Eintragsabstand (mm)", "Abstand nach Eintragstitel (mm)", "Spaltenabstand (mm)",
    ]) expect(labels, label).toContain(label);
    // Line height and the space below a title have one control each, whichever section the setting is named in.
    expect(labels.filter((label) => label.startsWith("Zeilenhöhe"))).toHaveLength(1);
    expect(labels.filter((label) => /Abstand (danach|nach Abschnittstitel)/.test(label))).toHaveLength(1);
  });

  it.each(templates)("shows the real values of $name as the effective ones", ({ id }) => {
    const native = resolveTemplateCvDesign(id);
    const document = panel(stateFor(id));
    const german = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });
    expect(valueOf(document, "Zeilenhöhe")).toBe(german(native.typography.lineHeight));
    expect(valueOf(document, "Lesetext (pt)")).toBe(german(native.typography.bodySizePt));
    expect(valueOf(document, "Abschnittsabstand (mm)")).toBe(german(native.spacing.sectionGapMm));
    expect(valueOf(document, "Abstand danach (mm)")).toBe(german(native.spacing.sectionTitleGapMm));
    expect(frameOf(document, "Zeilenhöhe").textContent).toContain(`Vorlage: ${german(native.typography.lineHeight)}`);
    expect(frameOf(document, "Zeilenhöhe").querySelector(".rds-badge")).toBeNull();
    // The alignment names what the template really does for the value "Vorlage".
    expect(valueOf(document, "Ausrichtung Abschnittstitel")).toBe(id === "ivy-league" ? "Mitte (Vorlage)" : "Links (Vorlage)");
  });

  it("names the origin of a value: shared layer, own override, template", () => {
    let state = editCvDesignField(stateFor("klassisch"), "global", "spacing", "sectionGapMm", 7);
    state = editCvDesignField(state, "document", "spacing", "entryGapMm", 6);
    state = editResumeAppearanceField(state, "global", "sectionHeadingAlignment", "center");
    const document = panel(state);
    expect(valueOf(document, "Abschnittsabstand (mm)")).toBe("7");
    expect(frameOf(document, "Abschnittsabstand (mm)").querySelector(".rds-badge--global")?.textContent).toBe("Global");
    expect(frameOf(document, "Abschnittsabstand (mm)").textContent).toContain("Vorlage: 3,8 mm · Global: 7 mm");
    expect(frameOf(document, "Eintragsabstand (mm)").querySelector(".rds-badge--document")?.textContent).toBe("Bewerbung");
    expect(valueOf(document, "Ausrichtung Abschnittstitel")).toBe("Mitte");
    expect(frameOf(document, "Innenabstand (mm)").querySelector(".rds-badge")).toBeNull();
    expect(document.querySelector(".rds-status")?.textContent).toContain("2 globale Anpassungen");
    expect(document.querySelector(".rds-status")?.textContent).toContain("1 Anpassung dieser Bewerbung");
  });

  it("walks through the critical interactions: change, switch template, keep, change colour and alignment, reset", () => {
    let state = stateFor("klassisch");
    state = editCvDesignField(state, "global", "spacing", "sectionGapMm", 6);
    expect(valueOf(panel(state), "Abschnittsabstand (mm)")).toBe("6");

    state = { ...state, draft: selectDocumentTemplate(state.draft, "kompakt", state.global) };
    const kompakt = panel(state);
    expect(valueOf(kompakt, "Abschnittsabstand (mm)")).toBe("6");
    expect(frameOf(kompakt, "Abschnittsabstand (mm)").textContent).toContain("Vorlage: 3,5 mm");

    state = editResumeAppearanceField(state, "document", "sectionHeadingAlignment", "right");
    state = editCvDesignField(state, "document", "colors", "sectionHeading", "#aa0000");
    const changed = panel(state);
    expect(valueOf(changed, "Ausrichtung Abschnittstitel")).toBe("Rechts");
    expect(field(changed, "Hauptabschnitt").getAttribute("value")).toBe("#aa0000");
    expect(changed.querySelector("input[aria-label='Hauptabschnitt HEX']")?.getAttribute("value")).toBe("#AA0000");

    state = editCvDesignField(state, "global", "spacing", "sectionGapMm", undefined);
    expect(valueOf(panel(state), "Abschnittsabstand (mm)")).toBe("3,5");
    state = resetResumeDesign(state, "global");
    const reset = panel(state);
    expect(valueOf(reset, "Ausrichtung Abschnittstitel")).toBe("Rechts");
    expect(field(reset, "Hauptabschnitt").getAttribute("value")).toBe("#aa0000");
    expect(reset.querySelector(".rds-status")?.textContent).toContain("Keine globalen Anpassungen");
    const native = panel(resetResumeDesign(state, "document"));
    expect(valueOf(native, "Ausrichtung Abschnittstitel")).toBe("Links (Vorlage)");
    expect(field(native, "Hauptabschnitt").getAttribute("value")).toBe(resolveTemplateCvDesign("kompakt").colors.sectionHeading);
  });

  it("disables the side-column colours of a one-column layout", () => {
    const withSidebar = panel(stateFor("kreativ"), true);
    const single = panel(stateFor("kreativ"), false);
    expect(field(withSidebar, "Seitenspalte").hasAttribute("disabled")).toBe(false);
    expect(field(single, "Seitenspalte").hasAttribute("disabled")).toBe(true);
    expect(single.querySelector(".rds-note")?.textContent).toContain("zweispaltigen Layout");
    expect(controls(single)).toEqual(controls(withSidebar));
  });
});

describe("Seitenränder and Innenabstand in the panel", () => {
  const labels = { pageMarginMm: "Seitenränder (mm)", innerPaddingMm: "Innenabstand (mm)" } as const;
  type Key = keyof typeof labels;
  const german = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });
  const set = (state: DesignEditState, scope: "global" | "document", key: Key, value?: number) => editCvDesignField(state, scope, "spacing", key, value);
  const origin = { template: null, global: "Global", document: "Bewerbung" } as const;
  const frame = (state: DesignEditState, key: Key) => frameOf(panel(state), labels[key]);

  const scenarios: [string, (state: DesignEditState) => DesignEditState, [string, string], [string | null, string | null]][] = [
    ["own margin 10 and own padding 2,5", (state) => set(set(state, "document", "pageMarginMm", 10), "document", "innerPaddingMm", 2.5), ["10", "2,5"], ["Bewerbung", "Bewerbung"]],
    ["own margin 16 and own padding 2,5", (state) => set(set(state, "document", "pageMarginMm", 16), "document", "innerPaddingMm", 2.5), ["16", "2,5"], ["Bewerbung", "Bewerbung"]],
    ["own margin 16 and own padding 2", (state) => set(set(state, "document", "pageMarginMm", 16), "document", "innerPaddingMm", 2), ["16", "2"], ["Bewerbung", "Bewerbung"]],
    ["shared margin 16 and own padding 2,5", (state) => set(set(state, "global", "pageMarginMm", 16), "document", "innerPaddingMm", 2.5), ["16", "2,5"], ["Global", "Bewerbung"]],
    ["shared padding 2,5 and own margin 10", (state) => set(set(state, "global", "innerPaddingMm", 2.5), "document", "pageMarginMm", 10), ["10", "2,5"], ["Bewerbung", "Global"]],
    ["shared margin 12 and shared padding 3", (state) => set(set(state, "global", "pageMarginMm", 12), "global", "innerPaddingMm", 3), ["12", "3"], ["Global", "Global"]],
    ["nothing changed", (state) => state, ["15", "0"], [null, null]],
  ];

  it.each(scenarios)("shows what the resolver returns for both fields: %s", (_name, build, [margin, padding], [marginOrigin, paddingOrigin]) => {
    const state = build(stateFor("klassisch"));
    const view = resolveResumeDesignView("klassisch", state.draft.settings, state.global);
    const document = panel(state);
    for (const key of Object.keys(labels) as Key[]) {
      expect(valueOf(document, labels[key]), key).toBe(german(view.effective.tokens.spacing[key]));
      expect(frameOf(document, labels[key]).querySelector(".rds-badge")?.textContent ?? null, key).toBe(origin[view.sourceOfToken("spacing", key)]);
      expect(frameOf(document, labels[key]).textContent, key).toContain(`Vorlage: ${german(view.native.tokens.spacing[key])} mm`);
    }
    expect(valueOf(document, labels.pageMarginMm)).toBe(margin);
    expect(valueOf(document, labels.innerPaddingMm)).toBe(padding);
    expect(frameOf(document, labels.pageMarginMm).querySelector(".rds-badge")?.textContent ?? null).toBe(marginOrigin);
    expect(frameOf(document, labels.innerPaddingMm).querySelector(".rds-badge")?.textContent ?? null).toBe(paddingOrigin);
  });

  it.each(templates)("shows the template's own margin and inner padding for $name", ({ id }) => {
    const native = resolveTemplateCvDesign(id).spacing;
    const document = panel(stateFor(id));
    expect(valueOf(document, labels.pageMarginMm)).toBe(german(native.pageMarginMm));
    expect(valueOf(document, labels.innerPaddingMm)).toBe(german(native.innerPaddingMm));
    for (const key of Object.keys(labels) as Key[]) expect(frameOf(document, labels[key]).querySelector(".rds-badge"), key).toBeNull();
    // The panel says what the two values are, so that the padding is not mistaken for part of the margin.
    expect(frameOf(document, labels.pageMarginMm).textContent).toContain("Abstand der Inhalte zum Blattrand");
    expect(frameOf(document, labels.innerPaddingMm).textContent).toContain("zusätzlich zum Seitenrand hinzu und ändert ihn nicht");
  });

  it("redraws only the field that was edited", () => {
    const base = set(set(stateFor("klassisch"), "document", "pageMarginMm", 16), "document", "innerPaddingMm", 2.5);
    const sameFrame = (first: DesignEditState, second: DesignEditState, key: Key) => frame(first, key).outerHTML === frame(second, key).outerHTML;
    for (const scope of ["document", "global"] as const) {
      const padding = set(base, scope, "innerPaddingMm", 2);
      expect(sameFrame(base, padding, "pageMarginMm"), `padding in ${scope}`).toBe(true);
      expect(sameFrame(base, padding, "innerPaddingMm"), `padding in ${scope}`).toBe(false);
      const margin = set(base, scope, "pageMarginMm", 10);
      expect(sameFrame(base, margin, "innerPaddingMm"), `margin in ${scope}`).toBe(true);
      expect(sameFrame(base, margin, "pageMarginMm"), `margin in ${scope}`).toBe(false);
    }
  });

  it("offers the reset only on the field that has an override", () => {
    const reset = (state: DesignEditState, key: Key) => frame(state, key).querySelector(".rds-link")?.textContent ?? null;
    const padded = set(stateFor("klassisch"), "document", "innerPaddingMm", 2.5);
    expect(reset(padded, "pageMarginMm")).toBeNull();
    expect(reset(padded, "innerPaddingMm")).toBeNull();
    const both = set(padded, "global", "pageMarginMm", 16);
    expect(reset(both, "pageMarginMm")).toContain("Auf Vorlagenwert zurücksetzen");
    expect(reset(set(both, "global", "pageMarginMm", undefined), "pageMarginMm")).toBeNull();
    expect(reset(set(both, "document", "innerPaddingMm", undefined), "innerPaddingMm")).toBeNull();
    expect(reset(set(both, "document", "innerPaddingMm", undefined), "pageMarginMm")).toContain("Auf Vorlagenwert zurücksetzen");
  });
});
