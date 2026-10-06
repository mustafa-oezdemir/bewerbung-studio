import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../electron/documents";
import { setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { createResumePagePlan, type ResumePagePlan } from "../../shared/documentPagination";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { resolveExperience } from "../../shared/resumeCareer";
import { applicationSchema, profileSchema, type Application } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
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
import { kreativPaginationProfile } from "../../shared/__kreativPaginationFixture";
import { renderCv } from "./__parityHarness";
import { moveManagerSection } from "../../features/resume-sections/resume-manager";

describe("Kreativ planned continuation and main-section order", () => {
  it("keeps the 3+2 split and places moved auxiliary sections after all career/education content on both surfaces", () => {
    let profile = kreativPaginationProfile();
    for (const id of ["strengths", "languages", "certifications"])
      profile = moveManagerSection(profile, "kreativ", id, "main", 0);
    const result = renderCv("kreativ", profile);
    const split = result.resolved.pagePlan[0].items.at(-1)!;
    expect(split.bullets).toEqual({ from: 0, to: 3, total: 5 });
    expect(result.resolved.pagePlan[1].items[0].bullets).toEqual({ from: 3, to: 5, total: 5 });
    const semantic = (pages: Element[]) => pages.map((page) => Array.from(page.querySelectorAll("[data-managed-section]")).map((section) => ({
      id: section.getAttribute("data-managed-section"),
      entries: Array.from(section.querySelectorAll("[data-resume-entry-id]")).map((entry) => ({
        id: entry.getAttribute("data-resume-entry-id"),
        bullets: Array.from(entry.querySelectorAll("li")).map((node) => node.textContent),
        continued: entry.hasAttribute("data-resume-entry-continued"),
      })),
    })));
    expect(semantic(result.previewPages)).toEqual(semantic(result.pdfPages));
    for (const pages of [result.previewPages, result.pdfPages]) {
      const ids = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section][data-cv-zone="main"]')).map((node) => node.getAttribute("data-managed-section")));
      const lastCareer = Math.max(ids.lastIndexOf("experience"), ids.lastIndexOf("education"));
      for (const id of ["strengths", "languages", "certifications"]) expect(ids.indexOf(id), id).toBeGreaterThan(lastCareer);
      const allBullets = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section="experience"] li')).map((node) => node.textContent));
      expect(allBullets).toEqual(profile.experiences.flatMap((entry) => entry.achievements));
      expect(pages[1].querySelectorAll("[data-resume-entry-marker]")).toHaveLength(1);
      expect(pages[1].querySelector('[data-managed-section="experience"]')?.textContent).toContain("Fortsetzung");
    }
  });

  it("retains the planned sidebar on continuation pages with certificates pending", () => {
    const profile = kreativPaginationProfile();
    profile.certifications = Array.from({ length: 70 }, (_, index) => `Fiktive Weiterbildung ${index + 1}`);
    const result = renderCv("kreativ", profile);
    expect(result.resolved.pagePlan.slice(1).some((page) => page.sidebar)).toBe(true);
    for (const pages of [result.previewPages, result.pdfPages]) {
      result.resolved.pagePlan.forEach((plan, index) => {
        if (plan.sidebar) expect(pages[index].querySelector("aside"), `page ${index + 1}`).not.toBeNull();
      });
      const certificates = pages.flatMap((page) => Array.from(page.querySelectorAll('[data-managed-section="certifications"] li')).map((node) => node.textContent));
      expect(certificates).toEqual(profile.certifications);
    }
  });
});

const components: Record<string, unknown> = {
  elegant: ElegantResume, einspaltig: EinspaltigResume, gepflegt: GepflegtResume, klassisch: KlassischResume, kompakt: KompaktResume,
  kreativ: KreativResume, "ivy-league": IvyLeagueResume, modern: ModernResume, pehlione_white: PehlioneResume, pehlione_white_blue: PehlioneResume,
  stilvoll: StilvollResume, tabellarisch: TabellarischResume, zeitgenoessisch: ZeitgenoessischResume, zweispaltig: ZweispaltigResume,
};
const ids = Object.keys(components);
const surfaces = ["preview", "pdf"] as const;

