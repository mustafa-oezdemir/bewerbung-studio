import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applicationSchema } from "./schema";
import { templates } from "./templates";
import { createDocumentDesignDraft, resetDocumentDesign, selectDocumentTemplate, updateCvDesignField } from "./documentEditorState";
import { cvDesignLimits } from "./cvDesignSchema";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "./cvDesign";
import {
  applyResumeSpacingOutput, applyResumeSpacingPreset, getResumeSpacingPreset, getResumeSpacingPresetValues, resolveEffectiveResumeSpacing,
  resumeSpacingCss, resumeSpacingFields,
} from "./resumeSpacing";

const now = new Date().toISOString();
const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Spacing", company: { name: "Firma", city: "Berlin" },
  contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern", accentColor: "#123456", documents: {},
  statusHistory: [], createdAt: now, updatedAt: now });

describe("semantic resume spacing", () => {
  it.each(templates)("keeps $name native until a user chooses a spacing preset", ({ id }) => {
    const draft = selectDocumentTemplate(createDocumentDesignDraft(application), id);
    expect(getResumeSpacingPreset(id, draft.settings)).toBe("standard");
    expect(draft.settings.cvOverrides).toBeUndefined();
    for (const preset of ["compact", "large"] as const) {
      const changed = applyResumeSpacingPreset(draft, preset);
      expect(getResumeSpacingPreset(id, changed.settings)).toBe(preset);
      // The two gaps are separate settings; a template that draws them equally (Ivy League) scales them equally.
      const { sectionGapMm, entryGapMm } = resolveTemplateCvDesign(id).spacing;
      if (sectionGapMm !== entryGapMm)
        expect(changed.settings.cvOverrides?.spacing?.sectionGapMm).not.toBe(changed.settings.cvOverrides?.spacing?.entryGapMm);
      const values = getResumeSpacingPresetValues(id, preset);
      for (const { key } of resumeSpacingFields) {
        expect(values.spacing[key]).toBeGreaterThanOrEqual(cvDesignLimits[key][0]);
        expect(values.spacing[key]).toBeLessThanOrEqual(cvDesignLimits[key][1]);
      }
      expect(getResumeSpacingPreset(id, applyResumeSpacingPreset(changed, "standard").settings)).toBe("standard");
    }
  });

  it("stores entry spacing separately, survives template switches, and resets per template", () => {
    let draft = createDocumentDesignDraft(application);
    draft = updateCvDesignField(draft, "spacing", "entryGapMm", 7);
    expect(getResumeSpacingPreset("modern", draft.settings)).toBe("custom");
    expect(draft.settings.cvOverrides).toEqual({ spacing: { entryGapMm: 7 } });
    draft = selectDocumentTemplate(draft, "klassisch");
    expect(draft.settings.cvOverrides).toBeUndefined();
    draft = selectDocumentTemplate(draft, "modern");
    expect(draft.settings.cvOverrides).toEqual({ spacing: { entryGapMm: 7 } });
    expect(resetDocumentDesign(draft).settings.cvOverrides).toBeUndefined();
  });
  it("shows old slider values until a semantic override takes precedence", () => {
    const draft = createDocumentDesignDraft(application);
    const legacy = { ...draft.settings, marginLevel: 9 as const, sectionSpacingLevel: 8 as const };
    expect(resolveEffectiveResumeSpacing("modern", legacy).spacing.pageMarginMm).toBe(23);
    expect(resolveEffectiveResumeSpacing("modern", legacy).spacing.sectionGapMm).toBe(7.8);
    expect(resolveEffectiveResumeSpacing("modern", { ...legacy, cvOverrides: { spacing: { sectionGapMm: 4 } } }).spacing.sectionGapMm).toBe(4);
  });
});

/**
 * "Seitenränder" moves the page-level scope, "Innenabstand" marks the columns whose content it insets. The padding a
 * template draws on its host or columns is what forms its own margin; neither setting may ever replace it.
 */
