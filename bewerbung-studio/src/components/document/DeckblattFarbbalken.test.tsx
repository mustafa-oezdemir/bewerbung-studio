import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applicationSchema, profileSchema, type Attachment } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { buildDeckblattModel, deckblattCss, getDeckblattDesign, renderDeckblattMarkup } from "../../shared/deckblattDesigns";
import { DeckblattPreview } from "./DeckblattPreview";

const now = "2026-09-26T09:00:00.000Z";
const photo = "data:image/png;base64,AA==";
const settings = getTemplateDocumentDesignDefaults("modern");

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: true, firstName: "Zora", lastName: "Quellmalz", title: "Lohnbuchhalterin",
    street: "Gartenweg 7", postalCode: "34117", city: "Kassel", phone: "+49 555 0101", email: "zora@quellmalz.test",
    linkedin: "linkedin.com/in/zora", github: "", portfolio: "", photoPath: photo, updatedAt: now, ...extra,
  });

type Options = { profile?: ReturnType<typeof profile>; application?: Record<string, unknown>; documents?: Record<string, unknown>; files?: string[] };

const build = (options: Options = {}) => {
  const current = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Nordlicht AG", street: "Hafenstraße 1", postalCode: "20095", city: "Hamburg" },
    contact: { salutation: "Frau", firstName: "Petra", lastName: "Sommer", position: "Personalabteilung" }, job: { title: "Lohnbuchhalterin" }, status: "Entwurf",
    templateId: "modern", accentColor: getTemplate("modern").accent, secondaryColor: getTemplate("modern").secondary, designSettings: settings,
    documents: { coverSheetDesign: "farbbalken", ...options.documents }, statusHistory: [], createdAt: now, updatedAt: now, ...options.application,
  });
  const attachments: Attachment[] = (options.files ?? ["Arbeitszeugnis Nordlicht.pdf"]).map((fileName, order) => ({
    id: crypto.randomUUID(), applicationId: current.id, category: "Zeugnisse", fileName, description: "", documentDate: "", order, includedInPackage: true, createdAt: now,
  }));
  const model = buildDeckblattModel({
    application: current, profile: options.profile ?? profile(), documents: current.documents, attachments,
    accentColor: current.accentColor, secondaryColor: current.secondaryColor, settings: current.designSettings,
  });
  const markup = renderDeckblattMarkup(model);
  const { document } = parseHTML(`<html><body>${markup}</body></html>`);
  const page = document.querySelector(".deckblatt")!;
  const text = (selector: string) => Array.from(page.querySelectorAll(selector)).map((node) => node.textContent?.trim());
  return { model, markup, page, text };
};

