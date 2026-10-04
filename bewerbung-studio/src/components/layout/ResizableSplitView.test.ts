import { describe, expect, it } from "vitest";
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  getSplitRatioBounds,
} from "./ResizableSplitView";

describe("ResizableSplitView layout helpers", () => {
  it("keeps the default desktop editor ratio", () => {
    expect(DEFAULT_SPLIT_RATIO).toBe(0.42);
  });

  it("clamps a dragged ratio so both panes remain usable", () => {
    expect(clampSplitRatio(0.1, 1400, 500, 450)).toBeCloseTo(500 / 1392);
    expect(clampSplitRatio(0.99, 1400, 500, 450)).toBeCloseTo(
      1 - 450 / 1392,
    );
  });

  it("does not impose impossible bounds in the compact fallback", () => {
    expect(getSplitRatioBounds(900, 500, 450)).toEqual({ min: 0, max: 1 });
  });
});
