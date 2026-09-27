import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { profileSchema } from "./schema";
import { applyManagedResumeOutput } from "./resumeManagedOutput";
import { defaultDocumentDesign } from "./documentDesign";
import { createKnowledgeCategory, createKnowledgeItem } from "../features/knowledge/knowledge.utils";

const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(),
  strengths: Array.from({ length: 10 }, (_, index) => ({ id: crypto.randomUUID(), title: `Stärke ${index + 1}`, description: index === 0 ? "<script>Text</script>" : "" })),
});
const page = '<section class="cv-sheet"><main><section><h2>Stärken</h2><p>Old content</p></section></main></section>';

describe("shared strengths output", () => {
  it.each([1, 2, 3, 4] as const)("renders the saved %s columns with aligned icon/title markup", (columns) => {
    const { document } = parseHTML(applyManagedResumeOutput(page, profile, "klassisch", 1, 1, { ...defaultDocumentDesign, strengthsColumns: columns }));
    expect(document.querySelector(".managed-strengths-grid")?.getAttribute("data-columns")).toBe(String(columns));
    expect(document.querySelector(".managed-strength-card > svg + strong")).not.toBeNull();
  });

  it("renders all knowledge entries and preserves manual icons through JSON validation", () => {
    const item = { ...createKnowledgeItem("Java"), iconId: "symbol:diamond" };
    const category = { ...createKnowledgeCategory("Programmiersprachen"), items: [item, createKnowledgeItem("Spring Boot", 1)] };
    const withKnowledge = profileSchema.parse(JSON.parse(JSON.stringify({ ...profile, knowledgeSection: { title: "Kenntnisse", isVisible: true, categories: [category] } })));
    const { document } = parseHTML(applyManagedResumeOutput(page, withKnowledge, "klassisch", 1, 1, { ...defaultDocumentDesign, knowledgeColumns: 2 }));
    const knowledge = document.querySelector('[data-managed-section="knowledge"]');
    expect(knowledge?.querySelector(".managed-item-grid")?.getAttribute("data-columns")).toBe("2");
    expect(knowledge?.querySelector('[data-strength-symbol="symbol:diamond"]')).not.toBeNull();
    expect(knowledge?.querySelector('[data-brand="devicon:spring"]')).not.toBeNull();
    expect(knowledge?.textContent).toContain("Programmiersprachen");
  });
  it("keeps every record, escapes user text and renders the block only once across pages", () => {
    const { document } = parseHTML(applyManagedResumeOutput(page + page, profile, "klassisch"));
    expect(document.querySelectorAll(".managed-strengths-grid")).toHaveLength(1);
    expect(document.querySelectorAll(".managed-strength-card")).toHaveLength(10);
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector(".managed-strength-card p")?.textContent).toBe("<script>Text</script>");
    expect(applyManagedResumeOutput(page, profile, "klassisch", 2, 2)).not.toContain("managed-strength-card");
  });

  it("honors section visibility", () => {
    const hidden = { ...profile, resumeSections: { ...profile.resumeSections, strengths: false } };
    expect(applyManagedResumeOutput(page, hidden, "klassisch")).not.toContain("Stärken");
  });
});
