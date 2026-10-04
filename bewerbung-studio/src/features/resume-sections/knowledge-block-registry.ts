export const resumeBlockRendererTypes = [
  "bullet-list",
  "text-list",
  "icon-list",
  "skill-level",
  "tag-list",
  "timeline",
  "certificate-list",
  "project-highlight",
  "language-level",
  "two-column-list",
  "compact-grid",
] as const;

export type ResumeBlockRendererType = (typeof resumeBlockRendererTypes)[number];

export const resumeKnowledgeSlots = ["sidebar", "main", "full"] as const;
export type ResumeKnowledgeSlot = (typeof resumeKnowledgeSlots)[number];

export type ResumeBlockItem = {
  id: string;
  text: string;
  description: string;
  icon: string;
  level: string;
  order: number;
  visible: boolean;
};

export type ResumeBlockDefinition = {
  id: string;
  title: string;
  category: "Empfohlen" | "Fachlich" | "Karriere" | "Persönlich";
  defaultRenderer: ResumeBlockRendererType;
  allowedRenderers: readonly ResumeBlockRendererType[];
  preferredSlot: ResumeKnowledgeSlot;
  requiresMainColumn?: boolean;
  allowMultiple?: boolean;
};

const listRenderers = [
  "bullet-list",
  "text-list",
  "icon-list",
  "tag-list",
  "two-column-list",
  "compact-grid",
] as const;

