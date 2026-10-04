import { profileSchema } from "./schema";
import { getManagerSections } from "../features/resume-sections/resume-manager";

/**
 * A résumé whose Seitenspalte is long, for the tests of the sidebar lane: the knowledge section and the special
 * sections stand in the zone the user chose (a hand-arranged layout), the rest in their native zone.
 */
const now = "2026-10-02T10:00:00.000Z";
const uid = (n: number) => `9d000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export type SidebarLaneOptions = {
  knowledge?: number;
  strengths?: number;
  stations?: number;
  bullets?: number;
  education?: number;
  certifications?: number;
  specials?: number;
  specialEntries?: number;
  zone?: "sidebar" | "main";
  /** The zone of the special sections when it differs from `zone` (knowledge in the main column, specials in the sidebar). */
  specialsZone?: "sidebar" | "main";
};

export const makeSidebarLaneInput = (templateId: string, options: SidebarLaneOptions = {}) => {
  const { knowledge = 0, strengths = 3, stations = 3, bullets = 5, education = 4, certifications = 0, specials = 0, specialEntries = 4 } = options;
  const items = Array.from({ length: knowledge }, (_, index) => ({
    id: uid(100 + index), name: `Kenntnis ${String(index + 1).padStart(2, "0")} mit Fachbegriff`, level: "good", yearsOfExperience: 2,
    lastUsedYear: 2025, description: "", isVisible: true, sortOrder: index,
  }));
  const base = {
    id: uid(1), isDefault: true, updatedAt: now, firstName: "Mina", lastName: "Kaya", title: "Ingenieurin", city: "Musterstadt",
    email: "mina.kaya@example.com", phone: "+49 170 12345678",
    summary: "Ingenieurin mit Erfahrung in Prozessanalyse und Produktionssteuerung.",
    strengths: Array.from({ length: strengths }, (_, index) => ({ id: uid(10 + index), title: `Stärke ${index + 1}`, description: "" })),
    languages: ["Deutsch – C1", "Englisch – B2", "Türkisch – C2"],
    certifications: Array.from({ length: certifications }, (_, index) => `Zertifikat ${index + 1} der Fachstelle für Qualität`),
    specialSections: Array.from({ length: specials }, (_, index) => ({
      id: uid(400 + index), kind: "custom", title: `Besonderes ${index + 1}`, isVisible: true, contentType: "list",
      entries: Array.from({ length: specialEntries }, (_, entry) => ({ id: uid(420 + index * 20 + entry), title: `Eintrag ${index + 1}.${entry + 1} ohne weitere Angaben`, description: "", bullets: [] })),
    })),
    experiences: Array.from({ length: stations }, (_, index) => ({
      id: uid(200 + index), from: "01/2015", to: "01/2018", role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`, city: "Musterstadt",
      tasks: Array.from({ length: bullets }, (_, bullet) => `Messbares Ergebnis ${bullet + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`),
      achievements: [],
    })),
    education: Array.from({ length: education }, (_, index) => ({
      id: uid(300 + index), from: "2008", to: "2012", degree: `Abschluss ${index + 1}`, institution: `Hochschule ${index + 1}`,
      description: "Schwerpunkt auf Prozessen und Planung.",
    })),
    knowledgeSection: {
      title: "Besondere Kenntnisse", isVisible: true,
      categories: knowledge ? [{ id: uid(50), title: "IT-Kenntnisse", type: "it", displayMode: "comma-separated", showLevels: false, showYearsOfExperience: false, isVisible: true, sortOrder: 0, subcategories: [], items }] : [],
    },
  };
  // The user's own layout: the knowledge section (and what else is named) in the Seitenspalte.
  const sections = getManagerSections(profileSchema.parse(base), templateId).filter((entry) => !entry.fixed);
  const zone = options.zone ?? "sidebar";
  return {
    ...base,
    resumeManagerLayouts: {
      [templateId]: sections.map((entry) => ({ id: entry.id, zone: entry.id === "knowledge" ? zone : entry.id.startsWith("special:") ? (options.specialsZone ?? zone) : entry.zone })),
    },
  };
};

