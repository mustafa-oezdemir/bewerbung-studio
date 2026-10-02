import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ivyLeagueLebenslaufTemplateConfig } from "../../../../features/templates/template.constants";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { ivyLeagueDefaults } from "./ivy-league.defaults";
import { IvyLeagueLanguagesSection } from "./IvyLeagueLanguagesSection";
import {
  createIvyLeaguePageData,
  formatIvyLeagueDateRange,
  parseIvyLeagueLanguage,
  parseIvyLeagueStrengths,
  resolveIvyLeagueSummary,
  toIvyLeagueExternalHref,
} from "./ivy-league.model";
import { IvyLeagueResume } from "./IvyLeagueResume";

const firstExperienceId = "61000000-0000-4000-8000-000000000001";
const secondExperienceId = "61000000-0000-4000-8000-000000000002";
const educationId = "62000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "63000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Lena",
  lastName: "Hoffmann",
  title: "Ingenieurin",
  city: "München",
  country: "Deutschland",
  phone: "+49 30 12345678",
  email: "lena@example.de",
  linkedin: "linkedin.com/in/lena",
  portfolio: "lena.example.com",
  birthDate: "01.03.1990",
  birthPlace: "München",
  summary: "Erfahrene Ingenieurin für sichere technische Systeme.",
  skills: [
    "Analysefähigkeit – Präzise Bewertung komplexer Systeme",
    "Kundenbetreuung – Verlässliche Beratung und Schulung",
    "Teamführung – Führung interdisziplinärer Teams",
    "FEM",
  ],
  experiences: [
    {
      id: firstExperienceId,
      from: "2019",
      to: "2023",
      role: "Senior Maschinenbauingenieurin",
      company: "Siemens AG",
      city: "Berlin",
      achievements: ["Projekteffizienz um 15 % gesteigert."],
    },
    {
      id: secondExperienceId,
      from: "2016",
      to: "2019",
      role: "Prüfingenieurin",
      company: "Bosch Rexroth",
      city: "Stuttgart",
      achievements: ["Fehlerquote um 10 % reduziert."],
    },
  ],
  education: [
    {
      id: educationId,
      from: "2011",
      to: "2013",
      degree: "M.Sc. Maschinenbau",
      institution: "Technische Universität München",
      city: "München",
    },
  ],
  languages: ["Deutsch – Muttersprache", "Englisch – B2"],
  certifications: ["TÜV Functional Safety Engineer"],
  updatedAt: "2026-07-20T10:00:00.000Z",
});

const firstPagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [{ kind: "experience", id: firstExperienceId, weight: 7 }],
};
const secondPagePlan: ResumePagePlan = {
  pageNumber: 2,
  density: "compact",
  items: [
    { kind: "experience", id: secondExperienceId, weight: 6 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};
const singlePagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [
    { kind: "experience", id: firstExperienceId, weight: 7 },
    { kind: "experience", id: secondExperienceId, weight: 6 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

const renderResume = ({
  atsMode = false,
  plan = singlePagePlan,
  totalPages = 1,
  backgroundId = "pastel-gradient",
  resumeProfile = "Stellenspezifisches Kurzprofil",
  name = "Lena Hoffmann",
}: {
  atsMode?: boolean;
  plan?: ResumePagePlan;
  totalPages?: number;
  backgroundId?: "pastel-gradient" | "white";
  resumeProfile?: string;
  name?: string;
} = {}) =>
  renderToStaticMarkup(
    <IvyLeagueResume
      profile={{ ...profile, summary: resumeProfile }}
      name={name}
      atsMode={atsMode}
      plan={plan}
      totalPages={totalPages}
      accentColor="#073C8C"
      secondaryColor="#FF6A00"
      backgroundId={backgroundId}
      resumeProfile={resumeProfile}
      sections={profile.resumeSections}
    />,
  );

describe("Ivy League page model", () => {
  it("filters complete career entries through the shared page plan", () => {
    const first = createIvyLeaguePageData(profile, firstPagePlan);
    const second = createIvyLeaguePageData(profile, secondPagePlan);

    expect(first.experiences.map((entry) => entry.id)).toEqual([
      firstExperienceId,
    ]);
    expect(first.education).toEqual([]);
    expect(second.experiences.map((entry) => entry.id)).toEqual([
      secondExperienceId,
    ]);
    expect(second.education.map((entry) => entry.id)).toEqual([
      educationId,
    ]);
    expect(second.isContinuation).toBe(true);
  });

  it("normalizes summaries, dates, links, strengths, and languages", () => {
    expect(resolveIvyLeagueSummary(profile, "Gezielt")).toBe(profile.summary);
    expect(resolveIvyLeagueSummary(profile, " ")).toBe(profile.summary);
    expect(formatIvyLeagueDateRange("2019", "2023")).toBe("2019 – 2023");
    expect(toIvyLeagueExternalHref("javascript:alert(1)")).toBe(
      "https://alert(1)",
    );
    expect(parseIvyLeagueStrengths(profile)[0]).toEqual({
      title: "Analysefähigkeit",
      description: "Präzise Bewertung komplexer Systeme",
    });
    expect(parseIvyLeagueLanguage("Englisch – B2")).toMatchObject({
      name: "Englisch",
      level: "B2",
      score: 4,
    });
  });
});

describe("Ivy League rendering", () => {
  it("renders the centered single-column visual layout and watercolor", () => {
    const markup = renderResume();

    expect(markup).toContain('data-renderer="visual"');
    expect(markup).toContain("ivy-league-background");
    expect(markup).toContain("ivy-league-header");
    expect(markup).toContain("ivy-league-strengths");
    expect(markup).toContain("ivy-league-career");
    expect(markup).toContain('<div class="ivy-league-career-entry__role"><h4>Senior Maschinenbauingenieurin</h4><time>2019 – 2023</time></div><div class="ivy-league-career-entry__top"><h3>Siemens AG</h3><span>Berlin</span></div>');
    expect(markup).toContain("ivy-league-languages");
    expect(markup).toContain("ivy-league-languages--columns-2");
    expect(markup).toContain('href="https://linkedin.com/in/lena"');
    expect(markup).toContain("https://lena.example.com");
    expect(markup).not.toContain("Seite 1 / 1");
    expect(markup).not.toContain("<img");
  });

  it("uses three language columns and wraps a fourth language", () => {
    const fourLanguageProfile = profileSchema.parse({
      ...profile,
      languages: ["Deutsch", "Englisch", "Türkisch", "Französisch"],
    });
    const markup = renderToStaticMarkup(
      <IvyLeagueLanguagesSection profile={fourLanguageProfile} />,
    );

    expect(markup).toContain("ivy-league-languages--columns-3");
    expect(markup.match(/class="ivy-league-language"/g)).toHaveLength(4);
  });

  it("turns the watercolor off with the white background option", () => {
    const markup = renderResume({ backgroundId: "white" });
    expect(markup).not.toContain("ivy-league-background");
  });

  it("keeps long identity content wrap-safe", () => {
    const markup = renderResume({
      name: "Dr.-Ing. Lena Alexandra Hoffmann-Schneider",
    });
    expect(markup).toContain(
      "Dr.-Ing. Lena Alexandra Hoffmann-Schneider",
    );
    expect(markup).toContain("Ingenieurin");
  });

  it("uses a compact continuation header and keeps the watercolor", () => {
    const markup = renderResume({
      plan: secondPagePlan,
      totalPages: 2,
    });
    expect(markup).toContain('data-continuation="true"');
    expect(markup).toContain("ivy-league-header--compact");
    expect(markup).toContain("Bosch Rexroth");
    expect(markup).toContain("ivy-league-background");
    expect(markup).not.toContain("Stellenspezifisches Kurzprofil");
  });

  it("renders the ATS document linearly without decorative elements", () => {
    const markup = renderResume({ atsMode: true });
    const sectionOrder = [
      "Kurzprofil",
      "Beruflicher Werdegang",
      "Bildungsweg",
      "Kenntnisse",
      "Sprachen",
      "Stärken",
      "Zertifikate",
    ].map((title) => markup.indexOf(title));

    expect(markup).toContain('data-renderer="ats"');
    expect(markup).not.toContain("ivy-league-background");
    expect(markup).not.toContain("ivy-league-language__dots");
    expect(sectionOrder.every((index) => index >= 0)).toBe(true);
    expect(
      sectionOrder.every(
        (index, position) =>
          position === 0 || index > sectionOrder[position - 1],
      ),
    ).toBe(true);
  });

  it("escapes user-provided summary markup", () => {
    const markup = renderResume({
      resumeProfile: '<img src=x onerror="alert(1)">',
    });
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img src=x");
  });

  it("registers metadata, design defaults, and Word asset names", () => {
    expect(getTemplate("ivy-league")).toMatchObject({
      id: "ivy-league",
      name: "Ivy League",
      category: "classic-professional",
      layout: "centered",
      accent: "#073C8C",
      secondary: "#FF6A00",
      supportsAtsMode: true,
      supportsPhoto: false,
      supportsFreeform: true,
      supportsMultiplePages: true,
    });
    expect(ivyLeagueDefaults).toMatchObject({
      page: {
        widthMm: 210,
        heightMm: 297,
        marginTopMm: 13,
        marginRightMm: 14,
        marginBottomMm: 12,
        marginLeftMm: 14,
      },
      layout: {
        contentWidthMm: 182,
        headerHeightMm: 19,
      },
    });
    expect(ivyLeagueLebenslaufTemplateConfig).toMatchObject({
      id: "word-lebenslauf-ivy-league",
      fileName: "Ivy_League_Lebenslauf_Muster.docx",
      atsFileName: "Ivy_League_Lebenslauf_ATS.docx",
      previewFileName: "Ivy_League_Lebenslauf_Muster.preview.png",
      supportsPhoto: false,
      supportsBackground: true,
      supportsAtsMode: true,
    });
  });
});
