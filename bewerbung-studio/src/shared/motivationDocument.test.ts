import { describe, expect, it } from "vitest";
import { applicationSchema, documentDraftSchema, profileSchema } from "./schema";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { getCoverLetterMainBody } from "./coverLetter";
import { getDocumentFont } from "./documentDesign";
import { resolveCvDocument } from "./resolveCvDocument";
import { resolveDocumentSideMargins } from "./documentSideMargins";
import { resolveLetterTitleColor } from "./resumeTitleColor";
import { setResumePhotoVisible } from "./resumePhoto";
import { getTemplate, templates } from "./templates";
import {
  buildMotivationModel,
  motivationCss,
  motivationParts,
  renderMotivationMarkup,
  splitMotivationParagraphs,
} from "./motivationDocument";

const now = "2026-10-09T09:00:00.000Z";
const signature = "data:image/png;base64,AA==";
const application = applicationSchema.parse({
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", folderName: "Fiktiv",
  company: { name: "Fiktiv GmbH", city: "Kassel" }, contact: {}, job: { title: "Entwicklung" },
  status: "Entwurf", templateId: "modern", accentColor: getTemplate("modern").accent,
  secondaryColor: getTemplate("modern").secondary, designSettings: getTemplateDocumentDesignDefaults("modern"),
  documents: {}, statusHistory: [], createdAt: now, updatedAt: now,
});
const profile = (extra: Record<string, unknown> = {}) => profileSchema.parse({
  id: "00000000-0000-4000-8000-000000000001", isDefault: true, firstName: "Mina", lastName: "Kaya", title: "Softwareentwicklerin",
  street: "Gartenweg 7", postalCode: "34117", city: "Kassel", phone: "+49 170 1234567", email: "mina@example.test",
  signaturePath: signature, updatedAt: now, ...extra,
});
const texts = {
  motivationHeading: "Meine Motivation",
  motivationIntroduction: "Ihre Stellenanzeige hat mich angesprochen.",
  motivationMainBody: "Erster Absatz.\nZweite Zeile.\n\nZweiter Absatz.",
  motivationEvidence: "Konkretes Projektbeispiel.",
  motivationGoals: "Mein Ziel ist Verantwortung.",
  motivationClosing: "Ich freue mich auf das Gespräch.",
};
const model = (templateId = "modern", documents: Record<string, unknown> = texts, cvOverrides?: Record<string, unknown>, extraProfile: Record<string, unknown> = {}) => {
  const settings = { ...getTemplateDocumentDesignDefaults(templateId), ...(cvOverrides ? { cvOverrides } : {}) };
  const current = profile(extraProfile);
  const resolvedCv = resolveCvDocument({ profile: current, templateId, settings });
  return buildMotivationModel({ application, profile: current, documents: documentDraftSchema.parse(documents), resolvedCv });
};

