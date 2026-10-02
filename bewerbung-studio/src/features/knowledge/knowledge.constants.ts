import type {
  KnowledgeCategoryType,
  KnowledgeDisplayMode,
  KnowledgeLevel,
  KnowledgeSection,
} from "./knowledge.types";

export const knowledgeLevelLabels: Record<KnowledgeLevel, string> = {
  none: "",
  basic: "Grundkenntnisse",
  good: "Gute Kenntnisse",
  advanced: "Fortgeschrittene Kenntnisse",
  expert: "Expertenkenntnisse",
};

export const knowledgeLevelScores: Record<KnowledgeLevel, number> = {
  none: 0,
  basic: 2,
  good: 3,
  advanced: 4,
  expert: 5,
};

export const knowledgeDisplayModeLabels: Record<
  KnowledgeDisplayMode,
  string
> = {
  "comma-separated": "Kommagetrennt",
  "one-per-line": "Eine Zeile je Eintrag",
  tags: "Tags",
  bullets: "Aufzählung",
  "level-bars": "Kenntnisstufe als Balken",
  "level-dots": "Kenntnisstufe als Punkte",
};

export const knowledgeCategoryTypeLabels: Record<
  KnowledgeCategoryType,
  string
> = {
  it: "IT",
  engineering: "Technik",
  business: "Kaufmännisch",
  language: "Sprache",
  software: "Software",
  method: "Methode",
  certificate: "Zertifikat",
  additional: "Zusatzangabe",
  custom: "Benutzerdefiniert",
};

export const defaultKnowledgeSection: KnowledgeSection = {
  title: "Besondere Kenntnisse",
  categories: [],
  isVisible: true,
};

export const predefinedKnowledgeCategories = [
  "Backend",
  "Frontend",
  "Fullstack",
  "Datenbanken",
  "Cloud",
  "DevOps",
  "Programmiersprachen",
  "Frameworks",
  "Tools",
  "Betriebssysteme",
  "Methoden",
  "Projektmanagement",
  "CAD",
  "AutoCAD",
  "FEM",
  "Prozessplanung",
  "Produktionsplanung",
  "Qualitätsmanagement",
  "Normen und Regelwerke",
  "Maschinenbau",
  "Elektrotechnik",
  "Bauwesen",
  "SAP",
  "ERP",
  "Office",
  "Führerscheine",
  "Aufenthaltsstatus",
  "Reisebereitschaft",
  "Verfügbarkeit",
  "Interessen",
  "Sonstige Kenntnisse",
] as const;
