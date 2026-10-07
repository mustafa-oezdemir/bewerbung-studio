import type { ApplicantProfile } from "../../shared/schema";
import {
  resolveResumeSectionInstances,
  type ResumeSemanticType,
} from "./resume-section-system";

export const resumeSectionTypes = [
  "summary",
  "strengths",
  "experience",
  "education",
  "projects",
  "knowledge",
  "certifications",
  "languages",
  "additional",
  "references",
] as const;

export type ResumeSectionType = (typeof resumeSectionTypes)[number];

export const sectionZones = [
  "main",
  "sidebar",
  "full",
  "left-sidebar",
  "right-sidebar",
] as const;
export type SectionZone = (typeof sectionZones)[number];

export type ResumeSectionPlacement = {
  type: ResumeSectionType;
  zone: SectionZone;
};

export type ResumeSectionLayoutsByTemplate = Record<
  string,
  ResumeSectionPlacement[]
>;

export type TemplateSectionCapabilities = {
  templateId: string;
  availableZones: readonly SectionZone[];
  lockedSectionTypes: readonly ResumeSectionType[];
  allowedZonesBySection: Partial<
    Record<ResumeSectionType, readonly SectionZone[]>
  >;
  defaultSectionOrder: readonly ResumeSectionType[];
  defaultZoneBySection: Partial<Record<ResumeSectionType, SectionZone>>;
  compactSinglePage?: boolean;
  timelineSections?: readonly ResumeSectionType[];
};

export const resumeSectionLabels: Record<ResumeSectionType, string> = {
  summary: "Kurzprofil",
  strengths: "Stärken",
  experience: "Beruflicher Werdegang",
  education: "Bildungsweg",
  projects: "Projekte",
  knowledge: "Besondere Kenntnisse",
  certifications: "Zertifikate",
  languages: "Sprachen",
  additional: "Zusatzangaben",
  references: "Referenzen",
};

export const defaultEditableResumeSectionTitles = {
  summary: "Kurzprofil",
  strengths: "Stärken",
  experience: "Beruflicher Werdegang",
  education: "Bildungsweg",
  languages: "Sprachen",
  certifications: "Zertifikate",
} as const;

export type EditableResumeSectionTitle =
  keyof typeof defaultEditableResumeSectionTitles;

/**
 * Titles that older profiles stored as their default (every profile saved one). They stand for "no own title":
 * the section then shows today's default. Any other stored title is the user's own and stays.
 */
const legacyDefaultTitles: Partial<Record<EditableResumeSectionTitle, string>> = {
  summary: "Zusammenfassung",
  experience: "Berufserfahrung",
  education: "Ausbildung",
};

const titleSemanticTypes: Partial<
  Record<ResumeSectionType, ResumeSemanticType>
> = {
  summary: "summary",
  experience: "career",
  education: "education",
  knowledge: "knowledge",
};

export const setResumeSectionTitle = (
  profile: ApplicantProfile,
  type: ResumeSectionType,
  value: string,
): ApplicantProfile => {
  const title = value.trim() ? value : resumeSectionLabels[type];
  const semanticType = titleSemanticTypes[type];
  const overrides = { ...profile.resumeManagerOverrides };
  if (overrides[type]) {
    const { title: _oldTitle, ...rest } = overrides[type];
    overrides[type] = rest;
  }
  const groupTypes: Record<string, string> = {
    "core-competencies": "strengths",
    stärken: "strengths",
    strengths: "strengths",
    "technical-focus": "knowledge",
    kenntnisse: "knowledge",
    sprachen: "languages",
    languages: "languages",
    certificates: "certifications",
  };
  return {
    ...profile,
    resumeManagerOverrides: overrides,
    ...(type in defaultEditableResumeSectionTitles
      ? {
          resumeSectionTitles: {
            ...profile.resumeSectionTitles,
            [type]: title,
          },
        }
      : {}),
    ...(type === "knowledge"
      ? { knowledgeSection: { ...profile.knowledgeSection, title } }
      : {}),
    resumeSemanticSections: semanticType
      ? resolveResumeSectionInstances(profile.resumeSemanticSections).map(
          (section) =>
            section.semanticType === semanticType
              ? { ...section, customTitle: value }
              : section,
        )
      : profile.resumeSemanticSections,
    resumeKnowledgeGroups: profile.resumeKnowledgeGroups.map((group) =>
      groupTypes[group.semanticType] === type ? { ...group, title } : group,
    ),
  };
};

