import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { profileSchema, resumeSpecialSectionKinds } from "./schema";
import {
  canAddResumeSpecialSection,
  createResumeSpecialSection,
  resumeSpecialSectionCatalog,
  resumeSpecialSectionLabel,
} from "./resumeSpecialSectionCatalog";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("resumeSpecialSectionCatalog", () => {
  it("lists every schema kind once, in the fixed order, with its German name", () => {
    expect(resumeSpecialSectionCatalog.map((entry) => entry.kind)).toEqual([...resumeSpecialSectionKinds]);
    expect(resumeSpecialSectionCatalog.map((entry) => entry.label)).toEqual([
      "Projekte", "Praktika", "Weiterbildungen", "Auslandserfahrung", "Stipendien", "Auszeichnungen", "Veröffentlichungen",
      "Ehrenamt", "Interessen und Hobbys", "Führerschein", "Zusatzangaben", "Referenzen", "Eigener Abschnitt",
    ]);
    expect(resumeSpecialSectionCatalog.every((entry) => entry.description.trim())).toBe(true);
    expect(resumeSpecialSectionLabel("references")).toBe("Referenzen");
  });

  it("creates a visible, empty section with the catalogue title that the profile schema accepts", () => {
    const section = createResumeSpecialSection("internships");
    expect(section).toEqual({ id: expect.any(String), kind: "internships", title: "Praktika", isVisible: true, entries: [] });
    expect(createResumeSpecialSection("internships").id).not.toBe(section.id);
    const profile = profileSchema.parse({
      id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(),
      specialSections: [section],
    });
    expect(profile.specialSections).toEqual([section]);
  });

  it("allows Projekte once and every other kind again", () => {
    expect(canAddResumeSpecialSection("projects", [])).toBe(true);
    expect(canAddResumeSpecialSection("projects", [{ kind: "projects" }])).toBe(false);
    expect(canAddResumeSpecialSection("custom", [{ kind: "custom" }, { kind: "projects" }])).toBe(true);
    for (const kind of resumeSpecialSectionKinds.filter((item) => item !== "projects"))
      expect(canAddResumeSpecialSection(kind, resumeSpecialSectionKinds.map((item) => ({ kind: item })))).toBe(true);
  });

  it("is the only list of names in Profil and Lebenslauf", () => {
    for (const path of ["src/views/ProfileView.tsx", "src/components/resume/ResumeDataEditor.tsx", "src/components/resume/ResumeSectionsPanel.tsx"]) {
      const text = source(path);
      expect(text).not.toContain("Auslandserfahrung");
      expect(text).not.toContain('"Praktika"');
      expect(text).not.toMatch(/specialSectionOptions|specialSectionLabels/);
    }
    expect(source("src/views/ProfileView.tsx")).toContain("<ResumeSpecialSectionPicker");
    expect(source("src/components/resume/ResumeSectionsPanel.tsx")).toContain("<ResumeSpecialSectionPicker");
  });
});
