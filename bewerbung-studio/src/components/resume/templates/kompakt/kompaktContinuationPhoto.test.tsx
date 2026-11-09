import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { buildDocumentHtml } from "../../../../../electron/documents";
import { updateManagerSection } from "../../../../features/resume-sections/resume-manager";
import { applyManagedResumeOutput } from "../../../../shared/resumeManagedOutput";
import { resolveCvDocument } from "../../../../shared/resolveCvDocument";
import { getTemplate } from "../../../../shared/templates";
import { maximalProfile, maximalProfileInput } from "../../__parityFixture";
import { harnessApplication } from "../../__parityHarness";
import { KompaktResume } from "./KompaktResume";

const photoPath = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2cAAAAASUVORK5CYII=";

/** Long enough for a second page, with a visible photo: the page-one header is what later pages repeat. */
const longProfile = () => {
  const [first, second] = maximalProfileInput().experiences;
  const experiences = Array.from({ length: 7 }, (_, index) => ({
    ...(index % 2 ? second : first),
    id: `9b000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    from: `01/${2010 + index}`, to: `12/${2010 + index}`, isCurrent: false,
    tasks: ["Konzeption zentraler Funktionen", "Abstimmung mit Fachbereichen", "Betreuung der Anwender"],
  }));
  return updateManagerSection(maximalProfile({ experiences, photoPath }), "kompakt", "photo", { visible: true });
};

const renderPages = () => {
  const profile = longProfile();
  const application = harnessApplication("kompakt");
  const settings = application.designSettings;
  const template = getTemplate("kompakt");
  const resolved = resolveCvDocument({ profile, templateId: "kompakt", settings, application });
  const total = resolved.pagePlan.length;
  const raw = (index: number) => renderToStaticMarkup(createElement(KompaktResume, {
    profile: resolved.profile, name: `${profile.firstName} ${profile.lastName}`, atsMode: false, plan: resolved.pagePlan[index],
    totalPages: total, accentColor: template.accent, secondaryColor: template.secondary, backgroundId: settings.backgroundId,
    photoSource: resolved.profile?.photoPath || null, resumeProfile: "", sections: resolved.sections,
  }));
  const firstPage = applyManagedResumeOutput(raw(0), resolved.profile, "kompakt", 1, total, settings, resolved);
  const preview = resolved.pagePlan.map((_, index) => parseHTML(
    `<html><body>${applyManagedResumeOutput(raw(index), resolved.profile, "kompakt", index + 1, total, settings, resolved, firstPage)}</body></html>`,
  ).document.body as unknown as Element);
  const pdf = Array.from(parseHTML(buildDocumentHtml(application, profile, "lebenslauf")).document.querySelectorAll(".cv-sheet")) as unknown as Element[];
  return { name: `${profile.firstName} ${profile.lastName}`, surfaces: [["preview", preview], ["pdf", pdf]] as const };
};

describe("Kompakt photo on later pages", () => {
  it("stays on the first page while the repeated header keeps name and title, in the preview and the PDF", () => {
    const { name, surfaces } = renderPages();
    for (const [surface, pages] of surfaces) {
      expect(pages.length, `${surface}: spans several pages`).toBeGreaterThan(1);
      const first = pages[0].querySelector("header")!;
      expect(first.querySelector("img")?.getAttribute("src"), `${surface} p1`).toBe(photoPath);
      expect(first.className, `${surface} p1`).toMatch(/with-photo/);
      pages.slice(1).forEach((page, index) => {
        const header = page.querySelector("header")!;
        const label = `${surface} p${index + 2}`;
        expect(header.querySelector("img"), label).toBeNull();
        expect(header.className, label).not.toMatch(/with-photo/);
        expect(header.querySelector("h1")?.textContent, label).toBe(name);
        expect(header.querySelector("h2")?.textContent?.trim(), label).toBeTruthy();
      });
    }
  });
});
