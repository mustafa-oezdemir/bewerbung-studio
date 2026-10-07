import type { ApplicantProfile } from "../../shared/schema";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  isResumeSectionVisible,
} from "./resume-sections";
import {
  getResumeSemanticSection,
  getResumeSemanticTitle,
  resolveKnowledgeGroups,
  resolveResumeSectionInstances,
  resumeSectionDefinitions,
  type ResumeSemanticType,
} from "./resume-section-system";

export type ManagerZone = "main" | "sidebar";
export type ManagerSection = {
  id: string;
  title: string;
  visible: boolean;
  zone: ManagerZone;
  fixed?: boolean;
  /** Pflicht: the entry cannot be hidden or removed. */
  required?: boolean;
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
/** The effective layout of the Lebenslauf (`resolveResumeLayout(...).mode`). */
export type ManagerLayoutMode = "single" | "two-column";
// The saved zone of a section is independent of the selected layout: a one-column layout draws every section in
// its one content flow ("main") in the order of the whole list, and keeps the zone for a later two-column layout.
export const effectiveManagerZone = (zone: ManagerZone, layoutMode?: ManagerLayoutMode): ManagerZone =>
  layoutMode === "single" ? "main" : zone;
export const managerZones = (_templateId: string, layoutMode: ManagerLayoutMode = "two-column"): ManagerZone[] =>
  layoutMode === "single" ? ["main"] : ["main", "sidebar"];
export const managerAllowedZones = (
  templateId: string,
  _id: string,
  layoutMode: ManagerLayoutMode = "two-column",
): ManagerZone[] =>
  managerZones(templateId, layoutMode);
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
        heading: "Überschrift",
        personalData: getResumeSemanticTitle(
          profile.resumeSemanticSections,
          "personalData",
        ),
        photo: "Bewerbungsfoto",
        closing: "Ort, Datum und Unterschrift",
      }[id]!,
      visible: getResumeSemanticSection(
        profile.resumeSemanticSections,
        managerSemanticTypes[id],
      ).visible,
      zone: "main" as const,
      fixed: true,
      ...(id === "heading" ? { required: true } : {}),
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
  ].map((entry) =>
    // The Überschrift is edited in the profile, never renamed or hidden here (also not by an older override).
    entry.id === "heading"
      ? entry
      : entry.id === "personalData"
        ? // The title comes from the semantic section (see setPersonalDataTitle); only visibility may be overridden.
          { ...entry, ...profile.resumeManagerOverrides?.[entry.id], title: entry.title }
        : { ...entry, ...profile.resumeManagerOverrides?.[entry.id] },
  );
};

/** The default title is stored as "no custom title", so a later change of the default still applies. */
export const setPersonalDataTitle = (
  profile: ApplicantProfile,
  title: string,
): ApplicantProfile => {
  const fallback = resumeSectionDefinitions.find(
    (definition) => definition.semanticType === "personalData",
  )!.defaultTitle;
  return {
    ...profile,
    resumeSemanticSections: resolveResumeSectionInstances(
      profile.resumeSemanticSections,
    ).map((section) =>
      section.semanticType === "personalData"
        ? { ...section, customTitle: title.trim() === fallback ? "" : title.trim() }
        : section,
    ),
  };
};

export const updateManagerSection = (
  profile: ApplicantProfile,
  templateId: string,
  id: string,
  change: { title?: string; visible?: boolean },
): ApplicantProfile => {
  // The Überschrift is Pflicht and edited through `setResumeHeading`; title and visibility are not managed here.
  if (id === "heading") return profile;
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

const saveManagerLayout = (
  profile: ApplicantProfile,
  templateId: string,
  entries: readonly ManagerSection[],
): ApplicantProfile => ({
  ...profile,
  resumeManagerLayouts: {
    ...profile.resumeManagerLayouts,
    [templateId]: entries.map(({ id, zone }) => ({ id, zone })),
  },
});

/** Two-column layout: moves a section to position `index` of the column `zone` (and into that column). */
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
  return saveManagerLayout(profile, templateId, rest);
};

/**
 * One-column layout: the movable sections form one list, the order of the Lebenslauf. Moves a section to position
 * `index` of that whole list; every saved zone stays as it is, so a later two-column layout finds its columns again.
 * Only this template's saved order changes.
 */
export const reorderManagerSection = (
  profile: ApplicantProfile,
  templateId: string,
  id: string,
  index: number,
) => {
  const entries = getManagerSections(profile, templateId).filter(
    (item) => !item.fixed,
  );
  const from = entries.findIndex((item) => item.id === id);
  if (from < 0) return profile;
  const to = Math.max(0, Math.min(Math.trunc(index), entries.length - 1));
  if (to === from) return profile;
  const [moved] = entries.splice(from, 1);
  entries.splice(to, 0, moved!);
  return saveManagerLayout(profile, templateId, entries);
};
