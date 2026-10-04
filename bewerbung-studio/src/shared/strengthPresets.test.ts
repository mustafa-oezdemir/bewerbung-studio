import { describe, expect, it } from "vitest";
import { addTechnologyStrengths } from "./strengthPresets";

describe("technology strength presets", () => {
  it("adds three editable entries and preserves existing descriptions and order", () => {
    const existing = [{ id: crypto.randomUUID(), title: " go ", description: "Meine Projekte", iconId: "star" }];
    const result = addTechnologyStrengths(existing);
    expect(result.map((item) => item.title)).toEqual([" go ", "React", "Spring Boot"]);
    expect(result[0]).toBe(existing[0]);
    expect(addTechnologyStrengths(result)).toEqual(result);
    expect(existing).toHaveLength(1);
    expect(addTechnologyStrengths([])[0].description).toBe("Echo, Gin");
  });
});
