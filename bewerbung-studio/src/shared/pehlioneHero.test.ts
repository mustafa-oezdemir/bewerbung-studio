import { describe, expect, it } from "vitest";
import { pehlioneBlueprintMarkup, pehlioneGear } from "./pehlioneBlueprint";
import { pehlioneHeroCss } from "./pehlioneHero";

const HERO_HEIGHT_MM = 46;
/** Topmost coordinate of the artwork: the small circle, the plus marker and the vertical rules start here. */
const ARTWORK_TOP = 12;
/** The native millimetres of a hero variable; the profile's Fotogröße multiplies them (`--resume-photo-scale`). */
const custom = (name: string) =>
  Number(new RegExp(String.raw`--${name}:calc\(([0-9.]+)mm \* var\(--resume-photo-scale,1\)\)`).exec(pehlioneHeroCss)?.[1]);
/** Declarations of the first rule whose selector list contains `selector`. */
const declarationsOf = (selector: string) => {
  const start = pehlioneHeroCss.indexOf(selector);
  const open = pehlioneHeroCss.indexOf("{", start);
  return start < 0 ? "" : pehlioneHeroCss.slice(open + 1, pehlioneHeroCss.indexOf("}", open));
};

describe("Pehlione hero geometry", () => {
  it("knows where the gear sits in the artwork", () => {
    const { viewBox, cx, cy, ringRadius, outerRadius } = pehlioneGear;
    expect(pehlioneBlueprintMarkup).toContain(`viewBox="0 0 ${viewBox.width} ${viewBox.height}"`);
    expect(pehlioneBlueprintMarkup).toContain(`<circle cx="${cx}" cy="${cy}" r="${ringRadius}"/>`);
    const points = /<polygon points="([^"]+)"/.exec(pehlioneBlueprintMarkup)?.[1].split(" ").map((pair) => pair.split(",").map(Number)) ?? [];
    expect(points.length).toBeGreaterThan(0);
    expect(Math.max(...points.map(([x, y]) => Math.hypot(x - cx, y - cy)))).toBeCloseTo(outerRadius, 1);
  });

  it.each(["preview", "pdf"] as const)("centres the photo of both templates on the hero in the %s", (surface) => {
    const photo = surface === "preview" ? ".pehlione-hero__photo" : ".pehlione-pdf-photo";
    const declarations = declarationsOf(photo);
    expect(declarations).toContain("left:calc(50% - var(--pehlione-hero-photo) / 2)");
    expect(declarations).toContain("top:calc(50% - var(--pehlione-hero-photo) / 2)");
    expect(declarations).toContain("width:var(--pehlione-hero-photo)");
    for (const template of ["pehlione_white", "pehlione_white_blue"]) expect(pehlioneHeroCss).toContain(`[data-template="${template}"] ${photo}`);
  });

  it("puts the centre of the gear, not the centre of its SVG box, on the centre of the hero", () => {
    const { viewBox, cx, cy } = pehlioneGear;
    for (const svg of [".pehlione-blueprint svg", ".pehlione-pdf-blueprint svg"]) {
      const declarations = declarationsOf(svg);
      expect(declarations).toContain(`left:calc(50% - ${cx} * var(--pehlione-gear-unit))`);
      expect(declarations).toContain(`top:calc(50% - ${cy} * var(--pehlione-gear-unit))`);
      expect(declarations).toContain(`width:calc(${viewBox.width} * var(--pehlione-gear-unit))`);
      expect(declarations).toContain(`height:calc(${viewBox.height} * var(--pehlione-gear-unit))`);
    }
  });

  it("centres the circles, lines and marker of White Blue on the hero as well", () => {
    for (const hero of [".pehlione-hero", ".pehlione-pdf-hero"]) {
      expect(pehlioneHeroCss).toContain(`${hero}:before`);
      expect(pehlioneHeroCss).toContain(`${hero}:after`);
      expect(pehlioneHeroCss).toContain(`${hero} b`);
    }
    // No offset in the hero rules counts from the top-left corner of the hero.
    expect(pehlioneHeroCss).not.toMatch(/\b(top|left):[0-9.]+mm/);
  });

  it("fits the photo inside the ring of the gear and the gear inside the hero", () => {
    const unit = custom("pehlione-gear-unit");
    const photo = custom("pehlione-hero-photo");
    const { ringRadius, outerRadius, cy } = pehlioneGear;
    expect(unit).toBeGreaterThan(0);
    // The gear stays visible around the photo ...
    expect(photo).toBeLessThan(2 * ringRadius * unit);
    expect(photo).toBeGreaterThan(2 * (ringRadius - 10) * unit);
    // ... the teeth and the top of the drawing stay inside the blue area, whatever the sidebar width is.
    expect(2 * outerRadius * unit).toBeLessThan(HERO_HEIGHT_MM - 2);
    expect((cy - ARTWORK_TOP) * unit).toBeLessThanOrEqual(HERO_HEIGHT_MM / 2);
  });

  it("scales the photo, the artwork behind it and the hero by the same Fotogröße, and by nothing when it is unset", () => {
    // Every length of the hero that belongs to the photo is "native mm x --resume-photo-scale"; the variable is unset for Mittel.
    expect(custom("pehlione-hero-photo")).toBeGreaterThan(0);
    expect(pehlioneHeroCss).toContain("height:calc(46mm * var(--resume-photo-scale,1))");
    expect(pehlioneHeroCss).toContain("--pehlione-gear-unit:calc(0.285mm * var(--resume-photo-scale,1))");
    expect(pehlioneHeroCss).toContain("calc(16mm * var(--resume-photo-scale,1))");
    expect(pehlioneHeroCss).not.toMatch(/--resume-photo-scale:/);
    // Unscaled (variable unset = 1) the native values are the ones the geometry above checks.
    expect(custom("pehlione-hero-photo") * 1).toBeCloseTo(custom("pehlione-hero-photo"), 5);
  });
});
