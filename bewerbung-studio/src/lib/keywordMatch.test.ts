import { describe, expect, it } from "vitest";
import type { ApplicantProfile, Application } from "../shared/schema";
import { analyzeKeywordMatch } from "./keywordMatch";

const application = {
  job: {
    title: "Frontend-Entwickler",
    fullText:
      "Gesucht werden TypeScript, React, Accessibility und Erfahrung mit Testing.",
  },
} as Application;

const profile = {
  skills: ["TypeScript", "React", "Node.js", "Git"],
} as ApplicantProfile;

describe("keyword matching", () => {
  it("matches only skills actually present in the advertisement", () => {
    const result = analyzeKeywordMatch(application, profile);
    expect(result.matchedSkills).toEqual(["TypeScript", "React"]);
    expect(result.unmatchedSkills).toEqual(["Node.js", "Git"]);
    expect(result.score).toBe(50);
  });

  it("suggests advertisement terms without adding them to the profile", () => {
    const result = analyzeKeywordMatch(application, profile);
    expect(result.suggestions).toContain("accessibility");
    expect(profile.skills).toEqual(["TypeScript", "React", "Node.js", "Git"]);
  });
});
