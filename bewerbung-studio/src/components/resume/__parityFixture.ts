import { resumePersonalFieldKeys } from "../../features/resume-sections/resume-section-system";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";

const uid = (index: number) => `9a000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

/** Every CV-relevant field of the profile, filled with a token that can be found in the output. */
export const maximalProfileInput = (extra: Record<string, unknown> = {}) => ({
  id: uid(1), isDefault: true, updatedAt: "2026-10-02T10:00:00.000Z",
  firstName: "Mustafa", lastName: "Özdemir", title: "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung",
  street: "Musterstraße 12", postalCode: "35037", city: "Marburg", country: "Deutschland",
  phone: "+49 170 1234567", email: "mustafa@example.com",
  linkedin: "https://www.linkedin.com/in/mustafa-oezdemir", github: "https://github.com/mustafa-oezdemir", portfolio: "https://mustafa-oezdemir.de",
  onlineProfiles: [
    { id: uid(2), label: "Xing", url: "https://www.xing.com/profile/Mustafa_Oezdemir" },
    { id: uid(3), label: "GitLab", url: "https://gitlab.com/mustafa-oezdemir" },
  ],
  birthDate: "1990-05-17", birthPlace: "Ankara", nationality: "deutsch", familyStatus: "verheiratet", children: "2 Kinder",
  summary: "Softwareentwickler mit Schwerpunkt auf Plattformen und verlässlicher Zusammenarbeit.",
  strengths: [{ id: uid(4), title: "Analytisches Denken", description: "Komplexe Probleme strukturiert lösen" }],
  experiences: [
    {
      id: uid(10), from: "11/2024", to: "", isCurrent: true, role: "Softwareentwickler", company: "Muster", legalForm: "GmbH", city: "Marburg",
      employmentType: "Vollzeit", description: "Entwicklung interner Plattformen", teamSize: "Team mit 5 Personen",
      tasks: ["Konzeption zentraler Funktionen"], projects: ["Grafana-Datasource-Plugin"], technologies: ["TypeScript", "React", "Grafana"],
      achievements: ["Open-Source-Veröffentlichung des Plugins"],
    },
    {
      id: uid(11), from: "07/2023", to: "10/2024", role: "Fachinformatiker Anwendungsentwicklung", company: "IAD GmbH", city: "Marburg",
      tasks: ["Webanwendungen umgesetzt"], achievements: ["Ladezeit halbiert"],
    },
  ],
  education: [
    {
      id: uid(20), from: "07/2023", to: "11/2025", degree: "Fachinformatiker für Anwendungsentwicklung", institution: "IAD GmbH", city: "Marburg",
      country: "Deutschland", type: "Berufsausbildung", fieldOfStudy: "Anwendungsentwicklung", grade: "1,8", status: "Abgeschlossen",
      description: "Abschlussprojekt: Monitoring-Plattform",
    },
  ],
  knowledgeSection: {
    title: "Besondere Kenntnisse", isVisible: true,
    categories: [{
      id: uid(30), title: "IT-Kenntnisse", type: "it", displayMode: "comma-separated", showLevels: true, showYearsOfExperience: true,
      isVisible: true, sortOrder: 0, subcategories: [],
      items: [{ id: uid(31), name: "Java", level: "advanced", yearsOfExperience: 4, lastUsedYear: 2025, description: "Spring Boot und REST APIs", isVisible: true, sortOrder: 0 }],
    }],
  },
  languages: ["Englisch – C1", "Deutsch – Muttersprache"],
  certifications: ["03/2026 · Professional Scrum Master I · Scrum.org"],
  specialSections: [
    {
      id: uid(40), kind: "interests", title: "Interessen und Hobbys", isVisible: true, contentType: "list",
      entries: [{ id: uid(41), title: "Fotografie", description: "Architektur- und Landschaftsfotografie", bullets: [] }],
    },
    {
      id: uid(42), kind: "custom", title: "Eigene Projekte", isVisible: true, contentType: "entries",
      entries: [{
        id: uid(43), title: "Open-Source-Plugin", subtitle: "Grafana Community", location: "Remote", date: "2025", url: "https://example.org/plugin",
        description: "Datasource für Monitoring-Daten", bullets: ["Dokumentation veröffentlicht"],
      }],
    },
  ],
  resumePersonalFieldVisibility: Object.fromEntries(resumePersonalFieldKeys.map((key) => [key, true])),
  resumeCareerFieldVisibility: { employmentType: true, description: true, teamSize: true, tasks: true, projects: true, technologies: true, achievements: true },
  applicationPlace: "Marburg", applicationDate: "2026-10-02",
  resumeClosing: { showPlace: true, showDate: true, showSignature: false, dateMode: "application" },
  ...extra,
});

export const maximalProfile = (extra: Record<string, unknown> = {}): ApplicantProfile => profileSchema.parse(maximalProfileInput(extra));

/** As little as a Lebenslauf can have: a name and one station. */
export const minimalProfile = (): ApplicantProfile =>
  profileSchema.parse({
    id: uid(1), isDefault: true, updatedAt: "2026-10-02T10:00:00.000Z", firstName: "Mina", lastName: "Kaya",
    experiences: [{ id: uid(10), from: "2020", to: "2022", role: "Assistentin", company: "Beispiel AG", achievements: [] }],
  });
