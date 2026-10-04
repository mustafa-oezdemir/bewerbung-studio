import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { modernTemplateDefaults } from "./modern.defaults";
import { ModernResume } from "./ModernResume";

const firstExperienceId = "91000000-0000-4000-8000-000000000001";
const secondExperienceId = "91000000-0000-4000-8000-000000000002";
const educationId = "92000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "93000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Sophia",
  lastName: "Bauer",
  title: "Architektin",
  city: "Hamburg",
  country: "Deutschland",
  phone: "+49 30 12345678",
  email: "sophia@example.de",
  linkedin: "linkedin.com/in/sophia",
  portfolio: "sophia.example.com",
  birthDate: "01.03.1990",
  birthPlace: "München",
  summary: "Erfahrene Architektin mit Fokus auf Projektleitung.",
  skills: [
    "Projektleitung – Bauprojekte sicher steuern",
    "Teamführung – Interdisziplinäre Teams koordinieren",
    "Archicad",
  ],
  experiences: [
    {
      id: firstExperienceId,
      from: "2019",
      to: "2023",
      role: "Senior Architektin",
      company: "Bauhaus AG",
      city: "München",
      achievements: ["Planungszeit um 25 % reduziert."],
    },
    {
      id: secondExperienceId,
      from: "2016",
      to: "2019",
      role: "Projektleiterin",
      company: "Siemens AG",
      city: "Berlin",
      achievements: ["Großprojekt im Budget abgeschlossen."],
    },
  ],
  education: [
    {
      id: educationId,
      from: "2010",
      to: "2012",
      degree: "Master in Architektur",
      institution: "Technische Universität",
      city: "Berlin",
    },
  ],
  languages: ["Deutsch – Muttersprache", "Englisch – C1"],
  certifications: ["Nachhaltiges Bauen"],
  updatedAt: "2026-07-20T10:00:00.000Z",
});

const singlePagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [
    { kind: "experience", id: firstExperienceId, weight: 6 },
    { kind: "experience", id: secondExperienceId, weight: 6 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};
const continuationPlan: ResumePagePlan = {
  pageNumber: 2,
  density: "compact",
  items: [
    { kind: "experience", id: secondExperienceId, weight: 6 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

const renderResume = ({
  atsMode = false,
  plan = singlePagePlan,
  totalPages = 1,
  profileOverride = profile,
}: {
  atsMode?: boolean;
  plan?: ResumePagePlan;
  totalPages?: number;
  profileOverride?: typeof profile;
} = {}) =>
  renderToStaticMarkup(
    <ModernResume
      profile={profileOverride}
      name="Sophia Bauer"
      atsMode={atsMode}
      plan={plan}
      totalPages={totalPages}
      accentColor="#06B6C9"
      secondaryColor="#C7F1F5"
      photoSource="data:image/png;base64,AA=="
      resumeProfile="Stellenspezifisches Kurzprofil"
      sections={profileOverride.resumeSections}
    />,
  );

describe("Modern rendering", () => {
  it("matches the clean header, round-photo, and 102/11/67 mm composition", () => {
    const markup = renderResume();
    expect(markup).not.toContain("modern-background-waves");
    expect(markup).toContain("modern-resume-header__photo");
    expect(markup).toContain("modern-contact-section--inline");
    expect(markup).toContain("modern-resume-left-column");
    expect(markup).toContain("modern-resume-right-column");
    expect(markup).toContain(profile.summary);
    expect(markup).toContain("Besondere Kenntnisse");
    expect(markup).toContain("Bauhaus AG");
    expect(markup.indexOf("Stellenspezifisches Kurzprofil")).toBeLessThan(
      markup.indexOf("Beruflicher Werdegang"),
    );
  });

  it("renders a compact continuation with only planned career entries", () => {
    const markup = renderResume({ plan: continuationPlan, totalPages: 2 });
    expect(markup).toContain('data-continuation="true"');
    expect(markup).toContain("modern-resume-header--compact");
    expect(markup).toContain("Siemens AG");
    expect(markup).not.toContain("Bauhaus AG");
    expect(markup).not.toContain("modern-background-waves");
    expect(markup).not.toContain("modern-resume-right-column");
  });

  it("renders the saved editor order immediately", () => {
    const reorderedProfile = profileSchema.parse({
      ...profile,
      resumeSectionLayouts: {
        modern: [
          { type: "education", zone: "main" },
          { type: "experience", zone: "main" },
          { type: "summary", zone: "sidebar" },
          { type: "strengths", zone: "sidebar" },
          { type: "languages", zone: "sidebar" },
          { type: "knowledge", zone: "sidebar" },
          { type: "certifications", zone: "sidebar" },
        ],
      },
    });
    const markup = renderResume({ profileOverride: reorderedProfile });
    const mainStart = markup.indexOf('class="modern-resume-left-column"');
    const sidebarStart = markup.indexOf('class="modern-resume-right-column"');

    expect(markup.indexOf("Bildungsweg", mainStart)).toBeLessThan(
      markup.indexOf("Beruflicher Werdegang", mainStart),
    );
    expect(markup.indexOf("Kurzprofil", sidebarStart)).toBeGreaterThan(
      sidebarStart,
    );
  });

  it("uses a linear ATS order without waves, photo, icons, or dots", () => {
    const markup = renderResume({ atsMode: true });
    const order = [
      "Persönliche Daten",
      "Kurzprofil",
      "Beruflicher Werdegang",
      "Bildungsweg",
      "Kenntnisse",
      "Sprachen",
      "Stärken",
      "Zertifikate",
    ].map((title) => markup.indexOf(title));

    expect(markup).not.toContain("modern-background-waves");
    expect(markup).not.toContain("modern-resume-header__photo");
    expect(markup).not.toContain("modern-contact-item__icon");
    expect(markup).not.toContain("modern-languages-item__dots");
    expect(
      order.every(
        (index, position) =>
          index >= 0 && (position === 0 || index > order[position - 1]),
      ),
    ).toBe(true);
  });

  it("registers the reference layout and multi-page defaults", () => {
    expect(getTemplate("modern")).toMatchObject({
      id: "modern",
      accent: "#06B6C9",
      secondary: "#C7F1F5",
      supportsAtsMode: true,
      supportsPhoto: true,
      supportsMultiplePages: true,
      designDefaults: {
        columnLayout: "two-column-left-wide",
        backgroundId: "white",
      },
    });
    expect(modernTemplateDefaults.layout).toMatchObject({
      leftColumnWidthMm: 102,
      columnGapMm: 11,
      rightColumnWidthMm: 67,
    });
  });
});
