import { profileSchema, type ApplicantProfile } from "./schema";
import { setResumePhotoVisible } from "./resumePhoto";

/**
 * The profile of the Tabellarisch header tests: the contacts of a typical Lebenslauf (phone, e-mail, LinkedIn, address,
 * GitHub, Website) plus the voluntary details, three stations (the last one a "Transportpilot" with four long bullets)
 * and one education. The contact values are the ones of `scripts/tabellarisch-header-calibration.mjs`, whose real
 * Chromium measurements the geometry tests rely on. Made up: no real person's data.
 */
export const calibrationCheckboxes = [
  "address", "phone", "email", "linkedin", "github", "website", "onlineProfiles", "birthDate", "birthPlace",
  "nationality", "familyStatus", "children", "xing",
] as const;
export type CalibrationCheckbox = (typeof calibrationCheckboxes)[number];

const allOn = Object.fromEntries([...calibrationCheckboxes, "country", "drivingLicense"].map((key) => [key, true])) as Record<string, boolean>;
/** Only what the reported Lebenslauf shows: phone, e-mail, LinkedIn, address, GitHub and the Website. */
export const reportedHeader: Partial<Record<CalibrationCheckbox, boolean>> = {
  birthDate: false, birthPlace: false, nationality: false, familyStatus: false, children: false, onlineProfiles: false, xing: false,
};

const uid = (n: number) => `9e000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const calibrationFields = {
  firstName: "Mina", lastName: "Beispiel",
  title: "Technisch und prozessorientierter Quereinsteiger mit Erfahrung im Produktionsumfeld",
  phone: "+49 176 12345678", email: "mina.beispiel1408@example.com", linkedin: "https://www.linkedin.com/in/mina-beispiel-k/",
  github: "https://github.com/mina-beispiel-gh", portfolio: "https://pehlione.com/",
  street: "Beispielallee 20", postalCode: "35039", city: "Marburg", country: "Deutschland",
  birthDate: "1990-11-25", birthPlace: "Gerze", nationality: "deutsch", familyStatus: "verheiratet", children: "2 Kinder",
  onlineProfiles: [
    { id: uid(2), label: "Xing", url: "https://www.xing.com/profile/Mina_Beispiel" },
    { id: uid(3), label: "GitLab", url: "https://gitlab.com/mina-beispiel" },
  ],
};

export const transportpilotBullets = [
  "Planung und Koordination operativer Einsätze in einem sicherheitskritischen Umfeld unter Einhaltung standardisierter Abläufe",
  "Vorbereitung von Einsatzbriefings sowie Koordination der Zusammenarbeit beteiligter Personen",
  "Priorisierung operativer Aufgaben und präzise, sicherheitsorientierte Entscheidungsfindung unter Zeitdruck",
  "Übernahme von Teamverantwortung sowie Sicherstellung der zuverlässigen Durchführung operativer Prozesse",
];

export type TabellarischFixtureOptions = {
  fields?: Record<string, unknown>;
  visibility?: Partial<Record<CalibrationCheckbox, boolean>>;
  photo?: boolean;
  /** Bullets of the two stations before the Transportpilot. */
  bullets?: [number, number];
  career?: boolean;
};

export const makeTabellarischProfile = ({ fields = {}, visibility = {}, photo = true, bullets = [4, 8], career = true }: TabellarischFixtureOptions = {}): ApplicantProfile => {
  const filler = (station: number, count: number) =>
    Array.from({ length: count }, (_, index) => `Station ${station}: Aufgabe ${index + 1} mit nachvollziehbarem Ergebnis in der Zusammenarbeit der Fachbereiche und der beteiligten Teams`);
  const parsed = profileSchema.parse({
    id: uid(1), isDefault: true, updatedAt: "2026-10-03T10:00:00.000Z", ...calibrationFields, ...fields,
    photoPath: photo ? "data:image/png;base64,AA==" : "",
    summary: "Technisch versierter Quereinsteiger mit Erfahrung in Produktion und Prozessplanung.",
    strengths: [{ id: uid(4), title: "Analytisches Denken", description: "" }],
    experiences: career ? [
      { id: uid(10), from: "01/2015", to: "02/2017", role: "Praktikum als Softwareentwickler", company: "Beispiel Software GmbH", city: "Marburg", tasks: [], achievements: filler(1, bullets[0]) },
      { id: uid(11), from: "02/2017", to: "03/2019", role: "Prozessplaner", company: "Beispiel Textil AG", city: "Marburg", tasks: [], achievements: filler(2, bullets[1]) },
      { id: uid(12), from: "03/2019", to: "04/2021", role: "Transportpilot", company: "Luftfahrtbereich", city: "Marburg", tasks: [], achievements: transportpilotBullets },
    ] : [{ id: uid(10), from: "2020", to: "2022", role: "Assistentin", company: "Beispiel AG", achievements: ["Ein Erfolg"] }],
    education: [{ id: uid(20), from: "2008", to: "2011", degree: "Ausbildung", institution: "Beispielschule", description: "" }],
    languages: ["Deutsch – C2", "Englisch – B2"],
    resumePersonalFieldVisibility: { ...allOn, ...reportedHeader, ...visibility },
  });
  return photo ? setResumePhotoVisible(parsed, true) : parsed;
};
