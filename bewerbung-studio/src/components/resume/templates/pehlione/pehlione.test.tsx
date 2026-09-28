import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { profileSchema } from "../../../../shared/schema";
import { resolveResumeSectionInstances } from "../../../../features/resume-sections/resume-section-system";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { PehlioneResume } from "./PehlioneResume";
import { getTemplate, templates } from "../../../../shared/templates";
import { getTemplateKnowledgeSlots } from "../../../../features/resume-sections/knowledge-block-registry";
import { parseHTML } from "linkedom";
import { applicationSchema } from "../../../../shared/schema";
import { defaultDocumentDesign } from "../../../../shared/documentDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";

const experienceId = "81000000-0000-4000-8000-000000000001";
const educationId = "82000000-0000-4000-8000-000000000001";
const profile = profileSchema.parse({
  id: "83000000-0000-4000-8000-000000000001",
  isDefault: true,
  firstName: "Mina",
  lastName: "Kaya",
  title: "Software Developer",
  city: "Marburg",
  country: "Deutschland",
  phone: "+49 176 123456",
  email: "mina@example.com",
  linkedin: "linkedin.com/in/mina",
  summary: "Strukturiert arbeitende Entwicklerin mit technischem Verständnis.",
  strengths: [{ id: "84000000-0000-4000-8000-000000000001", title: "API-Integration", description: "Robuste Schnittstellen", iconId: "" }],
  skills: ["TypeScript", "Golang", "Grafana"],
  experiences: [{
    id: experienceId,
    from: "11/2024",
    to: "06/2025",
    role: "Praktikum Softwareentwicklung",
    company: "Universitätsstadt Marburg",
    city: "Marburg",
    projects: ["Grafana Datasource Plugin für PRTG"],
    technologies: ["Go", "Grafana", "PRTG"],
    achievements: ["Monitoring-Daten über eine sichere API integriert."],
  }],
  education: [{
    id: educationId,
    from: "2022",
    to: "2025",
    degree: "Fachinformatiker für Anwendungsentwicklung",
    institution: "IHK Kassel-Marburg",
    city: "Marburg",
  }],
  certifications: ["IBM Full Stack JavaScript"],
  updatedAt: "2026-09-21T12:00:00.000Z",
});

const plan: ResumePagePlan = {
  pageNumber: 1,
  density: "standard",
  items: [
    { kind: "experience", id: experienceId, weight: 5 },
    { kind: "education", id: educationId, weight: 3 },
  ],
};

