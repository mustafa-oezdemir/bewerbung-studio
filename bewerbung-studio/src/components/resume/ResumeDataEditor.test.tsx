import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import { profileSchema } from "../../shared/schema";
import {
  normalizeResumeDataDraft,
  ResumeDataEditor,
} from "./ResumeDataEditor";

const profile = profileSchema.parse({
  id: "50000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  title: "Softwareentwicklerin",
  email: "mina@example.com",
  linkedin: "linkedin.com/in/minakaya",
  github: "github.com/minakaya",
  portfolio: "mina.example.com",
  summary: "Kurzprofil",
  experiences: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      from: "01/2024",
      to: "heute",
      role: "Entwicklerin",
      company: "Beispiel GmbH",
      city: "Berlin",
      achievements: ["  Plattform modernisiert.  ", ""],
    },
  ],
  education: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      from: "10/2018",
      to: "09/2022",
      degree: "B.Sc. Informatik",
      institution: "Beispiel Universität",
      city: "Berlin",
    },
  ],
  languages: [" Deutsch – fließend ", ""],
  certifications: [" Scrum Master ", ""],
  updatedAt: "2026-07-20T10:00:00.000Z",
});

describe("ResumeDataEditor", () => {
  it("shows the Bewerbung's language column choice beside the language display options", () => {
    const html = renderToStaticMarkup(<ResumeDataEditor profile={profile} section="languages" defaultOpen
      languagesColumns={3} onLanguagesColumnsChange={vi.fn()} onPreview={vi.fn()} onSave={vi.fn()} />);
    const { document } = parseHTML(html);
    const select = document.querySelector('select[aria-label="Sprachen – Spalten"]');
    expect(select?.querySelectorAll("option")).toHaveLength(5);
    expect(select?.querySelector('option[value="3"]')?.hasAttribute("selected")).toBe(true);
    expect(html).toContain("Im Lebenslauf anzeigen");
  });
  it("is collapsed by default", () => {
    const markup = renderToStaticMarkup(
      <ResumeDataEditor
        profile={profile}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("resume-data-editor-body");
  });

  it("renders direct CRUD controls for all resume data groups", () => {
    const markup = renderToStaticMarkup(
      <ResumeDataEditor
        profile={profile}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        defaultOpen
      />,
    );

    expect(markup).toContain("Lebenslaufdaten bearbeiten");
    expect(markup).toContain("Station hinzufügen");
    expect(markup).toContain("Bildungsstation hinzufügen");
    expect(markup).toContain("Entwicklerin löschen");
    expect(markup).toContain("Profildaten speichern");
    expect(markup).toContain("Abschnitt aktualisieren");
    expect(markup).toContain("Gemeinsamer Europäischer Referenzrahmen");
    expect(markup).toContain('type="range"');
    expect(markup).toContain('aria-valuetext="C1"');
    expect(markup).toContain("C2 – Annähernd muttersprachlich");
    // The personal data (name, address, phone, ...) is edited in the profile only: no second editor here.
    expect(markup).not.toContain('value="Mina"');
    expect(markup).not.toContain("Staatsangehörigkeit");
    expect(markup.match(/<details[^>]*open=""/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("shows strengths and every profile-defined resume section independently", () => {
    const extended = profileSchema.parse({
      ...profile,
      strengths: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          title: "Analytisches Denken",
          description: "Komplexe Aufgaben strukturieren",
        },
      ],
      resumeSectionTitles: {
        ...profile.resumeSectionTitles,
        strengths: "Kernkompetenzen",
      },
      specialSections: [
        {
          id: "70000000-0000-4000-8000-000000000001",
          kind: "additional",
          title: "Zusatzangaben",
          entries: [
            {
              id: "80000000-0000-4000-8000-000000000001",
              title: "Reisebereitschaft",
            },
          ],
        },
        {
          id: "70000000-0000-4000-8000-000000000002",
          kind: "projects",
          title: "Eigene Projekte",
          entries: [],
        },
      ],
    });
    const markup = renderToStaticMarkup(
      <ResumeDataEditor
        profile={extended}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        defaultOpen
      />,
    );

    expect(markup).toContain("Kernkompetenzen");
    expect(markup).toContain("Analytisches Denken");
    expect(markup).toContain("Zusatzangaben");
    expect(markup).toContain("Eigene Projekte");
    expect(markup).toContain("Reisebereitschaft");
  });

  it("normalizes lists and profile links before persisting", () => {
    const normalized = normalizeResumeDataDraft(profile);

    expect(normalized.linkedin).toBe("https://linkedin.com/in/minakaya");
    expect(normalized.github).toBe("https://github.com/minakaya");
    expect(normalized.portfolio).toBe("https://mina.example.com");
    expect(normalized.experiences[0].achievements).toEqual([
      "Plattform modernisiert.",
    ]);
    expect(normalized.languages).toEqual(["Deutsch – fließend"]);
    expect(normalized.certifications).toEqual(["Scrum Master"]);
  });
});
