import { describe, expect, it } from "vitest";
import {
  addProfessionPreset,
  ensureKnowledgeSection,
  syncLegacySkills,
} from "./knowledge.service";
import {
  createKnowledgeCategory,
  createKnowledgeItem,
  formatKnowledgeSectionAsText,
} from "./knowledge.utils";
import { validateKnowledgeSection } from "./knowledge.validation";

describe("Kenntnisse & Zusatzangaben", () => {
  it("migriert alte Skills verlustfrei in eine Kategorie", () => {
    const section = ensureKnowledgeSection(undefined, [
      "TypeScript",
      "React",
    ]);
    expect(section.categories[0].title).toBe("Kenntnisse");
    expect(syncLegacySkills(section)).toEqual(["TypeScript", "React"]);
  });

  it("ergänzt Berufssets, ohne gleichnamige Kategorien zu duplizieren", () => {
    const backend = createKnowledgeCategory("Backend");
    const result = addProfessionPreset(
      {
        title: "Kenntnisse & Zusatzangaben",
        isVisible: true,
        categories: [backend],
      },
      "software",
    );
    expect(
      result.categories.filter((category) => category.title === "Backend"),
    ).toHaveLength(1);
    expect(
      result.categories.some(
        (category) => category.title === "Programmiersprachen",
      ),
    ).toBe(true);
  });

  it("meldet leere und doppelte Einträge innerhalb derselben Kategorie", () => {
    const category = createKnowledgeCategory("Backend");
    category.items = [
      createKnowledgeItem("Node.js", 0),
      createKnowledgeItem(" node.js ", 1),
      createKnowledgeItem("", 2),
    ];
    const issues = validateKnowledgeSection({
      title: "Kenntnisse",
      isVisible: true,
      categories: [category],
    });
    expect(issues.map((issue) => issue.message).join(" ")).toContain(
      "bereits vorhanden",
    );
    expect(issues.map((issue) => issue.message).join(" ")).toContain(
      "Leere Kenntnisse",
    );
  });

  it("lässt gleiche Einträge in getrennten Unterkategorien zu", () => {
    const category = createKnowledgeCategory("Software");
    category.subcategories = [
      {
        id: crypto.randomUUID(),
        title: "Frontend",
        items: [createKnowledgeItem("Testing")],
        isVisible: true,
        sortOrder: 0,
      },
      {
        id: crypto.randomUUID(),
        title: "Backend",
        items: [createKnowledgeItem("Testing")],
        isVisible: true,
        sortOrder: 1,
      },
    ];
    expect(
      validateKnowledgeSection({
        title: "Kenntnisse",
        isVisible: true,
        categories: [category],
      }),
    ).toEqual([]);
  });

  it("exportiert nur sichtbare Einträge als ATS-lesbaren Text", () => {
    const category = createKnowledgeCategory("Backend");
    const visible = createKnowledgeItem("Node.js");
    visible.level = "advanced";
    const hidden = createKnowledgeItem("Geheim");
    hidden.isVisible = false;
    category.items = [visible, hidden];
    category.showLevels = true;
    const text = formatKnowledgeSectionAsText(
      {
        title: "Kenntnisse",
        isVisible: true,
        categories: [category],
      },
      true,
    );
    expect(text).toContain("Backend: Node.js");
    expect(text).toContain("Fortgeschrittene Kenntnisse");
    expect(text).not.toContain("Geheim");
  });
});