export const resumeBlockRegistry: readonly ResumeBlockDefinition[] = [
  {
    id: "core-competencies",
    title: "Kernkompetenzen",
    category: "Empfohlen",
    defaultRenderer: "bullet-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "technical-focus",
    title: "Technische Schwerpunkte",
    category: "Empfohlen",
    defaultRenderer: "icon-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "strengths",
    title: "Stärken",
    category: "Empfohlen",
    defaultRenderer: "bullet-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "professional-knowledge",
    title: "Fachliche Kenntnisse",
    category: "Fachlich",
    defaultRenderer: "bullet-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "it-knowledge",
    title: "IT-Kenntnisse",
    category: "Fachlich",
    defaultRenderer: "icon-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "software-knowledge",
    title: "Softwarekenntnisse",
    category: "Fachlich",
    defaultRenderer: "skill-level",
    allowedRenderers: resumeBlockRendererTypes,
    preferredSlot: "sidebar",
  },
  {
    id: "tools",
    title: "Tools",
    category: "Fachlich",
    defaultRenderer: "tag-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "technologies",
    title: "Technologien",
    category: "Fachlich",
    defaultRenderer: "tag-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "methods",
    title: "Methoden",
    category: "Fachlich",
    defaultRenderer: "bullet-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "languages",
    title: "Sprachen",
    category: "Empfohlen",
    defaultRenderer: "language-level",
    allowedRenderers: ["language-level", "text-list", "skill-level"],
    preferredSlot: "sidebar",
  },
  {
    id: "certificates",
    title: "Zertifikate",
    category: "Fachlich",
    defaultRenderer: "certificate-list",
    allowedRenderers: ["certificate-list", "text-list", "compact-grid"],
    preferredSlot: "main",
  },
  {
    id: "training",
    title: "Weiterbildungen",
    category: "Karriere",
    defaultRenderer: "certificate-list",
    allowedRenderers: [
      "certificate-list",
      "timeline",
      "text-list",
      "compact-grid",
    ],
    preferredSlot: "main",
  },
  {
    id: "project-highlight",
    title: "Projekt-Highlight",
    category: "Karriere",
    defaultRenderer: "project-highlight",
    allowedRenderers: ["project-highlight", "text-list", "compact-grid"],
    preferredSlot: "main",
    requiresMainColumn: true,
    allowMultiple: true,
  },
  {
    id: "projects",
    title: "Projekte",
    category: "Karriere",
    defaultRenderer: "project-highlight",
    allowedRenderers: ["project-highlight", "timeline", "text-list"],
    preferredSlot: "main",
    requiresMainColumn: true,
  },
  {
    id: "soft-skills",
    title: "Soft Skills",
    category: "Persönlich",
    defaultRenderer: "tag-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "hard-skills",
    title: "Hard Skills",
    category: "Fachlich",
    defaultRenderer: "tag-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "industry-knowledge",
    title: "Branchenkenntnisse",
    category: "Fachlich",
    defaultRenderer: "bullet-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
  {
    id: "driving-license",
    title: "Führerschein",
    category: "Persönlich",
    defaultRenderer: "text-list",
    allowedRenderers: ["text-list", "icon-list"],
    preferredSlot: "sidebar",
  },
  {
    id: "volunteering",
    title: "Ehrenamt",
    category: "Persönlich",
    defaultRenderer: "timeline",
    allowedRenderers: ["timeline", "text-list"],
    preferredSlot: "main",
  },
  {
    id: "publications",
    title: "Publikationen",
    category: "Karriere",
    defaultRenderer: "text-list",
    allowedRenderers: ["text-list", "certificate-list"],
    preferredSlot: "main",
  },
  {
    id: "awards",
    title: "Auszeichnungen",
    category: "Karriere",
    defaultRenderer: "certificate-list",
    allowedRenderers: ["certificate-list", "text-list"],
    preferredSlot: "main",
  },
  {
    id: "other-knowledge",
    title: "Sonstige Kenntnisse",
    category: "Persönlich",
    defaultRenderer: "bullet-list",
    allowedRenderers: listRenderers,
    preferredSlot: "sidebar",
  },
] as const;

export type ResumeTemplateSlotDefinition = {
  id: ResumeKnowledgeSlot;
  label: string;
  supportsFullWidth: boolean;
};

const oneColumnSlots: readonly ResumeTemplateSlotDefinition[] = [
  { id: "main", label: "Hauptbereich", supportsFullWidth: false },
];

const twoColumnSlots: readonly ResumeTemplateSlotDefinition[] = [
  {
    id: "sidebar",
    label: "Linke Spalte / Seitenleiste",
    supportsFullWidth: false,
  },
  {
    id: "main",
    label: "Rechte Spalte / Hauptbereich",
    supportsFullWidth: false,
  },
  { id: "full", label: "Volle Breite", supportsFullWidth: true },
];

const twoColumnTemplateIds = new Set([
  "pehlione_white_blue",
  "pehlione_white",
  "zweispaltig",
  "gepflegt",
  "modern",
  "elegant",
  "zeitgenoessisch",
  "kreativ",
]);

export const getTemplateKnowledgeSlots = (templateId: string) =>
  twoColumnTemplateIds.has(templateId) ? twoColumnSlots : oneColumnSlots;

export const getResumeBlockDefinition = (semanticType: string) =>
  resumeBlockRegistry.find((definition) => definition.id === semanticType);

export const resolveKnowledgeSlot = (
  templateId: string,
  semanticType: string,
  slot: ResumeKnowledgeSlot | undefined,
) => {
  const available = getTemplateKnowledgeSlots(templateId).map(
    (item) => item.id,
  );
  const definition = getResumeBlockDefinition(semanticType);
  if (definition?.requiresMainColumn && slot === "sidebar") return "main";
  if (slot && available.includes(slot)) return slot;
  if (definition && available.includes(definition.preferredSlot))
    return definition.preferredSlot;
  return available[0] ?? "main";
};

export const createResumeBlockItem = (
  order: number,
  text = "",
): ResumeBlockItem => ({
  id: crypto.randomUUID(),
  text,
  description: "",
  icon: "",
  level: "",
  order,
  visible: true,
});

export const createKnowledgeBlock = (
  templateId: string,
  definition: ResumeBlockDefinition,
  order: number,
) => ({
  id: crypto.randomUUID(),
  title: definition.title,
  semanticType: definition.id,
  visible: true,
  order,
  items: [] as ResumeBlockItem[],
  rendererType: definition.defaultRenderer,
  slot: resolveKnowledgeSlot(
    templateId,
    definition.id,
    definition.preferredSlot,
  ),
  slotOverrides: {},
  pageBreakBefore: false,
});

export const rendererTypeLabels: Record<ResumeBlockRendererType, string> = {
  "bullet-list": "Bullet-Liste",
  "text-list": "Textliste",
  "icon-list": "Icon-Liste",
  "skill-level": "Kenntnislevel",
  "tag-list": "Tags",
  timeline: "Zeitleiste",
  "certificate-list": "Zertifikate",
  "project-highlight": "Projekt-Highlight",
  "language-level": "Sprachniveau",
  "two-column-list": "Zweispaltige Liste",
  "compact-grid": "Kompaktes Raster",
};
