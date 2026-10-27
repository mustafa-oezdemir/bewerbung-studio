import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { applicationSchema, profileSchema } from "../../../../shared/schema";
import { getTemplate } from "../../../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../../../shared/cvDesign";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { resolveSectionPresentation, resumeSectionPresentationCss } from "../../../../shared/resumeSectionPresentation";
import { moveManagerSection } from "../../../../features/resume-sections/resume-manager";
import { ManagedResumePreview } from "../../ManagedResumePreview";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { GepflegtResume } from "./GepflegtResume";

const templateId = "gepflegt";
const now = "2026-09-21T12:00:00.000Z";
const makeProfile = (count: number) => profileSchema.parse({
  id: crypto.randomUUID(), isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Entwicklerin",
  city: "Berlin", applicationPlace: "Marburg", applicationDate: "2020-01-01",
  email: "mina@example.com", summary: "Erfahrene Entwicklerin mit Schwerpunkt auf skalierbaren Plattformen.",
  skills: ["TypeScript", "React"], languages: ["Deutsch – C1", "Englisch – B2"],
  certifications: ["IBM Full Stack Software Developer"],
  experiences: Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(), from: `${2010 + index}`, to: `${2011 + index}`, role: `Position ${index + 1}`,
    company: `Unternehmen ${index + 1}`, city: "Berlin",
    achievements: Array.from({ length: 3 }, (_, bullet) => `Messbares Ergebnis ${bullet + 1} mit einer nachhaltigen Verbesserung der Arbeitsabläufe im gesamten Team.`),
  })),
  education: [{ id: crypto.randomUUID(), from: "2000", to: "2004", degree: "Abschluss", institution: "Hochschule" }],
  updatedAt: now,
});
type Profile = ReturnType<typeof makeProfile>;
const render = (profile: Profile, ats = false) => {
  const template = getTemplate(templateId);
  const designSettings = { ...getTemplateDocumentDesignDefaults(templateId), ...(ats ? { resumeOutputMode: "ats" as const } : {}) };
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Firma", city: "Berlin" },
    contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId,
    accentColor: template.accent, secondaryColor: template.secondary, designSettings, documents: {},
    statusHistory: [], createdAt: now, updatedAt: now, sentAt: "2026-09-26T10:00:00.000Z",
  });
  const resolved = resolveCvDocument({ profile, templateId, settings: designSettings, application });
  const preview = resolved.pagePlan.map((plan) => parseHTML(renderToStaticMarkup(
    <ManagedResumePreview profile={resolved.profile} templateId={templateId} pageNumber={plan.pageNumber}
      totalPages={resolved.pagePlan.length} designSettings={designSettings} resolvedCv={resolved}>
      <GepflegtResume profile={resolved.profile} name="Mina Kaya" atsMode={ats} plan={plan}
        totalPages={resolved.pagePlan.length} accentColor={template.accent} secondaryColor={template.secondary}
        photoSource={null} resumeProfile="" sections={resolved.sections} />
    </ManagedResumePreview>,
  )).document as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet"));
  return { resolved, surfaces: { preview, pdf } };
};
const section = (page: Element, id: string) => page.querySelector(`[data-managed-section="${id}"]`);

