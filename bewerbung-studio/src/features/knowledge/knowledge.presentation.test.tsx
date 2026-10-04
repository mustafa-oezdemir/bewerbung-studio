import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KnowledgeSectionRenderer } from "../../components/document/KnowledgeSectionRenderer";
import { ensureKnowledgeSection } from "./knowledge.service";
import { createKnowledgeCategory, createKnowledgeItem, formatKnowledgeItem, formatKnowledgeSectionAsText } from "./knowledge.utils";

const category = createKnowledgeCategory("IT-Kenntnisse", 0, "it");
category.showLevels = true;
category.showYearsOfExperience = true;
category.items = [{ ...createKnowledgeItem("Java"), level: "advanced", yearsOfExperience: 4, lastUsedYear: 2025, description: "Spring Boot und REST APIs" }];

describe("structured knowledge presentation", () => {
  it("shows level, years, last use and description as text", () => {
    const text = formatKnowledgeItem(category.items[0], true, true, "level-bars");
    expect(text).toContain("Fortgeschrittene Kenntnisse");
    expect(text).toContain("4 Jahre");
    expect(text).toContain("zuletzt 2025");
    expect(text).toContain("Spring Boot und REST APIs");
  });

  it("keeps hidden categories and items out of visual and ATS output", () => {
    const hidden = { ...createKnowledgeCategory("Versteckt", 1), items: [createKnowledgeItem("Geheim")] };
    const section = { title: "Besondere Kenntnisse", isVisible: true, categories: [category, { ...hidden, isVisible: false }] };
    const visual = renderToStaticMarkup(<KnowledgeSectionRenderer section={section} />);
    const ats = formatKnowledgeSectionAsText(section, true);
    expect(visual).toContain("Java");
    expect(visual).not.toContain("Geheim");
    expect(ats).toContain("Fortgeschrittene Kenntnisse");
    expect(ats).not.toContain("Geheim");
    expect(renderToStaticMarkup(<KnowledgeSectionRenderer section={{ ...section, categories: [{ ...category, items: [{ ...category.items[0], isVisible: false }] }] }} />)).toBe("");
  });

  it("keeps legacy skills readable without inventing levels", () => {
    const section = ensureKnowledgeSection(undefined, ["Java", "Docker"]);
    expect(formatKnowledgeSectionAsText(section, true)).toContain("Java");
    expect(formatKnowledgeSectionAsText(section, true)).toContain("Docker");
    expect(formatKnowledgeSectionAsText(section, true)).not.toContain("Fortgeschrittene Kenntnisse");
  });
});
