import { z } from "zod";
import {
  knowledgeCategoryTypes,
  knowledgeDisplayModes,
  knowledgeLevels,
  type KnowledgeSection,
  type KnowledgeValidationIssue,
} from "./knowledge.types";

const optionalNumber = z.number().nonnegative().optional();

export const knowledgeItemSchema = z.object({
  iconId: z.string().trim().optional(),
  id: z.uuid(),
  name: z.string().trim(),
  description: z.string().trim().optional(),
  level: z.enum(knowledgeLevels),
  yearsOfExperience: optionalNumber,
  lastUsedYear: z.number().int().min(1900).max(2200).optional(),
  isVisible: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const knowledgeSubcategorySchema = z.object({
  id: z.uuid(),
  title: z.string().trim(),
  items: z.array(knowledgeItemSchema),
  displayMode: z.enum(knowledgeDisplayModes).optional(),
  isVisible: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const knowledgeCategorySchema = z.object({
  id: z.uuid(),
  title: z.string().trim(),
  type: z.enum(knowledgeCategoryTypes),
  subtitle: z.string().trim().optional(),
  items: z.array(knowledgeItemSchema),
  subcategories: z.array(knowledgeSubcategorySchema),
  displayMode: z.enum(knowledgeDisplayModes),
  showLevels: z.boolean(),
  showYearsOfExperience: z.boolean(),
  isVisible: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const knowledgeSectionSchema = z.object({
  title: z.string().trim().default("Kenntnisse & Zusatzangaben"),
  categories: z.array(knowledgeCategorySchema).default([]),
  isVisible: z.boolean().default(true),
});

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("de-DE");

export const validateKnowledgeSection = (
  section: KnowledgeSection,
): KnowledgeValidationIssue[] => {
  const issues: KnowledgeValidationIssue[] = [];
  section.categories.forEach((category, categoryIndex) => {
    if (!category.title.trim()) {
      issues.push({
        path: `categories.${categoryIndex}.title`,
        message: "Leere Kategorienamen können nicht gespeichert werden.",
      });
    }
    const validateItems = (
      items: typeof category.items,
      pathPrefix: string,
    ) => {
      const seen = new Set<string>();
      items.forEach((item, itemIndex) => {
        const name = normalize(item.name);
        if (!name) {
          issues.push({
            path: `${pathPrefix}.${itemIndex}.name`,
            message: "Leere Kenntnisse können nicht gespeichert werden.",
          });
        } else if (seen.has(name)) {
          issues.push({
            path: `${pathPrefix}.${itemIndex}.name`,
            message: `„${item.name}“ ist in dieser Kategorie bereits vorhanden.`,
          });
        }
        seen.add(name);
      });
    };
    validateItems(category.items, `categories.${categoryIndex}.items`);
    category.subcategories.forEach((subcategory, subcategoryIndex) => {
      if (!subcategory.title.trim()) {
        issues.push({
          path: `categories.${categoryIndex}.subcategories.${subcategoryIndex}.title`,
          message: "Leere Unterkategorien können nicht gespeichert werden.",
        });
      }
      validateItems(
        subcategory.items,
        `categories.${categoryIndex}.subcategories.${subcategoryIndex}.items`,
      );
    });
  });
  return issues;
};