describe("the spacing adapter keeps Seitenränder and Innenabstand apart", () => {
  const oneColumn = `<div class="page-content"><div class="klassisch-pdf-content" style="padding:0 15mm"><header class="klassisch-pdf-header"></header><section data-managed-section="summary"></section></div></div>`;
  const twoColumns = `<div class="page-content gepflegt-pdf"><aside class="gepflegt-pdf-sidebar" style="padding:0 10mm"><section data-managed-section="languages"></section></aside><div class="gepflegt-pdf-content" style="padding:0 10mm"><header></header><main><section data-managed-section="experience"></section></main></div></div>`;
  const styleOf = (element: Element | null) => Object.fromEntries((element?.getAttribute("style") ?? "").split(";").filter(Boolean).map((part) => {
    const at = part.indexOf(":");
    return [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  }));
  const render = (markup: string, templateId: string, spacing: Record<string, number>) => {
    const { document } = parseHTML(`<body><div id="page">${markup}</div></body>`);
    const page = document.getElementById("page")!;
    applyResumeSpacingOutput(page, templateId, "pdf", { ...getTemplateDocumentDesignDefaults(templateId), cvOverrides: { spacing } });
    return page;
  };
  const scopeStyle = (page: Element) => styleOf(page.querySelector(".page-content"));
  // The padding's own variables: the shared one and the alias that the section cards of the background option read.
  const paddingVariables = { "--doc-inner-padding": "2.5mm", "--doc-padding": "2.5mm" };

  it("pads the children of a marked column, never the column or host that carries the margin", () => {
    expect(resumeSpacingCss).toContain("[data-resume-spacing-inner]>*{padding-inline:var(--doc-inner-padding)!important}");
    expect(resumeSpacingCss).not.toMatch(/\[data-resume-spacing-inner\]\s*[{,]/);
  });

  it("leaves the host's own padding alone in a one-column template", () => {
    const margin = render(oneColumn, "klassisch", { pageMarginMm: 16 });
    const padding = render(oneColumn, "klassisch", { innerPaddingMm: 2.5 });
    const both = render(oneColumn, "klassisch", { pageMarginMm: 16, innerPaddingMm: 2.5 });
    const host = (page: Element) => page.querySelector(".klassisch-pdf-content")!;
    // The host's padding is the template's margin: no setting writes to it.
    for (const page of [margin, padding, both]) expect(host(page).getAttribute("style")).toBe("padding:0 15mm");
    // The margin moves the page-level scope and nothing else ...
    expect(scopeStyle(margin)).toEqual({ "--doc-page-margin": "16mm", padding: "1mm" });
    expect(host(margin).hasAttribute("data-resume-spacing-inner")).toBe(false);
    // ... the padding only marks the host and sets its own variable ...
    expect(scopeStyle(padding)).toEqual(paddingVariables);
    expect(host(padding).hasAttribute("data-resume-spacing-inner")).toBe(true);
    // ... and both together are exactly the sum of the two.
    expect(scopeStyle(both)).toEqual({ ...scopeStyle(margin), ...scopeStyle(padding) });
    expect(host(both).hasAttribute("data-resume-spacing-inner")).toBe(true);
  });

  it("marks the columns, not the page scope, in a two-column template", () => {
    const margin = render(twoColumns, "gepflegt", { pageMarginMm: 16 });
    const padding = render(twoColumns, "gepflegt", { innerPaddingMm: 2.5 });
    const both = render(twoColumns, "gepflegt", { pageMarginMm: 16, innerPaddingMm: 2.5 });
    const columns = (page: Element) => Array.from(page.querySelectorAll("aside,.gepflegt-pdf-content"));
    for (const page of [margin, padding, both]) {
      expect(columns(page).map((column) => column.getAttribute("style"))).toEqual(["padding:0 10mm", "padding:0 10mm"]);
    }
    expect(scopeStyle(margin)).toEqual({ "--doc-page-margin": "16mm", padding: "6mm" });
    expect(columns(margin).some((column) => column.hasAttribute("data-resume-spacing-inner"))).toBe(false);
    expect(scopeStyle(padding)).toEqual(paddingVariables);
    expect(columns(padding).every((column) => column.hasAttribute("data-resume-spacing-inner"))).toBe(true);
    expect(padding.querySelector(".page-content")?.hasAttribute("data-resume-spacing-inner")).toBe(false);
    expect(scopeStyle(both)).toEqual({ ...scopeStyle(margin), ...scopeStyle(padding) });
  });

  it("widens the scope for a smaller margin the same way with and without an inner padding", () => {
    const margin = render(oneColumn, "klassisch", { pageMarginMm: 10 });
    const both = render(oneColumn, "klassisch", { pageMarginMm: 10, innerPaddingMm: 2.5 });
    expect(scopeStyle(margin)).toEqual({
      "--doc-page-margin": "10mm", margin: "-5mm", width: "calc(100% + 10mm)", height: "calc(100% + 10mm)",
    });
    expect(scopeStyle(both)).toEqual({ ...scopeStyle(margin), ...paddingVariables });
  });

  it("marks nothing while no inner padding is chosen", () => {
    for (const [markup, id] of [[oneColumn, "klassisch"], [twoColumns, "gepflegt"]] as const) {
      const page = render(markup, id, { sectionGapMm: 7, pageMarginMm: 17 });
      expect(page.querySelector("[data-resume-spacing-inner]"), id).toBeNull();
      expect(scopeStyle(page)).not.toHaveProperty("--doc-inner-padding");
    }
  });
});
