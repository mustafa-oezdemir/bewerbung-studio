import { describe, expect, it } from "vitest";
import { applicationSchema, profileSchema } from "../src/shared/schema";
import { resolveResumeSectionInstances } from "../src/features/resume-sections/resume-section-system";
import { buildDocumentHtml } from "./documents";
import { buildDeckblattModel, deckblattCss, deckblattDesignIds, deckblattFitScript, renderDeckblattMarkup } from "../src/shared/deckblattDesigns";
import { templates } from "../src/shared/templates";
import { getTemplateDocumentDesignDefaults } from "../src/shared/cvDesign";
import { createDocumentDesignDraft, resetDocumentDesign } from "../src/shared/documentEditorState";
import { strengthSymbolOptions } from "../src/shared/strengthSymbols";
import { parseHTML } from "linkedom";
import { getZweispaltigLetterVariables, zweispaltigLetterCss } from "../src/shared/zweispaltigLetterIdentity";
import { resolveCvDocument } from "../src/shared/resolveCvDocument";
import { moveManagerSection, updateManagerSection } from "../src/features/resume-sections/resume-manager";

const now = new Date("2026-07-19T10:00:00.000Z").toISOString();

const application = applicationSchema.parse({
  schemaVersion: 1,
  id: "d50ac50f-cafe-4ca3-b06b-a98b0bb1fa11",
  folderName: "Beispiel-GmbH",
  company: {
    name: "Beispiel GmbH",
    city: "Berlin",
  },
  contact: {},
  job: {
    title: "Senior Softwareentwickler",
  },
  status: "Entwurf",
  templateId: "modern-sidebar",
  accentColor: "#ff5a00",
  secondaryColor: "#9e0000",
  documents: {
    resumeProfile: "Mehrjährige Erfahrung in skalierbaren Plattformen.",
  },
  statusHistory: [],
  createdAt: now,
  updatedAt: now,
});

const profile = profileSchema.parse({
  id: "f42f1006-799c-48bc-a705-4fa4533b8ac8",
  isDefault: true,
  resumeSemanticSections: resolveResumeSectionInstances([]).map((section) => section.semanticType === "photo" ? { ...section, visible: true, enabled: true } : section),
  firstName: "Mina",
  lastName: "Kaya",
  title: "Softwareentwicklerin",
  city: "Berlin",
  email: "mina@example.com",
  summary: "Erfahrung mit TypeScript und React.",
  skills: ["TypeScript", "React", "Node.js"],
  experiences: [
    {
      id: "0f15f341-0b0d-49de-8b14-d53d517577f2",
      from: "01/2022",
      to: "Heute",
      role: "Senior Entwicklerin",
      company: "Beispiel GmbH",
      city: "Berlin",
      achievements: ["Ladezeiten um 30 % reduziert."],
    },
  ],
  education: [],
  languages: ["Deutsch", "Englisch"],
  certifications: [],
  updatedAt: now,
});