const now = new Date("2026-10-02T10:00:00.000Z").toISOString();
const idOf = (index: number) => `8f000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const station = (index: number, fields: Record<string, unknown> = {}) => ({
  id: idOf(index), from: "11/2021", to: "10/2024", role: `Rolle ${index}`, company: `Firma ${index}`, achievements: [], ...fields,
});
const make = (experiences: Array<Record<string, unknown>>, change: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: "8f100000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mustafa", lastName: "Özdemir", title: "Projektleiter",
    city: "Stuttgart", phone: "+49 170 1234567", email: "mustafa@example.com", summary: "Kurzer Überblick.", updatedAt: now,
    experiences, ...change,
  });

const applicationFor = (templateId: string, overrides: Partial<Application["designSettings"]> = {}): Application => {
  const template = getTemplate(templateId);
  return applicationSchema.parse({
    schemaVersion: 1, id: "8f200000-0000-4000-8000-000000000001", folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Kundenservice" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: { ...getTemplateDocumentDesignDefaults(templateId), ...overrides }, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
  });
};

const clean = (node: Element | null) => {
  node?.querySelectorAll("style,script").forEach((child) => child.remove());
  return (node?.textContent ?? "").replace(/\s+/g, " ");
};

/** Every page of the Lebenslauf in the preview and in the PDF, as text and as the bullets of the career section. */
const render = (templateId: string, profile: ReturnType<typeof make>, overrides: Partial<Application["designSettings"]> = {}) => {
  const application = applicationFor(templateId, overrides);
  const settings = application.designSettings;
  const template = getTemplate(templateId);
  const resolved = resolveCvDocument({ profile, templateId, settings, resumeProfile: application.documents.resumeProfile, application });
  const component = components[templateId] as ComponentType<Record<string, unknown>>;
  const previews = resolved.pagePlan.map((plan, index) =>
    parseHTML(`<html><body>${renderToStaticMarkup(
      <ManagedResumePreview designSettings={settings} resolvedCv={resolved} profile={resolved.profile} templateId={templateId} pageNumber={index + 1} totalPages={resolved.pagePlan.length}>
        {createElement(component, {
          profile: resolved.profile, templateId, name: "Mustafa Özdemir", atsMode: settings.resumeOutputMode === "ats", plan,
          totalPages: resolved.pagePlan.length, accentColor: template.accent, secondaryColor: template.secondary, photoSource: null,
          resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white",
        })}
      </ManagedResumePreview>,
    )}</body></html>`).document.body as unknown as Element);
  const pdfPages = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet")) as unknown as Element[];
  // The bullets only: a template that draws a station as a list item (Modern) is not a bullet.
  const bullets = (page: Element) =>
    Array.from(page.querySelectorAll('[data-managed-section="experience"] li'))
      .filter((node) => !node.querySelector("h2,h3,h4,li") && !/entry/.test(node.className))
      .map((node) => clean(node as Element).trim());
  const result = {
    plan: resolved.pagePlan,
    preview: previews.map(clean).join(" "),
    pdf: pdfPages.map(clean).join(" "),
    previewPages: previews.map(clean),
    pdfPages: pdfPages.map(clean),
    previewBullets: previews.flatMap(bullets),
    pdfBullets: pdfPages.flatMap(bullets),
  };
  return result;
};

const rich = [
  station(1, {
    from: "11/2024", to: "", isCurrent: true, company: "Muster", legalForm: "GmbH", city: "Berlin", employmentType: "Vollzeit",
    tasks: ["Backend-Schnittstellen entwickelt"], projects: ["Migration der Abrechnung"], achievements: ["Ladezeit um 40 % gesenkt"],
    technologies: ["TypeScript", "React"],
  }),
  station(2, { from: "11/2021", to: "10/2024", company: "Muster GmbH", legalForm: "GmbH", tasks: ["Zweite Station betreut"], achievements: ["Team angeleitet"] }),
];

describe.each(ids)("Beruflicher Werdegang of %s", (templateId) => {
  it("P/Q/A/D/E/F/G/H. shows each station with its period, employer and every kind of detail, the same in the preview and in the PDF", () => {
    const result = render(templateId, make(rich));
    for (const surface of surfaces) {
      const text = result[surface];
      expect(text, surface).toContain("Rolle 1");
      expect(text, surface).toContain("Rolle 2");
      expect(text, surface).toContain("11/2024 – heute");
      expect(text, surface).toContain("11/2021 – 10/2024");
      expect(text, surface).toContain("Muster GmbH");
      expect(text, surface).not.toContain("GmbH GmbH");
      for (const detail of ["Backend-Schnittstellen entwickelt", "Migration der Abrechnung", "Ladezeit um 40 % gesenkt", "Technologien: TypeScript, React", "Zweite Station betreut", "Team angeleitet"])
        expect(text, `${surface}: ${detail}`).toContain(detail);
      // Tasks, then projects, then achievements, then technologies; the stations in the user's order.
      const order = ["Backend-Schnittstellen entwickelt", "Migration der Abrechnung", "Ladezeit um 40 % gesenkt", "Technologien: TypeScript, React"].map((value) => text.indexOf(value));
      expect(order, surface).toEqual([...order].sort((a, b) => a - b));
      expect(text.indexOf("Rolle 1"), surface).toBeLessThan(text.indexOf("Rolle 2"));
    }
    expect(result.pdf, "Beschäftigungsart").toContain("Vollzeit");
    // The same details in the same order on both surfaces.
    expect(result.previewBullets).toEqual(result.pdfBullets);
    expect(result.previewBullets.length).toBeGreaterThanOrEqual(6);
  });

  it("I. draws no empty bullet and no empty list for blank entries", () => {
    const result = render(templateId, make([station(1, { tasks: ["", "  "], projects: [" "], achievements: [""], technologies: ["", " "], description: " ", teamSize: " " })]));
    expect(result.previewBullets).toEqual([]);
    expect(result.pdfBullets).toEqual([]);
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain("Rolle 1");
      expect(result[surface], surface).not.toContain("Technologien:");
      expect(result[surface], surface).not.toContain("Team / Verantwortung");
    }
  });

  it("shows a Kompakt station in one line and keeps its details out of the Lebenslauf", () => {
    const result = render(templateId, make([station(1, { compact: true, tasks: ["Nur im Profil"], technologies: ["Go"] }), station(2, { tasks: ["Sichtbare Aufgabe"] })]));
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain("Rolle 1");
      expect(result[surface], surface).not.toContain("Nur im Profil");
      expect(result[surface], surface).not.toContain("Technologien: Go");
      expect(result[surface], surface).toContain("Sichtbare Aufgabe");
    }
  });

  it("L/R. renders an older record with a bare year and 'Heute' and only the old fields", () => {
    const result = render(templateId, make([{ id: idOf(1), from: "2019", to: "Heute", role: "Entwickler", company: "Alt GmbH", achievements: ["Alt gepflegt"] }]));
    for (const surface of surfaces) {
      expect(result[surface], surface).toContain("2019 – heute");
      expect(result[surface], surface).toContain("Entwickler");
      expect(result[surface], surface).toContain("Alt GmbH");
      expect(result[surface], surface).toContain("Alt gepflegt");
    }
  });

  it("shows the same company in two stations twice", () => {
    const result = render(templateId, make([station(1, { company: "Gleiche AG" }), station(2, { company: "Gleiche AG" })]));
    for (const surface of surfaces) {
      expect(result[surface].split("Gleiche AG").length - 1, surface).toBeGreaterThanOrEqual(2);
      expect(result[surface], surface).toContain("Rolle 1");
      expect(result[surface], surface).toContain("Rolle 2");
    }
  });

  it("draws the default title, and a chosen one instead", () => {
    const result = render(templateId, make(rich));
    for (const surface of surfaces) expect(result[surface], surface).toContain("Beruflicher Werdegang");
    const renamed = render(templateId, setResumeSectionTitle(make(rich), "experience", "Praxiserfahrung"));
    for (const surface of surfaces) {
      expect(renamed[surface], surface).toContain("Praxiserfahrung");
      expect(renamed[surface], surface).not.toContain("Beruflicher Werdegang");
    }
  });
});

/** A station with every kind of detail; `size` repeats the lists, and every text is its own so a bullet can be counted. */
const detailed = (index: number, size = 1) =>
  station(index, {
    tasks: Array.from({ length: 3 * size }, (_, item) => `Aufgabe ${index}.${item + 1} mit genügend Text für zwei Zeilen im Lebenslauf der Station.`),
    projects: Array.from({ length: 2 * size }, (_, item) => `Projekt ${index}.${item + 1} zur Einführung einer neuen Plattform für interne Abläufe.`),
    achievements: Array.from({ length: 2 * size }, (_, item) => `Erfolg ${index}.${item + 1}: Durchlaufzeit nachweislich verkürzt und Fehler gesenkt.`),
    technologies: [`Werkzeug${index}A`, `Werkzeug${index}B`, "React", "PostgreSQL"],
  });
const bare = (index: number) => station(index);

const everyBulletOnce = (plan: ResumePagePlan[], profile: ReturnType<typeof make>) => {
  for (const experience of profile.experiences) {
    const total = resolveExperience(experience).bullets.length;
    const parts = plan.flatMap((page) => page.items.filter((item) => item.id === experience.id));
    const ranges = parts.map((item) => (item.kind === "experience" && item.bullets ? [item.bullets.from, item.bullets.to] : [0, total]));
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(total);
    for (let index = 1; index < ranges.length; index += 1) expect(ranges[index][0]).toBe(ranges[index - 1][1]);
  }
};

describe.each(ids)("Pagination of the Beruflicher Werdegang in %s", (templateId) => {
  const planFor = (profile: ReturnType<typeof make>) => createResumePagePlan(profile, "", {}, templateId);

  it("O. measures the tasks, projects, technologies and achievements that are drawn, not only the achievements", () => {
    const withDetails = make([1, 2, 3, 4, 5, 6].map((index) => detailed(index, 2)));
    const withoutDetails = make([1, 2, 3, 4, 5, 6].map(bare));
    expect(planFor(withoutDetails)).toHaveLength(1);
    expect(planFor(withDetails).length).toBeGreaterThan(1);
    // A station that only has tasks is as long as one that only has achievements of the same text.
    const asTasks = make([station(1, { tasks: ["a ".repeat(60), "b ".repeat(60), "c ".repeat(60)] })]);
    const asAchievements = make([station(1, { achievements: ["a ".repeat(60), "b ".repeat(60), "c ".repeat(60)] })]);
    expect(planFor(asTasks)[0].fill?.main).toBe(planFor(asAchievements)[0].fill?.main);
    // A Kompakt station is one line.
    const compact = make([1, 2, 3, 4, 5, 6].map((index) => ({ ...detailed(index, 2), compact: true })));
    expect(planFor(compact)).toHaveLength(1);
  });

  it("N. lets the details of a long station start on one page and continue on the next, every bullet once", () => {
    const profile = make([1, 2, 3, 4, 5, 6].map((index) => detailed(index, 2)));
    const plan = planFor(profile);
    expect(plan.length).toBeGreaterThan(1);
    everyBulletOnce(plan, profile);
    const broken = plan[0].items.flatMap((item) => {
      const next = plan[1].items.find((other) => other.id === item.id);
      return item.kind === "experience" && item.bullets && next?.kind === "experience" && next.bullets ? [[item, next] as const] : [];
    });
    for (const [first, second] of broken) {
      if (first.kind !== "experience" || second.kind !== "experience") continue;
      expect(second.bullets!.from).toBe(first.bullets!.to);
    }
  });
});

describe.each(["einspaltig", "modern", "pehlione_white_blue", "zweispaltig", "tabellarisch", "kompakt"])("Continuation page of the Beruflicher Werdegang in %s", (templateId) => {
  it("N/P. a station that continues names itself again, and no bullet is lost or doubled in the preview and the PDF", () => {
    // Grow the details until the page ends inside a station.
    let found: { profile: ReturnType<typeof make>; plan: ResumePagePlan[]; brokenId: string } | undefined;
    for (const size of [1, 2, 3]) {
      for (const stations of [2, 3, 4, 5, 6, 7, 8]) {
        const profile = make(Array.from({ length: stations }, (_, index) => detailed(index + 1, size)));
        const plan = createResumePagePlan(profile, "", {}, templateId);
        const broken = plan[0].items.find((item) => item.kind === "experience" && plan[1]?.items.some((other) => other.id === item.id && other.kind === "experience"));
        if (broken && !found) found = { profile, plan, brokenId: broken.id };
      }
    }
    expect(found, "a split station").toBeDefined();
    const { profile, plan, brokenId } = found!;
    const station = profile.experiences.find((entry) => entry.id === brokenId)!;
    const resolved = resolveExperience(station);
    const result = render(templateId, profile);
    expect(result.previewPages.length).toBe(plan.length);
    expect(result.pdfPages.length).toBe(plan.length);
    for (const pages of [result.previewPages, result.pdfPages]) {
      // Both pages carry the header of the station that continues.
      expect(pages[0]).toContain(resolved.role);
      expect(pages[1]).toContain(resolved.role);
      expect(pages[1]).toContain(resolved.organization);
    }
    // Every bullet of that station appears exactly once across the pages.
    for (const bullet of resolved.bullets) {
      for (const text of [result.preview, result.pdf]) expect(text.split(bullet).length - 1, bullet).toBe(1);
    }
    expect(result.previewBullets).toEqual(result.pdfBullets);
  });
});
