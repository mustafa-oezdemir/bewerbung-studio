import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { zeitgenoessischLebenslaufTemplateConfig } from "../../../../features/templates/template.constants";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { zeitgenoessischDefaults } from "./zeitgenoessisch.defaults";
import {
  createZeitgenoessischPageData,
  formatZeitgenoessischDateRange,
  parseZeitgenoessischLanguage,
  resolveZeitgenoessischSummary,
  toZeitgenoessischExternalHref,
  uniqueZeitgenoessischValues,
} from "./zeitgenoessisch.model";
import { ZeitgenoessischResume } from "./ZeitgenoessischResume";

const firstExperienceId = "32000000-0000-4000-8000-000000000001";
const secondExperienceId = "32000000-0000-4000-8000-000000000002";
const educationId = "42000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "52000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Lena",
  lastName: "Hoffmann",
  title: "Finanzbuchhaltung | Controlling",
  postalCode: "10115",
  city: "Berlin",
  country: "Deutschland",
  email: "lena@example.com",
  phone: "+49 30 123456",
  linkedin: "linkedin.com/in/lenahoffmann",
  portfolio: "lena.example.com",
  summary: "Profil aus den Stammdaten",
  skills: [
    "Kommunikation: Abstimmungen zwischen Fachbereichen verbessert.",
    "Prozessoptimierung",
    "Teamführung",
    "C#",
  ],
  strengths: [
    {
      id: "62000000-0000-4000-8000-000000000001",
      title: "Kommunikation",
      description: "Abstimmungen zwischen Fachbereichen verbessert.",
    },
  ],
  experiences: [
    {
      id: firstExperienceId,
      from: "01/2020",
      to: "12/2022",
      role: "Finanzbuchhalterin",
      company: "Beispiel GmbH",
      city: "Berlin",
      achievements: ["Abschlussprozess um 30 % beschleunigt."],
    },
    {
      id: secondExperienceId,
      from: "01/2023",
      to: "heute",
      role: "Senior Finanzbuchhalterin",
      company: "Zukunft AG",
      city: "Hamburg",
      achievements: ["Reporting modernisiert."],
    },
  ],
  education: [
    {
      id: educationId,
      from: "10/2015",
      to: "09/2019",
      degree: "M.Sc. Finance",
      institution: "Beispiel Universität",
      city: "Berlin",
    },
  ],
  languages: ["Deutsch – Muttersprache", "Englisch – B2"],
  certifications: ["Bilanzbuchhalterin IHK"],
  updatedAt: "2026-07-20T10:00:00.000Z",
});

const firstPagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [{ kind: "experience", id: firstExperienceId, weight: 5 }],
};

