import type {
  KnowledgeCategory,
  KnowledgeItem,
  KnowledgeSection,
  KnowledgeSubcategory,
} from "../features/knowledge/knowledge.types";
import { visibleKnowledgeItems } from "../features/knowledge/knowledge.utils";

/** Items `from`..`to` (exclusive, of `total` visible items in drawing order) of the knowledge block on one page. */
export type KnowledgeRange = { from: number; to: number; total: number };

export type KnowledgeListRef = {
  category: KnowledgeCategory;
  subcategory?: KnowledgeSubcategory;
  items: KnowledgeItem[];
};

/**
 * The visible item lists of a knowledge section in drawing order: every visible
 * category's own items, then its visible subcategories. The page planner and the
 * renderer both walk this order, so a block that breaks between two pages is cut
 * at the same item on either side.
 */
export const knowledgeLists = (section: KnowledgeSection): KnowledgeListRef[] =>
  section.categories
    .filter((category) => category.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((category) => [
      { category, items: visibleKnowledgeItems(category.items) },
      ...category.subcategories
        .filter((subcategory) => subcategory.isVisible)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((subcategory) => ({ category, subcategory, items: visibleKnowledgeItems(subcategory.items) })),
    ]);
