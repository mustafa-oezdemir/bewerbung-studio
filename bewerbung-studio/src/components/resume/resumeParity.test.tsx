import { describe, expect, it } from "vitest";
import { setResumeSectionTitle } from "../../features/resume-sections/resume-sections";
import { maximalProfile, minimalProfile } from "./__parityFixture";
import { renderCv, resumeTemplateIds } from "./__parityHarness";

/** Every token of the profile that has to reach the Lebenslauf, by the field it comes from. */
export const maximalTokens: Record<string, string[]> = {
  identity: ["Mustafa", "Özdemir", "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung"],
  personal: ["Musterstraße 12", "35037 Marburg", "+49 170 1234567", "mustafa@example.com", "linkedin.com/in/mustafa-oezdemir", "github.com/mustafa-oezdemir", "mustafa-oezdemir.de",
    "xing.com/profile/Mustafa_Oezdemir", "gitlab.com/mustafa-oezdemir", "17.05.1990", "Ankara", "deutsch", "verheiratet", "2 Kinder"],
  summary: ["Plattformen und verlässlicher Zusammenarbeit"],
  career: ["11/2024 – heute", "Muster GmbH", "Vollzeit", "Entwicklung interner Plattformen", "Team mit 5 Personen", "Konzeption zentraler Funktionen", "Grafana-Datasource-Plugin",
    "Technologien: TypeScript, React, Grafana", "Open-Source-Veröffentlichung des Plugins", "07/2023 – 10/2024", "IAD GmbH", "Webanwendungen umgesetzt", "Ladezeit halbiert"],
  education: ["07/2023 – 11/2025", "Fachinformatiker für Anwendungsentwicklung", "Deutschland", "Anwendungsentwicklung", "1,8", "Abschlussprojekt: Monitoring-Plattform"],
  knowledge: ["Java", "Fortgeschrittene Kenntnisse", "4 Jahre", "Spring Boot und REST APIs"],
  languages: ["Englisch", "C1", "Deutsch", "Muttersprache"],
  certifications: ["03/2026", "Professional Scrum Master I", "Scrum.org"],
  strengths: ["Analytisches Denken"],
  interests: ["Fotografie", "Architektur- und Landschaftsfotografie"],
  custom: ["Eigene Projekte", "Open-Source-Plugin", "Grafana Community", "Remote", "2025", "Datasource für Monitoring-Daten", "Dokumentation veröffentlicht", "example.org/plugin"],
  closing: ["Marburg, 02.10.2026"],
};

describe.each(resumeTemplateIds)("maximal profile in %s", (templateId) => {
  const profile = maximalProfile();
  for (const mode of ["visual", "ats"] as const) {
    it(`reaches the preview and the PDF with every field (${mode})`, () => {
      const result = renderCv(templateId, profile, { ats: mode === "ats" });
      const missing: string[] = [];
      for (const [group, tokens] of Object.entries(maximalTokens))
        for (const token of tokens)
          for (const surface of ["preview", "pdf"] as const)
            if (!result[surface].includes(token)) missing.push(`${group}/${surface}: ${token}`);
      expect(missing).toEqual([]);
    });
  }

  it("draws the same sections and entries in the preview and the PDF", () => {
    const result = renderCv(templateId, profile);
    expect([...new Set(result.pdfSemantic.sections)].sort()).toEqual([...new Set(result.previewSemantic.sections)].sort());
    expect(result.pdfPages.length).toBe(result.previewPages.length);
  });
});

const customTitles = {
  summary: "Über mich",
  strengths: "Meine Stärken",
  experience: "Praxiserfahrung",
  education: "Ausbildungsweg",
  knowledge: "Kompetenzen",
  languages: "Fremdsprachen",
  certifications: "Nachweise",
} as const;

describe.each(resumeTemplateIds)("section titles in %s", (templateId) => {
  it("prints every title the user chose, in the preview and the PDF, visual and ATS", () => {
    let profile = maximalProfile();
    for (const [type, title] of Object.entries(customTitles)) profile = setResumeSectionTitle(profile, type as keyof typeof customTitles, title);
    for (const ats of [false, true]) {
      const result = renderCv(templateId, profile, { ats });
      for (const surface of ["preview", "pdf"] as const) {
        // Pehlione draws its Stärken as the competency group: that group's own title (editable in the panel) applies.
        const expected = Object.entries(customTitles).filter(([type]) => !(templateId.startsWith("pehlione_") && type === "strengths")).map(([, title]) => title);
        const missing = expected.filter((title) => !result[surface].toLocaleLowerCase("de-DE").includes(title.toLocaleLowerCase("de-DE")));
        expect(missing, `${ats ? "ats" : "visual"} / ${surface}`).toEqual([]);
        for (const fixed of ["Beruflicher Werdegang", "Bildungsweg", "Kurzprofil"])
          expect(result[surface], `${ats ? "ats" : "visual"} / ${surface}: ${fixed}`).not.toContain(fixed);
      }
    }
  });
});

describe.each(resumeTemplateIds)("minimal profile in %s", (templateId) => {
  it("draws one page with no empty label, icon line or placeholder", () => {
    for (const ats of [false, true]) {
      const result = renderCv(templateId, minimalProfile(), { ats });
      expect(result.pdfPages, ats ? "ats" : "visual").toHaveLength(1);
      expect(result.previewPages, ats ? "ats" : "visual").toHaveLength(1);
      for (const surface of ["preview", "pdf"] as const) {
        const text = result[surface];
        expect(text).toContain("Mina Kaya");
        expect(text).toContain("Assistentin");
        for (const empty of ["Telefon:", "E-Mail:", "Geburtsort", "Familienstand", "Staatsangehörigkeit", "Kinder:", "Technologien:", "Note:", "undefined", "null", "ergänzen"])
          expect(text, `${surface}: ${empty}`).not.toContain(empty);
        expect(text, surface).not.toMatch(/·\s*·|:\s*$/);
      }
    }
  });
});
