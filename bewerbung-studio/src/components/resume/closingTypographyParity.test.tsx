import { describe, expect, it } from "vitest";
import { profileSchema } from "../../shared/schema";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

const profile = profileSchema.parse({
  id: "d1000000-0000-4000-8000-000000000001", isDefault: true,
  firstName: "Mina", lastName: "Kaya", city: "Marburg", applicationPlace: "Marburg",
  applicationDate: "2026-11-03", updatedAt: "2026-11-03T10:00:00.000Z",
  signaturePath: "data:image/png;base64,AA==",
  resumeClosing: { showPlace: true, showDate: true, showSignature: true },
});

describe("closing Lesetext size in preview and PDF", () => {
  for (const bodySizePt of [9, 12.5]) {
    it.each(resumeTemplateIds)(`uses ${bodySizePt} pt for name and place/date in %s`, (templateId) => {
      const rendered = renderCv(templateId, profile, {
        overrides: { cvOverrides: { typography: { bodySizePt } } },
      });
      for (const [surface, pages] of [["preview", rendered.previewPages], ["PDF", rendered.pdfPages]] as const) {
        const closing = pages.at(-1)?.querySelector("[data-resume-closing],footer.pehlione-closing,footer.pehlione-pdf-closing");
        expect(closing, surface).not.toBeNull();
        const name = closing?.querySelector<HTMLElement>("strong");
        const date = closing?.querySelector<HTMLElement>("[data-resume-closing-date],p");
        expect(name?.textContent, surface).toBe("Mina Kaya");
        expect(date?.textContent, surface).toContain(rendered.resolved.closingDate);
        for (const node of [name, date]) {
          expect(node?.style.getPropertyValue("font-size"), surface).toBe(`${bodySizePt}pt`);
        }
      }
    });
  }
});
