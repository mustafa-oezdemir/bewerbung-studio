import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { getManagerSections, updateManagerSection } from "../features/resume-sections/resume-manager";
import { getResumeSemanticSection } from "../features/resume-sections/resume-section-system";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { defaultDocumentDesign } from "./documentDesign";
import { createResumePagePlan } from "./documentPagination";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import {
  applyResumePhotoOutput,
  copyResumePhotoSettings,
  getResumePhotoGrowth,
  getResumePhotoScale,
  isResumePhotoVisible,
  removeResumePhoto,
  resolveResumePhotoSize,
  resumePhotoLargeGrowthMm,
  resumePhotoScales,
  resumePhotoShown,
  resumePhotoSizeLabels,
  resumePhotoSizes,
  setResumePhoto,
  setResumePhotoSize,
  setResumePhotoVisible,
} from "./resumePhoto";
import { profileSchema } from "./schema";
import { templates } from "./templates";

const photo = "data:image/png;base64,iVBORw0KGgo=";
const other = "data:image/jpeg;base64,/9j/4AAQ";
const base = {
  id: "85000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mustafa", lastName: "Özdemir",
  photoPath: photo, updatedAt: "2026-10-02T00:00:00.000Z",
};
const profile = (change: Record<string, unknown> = {}) => profileSchema.parse({ ...base, ...change });

describe("Fotogröße data model", () => {
  it("has exactly three steps, Klein / Mittel / Groß", () => {
    expect(resumePhotoSizes).toEqual(["small", "medium", "large"]);
    expect(Object.values(resumePhotoSizeLabels)).toEqual(["Klein", "Mittel", "Groß"]);
    expect(Object.keys(resumePhotoScales)).toEqual(["small", "medium", "large"]);
  });

  it("scales the template's native photo: Klein smaller, Mittel the native photo itself, Groß larger", () => {
    expect(resumePhotoScales.small).toBeLessThan(1);
    expect(resumePhotoScales.medium).toBe(1);
    expect(resumePhotoScales.large).toBeGreaterThan(1);
  });

  it("is typed and validated: no other value is accepted", () => {
    for (const size of resumePhotoSizes) expect(profile({ resumePhotoSize: size }).resumePhotoSize).toBe(size);
    for (const value of ["huge", "30mm", "", 30, null, "Mittel"]) expect(() => profile({ resumePhotoSize: value }), String(value)).toThrow();
  });

  it("is Mittel for a profile saved before the setting existed", () => {
    const legacy = profile();
    expect(legacy.resumePhotoSize).toBe("medium");
    expect(resolveResumePhotoSize(legacy)).toBe("medium");
    expect(getResumePhotoScale(legacy)).toBe(1);
    expect(resolveResumePhotoSize(undefined)).toBe("medium");
    expect(getResumePhotoScale({ resumePhotoSize: "large" })).toBe(1.2);
  });
});

describe("the scale reaches the page, and only when it matters", () => {
  const page = (surface: "preview" | "pdf", withPhoto = true) => {
    const { document } = parseHTML(surface === "pdf"
      ? `<html><body><section class="cv-sheet"><div class="page-content">${withPhoto ? `<img src="${photo}">` : ""}</div></section></body></html>`
      : `<html><body><div id="r"><article class="template">${withPhoto ? `<img src="${photo}">` : ""}</article></div></body></html>`);
    return surface === "pdf" ? document.querySelector(".cv-sheet")! : document.getElementById("r")!;
  };
  const scale = (element: Element) => element.querySelector<HTMLElement>(".page-content, .template")?.style.getPropertyValue("--resume-photo-scale");

  it.each(["preview", "pdf"] as const)("sets one variable in the %s for Klein and Groß", (surface) => {
    const small = page(surface); applyResumePhotoOutput(small, surface, { resumePhotoSize: "small" });
    const large = page(surface); applyResumePhotoOutput(large, surface, { resumePhotoSize: "large" });
    expect(scale(small)).toBe("0.8");
    expect(scale(large)).toBe("1.2");
  });

  it.each(["preview", "pdf"] as const)("writes nothing in the %s for Mittel, a legacy profile, or a page without a photo", (surface) => {
    for (const settings of [{ resumePhotoSize: "medium" as const }, undefined, profile()]) {
      const element = page(surface); applyResumePhotoOutput(element, surface, settings);
      expect(scale(element)).toBe("");
    }
    const none = page(surface, false); applyResumePhotoOutput(none, surface, { resumePhotoSize: "large" });
    expect(scale(none)).toBe("");
  });
});