export const getResumeSectionTitle = (
  profile: ApplicantProfile | undefined,
  type: ResumeSectionType,
) => {
  const override = profile?.resumeManagerOverrides?.[type]?.title;
  if (override?.trim()) return override;
  const semantic = profile?.resumeSemanticSections.find(
    (section) => section.semanticType === titleSemanticTypes[type],
  )?.customTitle;
  if (semantic?.trim()) return semantic;
  if (type === "knowledge") {
    const stored = profile?.knowledgeSection.title.trim() ?? "";
    return stored && stored !== "Kenntnisse & Zusatzangaben"
      ? stored : resumeSectionLabels.knowledge;
  }
  if (type in defaultEditableResumeSectionTitles) {
    const editableType = type as EditableResumeSectionTitle;
    const stored = profile?.resumeSectionTitles?.[editableType]?.trim() ?? "";
    return (
      (stored && stored !== legacyDefaultTitles[editableType] ? stored : "") ||
      defaultEditableResumeSectionTitles[editableType]
    );
  }
  return resumeSectionLabels[type];
};

const naturalOrder: readonly ResumeSectionType[] = [
  "summary",
  "strengths",
  "experience",
  "education",
  "projects",
  "knowledge",
  "certifications",
  "languages",
  "additional",
  "references",
];

const languagesFirstOrder: readonly ResumeSectionType[] = [
  "summary",
  "strengths",
  "experience",
  "education",
  "projects",
  "knowledge",
  "languages",
  "certifications",
  "additional",
  "references",
];

const mainOnlyCapabilities = (
  templateId: string,
  options: Pick<
    TemplateSectionCapabilities,
    "compactSinglePage" | "timelineSections"
  > = {},
): TemplateSectionCapabilities => ({
  templateId,
  availableZones: ["main"],
  lockedSectionTypes: [],
  allowedZonesBySection: Object.fromEntries(
    resumeSectionTypes.map((type) => [type, ["main"]]),
  ) as TemplateSectionCapabilities["allowedZonesBySection"],
  defaultSectionOrder: naturalOrder,
  defaultZoneBySection: Object.fromEntries(
    resumeSectionTypes.map((type) => [type, "main"]),
  ) as TemplateSectionCapabilities["defaultZoneBySection"],
  ...options,
});

const twoColumnCapabilities = (
  templateId: string,
): TemplateSectionCapabilities => ({
  templateId,
  availableZones: ["main", "sidebar", "full"],
  lockedSectionTypes: [],
  allowedZonesBySection: {
    summary: ["sidebar", "full"],
    strengths: ["sidebar", "full"],
    experience: ["main"],
    education: ["main"],
    projects: ["main"],
    knowledge: ["sidebar", "main"],
    certifications: ["main", "sidebar"],
    languages: ["sidebar"],
    additional: ["main", "sidebar", "full"],
    references: ["main", "sidebar", "full"],
  },
  defaultSectionOrder: naturalOrder,
  defaultZoneBySection: {
    summary: "sidebar",
    strengths: "sidebar",
    experience: "main",
    education: "main",
    projects: "main",
    knowledge: "sidebar",
    certifications: "sidebar",
    languages: "sidebar",
    additional: "main",
    references: "main",
  },
});

// The Pehlione templates draw their certificates in the main column until the user moves them; the
// section list must show them where the output has them.
const pehlioneCapabilities = (templateId: string): TemplateSectionCapabilities => {
  const capabilities = twoColumnCapabilities(templateId);
  return {
    ...capabilities,
    defaultZoneBySection: { ...capabilities.defaultZoneBySection, certifications: "main" },
  };
};

// Modern draws its summary at the top of the career column; the section list must show it there, and a
// layout the user saves must not move it into the sidebar.
const modernCapabilities = (): TemplateSectionCapabilities => {
  const capabilities = twoColumnCapabilities("modern");
  return {
    ...capabilities,
    allowedZonesBySection: { ...capabilities.allowedZonesBySection, summary: ["main", "sidebar", "full"] },
    defaultZoneBySection: { ...capabilities.defaultZoneBySection, summary: "main" },
  };
};

const zeitgenoessischCapabilities = (): TemplateSectionCapabilities => {
  const capabilities = twoColumnCapabilities("zeitgenoessisch");
  return {
    ...capabilities,
    allowedZonesBySection: {
      ...capabilities.allowedZonesBySection,
      summary: ["main", "sidebar"],
      strengths: ["main", "sidebar"],
      languages: ["main", "sidebar"],
    },
    defaultZoneBySection: { ...capabilities.defaultZoneBySection, summary: "main" },
  };
};

export const templateSectionCapabilities: Record<
  string,
  TemplateSectionCapabilities
