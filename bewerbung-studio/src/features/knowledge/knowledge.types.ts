export const knowledgeDisplayModes = [
  "comma-separated",
  "one-per-line",
  "tags",
  "bullets",
  "level-bars",
  "level-dots",
] as const;

export const knowledgeLevels = [
  "basic",
  "good",
  "advanced",
  "expert",
  "none",
] as const;

export const knowledgeCategoryTypes = [
  "it",
  "engineering",
  "business",
  "language",
  "software",
  "method",
  "certificate",
  "additional",
  "custom",
] as const;

export type KnowledgeDisplayMode = (typeof knowledgeDisplayModes)[number];
export type KnowledgeLevel = (typeof knowledgeLevels)[number];
export type KnowledgeCategoryType = (typeof knowledgeCategoryTypes)[number];

export interface KnowledgeItem {
  iconId?: string;
  id: string;
  name: string;
  description?: string;
  level: KnowledgeLevel;
  yearsOfExperience?: number;
  lastUsedYear?: number;
  isVisible: boolean;
  sortOrder: number;
}

export interface KnowledgeSubcategory {
  id: string;
  title: string;
  items: KnowledgeItem[];
  displayMode?: KnowledgeDisplayMode;
  isVisible: boolean;
  sortOrder: number;
}

export interface KnowledgeCategory {
  id: string;
  title: string;
  type: KnowledgeCategoryType;
  subtitle?: string;
  items: KnowledgeItem[];
  subcategories: KnowledgeSubcategory[];
  displayMode: KnowledgeDisplayMode;
  showLevels: boolean;
  showYearsOfExperience: boolean;
  isVisible: boolean;
  sortOrder: number;
}

export interface KnowledgeSection {
  title: string;
  categories: KnowledgeCategory[];
  isVisible: boolean;
}

export type KnowledgeProfessionPreset =
  | "software"
  | "mechanical"
  | "civil"
  | "electrical"
  | "commercial";

export type KnowledgeValidationIssue = {
  path: string;
  message: string;
};

