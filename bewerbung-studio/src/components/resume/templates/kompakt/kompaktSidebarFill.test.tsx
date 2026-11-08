import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { getManagerSections } from "../../../../features/resume-sections/resume-manager";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { KompaktResume } from "./KompaktResume";

// Kompakt's right column fills its page like a word processor (measured in Chromium, preview and PDF alike): a long
// Kenntnisse list no longer counts 2.2 mm too much per row, Sprachen count their title and row gaps, and a section whose
// rows are whole entries may leave a single entry for the next page. The fictional résumé of the bug report: Kenntnisse,
// Sprachen and a "Hobbys & Interessen" of three entries in the right column, the Bildungsweg going on at page two.
const templateId = "kompakt";
const now = "2026-10-02T10:00:00.000Z";
const uid = (n: number) => `9b000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hobbysId = `special:${uid(400)}`;
const hobbys = ["Code", "Gartenarbeit", "Ehrenamtliches Engagement"];
const technologies = ["TypeScript", "React", "Node.js", "SQL", "Git", "Docker", "Java", "Python", "Linux", "REST", "CSS", "Playwright", "Vite", "MUI"];

const makeProfile = ({ knowledge, certifications = [] as string[], lastUsedYear }: { knowledge: number; certifications?: string[]; lastUsedYear?: number }) => {
  const names = technologies.slice(0, knowledge);
  const half = Math.ceil(names.length / 2);
  const input = {
    id: uid(1), isDefault: true, updatedAt: now, firstName: "Max", lastName: "Mustermann",
    title: "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung",
    street: "Musterweg 1", postalCode: "35037", city: "Musterstadt", phone: "+49 170 1234567", email: "max.mustermann@example.com",
    summary: "Fachinformatiker für Anwendungsentwicklung mit Erfahrung in der Entwicklung moderner Webanwendungen. Strukturierte Arbeitsweise und hohe Verantwortungsbereitschaft.",
    languages: ["Deutsch – C1", "Englisch – B2", "Türkisch – Muttersprache"],
    certifications,
    knowledgeSection: {
      title: "Kenntnisse", isVisible: true,
      categories: [names.slice(0, half), names.slice(half)].map((items, category) => ({
        id: uid(60 + category), title: ["IT-Kenntnisse", "Frameworks"][category], type: "it", displayMode: "comma-separated",
        showLevels: false, showYearsOfExperience: false, isVisible: true, sortOrder: category, subcategories: [],
        items: items.map((name, index) => ({ id: uid(700 + category * 50 + index), name, level: "advanced", yearsOfExperience: 2,
          ...(lastUsedYear ? { lastUsedYear } : {}), description: "", isVisible: true, sortOrder: index })),
      })),
    },
    experiences: [
      { id: uid(200), from: "02/2024", to: "01/2026", role: "Softwareentwickler (Ausbildung)", company: "Beispiel GmbH", city: "Musterstadt",
        tasks: ["Entwicklung von Webanwendungen mit React und TypeScript", "Pflege von REST-Schnittstellen und automatisierten Tests", "Abstimmung mit Fachabteilungen und Dokumentation der Ergebnisse"], achievements: [] },
      { id: uid(201), from: "01/2019", to: "05/2020", role: "Disponent", company: "Muster Logistik AG", city: "Musterstadt",
        tasks: ["Planung und Steuerung der Tourenplanung", "Koordination von Fahrern und Terminüberwachung"], achievements: [] },
      { id: uid(202), from: "12/2014", to: "11/2018", role: "Transportpilot", company: "Luftfahrtbereich",
        tasks: ["Einsatzplanung, Briefings und Koordination operativer Abläufe", "Hohe Verantwortung, Stressresistenz und präzise Entscheidungsfindung", "Teamführung und sicherheitskritische Prozesssteuerung"], achievements: [] },
      { id: uid(203), from: "09/2012", to: "11/2014", role: "Flugbetriebsassistent", company: "Luftfahrtbereich",
        tasks: ["Vorbereitung von Einsatzunterlagen und Wetterbriefings", "Dokumentation von Wartungs- und Einsatzzeiten sowie Terminüberwachung"], achievements: [] },
    ],
    education: [
      { id: uid(300), from: "07/2023", to: "01/2026", degree: "Fachinformatiker für Anwendungsentwicklung", institution: "Beispiel Akademie GmbH", city: "Musterstadt" },
      { id: uid(301), from: "06/2020", to: "06/2023", degree: "Integrationskurs", institution: "VHS", city: "Musterstadt" },
      { id: uid(302), from: "09/2012", to: "12/2014", degree: "Ausbildung zum Transportpiloten", institution: "Luftfahrtbereich" },
      { id: uid(303), from: "08/2008", to: "08/2012", degree: "Industrieingenieurwesen", institution: "Beispiel Hochschule" },
    ],
    specialSections: [
      { id: uid(400), kind: "interests", title: "Hobbys & Interessen", isVisible: true, contentType: "entries", entries: [
        { id: uid(410), title: hobbys[0], description: "Verschiedene Weiterbildung", bullets: [] },
        { id: uid(411), title: hobbys[1], description: "Aktives Mitglied des interkulturellen Gartenvereins Musterstadt e.V.", bullets: [] },
        { id: uid(412), title: hobbys[2], description: "Ehrenamtlicher Bürgerhelfer beim Bürgerverein Musterstadt", bullets: [] },
      ] },
      { id: uid(500), kind: "projects", title: "Projekte", isVisible: true, contentType: "entries", entries: [
        { id: uid(510), title: "Portfolio Website / Developer Profile", technologies: ["React", "TypeScript", "Vite"], description: "Persönliche Portfolio-Seite mit Projektübersicht.", bullets: [] },
      ] },
    ],
    resumeClosing: { showPlace: true, showDate: true, showSignature: false },
    applicationPlace: "Musterstadt", applicationDate: "2026-10-02",
  };
  const base = profileSchema.parse(input);
  // The user's layout: Kenntnisse, Zertifikate, Sprachen and Hobbys in the right column.
  const side = new Set(["knowledge", "certifications", "languages", hobbysId]);
  const layout = getManagerSections(base, templateId).filter((entry) => !entry.fixed)
    .map((entry) => ({ id: entry.id, zone: side.has(entry.id) ? "sidebar" as const : "main" as const }));
  return profileSchema.parse({ ...input, resumeManagerLayouts: { [templateId]: layout } });
};

const render = (profile: ReturnType<typeof makeProfile>) => {
  const template = getTemplate(templateId);
  const designSettings = getTemplateDocumentDesignDefaults(templateId);
  const application = applicationSchema.parse({
    schemaVersion: 1, id: uid(900), folderName: "Test", company: { name: "Firma", city: "Berlin" }, contact: {},
    job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
  });
  const resolved = resolveCvDocument({ profile, templateId, settings: designSettings, application });
  const preview = resolved.pagePlan.map((plan) => parseHTML(renderToStaticMarkup(
    <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={plan.pageNumber}
      totalPages={resolved.pagePlan.length} designSettings={designSettings} resolvedCv={resolved}>
      <KompaktResume profile={resolved.profile} name="Max Mustermann" atsMode={false} plan={plan}
        totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
        backgroundId="abstract" photoSource={null} resumeProfile={resolved.summary} sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { plan: resolved.pagePlan, surfaces: { preview, pdf } };
};

/** The Hobbys entries a page draws, in its right column. */
const hobbysOn = (page: Element) => {
  const section = page.querySelector(`[data-managed-section="${hobbysId}"]`);
  if (!section) return [];
  expect(section.getAttribute("data-cv-zone")).toBe("sidebar");
  return Array.from(section.querySelectorAll('[data-custom-role="entry-title"]')).map((node) => node.textContent?.trim());
};

describe("Kompakt: the right column fills its page before it goes on", () => {
  it("keeps all three Hobbys entries beside page one when they fit there", () => {
    const { plan, surfaces } = render(makeProfile({ knowledge: 13 }));
    expect(plan.length).toBe(2);
    // The Bildungsweg goes on at page two; the right column does not follow it there.
    expect(plan[1].items.some((item) => item.kind === "education")).toBe(true);
    expect(plan[0].blocks).toContain(hobbysId);
    expect(plan[0].blockRanges?.[hobbysId]).toBeUndefined();
    expect(plan[1].blocks).not.toContain(hobbysId);
    expect(plan[0].fill!.sidebar).toBeLessThanOrEqual(1);
    for (const surface of ["preview", "pdf"] as const) {
      const pages = surfaces[surface];
      expect(pages, surface).toHaveLength(2);
      expect(hobbysOn(pages[0]), surface).toEqual(hobbys);
      expect(hobbysOn(pages[1]), surface).toEqual([]);
    }
  });

  it("leaves a single entry for the next page when only two of three fit", () => {
    const { plan, surfaces } = render(makeProfile({ knowledge: 12, lastUsedYear: 2025,
      certifications: ["Fiktives Zertifikat 1 · Muster Akademie", "Fiktives Zertifikat 2 · Muster Akademie"] }));
    expect(plan[0].blockRanges?.[hobbysId]).toEqual({ from: 0, to: 2, total: 3 });
    expect(plan[1].blockRanges?.[hobbysId]).toEqual({ from: 2, to: 3, total: 3 });
    expect(plan[1].sidebar).toBe(true);
    for (const surface of ["preview", "pdf"] as const) {
      const pages = surfaces[surface];
      // Every entry once, in order, the heading on both pages (never a heading alone).
      expect(pages.flatMap(hobbysOn), surface).toEqual(hobbys);
      expect(hobbysOn(pages[0]), surface).toEqual(hobbys.slice(0, 2));
      expect(hobbysOn(pages[1]), surface).toEqual(hobbys.slice(2));
      for (const page of pages.slice(0, 2))
        expect(page.querySelector(`[data-managed-section="${hobbysId}"] [data-custom-role="heading"]`), surface).not.toBeNull();
    }
  });

  it("keeps the languages of the right column together when the knowledge list leaves room for them", () => {
    const { plan, surfaces } = render(makeProfile({ knowledge: 14 }));
    expect(plan[0].blocks).toContain("languages");
    expect(plan[0].blockRanges?.languages).toBeUndefined();
    for (const surface of ["preview", "pdf"] as const) {
      const languages = surfaces[surface].map((page) => page.querySelectorAll('[data-managed-section="languages"] .resume-language-item').length);
      expect(languages[0], surface).toBe(3);
      expect(languages.slice(1).every((count) => count === 0), surface).toBe(true);
    }
  });
});
