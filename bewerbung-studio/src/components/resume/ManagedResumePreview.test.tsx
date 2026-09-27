import { createElement, type ComponentType } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { defaultDocumentDesign } from "../../shared/documentDesign";
import { buildDocumentHtml } from "../../../electron/documents";
import { createResumePagePlan } from "../../shared/documentPagination";
import { moveManagerSection } from "../../features/resume-sections/resume-manager";
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
      const headings = Array.from(document.querySelectorAll(selector)).map((heading) => heading.textContent?.trim());
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
    const strengths = ["Go", "React", "Spring Boot", "SQL", "Docker", "Git", "Linux", "Java", "TypeScript"].map((title, index) => ({ id: crypto.randomUUID(), title, description: index === 0 ? "Echo, Gin\nREST" : "", iconId: "" }));
    const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", updatedAt: new Date().toISOString(), strengths });
    const plan = createResumePagePlan(profile, "", {}, templateId)[0];
    for (const atsMode of [false, true]) {
      const child = createElement(component as unknown as ComponentType<Record<string, unknown>>, { profile, templateId, name: "Mina Kaya", atsMode, plan, totalPages: 1, accentColor: "#123456", secondaryColor: "#234567", photoSource: null, resumeProfile: "", sections: profile.resumeSections, backgroundId: "none" });
      const html = renderToStaticMarkup(<ManagedResumePreview profile={profile} templateId={templateId} pageNumber={1} totalPages={1}>{child}</ManagedResumePreview>);
      const { document } = parseHTML(html);
      expect(document.querySelectorAll(".managed-strengths-grid")).toHaveLength(1);
      expect(Array.from(document.querySelectorAll(".managed-strength-card strong")).map((node) => node.textContent)).toEqual(strengths.map((item) => item.title));
      expect(document.querySelector(".managed-strength-card p")?.textContent).toBe("Echo, Gin\nREST");
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
});
