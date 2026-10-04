import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applicationSchema, documentDraftSchema, profileSchema, type Attachment } from "./schema";
import { getTemplate } from "./templates";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import {
  buildDeckblattModel,
  deckblattCss,
  deckblattDesignIds,
  deckblattDesigns,
  defaultDeckblattDesign,
  getDeckblattDesign,
  renderDeckblattMarkup,
} from "./deckblattDesigns";

const now = "2026-09-26T09:00:00.000Z";
const photo = "data:image/png;base64,AA==";
const settings = getTemplateDocumentDesignDefaults("modern");

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Zora", lastName: "Quellmalz", title: "Lohnbuchhalterin",
    street: "Gartenweg 7", postalCode: "34117", city: "Kassel", phone: "+49 555 0101", email: "zora@quellmalz.test",
    linkedin: "linkedin.com/in/zora", github: "github.com/zora", portfolio: "zora.test", photoPath: photo,
    summary: "Zuverlässige Lohnbuchhalterin mit Schwerpunkt auf Abrechnung.", skills: ["DATEV", "Lexware", "Excel"], updatedAt: now,
    ...extra,
  });

const application = (documents: Record<string, unknown> = {}, colors: { accent?: string; secondary?: string } = {}) =>
  applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Nordlicht AG", city: "Hamburg" }, contact: {},
    job: { title: "Lohnbuchhaltung" }, status: "Entwurf", templateId: "modern", accentColor: colors.accent ?? getTemplate("modern").accent,
    secondaryColor: colors.secondary ?? getTemplate("modern").secondary, designSettings: settings, documents, statusHistory: [], createdAt: now, updatedAt: now,
  });

const attachment = (applicationId: string, fileName: string, order: number): Attachment => ({
  id: crypto.randomUUID(), applicationId, category: "Zeugnisse", fileName, description: "", documentDate: "", order, includedInPackage: true, createdAt: now,
});

type Options = {
  profile?: ReturnType<typeof profile>;
  documents?: Record<string, unknown>;
  colors?: { accent?: string; secondary?: string };
  files?: string[];
};

const build = (designId: string, options: Options = {}) => {
  const current = application({ coverSheetDesign: designId, ...options.documents }, options.colors);
  const model = buildDeckblattModel({
    application: current, profile: options.profile ?? profile(), documents: current.documents,
    attachments: (options.files ?? ["Arbeitszeugnis Nordlicht.pdf", "Zertifikat DATEV.pdf"]).map((file, index) => attachment(current.id, file, index)),
    accentColor: current.accentColor, secondaryColor: current.secondaryColor, settings: current.designSettings,
  });
  return { model, markup: renderDeckblattMarkup(model), application: current };
};

