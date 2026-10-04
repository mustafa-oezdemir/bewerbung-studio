import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applicationSchema, documentDraftSchema, profileSchema, type Attachment } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { buildDeckblattModel, deckblattCss, defaultDeckblattDesign, getDeckblattDesign, renderDeckblattMarkup } from "../../shared/deckblattDesigns";
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

type Options = { profile?: ReturnType<typeof profile>; documents?: Record<string, unknown>; files?: string[]; accent?: string; hide?: number[] };

const build = (options: Options = {}) => {
  const current = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Nordlicht AG", city: "Hamburg" }, contact: {},
    job: { title: "Lohnbuchhaltung" }, status: "Entwurf", templateId: "modern", accentColor: options.accent ?? getTemplate("modern").accent,
    secondaryColor: getTemplate("modern").secondary, designSettings: settings, documents: { coverSheetDesign: "seitenpanel", ...options.documents },
    statusHistory: [], createdAt: now, updatedAt: now,
  });
  const attachments: Attachment[] = (options.files ?? ["Arbeitszeugnis Nordlicht.pdf", "Zertifikat DATEV.pdf"]).map((fileName, order) => ({
    id: crypto.randomUUID(), applicationId: current.id, category: "Zeugnisse", fileName, description: "", documentDate: "", order, includedInPackage: true, createdAt: now,
  }));
  const documents = options.hide
    ? documentDraftSchema.parse({ ...current.documents, documentListSettings: options.hide.map((index) => ({ key: `attachment:${attachments[index].id}`, isVisible: false })) })
    : current.documents;
  const model = buildDeckblattModel({
    application: current, profile: options.profile ?? profile(), documents, attachments,
    accentColor: current.accentColor, secondaryColor: current.secondaryColor, settings: current.designSettings,
  });
  const markup = renderDeckblattMarkup(model);
  const page = parseHTML(`<html><body>${markup}</body></html>`).document.querySelector(".deckblatt")!;
  const text = (selector: string) => Array.from(page.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, " ").trim());
  return { model, markup, page, text };
};

const luminance = (hex: string) => {
  const [red, green, blue] = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};
const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