describe("Motivationsschreiben data", () => {
  it("offers the five body fields after the heading in the requested order", () => {
    expect(motivationParts.map(({ field, label }) => [field, label])).toEqual([
      ["motivationIntroduction", "Einleitung"],
      ["motivationMainBody", "Meine Motivation"],
      ["motivationEvidence", "Meine Erfahrungen und Stärken"],
      ["motivationGoals", "Meine Ziele und mein Beitrag"],
      ["motivationClosing", "Schluss"],
    ]);
  });
  it("opens older applications without loss: the switch is off and the texts are empty", () => {
    const legacy = applicationSchema.parse({
      schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", folderName: "Alt", company: { name: "Alt GmbH", city: "Kassel" }, contact: {},
      job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern", accentColor: getTemplate("modern").accent,
      secondaryColor: getTemplate("modern").secondary, designSettings: getTemplateDocumentDesignDefaults("modern"),
      documents: { coverMotivation: "Alter Text", coverIntroduction: "Hallo" }, statusHistory: [], createdAt: now, updatedAt: now,
    });
    expect(legacy.documents).toMatchObject({
      motivationEnabled: false, motivationHeading: "Meine Motivation", motivationHeadingGapReduction: 0,
      motivationSalutationGapReduction: 0, motivationIntroduction: "", motivationMainBody: "",
      motivationEvidence: "", motivationGoals: "", motivationClosing: "", coverMotivation: "Alter Text", coverIntroduction: "Hallo",
    });
  });

  it("moves the heading and following text up without moving the Briefkopf", () => {
    const standard = model();
    const compact = model("modern", { ...texts, motivationHeadingGapReduction: 4 });
    expect(standard.style["--mv-header-gap"]).toBe("calc(var(--mv-body-size) * var(--mv-line-height) * 8)");
    expect(compact.style["--mv-header-gap"]).toBe("calc(var(--mv-body-size) * var(--mv-line-height) * 4)");
    expect(compact.style["--mv-margin-top"]).toBe(standard.style["--mv-margin-top"]);
    expect(compact.style["--mv-title-gap"]).toBe(standard.style["--mv-title-gap"]);
    expect(documentDraftSchema.safeParse({ motivationHeadingGapReduction: 5 }).success).toBe(false);
  });

  it("moves the Anrede and following text up on its own, keeping one empty line under the Überschrift", () => {
    const standard = model();
    const compact = model("modern", { ...texts, motivationSalutationGapReduction: 3 });
    expect(standard.style["--mv-title-gap"]).toBe("calc(var(--mv-body-size) * var(--mv-line-height) * 4)");
    expect(compact.style["--mv-title-gap"]).toBe("calc(var(--mv-body-size) * var(--mv-line-height) * 1)");
    // The Überschrift does not move with it.
    expect(compact.style["--mv-header-gap"]).toBe(standard.style["--mv-header-gap"]);
    expect(documentDraftSchema.safeParse({ motivationSalutationGapReduction: 4 }).success).toBe(false);
    expect(documentDraftSchema.parse({}).motivationSalutationGapReduction).toBe(0);
  });

  it("never mixes with the cover letter's coverMotivation", () => {
    const fromCover = model("modern", { coverMotivation: "Nur im Anschreiben" });
    expect(fromCover.paragraphs).toEqual([]);
    expect(renderMotivationMarkup(fromCover)).not.toContain("Nur im Anschreiben");
    const docs = documentDraftSchema.parse({ ...texts, coverMainBody: "Anschreiben-Text" });
    expect(getCoverLetterMainBody(docs)).toBe("Anschreiben-Text");
    expect(getCoverLetterMainBody(docs)).not.toContain("Erster Absatz");
  });

  it("omits empty optional sections and keeps an explicit CV body-size choice", () => {
    const selected = model("modern", { motivationIntroduction: "Eigener Einstieg" }, { typography: { bodySizePt: 9.5 } });
    expect(selected.paragraphs.map((paragraph) => paragraph.part)).toEqual(["introduction"]);
    expect(renderMotivationMarkup(selected)).not.toContain('data-part="evidence"');
    expect(selected.style["--mv-body-size"]).toBe("9.5pt");
  });

  it("prints the parts in order, splits paragraphs on empty lines and keeps line breaks inside one", () => {
    expect(splitMotivationParagraphs("A\nB\n\n\nC\r\n\r\nD")).toEqual(["A\nB", "C", "D"]);
    const result = model();
    expect(result.paragraphs.map((paragraph) => [paragraph.part, paragraph.text])).toEqual([
      ["introduction", texts.motivationIntroduction], ["mainBody", "Erster Absatz.\nZweite Zeile."], ["mainBody", "Zweiter Absatz."],
      ["evidence", texts.motivationEvidence],
      ["goals", texts.motivationGoals], ["closing", texts.motivationClosing],
    ]);
    expect(motivationCss).toContain("white-space:pre-line");
  });

  it("keeps generated structure but omits empty user paragraphs", () => {
    const empty = model("modern", {});
    expect(empty.isEmpty).toBe(true);
    const markup = renderMotivationMarkup(empty);
    expect(markup).toContain("Meine Motivation");
    expect(markup).toContain("Sehr geehrte Damen und Herren,");
    expect(markup).toContain("Mit freundlichen Grüßen");
    expect(markup).not.toContain('class="mv-body"');
    expect(markup).not.toContain('class="mv-paragraph"');
    expect(markup).toContain("Mina Kaya");
  });

  it("never prints position, company, Arbeitsort or a recipient block", () => {
    const long = applicationSchema.parse({ ...application,
      company: { name: "Scherer Staffing GmbH", city: "Erlangen", street: "Hauptstraße 1", postalCode: "91052" },
      job: { title: "Fullstack-Softwareentwickler Go / Cloud", location: "Erlangen" },
    });
    const result = buildMotivationModel({ application: long, profile: profile(), documents: documentDraftSchema.parse(texts),
      resolvedCv: resolveCvDocument({ profile: profile(), templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") }) });
    const markup = renderMotivationMarkup(result);
    expect(markup).not.toMatch(/Bewerbung als|Fullstack|Scherer|Erlangen|Hauptstraße|91052|Arbeitsort|Motivation für/);
    expect(markup).not.toMatch(/mv-context|mv-eyebrow|mv-recipient|<address/);
  });

  it("draws a plain Briefkopf: name on the left, address, phone and e-mail on the right", () => {
    const result = model();
    expect(result.name).toBe("Mina Kaya");
    expect(result.contacts).toEqual([
      { kind: "street", text: "Gartenweg 7", href: "" },
      { kind: "city", text: "34117 Kassel", href: "" },
      { kind: "phone", text: "+49 170 1234567", href: "tel:+491701234567" },
      { kind: "email", text: "mina@example.test", href: "mailto:mina@example.test" },
    ]);
    const markup = renderMotivationMarkup(result);
    expect(markup).toMatch(/<header class="mv-header"><h1 class="mv-name">Mina Kaya<\/h1><ul class="mv-contacts">/);
    // The professional title is not part of this Briefkopf.
    expect(markup).not.toContain("Softwareentwicklerin");
    expect(motivationCss).toContain(".motivation .mv-header{display:flex;align-items:flex-start;justify-content:space-between;");
    expect(motivationCss).toMatch(/\.motivation \.mv-contacts\{[^}]*text-align:right/);
    // No decoration: no bands, cards, icons or background shapes.
    expect(motivationCss).not.toMatch(/gradient|box-shadow|border-radius|::before|::after|svg/);
    expect(model("modern", texts, undefined, { street: "", postalCode: "", city: "", phone: "", email: "" }).contacts).toEqual([]);
  });

  it("closes with Grußformel, the profile's signature, the name and Ort und Datum", () => {
    const result = model();
    expect(result.closing).toEqual({ greeting: "Mit freundlichen Grüßen", signatureSource: signature, signer: "Mina Kaya",
      placeDate: "Kassel, 9. Oktober 2026" });
    expect(model("modern", texts, undefined, { signaturePath: "" }).closing.signatureSource).toBe("");
    expect(model("modern", texts, undefined, { city: "" }).closing.placeDate).toBe("9. Oktober 2026");
    const sent = buildMotivationModel({ application: { ...application, sentAt: "2026-11-02T10:00:00.000Z" }, profile: profile(),
      documents: documentDraftSchema.parse(texts),
      resolvedCv: resolveCvDocument({ profile: profile(), templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") }) });
    expect(sent.closing.placeDate).toBe("Kassel, 2. November 2026");
    expect(renderMotivationMarkup(result)).toContain('<p class="mv-place-date">Kassel, 9. Oktober 2026</p>');
  });

  it("escapes every user text in the export markup", () => {
    const markup = renderMotivationMarkup(model("modern", {
      motivationHeading: '<b>Fett</b> & "Zitat"', motivationIntroduction: "<img src=x onerror=alert(1)><script>alert(1)</script>",
    }, undefined, { firstName: "<i>Mina</i>", street: "Weg 1\" onload=\"x" }));
    expect(markup).not.toMatch(/<script|<img src=x|<b>Fett|<i>Mina/);
    expect(markup).toContain("&lt;b&gt;Fett&lt;/b&gt; &amp; &quot;Zitat&quot;");
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain('" onload="');
    const unsafeContact = applicationSchema.parse({ ...application, contact: { salutation: "Frau", lastName: "<b>Kaya</b>" } });
    const result = buildMotivationModel({ application: unsafeContact, profile: profile(), documents: documentDraftSchema.parse(texts),
      resolvedCv: resolveCvDocument({ profile: profile(), templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") }) });
    expect(renderMotivationMarkup(result)).toContain("Sehr geehrte Frau &lt;b&gt;Kaya&lt;/b&gt;,");
  });

  it("never cuts, hides or scales the text", () => {
    expect(motivationCss).not.toMatch(/(?<!text-)transform:|scale\(|line-clamp|text-overflow|max-height:297mm/);
    // No rule that holds text may clip it.
    const textRules = motivationCss.split("\n").filter((line) => /^\.motivation(\{| \.mv-(body|paragraph|closing|heading|header)\{)/.test(line));
    expect(textRules.length).toBeGreaterThanOrEqual(6);
    for (const rule of textRules) expect(rule, rule).not.toMatch(/overflow:hidden|[^-]height:297mm|position:absolute/);
    // An A4 page that grows; a following PDF page repeats margins and background.
    expect(motivationCss).toMatch(/^\.motivation\{[^}]*width:210mm;min-height:297mm;[^}]*box-decoration-break:clone/m);
    // Paragraphs in Blocksatz (user's choice); Briefkopf and Überschrift stay left-aligned.
    expect(motivationCss).toMatch(/\.mv-paragraph\{[^}]*text-align:justify;text-justify:inter-word;hyphens:auto/);
    expect(motivationCss).toMatch(/\.mv-heading\{[^}]*text-align:left/);
    expect(motivationCss.match(/text-align:justify/g)).toHaveLength(1);
  });
});

describe("Motivationsschreiben Anrede: from the application's Ansprechpartner", () => {
  const withContact = (contact: Record<string, unknown>, additionalContacts: Record<string, unknown>[] = []) => {
    const current = applicationSchema.parse({ ...application, contact, additionalContacts });
    return buildMotivationModel({ application: current, profile: profile(), documents: documentDraftSchema.parse(texts),
      resolvedCv: resolveCvDocument({ profile: profile(), templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") }) });
  };

  it("addresses Frau and Herr by their last name and falls back to Damen und Herren", () => {
    expect(withContact({ salutation: "Frau", firstName: "Anna", lastName: "Schulz" }).salutation).toBe("Sehr geehrte Frau Schulz,");
    expect(withContact({ salutation: "Herr", firstName: "Jan", lastName: "Berger" }).salutation).toBe("Sehr geehrter Herr Berger,");
    expect(withContact({}).salutation).toBe("Sehr geehrte Damen und Herren,");
    expect(withContact({ salutation: "Frau" }).salutation).toBe("Sehr geehrte Damen und Herren,");
  });

  it("keeps the application's existing rules for other forms and a second contact", () => {
    expect(withContact({ salutation: "Divers", firstName: "Kim", lastName: "Lee" }).salutation).toBe("Guten Tag Kim Lee,");
    expect(withContact({ salutation: "Frau", lastName: "Schulz" }, [{ salutation: "Herr", lastName: "Berger" }]).salutation)
      .toBe("Sehr geehrte Frau Schulz, sehr geehrter Herr Berger,");
  });

  it("follows a changed Ansprechpartner and never stores the Anrede or uses the Anschreiben's own", () => {
    expect(withContact({ salutation: "Frau", lastName: "Schulz" }).salutation).toBe("Sehr geehrte Frau Schulz,");
    expect(withContact({ salutation: "Herr", lastName: "Berger" }).salutation).toBe("Sehr geehrter Herr Berger,");
    const custom = buildMotivationModel({ application, profile: profile(),
      documents: documentDraftSchema.parse({ ...texts, coverGreeting: "Liebes Team," }),
      resolvedCv: resolveCvDocument({ profile: profile(), templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") }) });
    expect(custom.salutation).toBe("Sehr geehrte Damen und Herren,");
    // Only the spacing above the Anrede is stored, never its text.
    expect(Object.keys(documentDraftSchema.parse({})).filter((key) => /motivation.*(greeting|salutation|anrede)/i.test(key) && !key.endsWith("GapReduction"))).toEqual([]);
  });
});

describe("Motivationsschreiben design: the selected Lebenslauf's effective design", () => {
  it("takes global and application CV design layers from the resolved CV", () => {
    const current = profile();
    const settings = { ...getTemplateDocumentDesignDefaults("modern"),
      cvOverrides: { colors: { divider: "#235b76" } } };
    const resolvedCv = resolveCvDocument({ profile: current, templateId: "modern", settings,
      globalDesign: { cvOverrides: { typography: { bodySizePt: 12 }, spacing: { pageMarginMm: 23 } } },
    });
    const result = buildMotivationModel({ application, profile: current, documents: documentDraftSchema.parse(texts), resolvedCv });
    expect(result.style).toMatchObject({ "--mv-line": "#235b76", "--mv-body-size": "12pt",
      "--mv-margin-left": "23mm", "--mv-margin-right": "23mm" });
  });

  it("carries a changed colour, font, weight, size, line height, margin and spacing as it is", () => {
    const changed = model("modern", texts, {
      typography: { bodySizePt: 12.5, lineHeight: 1.6, fontId: "georgia", headingFontId: "georgia", sectionHeadingWeight: 800,
        sectionHeadingSizePt: 15, headingSizePt: 24, headingWeight: 600 },
      colors: { paragraph: "#7a1f1f", sectionHeading: "#1f6f2a", heading: "#4b1d7a", muted: "#526471", divider: "#123456", background: "#fffdf7" },
      spacing: { pageMarginMm: 14, innerPaddingMm: 2, sectionGapMm: 11, entryGapMm: 7, sectionTitleGapMm: 5 },
    });
    expect(changed.style).toMatchObject({
      "--mv-body-size": "12.5pt", "--mv-line-height": "1.6",
      "--mv-font": getDocumentFont("georgia").family, "--mv-heading-font": getDocumentFont("georgia").family,
      "--mv-heading-weight": "800", "--mv-heading-size": "15pt", "--mv-name-size": "24pt", "--mv-name-weight": "600",
      "--mv-text": "#7a1f1f", "--mv-name-color": "#4b1d7a", "--mv-contact-color": "#526471",
      "--mv-line": "#123456", "--mv-background": "#fffdf7",
      // Left and right follow the Lebenslauf's Seitenränder (Modern: both sides); top and bottom stay 20 mm.
      "--mv-margin-left": "14mm", "--mv-margin-right": "14mm", "--mv-margin-top": "20mm", "--mv-margin-bottom": "20mm",
      "--mv-paragraph-gap": "7mm",
      // Überschrift: 8 empty lines below the Briefkopf, 4 above the Anrede, whatever the section gaps of the Lebenslauf.
      "--mv-header-gap": "calc(var(--mv-body-size) * var(--mv-line-height) * 8)",
      "--mv-title-gap": "calc(var(--mv-body-size) * var(--mv-line-height) * 4)",
    });
  });

  it("uses the selected Lebenslauf's name and reading sizes even at template defaults", () => {
    for (const template of templates) {
      const cv = resolveCvDocument({ profile: profile(), templateId: template.id,
        settings: getTemplateDocumentDesignDefaults(template.id) });
      const sides = resolveDocumentSideMargins(template.id, cv.design.spacing);
      const bodySize = cv.design.typography.bodySizePt;
      const paragraphGap = Math.round(bodySize * 1.3 * 25.4 / 72 * 100) / 100;
      expect(model(template.id).style, template.id).toMatchObject({
        "--mv-body-size": `${bodySize}pt`, "--mv-name-size": `${cv.design.typography.headingSizePt}pt`,
        "--mv-font": getDocumentFont(cv.design.typography.fontId).family,
        "--mv-heading-font": getDocumentFont(cv.design.typography.headingFontId).family,
        "--mv-line-height": "1.3", "--mv-heading-size": "16pt", "--mv-heading-weight": "700",
        "--mv-margin-left": `${sides.leftMm}mm`, "--mv-margin-right": `${sides.rightMm}mm`, "--mv-margin-top": "20mm", "--mv-margin-bottom": "20mm",
        "--mv-paragraph-gap": `${paragraphGap}mm`,
      });
    }
  });

  it("keeps an explicit smaller body size and never shrinks long text on its own", () => {
    expect(model("modern", texts, { typography: { bodySizePt: 9.5 } }).style["--mv-body-size"]).toBe("9.5pt");
    for (const template of templates) {
      const cv = resolveCvDocument({ profile: profile(), templateId: template.id,
        settings: getTemplateDocumentDesignDefaults(template.id) });
      expect(Number.parseFloat(model(template.id, { ...texts, motivationMainBody: "Langer Text. ".repeat(800) }).style["--mv-body-size"]),
        template.id).toBe(cv.design.typography.bodySizePt);
    }
  });

  it("colours the Überschrift like the Lebenslauf's professional title, also when the user changes it", () => {
    expect(model("modern").style["--mv-heading-color"]).toBe(getTemplate("modern").accent);
    expect(model("modern", texts, { colors: { subheading: "#b0122e" } }).style["--mv-heading-color"]).toBe("#b0122e");
    expect(model("modern", texts, { colors: { accent: "#7a2e8e" } }).style["--mv-heading-color"]).toBe("#7a2e8e");
    // Theme colours chosen in the preview (not saved yet) are followed too.
    const cv = resolveCvDocument({ profile: profile(), templateId: "modern", settings: getTemplateDocumentDesignDefaults("modern") });
    const themed = buildMotivationModel({ application, profile: profile(), documents: documentDraftSchema.parse(texts), resolvedCv: cv,
      themeColors: { accentColor: "#1f7a3a", secondaryColor: "#e3f2e8" } });
    expect(themed.style["--mv-heading-color"]).toBe("#1f7a3a");
  });

  it("takes every template's own fonts and colours", () => {
    for (const template of templates) {
      const result = model(template.id);
      const settings = getTemplateDocumentDesignDefaults(template.id);
      const cv = resolveCvDocument({ profile: profile(), templateId: template.id, settings });
      expect(result.templateId, template.id).toBe(cv.templateId);
      expect(result.style["--mv-line"], template.id).toBe(cv.design.colors.divider);
      expect(result.style["--mv-background"], template.id).toBe(cv.design.colors.background);
      // The Überschrift has the colour of the Lebenslauf's professional title.
      expect(result.style["--mv-heading-color"], template.id).toBe(resolveLetterTitleColor(cv,
        { accentColor: application.accentColor, secondaryColor: application.secondaryColor }, cv.design.colors.background));
      expect([cv.design.colors.heading, cv.design.colors.sectionHeading, cv.design.colors.text], template.id)
        .toContain(result.style["--mv-name-color"]);
      expect(result.style["--mv-font"], template.id).toBe(getDocumentFont(cv.design.typography.fontId).family);
      expect(result.style["--mv-heading-font"], template.id).toBe(getDocumentFont(cv.design.typography.headingFontId).family);
    }
  });

  it("keeps the Motivation header photo-free even when the Lebenslauf shows a photo", () => {
    const photo = "data:image/png;base64,AA==";
    const shown = setResumePhotoVisible(profile({ photoPath: photo }), true);
    const visible = model("modern", texts, undefined, {
      photoPath: photo, resumeSemanticSections: shown.resumeSemanticSections, resumeManagerOverrides: shown.resumeManagerOverrides,
    });
    expect(renderMotivationMarkup(visible)).not.toContain("mv-photo");
    expect(renderMotivationMarkup(visible)).not.toContain(`src="${photo}" alt=""`);
    expect(motivationCss).not.toContain(".mv-photo");
  });
});
