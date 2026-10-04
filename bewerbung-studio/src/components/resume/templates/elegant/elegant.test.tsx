import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { elegantLebenslaufTemplateConfig } from "../../../../features/templates/template.constants";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { ElegantResume } from "./ElegantResume";
import {
  createElegantPageData,
  formatElegantDateRange,
  resolveElegantSummary,
  toElegantExternalHref,
  uniqueElegantValues,
} from "./elegant.model";

const experienceOneId = "30000000-0000-4000-8000-000000000001";
const experienceTwoId = "30000000-0000-4000-8000-000000000002";
const educationId = "40000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "50000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  title: "Senior Softwareentwicklerin",
  postalCode: "10115",
  city: "Berlin",
  country: "Deutschland",
  email: "mina@example.com",
  phone: "+49 30 123456",
  linkedin: "linkedin.com/in/minakaya",
  portfolio: "mina.example.com",
  summary: "Profil aus den Stammdaten",
  skills: ["TypeScript", "React", "TypeScript"],
  experiences: [
    {
      id: experienceOneId,
      from: "01/2020",
      to: "12/2022",
      role: "Softwareentwicklerin",
      company: "Beispiel GmbH",
      city: "Berlin",
      achievements: ["Ladezeit um 40 % reduziert."],
    },
    {
      id: experienceTwoId,
      from: "01/2023",
      to: "heute",
      role: "Senior Softwareentwicklerin",
      company: "Zukunft AG",
      city: "Hamburg",
      achievements: ["Plattform modernisiert."],
    },
  ],
  education: [
    {
      id: educationId,
      from: "10/2015",
      to: "09/2019",
      degree: "B.Sc. Informatik",
      institution: "Beispiel Universität",
      city: "Berlin",
    },
  ],
  languages: ["Deutsch – fließend", "Englisch – fließend"],
  certifications: ["Professional Scrum Master I"],
  updatedAt: "2026-07-20T10:00:00.000Z",
});

const firstPagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [{ kind: "experience", id: experienceOneId, weight: 5 }],
};

