import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import {
  getPehlioneCoreCompetencies,
  getPehlioneProjectHighlight,
  getPehlioneTechnicalFocus,
} from "./pehlioneContent";

const profile = profileSchema.parse({
  id: "10000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  summary: "Strukturiert, lösungsorientiert und qualitätsbewusst.",
  experiences: [{
    id: "10000000-0000-4000-8000-000000000002",
    from: "2024",
    to: "2025",
    role: "Praktikum Anwendungsentwicklung",
    company: "Beispiel GmbH",
    technologies: ["Grafana", "PRTG"],
    achievements: [
      "Entwicklung eines Grafana-Datasource-Plugins für PRTG und API-Integration.",
      "Technische Dokumentation der Monitoring-Prozesse.",
    ],
  }],
  education: [],
  updatedAt: "2026-09-21T12:00:00.000Z",
});

describe("Pehlione content projection", () => {
  it("derives only evidence-backed sidebar labels", () => {
    expect(getPehlioneCoreCompetencies(profile)).toContain("Grafana / PRTG");
    expect(getPehlioneTechnicalFocus(profile)).toContain(
      "Monitoring & Visualisierung (Grafana, PRTG)",
    );
  });

  it("uses the documented Grafana work as project highlight", () => {
    expect(getPehlioneProjectHighlight(profile)?.title).toBe(
      "Grafana Datasource Plugin für PRTG",
    );
  });
});