describe("independence of size, shape and visibility", () => {
  it("changes only the size when the size changes", () => {
    const before = profile({ resumeColumnRatio: 33, resumePersonalFieldVisibility: {}, resumeSemanticSections: [{ semanticType: "photo", customTitle: "", visible: true, enabled: true, order: 2 }] });
    const after = setResumePhotoSize(before, "large");
    expect(after.resumePhotoSize).toBe("large");
    expect({ ...after, resumePhotoSize: before.resumePhotoSize }).toEqual(before);
    expect(after.resumeColumnRatio).toBe(33);
    expect(isResumePhotoVisible(after)).toBe(true);
    expect(after.photoPath).toBe(photo);
  });

  it("hides the photo in the Lebenslauf without deleting it, and shows it again", () => {
    const visible = setResumePhotoVisible(profile(), true);
    expect(isResumePhotoVisible(visible)).toBe(true);
    expect(getResumeDisplayProfile(visible)?.photoPath).toBe(photo);
    const hidden = setResumePhotoVisible(visible, false);
    expect(isResumePhotoVisible(hidden)).toBe(false);
    expect(hidden.photoPath).toBe(photo);
    expect(getResumeDisplayProfile(hidden)?.photoPath).toBe("");
    expect(getResumeDisplayProfile(setResumePhotoVisible(hidden, true))?.photoPath).toBe(photo);
  });

  it("writes the visibility exactly like the eye of the section panel", () => {
    for (const visible of [true, false]) {
      const fromProfile = setResumePhotoVisible(profile(), visible);
      const fromPanel = updateManagerSection(profile(), "modern", "photo", { visible });
      expect(fromProfile.resumeSemanticSections).toEqual(fromPanel.resumeSemanticSections);
      expect(fromProfile.resumeManagerOverrides).toEqual(fromPanel.resumeManagerOverrides);
      expect(getManagerSections(fromProfile, "modern").find((entry) => entry.id === "photo")?.visible).toBe(visible);
    }
  });

  it("keeps the semantic section the one source of truth: an older profile has no photo in the Lebenslauf until it is switched on", () => {
    const legacy = profile();
    expect(isResumePhotoVisible(legacy)).toBe(false);
    expect(getResumeSemanticSection(legacy.resumeSemanticSections, "photo").visible).toBe(false);
    expect(getResumeDisplayProfile(legacy)?.photoPath).toBe("");
  });
});

