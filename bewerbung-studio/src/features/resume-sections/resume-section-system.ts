import {
  getResumeBlockDefinition,
  resolveKnowledgeSlot,
  type ResumeBlockItem,
  type ResumeBlockRendererType,
  type ResumeKnowledgeSlot,
} from "./knowledge-block-registry";

export const resumeSemanticTypes = [
  "heading",
  "personalData",
  "photo",
  "summary",
  "career",
  "education",
  "knowledge",
  "interests",
  "closing",
] as const;

export type ResumeSemanticType = (typeof resumeSemanticTypes)[number];
export type ResumeSectionRequirement = "required" | "recommended" | "optional";

/**
 * How the Lebenslauf-Überschrift (`heading`) is built. The mode is stored, never the finished string, so
 * "with-name" follows the profile name; the text of "custom" lives in the heading's `customTitle`.
 */
export const resumeHeadingModes = [
  "default",
  "with-name",
  "curriculum-vitae",
  "custom",
] as const;
export type ResumeHeadingMode = (typeof resumeHeadingModes)[number];
export const defaultResumeHeadingTitle = "Lebenslauf";

/**
 * The size of the Bewerbungsfoto (semantic section `photo`): three steps relative to the template's own photo,
 * "medium" being that native photo. The scales and the template adapters live in `shared/resumePhoto.ts`.
 */
export const resumePhotoSizes = ["small", "medium", "large"] as const;
export type ResumePhotoSize = (typeof resumePhotoSizes)[number];
export const defaultResumePhotoSize: ResumePhotoSize = "medium";

export type ResumeSectionDefinition = {
  id: ResumeSemanticType;
  semanticType: ResumeSemanticType;
  defaultTitle: string;
  requirement: ResumeSectionRequirement;
  locked: boolean;
  renamable: boolean;
  hideable: boolean;
  deletable: boolean;
};

export type ResumeSectionInstance = {
  semanticType: ResumeSemanticType;
  customTitle: string;
  /** Only the `heading` section carries a mode; absent = derived (custom when a legacy `customTitle` exists, else default). */
  headingMode?: ResumeHeadingMode;
  visible: boolean;
  enabled: boolean;
  order: number;
};

export const resumeSectionDefinitions: readonly ResumeSectionDefinition[] = [
  {
    id: "heading",
    semanticType: "heading",
    defaultTitle: defaultResumeHeadingTitle,
    requirement: "required",
    locked: true,
    renamable: true,
    hideable: false,
    deletable: false,
  },
  {
    id: "personalData",
    semanticType: "personalData",
    defaultTitle: "Persönliche Daten",
    requirement: "required",
    locked: true,
    renamable: true,
    hideable: true,
    deletable: false,
  },
  {
    id: "photo",
    semanticType: "photo",
    defaultTitle: "Bewerbungsfoto",
    requirement: "optional",
    locked: false,
    renamable: false,
    hideable: true,
    deletable: true,
  },
  {
    id: "summary",
    semanticType: "summary",
    defaultTitle: "Kurzprofil",
    requirement: "recommended",
    locked: false,
    renamable: true,
    hideable: true,
    deletable: false,
  },
  {
    id: "career",
    semanticType: "career",
    defaultTitle: "Beruflicher Werdegang",
    requirement: "required",
    locked: true,
    renamable: true,
    hideable: true,
    deletable: false,
  },
  {
    id: "education",
    semanticType: "education",
    defaultTitle: "Bildungsweg",
    requirement: "required",
    locked: true,
    renamable: true,
    hideable: true,
    deletable: false,
  },
  {
    id: "knowledge",
    semanticType: "knowledge",
    defaultTitle: "Besondere Kenntnisse",
    requirement: "recommended",
    locked: false,
    renamable: true,
    hideable: true,
    deletable: false,
  },
  {
    id: "interests",
    semanticType: "interests",
    defaultTitle: "Interessen und Hobbys",
    requirement: "optional",
    locked: false,
    renamable: true,
    hideable: true,
    deletable: true,
  },
  {
    id: "closing",
    semanticType: "closing",
    defaultTitle: "Ort, Datum und Unterschrift",
    requirement: "recommended",
    locked: false,
    renamable: true,
    hideable: true,
    deletable: false,
  },
] as const;

export const defaultResumeSectionInstances = (): ResumeSectionInstance[] =>
  resumeSectionDefinitions.map((definition, order) => ({
    semanticType: definition.semanticType,
    customTitle: "",
    visible: definition.requirement !== "optional",
    enabled: definition.requirement !== "optional",
    order,
  }));

export const resolveResumeSectionInstances = (
  saved: readonly ResumeSectionInstance[] | undefined,
) => {
  const byType = new Map(saved?.map((item) => [item.semanticType, item]));
  return defaultResumeSectionInstances()
    .map((fallback) => {
      const current = byType.get(fallback.semanticType);
      const definition = resumeSectionDefinitions.find(
        (item) => item.semanticType === fallback.semanticType,
      )!;
      return {
        ...fallback,
        ...current,
        // A section that cannot be hidden stays visible, whatever an older save says.
        visible: definition.hideable
          ? (current?.visible ?? fallback.visible)
          : true,
        enabled: definition.hideable
          ? (current?.enabled ?? fallback.enabled)
          : true,
      };
    })
    .sort((left, right) => left.order - right.order);
};

export const getResumeSemanticSection = (
  saved: readonly ResumeSectionInstance[] | undefined,
  type: ResumeSemanticType,
) =>
  resolveResumeSectionInstances(saved).find(
    (item) => item.semanticType === type,
  )!;

