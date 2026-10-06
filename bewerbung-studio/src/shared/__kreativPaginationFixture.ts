import { profileSchema } from "./schema";

/** Fictional data for bullet continuation and section-placement regressions. */
export const kreativPaginationProfile = () => profileSchema.parse({
  id: "9d000000-0000-4000-8000-000000000001", isDefault: true,
  firstName: "Lina", lastName: "Beispiel", title: "Prozessplanung",
  updatedAt: "2026-10-05T10:00:00.000Z",
  experiences: ["Prozessplaner", "Transportpilot"].map((role, index) => ({
    id: `9d000000-0000-4000-8000-00000000001${index}`, role,
    company: "Beispiel GmbH", from: "2020", to: "2021",
    achievements: Array.from({ length: 5 }, (_, bullet) =>
      `Aufgabe ${index + 1}.${bullet + 1}: ${"Ablaufplanung ".repeat(32).trim()}`),
  })),
  education: [{ id: "9d000000-0000-4000-8000-000000000020", degree: "Ausbildung",
    institution: "Beispielschule", from: "2017", to: "2020" }],
  strengths: [{ id: "9d000000-0000-4000-8000-000000000030", title: "Planung", description: "Klare Abläufe" }],
  languages: ["Deutsch – C1", "Englisch – B2"],
  certifications: ["Fiktive Weiterbildung"],
});
