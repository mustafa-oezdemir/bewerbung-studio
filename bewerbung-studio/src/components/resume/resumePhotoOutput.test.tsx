import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { applicationSchema, profileSchema, type Application } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
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
  elegant: ElegantResume, einspaltig: EinspaltigResume, gepflegt: GepflegtResume, klassisch: KlassischResume, kompakt: KompaktResume,
  kreativ: KreativResume, "ivy-league": IvyLeagueResume, modern: ModernResume, pehlione_white: PehlioneResume, pehlione_white_blue: PehlioneResume,
  stilvoll: StilvollResume, tabellarisch: TabellarischResume, zeitgenoessisch: ZeitgenoessischResume, zweispaltig: ZweispaltigResume,
};
// Ivy League draws no photo at all (its native photo layout is "hidden"): it must not start to show one.
const photoTemplates = Object.keys(components).filter((id) => id !== "ivy-league");

const now = new Date("2026-10-02T10:00:00.000Z").toISOString();
const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const photoVisible = [{ semanticType: "photo", customTitle: "", visible: true, enabled: true, order: 2 }];
const base = {
  id: "87000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mustafa", lastName: "Özdemir", title: "Projektleiter",
  street: "Musterstraße 10", postalCode: "12345", city: "Stuttgart", country: "Deutschland", phone: "+49 170 1234567", email: "mustafa@example.com",
  summary: "Erfahrener Projektleiter.", signaturePath: signature, photoPath: photo, resumeSemanticSections: photoVisible, updatedAt: now,
};
const make = (change: Record<string, unknown> = {}) => profileSchema.parse({ ...base, ...change });

const applicationFor = (templateId: string, overrides: Partial<Application["designSettings"]> = {}): Application => {
  const template = getTemplate(templateId);
  return applicationSchema.parse({
    schemaVersion: 1, id: "88000000-0000-4000-8000-000000000001", folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: { ...getTemplateDocumentDesignDefaults(templateId), ...overrides }, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
  });
};

/** Preview and PDF page 1 of one template as HTML. */
const render = (templateId: string, profile: ReturnType<typeof make>, overrides: Partial<Application["designSettings"]> = {}) => {
  const application = applicationFor(templateId, overrides);
  const settings = application.designSettings;
  const template = getTemplate(templateId);
  const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: "" });
  const atsMode = settings.resumeOutputMode === "ats";
  const component = components[templateId] as ComponentType<Record<string, unknown>>;
  const preview = renderToStaticMarkup(
    <ManagedResumePreview designSettings={settings} resolvedCv={resolved} profile={resolved.profile} templateId={templateId} pageNumber={1} totalPages={resolved.pagePlan.length}>
      {createElement(component, {
        profile: resolved.profile, templateId, name: "Mustafa Özdemir", atsMode, plan: resolved.pagePlan[0], totalPages: resolved.pagePlan.length,
        accentColor: template.accent, secondaryColor: template.secondary, photoSource: resolved.profile?.photoPath || null,
        resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white",
      })}
    </ManagedResumePreview>,
  );
  return { preview, pdf: buildDocumentHtml(application, profile, "lebenslauf"), application };
};