> = {
  pehlione_white_blue: pehlioneCapabilities("pehlione_white_blue"),
  pehlione_white: pehlioneCapabilities("pehlione_white"),
  // Ivy League draws its sections in the same order: the section list shows it.
  "ivy-league": { ...mainOnlyCapabilities("ivy-league"), defaultSectionOrder: languagesFirstOrder },
  // Stilvoll draws a left sidebar (summary, strengths, languages, knowledge) beside the career column.
  stilvoll: twoColumnCapabilities("stilvoll"),
  kompakt: {
    ...twoColumnCapabilities("kompakt"),
    compactSinglePage: false,
    allowedZonesBySection: {
      ...twoColumnCapabilities("kompakt").allowedZonesBySection,
      summary: ["main", "sidebar"],
      strengths: ["main", "sidebar"],
      languages: ["main", "sidebar"],
    },
    defaultZoneBySection: {
      ...twoColumnCapabilities("kompakt").defaultZoneBySection,
      summary: "main",
      languages: "main",
    },
  },
  // Einspaltig and Klassisch draw their languages ahead of the certificates: the section list shows that order.
  einspaltig: { ...mainOnlyCapabilities("einspaltig"), defaultSectionOrder: languagesFirstOrder },
  klassisch: { ...mainOnlyCapabilities("klassisch"), defaultSectionOrder: languagesFirstOrder },
  tabellarisch: mainOnlyCapabilities("tabellarisch", {
    timelineSections: ["experience", "education"],
  }),
  zweispaltig: twoColumnCapabilities("zweispaltig"),
  gepflegt: twoColumnCapabilities("gepflegt"),
  modern: modernCapabilities(),
  elegant: twoColumnCapabilities("elegant"),
  zeitgenoessisch: zeitgenoessischCapabilities(),
  kreativ: twoColumnCapabilities("kreativ"),
};

export const getTemplateSectionCapabilities = (templateId: string) =>
  templateSectionCapabilities[templateId] ?? mainOnlyCapabilities(templateId);

export const getDefaultResumeSectionLayout = (
  templateId: string,
): ResumeSectionPlacement[] => {
  const capabilities = getTemplateSectionCapabilities(templateId);
  return capabilities.defaultSectionOrder.map((type) => ({
    type,
    zone: capabilities.defaultZoneBySection[type] ?? "main",
  }));
};

export const resolveResumeSectionLayout = (
  templateId: string,
  savedLayout: readonly ResumeSectionPlacement[] | undefined,
): ResumeSectionPlacement[] => {
  const capabilities = getTemplateSectionCapabilities(templateId);
  const defaults = getDefaultResumeSectionLayout(templateId);
  const known = new Set<ResumeSectionType>();
  const resolved = (savedLayout ?? []).flatMap((placement) => {
    if (
      !resumeSectionTypes.includes(placement.type) ||
      known.has(placement.type)
    ) {
      return [];
    }
    known.add(placement.type);
    const allowed = capabilities.allowedZonesBySection[placement.type] ?? [
      "main",
    ];
    return [
      {
        type: placement.type,
        zone: allowed.includes(placement.zone)
          ? placement.zone
          : (allowed[0] ?? "main"),
      },
    ];
  });
  return [...resolved, ...defaults.filter(({ type }) => !known.has(type))];
};

export const getProfileResumeSectionLayout = (
  profile:
    | Pick<ApplicantProfile, "resumeSectionLayout" | "resumeSectionLayouts">
    | undefined,
  templateId: string,
) =>
  resolveResumeSectionLayout(
    templateId,
    profile?.resumeSectionLayouts?.[templateId] ?? profile?.resumeSectionLayout,
  );

export const hasSavedTemplateSectionLayout = (
  profile:
    | Pick<ApplicantProfile, "resumeSectionLayout" | "resumeSectionLayouts">
    | undefined,
  templateId: string,
) =>
  Boolean(
    profile?.resumeSectionLayouts?.[templateId]?.length ||
    profile?.resumeSectionLayout?.length,
  );

export const isResumeSectionVisible = (
  profile: Pick<ApplicantProfile, "resumeSections"> | undefined,
  type: ResumeSectionType,
) => {
  const visible = profile?.resumeSections;
  if (!visible) return true;
  if (type === "summary") return visible.profile;
  if (type === "strengths") return visible.strengths;
  if (type === "knowledge") return visible.skills;
  if (type === "experience") return visible.experience;
  if (type === "education") return visible.education;
  if (type === "languages") return visible.languages;
  if (type === "certifications") return visible.certifications;
  return false;
};

export const moveResumeSection = (
  templateId: string,
  current: readonly ResumeSectionPlacement[] | undefined,
  type: ResumeSectionType,
  destination: SectionZone,
  targetIndex: number,
) => {
  const capabilities = getTemplateSectionCapabilities(templateId);
  const allowed = capabilities.allowedZonesBySection[type] ?? ["main"];
  if (!allowed.includes(destination))
    return resolveResumeSectionLayout(templateId, current);

  const layout = resolveResumeSectionLayout(templateId, current);
  const sourceIndex = layout.findIndex((item) => item.type === type);
  if (sourceIndex < 0) return layout;
  const withoutSource = layout.filter((item) => item.type !== type);
  const destinationItems = withoutSource.filter(
    (item) => item.zone === destination,
  );
  const beforeDestination = withoutSource.findIndex(
    (item) =>
      item ===
      destinationItems[
        Math.max(0, Math.min(targetIndex, destinationItems.length))
      ],
  );
  const insertionIndex =
    beforeDestination < 0 ? withoutSource.length : beforeDestination;
  withoutSource.splice(insertionIndex, 0, { type, zone: destination });
  return withoutSource;
};