describe("Deckblatt designs", () => {
  it("offers the selectable designs from one registry, the first one being the existing Deckblatt", () => {
    expect(deckblattDesignIds).toEqual(["klassisch", "pastell", "akzentband", "farbbalken", "seitenpanel"]);
    expect(deckblattDesigns.map((design) => design.id)).toEqual([...deckblattDesignIds]);
    expect(new Set(deckblattDesigns.map((design) => design.label)).size).toBe(deckblattDesignIds.length);
    expect(defaultDeckblattDesign).toBe("klassisch");
    expect(documentDraftSchema.parse({}).coverSheetDesign).toBe("klassisch");
    for (const id of deckblattDesignIds) expect(documentDraftSchema.parse({ coverSheetDesign: id }).coverSheetDesign).toBe(id);
    expect(documentDraftSchema.safeParse({ coverSheetDesign: "unbekannt" }).success).toBe(false);
    // An unknown stored value never breaks the page.
    expect(getDeckblattDesign("unbekannt").id).toBe("klassisch");
    expect(getDeckblattDesign(undefined).id).toBe("klassisch");
  });

  it("draws every design from the profile, the application and the document list, with no example data of its own", () => {
    for (const id of deckblattDesignIds) {
      const { markup: html, model } = build(id);
      expect(model.designId).toBe(id);
      expect(html, id).toContain(`deckblatt--${id}`);
      // A design may set a value in several elements (Seitenpanel: BEWERBUNG over "als …"); the reader sees the text.
      const markup = `${html} ${parseHTML(`<html><body>${html}</body></html>`).document.body.textContent?.replace(/\s+/g, " ")}`;
      for (const value of ["Zora Quellmalz", "Lohnbuchhalterin", "Bewerbung als Lohnbuchhaltung", "Nordlicht AG", "Hamburg", "Gartenweg 7", "34117 Kassel", "+49 555 0101",
        'href="mailto:zora@quellmalz.test"', 'href="https://linkedin.com/in/zora"', "Arbeitszeugnis Nordlicht.pdf", "Zertifikat DATEV.pdf", "Anschreiben", "Lebenslauf"])
        expect(markup, `${id} ${value}`).toContain(value.startsWith("Gartenweg") || value.startsWith("34117") ? value.split(" ")[0] : value);
      // The sample content of the reference image never appears.
      for (const sample of ["Leonie", "Schwarz", "Bilanzbuchhalterin", "superduperseite", "Sonnenstraße", "01234 56789", "Großau"]) expect(markup, `${id} ${sample}`).not.toContain(sample);
    }
  });

  it("takes the colours and fonts from the theme and design settings, never from literals in the stylesheet", () => {
    const blue = build("pastell", { colors: { accent: "#1d4ed8", secondary: "#e0e7ff" } });
    const orange = build("pastell", { colors: { accent: "#c2410c", secondary: "#ffedd5" } });
    expect(blue.model.style["--accent"]).toBe("#1d4ed8");
    expect(orange.model.style["--accent"]).toBe("#c2410c");
    expect(blue.markup).toContain("--accent:#1d4ed8");
    expect(blue.model.style["--tint-soft"]).not.toBe(orange.model.style["--tint-soft"]);
    expect(blue.model.style["--heading-font"]).toContain("Source Sans 3");
    expect(blue.model.style["--ink"]).toBe(settings.textColor);
    expect(blue.model.style["--heading"]).toBe(settings.headingColor);
    // Colours in the stylesheet are variables; only white and the mask's black are written out.
    const literals = (deckblattCss.match(/#[0-9a-f]{3,6}\b/gi) ?? []).filter((hex) => !["#fff", "#000"].includes(hex.toLowerCase()));
    expect(literals).toEqual([]);
  });

  it("uses the photo of the profile and keeps the layout when there is none", () => {
    for (const id of deckblattDesignIds) {
      expect(build(id).markup, id).toContain(`src="${photo}"`);
      const without = build(id, { profile: profile({ photoPath: "" }) });
      expect(without.markup, id).not.toContain("<img");
      if (id !== "klassisch") {
        expect(without.markup, id).toContain("dk-initials");
        expect(without.markup).toContain("ZQ");
      }
    }
  });

  it("shows only the contact details that are visible and present, and no empty blocks", () => {
    for (const id of deckblattDesignIds) {
      const hidden = build(id, { documents: { coverSheetContactVisibility: { address: true, phone: false, email: true, linkedin: false, github: false, website: false } } });
      expect(hidden.markup, id).not.toContain("+49 555 0101");
      expect(hidden.markup, id).not.toContain("linkedin.com/in/zora");
      expect(hidden.markup, id).toContain("zora@quellmalz.test");
      const bare = build(id, { profile: profile({ phone: "", email: "", linkedin: "", github: "", portfolio: "", street: "", postalCode: "", city: "" }), files: [] });
      expect(bare.model.contacts).toEqual([]);
      expect(bare.markup, id).not.toContain("dk-contacts");
      expect(bare.markup, id).not.toContain("Kontakt</h3>");
    }
  });

  it("lists the attachments of the document list and honours hidden entries", () => {
    const current = application({ coverSheetDesign: "pastell" });
    const files = [attachment(current.id, "Arbeitszeugnis Nordlicht.pdf", 0), attachment(current.id, "Zertifikat DATEV.pdf", 1)];
    const model = buildDeckblattModel({
      application: current, profile: profile(), attachments: files, accentColor: current.accentColor, secondaryColor: current.secondaryColor, settings,
      documents: documentDraftSchema.parse({ coverSheetDesign: "pastell", documentListSettings: [{ key: `attachment:${files[1].id}`, isVisible: false }] }),
    });
    expect(model.documents).toContain("Arbeitszeugnis Nordlicht.pdf");
    expect(model.documents).not.toContain("Zertifikat DATEV.pdf");
  });

  it("names the attachments list per design; the title under the name is always the profile's", () => {
    expect(build("klassisch").markup).toContain("Bewerbungsunterlagen");
    expect(build("pastell").markup).toContain("Anlagen:");
    expect(build("akzentband").markup).toContain(">Anlagen<");
    expect(build("farbbalken").markup).toContain("<h3>Anlagen:</h3>");
    expect(build("seitenpanel").markup).toContain("<h3>Anlagen:</h3>");
    for (const id of deckblattDesignIds) {
      // A title saved with an older Deckblatt does not override the profile, and the job title never stands in.
      const saved = build(id, { documents: { coverSheetProfessionalTitle: "Leitung Finanzen" } });
      expect(saved.model.professionalTitle).toBe("Lohnbuchhalterin");
      expect(saved.markup).not.toContain("Leitung Finanzen");
      const untitled = build(id, { profile: profile({ title: "" }) });
      expect(untitled.model.professionalTitle).toBe("");
      expect(untitled.markup).not.toMatch(/<(?:p|h2|span)[^>]*>Lohnbuchhaltung</);
    }
  });

  it("escapes every value it prints", () => {
    const { markup } = build("pastell", { profile: profile({ firstName: "<b>Zora</b>", title: "A & B" }), documents: { deckblattStatement: "\"><script>x</script>" } });
    expect(markup).not.toContain("<b>Zora</b>");
    expect(markup).toContain("&lt;b&gt;Zora&lt;/b&gt;");
    expect(markup).toContain("A &amp; B");
    expect(markup).not.toContain("<script>");
  });
});
