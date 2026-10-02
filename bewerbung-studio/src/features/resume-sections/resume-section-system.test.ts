import { describe, expect, it } from "vitest";
import {
  getDefaultKnowledgeGroups,
  resolveResumeSectionInstances,
  resumeSectionDefinitions,
  validateRequiredResumeSections,
} from "./resume-section-system";
import {
  createKnowledgeBlock,
  getResumeBlockDefinition,
  getTemplateKnowledgeSlots,
  resolveKnowledgeSlot,
  resumeBlockRegistry,
} from "./knowledge-block-registry";

describe("resume section system", () => {
  it("provides all nine semantic sections", () => {
    expect(resumeSectionDefinitions).toHaveLength(9);
  });

  it("preserves explicit visibility choices for required sections", () => {
    const resolved = resolveResumeSectionInstances([
      { semanticType: "career", customTitle: "Praxis", visible: false, enabled: false, order: 4 },
    ]);
    expect(resolved.find((item) => item.semanticType === "career")).toMatchObject({
      visible: false,
      enabled: false,
      customTitle: "Praxis",
    });
    expect(validateRequiredResumeSections(resolved)).toEqual(["Beruflicher Werdegang"]);
    // Only the Überschrift is Pflicht without an off switch; the other sections keep theirs for now.
    expect(resumeSectionDefinitions.filter((section) => !section.hideable).map((section) => section.semanticType)).toEqual(["heading"]);
  });

  it("maps Pehlione knowledge groups", () => {
    const groups = getDefaultKnowledgeGroups("pehlione_white_blue");
    expect(groups.map((item) => item.title)).toEqual([
      "Kernkompetenzen",
      "Technische Schwerpunkte",
    ]);
    expect(groups.every((item) => item.slot === "sidebar")).toBe(true);
  });

  it("offers the central extendable block registry", () => {
    expect(resumeBlockRegistry.length).toBeGreaterThanOrEqual(22);
    expect(resumeBlockRegistry.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "Kernkompetenzen",
        "Technische Schwerpunkte",
        "Stärken",
        "Zertifikate",
        "Weiterbildungen",
        "Projekt-Highlight",
      ]),
    );
  });

  it("maps unsupported slots without deleting content", () => {
    expect(getTemplateKnowledgeSlots("pehlione_white_blue").map((slot) => slot.id)).toEqual([
      "sidebar",
      "main",
      "full",
    ]);
    expect(getTemplateKnowledgeSlots("klassisch").map((slot) => slot.id)).toEqual(["main"]);
    expect(resolveKnowledgeSlot("klassisch", "core-competencies", "sidebar")).toBe("main");
    expect(resolveKnowledgeSlot("pehlione_white_blue", "project-highlight", "sidebar")).toBe("main");
  });

  it("creates project blocks in a supported main slot", () => {
    const definition = getResumeBlockDefinition("project-highlight")!;
    expect(createKnowledgeBlock("pehlione_white_blue", definition, 3)).toMatchObject({
      semanticType: "project-highlight",
      rendererType: "project-highlight",
      slot: "main",
      visible: true,
      order: 3,
    });
  });
});
