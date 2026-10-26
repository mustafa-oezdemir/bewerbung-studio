import { describe, expect, it } from "vitest";
import { profileSchema, type ApplicantProfile } from "../../shared/schema";
import { atsFlowTemplates } from "../../shared/documentPagination";
import { getManagerSections, reorderManagerSection } from "../../features/resume-sections/resume-manager";
import { estimateAtsHeaderTop } from "../../shared/resumeHeaderGeometry";
import { renderCv } from "./__parityHarness";

// The plain (ATS) layout: the sections behind the career follow the section list and fill page one while it has room,
// on both surfaces (the planner's tail, Sprachen and Zertifikate drawn where the plan names them, the output's order).
const now = "2026-10-26T10:00:00.000Z";
const uid = (n: number) => `9c000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const bullet = (index: number) => `Messbares Ergebnis ${index + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im Team.`;

const makeProfile = (experiences: number, educations = 2): ApplicantProfile => profileSchema.parse({
  id: uid(1), isDefault: true, updatedAt: now, firstName: "Lena", lastName: "Beispiel", title: "Anwendungsentwicklerin",
  email: "lena@example.test", phone: "+49 151 23456789", city: "Marburg", summary: "Anwendungsentwicklerin mit Schwerpunkt Backend und Monitoring.",
  skills: ["Java", "TypeScript"], languages: ["Deutsch – Muttersprache", "Englisch – B2"],
  strengths: ["Analytisches Denken", "Teamfähigkeit"].map((title, index) => ({ id: uid(2 + index), title, description: "" })),
  certifications: ["AWS Cloud Practitioner", "Scrum Master PSM I"],
  experiences: Array.from({ length: experiences }, (_, index) => ({
    id: uid(10 + index), from: `0${1 + (index % 9)}/20${10 + index}`, to: `0${1 + (index % 9)}/20${11 + index}`, role: `Softwareentwickler ${index + 1}`,
    company: `Beispiel GmbH ${index + 1}`, city: "Marburg", achievements: Array.from({ length: 3 }, (_, item) => bullet(item)),
  })),
  education: [
    { id: uid(40), from: "07/2023", to: "06/2025", degree: "Fachinformatiker für Anwendungsentwicklung", institution: "IAD GmbH", city: "Marburg" },
    { id: uid(41), from: "2008", to: "2012", degree: "Bachelor Informatik", institution: "Universität Istanbul", city: "Istanbul" },
  ].slice(0, educations),
  specialSections: [
    { id: uid(50), kind: "projects", title: "Projekte", isVisible: true, entries: [
      { id: uid(51), title: "Go Microservice Plattform", technologies: ["Go", "Gin"], description: "Demoanwendung mit automatisierten Tests.", bullets: [] },
    ] },
    { id: uid(60), kind: "interests", title: "Hobbys & Interessen", isVisible: true, contentType: "entries", entries: [
      { id: uid(61), title: "Gartenarbeit", description: "Aktives Mitglied im Gemeinschaftsgarten.", bullets: [] },
    ] },
  ],
});

/** The sections a page draws (outermost managed sections, in document order). */
const sectionsOf = (page: Element) => Array.from(page.querySelectorAll("[data-managed-section]"))
  .filter((node) => !node.parentElement?.closest("[data-managed-section]"))
  .map((node) => node.getAttribute("data-managed-section")!);
/** The sections in the order the document first draws them. */
const documentOrder = (pages: Element[]) => [...new Set(pages.flatMap(sectionsOf))];
const surfaces = ["previewPages", "pdfPages"] as const;
const templates = [...atsFlowTemplates];

describe("plain (ATS) layout: the sections behind the career follow the section list", () => {
  it.each(templates)("%s: a short résumé draws Kenntnisse, Sprachen and Zertifikate on page one, in the order of the list", (templateId) => {
    const profile = makeProfile(1, 1);
    const cv = renderCv(templateId, profile, { ats: true });
    const [first] = cv.resolved.pagePlan;
    expect(first.blocks).toEqual(expect.arrayContaining(["knowledge", "languages", "certifications"]));
    const listed = cv.resolved.managerSections.filter((entry) => !entry.fixed).map((entry) => entry.id);
    for (const surface of surfaces) {
      const pages = cv[surface];
      expect(sectionsOf(pages[0]), surface).toEqual(expect.arrayContaining(["knowledge", "languages", "certifications"]));
      // Each of them once in the whole document.
      for (const id of ["languages", "certifications"])
        expect(pages.flatMap(sectionsOf).filter((section) => section === id), `${surface} ${id}`).toHaveLength(1);
      const drawn = documentOrder(pages);
      expect(drawn, surface).toEqual(listed.filter((id) => drawn.includes(id)));
    }
  });

  it.each(templates)("%s: a long résumé draws Sprachen and Zertifikate on the page the plan names", (templateId) => {
    const cv = renderCv(templateId, makeProfile(6), { ats: true });
    expect(cv.resolved.pagePlan.length).toBeGreaterThan(1);
    for (const surface of surfaces) cv.resolved.pagePlan.forEach((plan, index) => {
      for (const id of ["languages", "certifications"])
        expect(sectionsOf(cv[surface][index]).includes(id), `${surface} page ${index + 1} ${id}`).toBe(Boolean(plan.blocks?.includes(id)));
    });
  });

  it.each(templates)("%s: a section list that puts Sprachen before Kenntnisse is drawn in that order", (templateId) => {
    const base = makeProfile(1, 1);
    const listed = getManagerSections(base, templateId).filter((entry) => !entry.fixed).map((entry) => entry.id);
    const profile = reorderManagerSection(base, templateId, "languages", listed.indexOf("knowledge"));
    const cv = renderCv(templateId, profile, { ats: true });
    const order = cv.resolved.managerSections.filter((entry) => !entry.fixed).map((entry) => entry.id);
    expect(order.indexOf("languages")).toBeLessThan(order.indexOf("knowledge"));
    for (const surface of surfaces) {
      const drawn = documentOrder(cv[surface]);
      expect(drawn, surface).toEqual(order.filter((id) => drawn.includes(id)));
      expect(sectionsOf(cv[surface][0]), surface).toEqual(expect.arrayContaining(["languages", "knowledge"]));
    }
  });
});

describe("plain (ATS) layout: the header the planner measures", () => {
  it.each(templates)("%s: more contacts, a wrapped Berufsbezeichnung and a long name push page one's content down", (templateId) => {
    const short = profileSchema.parse({ ...makeProfile(1), title: "Entwicklerin", phone: "", city: "" });
    const contacts = profileSchema.parse({
      ...short, phone: "+49 151 23456789", city: "Marburg", linkedin: "https://www.linkedin.com/in/lena-beispiel-anwendungsentwicklung",
      github: "https://github.com/lena-beispiel-entwicklung", portfolio: "https://www.lena-beispiel-portfolio.example.org",
      street: "Musterstraße 12", postalCode: "35037", country: "Deutschland", birthDate: "1990-05-17", birthPlace: "Ankara",
    });
    const title = profileSchema.parse({ ...short, title: "Senior Softwareentwicklerin und Fachinformatikerin für Anwendungsentwicklung mit Schwerpunkt Plattformen und Monitoring" });
    const top = (profile: ApplicantProfile) => estimateAtsHeaderTop(templateId, profile, "first")!;
    expect(top(short)).toBeGreaterThan(20);
    expect(top(contacts)).toBeGreaterThan(top(short));
    expect(top(title)).toBeGreaterThan(top(short));
    // Without Persönliche Daten the header shows no contacts.
    expect(estimateAtsHeaderTop(templateId, contacts, "first", false)).toBeLessThan(top(contacts));
    expect(estimateAtsHeaderTop(templateId, short, "cont")).toBeGreaterThan(20);
  });

  it("has no plain header model for a template whose plain layout is not fitted", () => {
    expect(estimateAtsHeaderTop("gepflegt", makeProfile(1), "first")).toBeUndefined();
  });
});
