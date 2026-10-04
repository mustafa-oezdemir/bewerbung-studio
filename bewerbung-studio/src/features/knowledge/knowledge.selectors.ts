import type {
  KnowledgeCategory,
  KnowledgeSection,
} from "./knowledge.types";
import { visibleKnowledgeItems } from "./knowledge.utils";

export const selectVisibleKnowledgeCategories = (
  section: KnowledgeSection,
) =>
  section.isVisible
    ? section.categories
        .filter(
          (category) =>
            category.isVisible &&
            (visibleKnowledgeItems(category.items).length > 0 ||
              category.subcategories.some(
                (subcategory) =>
                  subcategory.isVisible &&
                  visibleKnowledgeItems(subcategory.items).length > 0,
              )),
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];

export const selectKnowledgeCategoryById = (
  section: KnowledgeSection,
  categoryId: string,
): KnowledgeCategory | undefined =>
  section.categories.find((category) => category.id === categoryId);

