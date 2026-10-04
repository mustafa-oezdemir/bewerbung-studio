import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { defaultDocumentDesign } from "../../../../shared/documentDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { formatApplicationDate } from "../../../../shared/applicationDate";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { parseHTML } from "linkedom";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { ZweispaltigResume } from "./ZweispaltigResume";
import {
  createZweispaltigPageData,
  formatZweispaltigDateRange,
  parseZweispaltigLanguage,
  resolveZweispaltigSummary,
  toZweispaltigExternalHref,
  uniqueZweispaltigValues,
} from "./zweispaltig.model";

const firstExperienceId = "31000000-0000-4000-8000-000000000001";
const secondExperienceId = "31000000-0000-4000-8000-000000000002";
const educationId = "41000000-0000-4000-8000-000000000001";

const profile = profileSchema.parse({
  id: "51000000-0000-4000-8000-000000000001",
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
  skills: ["TypeScript", "React", "Teamführung", "TypeScript"],
  experiences: [
    {
      id: firstExperienceId,
      from: "01/2020",
      to: "12/2022",
      role: "Softwareentwicklerin",
      company: "Beispiel GmbH",
      city: "Berlin",
      achievements: ["Ladezeit um 40 % reduziert."],
    },
    {
      id: secondExperienceId,
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
  profileOverride = profile,
}: {
  atsMode?: boolean;
  plan?: ResumePagePlan;
  totalPages?: number;
  photoSource?: string | null;
  resumeProfile?: string;
  profileOverride?: typeof profile;
} = {}) =>
  renderToStaticMarkup(
    <ZweispaltigResume
      profile={{ ...profileOverride, summary: resumeProfile }}
      name="Mina Kaya"
      atsMode={atsMode}
      plan={plan}
      totalPages={totalPages}
      accentColor="#165DAA"
      secondaryColor="#EAF2FA"
      photoSource={photoSource}
      resumeProfile={resumeProfile}
      sections={profileOverride.resumeSections}
    />,
  );

describe("Zweispaltig page model", () => {
  it("filters career entries with the shared page plan", () => {
    const firstPage = createZweispaltigPageData(profile, firstPagePlan);
    const secondPage = createZweispaltigPageData(profile, secondPagePlan);

    expect(firstPage.experiences.map((entry) => entry.id)).toEqual([
      firstExperienceId,
    ]);
    expect(firstPage.education).toEqual([]);
    expect(firstPage.isContinuation).toBe(false);
    expect(secondPage.experiences.map((entry) => entry.id)).toEqual([
      secondExperienceId,
    ]);
    expect(secondPage.education.map((entry) => entry.id)).toEqual([
      educationId,
    ]);
    expect(secondPage.isContinuation).toBe(true);
  });

  it("normalizes summaries, date ranges, links, and duplicate values", () => {
    expect(
      resolveZweispaltigSummary(profile, "Stellenspezifisches Profil"),
    ).toBe("Profil aus den Stammdaten");
    expect(resolveZweispaltigSummary(profile, "   ")).toBe(
      "Profil aus den Stammdaten",
    );
    expect(formatZweispaltigDateRange("01/2023", "heute")).toBe(
      "01/2023 – heute",
    );
    expect(formatZweispaltigDateRange("", "2024")).toBe("2024");
    expect(toZweispaltigExternalHref("mina.example.com")).toBe(
      "https://mina.example.com",
    );
    expect(toZweispaltigExternalHref("javascript:alert(1)")).toBe(
      "https://alert(1)",
    );
    expect(
      uniqueZweispaltigValues(["React", " React ", "", "TypeScript"]),
    ).toEqual(["React", "TypeScript"]);
    expect(parseZweispaltigLanguage("Deutsch – Muttersprache")).toMatchObject(
      {
        name: "Deutsch",
        level: "Muttersprache",
        score: 6,
      },
    );
  });
});

describe("Zweispaltig rendering", () => {
  it.each(["side-by-side", "stacked"] as const)("shares %s metadata, custom sections and layout with PDF", (metadataLayout) => {
    const projectId = "71000000-0000-4000-8000-000000000001";
    const hobbyId = "72000000-0000-4000-8000-000000000001";
    let source = profileSchema.parse({ ...profile, experiences: [profile.experiences[0]],
      applicationPlace: "Berlin", applicationDate: "2026-09-28",
      specialSections: [
        { id: projectId, kind: "custom", title: "Projekt-Highlight", isVisible: true,
          contentType: "list", entries: [{ id: crypto.randomUUID(), title: "Projektinhalt" }] },
        { id: hobbyId, kind: "interests", title: "Hobbys & Interesses", isVisible: true,
          contentType: "text", entries: [{ id: crypto.randomUUID(), title: "Wandern" }] },
      ],
    });
    source = moveManagerSection(source, "zweispaltig", `special:${projectId}`, "main", 2);
    source = moveManagerSection(source, "zweispaltig", `special:${hobbyId}`, "sidebar", 3);
    const settings = { ...defaultDocumentDesign, metadataLayout,
      resumePresentation: { sidebarWidthPercent: 35 as const, sidebarSide: "right" as const,
        closing: { placement: "main" as const, alignment: "right" as const } },
      resumeAppearance: { sidebarBackgroundColor: "#f2f3f4", mainBackgroundColor: "#fafafa" },
    };
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId: "zweispaltig", accentColor: "#0b3d86", secondaryColor: "#58b5f7",
      documents: {}, designSettings: settings, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const resolved = resolveCvDocument({ profile: source, templateId: "zweispaltig", settings: application.designSettings, application });
    const preview = resolved.pagePlan.map((plan) => renderToStaticMarkup(
      <ManagedResumePreview profile={resolved.profile} templateId="zweispaltig" pageNumber={plan.pageNumber}
        totalPages={resolved.pagePlan.length} designSettings={application.designSettings} resolvedCv={resolved}>
        <ZweispaltigResume profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={plan}
          totalPages={resolved.pagePlan.length} accentColor="#0b3d86" secondaryColor="#58b5f7"
          photoSource={null} resumeProfile="" sections={resolved.sections} />
      </ManagedResumePreview>,
    )).join("");
    const pdf = buildDocumentHtml(application, source, "lebenslauf");
    for (const [html, mainSelector, sidebarSelector] of [
      [preview, ".zweispaltig-main", ".zweispaltig-sidebar"],
      [pdf, ".zweispaltig-pdf-main", ".zweispaltig-pdf-sidebar"],
    ] as const) {
      const { document } = parseHTML(html);
      expect(document.querySelector(`${mainSelector} [data-managed-section="special:${projectId}"]`)?.textContent).toContain("Projektinhalt");
      expect(document.querySelector(`${sidebarSelector} [data-managed-section="special:${hobbyId}"]`)?.textContent).toContain("Wandern");
      for (const id of [projectId, hobbyId]) {
        const section = document.querySelector(`[data-managed-section="special:${id}"]`);
        expect(section?.getAttribute("data-section-type")).toBe("main-section");
        expect(section?.querySelector('[data-custom-role="heading"]')).not.toBeNull();
      }
      expect(document.querySelector(`[data-resume-metadata-grid="${metadataLayout}"]`)).not.toBeNull();
      expect(document.querySelector('[data-resume-sidebar-side="right"]')?.getAttribute("style")).toContain("65fr) minmax(0, 35fr)");
      expect(document.querySelector(`${sidebarSelector}`)?.getAttribute("style")).toContain("#f2f3f4");
      expect(document.querySelector(`${mainSelector}`)?.getAttribute("style")).toContain("#fafafa");
      expect(document.querySelector(`${mainSelector} [data-resume-closing]`)?.textContent).toContain("Berlin");
      // Zweispaltig prints the date of the application, as `Ort, DD.MM.YYYY`, not the date typed into the profile.
      expect(document.querySelector(`${mainSelector} [data-resume-closing]`)?.textContent).toContain(`Berlin, ${formatApplicationDate(application)}`);
    }
  });
  it("renders the visual 62/38 composition and optional photo", () => {
    const markup = renderResume();

    expect(markup).toContain('data-renderer="visual"');
    expect(markup).toContain("zweispaltig-columns");
    expect(markup).toContain("zweispaltig-sidebar");
    expect(markup).toContain("zweispaltig-header__photo");
    expect(markup).toContain("Auf die Stelle zugeschnitten");
    expect(markup).toContain("Beispiel GmbH");
    expect(markup).not.toContain("Zukunft AG");
    const mainStart = markup.indexOf('class="zweispaltig-main"');
    const sidebarStart = markup.indexOf('class="zweispaltig-sidebar"');
    expect(markup.slice(mainStart, sidebarStart)).not.toContain(
      "Auf die Stelle zugeschnitten",
    );
    expect(markup.slice(sidebarStart)).toContain(
      "Auf die Stelle zugeschnitten",
    );
  });

  it("shows only the professional title in the header, with skills in Kenntnisse", () => {
    const { document } = parseHTML(renderResume({ plan: singlePagePlan, totalPages: 1 }));
    expect(document.querySelector(".zweispaltig-header h2")?.textContent).toBe(profile.title);
    expect(document.querySelector(".zweispaltig-header")?.textContent).not.toContain("TypeScript");
    expect(document.querySelector(".zweispaltig-sidebar")?.textContent).toContain("TypeScript");
  });

  it("does not invent a photo placeholder", () => {
    const markup = renderResume({ photoSource: null });

    expect(markup).toContain("zweispaltig-sidebar");
    expect(markup).not.toContain("zweispaltig-header__photo");
    expect(markup).not.toContain("monogram");
  });

  it("uses a full-width continuation without repeated summary or sidebar", () => {
    const first = renderResume({ plan: firstPagePlan });
    const markup = renderResume({ plan: secondPagePlan });
    const firstHeader = parseHTML(first).document.querySelector(".zweispaltig-header");
    const secondHeader = parseHTML(markup).document.querySelector(".zweispaltig-header");

    expect(markup).toContain('data-continuation="true"');
    expect(secondHeader?.outerHTML).toBe(firstHeader?.outerHTML);
    expect(secondHeader?.querySelector(".zweispaltig-header__photo")).not.toBeNull();
    expect(secondHeader?.textContent).toContain(profile.email);
    expect(secondHeader?.textContent).toContain(profile.phone);
    expect(markup).toContain("zweispaltig-columns--continuation");
    expect(markup).toContain("Zukunft AG");
    expect(markup).toContain("Beispiel Universität");
    expect(markup).not.toContain("Beispiel GmbH");
    expect(markup).not.toContain("zweispaltig-sidebar");
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

    expect(markup).toContain('data-renderer="ats"');
    expect(markup).not.toContain("zweispaltig-sidebar");
    expect(markup).not.toContain("zweispaltig-header__photo");
    expect(summaryIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeLessThan(experienceIndex);
    expect(experienceIndex).toBeLessThan(educationIndex);
    expect(educationIndex).toBeLessThan(knowledgeIndex);
    expect(knowledgeIndex).toBeLessThan(languagesIndex);
    expect(languagesIndex).toBeLessThan(strengthsIndex);
  });

  it("applies a saved live-preview order and column placement", () => {
    const reorderedProfile = profileSchema.parse({
      ...profile,
      resumeSectionLayouts: {
        zweispaltig: [
          { type: "education", zone: "main" },
          { type: "experience", zone: "main" },
          { type: "summary", zone: "sidebar" },
          { type: "languages", zone: "sidebar" },
          { type: "strengths", zone: "sidebar" },
          { type: "knowledge", zone: "sidebar" },
          { type: "certifications", zone: "sidebar" },
        ],
      },
    });
    const markup = renderResume({
      plan: singlePagePlan,
      totalPages: 1,
      profileOverride: reorderedProfile,
    });
    const mainStart = markup.indexOf('class="zweispaltig-main"');
    const sidebarStart = markup.indexOf('class="zweispaltig-sidebar"');

    expect(markup.indexOf("Bildungsweg", mainStart)).toBeLessThan(
      markup.indexOf("Beruflicher Werdegang", mainStart),
    );
    expect(markup.indexOf("Kurzprofil", sidebarStart)).toBeGreaterThan(
      sidebarStart,
    );
  });

  it("escapes user-provided summary markup", () => {
    const markup = renderResume({
      resumeProfile: '<img src=x onerror="alert(1)">',
    });

    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img src=x");
  });

  it("registers the matching template capabilities and defaults", () => {
    expect(getTemplate("zweispaltig")).toMatchObject({
      id: "zweispaltig",
      layout: "split-clean",
      accent: "#0B3D86",
      secondary: "#58B5F7",
      supportsAtsMode: true,
      supportsPhoto: true,
      supportsFreeform: true,
      supportsMultiplePages: true,
      sidebarWidthRatio: 0.38,
      designDefaults: {
        marginLevel: 3,
        sectionSpacingLevel: 3,
        fontSize: "small",
        lineHeightLevel: 2,
        columnLayout: "template",
        fontId: "source-sans",
      },
    });
  });
});