const scaleOf = (html: string) => [...html.matchAll(/--resume-photo-scale:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
// What an output looks like without the scale: the variable (and a style attribute it leaves empty) removed.
const withoutScale = (html: string) =>
  html.replace(/\s*--resume-photo-scale:\s*[0-9.]+;?/g, "").replace(/ style=""/g, "").replace(/;"/g, '"');
const plain = (html: string) => html.replace(/;"/g, '"');
// The photo is a JPEG in these fixtures, the signature (always drawn when set) a PNG: they are counted apart.
const photoCount = (html: string) => (html.match(/<img[^>]+src="data:image\/jpeg/g) ?? []).length;

describe.each(photoTemplates)("Fotogröße of %s", (templateId) => {
  const legacy = render(templateId, make());
  const medium = render(templateId, make({ resumePhotoSize: "medium" }));
  const small = render(templateId, make({ resumePhotoSize: "small" }));
  const large = render(templateId, make({ resumePhotoSize: "large" }));

  it("draws the photo at every size", () => {
    for (const result of [legacy, small, medium, large]) for (const surface of ["preview", "pdf"] as const)
      expect(photoCount(result[surface]), surface).toBeGreaterThan(0);
  });

  it("keeps a profile without the setting exactly as Mittel: no scale, identical output", () => {
    for (const surface of ["preview", "pdf"] as const) {
      expect(scaleOf(legacy[surface]), surface).toEqual([]);
      expect(scaleOf(medium[surface]), surface).toEqual([]);
      expect(legacy[surface], surface).toBe(medium[surface]);
    }
  });

  it("scales by the same step in the preview and in the PDF", () => {
    for (const surface of ["preview", "pdf"] as const) {
      expect(scaleOf(small[surface]), `${surface} small`).toEqual([0.8]);
      expect(scaleOf(large[surface]), `${surface} large`).toEqual([1.2]);
    }
  });

  it("changes nothing but the scale: shape, header layout, columns and visibility stay", () => {
    for (const surface of ["preview", "pdf"] as const) {
      expect(withoutScale(small[surface]), `${surface} small`).toBe(plain(medium[surface]));
      expect(withoutScale(large[surface]), `${surface} large`).toBe(plain(medium[surface]));
    }
  });

  it("keeps the shape and the header layout the user chose independent of the size", () => {
    const rounded = { resumeAppearance: { photoLayout: "rounded" as const, headerLayout: "center" as const } };
    const mediumShaped = render(templateId, make(), rounded);
    const largeShaped = render(templateId, make({ resumePhotoSize: "large" }), rounded);
    for (const surface of ["preview", "pdf"] as const) expect(withoutScale(largeShaped[surface])).toBe(plain(mediumShaped[surface]));
  });

  it("draws no photo and sets no scale when the photo is switched off in the Lebenslauf", () => {
    const hidden = render(templateId, make({ resumePhotoSize: "large", resumeSemanticSections: [{ semanticType: "photo", customTitle: "", visible: false, enabled: false, order: 2 }] }));
    for (const surface of ["preview", "pdf"] as const) {
      expect(photoCount(hidden[surface]), surface).toBe(0);
      expect(scaleOf(hidden[surface]), surface).toEqual([]);
    }
  });

  it("draws no photo and sets no scale after the photo was removed, and brings the size back with the next photo", () => {
    const removed = render(templateId, make({ resumePhotoSize: "large", photoPath: "" }));
    for (const surface of ["preview", "pdf"] as const) {
      expect(photoCount(removed[surface]), surface).toBe(0);
      expect(scaleOf(removed[surface]), surface).toEqual([]);
    }
    const replaced = render(templateId, make({ resumePhotoSize: "large", photoPath: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==" }));
    for (const surface of ["preview", "pdf"] as const) expect(scaleOf(replaced[surface]), surface).toEqual([1.2]);
  });

  it("shows no photo in the plain (ATS) layout at any size", () => {
    const ats = render(templateId, make({ resumePhotoSize: "large" }), { resumeOutputMode: "ats" });
    for (const surface of ["preview", "pdf"] as const) {
      expect(photoCount(ats[surface]), surface).toBe(0);
      expect(scaleOf(ats[surface]), surface).toEqual([]);
    }
  });

  it("sets no scale when the photo's shape is hidden in the design", () => {
    const shapeHidden = render(templateId, make({ resumePhotoSize: "large" }), { resumeAppearance: { photoLayout: "hidden" } });
    for (const surface of ["preview", "pdf"] as const) expect(scaleOf(shapeHidden[surface]), surface).toEqual([]);
  });
});

describe("a template without a photo", () => {
  it("does not start to show one, whatever the size", () => {
    for (const size of ["small", "medium", "large"]) {
      const result = render("ivy-league", make({ resumePhotoSize: size }));
      for (const surface of ["preview", "pdf"] as const) {
        expect(photoCount(result[surface]), `${surface} ${size}`).toBe(0);
        expect(scaleOf(result[surface]), `${surface} ${size}`).toEqual([]);
      }
    }
  });
});

describe("the Deckblatt keeps its own photo", () => {
  it("does not change with the Fotogröße of the Lebenslauf", () => {
    const attachments: never[] = [];
    const html = (size: string) => buildDocumentHtml(applicationFor("klassisch"), make({ resumePhotoSize: size }), "deckblatt", attachments);
    expect(html("large")).toBe(html("medium"));
    expect(html("small")).toBe(html("medium"));
    expect(scaleOf(html("large"))).toEqual([]);
    expect(html("large")).toContain("data:image/jpeg");
  });

  it("does not use the size in its own CSS", () => {
    expect(readFileSync(resolve(process.cwd(), "src/shared/deckblattDesigns.ts"), "utf8")).not.toContain("resume-photo-scale");
  });
});

describe("one adapter: every native photo length is multiplied, never replaced", () => {
  const css = [
    "elegant/elegant", "gepflegt/gepflegt", "einspaltig/einfach", "klassisch/klassisch", "stilvoll/stilvoll", "kompakt/kompakt", "kreativ/kreativ",
    "modern/modern", "tabellarisch/tabellarisch", "zeitgenoessisch/zeitgenoessisch", "zweispaltig/zweispaltig", "pehlione/pehlione",
  ].map((file) => ({ file, css: readFileSync(resolve(process.cwd(), `src/components/resume/templates/${file}.css`), "utf8") }));
  const pdf = readFileSync(resolve(process.cwd(), "electron/documents.ts"), "utf8");

  it.each(css.map((entry) => entry.file))("%s multiplies its photo with --resume-photo-scale in the preview CSS", (file) => {
    expect(css.find((entry) => entry.file === file)!.css).toMatch(/--resume-photo-scale, ?1/);
  });

  it("does the same in the PDF CSS and keeps no template-wide millimetre for the photo", () => {
    for (const selector of ["elegant-pdf-photo", "zweispaltig-pdf-photo", "zeit-pdf-photo-composition", "kreativ-pdf-photo", "kompakt-pdf-photo", "stilvoll-pdf-photo",
      "einfach-pdf-photo", "klassisch-pdf-photo", "modern-pdf-photo", "gepflegt-pdf-photo", "tabellarisch-pdf-photo", "pehlione-pdf-hero"]) {
      const rule = new RegExp(`\\.${selector}\\{[^}]*\\}`).exec(pdf)?.[0] ?? "";
      expect(rule, selector).toContain("--resume-photo-scale,1");
    }
    // No single size is shared: every template keeps its own native value inside its own calc().
    const natives = [...pdf.matchAll(/calc\((\d+(?:\.\d+)?)mm \* var\(--resume-photo-scale,1\)\)/g)].map((match) => match[1]);
    expect(new Set(natives).size).toBeGreaterThan(6);
  });
});
