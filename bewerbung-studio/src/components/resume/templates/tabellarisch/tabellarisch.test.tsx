import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { TabellarischResume } from "./TabellarischResume";
import { TabellarischSummary } from "./TabellarischSummary";
import { TabellarischStrengths } from "./TabellarischStrengths";
import { TabellarischTimeline } from "./TabellarischTimeline";
import {
  createTabellarischPageData,
  formatTabellarischDateRange,
  resolveTabellarischSummary,
  toExternalHref,
} from "./tabellarisch.model";

const experienceOneId = "10000000-0000-4000-8000-000000000001";
const experienceTwoId = "10000000-0000-4000-8000-000000000002";
const educationId = "20000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  title: "Senior Softwareentwicklerin",
  city: "Berlin",
  country: "Deutschland",
  email: "mina@example.com",
  phone: "+49 30 123456",
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
      achievements: ["Ladezeit reduziert."],
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

describe("Tabellarisch page model", () => {
  it("filters career entries with the shared page plan without mutating the profile", () => {
    const firstPage = createTabellarischPageData(profile, firstPagePlan);
    const secondPage = createTabellarischPageData(profile, secondPagePlan);

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
    expect(profile.experiences).toHaveLength(2);
  });

  it("prefers the application-specific summary and keeps safe fallbacks", () => {
    expect(
      resolveTabellarischSummary(profile, "Auf die Stelle zugeschnitten"),
    ).toBe("Profil aus den Stammdaten");
    expect(resolveTabellarischSummary(profile, "   ")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(resolveTabellarischSummary(undefined, "")).toBe("");
  });

  it("formats dates and external links without inventing values", () => {
    expect(formatTabellarischDateRange("01/2023", "heute")).toBe(
      "01/2023 – heute",
    );
    expect(formatTabellarischDateRange("", "2024")).toBe("2024");
    expect(toExternalHref("mina.example.com")).toBe(
      "https://mina.example.com",
    );
    expect(toExternalHref("https://example.com")).toBe(
      "https://example.com",
    );
  });
});

describe("Tabellarisch rendering", () => {
  it("renders continuation content once without repeating the first-page header", () => {
    const markup = renderToStaticMarkup(
      <TabellarischResume
        profile={profile}
        name="Mina Kaya"
        atsMode={false}
        plan={secondPagePlan}
        totalPages={2}
        accentColor="#b86f12"
        secondaryColor="#17263d"
        photoSource="data:image/png;base64,AA=="
        resumeProfile="Auf die Stelle zugeschnitten"
        sections={profile.resumeSections}
      />,
    );

    expect(markup).toContain("tabellarisch-continuation-header");
    expect(markup).toContain("Senior Softwareentwicklerin");
    expect(markup).toContain("Zukunft AG");
    expect(markup).not.toContain("Beispiel GmbH");
    expect(markup).not.toContain("tabellarisch-header__photo");
    expect(markup).not.toContain("Auf die Stelle zugeschnitten");
  });

  it("uses role, organization, date and location order in ATS mode", () => {
    const markup = renderToStaticMarkup(
      <TabellarischTimeline
        atsMode
        items={[
          {
            id: experienceTwoId,
            from: "01/2023",
            to: "heute",
            role: "Senior Softwareentwicklerin",
            organization: "Zukunft AG",
            city: "Hamburg",
            achievements: ["Plattform modernisiert."],
          },
        ]}
      />,
    );

    const roleIndex = markup.indexOf("Senior Softwareentwicklerin");
    const organizationIndex = markup.indexOf("Zukunft AG");
    const dateIndex = markup.indexOf("01/2023");
    const cityIndex = markup.indexOf("Hamburg");

    expect(roleIndex).toBeGreaterThan(-1);
    expect(roleIndex).toBeLessThan(organizationIndex);
    expect(organizationIndex).toBeLessThan(dateIndex);
    expect(dateIndex).toBeLessThan(cityIndex);
    expect(markup).not.toContain("tabellarisch-timeline-entry__rail");
  });

  it("renders summary text as text instead of executable markup", () => {
    const markup = renderToStaticMarkup(
      <TabellarischSummary text={'<img src=x onerror="alert(1)">'} />,
    );

    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
  });

  it("renders two visual strength cards before the timeline", () => {
    const markup = renderToStaticMarkup(
      <TabellarischResume
        profile={profile}
        name="Mina Kaya"
        atsMode={false}
        plan={{
          pageNumber: 1,
          density: "standard",
          items: [
            { kind: "experience", id: experienceOneId, weight: 5 },
            { kind: "education", id: educationId, weight: 3 },
          ],
        }}
        totalPages={1}
        accentColor="#c78300"
        secondaryColor="#17263d"
        photoSource="data:image/png;base64,AA=="
        resumeProfile="Auf die Stelle zugeschnitten"
        sections={profile.resumeSections}
      />,
    );

    expect(markup).toContain("tabellarisch-background");
    expect(markup).toContain("Kurzprofil");
    expect(markup.match(/class="tabellarisch-strength"/g)).toHaveLength(2);
    expect(markup.indexOf("Stärken")).toBeLessThan(
      markup.indexOf("Beruflicher Werdegang"),
    );
  });

  it("keeps strength descriptions in the ATS text flow", () => {
    const markup = renderToStaticMarkup(
      <TabellarischStrengths profile={profile} atsMode />,
    );

    expect(markup).toContain("tabellarisch-strengths-ats");
    expect(markup).not.toContain("<svg");
  });

  it("registers a timeline layout with the shared design defaults", () => {
    const template = getTemplate("tabellarisch");

    expect(template).toMatchObject({
      id: "tabellarisch",
      layout: "timeline",
      supportsAtsMode: true,
      supportsFreeform: true,
      designDefaults: {
        columnLayout: "timeline",
        fontId: "source-sans",
      },
    });
  });
});