describe("Pehlione White Blue", () => {
  it("keeps moved sidebar sections to one rule and the PDF closing in the main column", () => {
    let arranged = moveManagerSection(profileSchema.parse({ ...profile, languages: ["Deutsch – C1"] }), "pehlione_white_blue", "summary", "sidebar", 0);
    arranged = moveManagerSection(arranged, "pehlione_white_blue", "certifications", "sidebar", 1);
    arranged = moveManagerSection(arranged, "pehlione_white_blue", "languages", "main", 2);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId: "pehlione_white_blue", accentColor: "#0b3d86", secondaryColor: "#1f66b3",
      documents: {}, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const { document } = parseHTML(buildDocumentHtml(application, arranged, "lebenslauf"));
    for (const id of ["summary", "certifications"]) {
      const node = document.querySelector(`.pehlione-pdf-sidebar [data-managed-section="${id}"]`);
      expect(node).not.toBeNull();
      expect(node?.querySelector("h3>span")).not.toBeNull();
    }
    expect(document.querySelector(".pehlione-pdf-closing")?.parentElement?.classList.contains("pehlione-pdf-main")).toBe(true);
    expect(document.querySelector(".pehlione-pdf-sidebar .pehlione-pdf-closing")).toBeNull();
    expect(document.querySelector('.pehlione-pdf-main [data-managed-section="languages"] .pehlione-pdf-language-heading svg')).not.toBeNull();
  });
  it("keeps profile data, career rows, custom sections and appearance in preview and PDF", () => {
    const projectId = "85000000-0000-4000-8000-000000000001";
    const hobbyId = "86000000-0000-4000-8000-000000000001";
    const source = profileSchema.parse({ ...profile, title: "", languages: ["Deutsch – C1"], experiences: [{ ...profile.experiences[0], role: "Praktikum als Anwendungsentwickler" }],
      specialSections: [
        { id: projectId, kind: "custom", title: "Projekt-Highlight", isVisible: true, contentType: "list", entries: [{ id: crypto.randomUUID(), title: "oiözio" }] },
        { id: hobbyId, kind: "interests", title: "Hobbys & Interesses", isVisible: true, contentType: "text", entries: [{ id: crypto.randomUUID(), title: "demo" }] },
      ],
    });
    const settings = { ...defaultDocumentDesign,
      cvOverrides: { colors: { heading: "#112233", subheading: "#223344", sectionHeading: "#334455", divider: "#445566" } },
      resumeAppearance: { sidebarBackgroundColor: "#556677", sidebarTextColor: "#101010", sidebarSectionHeadingColor: "#cc0000", mainBackgroundColor: "#f5f6f7",
        sectionDividerVisible: false, photoDecorationVisible: false, contactDividerColor: "#aabbcc" },
    };
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Unrelated Job" },
      status: "Entwurf", templateId: "pehlione_white_blue", accentColor: "#0b3d86", secondaryColor: "#1f66b3",
      documents: {}, designSettings: settings, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const resolved = resolveCvDocument({ profile: source, templateId: application.templateId, settings: application.designSettings });
    const preview = renderToStaticMarkup(<ManagedResumePreview profile={resolved.profile} templateId="pehlione_white_blue"
      pageNumber={1} totalPages={1} designSettings={application.designSettings} resolvedCv={resolved}>
      <PehlioneResume templateId="pehlione_white_blue" profile={resolved.profile} name="Mina Kaya" atsMode={false}
        plan={resolved.pagePlan[0]} totalPages={1} accentColor="#0b3d86" secondaryColor="#1f66b3"
        resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>);
    const pdf = buildDocumentHtml(application, source, "lebenslauf");
    for (const [html, entrySelector, hostSelector] of [
      [preview, ".pehlione-career-entry", ".pehlione-resume"],
      [pdf, ".pehlione-pdf-entry", ".pehlione-pdf"],
    ] as const) {
      const { document } = parseHTML(html);
      const entry = document.querySelector(entrySelector)!;
      expect(entry.querySelector("h3,h4")?.textContent).toBe("Praktikum als Anwendungsentwickler");
      expect(entry.querySelector('[class$="__meta"]')?.textContent).toContain("11/2024 – 06/2025");
      expect(entry.querySelector('[class$="__meta"]')?.textContent).toContain("Marburg");
      expect(entry.querySelector("strong,.pehlione-career-entry__organisation")?.textContent).toBe("Universitätsstadt Marburg");
      expect(document.querySelectorAll(`[data-managed-section="special:${projectId}"]`)).toHaveLength(1);
      expect(document.querySelectorAll(`[data-managed-section="special:${hobbyId}"]`)).toHaveLength(1);
      expect(document.querySelector(`[data-managed-section="special:${projectId}"]`)?.textContent).toContain("oiözio");
      expect(document.querySelector(`[data-managed-section="special:${hobbyId}"]`)?.textContent).toContain("demo");
      expect(document.querySelectorAll('[data-managed-section="projects"]')).toHaveLength(0);
      const host = document.querySelector(hostSelector)!;
      expect(host.getAttribute("style")).toContain("--pehlione-sidebar-background:#556677");
      expect(host.getAttribute("style")).toContain("--pehlione-sidebar-text:#101010");
      const sidebar = host.querySelector(".pehlione-sidebar,.pehlione-pdf-sidebar")!;
      for (const title of ["Kernkompetenzen", "Sprachen"]) {
        const heading = Array.from(sidebar.querySelectorAll("h2,h3")).find(node => node.textContent?.includes(title));
        expect(heading?.getAttribute("style")).toContain("color:#cc0000");
      }
      const languagesHeading = sidebar.querySelector(".pehlione-language-heading,.pehlione-pdf-language-heading");
      expect(languagesHeading?.textContent).toBe("Sprachen");
      expect(languagesHeading?.querySelector("svg")).not.toBeNull();
      expect(languagesHeading?.querySelector("span")).not.toBeNull();
      const competenciesHeading = sidebar.querySelector(".pehlione-competencies-heading,.pehlione-pdf-competencies-heading");
      expect(competenciesHeading?.textContent).toContain("Kernkompetenzen");
      expect(competenciesHeading?.querySelector("svg")).not.toBeNull();
      expect(host.getAttribute("style")).toContain("--pehlione-title-color:#112233");
      expect(host.getAttribute("style")).toContain("--pehlione-contact-divider-color:#aabbcc");
      expect(host.getAttribute("data-section-divider")).toBe("hidden");
      expect(host.getAttribute("data-photo-decoration")).toBe("hidden");
      expect(document.querySelector(`${hostSelector} header h2`)).toBeNull();
    }
  });
  it("offers a separate white variant with the technical sidebar and existing content", () => {
    const template = getTemplate("pehlione_white");
    expect(templates).toContainEqual(template);
    expect(template.name).toBe("Pehlione White");
    expect(template.supportsPhoto).toBe(true);
    expect(getTemplateKnowledgeSlots(template.id).map((slot) => slot.id)).toContain("sidebar");
    const html = renderToStaticMarkup(
      <PehlioneResume templateId="pehlione_white" profile={{ ...profile, github: "github.com/mina", portfolio: "mina.example.com" }} name="Mina Kaya"
        atsMode={false} plan={plan} totalPages={1} accentColor={template.accent}
        secondaryColor={template.secondary} resumeProfile="" sections={profile.resumeSections} />,
    );
    expect(html).toContain("pehlione-resume--white");
    expect(html).toContain("pehlione-blueprint");
    expect(html).toContain('data-contact-icon="github"');
    expect(html).toContain('data-contact-icon="website"');
    expect(html).toContain("<strong>Telefon</strong>");
    expect(html).toContain("Kernkompetenzen");
    expect(html).toContain("Technische Schwerpunkte");
    expect(html).toContain("Grafana Datasource Plugin für PRTG");
  });

  it("groups the signature above the printed name beside place and date", () => {
    const signedProfile = profileSchema.parse({
      ...profile,
      applicationPlace: "Marburg",
      applicationDate: "22.09.2026",
      signaturePath: "data:image/png;base64,AA==",
    });
    const html = renderToStaticMarkup(
      <PehlioneResume
        profile={signedProfile}
        name="Mina Kaya"
        atsMode={false}
        plan={plan}
        totalPages={1}
        accentColor="#0B3D86"
        secondaryColor="#1F66B3"
        resumeProfile=""
        sections={signedProfile.resumeSections}
      />,
    );

    expect(html).toContain("<p>Marburg, 22.09.2026</p>");
    expect(html).toContain('<div class="pehlione-closing__signer"><img');
    expect(html).toContain('alt="Unterschrift"/><strong>Mina Kaya</strong></div>');
  });

  it("shows an enabled photo over the hero circle only on the first visual page", () => {
    const photoProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,AA==",
      resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
        section.semanticType === "photo"
          ? { ...section, visible: true, enabled: true }
          : section,
      ),
    });
    const render = (atsMode: boolean, pageNumber: 1 | 2) => renderToStaticMarkup(
      <PehlioneResume
        profile={photoProfile}
        name="Mina Kaya"
        atsMode={atsMode}
        plan={{ ...plan, pageNumber }}
        totalPages={2}
        accentColor="#0B3D86"
        secondaryColor="#1F66B3"
        resumeProfile=""
        sections={photoProfile.resumeSections}
      />,
    );

    expect(render(false, 1)).toContain('class="pehlione-hero__photo"');
    expect(render(false, 1)).toContain('src="data:image/png;base64,AA=="');
    expect(render(true, 1)).not.toContain("pehlione-hero__photo");
    expect(render(false, 2)).not.toContain("pehlione-hero__photo");
  });

  it("keeps the original circle when the photo section is hidden", () => {
    const html = renderToStaticMarkup(
      <PehlioneResume
        profile={{ ...profile, photoPath: "data:image/png;base64,AA==" }}
        name="Mina Kaya"
        atsMode={false}
        plan={plan}
        totalPages={1}
        accentColor="#0B3D86"
        secondaryColor="#1F66B3"
        resumeProfile=""
        sections={profile.resumeSections}
      />,
    );
    expect(html).not.toContain("pehlione-hero__photo");
    expect(html).toContain("◉");
  });

  it("renders the technical sidebar and structured main content", () => {
    const html = renderToStaticMarkup(
      <PehlioneResume
        profile={profile}
        name="Mina Kaya"
        atsMode={false}
        plan={plan}
        totalPages={1}
        accentColor="#0B3D86"
        secondaryColor="#1F66B3"
        resumeProfile=""
        sections={profile.resumeSections}
      />,
    );

    expect(html).toContain("pehlione-sidebar");
    expect(html).toContain("Technische Schwerpunkte");
    expect(html).toContain("Projekt-Highlight");
    expect(html).toContain("Grafana Datasource Plugin für PRTG");
  });

  it("keeps the reading order text-first in ATS mode", () => {
    const html = renderToStaticMarkup(
      <PehlioneResume
        profile={profile}
        name="Mina Kaya"
        atsMode
        plan={plan}
        totalPages={1}
        accentColor="#0B3D86"
        secondaryColor="#1F66B3"
        resumeProfile=""
        sections={profile.resumeSections}
      />,
    );

    expect(parseHTML(html).document.querySelector(".pehlione-sidebar")).toBeNull();
    expect(html).toContain("Kontakt:");
    expect(html).toContain("Praktikum Softwareentwicklung");
  });
});
