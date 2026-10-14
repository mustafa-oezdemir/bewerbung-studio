import { describe, expect, it } from "vitest";
import type { ApplicantProfile, Application } from "../shared/schema";
import { analyzeKeywordMatch, includesKeywordPhrase } from "./keywordMatch";

const application = (tasksText: string, requirementsText: string) =>
  ({ job: { title: "Entwickler", fullText: "React im alten Text", tasksText, requirementsText } }) as Application;
const profile = (values: Partial<ApplicantProfile> = {}) =>
  ({ skills: [], strengths: [], languages: [], education: [], resumeKnowledgeGroups: [],
    knowledgeSection: { isVisible: true, categories: [] }, ...values }) as ApplicantProfile;

describe("Stellenanzeigen-Match", () => {
  it("counts distinct requirements, never task or legacy text, with case insensitive aliases", () => {
    const result = analyzeKeywordMatch(
      application("TYPESCRIPT, SQL und Bootstrap", "typescript, Vue.js 3, Golang und sql. SQL erneut."),
      profile({ skills: ["TypeScript", "SQL", "Go", "Vue.js"] }),
    );
    expect(result.met.map((item) => item.label)).toEqual(["TypeScript", "Go", "SQL"]);
    expect(result.missing.map((item) => item.label)).toEqual(["Vue.js 3"]);
    expect(result.score).toBe(75);
    expect(result.matchedSkills).toEqual(["TypeScript", "Go", "SQL"]);
  });

  it("does not match Go inside another word or assume a Vue version", () => {
    expect(includesKeywordPhrase("Golang", "Go")).toBe(false);
    expect(includesKeywordPhrase("TypeScript", "TYPESCRIPT")).toBe(true);
    expect(includesKeywordPhrase("Vue.js", "vue js")).toBe(true);
    expect(analyzeKeywordMatch(application("", "Vue.js 3"), profile({ skills: ["Vue.js"] })).score).toBe(0);
  });

  it("uses visible saved knowledge and strengths once, including OOP aliases", () => {
    const result = analyzeKeywordMatch(application("", "Objektorientierte Programmierung, Docker, Kubernetes, React, Analytische Fähigkeiten"),
      profile({
        skills: ["OOP"],
        knowledgeSection: { isVisible: true, categories: [{ isVisible: true, items: [
          { isVisible: true, name: "Docker", sortOrder: 0 },
          { isVisible: false, name: "React", sortOrder: 1 },
        ], subcategories: [] }] } as unknown as ApplicantProfile["knowledgeSection"],
        resumeKnowledgeGroups: [{ visible: true, semanticType: "technologies", items: [{ visible: true, text: "Kubernetes" }] }] as ApplicantProfile["resumeKnowledgeGroups"],
        strengths: [{ title: "Analytische Fähigkeiten" }] as ApplicantProfile["strengths"],
      }));
    expect(result.score).toBe(80);
    expect(result.met).toHaveLength(4);
    expect(result.missing.map((item) => item.label)).toEqual(["React"]);
    expect(result.matchedSkills).toEqual(["Docker", "Kubernetes", "OOP"]);
  });

  it("checks language level and completed field of study separately from technical skills", () => {
    const ad = application("", "Abgeschlossenes Studium der Informatik\nSehr gute Deutschkenntnisse\nSQL");
    const insufficient = analyzeKeywordMatch(ad, profile({
      skills: ["SQL"], languages: ["Deutsch – A1"],
      education: [{ degree: "Bachelor", fieldOfStudy: "Informatik", to: "", status: "laufend" }] as ApplicantProfile["education"],
    }));
    expect(insufficient.score).toBe(33);
    expect(insufficient.missing.map((item) => item.kind)).toEqual(["language", "education"]);
    const qualified = analyzeKeywordMatch(ad, profile({
      skills: ["SQL"], languages: ["Deutsch – C1"],
      education: [{ degree: "Bachelor", fieldOfStudy: "Informatik", to: "2021", status: "abgeschlossen" }] as ApplicantProfile["education"],
    }));
    expect(qualified.score).toBe(100);
  });

  it("shows no percentage for empty or uncheckable requirements", () => {
    expect(analyzeKeywordMatch(application("TypeScript", ""), profile({ skills: ["TypeScript"] })).score).toBeNull();
    const result = analyzeKeywordMatch(application("", "Reisebereitschaft"), profile());
    expect(result.score).toBeNull();
    expect(result.furtherReview).toContain("Reisebereitschaft");
  });
});