const secondPagePlan: ResumePagePlan = {
  pageNumber: 2,
  density: "compact",
  items: [
    { kind: "experience", id: experienceTwoId, weight: 5 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

const singlePagePlan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [
    { kind: "experience", id: experienceOneId, weight: 5 },
    { kind: "experience", id: experienceTwoId, weight: 5 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

const renderResume = ({
  atsMode = false,
  plan = firstPagePlan,
  totalPages = 2,
  photoSource = "data:image/png;base64,AA==",
  resumeProfile = "Auf die Stelle zugeschnitten",
}: {
  atsMode?: boolean;
  plan?: ResumePagePlan;
  totalPages?: number;
  photoSource?: string | null;
  resumeProfile?: string;
} = {}) =>
  renderToStaticMarkup(
    <ElegantResume
      profile={{ ...profile, summary: resumeProfile }}
      name="Mina Kaya"
      atsMode={atsMode}
      plan={plan}
      totalPages={totalPages}
      accentColor="#FE6201"
      secondaryColor="#8A0202"
      photoSource={photoSource}
      resumeProfile={resumeProfile}
      sections={profile.resumeSections}
    />,
  );

describe("Elegant page model", () => {
  it("filters career entries with the shared page plan", () => {
    const firstPage = createElegantPageData(profile, firstPagePlan);
    const secondPage = createElegantPageData(profile, secondPagePlan);

    expect(firstPage.experiences.map((entry) => entry.id)).toEqual([
      experienceOneId,
    ]);
    expect(firstPage.education).toEqual([]);
    expect(firstPage.isContinuation).toBe(false);
    expect(secondPage.experiences.map((entry) => entry.id)).toEqual([
      experienceTwoId,
    ]);
    expect(secondPage.education.map((entry) => entry.id)).toEqual([
      educationId,
    ]);
    expect(secondPage.isContinuation).toBe(true);
  });

  it("uses application-specific text and formats only existing values", () => {
    expect(resolveElegantSummary(profile, "Stellenspezifisches Profil")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(resolveElegantSummary(profile, "   ")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(formatElegantDateRange("01/2023", "heute")).toBe(
      "01/2023 – heute",
    );
    expect(formatElegantDateRange("", "2024")).toBe("2024");
    expect(toElegantExternalHref("mina.example.com")).toBe(
      "https://mina.example.com",
    );
    expect(toElegantExternalHref("javascript:alert(1)")).toBe(
      "https://alert(1)",
    );
    expect(uniqueElegantValues(["React", " React ", "", "TypeScript"])).toEqual(
      ["React", "TypeScript"],
    );
  });
});

describe("Elegant rendering", () => {
  it("renders the visual right sidebar and an optional photo", () => {
    const markup = renderResume();

    expect(markup).toContain('data-renderer="visual"');
    expect(markup).toContain("elegant-sidebar");
    expect(markup).toContain("elegant-sidebar__photo");
    expect(markup).toContain("Auf die Stelle zugeschnitten");
    expect(markup).toContain("Beispiel GmbH");
    expect(markup).not.toContain("elegant-header__kicker");
    expect(markup).not.toContain("Zukunft AG");
  });

  it("renders normalized links without a redundant single-page number", () => {
    const markup = renderResume({
      plan: singlePagePlan,
      totalPages: 1,
    });

    expect(markup).toContain('href="https://linkedin.com/in/minakaya"');
    expect(markup).toContain("https://mina.example.com");
    expect(markup).not.toContain("Seite 1 von 1");
  });

  it("removes the photo area when no photo is available", () => {
    const markup = renderResume({ photoSource: null });

    expect(markup).toContain("elegant-sidebar");
    expect(markup).not.toContain("elegant-sidebar__photo");
    expect(markup).not.toContain("elegant-sidebar__monogram");
    expect(markup).toContain("Kurzprofil");
  });

  it("renders a compact continuation without repeating photo or summary", () => {
    const markup = renderResume({ plan: secondPagePlan });

    expect(markup).toContain('data-continuation="true"');
    expect(markup).toContain("elegant-sidebar__continuation");
    expect(markup).toContain("Zukunft AG");
    expect(markup).toContain("Beispiel Universität");
    expect(markup).not.toContain("Beispiel GmbH");
    expect(markup).not.toContain("elegant-sidebar__photo");
    expect(markup).not.toContain("Auf die Stelle zugeschnitten");
  });

  it("uses a separate linear ATS renderer without sidebar or photo", () => {
    const markup = renderResume({
      atsMode: true,
      plan: singlePagePlan,
      totalPages: 1,
    });
    const summaryIndex = markup.indexOf("Auf die Stelle zugeschnitten");
    const experienceIndex = markup.indexOf("Beruflicher Werdegang");
    const educationIndex = markup.indexOf("Bildungsweg");
    const knowledgeIndex = markup.indexOf("Kenntnisse");

    expect(markup).toContain('data-renderer="ats"');
    expect(markup).not.toContain('class="elegant-sidebar');
    expect(markup).not.toContain("elegant-sidebar__photo");
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeLessThan(experienceIndex);
    expect(experienceIndex).toBeLessThan(educationIndex);
    expect(educationIndex).toBeLessThan(knowledgeIndex);
    expect(markup).toContain("Stärken");
  });

  it("escapes user-provided summary markup", () => {
    const markup = renderResume({
      resumeProfile: '<img src=x onerror="alert(1)">',
    });

    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img src=x");
  });

  it("registers Elegant with matching Word assets and design defaults", () => {
    expect(getTemplate("elegant")).toMatchObject({
      id: "elegant",
      accent: "#168BE0",
      secondary: "#234663",
      layout: "sidebar-right",
      supportsAtsMode: true,
      supportsPhoto: true,
      supportsFreeform: true,
      supportsMultiplePages: true,
      designDefaults: {
        marginLevel: 3,
        sectionSpacingLevel: 4,
        fontSize: "small",
        lineHeightLevel: 2,
        columnLayout: "right-sidebar",
        fontId: "source-sans",
      },
    });
    expect(elegantLebenslaufTemplateConfig).toMatchObject({
      fileName: "Elegant_Lebenslauf_Muster.docx",
      atsFileName: "Elegant_Lebenslauf_ATS.docx",
      previewFileName: "Elegant_Lebenslauf_Muster.preview.png",
      supportsAtsMode: true,
    });
  });
});