export const getResumeSemanticTitle = (
  saved: readonly ResumeSectionInstance[] | undefined,
  type: ResumeSemanticType,
) => {
  const instance = getResumeSemanticSection(saved, type);
  const definition = resumeSectionDefinitions.find(
    (item) => item.semanticType === type,
  )!;
  return instance.customTitle.trim() || definition.defaultTitle;
};

export const validateRequiredResumeSections = (
  saved: readonly ResumeSectionInstance[] | undefined,
) => {
  const resolved = resolveResumeSectionInstances(saved);
  return resumeSectionDefinitions
    .filter((definition) => definition.requirement === "required")
    .filter((definition) => {
      const instance = resolved.find(
        (item) => item.semanticType === definition.semanticType,
      );
      return !instance?.enabled || !instance.visible;
    })
    .map((definition) => definition.defaultTitle);
};

export const resumePersonalFieldKeys = [
  "address",
  "phone",
  "email",
  "linkedin",
  "github",
  "website",
  "onlineProfiles",
  "birthDate",
  "birthPlace",
  "nationality",
  "familyStatus",
  "children",
  "drivingLicense",
  "xing",
] as const;

export type ResumePersonalFieldKey = (typeof resumePersonalFieldKeys)[number];

export const resumePersonalFieldLabels: Record<ResumePersonalFieldKey, string> =
  {
    address: "Adresse",
    phone: "Telefon",
    email: "E-Mail",
    linkedin: "LinkedIn",
    github: "GitHub",
    website: "Website",
    onlineProfiles: "Weitere Online-Profile",
    birthDate: "Geburtsdatum",
    birthPlace: "Geburtsort",
    nationality: "Staatsangehörigkeit",
    familyStatus: "Familienstand",
    children: "Kinder",
    drivingLicense: "Führerschein",
    xing: "Xing",
  };

export const defaultResumePersonalFieldVisibility = Object.fromEntries(
  resumePersonalFieldKeys.map((key) => [
    key,
    ![
      "birthDate",
      "birthPlace",
      "nationality",
      "familyStatus",
      "children",
      "drivingLicense",
      "xing",
    ].includes(key),
  ]),
) as Record<ResumePersonalFieldKey, boolean>;

/**
 * Older saves know fewer keys: a missing key takes its privacy-safe default (Familienstand and Kinder stay off
 * until the user asks for them) and keys that are no longer known are dropped, so no profile fails to load.
 */
export const resolveResumePersonalFieldVisibility = (
  saved: unknown,
): Record<ResumePersonalFieldKey, boolean> => {
  const source =
    saved && typeof saved === "object"
      ? (saved as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    resumePersonalFieldKeys.map((key) => [
      key,
      typeof source[key] === "boolean"
        ? source[key]
        : defaultResumePersonalFieldVisibility[key],
    ]),
  ) as Record<ResumePersonalFieldKey, boolean>;
};

export type ResumeKnowledgeGroup = {
  id: string;
  title: string;
  semanticType: string;
  visible: boolean;
  order: number;
  items: ResumeBlockItem[];
  rendererType: ResumeBlockRendererType;
  slot: ResumeKnowledgeSlot;
  slotOverrides: Record<string, ResumeKnowledgeSlot>;
  pageBreakBefore: boolean;
};

export const getDefaultKnowledgeGroups = (
  templateId: string,
): ResumeKnowledgeGroup[] => {
  const titles =
    templateId === "pehlione_white_blue" || templateId === "pehlione_white"
      ? ["Kernkompetenzen", "Technische Schwerpunkte"]
      : templateId === "stilvoll"
        ? ["Kenntnisse", "Sprachen", "Stärken"]
        : ["Kenntnisse", "Sprachen"];
  return titles.map((title, order) => {
    const semanticType =
      title === "Kernkompetenzen"
        ? "core-competencies"
        : title === "Technische Schwerpunkte"
          ? "technical-focus"
          : title.toLocaleLowerCase("de-DE").replace(/\s+/g, "-");
    return {
      id: `default-${templateId}-${order}`,
      title,
      semanticType,
      visible: true,
      order,
      items: [],
      rendererType:
        order === 1 &&
        (templateId === "pehlione_white_blue" ||
          templateId === "pehlione_white")
          ? "icon-list"
          : "bullet-list",
      slot: resolveKnowledgeSlot(
        templateId,
        semanticType,
        templateId === "pehlione_white_blue" || templateId === "pehlione_white"
          ? "sidebar"
          : undefined,
      ),
      slotOverrides: {},
      pageBreakBefore: false,
    };
  });
};

export const resolveKnowledgeGroups = (
  templateId: string,
  saved: readonly ResumeKnowledgeGroup[] | undefined,
) => {
  if (saved?.length)
    return [...saved]
      .map((group) => {
        const definition = getResumeBlockDefinition(group.semanticType);
        return {
          ...group,
          rendererType: definition?.allowedRenderers.includes(
            group.rendererType,
          )
            ? group.rendererType
            : (definition?.defaultRenderer ?? group.rendererType),
          slot: resolveKnowledgeSlot(
            templateId,
            group.semanticType,
            group.slotOverrides?.[templateId] ?? group.slot,
          ),
          items: [...group.items].sort(
            (left, right) => left.order - right.order,
          ),
        };
      })
      .sort((left, right) => left.order - right.order);
  return getDefaultKnowledgeGroups(templateId);
};
