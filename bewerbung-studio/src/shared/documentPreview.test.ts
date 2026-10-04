import { describe, expect, it } from "vitest";
import {
  A4_PREVIEW_HEIGHT_PX,
  A4_PREVIEW_WIDTH_PX,
  calculateA4PreviewScale,
} from "./documentPreview";

describe("calculateA4PreviewScale", () => {
  it("fits the complete A4 page to the limiting width", () => {
    const scale = calculateA4PreviewScale(600, 1_000);

    expect(scale).toBeCloseTo(600 / A4_PREVIEW_WIDTH_PX, 5);
    expect(A4_PREVIEW_HEIGHT_PX * scale).toBeLessThanOrEqual(1_000);
  });

  it("fits the complete A4 page to the limiting height", () => {
    const scale = calculateA4PreviewScale(780, 600);

    expect(scale).toBeCloseTo(600 / A4_PREVIEW_HEIGHT_PX, 5);
    expect(A4_PREVIEW_WIDTH_PX * scale).toBeLessThanOrEqual(780);
  });

  it("does not enlarge A4 beyond its real CSS size", () => {
    expect(calculateA4PreviewScale(1_200, 1_400)).toBe(1);
  });
});