describe("the picture", () => {
  it("keeps the size and the visibility when the picture is replaced", () => {
    const set = setResumePhotoSize(setResumePhotoVisible(profile(), false), "large");
    const replaced = setResumePhoto(set, other);
    expect(replaced.photoPath).toBe(other);
    expect(replaced.resumePhotoSize).toBe("large");
    expect(isResumePhotoVisible(replaced)).toBe(false);
  });

  it("uses a first photo in the Lebenslauf at once", () => {
    const first = setResumePhoto(profile({ photoPath: "" }), photo);
    expect(first.photoPath).toBe(photo);
    expect(isResumePhotoVisible(first)).toBe(true);
    expect(first.resumePhotoSize).toBe("medium");
  });

  it("removes the picture only: size and visibility stay for the next one", () => {
    const set = setResumePhotoSize(setResumePhotoVisible(profile(), true), "small");
    const removed = removeResumePhoto(set);
    expect(removed.photoPath).toBe("");
    expect(removed.resumePhotoSize).toBe("small");
    expect(isResumePhotoVisible(removed)).toBe(true);
    expect(resumePhotoShown(getResumeDisplayProfile(removed), undefined)).toBe(false);
  });

  it("never touches the Unterschrift", () => {
    const signed = profile({ signaturePath: "data:image/png;base64,iVBORw0KGgo=" });
    for (const next of [setResumePhoto(signed, other), removeResumePhoto(signed), setResumePhotoSize(signed, "large"), setResumePhotoVisible(signed, true)])
      expect(next.signaturePath).toBe(signed.signaturePath);
  });

  it("saves the photo settings of the section and nothing else of the profile", () => {
    const persisted = profile({ summary: "gespeichert", resumeSemanticSections: [{ semanticType: "heading", customTitle: "Mein CV", visible: true, enabled: true, order: 0 }] });
    const draft = setResumePhotoSize(setResumePhotoVisible({ ...persisted, summary: "nur im Entwurf", photoPath: other }, true), "large");
    const saved = copyResumePhotoSettings(draft, persisted);
    expect(saved).toMatchObject({ photoPath: other, resumePhotoSize: "large", summary: "gespeichert" });
    expect(isResumePhotoVisible(saved)).toBe(true);
    expect(getResumeSemanticSection(saved.resumeSemanticSections, "heading").customTitle).toBe("Mein CV");
  });
});

describe("shape: a hidden photo gets no size", () => {
  it("is shown only with a picture and a shape other than hidden", () => {
    expect(resumePhotoShown({ photoPath: photo }, undefined)).toBe(true);
    expect(resumePhotoShown({ photoPath: "" }, undefined)).toBe(false);
    expect(resumePhotoShown({ photoPath: "not-an-image" }, undefined)).toBe(false);
    expect(resumePhotoShown({ photoPath: photo }, { resumeAppearance: { photoLayout: "hidden" } })).toBe(false);
    for (const photoLayout of ["circle", "rounded", "square", "template"] as const)
      expect(resumePhotoShown({ photoPath: photo }, { resumeAppearance: { photoLayout } })).toBe(true);
  });
});

