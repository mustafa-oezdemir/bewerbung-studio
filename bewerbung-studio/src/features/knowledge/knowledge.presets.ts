import type {
  KnowledgeCategoryType,
  KnowledgeProfessionPreset,
} from "./knowledge.types";

export type KnowledgePresetCategory = {
  title: string;
  type: KnowledgeCategoryType;
};

export const professionPresetLabels: Record<
  KnowledgeProfessionPreset,
  string
> = {
  software: "Softwareentwicklung",
  mechanical: "Maschinenbau",
  civil: "Bauingenieurwesen",
  electrical: "Elektrotechnik",
  commercial: "Kaufmännische Berufe",
};

const categories = (
  type: KnowledgeCategoryType,
  titles: string[],
): KnowledgePresetCategory[] => titles.map((title) => ({ title, type }));

export const professionKnowledgePresets: Record<
  KnowledgeProfessionPreset,
  KnowledgePresetCategory[]
> = {
  software: categories("it", [
    "Programmiersprachen",
    "Backend",
    "Frontend",
    "Fullstack",
    "Frameworks",
    "Datenbanken",
    "Cloud",
    "DevOps",
    "Testing",
    "Versionsverwaltung",
    "Methoden",
    "Tools",
  ]),
  mechanical: categories("engineering", [
    "CAD",
    "FEM",
    "Berechnung",
    "Konstruktion",
    "Prozessplanung",
    "Produktionsplanung",
    "Werkstofftechnik",
    "Qualitätsmanagement",
    "Normen und Regelwerke",
    "Technische Dokumentation",
    "Projektmanagement",
  ]),
  civil: categories("engineering", [
    "CAD/BIM",
    "Bauplanung",
    "Bauleitung",
    "Ausschreibung",
    "Kostenplanung",
    "Terminplanung",
    "Qualitätssicherung",
    "Baurecht und Normen",
    "Projektmanagement",
    "Software",
  ]),
  electrical: categories("engineering", [
    "Schaltungstechnik",
    "Automatisierung",
    "SPS",
    "EPLAN",
    "Messtechnik",
    "Regelungstechnik",
    "Embedded Systems",
    "Normen",
    "Projektplanung",
    "Software",
  ]),
  commercial: categories("business", [
    "Buchhaltung",
    "Controlling",
    "ERP",
    "SAP",
    "Office",
    "Personalverwaltung",
    "Lohnabrechnung",
    "Steuerrecht",
    "Projektmanagement",
    "Kommunikation",
  ]),
};

export const knowledgeSuggestions: Record<string, string[]> = {
  Backend: [
    "C#",
    "ASP.NET Core",
    "Java",
    "Spring Boot",
    "Node.js",
    "PHP",
    "Laravel",
  ],
  Frontend: [
    "TypeScript",
    "JavaScript",
    "React",
    "Angular",
    "Vue.js",
    "HTML",
    "CSS",
  ],
  CAD: [
    "AutoCAD",
    "SolidWorks",
    "CATIA",
    "Siemens NX",
    "Inventor",
    "Revit",
  ],
  Prozessplanung: [
    "Lean Management",
    "Wertstromanalyse",
    "Six Sigma",
    "Prozessoptimierung",
    "Produktionsplanung",
  ],
  Qualitätsmanagement: [
    "ISO 9001",
    "FMEA",
    "8D",
    "APQP",
    "PPAP",
    "IATF 16949",
  ],
};

export const getKnowledgeSuggestions = (
  categoryTitle: string,
  query = "",
) => {
  const normalizedCategory = categoryTitle.toLocaleLowerCase("de-DE");
  const entry = Object.entries(knowledgeSuggestions).find(([title]) =>
    normalizedCategory.includes(title.toLocaleLowerCase("de-DE")),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("de-DE");
  return (entry?.[1] ?? []).filter(
    (suggestion) =>
      !normalizedQuery ||
      suggestion.toLocaleLowerCase("de-DE").includes(normalizedQuery),
  );
};

