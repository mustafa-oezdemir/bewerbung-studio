import type { ApplicantProfile } from "../../shared/schema";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  isResumeSectionVisible,
} from "./resume-sections";
import {
  getResumeSemanticSection,
  resolveKnowledgeGroups,
  resolveResumeSectionInstances,
  type ResumeSemanticType,
} from "./resume-section-system";

export type ManagerZone = "main" | "sidebar";
export type ManagerSection = {
  id: string;
  title: string;
  visible: boolean;
  zone: ManagerZone;
  fixed?: boolean;
  groupId?: string;
};
export const managerSemanticTypes: Record<string, ResumeSemanticType> = {
  heading: "heading",
  personalData: "personalData",
  photo: "photo",
  summary: "summary",
  experience: "career",
  education: "education",
  knowledge: "knowledge",
  closing: "closing",
};
const legacyKeys: Record<string, keyof ApplicantProfile["resumeSections"]> = {
  summary: "profile",
  experience: "experience",
  education: "education",
  strengths: "strengths",
  knowledge: "skills",
  languages: "languages",
  certifications: "certifications",
};
const nativeSingleTemplates = new Set(["ivy-league", "einspaltig", "klassisch", "tabellarisch"]);
const defaultSidebarSections = new Set(["summary", "strengths", "knowledge", "languages", "certifications"]);
// Placement is independent of the selected visual layout. In single-column
// mode the sidebar group follows the main group; switching back restores it.
export const managerZones = (_templateId: string): ManagerZone[] =>
  ["main", "sidebar"];
export const managerAllowedZones = (
  _templateId: string,
  _id: string,
): ManagerZone[] =>
  ["main", "sidebar"];
export const baseGroupType = (type: string) =>
  ({
    "core-competencies": "strengths",
    "technical-focus": "knowledge",
    kenntnisse: "knowledge",
    sprachen: "languages",
    stärken: "strengths",
    strengths: "strengths",
    languages: "languages",
    certificates: "certifications",
  })[type];

export const getManagerSections = (
  profile: ApplicantProfile,
  templateId: string,
): ManagerSection[] => {
  const pehlione = templateId.startsWith("pehlione_");
  const zones = managerZones(templateId);
  const identity = ["heading", "personalData", "photo", "closing"].map(
    (id) => ({
      id,
      title: {
        heading: "Lebenslauf-Kopf",
        personalData: "Persönliche Daten",
        photo: "Bewerbungsfoto",
        closing: "Ort, Datum und Unterschrift",
      }[id]!,
      visible: getResumeSemanticSection(
        profile.resumeSemanticSections,
        managerSemanticTypes[id],
      ).visible,
      zone: "main" as const,
      fixed: true,
    }),
  );
  const legacy = getProfileResumeSectionLayout(profile, templateId)
    .filter(({ type }) => type in legacyKeys)
    .map(({ type, zone }) => ({
      id: type,
      title:
        pehlione && type === "strengths"
          ? "Kernkompetenzen"
          : pehlione && type === "knowledge"
            ? "Technische Schwerpunkte"
            : getResumeSectionTitle(profile, type),
      visible: isResumeSectionVisible(profile, type),
      zone: (zones.length > 1 &&
      (zone === "sidebar" ||
        (templateId === "stilvoll" &&
          ["summary", "strengths", "knowledge"].includes(type)) ||
        (nativeSingleTemplates.has(templateId) && defaultSidebarSections.has(type)))
        ? "sidebar"
        : "main") as ManagerZone,
    }));
  if (pehlione) legacy.find((item) => item.id === "summary")!.zone = "main";
  const entries: ManagerSection[] = [...legacy];
  for (const group of resolveKnowledgeGroups(
    templateId,
    profile.resumeKnowledgeGroups,
  )) {
    const base = baseGroupType(group.semanticType);
    const existing = entries.find((entry) => entry.id === base);
    if (existing) {
      existing.groupId = group.id;
      if (group.items.length) {
        existing.title = group.title;
        existing.visible = group.visible;
      }
    } else {
      entries.push({
        id: `group:${group.id}`,
        groupId: group.id,
        title: group.title,
        visible: group.visible,
        zone: zones.includes(group.slot as ManagerZone)
          ? (group.slot as ManagerZone)
          : "main",
      });
    }
  }
  if (pehlione)
    entries.push({
      id: "projects",
      title: "Projekt-Highlight",
      visible: true,
      zone: "main",
    });
  for (const section of profile.specialSections)
    entries.push({
      id: `special:${section.id}`,
      title: section.title,
      visible: section.isVisible,
      zone: "main",
    });
  const saved = profile.resumeManagerLayouts?.[templateId] ?? [];
  const ordered: ManagerSection[] = [];
  for (const position of saved) {
    const entry = entries.find((item) => item.id === position.id);
    if (entry && !ordered.some((item) => item.id === entry.id))
      ordered.push({
        ...entry,
        zone: zones.includes(position.zone) ? position.zone : "main",
      });
  }
  return [
    ...identity,
    ...ordered,
    ...entries.filter((entry) => !ordered.some((item) => item.id === entry.id)),
  ].map((entry) => ({
    ...entry,
    ...profile.resumeManagerOverrides?.[entry.id],
  }));
};

