import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import type { ResumeDesignLayer } from "../../shared/cvDesignSchema";
import { createResumePagePlan } from "../../shared/documentPagination";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { templates } from "../../shared/templates";
import { ManagedResumePreview } from "./ManagedResumePreview";
import { ElegantResume } from "./templates/elegant";
import { EinspaltigResume } from "./templates/einspaltig";
import { GepflegtResume } from "./templates/gepflegt";
import { KlassischResume } from "./templates/klassisch";
import { KompaktResume } from "./templates/kompakt";
import { KreativResume } from "./templates/kreativ";
import { IvyLeagueResume } from "./templates/ivy-league";
import { ModernResume } from "./templates/modern";
import { PehlioneResume } from "./templates/pehlione";
import { StilvollResume } from "./templates/stilvoll";
import { TabellarischResume } from "./templates/tabellarisch";
import { ZeitgenoessischResume } from "./templates/zeitgenoessisch";
import { ZweispaltigResume } from "./templates/zweispaltig";

const components: Record<string, unknown> = {
  elegant: ElegantResume, einspaltig: EinspaltigResume, gepflegt: GepflegtResume, klassisch: KlassischResume,
  kompakt: KompaktResume, kreativ: KreativResume, "ivy-league": IvyLeagueResume, modern: ModernResume,
  pehlione_white: PehlioneResume, pehlione_white_blue: PehlioneResume, stilvoll: StilvollResume,
  tabellarisch: TabellarischResume, zeitgenoessisch: ZeitgenoessischResume, zweispaltig: ZweispaltigResume,
};
const now = new Date().toISOString();
const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin", city: "Berlin", email: "mina@example.com",
  summary: "Mehrjährige Erfahrung.", skills: ["TypeScript"], languages: ["Deutsch"],
  experiences: [1, 2].map((n) => ({ id: crypto.randomUUID(), from: `0${n}/2020`, to: "Heute", role: `Rolle ${n}`, company: `Firma ${n}`, achievements: ["Ladezeiten reduziert.", "Team geleitet."] })),
  education: [{ id: crypto.randomUUID(), from: "2012", to: "2016", degree: "B.Sc.", institution: "Hochschule" }],
  updatedAt: now,
});
const applicationFor = (templateId: string, designSettings = getTemplateDocumentDesignDefaults(templateId)) => applicationSchema.parse({
  schemaVersion: 1, id: crypto.randomUUID(), folderName: "Design", company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
  status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567", designSettings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});
const layer: ResumeDesignLayer = {
  cvOverrides: { spacing: { sectionGapMm: 7, entryGapMm: 6 }, typography: { sectionHeadingSizePt: 13, lineHeight: 1.3, bodySizePt: 10 } },
  resumeAppearance: { sectionHeadingAlignment: "center" },
};

const pdfPages = (html: string) => Array.from(parseHTML(html).document.querySelectorAll(".cv-sheet"));
const previewHtml = (templateId: string, settings: ReturnType<typeof getTemplateDocumentDesignDefaults>, global?: ResumeDesignLayer) => {
  const resolved = resolveCvDocument({ profile, templateId, settings, globalDesign: global, presentationAlreadyApplied: false });
  const plan = resolved.pagePlan[0];
  const child = createElement(components[templateId] as ComponentType<Record<string, unknown>>, {
    profile: resolved.profile, templateId, name: "Mina Kaya", atsMode: false, plan, totalPages: resolved.pagePlan.length,
    accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: resolved.sections, backgroundId: settings.backgroundId,
  });
  return renderToStaticMarkup(createElement(ManagedResumePreview, {
    profile: resolved.profile, templateId, pageNumber: plan.pageNumber, totalPages: resolved.pagePlan.length,
    designSettings: resolved.settings, resolvedCv: resolved, children: child,
  }));
};

describe("the shared Lebenslauf design in the outputs", () => {
  describe.each(templates)("$name", ({ id }) => {
    const base = getTemplateDocumentDesignDefaults(id);
    const asOwn = { ...base, cvOverrides: layer.cvOverrides, resumeAppearance: layer.resumeAppearance };

    it("leaves the PDF untouched while no layer exists or the layer is empty", () => {
      const html = buildDocumentHtml(applicationFor(id), profile, "lebenslauf");
      expect(buildDocumentHtml(applicationFor(id), profile, "lebenslauf", [], undefined)).toBe(html);
      expect(buildDocumentHtml(applicationFor(id), profile, "lebenslauf", [], {})).toBe(html);
      expect(buildDocumentHtml(applicationFor(id), profile, "lebenslauf", [], { cvOverrides: {} })).toBe(html);
    });

    it("draws the PDF exactly as if the document itself held the shared values", () => {
      const shared = buildDocumentHtml(applicationFor(id), profile, "lebenslauf", [], layer);
      const own = buildDocumentHtml(applicationFor(id, asOwn), profile, "lebenslauf");
      expect(shared).toBe(own);
      expect(shared).not.toBe(buildDocumentHtml(applicationFor(id), profile, "lebenslauf"));
    });

    it("draws the preview exactly as if the document itself held the shared values", () => {
      expect(previewHtml(id, base, layer)).toBe(previewHtml(id, asOwn));
      expect(previewHtml(id, base, layer)).not.toBe(previewHtml(id, base));
    });

    it("gives preview and PDF the same resolved values", () => {
      const scopes = [
        pdfPages(buildDocumentHtml(applicationFor(id), profile, "lebenslauf", [], layer))[0].querySelector(".page-content"),
        parseHTML(`<body>${previewHtml(id, base, layer)}</body>`).document.querySelector(".managed-resume-preview")?.firstElementChild,
      ];
      for (const scope of scopes) {
        const style = scope?.getAttribute("style") ?? "";
        expect(style, id).toContain("--doc-section-gap:7mm");
        expect(style, id).toContain("--doc-entry-gap:6mm");
        expect(style, id).toContain("--doc-line-height:1.3");
        expect(scope?.hasAttribute("data-resume-spacing-section-gap"), id).toBe(true);
      }
    });

    it("moves the section titles' size and alignment in both outputs", () => {
      const pdf = buildDocumentHtml(applicationFor(id), profile, "lebenslauf", [], layer);
      const preview = previewHtml(id, base, layer);
      for (const html of [pdf, preview]) {
        const { document } = parseHTML(html.includes("<body>") ? html : `<body>${html}</body>`);
        const titled = Array.from(document.querySelectorAll("[data-managed-section]"))
          .flatMap((section) => Array.from(section.querySelectorAll("h2,h3,[data-cv-heading]")).slice(0, 1));
        expect(titled.some((heading) => /font-size:\s*13pt/.test(heading.getAttribute("style") ?? "")), id).toBe(true);
        expect(titled.some((heading) => /text-align:\s*center/.test(heading.getAttribute("style") ?? "")), id).toBe(true);
      }
    });
  });

  it("lets the page planner see the shared values, like the other outputs", () => {
    const heavy = profileSchema.parse({ ...profile, experiences: profile.experiences.map((item) => ({
      ...item, achievements: [...item.achievements, ...Array.from({ length: 12 }, () => "Koordination komplexer Abläufe mit mehreren Beteiligten und termingerechter Umsetzung.")],
    })) });
    for (const id of ["klassisch", "kreativ", "pehlione_white_blue"]) {
      const settings = getTemplateDocumentDesignDefaults(id);
      const plain = resolveCvDocument({ profile: heavy, templateId: id, settings });
      const shared = resolveCvDocument({ profile: heavy, templateId: id, settings, globalDesign: { cvOverrides: { typography: { bodySizePt: 12, lineHeight: 1.6 }, spacing: { sectionGapMm: 12 } } } });
      const own = resolveCvDocument({ profile: heavy, templateId: id, settings: { ...settings, cvOverrides: { typography: { bodySizePt: 12, lineHeight: 1.6 }, spacing: { sectionGapMm: 12 } } } });
      expect(shared.pagePlan, id).toEqual(own.pagePlan);
      expect(JSON.stringify(shared.pagePlan), id).not.toBe(JSON.stringify(plain.pagePlan));
      expect(createResumePagePlan(heavy, "", {}, id).length, id).toBeGreaterThan(0);
    }
  });
});

/**
 * "Seitenränder" and "Innenabstand" reach both outputs through separate channels: the margin moves the page-level scope,
 * the padding marks the columns whose content it insets. The paddings a template draws itself form its margin and are
 * never written to.
 */
describe("Seitenränder and Innenabstand in preview and PDF", () => {
  type Spacing = { pageMarginMm?: number; innerPaddingMm?: number };
  const own = (id: string, spacing: Spacing) => ({ ...getTemplateDocumentDesignDefaults(id), ...(Object.keys(spacing).length ? { cvOverrides: { spacing } } : {}) });
  const outputs = (id: string, settings: ReturnType<typeof own>, global?: ResumeDesignLayer) => ({
    pdf: buildDocumentHtml(applicationFor(id, settings), profile, "lebenslauf", [], global),
    preview: previewHtml(id, settings, global),
  });
  const scopeOf = (html: string, surface: "pdf" | "preview") => surface === "pdf"
    ? pdfPages(html)[0].querySelector(".page-content")
    : parseHTML(`<body>${html}</body>`).document.querySelector(".managed-resume-preview")?.firstElementChild ?? null;
  const styleOf = (element: Element | null): Record<string, string> => Object.fromEntries((element?.getAttribute("style") ?? "").split(";").filter(Boolean).map((part) => {
    const at = part.indexOf(":");
    return [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  }));
  const only = (style: Record<string, string>, names: string[]) => Object.fromEntries(names.filter((name) => style[name] !== undefined).map((name) => [name, style[name]]));
  const marginStyle = (scope: Element | null) => only(styleOf(scope), ["--doc-page-margin", "--doc-margin", "padding", "margin", "width", "height"]);
  const paddingStyle = (scope: Element | null) => only(styleOf(scope), ["--doc-inner-padding", "--doc-padding"]);
  const carriers = (scope: Element | null) => scope?.querySelectorAll("[data-resume-spacing-inner]").length ?? 0;
  const inlinePaddings = (scope: Element | null) => scope?.querySelectorAll('[style*="padding-inline"],[style*="padding-left"],[style*="padding-right"]').length ?? 0;
  const rule = "[data-resume-spacing-inner]>*{padding-inline:var(--doc-inner-padding)!important}";

  it.each(templates)("applies each setting on its own and both as their sum, alike in preview and PDF of $name", ({ id }) => {
    const native = outputs(id, own(id, {}));
    const changes = {
      margin: outputs(id, own(id, { pageMarginMm: 16 })),
      smaller: outputs(id, own(id, { pageMarginMm: 6 })),
      padding: outputs(id, own(id, { innerPaddingMm: 2.5 })),
      both: outputs(id, own(id, { pageMarginMm: 16, innerPaddingMm: 2.5 })),
      bothLess: outputs(id, own(id, { pageMarginMm: 16, innerPaddingMm: 2 })),
      smallerBoth: outputs(id, own(id, { pageMarginMm: 6, innerPaddingMm: 2 })),
    };
    for (const surface of ["pdf", "preview"] as const) {
      const scope = (name: keyof typeof changes) => scopeOf(changes[name][surface], surface);
      const nativeScope = scopeOf(native[surface], surface);
      for (const name of ["margin", "smaller"] as const) {
        // The margin moves the scope and sets its own variable; it marks no column and sets none of the padding's variables.
        expect(marginStyle(scope(name)), `${surface} ${name}`).not.toEqual(marginStyle(nativeScope));
        expect(paddingStyle(scope(name)), `${surface} ${name}`).toEqual(paddingStyle(nativeScope));
        expect(carriers(scope(name)), `${surface} ${name}`).toBe(0);
      }
      // The padding marks the columns and sets its own variables; the page margin stays the template's.
      expect(paddingStyle(scope("padding")), surface).toEqual({ "--doc-inner-padding": "2.5mm", "--doc-padding": "2.5mm" });
      expect(marginStyle(scope("padding")), surface).toEqual(marginStyle(nativeScope));
      expect(carriers(scope("padding")), surface).toBeGreaterThan(0);
      // Both together are the sum of the two, and a new padding leaves the margin exactly as it was.
      expect(marginStyle(scope("both")), surface).toEqual(marginStyle(scope("margin")));
      expect(paddingStyle(scope("both")), surface).toEqual(paddingStyle(scope("padding")));
      expect(carriers(scope("both")), surface).toBe(carriers(scope("padding")));
      expect(marginStyle(scope("bothLess")), surface).toEqual(marginStyle(scope("both")));
      expect(paddingStyle(scope("bothLess")), surface).toEqual({ "--doc-inner-padding": "2mm", "--doc-padding": "2mm" });
      expect(marginStyle(scope("smallerBoth")), surface).toEqual(marginStyle(scope("smaller")));
      // No setting writes a padding onto an element of the template: the ones that form its margin stay as they are.
      for (const name of Object.keys(changes) as (keyof typeof changes)[])
        expect(inlinePaddings(scope(name)), `${surface} ${name}`).toBe(inlinePaddings(nativeScope));
      // The single rule that applies the padding is part of the output.
      expect(changes.padding[surface], surface).toContain(rule);
    }
    // Preview and PDF read the same values and mark the same number of columns.
    for (const [name, output] of Object.entries(changes)) {
      const preview = scopeOf(output.preview, "preview");
      const pdf = scopeOf(output.pdf, "pdf");
      expect(marginStyle(preview), name).toEqual(marginStyle(pdf));
      expect(paddingStyle(preview), name).toEqual(paddingStyle(pdf));
      expect(carriers(preview), name).toBe(carriers(pdf));
    }
  });

  it.each(templates)("draws a shared margin with an own padding, and the reverse, like two own values in $name", ({ id }) => {
    const both = outputs(id, own(id, { pageMarginMm: 16, innerPaddingMm: 2.5 }));
    const sharedMargin = outputs(id, own(id, { innerPaddingMm: 2.5 }), { cvOverrides: { spacing: { pageMarginMm: 16 } } });
    const sharedPadding = outputs(id, own(id, { pageMarginMm: 16 }), { cvOverrides: { spacing: { innerPaddingMm: 2.5 } } });
    for (const surface of ["pdf", "preview"] as const) {
      expect(sharedMargin[surface], `${surface}: shared margin, own padding`).toBe(both[surface]);
      expect(sharedPadding[surface], `${surface}: shared padding, own margin`).toBe(both[surface]);
    }
  });
});