describe("page planner", () => {
  // The same entries (and ids) for every plan: the plans are compared with each other.
  const experiences = Array.from({ length: 7 }, (_, index) => ({
    id: `86000000-0000-4000-8000-00000000000${index}`, from: `${2010 + index}`, to: `${2011 + index}`, role: `Rolle ${index}`, company: `Firma ${index}`, city: "Berlin",
    achievements: Array.from({ length: 6 }, (_, item) => `Ergebnis ${item} mit messbarer Verbesserung der Abläufe in der Abteilung ${index}.`),
  }));
  const long = (change: Record<string, unknown> = {}) => profile({
    summary: "Erfahrener Entwickler.", skills: ["TypeScript", "React", "Node.js"], languages: ["Deutsch – C1"], experiences,
    resumeSemanticSections: [{ semanticType: "photo", customTitle: "", visible: true, enabled: true, order: 2 }],
    ...change,
  });
  const plan = (source: ReturnType<typeof long>, templateId: string, atsMode = false) =>
    createResumePagePlan(getResumeDisplayProfile(source), source.summary, {}, templateId, {
      atsMode, settings: { ...defaultDocumentDesign, ...getTemplateDocumentDesignDefaults(templateId) },
    });

  it("reserves room only for Groß and only for a template that has a photo", () => {
    expect(getResumePhotoGrowth("kreativ", { resumePhotoSize: "small" })).toEqual({ main: 0, side: 0 });
    expect(getResumePhotoGrowth("kreativ", { resumePhotoSize: "medium" })).toEqual({ main: 0, side: 0 });
    expect(getResumePhotoGrowth("kreativ", { resumePhotoSize: "large" }).main).toBeGreaterThan(0);
    expect(getResumePhotoGrowth("ivy-league", { resumePhotoSize: "large" })).toEqual({ main: 0, side: 0 });
    for (const { id } of templates.filter((template) => template.id !== "ivy-league")) {
      const growth = resumePhotoLargeGrowthMm[id];
      expect(growth, id).toBeDefined();
      expect(growth.main + growth.side, id).toBeGreaterThan(0);
    }
    // The Pehlione hero and the sidebar photo templates grow the sidebar; the header templates grow the page top.
    expect(resumePhotoLargeGrowthMm.pehlione_white.side).toBeGreaterThan(0);
    expect(resumePhotoLargeGrowthMm.gepflegt).toMatchObject({ main: 0 });
  });

  it.each(templates.map((template) => template.id))("plans %s for Mittel, Klein and an older profile identically", (id) => {
    const reference = JSON.stringify(plan(long({ resumePhotoSize: "medium" }), id));
    expect(JSON.stringify(plan(long(), id))).toBe(reference);
    if (id === "kreativ" || id === "klassisch") {
      // Kreativ and Klassisch measure their actual header and photo size, so Klein may free one more bullet on page one.
      const small = plan(long({ resumePhotoSize: "small" }), id);
      const medium = plan(long({ resumePhotoSize: "medium" }), id);
      expect(small).toHaveLength(medium.length);
      expect(small[0].items.length).toBeGreaterThanOrEqual(medium[0].items.length);
    } else expect(JSON.stringify(plan(long({ resumePhotoSize: "small" }), id))).toBe(reference);
  });

  it.each(templates.map((template) => template.id))("never puts more on page one of %s for Groß than for Mittel", (id) => {
    const count = (source: ReturnType<typeof long>) => plan(source, id)[0].items.length;
    expect(count(long({ resumePhotoSize: "large" }))).toBeLessThanOrEqual(count(long({ resumePhotoSize: "medium" })));
  });

  it("moves an entry to page two when the bigger photo takes the room it needed", () => {
    const firstPageBullets = (source: ReturnType<typeof long>, id: string) => plan(source, id)[0].items
      .reduce((total, item) => total + (item.bullets ? item.bullets.to - item.bullets.from : 0), 0);
    // Klassisch computes its header from the photo: on a full page one (a longer summary) Groß costs a bullet.
    const full = (size: "medium" | "large") => long({ resumePhotoSize: size, summary: "Erfahrener Entwickler. ".repeat(34).trim() });
    const lost = ["zweispaltig", "einspaltig", "stilvoll", "kreativ"].filter(id =>
      firstPageBullets(long({ resumePhotoSize: "large" }), id) < firstPageBullets(long({ resumePhotoSize: "medium" }), id))
      .concat(firstPageBullets(full("large"), "klassisch") < firstPageBullets(full("medium"), "klassisch") ? ["klassisch"] : []);
    expect(lost).toContain("klassisch");
  });

  it("does not reserve room when the photo is not drawn", () => {
    const hiddenPhoto = long({ resumePhotoSize: "large", resumeSemanticSections: [{ semanticType: "photo", customTitle: "", visible: false, enabled: false, order: 2 }] });
    const noPhoto = long({ resumePhotoSize: "large", photoPath: "" });
    // A hidden photo is planned like no photo at all (neither its size nor its narrower header text counts).
    expect(JSON.stringify(plan(hiddenPhoto, "kreativ"))).toBe(JSON.stringify(plan(long({ resumePhotoSize: "medium", photoPath: "" }), "kreativ")));
    expect(JSON.stringify(plan(noPhoto, "kreativ"))).toBe(JSON.stringify(plan(long({ resumePhotoSize: "medium", photoPath: "" }), "kreativ")));
    expect(JSON.stringify(plan(long({ resumePhotoSize: "large" }), "kreativ", true))).toBe(JSON.stringify(plan(long({ resumePhotoSize: "medium" }), "kreativ", true)));
  });
});
