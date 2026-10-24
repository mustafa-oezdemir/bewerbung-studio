import { describe, expect, it } from "vitest";
import { profileSchema } from "./schema";
import { resolveCvDocument } from "./resolveCvDocument";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import type { ResumePagePlan } from "./documentPagination";
import { savedTemplateSidebarOrder } from "../features/resume-sections/resume-sections";

/**
 * Zweispaltig with an older saved section layout (`resumeSectionLayouts`, no hand-arranged section list): the template
 * draws its sidebar in the saved order (here Zertifikate before Sprachen), so the planner's sidebar lane must use the
 * same order. Before, the planner used the native order (Sprachen before Zertifikate) and the PDF showed Sprachen
 * between the two parts of a split Zertifikate list (real case 2026-10-21).
 */
const now = "2026-10-21T09:00:00.000Z";
const uid = (n: number) => `9e000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const savedLayout = [
  { type: "summary", zone: "sidebar" }, { type: "strengths", zone: "sidebar" }, { type: "experience", zone: "main" },
  { type: "education", zone: "main" }, { type: "projects", zone: "main" }, { type: "knowledge", zone: "sidebar" },
  { type: "certifications", zone: "sidebar" }, { type: "languages", zone: "sidebar" }, { type: "additional", zone: "main" },
  { type: "references", zone: "main" },
];

const profile = (certifications: number, layout: unknown[] | null = savedLayout) => profileSchema.parse({
  id: uid(1), isDefault: true, updatedAt: now, firstName: "Mina", lastName: "Kaya", title: "Softwareentwicklerin",
  city: "Musterstadt", email: "mina.kaya@example.com", phone: "+49 170 12345678",
  summary: Array.from({ length: 8 }, () => "Entwicklerin mit Schwerpunkt auf Backend- und Schnittstellenentwicklung.").join(" "),
  strengths: Array.from({ length: 6 }, (_, index) => ({ id: uid(10 + index), title: `Stärke ${index + 1}`, description: "" })),
  languages: ["Deutsch – C1", "Englisch – B2", "Türkisch – C2"],
  certifications: Array.from({ length: certifications }, (_, index) => `Zertifikat ${index + 1} Software Engineering`),
  experiences: Array.from({ length: 3 }, (_, index) => ({
    id: uid(200 + index), from: "01/2015", to: "01/2018", role: `Position ${index + 1}`, company: `Unternehmen ${index + 1}`,
    city: "Musterstadt", achievements: [],
    tasks: Array.from({ length: 3 }, (_, bullet) => `Ergebnis ${bullet + 1} mit einer Verbesserung der Abläufe im ganzen Team.`),
  })),
  education: Array.from({ length: 3 }, (_, index) => ({
    id: uid(300 + index), from: "2008", to: "2012", degree: `Abschluss ${index + 1}`, institution: `Hochschule ${index + 1}`,
  })),
  ...(layout ? { resumeSectionLayouts: { zweispaltig: layout } } : {}),
});

const plan = (certifications: number, layout: unknown[] | null = savedLayout) =>
  resolveCvDocument({
    profile: profile(certifications, layout), templateId: "zweispaltig",
    settings: getTemplateDocumentDesignDefaults("zweispaltig"),
  }).pagePlan;

/** The named sections in the order the pages show them (`blocks` order): one entry per page and section part. */
const sidebarFlow = (pages: ResumePagePlan[], ids: string[]) =>
  pages.flatMap((page) => (page.blocks ?? [])
    .filter((id) => ids.includes(id))
    .map((id) => ({ page: page.pageNumber, id, range: page.blockRanges?.[id] })));

describe("Zweispaltig: sidebar lane follows a saved section layout", () => {
  it("reads the saved layout's sidebar order, the template's default without one", () => {
    expect(savedTemplateSidebarOrder(profile(0), "zweispaltig")).toEqual(["summary", "strengths", "knowledge", "certifications", "languages"]);
    expect(savedTemplateSidebarOrder(profile(0, null), "zweispaltig")).toBeUndefined();
  });

  it("never puts Sprachen between two parts of a split Zertifikate list", () => {
    let splits = 0;
    for (let certifications = 4; certifications <= 24; certifications += 1) {
      const pages = plan(certifications);
      const flow = sidebarFlow(pages, ["certifications", "languages"]);
      const certParts = flow.filter((part) => part.id === "certifications");
      const languages = flow.filter((part) => part.id === "languages");
      expect(languages.length, `${certifications} certificates`).toBeGreaterThanOrEqual(1);
      if (certParts.length > 1) splits += 1;
      // The column reads Zertifikate (all parts), then Sprachen (all parts): no section in between.
      expect(flow.map((part) => part.id), `${certifications} certificates`)
        .toEqual([...certParts.map(() => "certifications"), ...languages.map(() => "languages")]);
      // … and never on a page whose Zertifikate go on on the next page.
      for (const part of certParts) {
        if (part.range && part.range.to < part.range.total) {
          expect(languages[0]!.page, `${certifications} certificates, page ${part.page}`).toBeGreaterThan(part.page);
        }
      }
      // Nothing lost, nothing twice.
      const total = certParts.reduce((sum, part) => sum + (part.range ? part.range.to - part.range.from : certifications), 0);
      expect(total, `${certifications} certificates`).toBe(certifications);
    }
    // The scenario really splits the list (else the test proves nothing).
    expect(splits).toBeGreaterThan(0);
  });

  it("keeps the native order (Sprachen before Zertifikate) without a saved layout", () => {
    const flow = sidebarFlow(plan(16, null), ["certifications", "languages"]);
    expect(flow.map((part) => part.id)).toEqual(["languages", "certifications", "certifications"]);
  });
});
