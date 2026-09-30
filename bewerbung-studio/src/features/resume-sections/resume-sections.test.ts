import { describe, expect, it } from "vitest";
import {
  getResumeSectionTitle,
  getTemplateSectionCapabilities,
  moveResumeSection,
  resolveResumeSectionLayout,
} from "./resume-sections";
import { profileSchema } from "../../shared/schema";
import { getManagerSections } from "./resume-manager";

describe("resume section capabilities", () => {
  it("keeps single-column templates in their natural flow", () => {
    const layout = resolveResumeSectionLayout("ivy-league", [
      { type: "languages", zone: "sidebar" },
      { type: "experience", zone: "main" },
    ]);

    expect(layout.find((item) => item.type === "languages")).toEqual({
      type: "languages",
      zone: "main",
    });
  });

  it("rejects unsupported two-column moves without dropping content", () => {
    const moved = moveResumeSection(
      "elegant",
      [{ type: "experience", zone: "main" }],
      "experience",
      "sidebar",
      0,
    );

    expect(moved.find((item) => item.type === "experience")).toEqual({
      type: "experience",
      zone: "main",
    });
  });

  it("resolves editable and knowledge-backed profile titles", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      knowledgeSection: {
        title: "Technische Kompetenzen",
        categories: [],
        isVisible: true,
      },
      resumeSectionTitles: {
        summary: "Über mich",
        strengths: "Meine Stärken",
        experience: "Praxis",
        education: "Bildungsweg",
        languages: "Sprachen",
        certifications: "Nachweise",
      },
      updatedAt: new Date().toISOString(),
    });

    expect(getResumeSectionTitle(profile, "strengths")).toBe("Meine Stärken");
    expect(getResumeSectionTitle(profile, "knowledge")).toBe(
      "Technische Kompetenzen",
    );
  });

  it("lists the certificates of the Pehlione templates where the output draws them", () => {
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", certifications: ["IBM"], updatedAt: new Date().toISOString() });
    const zoneOf = (templateId: string) => getManagerSections(profile, templateId).find((entry) => entry.id === "certifications")?.zone;
    for (const templateId of ["pehlione_white_blue", "pehlione_white"]) {
      expect(zoneOf(templateId), templateId).toBe("main");
      expect(getTemplateSectionCapabilities(templateId).allowedZonesBySection.certifications, templateId).toEqual(["main", "sidebar"]);
    }
    // The other two-column templates keep their own defaults.
    expect(zoneOf("modern")).toBe("sidebar");
  });
});
