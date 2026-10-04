import { defaultKnowledgeSection } from "./knowledge.constants";
import {
  professionKnowledgePresets,
} from "./knowledge.presets";
import type {
  KnowledgeProfessionPreset,
  KnowledgeSection,
} from "./knowledge.types";
import {
  createKnowledgeCategory,
  createKnowledgeItem,
  flattenKnowledgeNames,
} from "./knowledge.utils";

export const ensureKnowledgeSection = (
  section: KnowledgeSection | undefined,
  legacySkills: string[],
): KnowledgeSection => {
  if (section?.categories.length) return structuredClone(section);
  if (!legacySkills.filter(Boolean).length)
    return structuredClone(section ?? defaultKnowledgeSection);
  const category = createKnowledgeCategory("Kenntnisse", 0, "custom");
  category.items = legacySkills
    .filter(Boolean)
    .map((skill, sortOrder) => createKnowledgeItem(skill, sortOrder));
  return {
    title: section?.title || defaultKnowledgeSection.title,
    categories: [category],
    isVisible: section?.isVisible ?? true,
  };
};

export const addProfessionPreset = (
  section: KnowledgeSection,
  preset: KnowledgeProfessionPreset,
) => {
  const existing = new Set(
    section.categories.map((category) =>
      category.title.trim().toLocaleLowerCase("de-DE"),
    ),
  );
  const additions = professionKnowledgePresets[preset]
    .filter(
      (presetCategory) =>
        !existing.has(
          presetCategory.title.trim().toLocaleLowerCase("de-DE"),
        ),
    )
    .map((presetCategory, index) =>
      createKnowledgeCategory(
        presetCategory.title,
        section.categories.length + index,
        presetCategory.type,
      ),
    );
  return {
    ...section,
    categories: [...section.categories, ...additions],
  };
};

export const duplicateKnowledgeCategory = (
  section: KnowledgeSection,
  categoryId: string,
) => {
  const source = section.categories.find(
    (category) => category.id === categoryId,
  );
  if (!source) return section;
  const duplicate = structuredClone(source);
  duplicate.id = crypto.randomUUID();
  duplicate.title = `${duplicate.title} Kopie`;
  duplicate.sortOrder = section.categories.length;
  duplicate.items = duplicate.items.map((item, sortOrder) => ({
    ...item,
    id: crypto.randomUUID(),
    sortOrder,
  }));
  duplicate.subcategories = duplicate.subcategories.map(
    (subcategory, sortOrder) => ({
      ...subcategory,
      id: crypto.randomUUID(),
      sortOrder,
      items: subcategory.items.map((item, itemOrder) => ({
        ...item,
        id: crypto.randomUUID(),
        sortOrder: itemOrder,
      })),
    }),
  );
  return {
    ...section,
    categories: [...section.categories, duplicate],
  };
};

export const cloneKnowledgeCategory = (
  source: KnowledgeSection["categories"][number],
  sortOrder: number,
) => {
  const copy = structuredClone(source);
  copy.id = crypto.randomUUID();
  copy.sortOrder = sortOrder;
  copy.items = copy.items.map((item, itemOrder) => ({
    ...item,
    id: crypto.randomUUID(),
    sortOrder: itemOrder,
  }));
  copy.subcategories = copy.subcategories.map(
    (subcategory, subcategoryOrder) => ({
      ...subcategory,
      id: crypto.randomUUID(),
      sortOrder: subcategoryOrder,
      items: subcategory.items.map((item, itemOrder) => ({
        ...item,
        id: crypto.randomUUID(),
        sortOrder: itemOrder,
      })),
    }),
  );
  return copy;
};

export const syncLegacySkills = (section: KnowledgeSection) =>
  Array.from(new Set(flattenKnowledgeNames(section)));
