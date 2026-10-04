import { profileSchema, type ApplicantProfile } from "./schema";

/**
 * A Lebenslauf like the reported Zweispaltig one: three stations (7 / 5 / 6 bullets by default), three education entries
 * with a grade and long descriptions, Kurzprofil / Stärken / Sprachen. Made up: no real person's data. The text of
 * every bullet and sentence is unique, so a test can count how often it is printed.
 */
const uid = (n: number) => `9f000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const educationSentence = (entry: number, index: number) =>
  `Ausbildung ${entry}.${index}: Erfolgreich bestandene Abschlussprüfung mit Schwerpunkt auf der praktischen Umsetzung technischer Anforderungen und der strukturierten Bearbeitung von Aufgabenstellungen im Team.`;
export const bulletText = (station: string, index: number) =>
  `Bullet ${station}${index + 1}: Entwicklung und Implementierung eines Datasource-Plugins für Monitoring-Daten und Anbindung einer Programmierschnittstelle.`;

export type EducationFlowOptions = {
  /** Bullets of the three stations. */
  bullets?: [number, number, number];
  /** Sentences of the description of every education entry (the entries get one more per position). */
  sentences?: number;
  educationCount?: number;
  /** Entries without grade and description. */
  bare?: boolean;
};

export const makeEducationFlowProfile = ({ bullets = [7, 5, 6], sentences = 2, educationCount = 3, bare = false }: EducationFlowOptions = {}): ApplicantProfile =>
  profileSchema.parse({
    id: uid(1), isDefault: true, updatedAt: "2026-10-03T10:00:00.000Z", firstName: "Mina", lastName: "Kaya",
    title: "Industrieingenieurin | Prozessplanung & Produktionskoordination",
    phone: "+49 170 12345678", email: "mina.kaya@example.com", linkedin: "https://www.linkedin.com/in/mina-kaya/", github: "https://github.com/mina-kaya",
    street: "Musterstraße 12", postalCode: "12345", city: "Musterstadt", country: "Germany",
    summary: "Industrieingenieurin mit Erfahrung in Prozessanalyse, Produktionssteuerung und der strukturierten Bearbeitung technischer Aufgabenstellungen.",
    strengths: ["Analytisches Denken", "Strukturierte Problemlösungsfähigkeit", "Schnelle Auffassungsgabe"].map((title, index) => ({ id: uid(2 + index), title, description: "" })),
    experiences: [
      { id: uid(10), from: "01/2015", to: "02/2017", role: "Praktikum im Bereich Softwareentwicklung", company: "Universitätsstadt Muster", city: "Musterstadt", tasks: [], achievements: Array.from({ length: bullets[0] }, (_, index) => bulletText("A", index)) },
      { id: uid(11), from: "02/2017", to: "03/2019", role: "Prozessplaner", company: "Beispiel Textil AG", city: "Musterstadt", tasks: [], achievements: Array.from({ length: bullets[1] }, (_, index) => bulletText("B", index)) },
      { id: uid(12), from: "03/2019", to: "04/2021", role: "Transportpilot", company: "Muster Luftfahrtbereich", city: "Musterstadt", tasks: [], achievements: Array.from({ length: bullets[2] }, (_, index) => bulletText("C", index)) },
    ],
    education: Array.from({ length: educationCount }, (_, index) => ({
      id: uid(20 + index), from: `${2000 + index}`, to: `${2003 + index}`, degree: `Abschluss Nummer ${index + 1} im Bereich Technik`, institution: `Beispiel Institut ${index + 1}`,
      city: "Musterstadt", country: "Deutschland", fieldOfStudy: bare ? "" : "Anwendungsentwicklung", grade: bare ? "" : "2,3",
      description: bare ? "" : Array.from({ length: sentences + index }, (_, sentence) => educationSentence(index + 1, sentence + 1)).join(" "),
    })),
    languages: ["Deutsch – C1", "Englisch – B2"],
    resumePersonalFieldVisibility: { address: true, phone: true, email: true, linkedin: true, github: true, website: true, onlineProfiles: true, birthDate: false, birthPlace: false, nationality: false, familyStatus: false, children: false, drivingLicense: false, xing: false },
  });