describe("Lebenslauf-Dokumente", () => {
  it("uses Zweispaltig CV identity and profile data in the letter without changing stored values", () => {
    const source = profileSchema.parse({ ...profile, firstName: "Mustafa", lastName: "Özdemir", title: "Prozessplaner" });
    const selected = applicationSchema.parse({
      ...application, templateId: "zweispaltig", accentColor: "#123456", secondaryColor: "#ABCDEF",
      designSettings: getTemplateDocumentDesignDefaults("zweispaltig"),
      documents: { ...application.documents, coverSenderName: "Alter Name", coverSenderTitle: "Alter Titel", coverSenderContact: "Alte Kontaktzeile" },
    });
    const resolved = resolveCvDocument({ profile: source, templateId: "zweispaltig", settings: selected.designSettings, application: selected });
    const expected = getZweispaltigLetterVariables(resolved.design, resolved.settings, selected.accentColor, selected.secondaryColor);
    const letterHtml = buildDocumentHtml(selected, source, "anschreiben");
    const letter = parseHTML(letterHtml).document.querySelector<HTMLElement>(".zweispaltig-letter");
    const cv = parseHTML(buildDocumentHtml(selected, source, "lebenslauf")).document.querySelector<HTMLElement>(".zweispaltig-pdf");
    expect(letter?.querySelector(".sender-name")?.textContent).toBe("Mustafa Özdemir");
    expect(letter?.querySelector(".sender-title")?.textContent).toBe("Prozessplaner");
    expect(letter?.querySelector(".sender-contact")?.textContent).toContain(source.email);
    expect(letterHtml).toContain(zweispaltigLetterCss);
    expect(zweispaltigLetterCss).toContain("text-transform:uppercase");
    expect(expected["--letter-identity-primary"]).toBe("#123456");
    expect(expected["--letter-identity-accent"]).toBe("#ABCDEF");
    expect(letter?.style.getPropertyValue("--letter-identity-primary")).toBe(expected["--letter-identity-primary"]);
    expect(letter?.style.getPropertyValue("--letter-identity-accent")).toBe(expected["--letter-identity-accent"]);
    expect(letter?.style.getPropertyValue("--letter-identity-divider")).toBe(expected["--letter-identity-divider"]);
    expect(letter?.style.getPropertyValue("--letter-subject-size")).toBe("13pt");
    expect(letter?.style.getPropertyValue("--letter-body-size")).toBe("11pt");
    expect(zweispaltigLetterCss).toContain("font-size:var(--letter-subject-size)!important");
    expect(zweispaltigLetterCss).toContain("font-size:11pt!important");
    expect(cv?.style.getPropertyValue("--accent")).toBe("#123456");
    expect(cv?.style.getPropertyValue("--secondary")).toBe("#ABCDEF");
    expect(source.firstName).toBe("Mustafa");
    expect(selected.documents.coverSenderName).toBe("Alter Name");
  });

  it("follows Zweispaltig CV colour overrides in the letter", () => {
    const selected = applicationSchema.parse({
      ...application, templateId: "zweispaltig", accentColor: "#123456", secondaryColor: "#ABCDEF",
      designSettings: { ...getTemplateDocumentDesignDefaults("zweispaltig"), cvOverrides: { colors: {
        heading: "#334455", subheading: "#667788", divider: "#112233", text: "#222222",
      } } },
    });
    const letter = parseHTML(buildDocumentHtml(selected, profile, "anschreiben")).document.querySelector<HTMLElement>(".zweispaltig-letter");
    expect(letter?.style.getPropertyValue("--letter-identity-primary")).toBe("#334455");
    expect(letter?.style.getPropertyValue("--letter-identity-accent")).toBe("#667788");
    expect(letter?.style.getPropertyValue("--letter-identity-divider")).toBe("#112233");
    expect(letter?.style.getPropertyValue("--letter-identity-text")).toBe("#222222");
  });

  it("leaves other cover-letter template styles untouched", () => {
    const html = buildDocumentHtml(application, profile, "anschreiben");
    expect(html).not.toContain(zweispaltigLetterCss);
    expect(html).not.toContain("zweispaltig-letter");
    expect(html).toContain('<span class="sender-name">Mina Kaya</span>');
    expect(html).toContain(".sender-name{color:#000;font-size:16pt;font-weight:800;line-height:1.12}");
  });
  it.each(templates)("keeps profile content when old presentation copies exist in $name", (template) => {
    const original = { ...application, templateId: template.id };
    const edited = { ...original, designSettings: { ...original.designSettings, resumePresentation: { sections: { summary: { visible: false } }, personalFields: { email: false } } } };
    const html = buildDocumentHtml(edited, profile, "lebenslauf");
    expect(html).not.toContain(application.documents.resumeProfile);
    expect(html).toContain(profile.email);
    expect(buildDocumentHtml(edited, profile, "anschreiben")).toBe(buildDocumentHtml(original, profile, "anschreiben"));
    expect(profile.email).toBe("mina@example.com");
  });
  it.each(templates)("restores the original PDF after resetting $name", (template) => {
    const original = {
      ...application, templateId: template.id, accentColor: template.accent,
      secondaryColor: template.secondary, designSettings: getTemplateDocumentDesignDefaults(template.id),
    };
    const modified = {
      ...original, accentColor: "#aabbcc", secondaryColor: "#ccbbaa",
      designSettings: { ...original.designSettings, marginLevel: 9 as const, fontId: "arial" as const, cvOverrides: { colors: { text: "#abcdef" } } },
    };
    const reset = resetDocumentDesign(createDocumentDesignDraft(modified));
    const restored = { ...modified, accentColor: reset.accentColor, secondaryColor: reset.secondaryColor, designSettings: reset.settings };
    expect(buildDocumentHtml(restored, profile, "lebenslauf")).toBe(buildDocumentHtml(original, profile, "lebenslauf"));
  });
  it.each(["classic-professional", "modern-sidebar", "minimal-clean", "technical-developer", "executive-dark", "creative-accent", "pehlione_white", "pehlione_white_blue", "modern", "elegant", "zweispaltig", "zeitgenoessisch", "kreativ", "gepflegt", "kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league"])("uses shared contact icons in %s", (templateId) => {
    const contactProfile = profileSchema.parse({
      ...profile,
      phone: "+49123456789",
      linkedin: "https://linkedin.com/in/example",
    });
    const { document } = parseHTML(buildDocumentHtml(
      applicationSchema.parse({ ...application, templateId }),
      contactProfile,
      "lebenslauf",
    ));
    for (const kind of ["phone", "email", "linkedin", "location"]) {
      expect(document.querySelector(`svg[data-contact-icon="${kind}"]`)).not.toBeNull();
    }
  });

  it.each(["visual", "ats"])("exports separate Tabellarisch social links in %s mode", (mode) => {
    const contactProfile = profileSchema.parse({
      ...profile,
      linkedin: "https://linkedin.com/in/example",
      github: "https://github.com/example",
      portfolio: "https://example.com",
    });
    const documentApplication = applicationSchema.parse({
      ...application,
      templateId: "tabellarisch",
      designSettings: { ...application.designSettings, resumeOutputMode: mode },
    });
    const { document } = parseHTML(buildDocumentHtml(documentApplication, contactProfile, "lebenslauf"));
    const contacts = document.querySelector(".tabellarisch-pdf-contacts");
    for (const [kind, url] of [["linkedin", contactProfile.linkedin], ["github", contactProfile.github], ["website", contactProfile.portfolio]]) {
      expect(contacts?.querySelector(`[data-contact-kind="${kind}"] a`)?.getAttribute("href")).toBe(url);
    }
  });

  it.each(["pehlione_white", "pehlione_white_blue", "modern", "elegant", "zweispaltig", "zeitgenoessisch", "kreativ", "gepflegt", "kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league"])("exports nine strengths in three columns in %s", (templateId) => {
    const strengths = ["Go", "React", "Spring Boot", "SQL", "Docker", "Git", "Linux", "Java", "TypeScript"].map((title) => ({ id: crypto.randomUUID(), title, description: title === "Go" ? "Echo, Gin" : "", iconId: "" }));
    const html = buildDocumentHtml({ ...application, templateId }, { ...profile, strengths }, "lebenslauf");
    const { document } = parseHTML(html);
    expect(document.querySelectorAll(".managed-strengths-grid")).toHaveLength(1);
    expect(Array.from(document.querySelectorAll(".managed-strength-card strong")).map((node) => node.textContent)).toEqual(strengths.map((item) => item.title));
    expect(html).toContain("grid-template-columns:repeat(3,minmax(0,1fr))");
  });
  it.each(["pehlione_white", "pehlione_white_blue", "modern", "elegant", "zweispaltig", "zeitgenoessisch", "kreativ", "gepflegt", "kompakt", "stilvoll", "einspaltig", "klassisch", "tabellarisch", "ivy-league"])("applies the unified section order, custom content and visibility in %s", (templateId) => {
    let managed = profileSchema.parse({ ...profile, education: [{ id: crypto.randomUUID(), from: "2018", to: "2021", degree: "Testabschluss", institution: "Testinstitut" }], specialSections: [{ id: "aaaa0000-0000-4000-8000-000000000000", kind: "volunteer", title: "Ehrenamt", isVisible: true, entries: [{ id: crypto.randomUUID(), title: "Vereinsarbeit" }] }] });
    managed = moveManagerSection(managed, templateId, "education", "main", 0);
    managed = updateManagerSection(managed, templateId, "education", { title: "Mein Bildungsweg" });
    const { document } = parseHTML(buildDocumentHtml({ ...application, templateId }, managed, "lebenslauf"));
    const education = document.querySelector('[data-managed-section="education"]');
    const experience = document.querySelector('[data-managed-section="experience"]');
    expect(education, `${templateId}: education`).not.toBeNull();
    expect(experience, `${templateId}: experience`).not.toBeNull();
    expect(education!.parentElement).toBe(experience!.parentElement);
    const ordered = Array.from(education!.parentElement!.children);
    if (templateId === "kreativ") expect(ordered.indexOf(experience!)).toBeLessThan(ordered.indexOf(education!));
    else expect(ordered.indexOf(education!)).toBeLessThan(ordered.indexOf(experience!));
    expect(education!.textContent).toContain("Mein Bildungsweg");
    expect(document.querySelectorAll('[data-managed-section="special:aaaa0000-0000-4000-8000-000000000000"]')).toHaveLength(1);
    const hidden = updateManagerSection(managed, templateId, "education", { visible: false });
    expect(parseHTML(buildDocumentHtml({ ...application, templateId }, hidden, "lebenslauf")).document.querySelector('[data-managed-section="education"]')).toBeNull();
  });
  it("allows hiding career, education and personal data without changing saved content; the Überschrift stays", () => {
    const hiddenProfile = profileSchema.parse({
      ...profile,
      resumeSections: { ...profile.resumeSections, experience: false, education: false },
      resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
        ["personalData", "career", "education"].includes(section.semanticType)
          ? { ...section, visible: false, enabled: false } : section),
    });
    const html = buildDocumentHtml({ ...application, templateId: "pehlione_white" }, hiddenProfile, "lebenslauf");
    expect(html).not.toContain("Ladezeiten um 30 % reduziert.");
    expect(html).toContain(".pehlione-contacts");
    expect(html).toContain("display:none!important");
    expect(hiddenProfile.experiences).toEqual(profile.experiences);
  });
  it("preserves chosen strength symbols in PDF with inherited text color", () => {
    for (const symbol of strengthSymbolOptions) {
      const symbolProfile = profileSchema.parse({ ...profile, strengths: [{
        id: crypto.randomUUID(), title: "Analytisches Denken", description: "Strukturierte Analyse", iconId: symbol.id,
      }] });
      const pdf = buildDocumentHtml({ ...application, templateId: "modern" }, symbolProfile, "lebenslauf");
      expect(pdf).toContain(`data-strength-symbol="${symbol.id}" style="color:inherit"`);
      expect(pdf).toContain('stroke="currentColor"');
    }
  });
  it("renders Deckblatt information from the actual profile data", () => {
    const deckblattProfile = profileSchema.parse({
      ...profile,
      street: "Musterstraße 1",
      postalCode: "10115",
      phone: "+49 30 123456",
      linkedin: "linkedin.com/in/mina-kaya",
      photoPath: "data:image/png;base64,AA==",
    });
    const html = buildDocumentHtml(application, deckblattProfile, "deckblatt", [
      {
        id: "50f9a46a-f5f6-4101-9eb0-bbef5b9dc557",
        applicationId: application.id,
        category: "Zeugnisse",
        fileName: "Arbeitszeugnis.pdf",
        description: "",
        documentDate: "",
        order: 0,
        includedInPackage: true,
        createdAt: now,
      },
    ]);

    expect(html).toContain("Bewerbung als Senior Softwareentwickler");
    expect(html).not.toContain('<p class="kicker">Bewerbung</p>');
    expect(html).toContain("Standort: Berlin");
    expect(html).toContain("19.07.2026");
    expect(html).toContain("Musterstraße 1, 10115 Berlin");
    expect(html).toContain('href="mailto:mina@example.com"');
    expect(html).toContain('href="https://linkedin.com/in/mina-kaya"');
    expect(html).toContain('class="cover-photo"');
    expect(html).toContain("Kernkompetenzen");
    expect(html).toContain("Bewerbungsunterlagen");
    expect(html).toContain("<li>Anschreiben</li>");
    expect(html).toContain("<li>Lebenslauf</li>");
    expect(html).toContain(
      ".deckblatt .cover-identity{width:100%;margin-top:21mm}",
    );
    expect(html).toContain(
      ".deckblatt .cover-statement{width:100%;margin-top:5mm!important;line-height:1.45!important;text-align:justify;text-justify:inter-word;hyphens:auto}",
    );
    expect(html).toContain(
      ".deckblatt .cover-details{display:grid;grid-template-columns:34% minmax(0,1fr);gap:0",
    );
    expect(html).toContain(
      ".deckblatt .cover-details>div:nth-child(2){padding-left:4mm}",
    );
    expect(html).toContain("<li>Arbeitszeugnis.pdf</li>");
  });

  it("prints the chosen Deckblatt design with the very markup and stylesheet of the preview", () => {
    const attachments = [{
      id: "50f9a46a-f5f6-4101-9eb0-bbef5b9dc557", applicationId: application.id, category: "Zeugnisse" as const, fileName: "Arbeitszeugnis.pdf",
      description: "", documentDate: "", order: 0, includedInPackage: true, createdAt: now,
    }];
    const designProfile = profileSchema.parse({ ...profile, street: "Musterstraße 1", postalCode: "10115", phone: "+49 30 123456", photoPath: "data:image/png;base64,AA==" });
    for (const designId of deckblattDesignIds) {
      const chosen = applicationSchema.parse({ ...application, documents: { ...application.documents, coverSheetDesign: designId } });
      const html = buildDocumentHtml(chosen, designProfile, "deckblatt", attachments);
      const model = buildDeckblattModel({
        application: chosen, profile: designProfile, documents: chosen.documents, attachments,
        accentColor: chosen.accentColor, secondaryColor: chosen.secondaryColor, settings: chosen.designSettings,
      });
      expect(html, designId).toContain(renderDeckblattMarkup(model));
      expect(html, designId).toContain(deckblattCss);
      expect(html, designId).toContain(`deckblatt--${designId}`);
      // The theme colour of the application reaches the page.
      expect(html, designId).toContain("--accent:#ff5a00");
    }
    // Only the classic design sits on the background of the document design.
    const withBackground = (designId: string) => {
      const chosen = applicationSchema.parse({
        ...application, documents: { ...application.documents, coverSheetDesign: designId },
        designSettings: { ...application.designSettings, backgroundId: "programming-languages-bg" },
      });
      const html = buildDocumentHtml(chosen, designProfile, "deckblatt", attachments);
      return html.slice(html.indexOf('class="page cover-page'));
    };
    expect(withBackground("klassisch")).toContain("document-background-layer");
    expect(withBackground("pastell")).not.toContain("document-background-layer");
    expect(withBackground("akzentband")).not.toContain("document-background-layer");
    expect(withBackground("farbbalken")).not.toContain("document-background-layer");
  });

  it("fits the contact rows of the Deckblatt inside the exported page, and only there", () => {
    for (const target of ["deckblatt", "mappe"] as const) {
      expect(buildDocumentHtml(application, profile, target), target).toContain(deckblattFitScript);
    }
    for (const target of ["anschreiben", "lebenslauf"] as const) {
      expect(buildDocumentHtml(application, profile, target), target).not.toContain(deckblattFitScript);
    }
  });

  it("does not repeat the Bewerbung-als prefix on the Deckblatt", () => {
    const alreadyPrefixed = applicationSchema.parse({
      ...application,
      job: {
        ...application.job,
        title: "Bewerbung als Sachbearbeiter im Verkaufsinnendienst",
      },
    });
    const html = buildDocumentHtml(alreadyPrefixed, profile, "deckblatt");

    expect(html).toContain("Bewerbung als Sachbearbeiter im Verkaufsinnendienst");
    expect(html).not.toContain("Bewerbung als Bewerbung als");
  });

  it("keeps the package order Deckblatt, Anschreiben, Lebenslauf", () => {
    const html = buildDocumentHtml(application, profile, "mappe");
    const body = html.slice(html.indexOf("<body>"));
    expect(body.indexOf("cover-page")).toBeLessThan(body.indexOf("letter-page"));
    expect(body.indexOf("letter-page")).toBeLessThan(body.indexOf("cv-sheet"));
  });

  it("validates mandatory applicant data before Deckblatt export", () => {
    expect(() => buildDocumentHtml(application, undefined, "deckblatt")).toThrow(
      "Name der Bewerberin oder des Bewerbers",
    );
  });

  it("keeps the signature directly below the final cover-letter paragraph", () => {
    const html = buildDocumentHtml(application, profile, "anschreiben");

    expect(html).toContain(
      ".signature{display:flex;flex-direction:column;align-items:flex-start;margin-top:3.2mm}",
    );
    expect(html).toContain(".letter-content>.letter-closing{margin-bottom:0}");
    expect(html).toContain('class="letter-body letter-closing"');
    expect(html.indexOf('class="letter-body letter-closing"')).toBeLessThan(
      html.indexOf('<div class="signature">'),
    );
    expect(html).toContain('class="attachments-note"');
  });

  it("can hide the complete attachments section in the cover letter", () => {
    const withoutAttachments = applicationSchema.parse({
      ...application,
      documents: {
        ...application.documents,
        showCoverLetterAttachments: false,
      },
    });
    const html = buildDocumentHtml(withoutAttachments, profile, "anschreiben");
    const body = html.slice(html.indexOf("<body>"));

    expect(body).not.toContain('class="attachments-note"');
  });

  it("exports long LinkedIn contacts in two columns for every requested template", () => {
    const linkedin =
      "https://www.linkedin.com/in/mustafa-oezdemir/";
    const github = "https://github.com/mustafa-oezdemir";
    const contactProfile = profileSchema.parse({
      ...profile,
      linkedin,
      github,
      email: "mustafa.ozdemir1408@gmail.com",
      phone: "+49 176 93153406",
      postalCode: "35039",
      city: "Marburg",
      country: "Deutschland",
    });
    const templateIds = [
      "kreativ",
      "zweispaltig",
      "einspaltig",
      "klassisch",
      "modern",
      "tabellarisch",
    ] as const;

    for (const templateId of templateIds) {
      const contactApplication = applicationSchema.parse({
        ...application,
        templateId,
        designSettings: {
          ...application.designSettings,
          resumeOutputMode: "visual",
        },
      });
      const html = buildDocumentHtml(
        contactApplication,
        contactProfile,
        "lebenslauf",
      );
      const body = html.slice(html.indexOf("<body>"));

      expect(body).toContain('data-contact-kind="linkedin"');
      expect(body).toContain(linkedin);
      if (templateId === "zweispaltig") {
        expect(body).toContain('data-contact-kind="github"');
        expect(body).toContain(github);
      }
    }

    const cssHtml = buildDocumentHtml(
      applicationSchema.parse({ ...application, templateId: "kreativ" }),
      contactProfile,
      "lebenslauf",
    );
    expect(cssHtml).toContain(
      "grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)",
    );
    // A long contact uses both grid columns so its value stays on one line.
    expect(cssHtml).toContain(
      '.kreativ-pdf-contacts>[data-contact-wide="true"]{grid-column:1/-1}',
    );
    expect(cssHtml).toContain('data-contact-kind="linkedin" data-contact-wide="true"');
    expect(cssHtml).toContain(".kreativ-pdf-contacts i{min-width:0;font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}");
    expect(cssHtml).toContain('[data-contact-kind="email"]>i{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;overflow-wrap:normal}');

    const zweispaltigCssHtml = buildDocumentHtml(
      applicationSchema.parse({ ...application, templateId: "zweispaltig" }),
      contactProfile,
      "lebenslauf",
    );
    expect(zweispaltigCssHtml).toContain(
      ".zweispaltig-pdf-contacts{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:1.1mm 8mm;width:100%;max-width:132mm",
    );
    expect(zweispaltigCssHtml).toContain(
      '[data-contact-kind="github"]>span{overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere}',
    );
  });

  it("uses the selected composition and both custom colors in exported HTML", () => {
    const html = buildDocumentHtml(application, profile, "lebenslauf");

    expect(html).toContain("cv-sidebar-right");
    expect(html).toContain("--accent:#ff5a00");
    expect(html).toContain("--secondary:#9e0000");
    expect(html).toContain("Kurzprofil");
    expect(html).toContain("TypeScript");
    expect(html).not.toContain("Enhancv");
  });

  it("renders dynamic knowledge categories and hides disabled entries", () => {
    const dynamicProfile = profileSchema.parse({
      ...profile,
      knowledgeSection: {
        title: "Kenntnisse & Zusatzangaben",
        isVisible: true,
        categories: [
          {
            id: crypto.randomUUID(),
            title: "Backend",
            type: "it",
            subtitle: "Serverseitige Entwicklung",
            displayMode: "level-dots",
            showLevels: true,
            showYearsOfExperience: true,
            isVisible: true,
            sortOrder: 0,
            items: [
              {
                id: crypto.randomUUID(),
                name: "Node.js",
                level: "advanced",
                yearsOfExperience: 4,
                isVisible: true,
                sortOrder: 0,
              },
              {
                id: crypto.randomUUID(),
                name: "Versteckt",
                level: "none",
                isVisible: false,
                sortOrder: 1,
              },
            ],
            subcategories: [],
          },
        ],
      },
    });
    const html = buildDocumentHtml(
      application,
      dynamicProfile,
      "lebenslauf",
    );

    expect(html).toContain("Besondere Kenntnisse");
    expect(html).toContain("Backend");
    expect(html).toContain("Node.js");
    expect(html).toContain("Fortgeschrittene Kenntnisse");
    expect(html).not.toContain("Versteckt");
  });

  it("keeps the same resume composition in the complete application package", () => {
    const html = buildDocumentHtml(application, profile, "mappe");

    expect(html.match(/class="page /g)).toHaveLength(3);
    expect(html).toContain("cv-sidebar-right");
  });

  it("always exports the cover letter as exactly one A4 page", () => {
    const longApplication = applicationSchema.parse({
      ...application,
      documents: {
        ...application.documents,
        coverIntroduction: "Einleitung ".repeat(100),
        coverMotivation: "Motivation ".repeat(100),
        coverQualification: "Qualifikation ".repeat(100),
        coverCompanyFit: "Unternehmensbezug ".repeat(100),
        coverClosing: "Abschluss ".repeat(100),
      },
    });
    const html = buildDocumentHtml(longApplication, profile, "anschreiben");

    expect(html.match(/class="page /g)).toHaveLength(1);
    expect(html).toContain("letter-page letter-dense");
    expect(html).toContain("@page{size:A4;margin:0}");
    expect(html).toContain("content.dataset.fitScale");
  });

  it("uses the entered application date in the exported cover letter", () => {
    const datedApplication = applicationSchema.parse({
      ...application,
      sentAt: "2024-05-17T09:00:00.000Z",
      job: { ...application.job, reference: "R-284848" },
    });

    const html = buildDocumentHtml(datedApplication, profile, "anschreiben");

    expect(html).toContain("Berlin, den 17. Mai 2024");
    expect(html).toContain(
      "Bewerbung als Senior Softwareentwickler - Referenz R-284848",
    );
  });

  it("renders both contacts in the cover-letter recipient and greeting", () => {
    const twoContactApplication = applicationSchema.parse({
      ...application,
      contact: {
        salutation: "Frau",
        firstName: "Anna",
        lastName: "Müller",
      },
      additionalContacts: [
        {
          salutation: "Herr",
          firstName: "Mehmet",
          lastName: "Yılmaz",
        },
      ],
    });

    const html = buildDocumentHtml(
      twoContactApplication,
      profile,
      "anschreiben",
    );

    expect(html).toContain("Frau Anna Müller<br>Herrn Mehmet Yılmaz");
    expect(html).toContain(
      '<p class="letter-salutation">Sehr geehrte Frau Müller, sehr geehrter Herr Yılmaz,</p>',
    );
  });

  it("justifies the body paragraphs of exported cover letters", () => {
    const html = buildDocumentHtml(application, profile, "anschreiben");

    expect(html).toContain(
      ".letter-body{text-align:justify;text-justify:inter-word;hyphens:auto;overflow-wrap:break-word}",
    );
    expect(html.match(/<p class="letter-body(?: letter-closing)?">/g)).toHaveLength(4);
    expect(html).toContain(
      '<p class="letter-salutation">Sehr geehrte Damen und Herren,</p>',
    );
  });

  it.each([["small", 10], ["medium", 11], ["large", 12]] as const)("uses the shared %s font choice for the exported DIN-style letter", (size, points) => {
    const withSize = applicationSchema.parse({
      ...application,
      designSettings: { ...application.designSettings, fontSize: size },
    });
    const html = buildDocumentHtml(withSize, profile, "anschreiben");
    expect(html).toContain(`--letter-body-size:${points}pt`);
    expect(html).toContain(".subject{margin:0 0 6mm;color:var(--accent);font-size:var(--letter-body-size)");
    expect(html).toContain(".letter-content>p:not(.subject,.date){margin:0 0 3.2mm;font-size:var(--letter-body-size)");
  });

  it("places compact applicant details in the DIN letterhead", () => {
    const profileWithWebsite = profileSchema.parse({
      ...profile,
      portfolio: "https://pehlione.com/",
    });
    const html = buildDocumentHtml(application, profileWithWebsite, "anschreiben");

    expect(html).toContain('<span class="sender-name">Mina Kaya</span>');
    expect(html).toContain(
      '<span class="sender-title">Softwareentwicklerin</span>',
    );
    expect(html).toContain(
      '<span class="sender-contact">Berlin | mina@example.com</span>',
    );
    expect(html).not.toContain("pehlione.com");
    expect(html).toContain(
      ".sender-name{color:#000;font-size:16pt;font-weight:800;line-height:1.12}",
    );
    expect(html).toContain(
      ".sender-contact{margin-top:.5mm;color:#000;font-size:10pt;line-height:1.2}",
    );
    expect(html).toContain(
      ".letter-header{display:flex;min-height:24mm;align-items:flex-start;justify-content:center}",
    );
    expect(html).toContain(".letter-rule{height:4px;margin:0;background:var(--accent)}");
    expect(html).toContain('<div class="rule letter-rule"></div>');
    expect(html).toContain(".letter-header{min-height:0;padding-bottom:1mm}");
    expect(html.indexOf('<div class="sender">')).toBeLessThan(
      html.indexOf('<div class="recipient">'),
    );
  });

  it("uses a stable DIN A4 composition independent of the resume design", () => {
    const html = buildDocumentHtml(application, profile, "anschreiben");
    const splitCleanHtml = buildDocumentHtml(
      applicationSchema.parse({ ...application, templateId: "zweispaltig" }),
      profile,
      "anschreiben",
    );

    expect(html).toContain(
      'class="page letter-page letter-standard letter-gap-0 layout-sidebar-right',
    );
    expect(html).toContain('data-resume-template="modern-sidebar"');
    expect(html).toContain(
      ".letter-content{padding:var(--doc-margin);border-top:0}",
    );
    expect(html).toContain(
      ".subject{margin:0 0 6mm;color:var(--accent);font-size:var(--letter-body-size);font-weight:800;line-height:1.2}",
    );
    expect(html).toContain(
      ".letter-content>p:not(.subject,.date){margin:0 0 3.2mm;font-size:var(--letter-body-size);line-height:1.28}",
    );
    expect(splitCleanHtml).toContain("layout-split-clean");
    expect(splitCleanHtml).toContain(
      ".letter-content{padding:var(--doc-margin);border-top:0}",
    );
  });

  it("renders Pehlione White Blue with a technical sidebar in PDF output", () => {
    const pehlioneProfile = profileSchema.parse({
      ...profile,
      phone: "+4917693153406",
      linkedin: "https://www.linkedin.com/in/mina-kaya/",
      resumeColumnRatio: 35,
      resumeKnowledgeGroups: [{
        id: "custom-tools",
        title: "IT & Technik",
        semanticType: "tools",
        visible: true,
        order: 0,
        rendererType: "tag-list",
        slot: "main",
        items: [{
          id: "docker",
          text: "Docker",
          description: "Containerisierung",
          icon: "",
          level: "",
          order: 0,
          visible: true,
        }],
      }],
    });
    const pehlioneApplication = applicationSchema.parse({
      ...application,
      templateId: "pehlione_white_blue",
      accentColor: "#0B3D86",
      secondaryColor: "#1F66B3",
    });
    const html = buildDocumentHtml(pehlioneApplication, pehlioneProfile, "lebenslauf");

    expect(html).toContain('data-template="pehlione_white_blue"');
    expect(html).toContain("pehlione-pdf-sidebar");
    expect(html).toContain("Technische Schwerpunkte");
    expect(html).toContain(".pehlione-pdf");
    expect(html).toContain("+49 176 93153406");
    expect(html).toContain('href="https://www.linkedin.com/in/mina-kaya/"');
    expect(html).toContain("pehlione-pdf-continuation .pehlione-pdf-main{padding:0}");
    expect(html).toContain("IT &amp; Technik");
    expect(html).toContain("Containerisierung");
    expect(html).toContain("grid-template-columns:73.5mm minmax(0,1fr)");
  });

  it("exports the white Pehlione variant through the Pehlione renderer, including ATS", () => {
    const whiteApplication = applicationSchema.parse({ ...application, templateId: "pehlione_white" });
    const html = buildDocumentHtml(whiteApplication, { ...profile, phone: "+49176123456", github: "github.com/mina", portfolio: "mina.example.com" }, "lebenslauf");
    const body = html.slice(html.indexOf("<body>"));
    expect(body).toContain('data-template="pehlione_white"');
    expect(body).toContain("pehlione-pdf-white");
    expect(body).toContain("pehlione-pdf-blueprint");
    expect(body).toContain('data-contact-icon="github"');
    expect(body).toContain('data-contact-icon="website"');
    expect(body).toContain("<strong>Telefon</strong>");
    expect(body).toContain("Kernkompetenzen");
    expect(body).toContain("Technische Schwerpunkte");
    const atsHtml = buildDocumentHtml(applicationSchema.parse({
      ...whiteApplication,
      designSettings: { ...whiteApplication.designSettings, resumeOutputMode: "ats" },
    }), profile, "lebenslauf");
    const atsBody = atsHtml.slice(atsHtml.indexOf("<body>"));
    expect(atsBody).toContain("pehlione-pdf-ats");
    expect(atsBody).not.toContain('class="pehlione-pdf-sidebar"');
    expect(atsBody).not.toContain("pehlione-pdf-blueprint");
  });

  it("places an enabled Pehlione photo inside the PDF hero circle", () => {
    const pehlioneApplication = applicationSchema.parse({
      ...application,
      templateId: "pehlione_white_blue",
    });
    const photoProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,AA==",
      resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
        section.semanticType === "photo"
          ? { ...section, visible: true, enabled: true }
          : section,
      ),
    });
    const visiblePdf = buildDocumentHtml(pehlioneApplication, photoProfile, "lebenslauf");
    const hiddenPdf = buildDocumentHtml(
      pehlioneApplication,
      profileSchema.parse({ ...photoProfile, resumeSemanticSections: resolveResumeSectionInstances([]) }),
      "lebenslauf",
    );

    expect(visiblePdf.slice(visiblePdf.indexOf("<body>"))).toContain('class="pehlione-pdf-photo"');
    expect(hiddenPdf.slice(hiddenPdf.indexOf("<body>"))).not.toContain('class="pehlione-pdf-photo"');
  });

  it("groups the Pehlione PDF signature above the printed name", () => {
    const pehlioneApplication = applicationSchema.parse({
      ...application,
      templateId: "pehlione_white_blue",
      sentAt: "2026-09-26T10:00:00.000Z",
    });
    const signedProfile = profileSchema.parse({
      ...profile,
      applicationPlace: "Marburg",
      applicationDate: "22.09.2026",
      signaturePath: "data:image/png;base64,AA==",
    });
    const html = buildDocumentHtml(pehlioneApplication, signedProfile, "lebenslauf");
    const body = html.slice(html.indexOf("<body>"));

    // The closing prints the date of the application, not the date typed into the profile.
    expect(body).toContain('<footer class="pehlione-pdf-closing"><p>Marburg, 26.09.2026</p>');
    expect(body).not.toContain("22.09.2026");
    expect(body).toContain('<div class="pehlione-pdf-signer"><img');
    expect(body).toContain('<strong>Mina Kaya</strong></div></footer>');
  });

  it("reduces the date-to-subject gap in the PDF with each requested step", () => {
    const compactGapApplication = applicationSchema.parse({
      ...application,
      documents: {
        ...application.documents,
        coverSubjectGapReduction: 2,
      },
    });
    const html = buildDocumentHtml(compactGapApplication, profile, "anschreiben");

    expect(html).toContain("letter-gap-2");
    expect(html).toContain(".letter-gap-2 .date{margin-bottom:12mm}");
  });

  it("uses manually adjusted letterhead, recipient and salutation in the PDF", () => {
    const customizedApplication = applicationSchema.parse({
      ...application,
      documents: {
        ...application.documents,
        coverSenderName: "Mina Beispiel",
        coverSenderTitle: "Frontend Developer",
        coverSenderContact: "mina@example.com | +49 30 123456",
        coverRecipientAddress: "Beispiel AG\nPersonalabteilung\n10115 Berlin",
        coverGreeting: "Guten Tag liebes Recruiting-Team,",
      },
    });
    const html = buildDocumentHtml(customizedApplication, profile, "anschreiben");

    expect(html).toContain("Mina Beispiel");
    expect(html).toContain("Frontend Developer");
    expect(html).toContain("Personalabteilung<br>10115 Berlin");
    expect(html).toContain("Guten Tag liebes Recruiting-Team,");
  });

  it("limits a long resume to two complete A4 sheets", () => {
    const denseProfile = profileSchema.parse({
      ...profile,
      experiences: Array.from({ length: 8 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `01/20${10 + index}`,
        to: `12/20${10 + index}`,
        role: `Softwareentwicklerin ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        city: "Berlin",
        achievements: Array.from(
          { length: 6 },
          (_, achievementIndex) =>
            `Messbares Projektergebnis ${achievementIndex + 1} mit verbesserter Qualität und kürzeren Bearbeitungszeiten.`,
        ),
      })),
    });
    const html = buildDocumentHtml(
      application,
      denseProfile,
      "lebenslauf",
    );

    expect(html.match(/data-resume-page="/g)).toHaveLength(2);
    expect(html).toContain('data-resume-page="1"');
    expect(html).toContain('data-resume-page="2"');
    expect(html).not.toContain('data-resume-page="3"');
    expect(html).toContain("cv-continuation");
  });

  it("maps persisted design alternatives to shared PDF variables and classes", () => {
    const customizedApplication = applicationSchema.parse({
      ...application,
      designSettings: {
        ...application.designSettings,
        marginLevel: 5,
        sectionSpacingLevel: 1,
        fontSize: "large",
        lineHeightLevel: 4,
        fontId: "georgia",
        headingFontId: "montserrat",
        columnLayout: "timeline",
        backgroundId: "dots",
        showBackgroundInPrint: false,
      },
    });
    const html = buildDocumentHtml(
      customizedApplication,
      profile,
      "lebenslauf",
    );

    expect(html).toContain("--doc-margin:17mm");
    expect(html).toContain("--section-gap:2.5mm");
    expect(html).toContain("--body-size:10pt");
    expect(html).toContain("column-timeline");
    expect(html).toContain("background-dots");
    expect(html).toContain("no-print-background");
  });

  it("renders the programming-languages background in preview and PDF HTML", () => {
    const technicalApplication = applicationSchema.parse({
      ...application,
      designSettings: {
        ...application.designSettings,
        backgroundId: "programming-languages-bg",
        showBackgroundInPrint: true,
      },
    });
    const html = buildDocumentHtml(
      technicalApplication,
      profile,
      "lebenslauf",
    );

    expect(html).toContain("background-programming-languages-bg");
    expect(html).toContain("programming-languages-layer");
    expect(html).toContain(">TypeScript<");
    expect(html).toContain(">Electron<");
    expect(html).toContain('data-brand="go"');
    expect(html).toContain(">php<");
    expect(html).toContain("print-background");
  });

  it("automatically omits decorative technology tags in compact ATS mode", () => {
    const atsApplication = applicationSchema.parse({
      ...application,
      designSettings: {
        ...application.designSettings,
        backgroundId: "programming-languages-bg",
        columnLayout: "compact-ats",
      },
    });
    const html = buildDocumentHtml(
      atsApplication,
      profile,
      "lebenslauf",
    );

    expect(html).toContain("background-programming-languages-bg");
    expect(html).not.toContain(">TypeScript<");
    expect(html).not.toContain(
      'class="document-background-layer programming-languages-layer"',
    );
  });

  it("forces ATS rendering even when a visual column layout is selected", () => {
    const atsApplication = applicationSchema.parse({
      ...application,
      designSettings: {
        ...application.designSettings,
        columnLayout: "right-sidebar",
        resumeOutputMode: "ats",
        backgroundId: "programming-languages-bg",
      },
    });
    const html = buildDocumentHtml(atsApplication, profile, "lebenslauf");

    expect(html).toContain("column-compact-ats");
    expect(html).not.toContain(
      'class="document-background-layer programming-languages-layer"',
    );
    expect(html).toContain("knowledge-comma");
    expect(html).toContain("<h3>Besondere Kenntnisse</h3>");
    expect(html).not.toContain("●●●●○");
    expect(html.indexOf("Kurzprofil")).toBeLessThan(
      html.indexOf("Beruflicher Werdegang"),
    );
  });

  it("renders the selected profile photo and signature in exported documents", () => {
    const imageData = "data:image/png;base64,iVBORw0KGgo=";
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: imageData,
      signaturePath: imageData,
    });

    const resumeHtml = buildDocumentHtml(
      application,
      mediaProfile,
      "lebenslauf",
    );
    const letterHtml = buildDocumentHtml(
      application,
      mediaProfile,
      "anschreiben",
    );

    expect(resumeHtml).toContain("cv-avatar-image");
    expect(resumeHtml).toContain(imageData);
    expect(letterHtml).toContain("signature-image");
    expect(letterHtml).toContain(imageData);
    expect(letterHtml).toContain(
      '<span class="signature-name">Mina Kaya</span>',
    );
    expect(letterHtml).not.toContain("<strong>Mina Kaya</strong>");
    expect(letterHtml).toContain(
      ".signature p{margin:0;font-size:var(--letter-body-size);line-height:1.28}.signature-image",
    );
    expect(letterHtml).toContain(
      ".signature-name{font-size:11pt;font-weight:400;line-height:1.2}",
    );
  });

  it("renders the Elegant PDF with a full-height right sidebar and no empty photo placeholder", () => {
    const elegantApplication = applicationSchema.parse({
      ...application,
      templateId: "elegant",
      accentColor: "#FE6201",
      secondaryColor: "#8A0202",
      designSettings: {
        ...application.designSettings,
        columnLayout: "right-sidebar",
        resumeOutputMode: "visual",
      },
    });

    const html = buildDocumentHtml(
      elegantApplication,
      profile,
      "lebenslauf",
    );

    expect(html).toContain('data-template="elegant"');
    expect(html).toContain('data-no-fit="true"');
    expect(html).toContain('<aside class="elegant-pdf-sidebar">');
    expect(html).toContain("box-shadow:inset 0 3.5mm 0 color-mix(in srgb,var(--elegant-sidebar),black 28%)");
    expect(html).toContain(
      "grid-template-columns:minmax(0,140mm) 70mm",
    );
    expect(html).toContain("Kurzprofil");
    expect(html).toContain("Stärken");
    expect(html).not.toContain('<img class="elegant-pdf-photo"');
    expect(html).not.toContain("elegant-pdf-monogram");
    expect(html).not.toContain("Seite 1 von 1");
  });

  it("uses Elegant's blue native colors and profile section titles in the PDF", () => {
    const chosen = { ...applicationSchema.parse({ ...application, templateId: "elegant" }), accentColor: "", secondaryColor: "" };
    const edited = profileSchema.parse({
      ...profile,
      resumeSectionTitles: { ...profile.resumeSectionTitles, experience: "Mein Werdegang", education: "Meine Ausbildung" },
      education: [{ id: crypto.randomUUID(), from: "2018", to: "2021", degree: "Abschluss", institution: "Hochschule" }],
    });
    const html = buildDocumentHtml(chosen, edited, "lebenslauf");
    const body = html.slice(html.indexOf("<body>"));
    expect(html).toContain("--accent:#168BE0;--secondary:#234663");
    expect(body).toContain("Mein Werdegang");
    expect(body).toContain("Meine Ausbildung");
    expect(body).not.toContain("Enhancv");
  });

  it("uses a separate linear Elegant ATS renderer in logical section order", () => {
    const elegantAtsApplication = applicationSchema.parse({
      ...application,
      templateId: "elegant",
      designSettings: {
        ...application.designSettings,
        columnLayout: "right-sidebar",
        resumeOutputMode: "ats",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
    });

    const html = buildDocumentHtml(
      elegantAtsApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('class="page-content elegant-pdf-ats"');
    expect(body).not.toContain('<aside class="elegant-pdf-sidebar');
    expect(body).not.toContain('<img class="elegant-pdf-photo"');
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
  });

  it("renders the Zweispaltig PDF with a clean 62/38 composition", () => {
    const zweispaltigApplication = applicationSchema.parse({
      ...application,
      templateId: "zweispaltig",
      accentColor: "#165DAA",
      secondaryColor: "#EAF2FA",
      designSettings: {
        ...application.designSettings,
        columnLayout: "template",
        resumeOutputMode: "visual",
      },
    });

    const html = buildDocumentHtml(
      zweispaltigApplication,
      profile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));
    const mainStart = body.indexOf('<main class="zweispaltig-pdf-main">');
    const sidebarStart = body.indexOf(
      '<aside class="zweispaltig-pdf-sidebar">',
    );
    const mainMarkup = body.slice(mainStart, sidebarStart);
    const sidebarMarkup = body.slice(
      sidebarStart,
      body.indexOf("</aside>", sidebarStart),
    );

    expect(body).toContain('data-template="zweispaltig"');
    expect(body).toContain('data-no-fit="true"');
    expect(body).toContain('class="zweispaltig-pdf-columns"');
    expect(body).toContain('<aside class="zweispaltig-pdf-sidebar">');
    expect(html).toContain(
      "grid-template-columns:minmax(0,62fr) minmax(0,38fr);column-gap:11mm",
    );
    expect(html).toContain("width:30mm;height:30mm");
    expect(body).toContain('class="zweispaltig-pdf-entry-meta"');
    expect(body).toContain('viewBox="0 0 24 24"');
    expect(body).not.toContain('class="zweispaltig-pdf-language-dots"');
    expect(body).toContain("Kurzprofil");
    expect(body).toContain("Stärken");
    expect(mainMarkup).not.toContain("Kurzprofil");
    expect(sidebarMarkup).toContain("Kurzprofil");
    expect(body).not.toContain('<img class="zweispaltig-pdf-photo"');
    expect(body).not.toContain("monogram");
    const { document } = parseHTML(html);
    expect(document.querySelector(".zweispaltig-pdf-header h2")?.textContent).toBe(profile.title);
    expect(document.querySelector(".zweispaltig-pdf-header")?.textContent).not.toContain("TypeScript");
    expect(document.querySelector(".zweispaltig-pdf-sidebar")?.textContent).toContain("TypeScript");
  });

  it("keeps Zweispaltig career titles blue when the organization accent is green", () => {
    const zweispaltigApplication = applicationSchema.parse({
      ...application,
      templateId: "zweispaltig",
      accentColor: "#0B3D86",
      secondaryColor: "#58B5F7",
      designSettings: {
        ...application.designSettings,
        cvOverrides: { colors: { heading: "#0060F0", accent: "#1DBF2F" } },
      },
    });
    const html = buildDocumentHtml(zweispaltigApplication, profile, "lebenslauf");
    const { document } = parseHTML(html);
    const page = document.querySelector(".zweispaltig-pdf");

    expect(page?.getAttribute("style")).toContain("--zweispaltig-heading-color:#0060F0");
    expect(page?.getAttribute("style")).toContain("--zweispaltig-accent:#1DBF2F");
    expect(html).toContain("--zweispaltig-heading:var(--zweispaltig-heading-color,var(--accent))");
    expect(page?.querySelector(".zweispaltig-pdf-entry h4")).toBeTruthy();
    expect(page?.querySelector(".zweispaltig-pdf-entry-organization")?.getAttribute("style")).toContain("color:#1DBF2F");
  });

  it("keeps a sidebar summary in the right Zweispaltig PDF column", () => {
    const zweispaltigApplication = applicationSchema.parse({
      ...application,
      templateId: "zweispaltig",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "visual",
      },
    });
    const sidebarSummaryProfile = profileSchema.parse({
      ...profile,
      resumeSectionLayouts: {
        zweispaltig: [
          { type: "experience", zone: "main" },
          { type: "education", zone: "main" },
          { type: "summary", zone: "sidebar" },
          { type: "strengths", zone: "sidebar" },
          { type: "knowledge", zone: "sidebar" },
          { type: "languages", zone: "sidebar" },
          { type: "certifications", zone: "sidebar" },
        ],
      },
    });
    const html = buildDocumentHtml(
      zweispaltigApplication,
      sidebarSummaryProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));
    const mainStart = body.indexOf('<main class="zweispaltig-pdf-main">');
    const sidebarStart = body.indexOf(
      '<aside class="zweispaltig-pdf-sidebar">',
    );
    const sidebarEnd = body.indexOf("</aside>", sidebarStart);
    const mainMarkup = body.slice(mainStart, sidebarStart);
    const sidebarMarkup = body.slice(sidebarStart, sidebarEnd);

    expect(mainStart).toBeGreaterThan(-1);
    expect(sidebarStart).toBeGreaterThan(mainStart);
    expect(mainMarkup).not.toContain("Kurzprofil");
    expect(sidebarMarkup).toContain("Kurzprofil");
    expect(sidebarMarkup).toContain(profile.summary);
  });

  it("uses a separate linear Zweispaltig ATS renderer in logical order", () => {
    const zweispaltigAtsApplication = applicationSchema.parse({
      ...application,
      templateId: "zweispaltig",
      designSettings: {
        ...application.designSettings,
        columnLayout: "template",
        resumeOutputMode: "ats",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      education: [
        {
          id: crypto.randomUUID(),
          from: "10/2015",
          to: "09/2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
    });

    const html = buildDocumentHtml(
      zweispaltigAtsApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain(
      'class="page-content zweispaltig-pdf zweispaltig-pdf-ats"',
    );
    expect(body).not.toContain('<aside class="zweispaltig-pdf-sidebar');
    expect(body).not.toContain('<img class="zweispaltig-pdf-photo"');
    expect(body.indexOf("Berufliches Profil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
  });

  it("renders the Zeitgenössisch PDF with organic photo shapes and left sidebar", () => {
    const zeitgenoessischApplication = applicationSchema.parse({
      ...application,
      templateId: "zeitgenoessisch",
      accentColor: "#2FB478",
      secondaryColor: "#CBECDD",
      designSettings: {
        ...application.designSettings,
        columnLayout: "left-sidebar",
        resumeOutputMode: "visual",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      skills: [],
      strengths: [
        {
          id: "80000000-0000-4000-8000-000000000001",
          title: "Java",
          description: "Maven, Spring Boot",
        },
        {
          id: "80000000-0000-4000-8000-000000000002",
          title: "PHP",
          description: "Laravel, Symfony",
        },
        {
          id: "80000000-0000-4000-8000-000000000003",
          title: "Go",
          description: "Echo, Gin",
        },
      ],
    });

    const html = buildDocumentHtml(
      zeitgenoessischApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="zeitgenoessisch"');
    expect(body).toContain('data-no-fit="true"');
    expect(body).toContain("zeit-pdf-photo-composition");
    expect(body).toContain("zeit-pdf-photo-pale");
    expect(body).toContain('<aside class="zeit-pdf-left">');
    expect(body).toContain("Kurzprofil");
    expect(body).toContain("Erfahrung");
    expect(body).toContain("Stärken");
    expect(body).toContain(">Java<");
    expect(body).toContain("Maven, Spring Boot");
    expect(body).toContain(">PHP<");
    expect(body).toContain("Laravel, Symfony");
    expect(body).toContain(">Go<");
    expect(body).toContain("Echo, Gin");
    expect(html).toContain(
      ".zeit-pdf-strength{display:grid;grid-template-columns:3.5mm minmax(0,1fr);gap:1.5mm",
    );
    expect(body).toContain("zeit-pdf-heading");
    expect(body).toContain("<svg");
    expect(body).not.toContain("monogram");
  });

  it("removes the Zeitgenössisch photo composition without a photo", () => {
    const zeitgenoessischApplication = applicationSchema.parse({
      ...application,
      templateId: "zeitgenoessisch",
      accentColor: "#2FB478",
      secondaryColor: "#CBECDD",
      designSettings: {
        ...application.designSettings,
        columnLayout: "left-sidebar",
        resumeOutputMode: "visual",
      },
    });
    const html = buildDocumentHtml(
      zeitgenoessischApplication,
      profile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("zeit-pdf-header no-photo");
    expect(body).not.toContain("zeit-pdf-photo-composition");
    expect(body).not.toContain('<img class="zeit-pdf-photo"');
  });

  it("uses a separate linear Zeitgenössisch ATS renderer in logical order", () => {
    const zeitgenoessischAtsApplication = applicationSchema.parse({
      ...application,
      templateId: "zeitgenoessisch",
      designSettings: {
        ...application.designSettings,
        columnLayout: "left-sidebar",
        resumeOutputMode: "ats",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      certifications: ["Professional Scrum Master I"],
      education: [
        {
          id: crypto.randomUUID(),
          from: "10/2015",
          to: "09/2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
    });

    const html = buildDocumentHtml(
      zeitgenoessischAtsApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain(
      'class="page-content zeit-pdf zeit-pdf-ats"',
    );
    expect(body).not.toContain('<aside class="zeit-pdf-left');
    expect(body).not.toContain("zeit-pdf-photo-composition");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
    expect(body.indexOf("Stärken")).toBeLessThan(
      body.indexOf("Zertifikate"),
    );
  });

  it("renders the Kreativ PDF with green banner, photo, circles, and two columns", () => {
    const kreativApplication = applicationSchema.parse({
      ...application,
      templateId: "kreativ",
      accentColor: "#37B978",
      secondaryColor: "#D9F2E5",
      designSettings: {
        ...application.designSettings,
        marginLevel: 2,
        columnLayout: "two-column-left-wide",
        resumeOutputMode: "visual",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      resumeSections: {
        ...profile.resumeSections,
        strengths: true,
        skills: false,
      },
      strengths: [
        {
          id: "81000000-0000-4000-8000-000000000001",
          title: "Java",
          description: "Maven, Spring Boot",
        },
        {
          id: "81000000-0000-4000-8000-000000000002",
          title: "PHP",
          description: "Laravel, Symfony",
        },
        {
          id: "81000000-0000-4000-8000-000000000003",
          title: "Go",
          description: "Echo, Gin",
        },
      ],
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `01/202${index}`,
        to: `12/202${index}`,
        role: `Softwareentwicklerin ${index + 1}`,
        company: `Beispielunternehmen ${index + 1}`,
        city: "Berlin",
        achievements: [
          "Automatisierte Abläufe entwickelt und zuverlässig eingeführt.",
          "Qualität und Bearbeitungszeit messbar verbessert.",
          "Technische Ergebnisse nachvollziehbar dokumentiert.",
        ],
      })),
      education: [
        {
          id: crypto.randomUUID(),
          from: "10/2016",
          to: "09/2020",
          degree: "B.Sc. Informatik",
          institution: "Technische Universität Berlin",
          city: "Berlin",
        },
      ],
    });

    const html = buildDocumentHtml(
      kreativApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="kreativ"');
    expect(body).toContain('data-no-fit="true"');
    expect(body).toContain('<img class="kreativ-pdf-photo"');
    expect(body).toContain("kreativ-pdf-background");
    expect(body).toContain('<main class="kreativ-pdf-left">');
    expect(body).toContain('<aside class="kreativ-pdf-right">');
    expect(body.match(/data-resume-page=/g)).toHaveLength(1);
    expect(body).toContain('data-density="standard"');
    expect(body).toContain("Kurzprofil");
    expect(body).toContain("Erfahrung");
    expect(body).not.toContain(">Fähigkeiten<");
    expect(body).toContain("Stärken");
    expect(body).toContain(">Java<");
    expect(body).toContain("Maven, Spring Boot");
    expect(body).toContain(">PHP<");
    expect(body).toContain("Laravel, Symfony");
    expect(body).toContain(">Go<");
    expect(body).toContain("Echo, Gin");
    expect(body).toContain('class="kreativ-pdf-entry-heading"');
    expect(body).toContain('class="kreativ-pdf-entry-subheading"');
    expect(body).toContain('class="kreativ-pdf-entry-meta">01/2020 – 12/2020</p>');
    expect(body).toContain('class="kreativ-pdf-entry-location">Berlin</p>');
  });

  it("removes the Kreativ PDF photo placeholder when no photo exists", () => {
    const kreativApplication = applicationSchema.parse({
      ...application,
      templateId: "kreativ",
      accentColor: "#37B978",
      secondaryColor: "#D9F2E5",
      designSettings: {
        ...application.designSettings,
        marginLevel: 2,
        columnLayout: "two-column-left-wide",
        resumeOutputMode: "visual",
      },
    });
    const html = buildDocumentHtml(
      kreativApplication,
      profile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("kreativ-pdf-header no-photo");
    expect(body).not.toContain('<img class="kreativ-pdf-photo"');
    expect(body).not.toContain("monogram");
  });

  it("uses a separate linear Kreativ ATS renderer in logical order", () => {
    const kreativAtsApplication = applicationSchema.parse({
      ...application,
      templateId: "kreativ",
      designSettings: {
        ...application.designSettings,
        marginLevel: 2,
        columnLayout: "two-column-left-wide",
        resumeOutputMode: "ats",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      certifications: ["Professional Scrum Master I"],
      education: [
        {
          id: crypto.randomUUID(),
          from: "10/2015",
          to: "09/2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
    });

    const html = buildDocumentHtml(
      kreativAtsApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain(
      'class="page-content kreativ-pdf kreativ-pdf-ats"',
    );
    expect(body).not.toContain("kreativ-pdf-background");
    expect(body).not.toContain('<img class="kreativ-pdf-photo"');
    expect(body).not.toContain('<aside class="kreativ-pdf-right');
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    for (const auxiliary of ["Kurzprofil", "Kenntnisse", "Sprachen", "Stärken", "Zertifikate"])
      expect(body.indexOf(auxiliary), auxiliary).toBeGreaterThan(body.indexOf("Bildungsweg"));
  });

  it("renders Ivy League PDF as a centered watercolor single column", () => {
    const ivyApplication = applicationSchema.parse({
      ...application,
      templateId: "ivy-league",
      accentColor: "#073C8C",
      secondaryColor: "#FF6A00",
      designSettings: {
        ...application.designSettings,
        marginLevel: 2,
        sectionSpacingLevel: 4,
        columnLayout: "single",
        resumeOutputMode: "visual",
        backgroundId: "pastel-gradient",
        showBackgroundInPrint: true,
      },
    });
    const ivyProfile = profileSchema.parse({
      ...profile,
      linkedin: "linkedin.com/in/mina-kaya",
      portfolio: "mina.example.com",
      languages: ["Deutsch", "Englisch", "Türkisch", "Französisch"],
      skills: [
        "Analysefähigkeit – Präzise Bewertung komplexer Systeme",
        "Teamführung – Führung interdisziplinärer Teams",
        "Kundenbetreuung – Verlässliche Beratung",
      ],
      education: [
        {
          id: crypto.randomUUID(),
          from: "2012",
          to: "2016",
          degree: "M.Sc. Maschinenbau",
          institution: "Technische Universität München",
          city: "München",
        },
      ],
      certifications: ["TÜV Functional Safety Engineer"],
    });
    const html = buildDocumentHtml(
      ivyApplication,
      ivyProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="ivy-league"');
    expect(body).toContain('data-no-fit="true"');
    expect(body).toContain("ivy-pdf-watercolor");
    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("ivy-pdf-languages");
    expect(body).toContain("ivy-pdf-languages--columns-3");
    expect(html).toContain("grid-template-columns:auto auto;justify-content:start;gap:2mm");
    expect(body).toContain("Erfahrung");
    expect(body).toContain('<div class="ivy-pdf-entry-role"><h4>Senior Entwicklerin</h4><span data-resume-nowrap="">01/2022 – heute</span></div>');
    expect(body).toContain('<div class="ivy-pdf-entry-top"><h3>Beispiel GmbH</h3><span>Berlin</span></div>');
    expect(body).toContain(
      'href="https://linkedin.com/in/mina-kaya"',
    );
    expect(body).toContain("https://mina.example.com");
    expect(body).not.toContain("Seite 1 / 1");
    expect(body).not.toContain("Powered by");
    expect(body).not.toContain("<img");
  });

  it("keeps Ivy League strengths when the knowledge section is disabled", () => {
    const ivyApplication = applicationSchema.parse({
      ...application,
      templateId: "ivy-league",
      designSettings: {
        ...application.designSettings,
        columnLayout: "single",
        resumeOutputMode: "visual",
      },
    });
    const strengthsOnlyProfile = profileSchema.parse({
      ...profile,
      strengths: [
        {
          id: crypto.randomUUID(),
          title: "Analytisches Denken",
          description: "Komplexe Zusammenhänge sicher bewerten",
        },
      ],
      resumeSections: {
        ...profile.resumeSections,
        strengths: true,
        skills: false,
      },
    });
    const html = buildDocumentHtml(
      ivyApplication,
      strengthsOnlyProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("Analytisches Denken");
    expect(body).not.toContain(">Kenntnisse<");
  });

  it("removes the Ivy League watercolor with the white background option", () => {
    const ivyApplication = applicationSchema.parse({
      ...application,
      templateId: "ivy-league",
      accentColor: "#073C8C",
      secondaryColor: "#FF6A00",
      designSettings: {
        ...application.designSettings,
        marginLevel: 2,
        columnLayout: "single",
        resumeOutputMode: "visual",
        backgroundId: "white",
      },
    });
    const html = buildDocumentHtml(
      ivyApplication,
      profile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="ivy-league"');
    expect(body).not.toContain("ivy-pdf-watercolor");
  });

  it("uses a separate linear Ivy League ATS renderer in logical order", () => {
    const ivyAtsApplication = applicationSchema.parse({
      ...application,
      templateId: "ivy-league",
      accentColor: "#073C8C",
      secondaryColor: "#FF6A00",
      designSettings: {
        ...application.designSettings,
        marginLevel: 2,
        columnLayout: "single",
        resumeOutputMode: "ats",
        backgroundId: "pastel-gradient",
      },
    });
    const ivyProfile = profileSchema.parse({
      ...profile,
      education: [
        {
          id: crypto.randomUUID(),
          from: "2012",
          to: "2016",
          degree: "M.Sc. Maschinenbau",
          institution: "Technische Universität München",
          city: "München",
        },
      ],
      certifications: ["TÜV Functional Safety Engineer"],
    });
    const html = buildDocumentHtml(
      ivyAtsApplication,
      ivyProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain(
      'class="page-content ivy-pdf ivy-pdf-ats"',
    );
    expect(body).not.toContain("ivy-pdf-watercolor");
    expect(body).not.toContain("ivy-pdf-dots");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
    expect(body.indexOf("Stärken")).toBeLessThan(
      body.indexOf("Zertifikate"),
    );
  });

  it("renders Stilvoll with photo, chevrons, and the asymmetric visual grid", () => {
    const stilvollApplication = applicationSchema.parse({
      ...application,
      templateId: "stilvoll",
      accentColor: "#36B873",
      secondaryColor: "#075E50",
      designSettings: {
        ...application.designSettings,
        columnLayout: "two-column-right-wide",
        resumeOutputMode: "visual",
        backgroundId: "geometric",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      linkedin: "linkedin.com/in/mina-kaya",
      portfolio: "mina.example.com",
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      stilvollApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="stilvoll"');
    expect(body).toContain("stilvoll-pdf-columns");
    expect(body).toContain("stilvoll-pdf-chevron");
    expect(body).toContain('<img class="stilvoll-pdf-photo"');
    expect(body).toContain("<h2>Softwareentwicklerin</h2>");
    expect(body).not.toContain("Softwareentwicklerin | TypeScript");
    expect(body).toContain("Kurzprofil");
    expect(body).toContain("Erfahrung");
    expect(body).toContain('<div class="stilvoll-pdf-heading"><h3>Senior Entwicklerin</h3><span data-resume-nowrap="">01/2022 – heute</span></div>');
    expect(body).toContain('<p class="stilvoll-pdf-meta"><strong>Beispiel GmbH</strong><span>Berlin</span></p>');
    expect(body).toContain(
      'href="https://linkedin.com/in/mina-kaya"',
    );
    expect(body).toContain("https://mina.example.com");
    expect(body).not.toContain("Seite 1 / 1");
  });

  it("keeps Stilvoll strengths when the knowledge section is disabled", () => {
    const stilvollApplication = applicationSchema.parse({
      ...application,
      templateId: "stilvoll",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "visual",
      },
    });
    const strengthsOnlyProfile = profileSchema.parse({
      ...profile,
      strengths: [
        {
          id: crypto.randomUUID(),
          title: "Analytisches Denkvermögen",
          description: "Komplexe Zusammenhänge strukturiert bewerten",
        },
      ],
      resumeSections: {
        ...profile.resumeSections,
        strengths: true,
        skills: false,
      },
    });
    const html = buildDocumentHtml(
      stilvollApplication,
      strengthsOnlyProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("Analytisches Denkvermögen");
    expect(body).not.toContain(">Kenntnisse<");
  });

  it("renders Stilvoll ATS linearly without photo, chevrons, or rating dots", () => {
    const stilvollApplication = applicationSchema.parse({
      ...application,
      templateId: "stilvoll",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "ats",
        backgroundId: "geometric",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      education: [
        {
          id: crypto.randomUUID(),
          from: "2015",
          to: "2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      stilvollApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("managed-pdf-ats");
    expect(body).not.toContain("stilvoll-pdf-chevron");
    expect(body).not.toContain("<img");
    expect(body).not.toContain("managed-pdf-dots");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
  });

  it("renders Kompakt as a high-density two-column document with a photo", () => {
    const kompaktApplication = applicationSchema.parse({
      ...application,
      templateId: "kompakt",
      accentColor: "#073D96",
      secondaryColor: "#FF6200",
      designSettings: {
        ...application.designSettings,
        columnLayout: "two-column-left-wide",
        resumeOutputMode: "visual",
        backgroundId: "abstract",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      resumeSemanticSections: resolveResumeSectionInstances([]).map((section) =>
        section.semanticType === "photo"
          ? { ...section, visible: true, enabled: true }
          : section,
      ),
      resumeSections: {
        ...profile.resumeSections,
        strengths: true,
        skills: false,
      },
      strengths: [
        {
          id: "82000000-0000-4000-8000-000000000001",
          title: "Java",
          description: "Maven, Spring Boot",
        },
      ],
      linkedin: "linkedin.com/in/mina-kaya",
      portfolio: "mina.example.com",
      certifications: ["Prozessqualität verbessert"],
    });
    const html = buildDocumentHtml(
      kompaktApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="kompakt"');
    expect(html).toContain(
      ".kompakt-pdf .managed-pdf-background{z-index:-1",
    );
    expect(body).toContain("kompakt-pdf-columns");
    expect(body).toContain('class="managed-pdf-background"');
    expect(body).not.toContain("kompakt-pdf-skills");
    expect(body).toContain('class="kompakt-pdf-strength"');
    expect(body).toContain("<h2>Softwareentwicklerin</h2>");
    expect(body).toContain("Java");
    expect(body).toContain("★");
    expect(body).not.toContain("&#9873;");
    expect(body).toContain('<div class="kompakt-pdf-entry-heading"><h3>Senior Entwicklerin</h3><time data-resume-nowrap="">01/2022 – heute</time></div>');
    expect(body).toContain('<p class="kompakt-pdf-meta"><strong>Beispiel GmbH</strong><span>Berlin</span></p>');
    expect(html).toContain(".kompakt-pdf .managed-pdf-title{padding-bottom:1mm;border-bottom:.3mm solid var(--managed-divider)}");
    expect(body).toContain('href="https://linkedin.com/in/mina-kaya"');
    expect(body).toContain("https://mina.example.com");
    expect(body).not.toContain("Seite 1 / 1");
    expect(body).toContain('class="kompakt-pdf-photo"');
    expect(body).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });

  it("omits a Kompakt photo when its section is hidden", () => {
    const kompaktApplication = applicationSchema.parse({
      ...application,
      templateId: "kompakt",
    });
    const hiddenPhotoProfile = profileSchema.parse({
      ...profile,
      resumeSemanticSections: resolveResumeSectionInstances([]),
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
    });
    const html = buildDocumentHtml(kompaktApplication, hiddenPhotoProfile, "lebenslauf");
    expect(html.slice(html.indexOf("<body>"))).not.toContain('class="kompakt-pdf-photo"');
  });

  it("omits empty Kompakt sidebar sections instead of leaving headings behind", () => {
    const kompaktApplication = applicationSchema.parse({
      ...application,
      templateId: "kompakt",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "visual",
        backgroundId: "abstract",
      },
    });
    const emptySidebarProfile = profileSchema.parse({
      ...profile,
      skills: [],
      certifications: [],
    });
    const html = buildDocumentHtml(
      kompaktApplication,
      emptySidebarProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).not.toContain("Stärken");
    expect(body).not.toContain("Erfolge");
    expect(body).not.toContain("Fähigkeiten");
  });

  it("renders Kompakt ATS without flow lines, skill tags, or rating dots", () => {
    const kompaktApplication = applicationSchema.parse({
      ...application,
      templateId: "kompakt",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "ats",
        backgroundId: "abstract",
      },
    });
    const html = buildDocumentHtml(
      kompaktApplication,
      profile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("managed-pdf-ats");
    expect(body).not.toContain("kompakt-pdf-background");
    expect(body).not.toContain("kompakt-pdf-skills");
    expect(body).not.toContain("managed-pdf-dots");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
  });

  it("renders Einspaltig as a geometric one-column document with a round photo", () => {
    const einspaltigApplication = applicationSchema.parse({
      ...application,
      templateId: "einspaltig",
      accentColor: "#0B3485",
      secondaryColor: "#4AAAF4",
      designSettings: {
        ...application.designSettings,
        columnLayout: "single",
        resumeOutputMode: "visual",
        backgroundId: "geometric",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      einspaltigApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="einspaltig"');
    expect(body).toContain("einfach-pdf-inner");
    expect(html).toContain(".einfach-pdf .managed-pdf-background{z-index:-1");
    expect(body).toContain('class="managed-pdf-background"');
    expect(body).toContain('<img class="einfach-pdf-photo"');
    expect(body).toContain("managed-strengths-grid");
  });

  it("keeps strengths but omits Kenntnisse when the knowledge section is disabled", () => {
    const einspaltigApplication = applicationSchema.parse({
      ...application,
      templateId: "einspaltig",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "visual",
        backgroundId: "geometric",
      },
    });
    const profileWithoutKnowledge = profileSchema.parse({
      ...profile,
      skills: [
        "Führungskompetenz – Ein Team erfolgreich entwickelt.",
        "Vertriebsstrategie – Den Umsatz messbar gesteigert.",
      ],
      knowledgeSection: {
        title: "Kenntnisse",
        isVisible: false,
        categories: [],
      },
    });
    const html = buildDocumentHtml(
      einspaltigApplication,
      profileWithoutKnowledge,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("Stärken");
    expect(body).not.toContain(">Kenntnisse<");
  });

  it("renders Einspaltig ATS in logical order without photo or geometry", () => {
    const einspaltigApplication = applicationSchema.parse({
      ...application,
      templateId: "einspaltig",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "ats",
        backgroundId: "geometric",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      education: [
        {
          id: crypto.randomUUID(),
          from: "2015",
          to: "2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      einspaltigApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("managed-pdf-ats");
    expect(body).toContain('data-template="einspaltig"');
    expect(body).not.toContain("einfach-pdf-background");
    expect(body).not.toContain("<img");
    expect(body).not.toContain("managed-pdf-dots");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
    expect(body.indexOf("Stärken")).toBeLessThan(
      body.indexOf("Zertifikate"),
    );
  });

  it("renders Klassisch with background waves, round photo, and horizontal strengths", () => {
    const klassischApplication = applicationSchema.parse({
      ...application,
      templateId: "klassisch",
      accentColor: "#2B2F32",
      secondaryColor: "#00AFC5",
      designSettings: {
        ...application.designSettings,
        columnLayout: "single",
        resumeOutputMode: "visual",
        backgroundId: "classic-soft-blue-waves",
        showBackgroundInPrint: true,
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      skills: [
        "Teamleitung – Führung interdisziplinärer Teams",
        "Kommunikation – Abstimmung mit Fachbereichen",
        "Konfliktmanagement – Nachhaltige Lösungen",
      ],
      languages: ["Deutsch – Muttersprache", "Englisch – Versiert"],
    });
    const html = buildDocumentHtml(
      klassischApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="klassisch"');
    expect(body).toContain('class="klassisch-pdf-background"');
    expect(body).toContain('<img class="klassisch-pdf-photo"');
    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("klassisch-pdf-entry-head");
    expect(html).toContain(".klassisch-pdf-background{position:absolute;inset:0;z-index:-1");
    expect(body).not.toContain("Seite 1 / 1");
  });

  it("renders Klassisch ATS in logical order without photo or wave decoration", () => {
    const klassischApplication = applicationSchema.parse({
      ...application,
      templateId: "klassisch",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "ats",
        backgroundId: "classic-soft-blue-waves",
      },
    });
    const atsProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      skills: [
        "Teamführung – Führung interdisziplinärer Teams",
        "Kommunikation – Abstimmung mit Fachbereichen",
        "Konfliktmanagement – Nachhaltige Lösungen",
        "Jira",
      ],
      education: [
        {
          id: crypto.randomUUID(),
          from: "2015",
          to: "2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      klassischApplication,
      atsProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("klassisch-pdf-ats");
    expect(body).not.toContain("klassisch-pdf-background");
    expect(body).not.toContain("<img");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Erfahrung"),
    );
    expect(body.indexOf("Erfahrung")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
    expect(body.indexOf("Stärken")).toBeLessThan(
      body.indexOf("Zertifikate"),
    );
  });

  it("renders Modern with a clean contact header, round photo, and two columns", () => {
    const modernApplication = applicationSchema.parse({
      ...application,
      templateId: "modern",
      accentColor: "#06B6C9",
      secondaryColor: "#C7F1F5",
      designSettings: {
        ...application.designSettings,
        columnLayout: "two-column-left-wide",
        resumeOutputMode: "visual",
        backgroundId: "white",
        showBackgroundInPrint: false,
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      birthDate: "01.03.1990",
      birthPlace: "München",
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      modernApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain('data-template="modern"');
    expect(body).not.toContain("modern-pdf-background");
    expect(body).toContain("modern-pdf-contacts inline");
    expect(body).toContain("modern-pdf-columns");
    expect(body).toContain('<img class="modern-pdf-photo"');
    expect(body).toContain("Kurzprofil");
    expect(body).toContain("Erfahrung");
    expect(body).toContain("Besondere Kenntnisse");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Erfahrung"),
    );
    expect(body).not.toContain("cv-sidebar-right");
  });

  it("uses the saved Modern section order in the PDF HTML", () => {
    const modernApplication = applicationSchema.parse({
      ...application,
      templateId: "modern",
    });
    const reorderedProfile = profileSchema.parse({
      ...profile,
      education: [
        {
          id: crypto.randomUUID(),
          from: "2018",
          to: "2021",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
      resumeSectionLayouts: {
        modern: [
          { type: "education", zone: "main" },
          { type: "experience", zone: "main" },
          { type: "summary", zone: "sidebar" },
          { type: "strengths", zone: "sidebar" },
          { type: "languages", zone: "sidebar" },
          { type: "knowledge", zone: "sidebar" },
          { type: "certifications", zone: "sidebar" },
        ],
      },
    });
    const html = buildDocumentHtml(
      modernApplication,
      reorderedProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));
    const mainStart = body.indexOf('class="modern-pdf-left"');

    expect(body.indexOf("Bildungsweg", mainStart)).toBeLessThan(
      body.indexOf("Erfahrung", mainStart),
    );
  });

  it("keeps Modern strengths visible when Kenntnisse is disabled", () => {
    const modernApplication = applicationSchema.parse({
      ...application,
      templateId: "modern",
    });
    const strengthsOnlyProfile = profileSchema.parse({
      ...profile,
      strengths: [
        {
          id: crypto.randomUUID(),
          title: "Java",
          description: "Maven, Spring Boot",
        },
      ],
      resumeSections: {
        ...profile.resumeSections,
        strengths: true,
        skills: false,
      },
      resumeSectionLayouts: {
        modern: [{ type: "strengths", zone: "sidebar" }],
      },
    });
    const html = buildDocumentHtml(
      modernApplication,
      strengthsOnlyProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("Stärken");
    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("Maven, Spring Boot");
    expect(body).not.toContain(">Fähigkeiten<");
  });

  it("renders Modern ATS linearly without waves, photo, icons, or rating dots", () => {
    const modernApplication = applicationSchema.parse({
      ...application,
      templateId: "modern",
      designSettings: {
        ...application.designSettings,
        resumeOutputMode: "ats",
        backgroundId: "waves",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      education: [
        {
          id: crypto.randomUUID(),
          from: "2015",
          to: "2019",
          degree: "B.Sc. Informatik",
          institution: "Beispiel Universität",
          city: "Berlin",
        },
      ],
      certifications: ["Professional Scrum Master I"],
    });
    const html = buildDocumentHtml(
      modernApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("modern-pdf-ats");
    expect(body).not.toContain("modern-pdf-background");
    expect(body).not.toContain("<img");
    expect(body).not.toContain("modern-pdf-dots");
    expect(body.indexOf("Persönliche Daten")).toBeLessThan(
      body.indexOf("Kurzprofil"),
    );
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Beruflicher Werdegang"),
    );
    expect(body.indexOf("Beruflicher Werdegang")).toBeLessThan(
      body.indexOf("Bildungsweg"),
    );
    expect(body.indexOf("Bildungsweg")).toBeLessThan(
      body.indexOf("Kenntnisse"),
    );
    expect(body.indexOf("Kenntnisse")).toBeLessThan(
      body.indexOf("Sprachen"),
    );
    expect(body.indexOf("Sprachen")).toBeLessThan(
      body.indexOf("Stärken"),
    );
    expect(body.indexOf("Stärken")).toBeLessThan(
      body.indexOf("Zertifikate"),
    );
  });

  it("keeps a reference-density Modern resume on one A4 page", () => {
    const modernApplication = applicationSchema.parse({
      ...application,
      templateId: "modern",
      designSettings: {
        ...application.designSettings,
        columnLayout: "two-column-left-wide",
        resumeOutputMode: "visual",
        backgroundId: "waves",
      },
    });
    const denseProfile = profileSchema.parse({
      ...profile,
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2012 + index * 4}`,
        to: `${2016 + index * 4}`,
        role: `Projektrolle ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        city: "Berlin",
        achievements: Array.from(
          { length: 3 },
          (_, achievementIndex) =>
            `Messbares Projektergebnis ${achievementIndex + 1} erfolgreich erreicht.`,
        ),
      })),
      education: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2006 + index * 2}`,
        to: `${2008 + index * 2}`,
        degree: `Abschluss ${index + 1}`,
        institution: `Hochschule ${index + 1}`,
        city: "Berlin",
      })),
    });
    const html = buildDocumentHtml(
      modernApplication,
      denseProfile,
      "lebenslauf",
    );

    expect(html.match(/data-resume-page="/g)).toHaveLength(1);
  });

  it("renders the Tabellarisch PDF as a one-column timeline with strengths", () => {
    const tabellarischApplication = applicationSchema.parse({
      ...application,
      templateId: "tabellarisch",
      accentColor: "#C78300",
      secondaryColor: "#17263D",
      designSettings: {
        ...application.designSettings,
        columnLayout: "timeline",
        resumeOutputMode: "visual",
        backgroundId: "white",
      },
    });
    const timelineProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      linkedin: "linkedin.com/in/mina-kaya",
      birthDate: "01.03.1990",
      birthPlace: "Berlin",
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2012 + index * 4}`,
        to: `${2016 + index * 4}`,
        role: `Projektrolle ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        city: "Berlin",
        achievements: Array.from(
          { length: 3 },
          (_, achievementIndex) =>
            `Messbares Projektergebnis ${achievementIndex + 1} erfolgreich erreicht.`,
        ),
      })),
      education: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2006 + index * 2}`,
        to: `${2008 + index * 2}`,
        degree: `Abschluss ${index + 1}`,
        institution: `Hochschule ${index + 1}`,
        city: "Berlin",
      })),
    });
    const html = buildDocumentHtml(
      tabellarischApplication,
      timelineProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body.match(/data-resume-page="/g)?.length).toBeLessThanOrEqual(2);
    expect(body).toContain('data-template="tabellarisch"');
    expect(body).toContain('data-no-fit="true"');
    expect(body).toContain("tabellarisch-pdf-background");
    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("tabellarisch-pdf-timeline");
    expect(html).toContain(
      '.tabellarisch-pdf-rail:before{position:absolute;top:2.5mm;bottom:-1mm',
    );
    expect(html).not.toContain(
      ".tabellarisch-pdf-entry:last-child .tabellarisch-pdf-rail:before{bottom:auto;height:1mm}",
    );
    expect(body).toContain('<img class="tabellarisch-pdf-photo"');
    expect(body.indexOf(">Zusammenfassung<")).toBeLessThan(
      body.indexOf(">Stärken<"),
    );
    expect(body.indexOf(">Stärken<")).toBeLessThan(
      body.indexOf(">Beruflicher Werdegang<"),
    );
    expect(body).not.toContain("column-timeline");
  });

  it("keeps Tabellarisch strengths when the knowledge section is disabled", () => {
    const tabellarischApplication = applicationSchema.parse({
      ...application,
      templateId: "tabellarisch",
    });
    const strengthsOnlyProfile = profileSchema.parse({
      ...profile,
      skills: [],
      knowledgeSection: {
        title: "Kenntnisse",
        isVisible: true,
        categories: [],
      },
      strengths: [
        {
          id: crypto.randomUUID(),
          title: "Java",
          description: "Maven, Spring Boot",
        },
        {
          id: crypto.randomUUID(),
          title: "PHP",
          description: "Laravel, Symfony",
        },
      ],
      resumeSections: {
        ...profile.resumeSections,
        strengths: true,
        skills: false,
      },
    });
    const html = buildDocumentHtml(
      tabellarischApplication,
      strengthsOnlyProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain(">Stärken<");
    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain(">Java<");
    expect(body).toContain("Maven, Spring Boot");
    expect(body).toContain(">php<");
  });

  it("renders Tabellarisch ATS without photo, geometry, or timeline rail", () => {
    const tabellarischApplication = applicationSchema.parse({
      ...application,
      templateId: "tabellarisch",
      designSettings: {
        ...application.designSettings,
        columnLayout: "compact-ats",
        resumeOutputMode: "ats",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
    });
    const html = buildDocumentHtml(
      tabellarischApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("tabellarisch-pdf-ats");
    expect(body).not.toContain("tabellarisch-pdf-background");
    expect(body).not.toContain("tabellarisch-pdf-rail");
    expect(body).not.toContain("<img");
    expect(body.indexOf("Kurzprofil")).toBeLessThan(
      body.indexOf("Erfahrung"),
    );
  });

  it("renders Gepflegt with its dedicated teal sidebar PDF layout", () => {
    const gepflegtApplication = applicationSchema.parse({
      ...application,
      templateId: "gepflegt",
      accentColor: "#00B8B5",
      secondaryColor: "#087875",
      designSettings: {
        ...application.designSettings,
        columnLayout: "left-sidebar",
        resumeOutputMode: "visual",
        backgroundId: "white",
      },
    });
    const gepflegtProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
      linkedin: "https://www.linkedin.com/in/mina-kaya/",
      skills: [
        "Kundenorientierung: Anforderungen in belastbare Lösungen übersetzt",
        "Mentorship: Neue Teammitglieder strukturiert eingearbeitet",
      ],
      experiences: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2012 + index * 4}`,
        to: `${2016 + index * 4}`,
        role: `Projektrolle ${index + 1}`,
        company: `Unternehmen ${index + 1}`,
        city: "Berlin",
        achievements: Array.from(
          { length: 3 },
          (_, achievementIndex) =>
            `Messbares Projektergebnis ${achievementIndex + 1} erfolgreich erreicht.`,
        ),
      })),
      education: Array.from({ length: 3 }, (_, index) => ({
        id: crypto.randomUUID(),
        from: `${2006 + index * 2}`,
        to: `${2008 + index * 2}`,
        degree: `Abschluss ${index + 1}`,
        institution: `Hochschule ${index + 1}`,
        city: "Berlin",
      })),
    });
    const html = buildDocumentHtml(
      gepflegtApplication,
      gepflegtProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body.match(/data-resume-page="/g)?.length).toBeGreaterThanOrEqual(2);
    expect(body).toContain('data-template="gepflegt"');
    expect(body).toContain("gepflegt-pdf-sidebar");
    expect(body).toContain("gepflegt-pdf-photo");
    expect(body).toContain("gepflegt-pdf-contacts");
    expect(body).toContain("managed-strengths-grid");
    expect(body).toContain("https://www.linkedin.com/in/mina-kaya/");
    expect(body.indexOf(">Zusammenfassung<")).toBeLessThan(
      body.indexOf(">Stärken<"),
    );
    expect(body.indexOf(">Erfahrung<")).toBeLessThan(
      body.indexOf(">Bildungsweg<"),
    );
  });

  it("renders Gepflegt ATS without a sidebar, photo, or icons", () => {
    const gepflegtApplication = applicationSchema.parse({
      ...application,
      templateId: "gepflegt",
      designSettings: {
        ...application.designSettings,
        columnLayout: "compact-ats",
        resumeOutputMode: "ats",
      },
    });
    const mediaProfile = profileSchema.parse({
      ...profile,
      photoPath: "data:image/png;base64,iVBORw0KGgo=",
    });
    const html = buildDocumentHtml(
      gepflegtApplication,
      mediaProfile,
      "lebenslauf",
    );
    const body = html.slice(html.indexOf("<body>"));

    expect(body).toContain("gepflegt-pdf-ats");
    expect(body).not.toContain("gepflegt-pdf-sidebar");
    expect(body).not.toContain("gepflegt-pdf-photo");
    expect(body).not.toContain("<svg");
  });
});
