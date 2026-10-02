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
import { pehlioneAppearanceCss } from "../../../../shared/pehlioneAppearance";
import { pehlioneHeroCss } from "../../../../shared/pehlioneHero";
import { readFileSync } from "node:fs";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";

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

/** The Pehlione continuation header is the first-page header plus its marker and the contact line of page one (contacts stand in the sidebar there). */
const withoutContinuationAdditions = (header: Element | null | undefined) => {
  const clone = header?.cloneNode(true) as Element | undefined;
  clone?.removeAttribute("data-pehlione-continuation-header");
  clone?.querySelector("[data-resume-header-extra-contact]")?.remove();
  return clone?.outerHTML;
};

describe("Pehlione White Blue", () => {
  it.each(["pehlione_white", "pehlione_white_blue"] as const)("places Projekt-Highlight after Ausbildung on the final page in preview and PDF for %s", (templateId) => {
    const source = profileSchema.parse({ ...profile,
      experiences: Array.from({ length: 3 }, (_, index) => ({ ...profile.experiences[0], id: crypto.randomUUID(), role: `Position ${index + 1}`,
        achievements: Array.from({ length: 4 }, () => "Technische Prozesse geplant, optimiert und mit dem Team dokumentiert.") })),
      education: Array.from({ length: 4 }, (_, index) => ({ ...profile.education[0], id: crypto.randomUUID(), degree: `Abschluss ${index + 1}` })),
    });
    const settings = getTemplateDocumentDesignDefaults(templateId);
    const template = getTemplate(templateId);
    const resolved = resolveCvDocument({ profile: source, templateId, settings });
    expect(resolved.pagePlan).toHaveLength(2);
    expect(resolved.pagePlan[0].blocks).not.toContain("projects");
    expect(resolved.pagePlan[1].blocks).toContain("projects");
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
      designSettings: settings, documents: {}, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const pdfPages = Array.from(parseHTML(buildDocumentHtml(application, source, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
    expect(pehlioneAppearanceCss).toContain('.pehlione-resume[data-template^="pehlione_"] .pehlione-project,');
    expect(pehlioneAppearanceCss).toContain('.cv-sheet[data-template^="pehlione_"] .pehlione-pdf-project{padding:0;border:0;background:transparent}');
    const previewPages = resolved.pagePlan.map((page) => parseHTML(renderToStaticMarkup(
      <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={page.pageNumber}
        totalPages={2} designSettings={settings} resolvedCv={resolved}>
        <PehlioneResume templateId={templateId} profile={resolved.profile} name="Mina Kaya" atsMode={false}
          plan={page} totalPages={2} accentColor={template.accent} secondaryColor={template.secondary}
          resumeProfile={resolved.summary} sections={resolved.sections} />
      </ManagedResumePreview>,
    )).document);
    for (const [pages, selector] of [[pdfPages, ".pehlione-pdf-project"], [previewPages, ".pehlione-project"]] as const) {
      expect(pages[0].querySelector(selector)).toBeNull();
      const main = pages[1].querySelector(".pehlione-pdf-main,.pehlione-main");
      expect(main?.querySelector(selector)).not.toBeNull();
      const text = main?.textContent ?? "";
      expect(text.indexOf("Bildungsweg")).toBeGreaterThanOrEqual(0);
      expect(text.indexOf("Projekt-Highlight")).toBeGreaterThan(text.indexOf("Bildungsweg"));
      expect(text.split("Projekt-Highlight")).toHaveLength(2);
    }
  });
  it.each(["pehlione_white", "pehlione_white_blue"] as const)("draws Projekt-Highlight on page one when the plan starts it there in preview and PDF for %s", (templateId) => {
    // The career and the project fit on page one, the long list of certificates goes on to page two.
    const source = profileSchema.parse({ ...profile,
      experiences: Array.from({ length: 2 }, (_, index) => ({ ...profile.experiences[0], id: crypto.randomUUID(), role: `Position ${index + 1}`,
        achievements: Array.from({ length: 2 }, () => "Technische Prozesse geplant, optimiert und mit dem Team dokumentiert.") })),
      education: Array.from({ length: 2 }, (_, index) => ({ ...profile.education[0], id: crypto.randomUUID(), degree: `Abschluss ${index + 1}` })),
      certifications: Array.from({ length: 16 }, (_, index) => `Zertifikat ${index + 1}`),
    });
    const settings = getTemplateDocumentDesignDefaults(templateId);
    const template = getTemplate(templateId);
    const resolved = resolveCvDocument({ profile: source, templateId, settings });
    expect(resolved.pagePlan).toHaveLength(2);
    expect(resolved.pagePlan[0].blocks).toContain("projects");
    expect(resolved.pagePlan[1].items).toHaveLength(0);
    expect(resolved.pagePlan[1].blocks).not.toContain("projects");
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
      designSettings: settings, documents: {}, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const pdfPages = Array.from(parseHTML(buildDocumentHtml(application, source, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
    const previewPages = resolved.pagePlan.map((page) => parseHTML(renderToStaticMarkup(
      <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={page.pageNumber}
        totalPages={2} designSettings={settings} resolvedCv={resolved}>
        <PehlioneResume templateId={templateId} profile={resolved.profile} name="Mina Kaya" atsMode={false}
          plan={page} totalPages={2} accentColor={template.accent} secondaryColor={template.secondary}
          resumeProfile={resolved.summary} sections={resolved.sections} />
      </ManagedResumePreview>,
    )).document);
    for (const [pages, selector] of [[pdfPages, ".pehlione-pdf-project"], [previewPages, ".pehlione-project"]] as const) {
      expect(pages[0].querySelectorAll(selector)).toHaveLength(1);
      expect(pages[1].querySelector(selector)).toBeNull();
      // Page two holds no career entry: the “add your career” hint must not appear there.
      const pageText = ("documentElement" in pages[1] ? pages[1].documentElement : pages[1]).textContent ?? "";
      expect(pageText).not.toContain("im Profil ergänzen");
      expect(pages[1].querySelector('[class*="closing"],[data-resume-closing]')).not.toBeNull();
    }
  });
  it.each(["pehlione_white_blue", "pehlione_white"])("keeps ATS continuation full-width and renders languages once in %s", (templateId) => {
    const source = profileSchema.parse({ ...profile, languages: ["Deutsch – C1"],
      experiences: Array.from({ length: 6 }, (_, index) => ({ ...profile.experiences[0], id: crypto.randomUUID(), role: `Position ${index + 1}`,
        achievements: Array.from({ length: 5 }, () => "Technische Prozesse geplant, optimiert und dokumentiert.") })),
      education: Array.from({ length: 3 }, (_, index) => ({ ...profile.education[0], id: crypto.randomUUID(), degree: `Abschluss ${index + 1}` })),
    });
    const settings = { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: "ats" as const };
    const template = getTemplate(templateId);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
      designSettings: settings, documents: {}, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const html = buildDocumentHtml(application, source, "lebenslauf");
    const { document } = parseHTML(html);
    const pages = Array.from(document.querySelectorAll(`.cv-sheet[data-template="${templateId}"]`));
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain(".pehlione-pdf-ats{display:block");
    for (const page of pages) {
      expect(page.querySelector(".pehlione-pdf-ats > .pehlione-pdf-main")).not.toBeNull();
      expect(page.querySelector("aside")).toBeNull();
      expect(page.querySelector(".pehlione-pdf-ats")?.getAttribute("style") ?? "").not.toContain("grid-template-columns");
    }
    expect(pages.some(page => page.querySelector(".pehlione-pdf-main")?.textContent?.includes("Sprachen"))).toBe(true);
    expect(pages.filter(page => page.textContent?.includes("Deutsch – C1"))).toHaveLength(1);
  });
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
      expect(node?.getAttribute("data-cv-zone")).toBe("sidebar");
      // A section that stands in the sidebar is drawn with the sidebar's heading: icon box and label.
      expect(node?.querySelector("h3.cv-heading > .cv-heading__label")).not.toBeNull();
      expect(node?.querySelector("h3.cv-heading > .cv-heading__icon svg")).not.toBeNull();
    }
    expect(document.querySelector(".pehlione-pdf-closing")?.parentElement?.classList.contains("pehlione-pdf-main")).toBe(true);
    expect(document.querySelector(".pehlione-pdf-sidebar .pehlione-pdf-closing")).toBeNull();
    const moved = document.querySelector('.pehlione-pdf-main [data-managed-section="languages"]');
    expect(moved?.getAttribute("data-cv-zone")).toBe("main");
    expect(moved?.querySelector(".cv-heading > .cv-heading__icon svg")).not.toBeNull();
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
      const languagesHeading = sidebar.querySelector('[data-cv-heading="languages"]');
      expect(languagesHeading?.textContent).toBe("Sprachen");
      expect(languagesHeading?.querySelector(".cv-heading__icon svg")).not.toBeNull();
      expect(languagesHeading?.querySelector(".cv-heading__label")).not.toBeNull();
      const competenciesHeading = sidebar.querySelector('[data-cv-heading="strengths"]');
      expect(competenciesHeading?.textContent).toContain("Kernkompetenzen");
      expect(competenciesHeading?.querySelector(".cv-heading__icon svg")).not.toBeNull();
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

  it("shares profile sections, placement and appearance between White preview and PDF", () => {
    const customId = "87000000-0000-4000-8000-000000000001";
    let source = profileSchema.parse({ ...profile, languages: ["Deutsch – C1"],
      specialSections: [{ id: customId, kind: "custom", title: "Projekt-Highlight", isVisible: true,
        contentType: "list", entries: [{ id: crypto.randomUUID(), title: "Profilprojekt" }] }],
    });
    source = moveManagerSection(source, "pehlione_white", "certifications", "sidebar", 0);
    source = moveManagerSection(source, "pehlione_white", `special:${customId}`, "sidebar", 1);
    const settings = { ...defaultDocumentDesign,
      cvOverrides: { colors: { heading: "#112233", sectionHeading: "#334455", divider: "#556677" } },
      resumeAppearance: { sidebarBackgroundColor: "#f2f3f4", sidebarTextColor: "#223344",
        sidebarSectionHeadingColor: "#cc0000", mainBackgroundColor: "#fafafa", photoDecorationColor: "#778899", contactDividerColor: "#aabbcc" },
    };
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId: "pehlione_white", accentColor: "#d9484a", secondaryColor: "#f5f5f5",
      documents: {}, designSettings: settings, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    const resolved = resolveCvDocument({ profile: source, templateId: application.templateId, settings: application.designSettings });
    const preview = renderToStaticMarkup(<ManagedResumePreview profile={resolved.profile} templateId="pehlione_white"
      pageNumber={1} totalPages={1} designSettings={application.designSettings} resolvedCv={resolved}>
      <PehlioneResume templateId="pehlione_white" profile={resolved.profile} name="Mina Kaya" atsMode={false}
        plan={resolved.pagePlan[0]} totalPages={1} accentColor="#d9484a" secondaryColor="#f5f5f5"
        resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>);
    const pdf = buildDocumentHtml(application, source, "lebenslauf");
    for (const [html, sidebarSelector, hostSelector] of [
      [preview, ".pehlione-sidebar", ".pehlione-resume"],
      [pdf, ".pehlione-pdf-sidebar", ".pehlione-pdf"],
    ] as const) {
      const { document } = parseHTML(html);
      const host = document.querySelector(hostSelector)!;
      const sidebar = document.querySelector(sidebarSelector)!;
      expect(host.getAttribute("style")).toContain("--pehlione-sidebar-background:#f2f3f4");
      expect(host.getAttribute("style")).toContain("--pehlione-title-color:#112233");
      expect(host.getAttribute("style")).toContain("--pehlione-contact-divider-color:#aabbcc");
      expect(sidebar.querySelector('[data-managed-section="certifications"]')).not.toBeNull();
      expect(sidebar.querySelector('[data-managed-section="certifications"] h2,[data-managed-section="certifications"] h3')?.getAttribute("style")).toContain("#cc0000");
      expect(sidebar.querySelector('[data-managed-section="certifications"] li')?.getAttribute("style")).toContain("#223344");
      const custom = sidebar.querySelector(`[data-managed-section="special:${customId}"]`);
      expect(custom?.textContent).toContain("Profilprojekt");
      expect(custom?.querySelector('[data-custom-role="heading"] svg')).not.toBeNull();
      expect(custom?.querySelector('[data-custom-role="heading"]')?.getAttribute("style")).toContain("#cc0000");
      expect(document.querySelector('[data-managed-section="experience"]')?.textContent).toContain("Praktikum Softwareentwicklung");
    }
    for (const html of [preview, pdf]) {
      const { document } = parseHTML(html);
      const tag = ":is(h2,h3)";
      for (const id of ["certifications", `special:${customId}`]) {
        const heading = document.querySelector(`[data-managed-section="${id}"] ${tag}`);
        expect(heading?.classList.contains("cv-heading"), id).toBe(true);
        expect(heading?.querySelector(":scope > .cv-heading__icon svg"), id).not.toBeNull();
        expect(heading?.querySelector(":scope > .cv-heading__label"), id).not.toBeNull();
        // The white sidebar draws a bare icon that follows the colour the user gave the sidebar titles.
        expect(heading?.querySelector('.cv-heading__icon[data-cv-icon-style="bare"]'), id).not.toBeNull();
        expect(heading?.querySelector("svg")?.getAttribute("style"), id).toContain("#cc0000");
      }
      expect(document.querySelector(`[data-managed-section="certifications"] ${tag} svg path`)?.getAttribute("d")).toContain("M21.42 10.922");
    }
    const { document } = parseHTML(pdf);
    expect(document.querySelector(".pehlione-pdf-closing")?.parentElement?.classList.contains("pehlione-pdf-main")).toBe(true);
    expect(pehlioneAppearanceCss).toContain('.pehlione-contacts h3 svg{stroke:var(--pehlione-primary,#08245c)}');
    expect(pehlioneAppearanceCss).toContain('h3{border-bottom-color:var(--pehlione-divider-color,var(--pehlione-primary,#08245c))');
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
    expect(render(false, 2)).toContain("pehlione-sidebar--continuation");
    expect(render(false, 2)).toContain("Fortsetzung · Seite 2 von 2");
  });

  it("continues on a sidebar-free page with the same header and keeps the white sidebar title style", () => {
    const longProfile = profileSchema.parse({
      ...profile,
      languages: ["Deutsch – C1"],
      experiences: Array.from({ length: 5 }, (_, index) => ({
        ...profile.experiences[0],
        id: crypto.randomUUID(),
        role: `Position ${index + 1}`,
        achievements: Array.from({ length: 4 }, () => "Messbares Ergebnis mit nachhaltiger Wirkung im Team."),
      })),
      education: Array.from({ length: 4 }, (_, index) => ({
        ...profile.education[0],
        id: crypto.randomUUID(),
        degree: `Abschluss ${index + 1}`,
      })),
    });
    const application = applicationSchema.parse({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      folderName: "Test",
      company: { name: "Firma", city: "Berlin" },
      contact: {},
      job: { title: "Entwicklung" },
      status: "Entwurf",
      templateId: "pehlione_white_blue",
      accentColor: "#0b3d86",
      secondaryColor: "#1f66b3",
      documents: {},
      statusHistory: [],
      createdAt: profile.updatedAt,
      updatedAt: profile.updatedAt,
    });
    const { document } = parseHTML(buildDocumentHtml(application, longProfile, "lebenslauf"));
    const pages = document.querySelectorAll('[data-template="pehlione_white_blue"]');
    expect(pages).toHaveLength(2);
    // Page two carries no idle sidebar but repeats the first-page header.
    expect(pages[1].querySelector(".pehlione-pdf-sidebar-continuation")).toBeNull();
    expect(pages[1].querySelector("aside")).toBeNull();
    expect(pages[1].querySelector(".pehlione-pdf-main")).not.toBeNull();
    expect(pages[1].querySelectorAll("h1")).toHaveLength(1);
    expect(withoutContinuationAdditions(pages[1].querySelector("header"))).toBe(withoutContinuationAdditions(pages[0].querySelector("header")));
    expect(pages[1].querySelector("header")?.textContent).toContain(profile.title);
    expect(document.querySelectorAll(".pehlione-pdf-education")).toHaveLength(1);
    expect(buildDocumentHtml(application, longProfile, "lebenslauf")).toContain(
      ".pehlione-pdf-sidebar .pehlione-pdf-section h3{color:var(--pehlione-sidebar-text,#fff)}",
    );
    expect(pehlioneAppearanceCss).toContain(
      '.pehlione-pdf-main .pehlione-pdf-section>h3{color:var(--pehlione-section-color,var(--pehlione-primary))}',
    );
    expect(pehlioneAppearanceCss).not.toContain(
      '.cv-sheet[data-template^="pehlione_"] .pehlione-pdf-section>h3{color:',
    );
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

describe("Pehlione hero", () => {
  const photoProfile = profileSchema.parse({
    ...profile,
    photoPath: "data:image/png;base64,AA==",
    resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
      section.semanticType === "photo" ? { ...section, visible: true, enabled: true } : section),
  });
  const html = (templateId: "pehlione_white" | "pehlione_white_blue") => {
    const settings = getTemplateDocumentDesignDefaults(templateId);
    const template = getTemplate(templateId);
    const resolved = resolveCvDocument({ profile: photoProfile, templateId, settings });
    const preview = renderToStaticMarkup(
      <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={1} totalPages={resolved.pagePlan.length}
        designSettings={settings} resolvedCv={resolved}>
        <PehlioneResume templateId={templateId} profile={resolved.profile} name="Mina Kaya" atsMode={false} plan={resolved.pagePlan[0]}
          totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
          resumeProfile={resolved.summary} sections={resolved.sections} />
      </ManagedResumePreview>,
    );
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Firma", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" },
      status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
      designSettings: settings, documents: {}, statusHistory: [], createdAt: profile.updatedAt, updatedAt: profile.updatedAt,
    });
    return { preview, pdf: buildDocumentHtml(application, resolved.profile, "lebenslauf") };
  };
  /** Rules of a stylesheet whose selector names the hero, its photo or its artwork. */
  const heroRules = (css: string) =>
    Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
      .filter(([, selector]) => /pehlione-(pdf-)?(hero|blueprint|photo)|pehlione-hero__photo/.test(selector))
      .map(([, selector, declarations]) => ({ selector: selector.trim(), declarations }));

  it.each(["pehlione_white", "pehlione_white_blue"] as const)("centres photo and artwork from one shared block in the preview and the PDF of %s", (templateId) => {
    const { preview, pdf } = html(templateId);
    expect(preview).toContain(pehlioneHeroCss);
    expect(pdf).toContain(pehlioneHeroCss);
    expect(preview).toContain("pehlione-hero__photo");
    expect(pdf).toContain("pehlione-pdf-photo");
    expect(templateId === "pehlione_white" ? preview : pdf).toContain(templateId === "pehlione_white" ? "pehlione-blueprint" : "pehlione-pdf-hero");
  });

  it("keeps fixed top/left offsets out of every stylesheet of the hero", () => {
    // Vitest treats CSS imports as empty modules, so the preview stylesheets are read from disk.
    const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
    const stylesheets = { preview: source("./pehlione.css") + source("./pehlione-white.css"), pdf: html("pehlione_white_blue").pdf.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "" };
    for (const [surface, css] of Object.entries(stylesheets)) {
      const rules = heroRules(css);
      expect(rules.length, surface).toBeGreaterThan(0);
      for (const { selector, declarations } of rules) expect(declarations, `${surface}: ${selector}`).not.toMatch(/(^|[;\s])(top|left):\s*-?[0-9.]+mm/);
    }
  });
});
