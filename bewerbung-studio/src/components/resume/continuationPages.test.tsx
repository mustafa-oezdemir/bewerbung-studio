import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../shared/schema";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { getTemplate } from "../../shared/templates";
import { resolveCvDocument } from "../../shared/resolveCvDocument";
import { buildDocumentHtml } from "../../../electron/documents";
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
  "zweispaltig": ZweispaltigResume,
};

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();
const headline = "Prozessoptimierer Unikat";
const profile = profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: headline, city: "Berlin", email: "mina@example.com", phone: "+49 30 123456",
  summary: "Erfahrene Fachkraft mit Schwerpunkt auf verlässlichen Abläufen und klarer Zusammenarbeit im Team.",
  skills: ["TypeScript", "React", "Node.js", "SQL", "Prozessanalyse"], languages: ["Deutsch – C1", "Englisch – B2"],
  signaturePath: "data:image/png;base64,iVBORw0KGgo=",
  strengths: ["Analytisches Denken", "Strukturierte Arbeitsweise", "Schnelle Auffassungsgabe"].map((title) => ({ id: crypto.randomUUID(), title })),
  experiences: Array.from({ length: 6 }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Rolle ${index + 1}`, company: `Firma ${index + 1}`, city: "Berlin",
    achievements: Array.from({ length: 6 }, (_, item) => `Ergebnis ${item + 1} mit messbarer Verbesserung der Abläufe in der Abteilung ${index + 1}.`),
  })),
  education: Array.from({ length: 2 }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2000 + index}`, to: `${2004 + index}`, degree: `Abschluss ${index + 1}`, institution: `Hochschule ${index + 1}`,
  })),
  updatedAt: now,
});

