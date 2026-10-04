import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema } from "../../../../shared/schema";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { kreativLebenslaufTemplateConfig } from "../../../../features/templates/template.constants";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { kreativDefaults } from "./kreativ.defaults";
import {
  createKreativPageData,
  formatKreativDateRange,
  parseKreativLanguage,
  resolveKreativSummary,
  toKreativExternalHref,
  uniqueKreativValues,
} from "./kreativ.model";
import { KreativResume } from "./KreativResume";

const firstExperienceId = "33000000-0000-4000-8000-000000000001";
const secondExperienceId = "33000000-0000-4000-8000-000000000002";
const educationId = "43000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "53000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Marie",
  lastName: "Schröder",
  title: "IT-Prozess- und Projektmanagerin",
  postalCode: "80331",
  city: "München",
  country: "Deutschland",
  email: "marie@example.com",
  phone: "+49 30 123456",
  linkedin: "linkedin.com/in/marie",
  portfolio: "marie.example.com",
  summary: "Profil aus den Stammdaten",
  skills: ["Projektmanagement", "Jira", "Künstliche Intelligenz"],
  experiences: [
    {
      id: firstExperienceId,
      from: "01/2020",
      to: "12/2022",
      role: "IT-Projektmanagerin",
      company: "Beispiel GmbH",
      city: "München",
      achievements: ["Projektlaufzeit um 25 % reduziert."],
    },
    {
      id: secondExperienceId,
      from: "01/2023",
      to: "heute",
      role: "Senior IT-Projektmanagerin",
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
      degree: "M.Sc. Wirtschaftsinformatik",
      institution: "Beispiel Universität",
      city: "München",
    },
  ],
  languages: ["Deutsch – Muttersprache", "Englisch – B2"],
  certifications: ["Professional Scrum Master I"],
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
  name = "Marie Schröder",
  profileOverride = profile,
}: {
  atsMode?: boolean;
  plan?: ResumePagePlan;
  totalPages?: number;
  photoSource?: string | null;
  resumeProfile?: string;
  name?: string;
  profileOverride?: typeof profile;
} = {}) =>
  renderToStaticMarkup(
    <KreativResume
      profile={{ ...profileOverride, summary: resumeProfile }}
      name={name}
      atsMode={atsMode}
      plan={plan}
      totalPages={totalPages}
      accentColor="#37B978"
      secondaryColor="#D9F2E5"
      photoSource={photoSource}
      resumeProfile={resumeProfile}
      sections={profileOverride.resumeSections}
    />,
  );

