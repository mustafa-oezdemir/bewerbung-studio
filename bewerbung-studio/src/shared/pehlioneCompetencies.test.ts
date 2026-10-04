import { describe, expect, it } from "vitest";
import { groupPehlioneCompetencies } from "./pehlioneCompetencies";

describe("Pehlione competency groups", () => {
  it("keeps existing values while separating frontend from backend", () => {
    expect(
      groupPehlioneCompetencies([
        { title: "Golang", description: "Echo, Gin" },
        { title: "React", description: "Spring Boot" },
      ]),
    ).toEqual([
      { title: "Backend", values: ["Golang", "Echo", "Gin", "Spring Boot"] },
      { title: "Frontend", values: ["React"] },
    ]);
  });
});