const render = (
  templateId: string,
  original = profile,
  settings = getTemplateDocumentDesignDefaults(templateId),
) => {
  // Tabellarisch sets the language dots and descriptions in the narrow half column (about 13 mm more): this edge-of-the-page fixture
  // is about the continuation page, so it uses the compact language line there.
  const source = templateId === "tabellarisch" ? profileSchema.parse({ ...original, resumeLanguageDisplay: { dots: false, level: true, description: false } }) : original;
  const template = getTemplate(templateId);
  const resolved = resolveCvDocument({ profile: source, templateId, settings, resumeProfile: "" });
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Test", city: "Berlin" }, contact: {},
    job: { title: "Entwicklung" }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: settings, documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
  });
  const pdfPages = Array.from(parseHTML(buildDocumentHtml(application, source, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  const component = components[templateId as keyof typeof components] as unknown as ComponentType<Record<string, unknown>>;
  const previewPages = resolved.pagePlan.map((plan) => parseHTML(`<html><body>${renderToStaticMarkup(
    <ManagedResumePreview
      designSettings={settings}
      resolvedCv={resolved}
      profile={resolved.profile}
      templateId={templateId}
      pageNumber={plan.pageNumber}
      totalPages={resolved.pagePlan.length}>
      {createElement(component, {
        profile: resolved.profile, templateId, name: "Mina Kaya", atsMode: false, plan, totalPages: resolved.pagePlan.length,
        accentColor: template.accent, secondaryColor: template.secondary, photoSource: null,
        resumeProfile: resolved.summary, sections: resolved.sections, backgroundId: "white",
      })}
    </ManagedResumePreview>,
  )}</body></html>`).document.body);
  return { resolved, pdfPages, previewPages };
};

const sectionIds = (page: Element) => Array.from(page.querySelectorAll("[data-managed-section]")).map((node) => node.getAttribute("data-managed-section")).sort();
const text = (page: Element) => (page.textContent ?? "").replace(/\s+/g, " ");

describe.each(Object.keys(components))("continuation page of %s", (templateId) => {
  const { resolved, pdfPages, previewPages } = render(templateId);

  it("plans the same two pages for preview and PDF", () => {
    if (["zweispaltig", "zeitgenoessisch", "elegant", "tabellarisch", "gepflegt", "klassisch", "einspaltig"].includes(templateId)) expect(resolved.pagePlan.length).toBeGreaterThanOrEqual(2);
    else expect(resolved.pagePlan).toHaveLength(2);
    expect(pdfPages).toHaveLength(resolved.pagePlan.length);
    expect(previewPages).toHaveLength(resolved.pagePlan.length);
  });

  it("shows the same sections on every page in preview and PDF", () => {
    for (const [index, page] of previewPages.entries()) expect({ page: index + 1, ids: sectionIds(page) }).toEqual({ page: index + 1, ids: sectionIds(pdfPages[index]) });
  });

  it.each(["preview", "pdf"] as const)("repeats the identity header with the template's continuation lane in the %s", (surface) => {
    const first = surface === "pdf" ? pdfPages[0] : previewPages[0];
    const second = surface === "pdf" ? pdfPages[1] : previewPages[1];
    if (templateId === "elegant") {
      const sidebarCue = second.querySelector("aside .elegant-sidebar__continuation");
      expect(sidebarCue?.textContent).toContain("Fortsetzung");
      expect(sidebarCue?.textContent).not.toContain("Mina Kaya");
      expect(sidebarCue?.textContent).not.toContain(headline);
      expect(sidebarCue?.textContent).not.toContain("Lebenslauf");
      expect(second.querySelector("aside img")).toBeNull();
    } else if (templateId === "gepflegt") expect(second.querySelector("aside")).not.toBeNull();
    else expect(second.querySelector("aside")).toBeNull();
    const firstHeader = first.querySelector("header");
    const secondHeader = second.querySelector("header");
    // Pehlione, Kompakt and Zeitgenössisch list contacts in their first-page column.
    const contactsInColumn = templateId.startsWith("pehlione_") || templateId === "kompakt" || templateId === "zeitgenoessisch";
    if (contactsInColumn) expect(firstHeader?.querySelector("[data-resume-header-extra-contact]")).toBeNull();
    expect(firstHeader?.textContent).toContain("Mina Kaya");
    expect(secondHeader?.textContent).toContain("Mina Kaya");
    expect(secondHeader?.textContent).toContain(headline);
    expect(secondHeader?.textContent).not.toContain("mina@example.com");
    expect(secondHeader?.textContent).not.toContain("+49 30 123456");
    expect(secondHeader?.querySelector('a[href="mailto:mina@example.com"]')).toBeNull();
    expect(secondHeader?.querySelector('a[href="tel:+4930123456"]')).toBeNull();
    expect(second.querySelector("[data-resume-continuation-meta]")).toBeNull();
    expect(second.querySelector("footer [data-resume-header-extra-contact]")).toBeNull();
    if (templateId === "zweispaltig") expect(second.querySelector("footer")?.textContent).toContain(`Seite 2 von ${resolved.pagePlan.length}`);
  });

  it.each(["preview", "pdf"] as const)("never draws a career heading without entries in the %s", (surface) => {
    for (const page of surface === "pdf" ? pdfPages : previewPages) {
      for (const section of page.querySelectorAll('[data-managed-section="experience"],[data-managed-section="education"]')) {
        const heading = section.querySelector("h2,h3");
        expect((section.textContent ?? "").replace(heading?.textContent ?? "", "").trim()).not.toBe("");
      }
    }
  });

  it("draws every bullet and degree exactly once, whichever page an entry breaks on", () => {
    const all = pdfPages.map(text).join(" ");
    // Pehlione shows five bullets per role, every other template all of them.
    const shown = templateId.startsWith("pehlione_") ? 5 : 6;
    for (const experience of profile.experiences) {
      for (const bullet of experience.achievements.slice(0, shown)) expect(all.split(bullet).length - 1).toBe(1);
      // A role that breaks between two pages repeats its header once, marked as a continuation.
      const headers = all.split(experience.role).length - 1;
      expect(headers === 1 || headers === 2).toBe(true);
    }
    for (const education of profile.education) expect(all.split(education.degree).length - 1).toBe(1);
  });

  it("breaks an entry at the same bullet in the preview and in the PDF", () => {
    // Some previews wrap a whole entry in a list item; only the bullets carry the “Ergebnis” text.
    const bullets = (page: Element) => Array.from(page.querySelectorAll('[data-managed-section="experience"] li')).map(text).filter((entry) => entry.startsWith("Ergebnis"));
    for (const [index, page] of previewPages.entries()) expect({ page: index + 1, bullets: bullets(page) }).toEqual({ page: index + 1, bullets: bullets(pdfPages[index]) });
    const continued = (page: Element) => page.querySelectorAll("[data-resume-entry-continued]").length;
    expect(continued(previewPages[1])).toBe(continued(pdfPages[1]));
    expect(continued(pdfPages[0])).toBe(0);
  });

  it("keeps the closing block on the last page only and inside the page", () => {
    expect(pdfPages[0].querySelector("[data-resume-closing],footer[class*=closing]")).toBeNull();
    expect(pdfPages.at(-1)?.querySelector("[data-resume-closing],footer[class*=closing]")).not.toBeNull();
  });
});

it("renders certificates on their template-specific page, not twice after a split", () => {
  const certified = profileSchema.parse({ ...profile, certifications: ["TÜV Sicherheit Unikat"] });
  const renderCertificatePages = (templateId: string) => {
    const template = getTemplate(templateId);
    const settings = getTemplateDocumentDesignDefaults(templateId);
    const application = applicationSchema.parse({ schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test",
      company: { name: "Test", city: "Berlin" }, contact: {}, job: { title: "Entwicklung" }, status: "Entwurf",
      templateId, accentColor: template.accent, secondaryColor: template.secondary, designSettings: settings,
      documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
    });
    return Array.from(parseHTML(buildDocumentHtml(application, certified, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  };
  const elegant = renderCertificatePages("elegant");
  const pehlione = renderCertificatePages("pehlione_white_blue");
  expect(elegant.length).toBeGreaterThanOrEqual(2);
  expect(pehlione).toHaveLength(2);
  expect(text(elegant[0])).toContain("TÜV Sicherheit Unikat");
  expect(elegant.map(text).join(" ").split("TÜV Sicherheit Unikat").length - 1).toBe(1);
  expect(text(pehlione[0])).not.toContain("TÜV Sicherheit Unikat");
  expect(text(pehlione[1])).toContain("TÜV Sicherheit Unikat");
});

// A résumé whose career fits page one but whose knowledge list does not: the list continues on page two.
const skills = Array.from({ length: 64 }, (_, index) => `Technologie ${index + 1} im Einsatz`);
const tailProfile = profileSchema.parse({
  ...profile,
  skills,
  experiences: profile.experiences.slice(0, 3).map((item) => ({ ...item, achievements: item.achievements.slice(0, 3) })),
  education: profile.education.slice(0, 1),
});

describe.each(["einspaltig", "klassisch", "ivy-league"])("knowledge list that continues on page two of %s", (templateId) => {
  const { resolved, pdfPages, previewPages } = render(templateId, tailProfile);

  it("flows the list from page one to page two without repeating or dropping an item", () => {
    expect(resolved.pagePlan).toHaveLength(2);
    expect(resolved.pagePlan[1].items).toHaveLength(0);
    expect(resolved.pagePlan[0].blockRanges?.knowledge).toBeDefined();
    const items = (page: Element) => Array.from(page.querySelectorAll('[data-managed-section="knowledge"] .managed-item-text')).map(text);
    const shown = pdfPages.flatMap(items);
    expect(shown).toHaveLength(skills.length);
    expect(new Set(shown).size).toBe(skills.length);
    for (const index of [0, 1]) expect(items(previewPages[index])).toEqual(items(pdfPages[index]));
  });

  it("names the second part of the list a continuation", () => {
    for (const pages of [pdfPages, previewPages]) {
      expect(text(pages[1].querySelector('[data-managed-section="knowledge"] h3, [data-managed-section="knowledge"] h2') ?? pages[1])).toContain("Fortsetzung");
      expect(text(pages[0])).not.toContain("Fortsetzung");
    }
  });

  it.each(["preview", "pdf"] as const)("prints no “career missing” hint on a page without career entries in the %s", (surface) => {
    const page = (surface === "pdf" ? pdfPages : previewPages)[1];
    expect(text(page)).not.toContain("im Profil ergänzen");
  });
});

it("splits a Zeitgenössisch CBF-style career entry at the same bullet in preview and PDF", () => {
  const achievements = [
    "Koordination laufender Produktionsprozesse und Abstimmung der Arbeitsschritte mit den beteiligten Teams.",
    "Auswertung von Produktionsdaten und Aufbereitung der Ergebnisse für die tägliche Fertigungsplanung.",
    "Überwachung von Produktionsterminen und frühzeitige Klärung von Abweichungen mit den Fachbereichen.",
    "Abstimmung von Aufgaben und Prioritäten mit Einkauf, Fertigung und Qualitätssicherung.",
    "Dokumentation der Prozesskennzahlen und Nachverfolgung vereinbarter Korrekturmaßnahmen.",
    "Verbesserung des Informationsflusses zwischen den Teams während der laufenden Produktion.",
    "Prüfung der Materialverfügbarkeit und Weitergabe offener Punkte an die zuständigen Stellen.",
    "Erstellung regelmäßiger Berichte zu Auslastung, Terminen und beobachteten Engpässen.",
  ];
  const cbf = {
    id: crypto.randomUUID(), from: "12/2018", to: "03/2019", role: "Prozessplaner",
    company: "CBF Tekstil und Außenhandel AG", city: "Tokat, Türkei", achievements,
  };
  // Vary only preceding content to land this fixed entry across the first page boundary.
  const candidates = Array.from({ length: 5 }, (_, count) => count + 1).flatMap((count) =>
    Array.from({ length: 5 }, (_, bullets) => profileSchema.parse({
      ...profile, education: [], experiences: [
        ...profile.experiences.slice(0, count).map((entry) => ({
          ...entry, achievements: entry.achievements.slice(0, bullets + 2),
        })),
        cbf,
      ],
    })),
  );
  const fixture = candidates.find((candidate) => {
    const plan = resolveCvDocument({
      profile: candidate, templateId: "zeitgenoessisch", settings: getTemplateDocumentDesignDefaults("zeitgenoessisch"),
    }).pagePlan;
    const first = plan[0]?.items.find((item) => item.id === cbf.id);
    const next = plan[1]?.items.find((item) => item.id === cbf.id);
    return first?.kind === "experience" && next?.kind === "experience"
      && first.bullets && next.bullets && first.bullets.to > 0 && first.bullets.to < achievements.length;
  });
  expect(fixture).toBeDefined();
  if (!fixture) return;
  const { resolved, pdfPages, previewPages } = render("zeitgenoessisch", fixture);
  const parts = resolved.pagePlan.flatMap((page) => page.items.filter((item) => item.id === cbf.id));
  const ranges = parts.map((item) => item.kind === "experience" ? item.bullets : undefined);
  expect(ranges[0]?.from).toBe(0);
  expect(ranges.at(-1)?.to).toBe(achievements.length);
  for (let index = 1; index < ranges.length; index += 1) expect(ranges[index]?.from).toBe(ranges[index - 1]?.to);
  expect(ranges[0]?.to).toBeGreaterThan(0);
  expect(ranges[0]?.to).toBeLessThan(achievements.length);
  expect(pdfPages).toHaveLength(resolved.pagePlan.length);
  expect(previewPages).toHaveLength(pdfPages.length);
  for (const bullet of achievements) {
    const seenOn = (pages: Element[]) => pages.flatMap((page, index) => text(page).includes(bullet) ? [index] : []);
    expect(seenOn(pdfPages), bullet).toEqual(seenOn(previewPages));
    expect(seenOn(pdfPages), bullet).toHaveLength(1);
  }
  for (let index = 0; index < pdfPages.length; index += 1) {
    const onPage = (page: Element) => achievements.filter((bullet) => text(page).includes(bullet));
    expect(onPage(pdfPages[index])).toEqual(onPage(previewPages[index]));
  }
});

it("recalculates Zeitgenössisch pagination from the shared body size and line height", () => {
  const base = getTemplateDocumentDesignDefaults("zeitgenoessisch");
  const smaller = render("zeitgenoessisch", profile, {
    ...base, cvOverrides: { typography: { bodySizePt: 10, lineHeight: 1.1 } },
  });
  const larger = render("zeitgenoessisch", profile, {
    ...base, cvOverrides: { typography: { bodySizePt: 11, lineHeight: 1.4 } },
  });
  for (const [output, body, line] of [[smaller, "10pt", "1.1"], [larger, "11pt", "1.4"]] as const) {
    expect(output.pdfPages).toHaveLength(output.resolved.pagePlan.length);
    expect(output.previewPages).toHaveLength(output.pdfPages.length);
    const preview = output.previewPages[0].querySelector<HTMLElement>(".zeitgenoessisch-template");
    const pdf = output.pdfPages[0].querySelector<HTMLElement>(".zeit-pdf");
    for (const root of [preview, pdf]) {
      expect(root?.style.getPropertyValue("--doc-body-size")).toBe(body);
      expect(root?.style.getPropertyValue("--doc-line-height")).toBe(line);
    }
    for (let index = 0; index < output.pdfPages.length; index += 1) {
      const sectionList = (page: Element) => Array.from(page.querySelectorAll("[data-managed-section]"))
        .map((section) => section.getAttribute("data-managed-section"));
      expect(sectionList(output.previewPages[index])).toEqual(sectionList(output.pdfPages[index]));
    }
  }
  const totalWeight = (output: typeof smaller) => output.resolved.pagePlan.flatMap((page) => page.items)
    .reduce((sum, item) => sum + item.weight, 0);
  expect(totalWeight(larger)).toBeGreaterThan(totalWeight(smaller));
  expect(larger.resolved.pagePlan[0].fill?.main ?? 0).toBeGreaterThan(smaller.resolved.pagePlan[0].fill?.main ?? 0);
});

it("splits a Kreativ CBF-style role between complete bullets in preview and PDF", () => {
  const achievements = [
    "Koordination laufender Produktionsprozesse und Abstimmung der Arbeitsschritte mit den beteiligten Teams.",
    "Auswertung von Produktionsdaten und Aufbereitung der Ergebnisse für die tägliche Fertigungsplanung.",
    "Überwachung von Produktionsterminen und frühzeitige Klärung von Abweichungen mit den Fachbereichen.",
    "Abstimmung von Aufgaben und Prioritäten mit Einkauf, Fertigung und Qualitätssicherung.",
    "Dokumentation der Prozesskennzahlen und Nachverfolgung vereinbarter Korrekturmaßnahmen.",
    "Verbesserung des Informationsflusses zwischen den Teams während der laufenden Produktion.",
    "Prüfung der Materialverfügbarkeit und Weitergabe offener Punkte an die zuständigen Stellen.",
    "Erstellung regelmäßiger Berichte zu Auslastung, Terminen und beobachteten Engpässen.",
  ];
  const cbf = { id: crypto.randomUUID(), from: "12/2018", to: "03/2019", role: "Prozessplaner",
    company: "CBF Tekstil und Außenhandel AG", city: "Tokat, Türkei", achievements };
  const settings = getTemplateDocumentDesignDefaults("kreativ");
  const candidates = Array.from({ length: 5 }, (_, count) => count + 1).flatMap((count) =>
    Array.from({ length: 5 }, (_, bullets) => profileSchema.parse({
      ...profile, education: [], experiences: [
        ...profile.experiences.slice(0, count).map((entry) => ({ ...entry, achievements: entry.achievements.slice(0, bullets + 2) })),
        cbf,
      ],
    })),
  );
  const fixture = candidates.find((candidate) => {
    const plan = resolveCvDocument({ profile: candidate, templateId: "kreativ", settings }).pagePlan;
    const first = plan[0]?.items.find((item) => item.id === cbf.id);
    const next = plan[1]?.items.find((item) => item.id === cbf.id);
    return first?.kind === "experience" && next?.kind === "experience" && first.bullets && next.bullets
      && first.bullets.to > 0 && first.bullets.to < achievements.length;
  });
  expect(fixture).toBeDefined();
  if (!fixture) return;
  const { resolved, pdfPages, previewPages } = render("kreativ", fixture);
  const ranges = resolved.pagePlan.flatMap((page) => page.items.filter((item) => item.id === cbf.id))
    .map((item) => item.kind === "experience" ? item.bullets : undefined);
  expect(ranges[0]?.from).toBe(0);
  expect(ranges.at(-1)?.to).toBe(achievements.length);
  expect(ranges[0]?.to).toBeGreaterThan(0);
  expect(ranges[0]?.to).toBeLessThan(achievements.length);
  for (let index = 1; index < ranges.length; index += 1) expect(ranges[index]?.from).toBe(ranges[index - 1]?.to);
  expect(pdfPages).toHaveLength(resolved.pagePlan.length);
  expect(previewPages).toHaveLength(pdfPages.length);
  for (const bullet of achievements) {
    const seenOn = (pages: Element[]) => pages.flatMap((page, index) => text(page).includes(bullet) ? [index] : []);
    expect(seenOn(pdfPages), bullet).toEqual(seenOn(previewPages));
    expect(seenOn(pdfPages), bullet).toHaveLength(1);
  }
  for (let index = 1; index < pdfPages.length; index += 1) {
    for (const page of [pdfPages[index], previewPages[index]]) {
      expect(page.querySelector(".kreativ-header--compact,.kreativ-pdf-header.compact")).not.toBeNull();
      expect(page.querySelector(".kreativ-header__photo,.kreativ-pdf-photo,.kreativ-background,.kreativ-pdf-background")).toBeNull();
    }
  }
});

it("recalculates Kreativ pagination and every managed section from resolved typography", () => {
  const base = getTemplateDocumentDesignDefaults("kreativ");
  const smaller = render("kreativ", profile, { ...base, cvOverrides: { typography: { bodySizePt: 10, lineHeight: 1.1 } } });
  const larger = render("kreativ", profile, { ...base, cvOverrides: { typography: { bodySizePt: 11, lineHeight: 1.4 } } });
  for (const [output, body, line] of [[smaller, "10pt", "1.1"], [larger, "11pt", "1.4"]] as const) {
    expect(output.pdfPages).toHaveLength(output.resolved.pagePlan.length);
    expect(output.previewPages).toHaveLength(output.pdfPages.length);
    const preview = output.previewPages[0].querySelector<HTMLElement>(".kreativ-template");
    const pdf = output.pdfPages[0].querySelector<HTMLElement>(".kreativ-pdf");
    for (const root of [preview, pdf]) {
      expect(root?.style.getPropertyValue("--doc-body-size")).toBe(body);
      expect(root?.style.getPropertyValue("--doc-line-height")).toBe(line);
    }
    for (let index = 0; index < output.pdfPages.length; index += 1) {
      const ids = (page: Element) => Array.from(page.querySelectorAll("[data-managed-section]"))
        .map((section) => section.getAttribute("data-managed-section"));
      expect(ids(output.previewPages[index])).toEqual(ids(output.pdfPages[index]));
    }
    for (const id of ["summary", "experience", "strengths", "languages", "knowledge"])
      expect(output.pdfPages.some((page) => page.querySelector(`[data-managed-section="${id}"]`))).toBe(true);
  }
  const weight = (output: typeof smaller) => output.resolved.pagePlan.flatMap((page) => page.items)
    .reduce((total, item) => total + item.weight, 0);
  expect(weight(larger)).toBeGreaterThan(weight(smaller));
});

it("splits a Stilvoll CBF-style role between complete bullets on the same preview and PDF pages", () => {
  const achievements = [
    "Koordination laufender Produktionsprozesse und Abstimmung der Arbeitsschritte mit den beteiligten Teams.",
    "Auswertung von Produktionsdaten und Aufbereitung der Ergebnisse für die tägliche Fertigungsplanung.",
    "Überwachung von Produktionsterminen und frühzeitige Klärung von Abweichungen mit den Fachbereichen.",
    "Abstimmung von Aufgaben und Prioritäten mit Einkauf, Fertigung und Qualitätssicherung.",
    "Dokumentation der Prozesskennzahlen und Nachverfolgung vereinbarter Korrekturmaßnahmen.",
    "Verbesserung des Informationsflusses zwischen den Teams während der laufenden Produktion.",
  ];
  const cbf = { id: crypto.randomUUID(), from: "12/2018", to: "03/2019", role: "Prozessplaner",
    company: "CBF Tekstil ve Dış Tic. A.Ş.", city: "Tokat, Türkei", achievements };
  const settings = getTemplateDocumentDesignDefaults("stilvoll");
  const candidates = Array.from({ length: 5 }, (_, count) => count + 1).flatMap(count =>
    Array.from({ length: 5 }, (_, bullets) => profileSchema.parse({
      ...profile, education: [], experiences: [
        ...profile.experiences.slice(0, count).map(entry => ({ ...entry, achievements: entry.achievements.slice(0, bullets + 2) })),
        cbf,
      ],
    })),
  );
  const fixture = candidates.find(candidate => {
    const plan = resolveCvDocument({ profile: candidate, templateId: "stilvoll", settings }).pagePlan;
    const first = plan[0]?.items.find(item => item.id === cbf.id);
    const next = plan[1]?.items.find(item => item.id === cbf.id);
    return first?.kind === "experience" && next?.kind === "experience" && first.bullets && next.bullets
      && first.bullets.to > 0 && first.bullets.to < achievements.length;
  });
  expect(fixture).toBeDefined();
  if (!fixture) return;
  const { resolved, pdfPages, previewPages } = render("stilvoll", fixture);
  const ranges = resolved.pagePlan.flatMap(page => page.items.filter(item => item.id === cbf.id))
    .map(item => item.kind === "experience" ? item.bullets : undefined);
  expect(ranges[0]?.from).toBe(0);
  expect(ranges.at(-1)?.to).toBe(achievements.length);
  expect(ranges[0]?.to).toBeGreaterThan(0);
  expect(ranges[0]?.to).toBeLessThan(achievements.length);
  for (let index = 1; index < ranges.length; index += 1) expect(ranges[index]?.from).toBe(ranges[index - 1]?.to);
  expect(pdfPages).toHaveLength(resolved.pagePlan.length);
  expect(previewPages).toHaveLength(pdfPages.length);
  for (const bullet of achievements) {
    const seenOn = (pages: Element[]) => pages.flatMap((page, index) => text(page).includes(bullet) ? [index] : []);
    expect(seenOn(pdfPages), bullet).toEqual(seenOn(previewPages));
    expect(seenOn(pdfPages), bullet).toHaveLength(1);
  }
  for (let index = 1; index < pdfPages.length; index += 1) for (const page of [pdfPages[index], previewPages[index]]) {
    expect(page.querySelector(".stilvoll-header--compact,.stilvoll-pdf-header.compact")).not.toBeNull();
    expect(page.querySelector(".stilvoll-header figure,.stilvoll-pdf-photo,.stilvoll-background,.managed-pdf-background")).toBeNull();
  }
});

it("recalculates Stilvoll pagination and the managed sections from resolved typography", () => {
  const base = getTemplateDocumentDesignDefaults("stilvoll");
  const smaller = render("stilvoll", profile, { ...base, cvOverrides: { typography: { bodySizePt: 10, lineHeight: 1.1 } } });
  const larger = render("stilvoll", profile, { ...base, cvOverrides: { typography: { bodySizePt: 11, lineHeight: 1.4 } } });
  for (const [output, body, line] of [[smaller, "10pt", "1.1"], [larger, "11pt", "1.4"]] as const) {
    expect(output.pdfPages).toHaveLength(output.resolved.pagePlan.length);
    expect(output.previewPages).toHaveLength(output.pdfPages.length);
    for (const root of [output.previewPages[0].querySelector<HTMLElement>(".stilvoll-template"),
      output.pdfPages[0].querySelector<HTMLElement>(".stilvoll-pdf")]) {
      expect(root?.style.getPropertyValue("--doc-body-size")).toBe(body);
      expect(root?.style.getPropertyValue("--doc-line-height")).toBe(line);
    }
    for (let index = 0; index < output.pdfPages.length; index += 1) {
      const ids = (page: Element) => Array.from(page.querySelectorAll("[data-managed-section]"))
        .map(section => section.getAttribute("data-managed-section"));
      expect(ids(output.previewPages[index])).toEqual(ids(output.pdfPages[index]));
    }
    for (const id of ["summary", "experience", "strengths", "languages", "knowledge"])
      expect(output.pdfPages.some(page => page.querySelector(`[data-managed-section="${id}"]`))).toBe(true);
  }
  const weight = (output: typeof smaller) => output.resolved.pagePlan.flatMap(page => page.items)
    .reduce((total, item) => total + item.weight, 0);
  expect(weight(larger)).toBeGreaterThan(weight(smaller));
});