const secondPagePlan: ResumePagePlan = {
  pageNumber: 2,
  density: "compact",
  items: [
    { kind: "experience", id: secondExperienceId, weight: 5 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

const singlePagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [
    { kind: "experience", id: firstExperienceId, weight: 5 },
    { kind: "experience", id: secondExperienceId, weight: 5 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

const renderResume = ({
  atsMode = false,
  plan = firstPagePlan,
  totalPages = 2,
  photoSource = "data:image/png;base64,AA==",
  resumeProfile = "Auf die Stelle zugeschnitten",
  name = "Lena Hoffmann",
}: {
  atsMode?: boolean;
  plan?: ResumePagePlan;
  totalPages?: number;
  photoSource?: string | null;
  resumeProfile?: string;
  name?: string;
} = {}) =>
  renderToStaticMarkup(
    <ZeitgenoessischResume
      profile={{ ...profile, summary: resumeProfile }}
      name={name}
      atsMode={atsMode}
      plan={plan}
      totalPages={totalPages}
      accentColor="#2FB478"
      secondaryColor="#CBECDD"
      photoSource={photoSource}
      resumeProfile={resumeProfile}
      sections={profile.resumeSections}
    />,
  );

describe("Zeitgenössisch page model", () => {
  it("filters career entries with the shared page plan", () => {
    const firstPage = createZeitgenoessischPageData(
      profile,
      firstPagePlan,
    );
    const secondPage = createZeitgenoessischPageData(
      profile,
      secondPagePlan,
    );

    expect(firstPage.experiences.map((entry) => entry.id)).toEqual([
      firstExperienceId,
    ]);
    expect(firstPage.education).toEqual([]);
    expect(secondPage.experiences.map((entry) => entry.id)).toEqual([
      secondExperienceId,
    ]);
    expect(secondPage.education.map((entry) => entry.id)).toEqual([
      educationId,
    ]);
    expect(secondPage.isContinuation).toBe(true);
  });

  it("normalizes reusable text, links, dates, and language levels", () => {
    expect(
      resolveZeitgenoessischSummary(
        profile,
        "Stellenspezifisches Profil",
      ),
    ).toBe("Profil aus den Stammdaten");
    expect(resolveZeitgenoessischSummary(profile, "   ")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(formatZeitgenoessischDateRange("01/2023", "heute")).toBe(
      "01/2023 – heute",
    );
    expect(toZeitgenoessischExternalHref("javascript:alert(1)")).toBe(
      "https://alert(1)",
    );
    expect(
      uniqueZeitgenoessischValues(["React", " React ", "", "Excel"]),
    ).toEqual(["React", "Excel"]);
    expect(
      parseZeitgenoessischLanguage("Deutsch – Muttersprache"),
    ).toMatchObject({
      name: "Deutsch",
      level: "Muttersprache",
      score: 6,
    });
    expect(parseZeitgenoessischLanguage("Englisch – B2").score).toBe(4);
  });
});

describe("Zeitgenössisch rendering", () => {
  it("renders the organic photo composition and two-column content", () => {
    const markup = renderResume();

    expect(markup).toContain('data-renderer="visual"');
    expect(markup).toContain("zeitgenoessisch-photo-composition");
    expect(markup).toContain("zeitgenoessisch-photo-shape--pale");
    expect(markup).toContain("zeitgenoessisch-left-column");
    expect(markup).toContain("zeitgenoessisch-main-column");
    expect(markup).toContain('data-element-id="zeitgenoessisch.skills"');
    expect(markup).toContain("C#");
    expect(markup).not.toContain("<span>Muttersprache</span>");
    expect(markup).not.toContain("<span>B2</span>");
    expect(markup).toContain("Auf die Stelle zugeschnitten");
    expect(markup).toContain("Beispiel GmbH");
    expect(markup).toContain(
      "Abstimmungen zwischen Fachbereichen verbessert.",
    );
    expect(markup).toContain("https://linkedin.com/in/lenahoffmann");
    expect(markup).not.toContain("Zukunft AG");
  });

  it("removes all photo decoration when no photo exists", () => {
    const markup = renderResume({ photoSource: null });

    expect(markup).toContain("zeitgenoessisch-header--no-photo");
    expect(markup).not.toContain("zeitgenoessisch-photo-composition");
    expect(markup).not.toContain("zeitgenoessisch-photo-shape");
    expect(markup).not.toContain("monogram");
  });

  it("keeps long identity text wrap-safe", () => {
    const markup = renderResume({
      name: "Dr. Lena Alexandra Hoffmann-Schneider",
    });

    expect(markup).toContain(
      "Dr. Lena Alexandra Hoffmann-Schneider",
    );
    expect(markup).toContain("zeitgenoessisch-header__identity");
  });

  it("uses a full-width continuation without repeated sidebar or photo", () => {
    const markup = renderResume({ plan: secondPagePlan });

    expect(markup).toContain('data-continuation="true"');
    expect(markup).toContain("zeitgenoessisch-columns--continuation");
    expect(markup).toContain("Zukunft AG");
    expect(markup).toContain("Beispiel Universität");
    expect(markup).not.toContain("zeitgenoessisch-left-column");
    expect(markup).not.toContain("zeitgenoessisch-photo-composition");
    expect(markup).not.toContain("Auf die Stelle zugeschnitten");
  });

  it("renders a linear ATS document in logical section order", () => {
    const markup = renderResume({
      atsMode: true,
      plan: singlePagePlan,
      totalPages: 1,
    });
    const summaryIndex = markup.indexOf("Auf die Stelle zugeschnitten");
    const experienceIndex = markup.indexOf("Beruflicher Werdegang");
    const educationIndex = markup.indexOf("Bildungsweg");
    const knowledgeIndex = markup.indexOf("Kenntnisse");
    const languagesIndex = markup.indexOf("Sprachen");
    const strengthsIndex = markup.indexOf("Stärken");
    const certificationsIndex = markup.indexOf("Zertifikate");

    expect(markup).toContain('data-renderer="ats"');
    expect(markup).not.toContain("zeitgenoessisch-left-column");
    expect(markup).not.toContain("zeitgenoessisch-photo-composition");
    expect(summaryIndex).toBeLessThan(experienceIndex);
    expect(experienceIndex).toBeLessThan(educationIndex);
    expect(educationIndex).toBeLessThan(knowledgeIndex);
    expect(knowledgeIndex).toBeLessThan(languagesIndex);
    expect(languagesIndex).toBeLessThan(strengthsIndex);
    expect(strengthsIndex).toBeLessThan(certificationsIndex);
  });

  it("escapes user-provided summary markup", () => {
    const markup = renderResume({
      resumeProfile: '<img src=x onerror="alert(1)">',
    });

    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img src=x");
  });

  it("registers app metadata, A4 defaults, and existing Word assets", () => {
    expect(getTemplate("zeitgenoessisch")).toMatchObject({
      id: "zeitgenoessisch",
      name: "Zeitgenössisch",
      category: "modern-professional",
      layout: "sidebar-left",
      accent: "#2FB478",
      secondary: "#CBECDD",
      supportsAtsMode: true,
      supportsPhoto: true,
      supportsFreeform: true,
      supportsMultiplePages: true,
      sidebarWidthRatio: 0.31,
    });
    expect(zeitgenoessischDefaults).toMatchObject({
      page: {
        widthMm: 210,
        heightMm: 297,
        marginTopMm: 15,
        marginRightMm: 17,
        marginBottomMm: 14,
        marginLeftMm: 17,
      },
      layout: {
        leftColumnWidthMm: 50,
        columnGapMm: 11,
        rightColumnWidthMm: 115,
      },
    });
    expect(zeitgenoessischLebenslaufTemplateConfig).toMatchObject({
      id: "word-lebenslauf-zeitgenoessisch",
      name: "Zeitgenössisch",
      fileName: "Zeitgenoessisch_Lebenslauf_Muster.docx",
      atsFileName: "Zeitgenoessisch_Lebenslauf_ATS.docx",
      previewFileName:
        "Zeitgenoessisch_Lebenslauf_Muster.preview.png",
      supportsAtsMode: true,
      supportsPhoto: true,
    });
  });
});
