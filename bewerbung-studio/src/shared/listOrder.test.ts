import { describe, expect, it } from "vitest";
import { moveListItem } from "./listOrder";

describe("canonical item ordering", () => {
  it("moves items to boundaries without swapping or dropping intervening items", () => {
    const values = ["Deutsch – C1", "Türkisch – Muttersprache", "Englisch – B1"];
    expect(moveListItem(values, 2, 0)).toEqual([values[2], values[0], values[1]]);
    expect(moveListItem(values, 0, 2)).toEqual([values[1], values[2], values[0]]);
    expect(values[0]).toBe("Deutsch – C1");
    expect(moveListItem(values, -1, 0)).toEqual(values);
    expect(moveListItem(values, 0, 10)).toEqual(values);
    expect(moveListItem([], 0, 1)).toEqual([]);
  });
});
