import { describe, expect, it } from "vitest";
import { getTemplateDocumentDesignDefaults, resolveTemplateCvDesign } from "./cvDesign";
import { cvDesignLimits } from "./cvDesignSchema";
import { resolveCvDocument } from "./resolveCvDocument";
import { entryHeadDelta, sideBySideEntryHead, type EntryRoleSizes } from "./resumeEntryRoleMetrics";
import { profileSchema } from "./schema";
import { templates } from "./templates";

const uid = (n: number) => `e2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const profile = profileSchema.parse({
  id: uid(1), isDefault: true, firstName: "Lena", lastName: "Beispiel", title: "Fachinformatikerin", city: "Marburg", updatedAt: "2026-10-25T10:00:00.000Z",
  experiences: [1, 2, 3].map((n) => ({ id: uid(10 + n), from: `0${n}/202${n}`, to: `0${n + 1}/202${n + 1}`, role: `Praktikum als Anwendungsentwickler ${n}`,
    company: `Universitätsstadt Marburg ${n}`, city: "Marburg", achievements: ["Entwicklung eines Grafana-Datasource-Plugins für PRTG", "Dokumentation auf GitHub"] })),
  education: [{ id: uid(20), from: "07/2023", to: "06/2025", degree: "Fachinformatiker für Anwendungsentwicklung", institution: "IAD GmbH", city: "Marburg" }],
  specialSections: [{ id: uid(30), kind: "projects", title: "Projekte", isVisible: true, entries: [1, 2].map((n) => ({
    id: uid(30 + n), title: `Spring Boot E-Commerce Shop ${n}`, technologies: ["Spring Boot", "Kafka", "RabbitMQ", "MySQL"],
    description: "E-Commerce-Demoanwendung mit Spring Boot, Kafka, RabbitMQ, MySQL, Prometheus und Grafana.", bullets: [] })) }],
});

const plan = (templateId: string, typography?: Record<string, number>, ats = false, source = profile) => resolveCvDocument({
  profile: source, templateId,
  settings: { ...getTemplateDocumentDesignDefaults(templateId), resumeOutputMode: ats ? "ats" : "visual", ...(typography ? { cvOverrides: { typography } } : {}) },
}).pagePlan;
const weight = (pages: ReturnType<typeof plan>, kind: string) =>
  pages.flatMap((page) => page.items).filter((item) => item.kind === kind).reduce((total, item) => total + item.weight, 0);
const roleSizes = (scale: (pt: number) => number, templateId: string) => {
  const { typography } = resolveTemplateCvDesign(templateId);
  return Object.fromEntries((["entryHeadingSizePt", "dateSizePt", "organizationSizePt", "locationSizePt", "projectTechnologiesSizePt", "projectDescriptionSizePt"] as const)
    .map((key) => [key, Math.min(cvDesignLimits[key][1], Math.max(cvDesignLimits[key][0], scale(typography[key])))]));
};
/** Werdegang and Bildungsweg only: their heads are drawn at the template's native role sizes. */
const careerOnly = { ...profile, specialSections: [] };

describe("the page planner measures the entry-role sizes", () => {
  describe.each(templates)("$name", ({ id }) => {
    // Pehlione's project highlight draws its title at 10.4 pt, not at the entry title size: choosing that size changes it.
    it.skipIf(id.startsWith("pehlione_"))("plans exactly as before while the chosen sizes are the template's own", () => {
      expect(plan(id, roleSizes((pt) => pt, id), false, careerOnly)).toEqual(plan(id, undefined, false, careerOnly));
    });

    for (const ats of [false, true]) {
      it(`makes the career entries taller with larger sizes and shorter with smaller ones (${ats ? "ATS" : "visual"})`, () => {
        const native = plan(id, undefined, ats);
        const larger = plan(id, roleSizes((pt) => pt + 3, id), ats);
        const smaller = plan(id, roleSizes((pt) => pt - 1.5, id), ats);
        for (const kind of ["experience", "education"]) {
          expect(weight(larger, kind), kind).toBeGreaterThan(weight(native, kind));
          expect(weight(smaller, kind), kind).toBeLessThanOrEqual(weight(native, kind));
        }
        // A larger text never makes the document shorter.
        expect(larger.length).toBeGreaterThanOrEqual(native.length);
      });
    }

    it("lets every size reach the plan on its own", () => {
      const native = plan(id);
      for (const key of ["entryHeadingSizePt", "dateSizePt", "organizationSizePt"] as const) {
        const larger = plan(id, { [key]: Math.min(cvDesignLimits[key][1], resolveTemplateCvDesign(id).typography[key] + 4) });
        expect(weight(larger, "experience"), key).toBeGreaterThanOrEqual(weight(native, "experience"));
      }
    });
  });
});

describe("the head of a career entry", () => {
  const sizes = (chosen: EntryRoleSizes["chosen"]): EntryRoleSizes => ({
    native: { "entry-title": 11, organization: 10, period: 9, location: 9, technologies: 9, description: 10 }, chosen,
  });
  const texts = { "entry-title": "Praktikum", organization: "Universitätsstadt Marburg", period: "11/2024 – 06/2025", location: "Marburg" };
  const oneLine = () => 1;
  const width = () => 100;
  const mm = (pt: number) => pt * 25.4 / 72;

  it("adds nothing without a chosen size and grows a row by its tallest role", () => {
    const model = sideBySideEntryHead({ "entry-title": 1.2, organization: 1.2, period: 1.2, location: 1.2 });
    expect(entryHeadDelta(model, undefined, texts, width, oneLine)).toBe(0);
    expect(entryHeadDelta(model, sizes({}), texts, width, oneLine)).toBe(0);
    // A larger date beside a larger title: the row follows the title, which is taller.
    expect(entryHeadDelta(model, sizes({ "entry-title": 14, period: 10 }), texts, width, oneLine)).toBeCloseTo(mm(3 * 1.2), 5);
    // A date that stays smaller than the title beside it does not raise the row.
    expect(entryHeadDelta(model, sizes({ period: 10 }), texts, width, oneLine)).toBe(0);
    // A smaller organisation lowers its row down to the place beside it.
    expect(entryHeadDelta(model, sizes({ organization: 8 }), texts, width, oneLine)).toBeCloseTo(-mm(1 * 1.2), 5);
  });

  it("keeps an inline role's line at the template's size when it gets smaller, and counts wrapped lines", () => {
    const inline = { rows: [[["entry-title"]], [[["organization", "period", "location"]]]], lineRatio: {}, inline: ["organization", "period", "location"] } as const;
    expect(entryHeadDelta(inline, sizes({ organization: 7, period: 7, location: 7 }), texts, width, oneLine)).toBe(0);
    const twoLines = (_text: string, _width: number, fontMm: number) => fontMm > mm(12) ? 2 : 1;
    const model = sideBySideEntryHead({ "entry-title": 1, organization: 1, period: 1, location: 1 });
    expect(entryHeadDelta(model, sizes({ "entry-title": 13 }), texts, width, twoLines)).toBeCloseTo(mm(13 * 2 - 11), 5);
  });

});
