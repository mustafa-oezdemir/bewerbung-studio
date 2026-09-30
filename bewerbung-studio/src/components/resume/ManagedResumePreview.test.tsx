import { createElement, type ComponentType } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { defaultDocumentDesign } from "../../shared/documentDesign";
import { buildDocumentHtml } from "../../../electron/documents";
import { createResumePagePlan } from "../../shared/documentPagination";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { formatApplicationDateIso } from "../../shared/applicationDate";
import { moveManagerSection, updateManagerSection } from "../../features/resume-sections/resume-manager";
import { resolveResumePresentation } from "../../shared/resumePresentation";
import { ManagedResumePreview } from "./ManagedResumePreview";
import { ElegantResume } from "./templates/elegant";
import { EinspaltigResume } from "./templates/einspaltig";
import { GepflegtResume } from "./templates/gepflegt";
import { KlassischResume } from "./templates/klassisch";
import { KompaktResume } from "./templates/kompakt";
import { KreativResume } from "./templates/kreativ";
import { IvyLeagueResume } from "./templates/ivy-league";
import { ModernResume } from "./templates/modern";
import { PehlioneResume } from "./templates/pehlione";
import { StilvollResume } from "./templates/stilvoll";
import { TabellarischResume } from "./templates/tabellarisch";
import { ZeitgenoessischResume } from "./templates/zeitgenoessisch";
import { ZweispaltigResume } from "./templates/zweispaltig";
const components = {
  "elegant": ElegantResume,
  "einspaltig": EinspaltigResume,
  "gepflegt": GepflegtResume,
  "klassisch": KlassischResume,
  "kompakt": KompaktResume,
  "kreativ": KreativResume,
  "ivy-league": IvyLeagueResume,
  "modern": ModernResume,
  "pehlione_white": PehlioneResume,
  "pehlione_white_blue": PehlioneResume,
  "stilvoll": StilvollResume,
  "tabellarisch": TabellarischResume,
  "zeitgenoessisch": ZeitgenoessischResume,
  "zweispaltig": ZweispaltigResume
};
describe("managed template previews", () => {
  it.each(Object.entries(components))("normalizes custom content equally in preview and PDF for %s", (templateId, component) => {
    const now = new Date().toISOString();
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      specialSections: ["text", "list", "entries", "skills", "timeline"].map((contentType, index) => ({
        id: crypto.randomUUID(), kind: "custom", title: index === 0 ? "Projekt-Highlight" : "Gleicher Titel", contentType,
        entries: [{ id: crypto.randomUUID(), title: `Inhalt ${index}`, description: "Beschreibung", bullets: ["Detail"] }],
      })),
    });
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name: "Mina Kaya", atsMode: false, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "white" });
    const preview = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567", documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
    const outputs = [preview, buildDocumentHtml(application, profile, "lebenslauf")].map(html => parseHTML(html).document);
    for (const document of outputs) expect(document.querySelector("[data-resume-spacing-entry-gap]")).toBeNull();
    for (const section of profile.specialSections) {
      const selector = `[data-managed-section="special:${section.id}"]`;
      for (const document of outputs) {
        expect(document.querySelectorAll(selector)).toHaveLength(1);
        const node = document.querySelector(selector)!;
        expect(node.getAttribute("data-section-type")).toBe("main-section");
        expect(node.querySelector("[data-content-type]")?.getAttribute("data-content-type")).toBe(section.contentType);
        expect(node.querySelectorAll('[data-section-type="subsection"]')).toHaveLength(["entries", "timeline"].includes(section.contentType!) ? 1 : 0);
      }
      const semanticContent = (document: Document) => Array.from(document.querySelectorAll(`${selector} [data-content-type] [data-custom-role]`))
        .map(node => [node.getAttribute("data-custom-role"), node.getAttribute("data-section-type"), node.textContent]);
      expect(semanticContent(outputs[0])).toEqual(semanticContent(outputs[1]));
    }
  });
  it("keeps only the lower Einspaltig section rule in preview and PDF, including custom sections", () => {
    const now = new Date().toISOString();
    const profile = profileSchema.parse({
      id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      summary: "Profiltext", strengths: [{ id: crypto.randomUUID(), title: "Teamarbeit", iconId: "symbol:check" }],
      experiences: [{ id: crypto.randomUUID(), from: "2021", to: "2024", role: "Entwicklerin", company: "Beispiel", achievements: [] }],
      education: [{ id: crypto.randomUUID(), from: "2018", to: "2021", degree: "B.Sc.", institution: "Hochschule" }],
      languages: ["Deutsch"], certifications: ["Zertifikat"],
      specialSections: [{ id: "bbbb0000-0000-4000-8000-000000000000", kind: "volunteer", title: "Ehrenamt", isVisible: true, entries: [{ id: crypto.randomUUID(), title: "Vereinsarbeit" }] }],
    });
    const plan = createResumePagePlan(profile, "", {}, "einspaltig")[0];
    const child = createElement(EinspaltigResume, { profile, name: "Mina Kaya", atsMode: false, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "white" });
    const preview = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId="einspaltig" pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "einspaltig", accentColor: "#123456", documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
    const pdf = buildDocumentHtml(application, profile, "lebenslauf");
    const expected = ["Zusammenfassung", "Stärken", "Berufserfahrung", "Ausbildung", "Sprachen", "Zertifikate", "Ehrenamt"];
    for (const [html, selector] of [[preview, ".einfach-section__title, .einfach-template .managed-extra > h3"], [pdf, ".managed-pdf-title, .einfach-pdf .managed-extra > h3"]] as const) {
      const { document } = parseHTML(html);
      const headings = Array.from(document.querySelectorAll(`${selector}, [data-custom-role="heading"]`)).map((heading) => heading.textContent?.trim());
      for (const title of expected) expect(headings).toContain(title);
      expect(document.querySelector('[data-managed-section="special:bbbb0000-0000-4000-8000-000000000000"]')).not.toBeNull();
    }
    const previewCss = readFileSync(new URL("./templates/einspaltig/einfach.css", import.meta.url), "utf8");
    const previewTitleRule = previewCss.match(/\.einfach-section__title,\s*\.einfach-template \.managed-extra > h3\s*\{([^}]+)\}/)?.[1];
    const pdfTitleRule = pdf.match(/\.einfach-pdf \.managed-pdf-title,\.einfach-pdf \.managed-extra>h3\{([^}]+)\}/)?.[1];
    for (const rule of [previewTitleRule, pdfTitleRule]) {
      expect(rule).toBeDefined();
      expect(rule).toMatch(/border-top:\s*0\s*;/);
      expect(rule).toMatch(/border-bottom:\s*0?\.3mm solid/);
      expect(rule).not.toMatch(/border-block/);
    }
    expect(previewCss).toMatch(/\.einfach-career article\s*\{[^}]*border-bottom:\s*[^;]*dashed/);
    expect(pdf).toMatch(/\.einfach-pdf-entry\{[^}]*border-bottom:\s*[^;]*dashed/);
  });
  it.each(Object.entries(components))("matches preview and PDF section columns in %s", (templateId, component) => {
    const now = new Date().toISOString();
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      strengths: Array.from({ length: 10 }, (_, i) => ({ id: crypto.randomUUID(), title: `Stärke ${i + 1}`, iconId: "symbol:check" })), skills: ["Java", "Go", "Docker"] });
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    for (const columns of ["auto", 1, 2, 3, 4] as const) {
      const settings = { ...defaultDocumentDesign, strengthsColumns: columns, knowledgeColumns: columns };
      const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name: "Mina Kaya", atsMode: false, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "none" });
      const preview = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1} designSettings={settings}>{child}</ManagedResumePreview>);
      const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", documents: {}, statusHistory: [], createdAt: now, updatedAt: now, designSettings: settings });
      const pdf = buildDocumentHtml(application, profile, "lebenslauf");
      const previewDocument = parseHTML(preview).document;
      const pdfDocument = parseHTML(pdf).document;
      for (const selector of [".managed-strengths-grid", '[data-managed-section="knowledge"] .managed-item-grid']) {
        const expected = previewDocument.querySelector(selector)?.getAttribute("data-columns");
        expect(expected).toBeDefined();
        expect(pdfDocument.querySelector(selector)?.getAttribute("data-columns")).toBe(expected);
        if (columns !== "auto") expect(expected).toBe(String(columns));
      }
    }
  });
  it.each(Object.entries(components))("renders all nine strengths in order in %s", (templateId, component) => {
    const strengths = ["Go", "React", "Spring Boot", "SQL", "Docker", "Git", "Linux", "Java", "TypeScript"].map((title, index) => ({ id: crypto.randomUUID(), title, description: index === 0 ? "Echo, Gin\nREST" : "", iconId: index === 1 ? "symbol:check" : "" }));
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(), strengths });
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    for (const atsMode of [false, true]) {
      const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name: "Mina Kaya", atsMode, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "none" });
      const html = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
      const { document } = parseHTML(html);
      expect(document.querySelectorAll(".managed-strengths-grid")).toHaveLength(1);
      expect(Array.from(document.querySelectorAll(".managed-strength-card strong")).map((node) => node.textContent)).toEqual(strengths.map((item) => item.title));
      expect(document.querySelector(".managed-strength-card p")?.textContent).toBe("Echo, Gin\nREST");
      if (!atsMode) {
        const now = new Date().toISOString();
        const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
          job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567", documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
        const pdf = parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document;
        for (const output of [document, pdf]) {
          const cards = Array.from(output.querySelectorAll(".managed-strength-card"));
          const icon = (title: string) => cards.find(card => card.querySelector("strong")?.textContent === title)?.querySelector("svg");
          expect(icon("Go")?.getAttribute("data-brand"), templateId).toBe("go");
          expect(icon("Spring Boot")?.getAttribute("data-brand"), templateId).toBe("devicon:spring");
          expect(icon("Docker")?.getAttribute("data-brand"), templateId).toBe("devicon:docker");
          expect(icon("Git")?.getAttribute("data-brand"), templateId).toBe("devicon:git");
          expect(icon("React")?.getAttribute("data-strength-symbol"), templateId).toBe("symbol:check");
        }
      }
    }
  });
  it.each(Object.entries(components))("moves native sections and retains one custom section in %s", (templateId, component) => {
    let profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", summary: "Profiltext", updatedAt: new Date().toISOString(),
      experiences: [{id:crypto.randomUUID(),from:"2020",to:"2024",role:"Entwicklerin",company:"Arbeitgeber",achievements:[]}],
      education: [{id:crypto.randomUUID(),from:"2018",to:"2020",degree:"Abschluss",institution:"Schule"}],
      specialSections: [{id:"bbbb0000-0000-4000-8000-000000000000",kind:"volunteer",title:"Ehrenamt",isVisible:true,entries:[{id:crypto.randomUUID(),title:"Vereinsarbeit"}]}]
    });
    profile = moveManagerSection(profile, templateId, "education", "main", 0);
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name:"Mina Kaya",atsMode:false,plan,totalPages:1,accentColor:"#123456",secondaryColor:"#234567",photoSource:null,resumeProfile:"",sections:profile.resumeSections,backgroundId:"none" });
    const html = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
    const {document} = parseHTML(html);
    const education = document.querySelector('[data-managed-section="education"]');
    const experience = document.querySelector('[data-managed-section="experience"]');
    expect(education).not.toBeNull(); expect(experience).not.toBeNull();
    expect(education!.parentElement).toBe(experience!.parentElement);
    const siblings = Array.from(education!.parentElement!.children);
    expect(siblings.indexOf(education!)).toBeLessThan(siblings.indexOf(experience!));
    expect(document.querySelectorAll('[data-managed-section="special:bbbb0000-0000-4000-8000-000000000000"]')).toHaveLength(1);
  });
  it.each(Object.entries(components))("applies section placement and visibility equally in preview and PDF for %s", (templateId, component) => {
    const now = new Date().toISOString();
    let profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      summary: "Profiltext", strengths: [{ id: crypto.randomUUID(), title: "Teamarbeit" }],
      experiences: [{ id: crypto.randomUUID(), from: "2020", to: "2024", role: "Entwicklerin", company: "Arbeitgeber", achievements: [] }],
      education: [{ id: crypto.randomUUID(), from: "2018", to: "2020", degree: "Abschluss", institution: "Schule" }],
      specialSections: [{ id: "bbbb0000-0000-4000-8000-000000000000", kind: "custom", title: "Projekt-Highlight", isVisible: true,
        entries: [{ id: crypto.randomUUID(), title: "Projekt" }] }],
    });
    profile = moveManagerSection(profile, templateId, "summary", "sidebar", 0);
    profile = moveManagerSection(profile, templateId, "experience", "main", 0);
    profile = moveManagerSection(profile, templateId, "special:bbbb0000-0000-4000-8000-000000000000", "main", 1);
    profile = updateManagerSection(profile, templateId, "education", { visible: false });
    const settings = { ...defaultDocumentDesign, resumePresentation: { layoutMode: "two-column" as const } };
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, {
      profile, templateId, name: "Mina Kaya", atsMode: false, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567",
      photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "none",
    });
    const preview = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1} designSettings={settings}>{child}</ManagedResumePreview>);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
      job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567",
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now, designSettings: settings });
    for (const html of [preview, buildDocumentHtml(application, profile, "lebenslauf")]) {
      const { document } = parseHTML(html);
      const summary = document.querySelector('[data-managed-section="summary"]');
      const experience = document.querySelector('[data-managed-section="experience"]');
      const project = document.querySelector('[data-managed-section="special:bbbb0000-0000-4000-8000-000000000000"]');
      expect(summary, templateId).not.toBeNull();
      expect(experience, templateId).not.toBeNull();
      expect(project, templateId).not.toBeNull();
      const host = document.querySelector('[data-resume-layout="two-column"]')!;
      const zone = (node: Element) => {
        let current = node;
        while (current.parentElement && current.parentElement !== host) current = current.parentElement;
        return current;
      };
      expect(zone(summary!), templateId).not.toBe(zone(experience!));
      expect(zone(project!), templateId).toBe(zone(experience!));
      expect(document.querySelector('[data-managed-section="education"]'), templateId).toBeNull();
    }
  });
  it("stacks main sections before sidebar sections in a customized single-column CV", () => {
    const now = new Date().toISOString();
    let profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      summary: "Profiltext", experiences: [{ id: crypto.randomUUID(), from: "2020", to: "2024", role: "Entwicklerin", company: "Arbeitgeber", achievements: [] }],
    });
    profile = moveManagerSection(profile, "einspaltig", "experience", "main", 0);
    profile = moveManagerSection(profile, "einspaltig", "summary", "sidebar", 0);
    const plan = createResumePagePlan(profile, "", {}, "einspaltig")[0];
    const child = createElement(EinspaltigResume, { profile, name: "Mina Kaya", atsMode: false, plan, totalPages: 1,
      accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "white" });
    const html = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId="einspaltig" pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
    const { document } = parseHTML(html);
    const sections = Array.from(document.querySelectorAll("[data-managed-section]")).map(node => node.getAttribute("data-managed-section"));
    expect(sections.indexOf("experience")).toBeLessThan(sections.indexOf("summary"));
  });
  it.each(Object.entries(components))("applies semantic spacing to preview and PDF only when overridden in %s", (templateId, component) => {
    const now = new Date().toISOString();
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      summary: "Profiltext", experiences: [2020, 2022].map((year) => ({ id: crypto.randomUUID(), from: String(year), to: String(year + 1),
        role: "Entwicklerin", company: "Beispiel", achievements: [] })),
      education: [{ id: crypto.randomUUID(), from: "2018", to: "2020", degree: "Abschluss", institution: "Schule" }],
    });
    const settings = { ...defaultDocumentDesign, cvOverrides: { spacing: { sectionGapMm: 7, entryGapMm: 3, sectionTitleGapMm: 2.5,
      entryContentGapMm: 1.5, pageMarginMm: 18, innerPaddingMm: 4, columnGapMm: 8 }, typography: { lineHeight: 1.3 } } };
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name: "Mina Kaya",
      atsMode: false, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null,
      resumeProfile: "", sections: profile.resumeSections, backgroundId: "white" });
    const preview = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1} designSettings={settings}>{child}</ManagedResumePreview>);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
      job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567",
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now, designSettings: settings });
    for (const html of [preview, buildDocumentHtml(application, profile, "lebenslauf")]) {
      const document = parseHTML(html).document;
      const scope = document.querySelector("[data-resume-spacing-entry-gap]");
      expect(scope, templateId).not.toBeNull();
      expect(scope!.getAttribute("style"), templateId).toContain("--doc-entry-gap:3mm");
      expect(scope!.getAttribute("style"), templateId).toContain("--doc-section-gap:7mm");
      expect(scope!.getAttribute("style"), templateId).toContain("--doc-line-height:1.3");
      expect(scope!.querySelectorAll("[data-resume-spacing-section]" ).length, templateId).toBeGreaterThan(1);
      expect(scope!.querySelectorAll("[data-resume-spacing-entry]" ).length, templateId).toBeGreaterThan(1);
      expect(html, templateId).toContain("data-resume-spacing-entry-following");
    }
  });
  it.each(Object.entries(components))("uses the same optional career metadata layout in preview and PDF for %s", (templateId, component) => {
    const now = new Date().toISOString();
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      experiences: [{ id: crypto.randomUUID(), from: "11/2024", to: "06/2025", role: "Praktikum", company: "Universitätsstadt Marburg", city: "Marburg", achievements: ["Prozesse geplant"] }],
      education: [{ id: crypto.randomUUID(), from: "2020", to: "2023", degree: "Fachinformatiker", institution: "IAD GmbH", city: "Berlin" }],
    });
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name: "Mina Kaya",
      atsMode: false, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null,
      resumeProfile: "", sections: profile.resumeSections, backgroundId: "white" });
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
      job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567",
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now });
    const native = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
    expect(parseHTML(native).document.querySelector("[data-resume-metadata-grid]")).toBeNull();
    for (const [layout, order] of [["side-by-side", "details-first"], ["side-by-side", "dates-first"], ["stacked", "details-first"]] as const) {
      const settings = { ...defaultDocumentDesign, metadataLayout: layout, metadataOrder: order };
      const preview = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1} designSettings={settings}>{child}</ManagedResumePreview>);
      const pdf = buildDocumentHtml({ ...application, designSettings: settings }, profile, "lebenslauf");
      for (const html of [preview, pdf]) {
        const document = parseHTML(html).document;
        for (const [kind, role, company] of [["experience", "Praktikum", "Universitätsstadt Marburg"], ["education", "Fachinformatiker", "IAD GmbH"]]) {
          const entry = document.querySelector(`[data-managed-section="${kind}"] [data-resume-metadata-entry]`);
          expect(entry, `${templateId} ${kind} ${layout} ${order}`).not.toBeNull();
          const grid = entry!.querySelector("[data-resume-metadata-grid]")!;
          expect(grid.getAttribute("data-resume-metadata-grid")).toBe(layout);
          expect(grid.getAttribute("data-resume-metadata-order")).toBe(order);
          expect(grid.querySelector("[data-resume-metadata-role]")?.textContent).toBe(role);
          expect(grid.querySelector("[data-resume-metadata-organization]")?.textContent).toBe(company);
          expect(grid.querySelector("[data-resume-metadata-date]")?.textContent).toBe(kind === "experience" ? "11/2024 – 06/2025" : "2020 – 2023");
          expect(grid.querySelector("[data-resume-metadata-location]")?.textContent).toBe(kind === "experience" ? "Marburg" : "Berlin");
        }
        expect(document.querySelector('[data-managed-section="experience"] [data-resume-metadata-entry]')?.textContent).toContain("Prozesse geplant");
      }
    }
  });
  it.each(Object.entries(components))("shares closing controls between preview and PDF in %s", (templateId, component) => {
    const now = new Date().toISOString();
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: now,
      city: "Berlin", applicationPlace: "Marburg", applicationDate: "2026-09-28", signaturePath: "data:image/png;base64,AA==" });
    for (const closing of [
      { placement: "main" as const, alignment: "right" as const },
      { placement: "footer" as const, alignment: "distributed" as const, showDate: false },
      { placement: "footer" as const, alignment: "center" as const, showPlace: false, showSignature: false },
    ]) {
      const settings = { ...defaultDocumentDesign, resumePresentation: { closing } };
      const projected = resolveResumePresentation(profile, templateId, settings.resumePresentation)!;
      const plan = createResumePagePlan(projected, "", {}, templateId)[0];
      const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile: projected, templateId, name: "Mina Kaya", atsMode: false,
        plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: projected.resumeSections, backgroundId: "white" });
      const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
        job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: "#123456", secondaryColor: "#234567", documents: {}, statusHistory: [],
        createdAt: now, updatedAt: now, designSettings: settings });
      const resolvedCv = resolveCvDocument({ profile: projected, templateId, settings, presentationAlreadyApplied: true, application });
      const preview = renderToStaticMarkup(<ManagedResumePreview profile={projected} templateId={templateId} pageNumber={1} totalPages={1} designSettings={settings} resolvedCv={resolvedCv}>{child}</ManagedResumePreview>);
      // The Pehlione templates print the date of the application; the other templates the date typed into the profile.
      const closingDate = ["pehlione_white_blue", "pehlione_white"].includes(templateId) ? formatApplicationDateIso(application) : "28.09.2026";
      for (const html of [preview, buildDocumentHtml(application, profile, "lebenslauf")]) {
        const document = parseHTML(html).document;
        const block = document.querySelector("[data-resume-closing]");
        expect(block, templateId).not.toBeNull();
        expect(block?.getAttribute("data-resume-closing-placement")).toBe(closing.placement);
        expect(block?.getAttribute("data-resume-closing-align")).toBe(closing.alignment);
        expect(block?.querySelector("[data-resume-closing-place]")?.textContent).toBe(closing.showPlace === false ? undefined : "Marburg");
        expect(block?.querySelector("[data-resume-closing-date]")?.textContent).toBe(closing.showDate === false ? undefined : closingDate);
        expect(block?.querySelector("[data-resume-closing-signature] img")?.getAttribute("src")).toBe(closing.showSignature === false ? undefined : profile.signaturePath);
      }
    }
  });
});
