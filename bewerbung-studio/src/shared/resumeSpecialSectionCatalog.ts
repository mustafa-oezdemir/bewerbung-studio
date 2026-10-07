import {
  resumeSpecialSectionKinds,
  type ApplicantProfile,
  type ResumeSpecialSectionKind,
} from "./schema";

export type ResumeSpecialSection = ApplicantProfile["specialSections"][number];

export type ResumeSpecialSectionCatalogEntry = {
  kind: ResumeSpecialSectionKind;
  /** The German name in both pickers and the default Überschrift of a new section. */
  label: string;
  /** One short German line that tells similar kinds apart. */
  description: string;
};

const details: Record<ResumeSpecialSectionKind, Omit<ResumeSpecialSectionCatalogEntry, "kind">> = {
  projects: { label: "Projekte", description: "Ausgewählte Projekte mit Rolle und Technologien." },
  internships: { label: "Praktika", description: "Praktische Einsätze in Studium oder Ausbildung." },
  trainings: { label: "Weiterbildungen", description: "Kurse, Schulungen und Lehrgänge." },
  internationalExperience: { label: "Auslandserfahrung", description: "Studium, Arbeit oder Aufenthalte im Ausland." },
  scholarships: { label: "Stipendien", description: "Förderungen und Stipendienprogramme." },
  awards: { label: "Auszeichnungen", description: "Preise, Ehrungen und Wettbewerbe." },
  publications: { label: "Veröffentlichungen", description: "Artikel, Vorträge und Fachbeiträge." },
  volunteer: { label: "Ehrenamt", description: "Freiwilliges und soziales Engagement." },
  interests: { label: "Interessen und Hobbys", description: "Persönliche Interessen und Freizeit." },
  drivingLicenses: { label: "Führerschein", description: "Führerscheinklassen und Fahrerlaubnis." },
  additional: { label: "Zusatzangaben", description: "Weitere relevante Angaben." },
  references: { label: "Referenzen", description: "Ansprechpartner für Empfehlungen." },
  custom: { label: "Eigener Abschnitt", description: "Freier Bereich mit eigener Überschrift." },
};

/** The Lebenslauf-Bereiche of Profil and Lebenslauf, in the order of `resumeSpecialSectionKinds`. */
export const resumeSpecialSectionCatalog: readonly ResumeSpecialSectionCatalogEntry[] =
  resumeSpecialSectionKinds.map((kind) => ({ kind, ...details[kind] }));

export const resumeSpecialSectionLabel = (kind: ResumeSpecialSectionKind) => details[kind].label;

/** Projekte exists once (the project catalogue of the Bewerbungen); every other kind may be added again. */
export const canAddResumeSpecialSection = (
  kind: ResumeSpecialSectionKind,
  sections: readonly Pick<ResumeSpecialSection, "kind">[],
) => kind !== "projects" || !sections.some((section) => section.kind === "projects");

export const createResumeSpecialSection = (kind: ResumeSpecialSectionKind): ResumeSpecialSection => ({
  id: crypto.randomUUID(),
  kind,
  title: details[kind].label,
  isVisible: true,
  entries: [],
});
