import { describe, expect, it } from "vitest";
import { applicationSchema, profileSchema } from "../shared/schema";
import { matchProjects } from "./projectMatch";

const now = "2026-10-02T00:00:00.000Z";
const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
  specialSections: [{ id: crypto.randomUUID(), kind: "projects", title: "Projekte", entries: [
    { id: crypto.randomUUID(), title: "Spring Service", technologies: ["Spring Boot", "Kafka"], description: "Eventbasierter Service" },
    { id: crypto.randomUUID(), title: "ASP.NET Shop", technologies: ["ASP.NET Core MVC", "MySQL"], description: "Katalog" },
    { id: crypto.randomUUID(), title: "Go Banking", technologies: ["Go", "PostgreSQL", "Next.js"], description: "Ledger" },
    { id: crypto.randomUUID(), title: "Laravel Shop", technologies: ["Laravel 12", "Inertia React", "TypeScript"] },
    { id: crypto.randomUUID(), title: "Symfony Website", technologies: ["Symfony 7.4", "Twig"] },
  ] }] });
const application = (text: string) => applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Beispiel",
  company: { name: "Beispiel GmbH", city: "Berlin" }, contact: {}, job: { title: text }, status: "Entwurf", templateId: "modern",
  accentColor: "#123456", documents: {}, statusHistory: [], createdAt: now, updatedAt: now });

describe("local project matching", () => {
  it.each([
    ["Java Kafka", "Spring Service"], ["C# .NET", "ASP.NET Shop"], ["Go PostgreSQL Backend", "Go Banking"],
    ["PHP Laravel", "Laravel Shop"], ["PHP Symfony", "Symfony Website"], ["React TypeScript", "Laravel Shop"],
  ])("ranks technology evidence for %s", (job, expected) => {
    expect(matchProjects(application(job), profile)[0].project.title).toBe(expected);
  });
  it("reports matched technologies without changing any manual selection or the profile", () => {
    const before = JSON.stringify(profile);
    const app = application("Go PostgreSQL");
    app.designSettings.resumePresentation = { selectedProjectEntryIds: [profile.specialSections[0].entries[1].id] };
    const recommended = matchProjects(app, profile);
    expect(recommended[0].matchedTechnologies).toEqual(["Go", "PostgreSQL"]);
    expect(app.designSettings.resumePresentation.selectedProjectEntryIds).toEqual([profile.specialSections[0].entries[1].id]);
    expect(JSON.stringify(profile)).toBe(before);
  });
});
