import { describe, expect, it } from "vitest";
import { resolveTemplateId, templates } from "./templates";
import { genericPaginationGeometry, getPaginationGeometry } from "./resumePaginationGeometry";

const canonical = [
  "pehlione_white_blue", "pehlione_white", "modern", "elegant", "zweispaltig", "zeitgenoessisch", "kreativ",
  "gepflegt", "kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league",
];

describe("template pagination geometry", () => {
  it.each(canonical)("describes a coherent A4 page for %s", (id) => {
    const geometry = getPaginationGeometry(id);
    expect(geometry.top1).toBeGreaterThan(10);
    expect(geometry.limit).toBeGreaterThan(geometry.top1 + 100);
    expect(geometry.limit).toBeLessThan(297);
    // These native geometry values predate shared full-header repetition; the
    // page planner reserves the extra continuation height separately.
    expect(geometry.top2).toBeLessThanOrEqual(geometry.top1);
    expect(geometry.text.cw).toBeGreaterThan(0.3);
    expect(geometry.text.cw).toBeLessThan(0.75);
    expect(geometry.exp.linePitch).toBeGreaterThan(2);
    expect(geometry.exp.linePitch).toBeLessThan(6);
    expect(geometry.contentRight).toBeGreaterThan(geometry.contentLeft + 60);
    expect(geometry.density.compact).toBeLessThanOrEqual(1);
    expect(geometry.density.dense).toBeLessThanOrEqual(geometry.density.compact);
    // Continuation pages have no sidebar, so their text column is at least as wide.
    expect(geometry.text.contW).toBeGreaterThanOrEqual(geometry.text.bulletW);
    for (const model of Object.values(geometry.items)) {
      expect(model.cols).toBeGreaterThanOrEqual(1);
      expect(model.w).toBeGreaterThan(20);
    }
    if (geometry.columns === 2) {
      expect(geometry.sideTop1).not.toBeNull();
      expect(geometry.sideLimit).toBeGreaterThan(geometry.sideTop1 ?? 0);
    } else {
      expect(geometry.sideTop1).toBeNull();
    }
  });

  it.each(canonical)("describes the plain-text (ATS) layout of %s", (id) => {
    const { ats, atsTop1, atsTop2, density } = getPaginationGeometry(id);
    // Plain layouts have no sidebar: the continuation header is at most as tall as the first one.
    expect(atsTop1).toBeGreaterThan(30);
    expect(atsTop2).toBeLessThanOrEqual(atsTop1);
    expect(ats.knowledge.pitch).toBeGreaterThan(2);
    expect(ats.knowledge.w).toBeGreaterThan(60);
    expect(ats.knowledge.head).toBeGreaterThan(4);
    expect(ats.knowledge.title).toBeGreaterThan(3);
    expect(ats.density.compact).toBeLessThanOrEqual(1);
    expect(ats.density.dense).toBeLessThanOrEqual(ats.density.compact);
    // A compact mode never shrinks a plain page more than it shrinks the styled one.
    expect(ats.density.compact).toBeGreaterThanOrEqual(density.compact - 0.05);
    if (ats.header) {
      expect(ats.header.perContact).toBeGreaterThan(5);
      expect(ats.header.base + ats.header.perContact).toBeLessThan(atsTop1);
    }
  });

  it("knows the native column of every movable section", () => {
    for (const id of canonical) {
      const zones = getPaginationGeometry(id).zones;
      for (const zone of Object.values(zones)) expect(["main", "sidebar"]).toContain(zone);
    }
    expect(getPaginationGeometry("pehlione_white_blue").zones.summary).toBe("main");
    expect(getPaginationGeometry("pehlione_white_blue").zones.strengths).toBe("sidebar");
    expect(getPaginationGeometry("einspaltig").zones.knowledge).toBe("main");
  });

  it("covers every registered template, including the legacy aliases", () => {
    for (const template of templates) {
      expect(canonical).toContain(resolveTemplateId(template.id));
    }
  });

  it("falls back to the wide single column for unknown templates", () => {
    expect(getPaginationGeometry("does-not-exist")).toBe(genericPaginationGeometry);
    expect(getPaginationGeometry(undefined)).toBe(genericPaginationGeometry);
    expect(genericPaginationGeometry.columns).toBe(1);
  });
});