describe("Kreativ page model", () => {
  it("filters whole career entries with the shared page plan", () => {
    const firstPage = createKreativPageData(profile, firstPagePlan);
    const secondPage = createKreativPageData(profile, secondPagePlan);

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

  it("normalizes summaries, links, dates, and language levels", () => {
    expect(resolveKreativSummary(profile, "Stellenspezifisch")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(resolveKreativSummary(profile, "   ")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(formatKreativDateRange("01/2023", "heute")).toBe(
      "01/2023 – heute",
    );
    expect(toKreativExternalHref("javascript:alert(1)")).toBe(
      "https://alert(1)",
    );
    expect(uniqueKreativValues(["Jira", " Jira ", "", "Asana"])).toEqual([
      "Jira",
      "Asana",
    ]);
    expect(parseKreativLanguage("Deutsch – Muttersprache").score).toBe(6);
    expect(parseKreativLanguage("Englisch – B2")).toMatchObject({
      name: "Englisch",
      level: "B2",
      score: 4,
    });
  });
});

describe("Kreativ rendering", () => {
  it("keeps custom sections in the main column and preserves visibility in preview and PDF", () => {
    const projectId = crypto.randomUUID();
    const hobbiesId = crypto.randomUUID();
    const hiddenId = crypto.randomUUID();
    const source = profileSchema.parse({ ...profile, github: "github.com/marie", resumePersonalFieldVisibility: {
      ...profile.resumePersonalFieldVisibility, phone: false, website: false,
    }, specialSections: [
      { id: projectId, kind: "projects", title: "Projekt-Highlight", contentType: "list", entries: [{ id: crypto.randomUUID(), title: "oiözio" }] },
      { id: hobbiesId, kind: "interests", title: "Hobbys & Interesses", contentType: "text", entries: [{ id: crypto.randomUUID(), title: "demo" }] },
      { id: hiddenId, kind: "custom", title: "Verborgen", isVisible: false, entries: [{ id: crypto.randomUUID(), title: "Geheim" }] },
    ] });
    const settings = getTemplateDocumentDesignDefaults("kreativ");
    const resolved = resolveCvDocument({ profile: source, templateId: "kreativ", settings });
    const preview = resolved.pagePlan.map(plan => renderToStaticMarkup(
      <ManagedResumePreview profile={resolved.profile} templateId="kreativ" pageNumber={plan.pageNumber}
        totalPages={resolved.pagePlan.length} designSettings={settings} resolvedCv={resolved}>
        <KreativResume profile={resolved.profile} name="Marie Schröder" atsMode={false} plan={plan}
          totalPages={resolved.pagePlan.length} accentColor="#37B978" secondaryColor="#D9F2E5"
          photoSource={null} resumeProfile="" sections={resolved.sections} />
      </ManagedResumePreview>
    )).join("");
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf",
      templateId: "kreativ", accentColor: "#37B978", secondaryColor: "#D9F2E5", documents: {},
      designSettings: settings, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    for (const [html, mainSelector] of [[preview, ".kreativ-left-column"],
      [buildDocumentHtml(application, source, "lebenslauf"), ".kreativ-pdf-left"]] as const) {
      const { document } = parseHTML(html);
      for (const id of [projectId, hobbiesId]) {
        const section = document.querySelector(`${mainSelector} [data-managed-section="special:${id}"]`);
        expect(section?.getAttribute("data-section-type")).toBe("main-section");
        expect(section?.querySelector('[data-custom-role="heading"]')).not.toBeNull();
        expect(section?.querySelector('[data-custom-role="entry"]')).not.toBeNull();
      }
      expect(document.querySelector(`[data-managed-section="special:${projectId}"]`)?.textContent).toContain("oiözio");
      expect(document.querySelector(`[data-managed-section="special:${hobbiesId}"]`)?.textContent).toContain("demo");
      expect(document.querySelector(`[data-managed-section="special:${hiddenId}"]`)).toBeNull();
      expect(document.querySelector('[data-contact-kind="phone"]')).toBeNull();
      expect(document.querySelector('[data-contact-kind="github"]')?.textContent).toContain("github.com/marie");
      expect(document.querySelector('[data-contact-kind="website"]')).toBeNull();
      expect(document.querySelector(`${mainSelector} [data-managed-section="experience"]`)).not.toBeNull();
      expect(document.querySelector(`${mainSelector} [data-managed-section="education"]`)).not.toBeNull();
      expect(document.querySelector("[data-managed-section=summary]")).not.toBeNull();
    }
  });
  it("renders the green profile banner, photo, circles, and two columns", () => {
    const markup = renderResume();

    expect(markup).toContain('data-renderer="visual"');
    expect(markup).toContain("kreativ-header__photo");
    expect(markup).toContain("kreativ-background");
    expect(markup).toContain("kreativ-left-column");
    expect(markup).toContain("kreativ-right-column");
    expect(markup).toContain("Auf die Stelle zugeschnitten");
    expect(markup).toContain("Beispiel GmbH");
    expect(markup).not.toContain("Zukunft AG");
  });

  it("expands the banner identity and removes the photo placeholder", () => {
    const markup = renderResume({ photoSource: null });

    expect(markup).toContain("kreativ-header--no-photo");
    expect(markup).not.toContain("kreativ-header__photo");
    expect(markup).not.toContain("monogram");
  });

  it("keeps long names and professions wrap-safe", () => {
    const markup = renderResume({
      name: "Dr. Marie Alexandra Schröder-Hoffmann",
    });

    expect(markup).toContain(
      "Dr. Marie Alexandra Schröder-Hoffmann",
    );
    expect(markup).toContain("IT-Prozess- und Projektmanagerin");
  });

  it("renders the profile-defined knowledge title through the shared knowledge model", () => {
    const markup = renderResume();

    expect(markup).toContain("Besondere Kenntnisse");
    expect(markup).toContain("Projektmanagement");
    expect(markup).toContain("Künstliche Intelligenz");
    expect(markup).toContain("kreativ-skill");
  });

  it("uses a simple continuation without the banner pattern or sidebar", () => {
    const markup = renderResume({ plan: secondPagePlan });

    expect(markup).toContain('data-continuation="true"');
    expect(markup).toContain("kreativ-content--continuation");
    expect(markup).toContain("Zukunft AG");
    expect(markup).toContain("Beispiel Universität");
    expect(markup).not.toContain("kreativ-background");
    expect(markup).not.toContain("kreativ-right-column");
    expect(markup).not.toContain("kreativ-header__photo");
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
    expect(markup).not.toContain("kreativ-background");
    expect(markup).not.toContain("kreativ-header__photo");
    expect(markup).not.toContain("kreativ-right-column");
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

  it("registers app metadata, defaults, and existing Word assets", () => {
    expect(getTemplate("kreativ")).toMatchObject({
      id: "kreativ",
      name: "Kreativ",
      category: "creative-professional",
      layout: "bold-grid",
      accent: "#37B978",
      secondary: "#D9F2E5",
      supportsAtsMode: true,
      supportsPhoto: true,
      supportsFreeform: true,
      supportsMultiplePages: true,
      sidebarWidthRatio: 0.38,
    });
    expect(kreativDefaults).toMatchObject({
      page: {
        widthMm: 210,
        heightMm: 297,
        marginLeftMm: 15,
        marginRightMm: 15,
        marginBottomMm: 13,
      },
      layout: {
        headerHeightMm: 46,
        leftColumnWidthMm: 105,
        columnGapMm: 11,
        rightColumnWidthMm: 64,
      },
    });
    expect(kreativLebenslaufTemplateConfig).toMatchObject({
      id: "word-lebenslauf-kreativ",
      name: "Kreativ",
      fileName: "Kreativ_Lebenslauf_Muster.docx",
      atsFileName: "Kreativ_Lebenslauf_ATS.docx",
      previewFileName: "Kreativ_Lebenslauf_Muster.preview.png",
      supportsAtsMode: true,
      supportsPhoto: true,
      supportsBackground: true,
    });
  });
});