describe("Deckblatt design Farbbalken", () => {
  it("is an additional design: the existing ones stay, the new one is not the default", () => {
    expect(getDeckblattDesign("farbbalken")).toMatchObject({ id: "farbbalken", label: "Farbbalken", usesDocumentBackground: false });
    expect(getDeckblattDesign(undefined).id).toBe("klassisch");
    // The rules of the new design never reach the other pages.
    for (const line of deckblattCss.split("\n").filter((rule) => rule.includes("farbbalken")))
      expect(line.split(/[{,]/)[0].startsWith(".deckblatt--farbbalken"), line).toBe(true);
  });

  it("lays the page out like the reference: title, photo, name band, recipient and Anlagen", () => {
    const { page, text } = build();
    const blocks = Array.from(page.children).map((child) => child.getAttribute("class"));
    expect(blocks.filter((name) => !name?.startsWith("dk-bar"))).toEqual(["dk-upper", "dk-band", "dk-foot"]);
    expect(text(".dk-head h1")).toEqual(["Bewerbung als Lohnbuchhalterin"]);
    expect(page.querySelector(".dk-upper .dk-photo-area .dk-photo img")?.getAttribute("src")).toBe(photo);
    expect(text(".dk-band h2")).toEqual(["Zora Quellmalz"]);
    expect(text(".dk-band .dk-title")).toEqual(["Lohnbuchhalterin"]);
    expect(text(".dk-band .dk-address")).toEqual(["Gartenweg 7, 34117 Kassel"]);
    expect(text(".dk-band .dk-lines li")).toEqual(["+49 555 0101", "zora@quellmalz.test", "linkedin.com/in/zora"]);
    expect(page.querySelector('.dk-lines a[href="mailto:zora@quellmalz.test"]')).toBeTruthy();
    // The recipient is the address block of the Anschreiben.
    expect(text(".dk-foot .dk-recipient > *")).toEqual(["Nordlicht AG", "Frau Petra Sommer", "Personalabteilung", "Hafenstraße 1", "20095 Hamburg"]);
    expect(text(".dk-foot .dk-docs h3")).toEqual(["Anlagen:"]);
    expect(text(".dk-foot .dk-docs li")).toEqual(expect.arrayContaining(["Anschreiben", "Lebenslauf", "Arbeitszeugnis Nordlicht.pdf"]));
  });

  it("prints only the data of the profile and the application, never example data", () => {
    const { markup } = build({ application: { contact: {} }, profile: profile({ firstName: "Ida", lastName: "Brandt", title: "" }) });
    for (const sample of ["Musterfrau", "Maxi", "Mustermann", "Personalabteilung", "Bilanzbuchhalterin", "Zora"]) expect(markup, sample).not.toContain(sample);
    expect(markup).toContain("Ida Brandt");
    expect(markup).not.toContain('class="dk-title"');
  });

  it("takes an edited recipient address over the one of the application", () => {
    const { text } = build({ documents: { coverRecipientAddress: "Nordlicht AG\n z. H. Herrn Jan Weber \n\nPostfach 12\n20000 Hamburg" } });
    expect(text(".dk-recipient > *")).toEqual(["Nordlicht AG", "z. H. Herrn Jan Weber", "Postfach 12", "20000 Hamburg"]);
  });

  it("keeps its layout without photo, contact details or title", () => {
    const { page, markup } = build({ profile: profile({ photoPath: "", phone: "", email: "", linkedin: "", street: "", postalCode: "", city: "", title: "" }) });
    expect(markup).not.toContain("<img");
    expect(page.querySelector(".dk-photo .dk-initials")?.textContent).toBe("ZQ");
    expect(page.querySelector(".dk-address")).toBeNull();
    expect(page.querySelector(".dk-lines")).toBeNull();
    expect(page.querySelector(".dk-band h2")?.textContent).toBe("Zora Quellmalz");
  });

  it("never distorts the photo and keeps long texts inside the page", () => {
    expect(deckblattCss).toContain(".deckblatt .dk-photo img,.deckblatt .dk-band-photo img{width:100%;height:100%;object-fit:cover}");
    expect(deckblattCss).toMatch(/\.deckblatt--farbbalken \.dk-photo\{[^}]*aspect-ratio:3\/4[^}]*overflow:hidden/);
    // The photo takes the room the title leaves, so a long title cannot push it off the page.
    expect(deckblattCss).toMatch(/\.deckblatt--farbbalken \.dk-photo\{[^}]*height:min\(calc\(100% - 10mm\),108mm\)/);
    expect(deckblattCss).toContain(".deckblatt--farbbalken{display:grid;grid-template-rows:minmax(0,1fr) auto auto;");
    const long = build({
      application: { job: { title: "Sachbearbeiterin Lohn- und Gehaltsabrechnung im Personalwesen (m/w/d) mit Schwerpunkt DATEV" } },
      profile: profile({ firstName: "Maximiliane Alexandra", lastName: "von Hohenstein-Quellmalz" }),
      files: Array.from({ length: 8 }, (_, index) => `Zeugnis ${index + 1}.pdf`),
    });
    expect(long.page.querySelector(".dk-subject")?.className).toContain("dk-subject--xlong");
    expect(long.page.querySelector(".dk-name")?.className).toContain("dk-name--xlong");
    expect(long.page.querySelector(".dk-docs")?.className).toContain("dk-docs--many");
    expect(deckblattCss).toMatch(/\.deckblatt--farbbalken \.dk-recipient\{[^}]*font-style:normal/);
  });

  it("is drawn by the preview with the very markup and stylesheet of the PDF", () => {
    const { model, markup } = build();
    const preview = renderToStaticMarkup(<DeckblattPreview model={model} />);
    expect(preview).toContain(markup);
    expect(preview).toContain(".deckblatt--farbbalken .dk-band{");
  });

  it("is not reached by the text rules of the Anschreiben preview, so every design draws its own sizes there", () => {
    const appCss = readFileSync(resolve(__dirname, "../../app.css"), "utf8");
    const textRules = appCss.split("\n").filter((line) => /^\.document-paper[^{]*:not\(\.document-lebenslauf\)[^{]* (?:p|li|section)\b/.test(line));
    expect(textRules.length).toBeGreaterThanOrEqual(5);
    for (const line of textRules) expect(line, line).toContain(":not(.document-deckblatt)");
  });

  it("escapes every value it prints", () => {
    const { markup } = build({ application: { company: { name: "<b>Nord</b> & Co", city: "Hamburg" } }, profile: profile({ title: "\"><script>x</script>" }) });
    expect(markup).not.toContain("<b>Nord</b>");
    expect(markup).toContain("&lt;b&gt;Nord&lt;/b&gt; &amp; Co");
    expect(markup).not.toContain("<script>");
  });
});