describe("Deckblatt design Seitenpanel", () => {
  it("is an additional, selectable design; the default stays Klassisch", () => {
    expect(getDeckblattDesign("seitenpanel")).toMatchObject({ id: "seitenpanel", label: "Seitenpanel", usesDocumentBackground: false });
    expect(defaultDeckblattDesign).toBe("klassisch");
    expect(documentDraftSchema.parse({}).coverSheetDesign).toBe("klassisch");
    expect(documentDraftSchema.parse({ coverSheetDesign: "seitenpanel" }).coverSheetDesign).toBe("seitenpanel");
    for (const id of ["klassisch", "pastell", "akzentband"]) expect(documentDraftSchema.parse({ coverSheetDesign: id }).coverSheetDesign).toBe(id);
    expect(getDeckblattDesign("unbekannt").id).toBe("klassisch");
    // Every rule of the design is scoped to its page.
    for (const line of deckblattCss.split("\n").filter((rule) => rule.includes("seitenpanel")))
      expect(line.split(/[{,]/)[0].startsWith(".deckblatt--seitenpanel"), line).toBe(true);
  });

  it("composes the reference: BEWERBUNG with the job, photo on the panel edge, the candidate below, Anlagen in the panel", () => {
    const { page, text } = build();
    expect(text(".dk-head .dk-lead")).toEqual(["Bewerbung"]);
    expect(text(".dk-head .dk-role")).toEqual(["als Lohnbuchhaltung"]);
    expect(text(".dk-head h1")).toEqual(["Bewerbung als Lohnbuchhaltung"]);
    expect(text(".dk-head .dk-app span")).toEqual(["bei Nordlicht AG", "Hamburg · 26.09.2026"]);
    expect(page.querySelector(".dk-photo img")?.getAttribute("src")).toBe(photo);
    expect(text(".dk-person h2")).toEqual(["Zora Quellmalz"]);
    expect(text(".dk-person .dk-title")).toEqual(["Lohnbuchhalterin"]);
    // The address of one contact value, drawn on two lines.
    expect(text(".dk-address span")).toEqual(["Gartenweg 7", "34117 Kassel"]);
    expect(text(".dk-reach li")).toEqual(["Tel.:+49 555 0101", "E-Mail:zora@quellmalz.test", "LinkedIn:linkedin.com/in/zora"]);
    expect(page.querySelector('.dk-reach a[href="mailto:zora@quellmalz.test"]')).toBeTruthy();
    expect(text(".dk-panel .dk-panel-docs h3")).toEqual(["Anlagen:"]);
    expect(text(".dk-panel .dk-panel-docs li")).toEqual(expect.arrayContaining(["Anschreiben", "Lebenslauf", "Arbeitszeugnis Nordlicht.pdf", "Zertifikat DATEV.pdf"]));
    // Competencies are not part of this design.
    expect(page.querySelector(".dk-competencies")).toBeNull();
  });

  it("places the panel and the portrait photo on A4 so that the photo crosses the panel edge undistorted", () => {
    const rule = (selector: string) => deckblattCss.split("\n").find((line) => line.startsWith(`${selector}{`)) ?? "";
    expect(rule(".deckblatt--seitenpanel .dk-panel")).toContain("top:0;right:0;bottom:0;width:62mm");
    const photoRule = rule(".deckblatt--seitenpanel .dk-photo");
    expect(photoRule).toContain("left:116mm");
    expect(photoRule).toContain("width:52mm;aspect-ratio:3/4");
    // 116 + 52 = 168 mm: the photo reaches 20 mm into the panel, which starts at 210 - 62 = 148 mm.
    expect(116 + 52).toBeGreaterThan(210 - 62);
    expect(116).toBeLessThan(210 - 62);
    expect(deckblattCss).toContain(".deckblatt .dk-photo img,.deckblatt .dk-band-photo img{width:100%;height:100%;object-fit:cover}");
    // No media query: the preview scales the A4 page instead of rearranging it.
    expect(deckblattCss).not.toContain("@media");
  });

  it("prints only the data of the profile and the application, never the sample of the reference", () => {
    const { markup } = build();
    for (const sample of ["Svenja", "Mustermann", "Musterstraße", "max.mustermann", "Berufsbezeichnung", "Ausbildungsplatz", "0123/12345"]) expect(markup, sample).not.toContain(sample);
  });

  it("shows initials in the same frame when there is no photo, and no empty blocks for missing data", () => {
    const { page, markup } = build({ profile: profile({ photoPath: "", title: "", phone: "", email: "", linkedin: "", street: "", postalCode: "", city: "" }) });
    expect(markup).not.toContain("<img");
    expect(page.querySelector(".dk-photo .dk-initials")?.textContent).toBe("ZQ");
    expect(page.querySelector(".dk-panel")).toBeTruthy();
    for (const selector of [".dk-title", ".dk-statement", ".dk-address", ".dk-reach"]) expect(page.querySelector(selector), selector).toBeNull();
  });

  it("honours the contact visibility of the Deckblatt", () => {
    const { text, markup } = build({ documents: { coverSheetContactVisibility: { address: true, phone: false, email: true, linkedin: false, github: false, website: false } } });
    expect(markup).not.toContain("+49 555 0101");
    expect(markup).not.toContain("linkedin.com/in/zora");
    expect(text(".dk-address span")).toEqual(["Gartenweg 7", "34117 Kassel"]);
    expect(text(".dk-reach li")).toEqual(["E-Mail:zora@quellmalz.test"]);
  });

  it("lists the Anlagen of the document list, hides hidden ones and turns compact for long lists", () => {
    const hidden = build({ hide: [1] });
    expect(hidden.text(".dk-panel-docs li")).toContain("Arbeitszeugnis Nordlicht.pdf");
    expect(hidden.text(".dk-panel-docs li")).not.toContain("Zertifikat DATEV.pdf");
    const many = build({ files: Array.from({ length: 8 }, (_, index) => `Zeugnis ${index + 1}.pdf`) });
    expect(many.page.querySelector(".dk-panel-docs")?.className).toContain("dk-panel-docs--many");
    expect(many.text(".dk-panel-docs li")).toHaveLength(10);
  });

  it("keeps a short statement short and long values wrapping inside their column", () => {
    const { text } = build({ documents: { deckblattStatement: "Zuverlässig und strukturiert." } });
    expect(text(".dk-statement")).toEqual(["Zuverlässig und strukturiert."]);
    expect(deckblattCss).toMatch(/\.deckblatt--seitenpanel \.dk-statement\{[^}]*-webkit-line-clamp:5/);
    expect(deckblattCss).toMatch(/\.deckblatt--seitenpanel \.dk-reach li\{[^}]*overflow-wrap:anywhere/);
    expect(deckblattCss).toMatch(/\.deckblatt--seitenpanel \.dk-panel-docs li\{[^}]*overflow-wrap:anywhere/);
    const long = build({ profile: profile({ firstName: "Maximiliane Alexandra", lastName: "von Hohenstein-Quellmalz" }) });
    expect(long.page.querySelector(".dk-name")?.className).toContain("dk-name--xlong");
  });

  it("colours the panel from the theme and keeps its text readable for blue, green and dark navy", () => {
    const panels = new Set<string>();
    for (const accent of ["#2563eb", "#3f8f5a", "#1f3a68", "#f4c430"]) {
      const { model, markup } = build({ accent });
      const panel = model.style["--tint-panel"];
      panels.add(panel);
      expect(markup).toContain(`--tint-panel:${panel}`);
      expect(contrast(model.style["--on-panel"], panel), accent).toBeGreaterThanOrEqual(4.5);
    }
    expect(panels.size).toBe(4);
    const css = deckblattCss.split("\n").filter((line) => line.includes("seitenpanel")).join("\n");
    expect((css.match(/#[0-9a-f]{3,6}\b/gi) ?? [])).toEqual([]);
    expect(css).toContain("background:var(--tint-panel);color:var(--on-panel)");
  });

  it("is drawn by the preview with the very markup and stylesheet of the PDF", () => {
    const { model, markup } = build();
    const preview = renderToStaticMarkup(<DeckblattPreview model={model} />);
    expect(preview).toContain(markup);
    expect(preview).toContain(".deckblatt--seitenpanel .dk-panel{");
  });

  it("escapes every value it prints", () => {
    const { markup } = build({ profile: profile({ firstName: "<b>Zora</b>", street: "<i>Weg</i> 1" }), documents: { deckblattStatement: "\"><script>x</script>" } });
    expect(markup).not.toContain("<b>Zora</b>");
    expect(markup).not.toContain("<i>Weg</i>");
    expect(markup).toContain("&lt;b&gt;Zora&lt;/b&gt;");
    expect(markup).not.toContain("<script>");
  });
});
