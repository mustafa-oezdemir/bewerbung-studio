import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "../../shared/cvDesign";
import type { ResumeDesignLayer } from "../../shared/cvDesignSchema";
import { createResumePagePlan } from "../../shared/documentPagination";
import { applyGlobalResumeDesign } from "../../shared/resumeDesignSystem";
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
const previewHtml = (templateId: string, settings: ReturnType<typeof getTemplateDocumentDesignDefaults>, globalDesign?: ResumeDesignLayer) => {
  const resolved = resolveCvDocument({ profile, templateId, settings, globalDesign, presentationAlreadyApplied: false });
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

describe("the Lebenslauf design of one Bewerbung in the outputs", () => {
  it.each(templates)("applies a live global colour, font and spacing beneath own overrides in preview and PDF of $name", ({ id }) => {
    const shared: ResumeDesignLayer = { cvOverrides: {
      colors: { text: "#123ABC" }, typography: { fontId: "inter", bodySizePt: 10.2, lineHeight: 1.35 },
      spacing: { sectionGapMm: 7, innerPaddingMm: 2.5 },
    } };
    const settings = { ...getTemplateDocumentDesignDefaults(id), cvOverrides: { spacing: { sectionGapMm: 5 } } };
    const pdf = pdfPages(buildDocumentHtml(applicationFor(id, settings), profile, "lebenslauf", [], shared))[0].querySelector(".page-content");
    const preview = parseHTML(`<body>${previewHtml(id, settings, shared)}</body>`).document
      .querySelector(".managed-resume-preview")?.firstElementChild;
    for (const surface of [pdf, preview]) {
      const style = surface?.getAttribute("style") ?? "";
      expect(style, id).toContain("--doc-section-gap:5mm");
      expect(style, id).toContain("--doc-inner-padding:2.5mm");
      expect(style, id).toContain("--doc-line-height:1.35");
      expect(style, id).toContain("--doc-text-color:#123ABC");
      expect(style, id).toContain("--doc-body-size:10.2pt");
      expect(style, id).toContain("--doc-font:Inter");
    }
  });

  describe.each(templates)("$name", ({ id }) => {
    const base = getTemplateDocumentDesignDefaults(id);
    const asOwn = { ...base, cvOverrides: layer.cvOverrides, resumeAppearance: layer.resumeAppearance };

    it("draws the template's own values while the Bewerbung has none, and its own values once it has them", () => {
      expect(buildDocumentHtml(applicationFor(id, asOwn), profile, "lebenslauf")).not.toBe(buildDocumentHtml(applicationFor(id), profile, "lebenslauf"));
      expect(previewHtml(id, asOwn)).not.toBe(previewHtml(id, base));
    });

    it("gives preview and PDF the same resolved values", () => {
      const scopes = [
        pdfPages(buildDocumentHtml(applicationFor(id, asOwn), profile, "lebenslauf"))[0].querySelector(".page-content"),
        parseHTML(`<body>${previewHtml(id, asOwn)}</body>`).document.querySelector(".managed-resume-preview")?.firstElementChild,
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
      const pdf = buildDocumentHtml(applicationFor(id, asOwn), profile, "lebenslauf");
      const preview = previewHtml(id, asOwn);
      for (const html of [pdf, preview]) {
        const { document } = parseHTML(html.includes("<body>") ? html : `<body>${html}</body>`);
        const titled = Array.from(document.querySelectorAll("[data-managed-section]"))
          .flatMap((section) => Array.from(section.querySelectorAll("h2,h3,[data-cv-heading]")).slice(0, 1));
        expect(titled.some((heading) => /font-size:\s*13pt/.test(heading.getAttribute("style") ?? "")), id).toBe(true);
        expect(titled.some((heading) => /text-align:\s*center/.test(heading.getAttribute("style") ?? "")), id).toBe(true);
      }
    });
  });

  it("lets the page planner see the values of the Bewerbung, like the other outputs", () => {
    const heavy = profileSchema.parse({ ...profile, experiences: profile.experiences.map((item) => ({
      ...item, achievements: [...item.achievements, ...Array.from({ length: 12 }, () => "Koordination komplexer Abläufe mit mehreren Beteiligten und termingerechter Umsetzung.")],
    })) });
    for (const id of ["klassisch", "kreativ", "pehlione_white_blue"]) {
      const settings = getTemplateDocumentDesignDefaults(id);
      const plain = resolveCvDocument({ profile: heavy, templateId: id, settings });
      const own = resolveCvDocument({ profile: heavy, templateId: id, settings: { ...settings, cvOverrides: { typography: { bodySizePt: 12, lineHeight: 1.6 }, spacing: { sectionGapMm: 12 } } } });
      expect(JSON.stringify(own.pagePlan), id).not.toBe(JSON.stringify(plain.pagePlan));
      expect(createResumePagePlan(heavy, "", {}, id).length, id).toBeGreaterThan(0);
    }
  });
});

/** Both outputs apply the same spacing; Zweispaltig owns a physical page box. */
describe("Seitenränder and Innenabstand in preview and PDF", () => {
  type Spacing = { pageMarginMm?: number; innerPaddingMm?: number };
  const own = (id: string, spacing: Spacing) => ({ ...getTemplateDocumentDesignDefaults(id), ...(Object.keys(spacing).length ? { cvOverrides: { spacing } } : {}) });
  const outputs = (id: string, settings: ReturnType<typeof own>) => ({
    pdf: buildDocumentHtml(applicationFor(id, settings), profile, "lebenslauf"),
    preview: previewHtml(id, settings),
  });
  const scopeOf = (html: string, surface: "pdf" | "preview") => surface === "pdf"
    ? pdfPages(html)[0].querySelector(".page-content")
    : parseHTML(`<body>${html}</body>`).document.querySelector(".managed-resume-preview")?.firstElementChild ?? null;
  const styleOf = (element: Element | null): Record<string, string> => Object.fromEntries((element?.getAttribute("style") ?? "").split(";").filter(Boolean).map((part) => {
    const at = part.indexOf(":");
    return [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  }));
  const only = (style: Record<string, string>, names: string[]) => Object.fromEntries(names.filter((name) => style[name] !== undefined).map((name) => [name, style[name]]));
  const marginStyle = (scope: Element | null) => only(styleOf(scope), ["--doc-page-margin", "--resume-page-text-shift"]);
  const paddingStyle = (scope: Element | null) => only(styleOf(scope), ["--doc-inner-padding", "--doc-padding", "--resume-inner-text-inset"]);
  const textInset = (scope: Element | null) => scope?.hasAttribute("data-resume-spacing-text") ?? false;
  const inlinePaddings = (scope: Element | null) => scope?.querySelectorAll('[style*="padding-inline"],[style*="padding-left"],[style*="padding-right"]').length ?? 0;
  const rule = "[data-resume-spacing-text] [data-managed-section] >";

  it("keeps Zweispaltig's header, columns and footer within symmetric chosen margins", () => {
    const id = "zweispaltig";
    const defaults = getTemplateDocumentDesignDefaults(id);
    for (const surface of ["pdf", "preview"] as const) {
      const original = scopeOf(outputs(id, defaults)[surface], surface);
      expect(styleOf(original)["--zweispaltig-margin-left"]).toBe("25mm");
      expect(styleOf(original)["--zweispaltig-margin-right"]).toBe("20mm");
      for (const mm of [15, 20, 25]) {
        const selected = scopeOf(outputs(id, own(id, { pageMarginMm: mm }))[surface], surface);
        expect(styleOf(selected)["--zweispaltig-margin-left"]).toBe(`${mm}mm`);
        expect(styleOf(selected)["--zweispaltig-margin-right"]).toBe(`${mm}mm`);
        expect(selected?.hasAttribute("data-resume-spacing-text")).toBe(false);
        expect(selected?.querySelector(surface === "pdf" ? ".zweispaltig-pdf-header" : ".zweispaltig-header")).not.toBeNull();
        expect(selected?.querySelector(surface === "pdf" ? ".zweispaltig-pdf-columns" : ".zweispaltig-columns")).not.toBeNull();
      }
      const legacy = scopeOf(outputs(id, { ...defaults, marginLevel: 7 })[surface], surface);
      expect(styleOf(legacy)["--zweispaltig-margin-left"]).toBe("20mm");
      expect(styleOf(legacy)["--zweispaltig-margin-right"]).toBe("20mm");
    }
  });

  it.each(templates)("applies each setting on its own and both as their sum, alike in preview and PDF of $name", ({ id }) => {
    const nativePadding = resolveTemplateCvDesign(id).spacing.innerPaddingMm;
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
        // These layouts change their physical page box; the others shift managed text.
        expect(marginStyle(scope(name)), `${surface} ${name}`).not.toEqual(marginStyle(nativeScope));
        expect(paddingStyle(scope(name)), `${surface} ${name}`).toEqual(paddingStyle(nativeScope));
        expect(textInset(scope(name)), `${surface} ${name}`).toBe(id !== "zweispaltig" && id !== "zeitgenoessisch" && id !== "kreativ" && id !== "stilvoll");
        if (id === "zweispaltig") {
          const chosen = name === "margin" ? "16mm" : "6mm";
          expect(styleOf(scope(name))["--zweispaltig-margin-left"]).toBe(chosen);
          expect(styleOf(scope(name))["--zweispaltig-margin-right"]).toBe(chosen);
          expect(styleOf(scope(name))["--resume-page-text-shift"]).toBeUndefined();
        }
        if (id === "stilvoll") {
          const chosen = name === "margin" ? 16 : 6;
          expect(styleOf(scope(name))["--stilvoll-margin-left"]).toBe(`${chosen + 5}mm`);
          expect(styleOf(scope(name))["--stilvoll-margin-right"]).toBe(`${chosen}mm`);
          expect(styleOf(scope(name))["--stilvoll-margin-bottom"]).toBe("15mm");
          expect(styleOf(scope(name))["--resume-page-text-shift"]).toBeUndefined();
        }
      }
      expect(paddingStyle(scope("padding")), surface).toEqual({ "--doc-inner-padding": "2.5mm", "--doc-padding": "2.5mm", "--resume-inner-text-inset": `${2.5 - nativePadding}mm` });
      expect(marginStyle(scope("padding")), surface).toEqual(marginStyle(nativeScope));
      expect(textInset(scope("padding")), surface).toBe(true);
      // Both together are the sum of the two, and a new padding leaves the margin exactly as it was.
      expect(marginStyle(scope("both")), surface).toEqual(marginStyle(scope("margin")));
      expect(paddingStyle(scope("both")), surface).toEqual(paddingStyle(scope("padding")));
      expect(textInset(scope("both")), surface).toBe(true);
      expect(marginStyle(scope("bothLess")), surface).toEqual(marginStyle(scope("both")));
      expect(paddingStyle(scope("bothLess")), surface).toEqual({ "--doc-inner-padding": "2mm", "--doc-padding": "2mm", "--resume-inner-text-inset": `${2 - nativePadding}mm` });
      expect(marginStyle(scope("smallerBoth")), surface).toEqual(marginStyle(scope("smaller")));
      // No setting writes a padding onto an element of the template: the ones that form its margin stay as they are.
      for (const name of Object.keys(changes) as (keyof typeof changes)[])
        expect(inlinePaddings(scope(name)), `${surface} ${name}`).toBe(inlinePaddings(nativeScope));
      // The shared rule applies only to managed section content.
      expect(changes.padding[surface], surface).toContain(rule);
    }
    // Preview and PDF read the same values and mark the same text scope.
    for (const [name, output] of Object.entries(changes)) {
      const preview = scopeOf(output.preview, "preview");
      const pdf = scopeOf(output.pdf, "pdf");
      expect(marginStyle(preview), name).toEqual(marginStyle(pdf));
      expect(paddingStyle(preview), name).toEqual(paddingStyle(pdf));
      expect(textInset(preview), name).toBe(textInset(pdf));
    }
  });

  it.each(templates)("draws an older shared margin folded into an own padding, and the reverse, like two own values in $name", ({ id }) => {
    const both = outputs(id, own(id, { pageMarginMm: 16, innerPaddingMm: 2.5 }));
    const sharedMargin = outputs(id, applyGlobalResumeDesign(own(id, { innerPaddingMm: 2.5 }), { cvOverrides: { spacing: { pageMarginMm: 16 } } }));
    const sharedPadding = outputs(id, applyGlobalResumeDesign(own(id, { pageMarginMm: 16 }), { cvOverrides: { spacing: { innerPaddingMm: 2.5 } } }));
    for (const surface of ["pdf", "preview"] as const) {
      expect(sharedMargin[surface], `${surface}: shared margin, own padding`).toBe(both[surface]);
      expect(sharedPadding[surface], `${surface}: shared padding, own margin`).toBe(both[surface]);
    }
  });
});

describe("two-column geometry stays independent of text spacing", () => {
  const ids = ["pehlione_white", "pehlione_white_blue", "zweispaltig", "zeitgenoessisch", "kreativ", "stilvoll", "kompakt", "gepflegt", "elegant", "modern"];
  it.each(ids.flatMap((id) => [30, 35, 40].map((percent) => ({ id, percent }))))("keeps $id at $percent / main ratio in preview and PDF", ({ id, percent }) => {
    const settings = {
      ...getTemplateDocumentDesignDefaults(id),
      resumePresentation: { layoutMode: "two-column" as const, sidebarWidthPercent: percent as 30 | 35 | 40 },
      cvOverrides: { spacing: { pageMarginMm: 16, innerPaddingMm: 3, columnGapMm: 5 } },
    };
    const native = {
      pdf: buildDocumentHtml(applicationFor(id), profile, "lebenslauf"),
      preview: previewHtml(id, getTemplateDocumentDesignDefaults(id)),
    };
    const changed = {
      pdf: buildDocumentHtml(applicationFor(id, settings), profile, "lebenslauf"),
      preview: previewHtml(id, settings),
    };
    for (const surface of ["pdf", "preview"] as const) {
      const document = parseHTML(changed[surface]).document;
      const root = surface === "pdf" ? document.querySelector(".cv-sheet") : document.querySelector(".managed-resume-preview");
      const host = root?.querySelector('[data-resume-layout="two-column"]');
      expect(host, `${id} ${surface}`).not.toBeNull();
      const columns = (host as HTMLElement).style.gridTemplateColumns;
      expect(columns, `${id} ${surface}`).toContain(`${percent}fr`);
      expect(columns, `${id} ${surface}`).toContain(`${100 - percent}fr`);
      const scope = surface === "pdf" ? root?.querySelector(".page-content") : root?.firstElementChild;
      const scopeStyle = (scope as HTMLElement | null)?.style;
      expect(scopeStyle?.padding, `${id} ${surface}`).toBe("");
      expect(scopeStyle?.margin, `${id} ${surface}`).toBe("");
      expect(scopeStyle?.width, `${id} ${surface}`).toBe("");
      expect(scopeStyle?.height, `${id} ${surface}`).toBe("");
      expect(scope?.hasAttribute("data-resume-spacing-text")).toBe(true);
      const nativeDoc = parseHTML(native[surface]).document;
      expect(document.querySelectorAll("[data-resume-background-layer]").length).toBe(nativeDoc.querySelectorAll("[data-resume-background-layer]").length);
      const photoDecoration = '[class*="photo-shape"],[class*="photo-pale"],[class*="photo-soft"],[class*="photo-accent"]';
      expect(document.querySelectorAll(photoDecoration).length).toBe(nativeDoc.querySelectorAll(photoDecoration).length);
    }
  });
});

describe("long two-column CVs", () => {
  it.each(["pehlione_white", "pehlione_white_blue", "zweispaltig", "zeitgenoessisch", "kreativ", "stilvoll", "kompakt", "gepflegt", "elegant", "modern"])("keeps every achievement once across all preview and PDF pages in %s", (id) => {
    const achievements = Array.from({ length: 18 }, (_, entry) => Array.from({ length: 7 }, (_, bullet) => `Leistung ${entry + 1}.${bullet + 1} erfolgreich abgeschlossen.`));
    const longProfile = profileSchema.parse({ ...profile, experiences: achievements.map((lines, index) => ({
      id: crypto.randomUUID(), from: "2020", to: "2024", role: `Position ${index + 1}`, company: "Firma", achievements: lines,
    })) });
    const settings = getTemplateDocumentDesignDefaults(id);
    const resolved = resolveCvDocument({ profile: longProfile, templateId: id, settings });
    expect(resolved.pagePlan.length).toBeGreaterThan(2);
    const pdf = buildDocumentHtml(applicationFor(id, settings), longProfile, "lebenslauf");
    expect(pdfPages(pdf)).toHaveLength(resolved.pagePlan.length);
    const preview = resolved.pagePlan.map((plan) => {
      const child = createElement(components[id] as ComponentType<Record<string, unknown>>, {
        profile: resolved.profile, templateId: id, name: "Mina Kaya", atsMode: false, plan,
        totalPages: resolved.pagePlan.length, accentColor: "#123456", secondaryColor: "#234567",
        photoSource: null, resumeProfile: "", sections: resolved.sections, backgroundId: settings.backgroundId,
      });
      return renderToStaticMarkup(createElement(ManagedResumePreview, {
        profile: resolved.profile, templateId: id, pageNumber: plan.pageNumber, totalPages: resolved.pagePlan.length,
        designSettings: resolved.settings, resolvedCv: resolved, children: child,
      }));
    }).join("");
    const texts = [parseHTML(pdf).document.body.textContent ?? "", parseHTML(`<html><body>${preview}</body></html>`).document.body.textContent ?? ""];
    for (const text of texts) for (const line of achievements.flat())
      expect(text.split(line).length - 1, `${id}: ${line}`).toBe(1);
  });
});