export const updateManagerSection = (
  profile: ApplicantProfile,
  templateId: string,
  id: string,
  change: { title?: string; visible?: boolean },
): ApplicantProfile => {
  let next = {
    ...profile,
    resumeManagerOverrides: {
      ...profile.resumeManagerOverrides,
      [id]: { ...profile.resumeManagerOverrides?.[id], ...change },
    },
  };
  const semantic = managerSemanticTypes[id];
  if (semantic)
    next.resumeSemanticSections = resolveResumeSectionInstances(
      profile.resumeSemanticSections,
    ).map((item) =>
      item.semanticType === semantic
        ? {
            ...item,
            ...(change.title !== undefined
              ? { customTitle: change.title }
              : {}),
            ...(change.visible !== undefined
              ? { visible: change.visible, enabled: change.visible }
              : {}),
          }
        : item,
    );
  if (id === "knowledge")
    next.resumeSemanticSections = resolveResumeSectionInstances(
      next.resumeSemanticSections,
    ).map((item) =>
      item.semanticType === "knowledge"
        ? { ...item, visible: true, enabled: true }
        : item,
    );
  const key = legacyKeys[id];
  if (key && change.visible !== undefined)
    next.resumeSections = { ...profile.resumeSections, [key]: change.visible };
  if (change.title !== undefined) {
    if (id === "knowledge")
      next.knowledgeSection = {
        ...profile.knowledgeSection,
        title: change.title,
      };
    else if (id in profile.resumeSectionTitles)
      next.resumeSectionTitles = {
        ...profile.resumeSectionTitles,
        [id]: change.title,
      };
  }
  const entry = getManagerSections(profile, templateId).find(
    (item) => item.id === id,
  );
  if (entry?.groupId)
    next.resumeKnowledgeGroups = resolveKnowledgeGroups(
      templateId,
      profile.resumeKnowledgeGroups,
    ).map((group) =>
      group.id === entry.groupId ? { ...group, ...change } : group,
    );
  if (id.startsWith("special:"))
    next.specialSections = profile.specialSections.map((item) =>
      item.id === id.slice(8)
        ? {
            ...item,
            ...(change.title !== undefined ? { title: change.title } : {}),
            ...(change.visible !== undefined
              ? { isVisible: change.visible }
              : {}),
          }
        : item,
    );
  return next;
};

export const moveManagerSection = (
  profile: ApplicantProfile,
  templateId: string,
  id: string,
  zone: ManagerZone,
  index: number,
) => {
  if (!managerAllowedZones(templateId, id).includes(zone)) return profile;
  const entries = getManagerSections(profile, templateId).filter(
    (item) => !item.fixed,
  );
  const moved = entries.find((item) => item.id === id);
  if (!moved) return profile;
  const rest = entries.filter((item) => item.id !== id);
  const destination = rest.filter((item) => item.zone === zone);
  const before = destination[Math.max(0, index)];
  rest.splice(before ? rest.indexOf(before) : rest.length, 0, {
    ...moved,
    zone,
  });
  return {
    ...profile,
    resumeManagerLayouts: {
      ...profile.resumeManagerLayouts,
      [templateId]: rest.map(({ id, zone }) => ({ id, zone })),
    },
  };
};
