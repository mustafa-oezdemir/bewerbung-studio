import { knowledgeLevelLabels } from "./knowledge.constants";
import type {
  KnowledgeCategory,
  KnowledgeDisplayMode,
  KnowledgeItem,
  KnowledgeSection,
} from "./knowledge.types";

export const createKnowledgeItem = (
  name = "",
  sortOrder = 0,
): KnowledgeItem => ({
  id: crypto.randomUUID(),
  name,
  description: "",
  level: "none",
  isVisible: true,
  sortOrder,
});

export const createKnowledgeCategory = (
  title = "",
  sortOrder = 0,
  type: KnowledgeCategory["type"] = "custom",
): KnowledgeCategory => ({
  id: crypto.randomUUID(),
  title,
  type,
  subtitle: "",
  items: [],
  subcategories: [],
  displayMode: "comma-separated",
  showLevels: false,
  showYearsOfExperience: false,
  isVisible: true,
  sortOrder,
});

export const visibleKnowledgeItems = (items: KnowledgeItem[]) =>
  items
    .filter((item) => item.isVisible && item.name.trim())
    .sort((left, right) => left.sortOrder - right.sortOrder);

export const formatKnowledgeItem = (
  item: KnowledgeItem,
  showLevel: boolean,
  showYears: boolean,
  _mode: KnowledgeDisplayMode,
) => {
  const extras = knowledgeItemDetails(item, showLevel, showYears);
  return `${item.name}${extras.length ? ` – ${extras.join(", ")}` : ""}`;
};

/** Textual details shared by previews, PDF, ATS and Word; visual bars remain decorative. */
export const knowledgeItemDetails = (
  item: KnowledgeItem,
  showLevel: boolean,
  showYears: boolean,
) => {
  const extras: string[] = [];
  if (showLevel && item.level !== "none") {
    extras.push(knowledgeLevelLabels[item.level]);
  }
  if (showYears && item.yearsOfExperience !== undefined) {
    extras.push(
      `${item.yearsOfExperience} ${item.yearsOfExperience === 1 ? "Jahr" : "Jahre"}`,
    );
  }
  if (item.lastUsedYear !== undefined) {
    extras.push(`zuletzt ${item.lastUsedYear}`);
  }
  if (item.description?.trim()) {
    extras.push(item.description.trim());
  }
  return extras;
};

export const flattenKnowledgeNames = (section: KnowledgeSection) =>
  section.categories
    .filter((category) => category.isVisible)
    .flatMap((category) => [
      ...visibleKnowledgeItems(category.items).map((item) => item.name),
      ...category.subcategories
        .filter((subcategory) => subcategory.isVisible)
        .flatMap((subcategory) =>
          visibleKnowledgeItems(subcategory.items).map((item) => item.name),
        ),
    ]);

export const formatKnowledgeSectionAsText = (
  section: KnowledgeSection,
  atsMode = false,
) => {
  if (!section.isVisible) return "";
  return section.categories
    .filter((category) => category.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((category) => {
      const lines: string[] = [];
      const mode = atsMode ? "comma-separated" : category.displayMode;
      const directItems = visibleKnowledgeItems(category.items);
      if (directItems.length) {
        const formatted = directItems.map((item) =>
          formatKnowledgeItem(
            item,
            category.showLevels,
            category.showYearsOfExperience,
            mode,
          ),
        );
        lines.push(
          mode === "comma-separated" || mode === "tags"
            ? `${category.title}: ${formatted.join(", ")}`
            : `${category.title}\n${formatted.map((item) => `• ${item}`).join("\n")}`,
        );
      }
      category.subcategories
        .filter((subcategory) => subcategory.isVisible)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .forEach((subcategory) => {
          const items = visibleKnowledgeItems(subcategory.items);
          if (!items.length) return;
          const subMode = atsMode
            ? "comma-separated"
            : subcategory.displayMode ?? mode;
          const formatted = items.map((item) =>
            formatKnowledgeItem(
              item,
              category.showLevels,
              category.showYearsOfExperience,
              subMode,
            ),
          );
          lines.push(
            subMode === "comma-separated" || subMode === "tags"
              ? `${category.title} – ${subcategory.title}: ${formatted.join(", ")}`
              : `${category.title} – ${subcategory.title}\n${formatted.map((item) => `• ${item}`).join("\n")}`,
          );
        });
      return lines;
    })
    .filter(Boolean)
    .join("\n");
};