/** Specificity [ids, classes/attributes/pseudo-classes, elements] of one complex selector (:where counts 0, :is/:not/:has their argument). */
const specificity = (selector: string): number[] => {
  const total = [0, 0, 0];
  let rest = selector.replace(/::?(before|after|marker|placeholder)\b/g, " x ");
  for (;;) {
    const match = /:(where|is|not|has)\(/.exec(rest);
    if (!match) break;
    let depth = 1, end = match.index + match[0].length;
    for (; end < rest.length && depth; end += 1) depth += rest[end] === "(" ? 1 : rest[end] === ")" ? -1 : 0;
    const inner = rest.slice(match.index + match[0].length, end - 1);
    if (match[1] !== "where") {
      const best = inner.split(",").map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
      best.forEach((value, index) => { total[index] += value; });
    }
    rest = `${rest.slice(0, match.index)} ${rest.slice(end)}`;
  }
  rest = rest.replace(/\[[^\]]*\]/g, () => { total[1] += 1; return " "; });
  total[0] += (rest.match(/#[\w-]+/g) ?? []).length;
  total[1] += (rest.match(/\.[\w-]+|:[\w-]+(\([^)]*\))?/g) ?? []).length;
  total[2] += (rest.replace(/[.#:][\w-]+(\([^)]*\))?/g, " ").match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return total;
};
/** The colour the cascade gives an element: the most specific matching `color` declaration (important first, later wins ties). */
const cascadedColor = (element: Element, css: string) => {
  let winner: { important: boolean; weight: number[]; order: number; value: string } | undefined;
  let order = 0;
  postcss.parse(css).walkDecls("color", (decl) => {
    order += 1;
    const rule = decl.parent;
    if (rule?.type !== "rule" || rule.parent?.type !== "root") return;
    for (const selector of (rule as postcss.Rule).selectors) {
      let matches = false;
      try { matches = element.matches(selector); } catch { continue; }
      if (!matches) continue;
      const candidate = { important: decl.important, weight: specificity(selector), order, value: decl.value };
      const beats = !winner || Number(candidate.important) - Number(winner.important)
        || candidate.weight[0] - winner.weight[0] || candidate.weight[1] - winner.weight[1] || candidate.weight[2] - winner.weight[2]
        || candidate.order - winner.order;
      if (!winner || (beats as number) > 0) winner = candidate;
    }
  });
  return winner?.value;
};
const appStylesheets = ["../../../../app.css", "./gepflegt.css"].map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");

describe("Gepflegt: shared document flow", () => {
  it("takes title typography, color, and rule from the destination column", () => {
    const main = resolveSectionPresentation(templateId, "certifications", "main")!;
    const sidebar = resolveSectionPresentation(templateId, "certifications", "sidebar")!;
    expect(main.icon).toBeNull();
    expect(sidebar.icon).toBeNull();
    expect(main.heading.fontSizePt.standard).toBe(14);
    expect(sidebar.heading.fontSizePt.standard).toBe(13);
    expect(main.heading.color).toContain("--gepflegt-heading");
    expect(sidebar.heading.color).toContain("--gepflegt-sidebar-text");
    expect(main.heading.dividerColor).toContain("--gepflegt-divider");
    // The sidebar rule is a tint of the sidebar text colour, so a changed sidebar palette keeps a matching line.
    expect(sidebar.heading.dividerColor).toContain("--gepflegt-sidebar-text");
    expect(resumeSectionPresentationCss).toContain('[data-cv-zone="sidebar"]>.cv-heading');
  });

  it("moves certificates between the main column and the first-page sidebar", () => {
    const base = makeProfile(8);
    const behind = render(moveManagerSection(base, templateId, "certifications", "main", 99));
    const sidebar = render(moveManagerSection(base, templateId, "certifications", "sidebar", 0));
    const ahead = render(moveManagerSection(base, templateId, "certifications", "main", 0));
    expect(behind.resolved.pagePlan.length).toBeGreaterThan(1);
    expect(sidebar.resolved.pagePlan[0].blocks).toContain("certifications");
    expect(ahead.resolved.pagePlan[0].blocks).toContain("certifications");
    for (const surface of ["preview", "pdf"] as const) {
      expect(section(behind.surfaces[surface][0], "certifications"), surface).toBeNull();
      const laterCertificate = behind.surfaces[surface].slice(1).map(page => section(page, "certifications")).find(Boolean);
      expect(laterCertificate?.getAttribute("data-cv-zone"), surface).toBe("main");
      expect(section(sidebar.surfaces[surface][0], "certifications")?.closest("aside"), surface).not.toBeNull();
      expect(section(sidebar.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("sidebar");
      expect(section(ahead.surfaces[surface][0], "certifications")?.closest("main"), surface).not.toBeNull();
      expect(section(ahead.surfaces[surface][0], "certifications")?.getAttribute("data-cv-zone"), surface).toBe("main");
    }
  });

  it("uses each column's iconless heading and the application date on the final page", () => {
    const output = render(makeProfile(8));
    for (const surface of ["preview", "pdf"] as const) {
      const pages = output.surfaces[surface];
      expect(pages.length, surface).toBeGreaterThan(1);
      for (const page of pages) {
        for (const node of Array.from(page.querySelectorAll("[data-managed-section]"))) {
          expect(node.querySelectorAll(":scope > .cv-heading"), `${surface} ${node.getAttribute("data-managed-section")}`).toHaveLength(1);
          expect(node.querySelector("[data-cv-icon]"), surface).toBeNull();
        }
      }
      expect(section(pages[0], "languages")?.querySelector("[role='img'],.gepflegt-pdf-dots"), surface).not.toBeNull();
      expect(pages[0].querySelector("[data-resume-closing]"), surface).toBeNull();
      expect(pages[pages.length - 1].querySelector("[data-resume-closing-line]")?.textContent, surface).toBe("Marburg, 26.09.2026");
    }
  });

  it("draws the plain (ATS) sheet in the PDF's order: main column with special sections and closing, then the extra blocks", () => {
    const profile = profileSchema.parse({
      ...makeProfile(2),
      specialSections: [{ id: crypto.randomUUID(), kind: "projects", title: "Projekte", isVisible: true, entries: [
        { id: crypto.randomUUID(), title: "Go Microservice Plattform", technologies: ["Go", "Docker"], description: "Demoanwendung.", bullets: [] },
      ] }],
    });
    const output = render(profile, true);
    for (const surface of ["preview", "pdf"] as const) {
      const pages = output.surfaces[surface];
      const last = pages[pages.length - 1];
      const main = last.querySelector("main");
      const special = last.querySelector('[data-managed-section^="special:"]');
      const closing = last.querySelector("[data-resume-closing]");
      const languages = section(last, "languages");
      const order = Array.from(last.querySelectorAll("*"));
      expect(last.querySelector("aside"), surface).toBeNull();
      expect(special?.closest("main"), surface).toBe(main);
      expect(closing?.closest("main"), surface).toBe(main);
      expect(order.indexOf(special!), surface).toBeLessThan(order.indexOf(closing!));
      // Sprachen and the other extra blocks follow the main column and take the main column's heading colour.
      expect(languages?.closest(".gepflegt-ats-extra,.gepflegt-pdf-ats-extra"), surface).not.toBeNull();
      expect(order.indexOf(languages!), surface).toBeGreaterThan(order.indexOf(closing!));
      expect(main!.contains(languages!), surface).toBe(false);
      expect(languages?.querySelector("h2,h3")?.getAttribute("style"), surface).toContain("--gepflegt-section-heading");
    }
  });

  it("draws the Stärken icons in the sidebar text colour, not in the accent of the sidebar background", () => {
    const profile = profileSchema.parse({
      ...makeProfile(2),
      strengths: ["API", "React", "Analytisches Denken"].map((title) => ({ id: crypto.randomUUID(), title, description: "Beschreibung" })),
    });
    const output = render(profile);
    for (const surface of ["preview", "pdf"] as const) {
      const page = output.surfaces[surface][0];
      const strengths = section(page, "strengths");
      expect(strengths?.getAttribute("data-cv-zone"), surface).toBe("sidebar");
      const icons = Array.from(strengths?.querySelectorAll(".managed-strength-card > svg") ?? []);
      expect(icons.length, surface).toBe(3);
      const css = [surface === "preview" ? appStylesheets : "", ...Array.from((page.ownerDocument ?? page).querySelectorAll("style")).map((style) => style.textContent ?? "")].join("\n");
      for (const icon of icons) {
        // A bullet symbol inherits the text colour inline; every other mark takes the colour the cascade gives the svg.
        if (/color:\s*inherit/.test(icon.getAttribute("style") ?? "")) continue;
        expect(cascadedColor(icon, css), `${surface} ${icon.closest("article")?.textContent}`).toBe("var(--gepflegt-sidebar-text)");
      }
    }
    // On the white main column the icons keep the accent.
    const moved = render(moveManagerSection(profile, templateId, "strengths", "main", 0));
    for (const surface of ["preview", "pdf"] as const) {
      const page = moved.surfaces[surface][0];
      const icon = section(page, "strengths")?.querySelector(".managed-strength-card > svg");
      expect(icon?.closest("[data-cv-zone]")?.getAttribute("data-cv-zone"), surface).toBe("main");
      const css = [surface === "preview" ? appStylesheets : "", ...Array.from((page.ownerDocument ?? page).querySelectorAll("style")).map((style) => style.textContent ?? "")].join("\n");
      expect(cascadedColor(icon!, css), surface).not.toContain("--gepflegt-sidebar-text");
    }
  });
});
