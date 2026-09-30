import { afterEach, describe, expect, it } from "vitest";
import { applicationSchema, profileSchema } from "./schema";
import { getTemplate } from "./templates";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { buildDeckblattModel, deckblattCss, deckblattFitScript, fitDeckblattContacts, renderDeckblattMarkup } from "./deckblattDesigns";

const now = "2026-09-26T09:00:00.000Z";
const settings = getTemplateDocumentDesignDefaults("modern");

/** The contact details of the acceptance test, as a profile holds them. */
const contacts = {
  street: "Am Richtsberg 20", postalCode: "35039", city: "Marburg", phone: "+4917693153406", email: "mustafa.ozdemir1408@gmail.com",
  linkedin: "https://www.linkedin.com/in/mustafa-oezdemir/", github: "https://github.com/mustafa-oezdemir", portfolio: "https://pehlione.com/",
};
const values = ["Am Richtsberg 20, 35039 Marburg", "+4917693153406", "mustafa.ozdemir1408@gmail.com", "https://www.linkedin.com/in/mustafa-oezdemir/", "https://github.com/mustafa-oezdemir", "https://pehlione.com/"];

const markupOf = (designId: string, extra: Record<string, unknown> = {}, files: string[] = []) => {
  const profile = profileSchema.parse({ id: crypto.randomUUID(), isDefault: true, firstName: "Mustafa", lastName: "Özdemir", title: "Softwareentwickler", updatedAt: now, ...contacts, ...extra });
  const application = applicationSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), folderName: "Test", company: { name: "Nordlicht AG", city: "Hamburg" }, contact: {}, job: { title: "Entwickler" }, status: "Entwurf",
    templateId: "modern", accentColor: getTemplate("modern").accent, secondaryColor: getTemplate("modern").secondary, designSettings: settings,
    documents: { coverSheetDesign: designId }, statusHistory: [], createdAt: now, updatedAt: now,
  });
  const attachments = files.map((fileName, order) => ({ id: crypto.randomUUID(), applicationId: application.id, category: "Zeugnisse" as const, fileName, description: "", documentDate: "", order, includedInPackage: true, createdAt: now }));
  const model = buildDeckblattModel({ application, profile, documents: application.documents, attachments, accentColor: application.accentColor, secondaryColor: application.secondaryColor, settings });
  return { model, markup: renderDeckblattMarkup(model) };
};

describe("Deckblatt contact rows of Pastell and Akzentband", () => {
  it("print every detail whole on one row: the address as one line, the URLs with their scheme", () => {
    for (const designId of ["pastell", "akzentband"]) {
      const { markup, model } = markupOf(designId);
      expect(model.contacts.map((contact) => contact.value), designId).toEqual(values);
      const items = markup.match(/<li data-contact-kind="[^"]+">.*?<\/li>/g) ?? [];
      expect(items, designId).toHaveLength(6);
      for (const [index, value] of values.entries()) expect(items[index], `${designId} ${value}`).toContain(value);
      expect(markup, designId).not.toContain("<br>");
      expect(markup, designId).not.toContain("…");
    }
  });

  it("forbid a line break inside a row, in the one stylesheet of the preview and the PDF", () => {
    const rule = deckblattCss.split("\n").find((line) => line.startsWith(".deckblatt .dk-contacts li{")) ?? "";
    expect(rule).toContain("white-space:nowrap");
    expect(rule).toContain("overflow-wrap:normal");
    expect(rule).toContain("word-break:normal");
    expect(deckblattCss).toContain(".deckblatt .dk-contacts li span{white-space:nowrap;overflow-wrap:normal;word-break:normal}");
    // Breaking anywhere is only the last resort of the fitting, never a rule of a row.
    const breaking = deckblattCss.split("\n").filter((line) => line.includes("dk-contacts") && line.includes("overflow-wrap:anywhere"));
    expect(breaking.every((line) => line.includes("dk-contacts--wrap"))).toBe(true);
  });

  it("Pastell sets two contact columns next to the Anlagen column, all starting at the top", () => {
    const { markup } = markupOf("pastell", {}, ["Zeugnis.pdf"]);
    const grid = markup.slice(markup.indexOf('class="dk-lower-grid"'));
    expect(grid.indexOf('class="dk-contacts dk-contacts--cols"')).toBeGreaterThan(-1);
    expect(grid.indexOf("dk-contacts--cols")).toBeLessThan(grid.indexOf('class="dk-docs'));
    expect(grid).toContain("<h3>Anlagen:</h3>");
    // The rows fill the columns from left to right: Adresse | Telefon, E-Mail | LinkedIn, GitHub | Website.
    expect([...grid.matchAll(/data-contact-kind="([a-z]+)"/g)].map((match) => match[1])).toEqual(["location", "phone", "email", "linkedin", "github", "portfolio"]);
    expect(deckblattCss).toContain(".deckblatt--pastell .dk-lower-grid{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:7mm;align-items:start}");
    expect(deckblattCss).toContain(".deckblatt--pastell .dk-contacts--cols{grid-template-columns:max-content max-content;gap:2mm 7mm}");
    // The Anlagen heading is as high as a contact row, so its text lines up with the first row.
    expect(deckblattCss).toContain("min-height:5.6mm");
  });

  it("Pastell keeps a short contact list in one column", () => {
    const { markup } = markupOf("pastell", { github: "", portfolio: "", linkedin: "" });
    expect(markup).not.toContain("dk-contacts--cols");
  });

  it("Akzentband lets the band grow with the longest row instead of breaking it", () => {
    expect(deckblattCss).toContain(".deckblatt--akzentband{display:grid;grid-template-columns:fit-content(100mm) minmax(0,1fr)");
    expect(deckblattCss).toContain(".deckblatt--akzentband .dk-band{position:relative;min-width:70mm;");
  });

  it("take their details, their visibility and the Anlagen from the central sources", () => {
    const { markup } = markupOf("pastell", { phone: "" }, ["Arbeitszeugnis.pdf"]);
    expect(markup).not.toContain("+4917693153406");
    expect(markup).toContain("Arbeitszeugnis.pdf");
    expect(markup).toContain("mustafa.ozdemir1408@gmail.com");
  });
});

/**
 * A stand-in for the page that the fitting measures: a row is as wide as its text (0.5 em per character) at the
 * size the script has set, and the rows of Pastell lie in one or two columns between the page margins.
 */
const fakePage = (design: "pastell" | "akzentband", texts: string[], options: { docs?: boolean } = {}) => {
  const perMm = 4;
  const state = { pt: design === "pastell" ? 10 : 8, cols: design === "pastell" && texts.length > 3, wrap: false };
  const width = (text: string) => text.length * 0.5 * state.pt * 0.3528 * perMm;
  const icon = (design === "pastell" ? 8.6 : 7) * perMm;
  const leftOf = (index: number) => {
    if (design === "akzentband") return 15 * perMm + icon;
    const first = 17 * perMm + icon;
    if (!state.cols || index % 2 === 0) return first;
    const firstColumn = Math.max(...texts.filter((_, at) => at % 2 === 0).map(width));
    return first + firstColumn + 7 * perMm + icon;
  };
  const spans = texts.map((text, index) => ({ getBoundingClientRect: () => ({ right: leftOf(index) + (state.wrap ? Math.min(width(text), 30 * perMm) : width(text)) }) }));
  const widest = Math.max(0, ...spans.map((span) => span.getBoundingClientRect().right));
  const band = { getBoundingClientRect: () => ({ right: Math.min(100 * perMm, widest + 10.4 * perMm, 100 * perMm) }) };
  const grid = { getBoundingClientRect: () => ({ right: (210 - 17) * perMm }) };
  const list = {
    classList: {
      contains: (name: string) => name === "dk-contacts--cols" && state.cols,
      remove: (name: string) => { if (name === "dk-contacts--cols") state.cols = false; },
      add: (name: string) => { if (name === "dk-contacts--wrap") state.wrap = true; },
    },
    querySelectorAll: () => spans,
    querySelector: () => ({ fontSize: "" }),
  };
  const page = {
    getAttribute: () => design,
    getBoundingClientRect: () => ({ width: 210 * perMm }),
    style: { setProperty: (name: string, value: string) => { if (name === "--dk-contact-size") state.pt = Number.parseFloat(value); } },
    querySelector: (selector: string) => ({ ".dk-contacts": list, ".dk-band": band, ".dk-lower-grid": grid, ".dk-docs": options.docs === false ? null : { classList: { contains: () => false } } })[selector] ?? null,
  };
  (globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({ fontSize: `${state.pt / 0.75}px` });
  return { state, root: { querySelectorAll: () => [page] } as unknown as ParentNode };
};

describe("the fitting of the contact rows", () => {
  afterEach(() => { delete (globalThis as { getComputedStyle?: unknown }).getComputedStyle; });

  it("is one script: the preview runs it after drawing, the PDF carries it inside the page", () => {
    expect(typeof fitDeckblattContacts).toBe("function");
    expect(deckblattFitScript.startsWith("<script>")).toBe(true);
    expect(deckblattFitScript.endsWith("</script>")).toBe(true);
    expect(deckblattFitScript).toContain(".deckblatt[data-deckblatt-design]");
  });

  it("leaves the text size alone when the rows fit", () => {
    const short = fakePage("akzentband", ["Weg 1, 10115 Berlin", "0301234", "a@b.de"]);
    fitDeckblattContacts(short.root);
    expect(short.state.pt).toBe(8);
    expect(short.state.wrap).toBe(false);
  });

  it("shrinks the text, not the row, until the longest row is inside the page", () => {
    const akzentband = fakePage("akzentband", ["Am Richtsberg 20, 35039 Marburg", "+4917693153406", "https://www.linkedin.com/in/mustafa-oezdemir-1a2b3c4d5e/"]);
    fitDeckblattContacts(akzentband.root);
    expect(akzentband.state.pt).toBeLessThan(8);
    expect(akzentband.state.pt).toBeGreaterThanOrEqual(6.8);
    expect(akzentband.state.wrap).toBe(false);
  });

  it("keeps Pastell in two contact columns while the text stays readable, else in one column", () => {
    const fits = fakePage("pastell", values);
    fitDeckblattContacts(fits.root);
    expect(fits.state.cols).toBe(true);
    expect(fits.state.pt).toBeGreaterThanOrEqual(7.8);

    const long = fakePage("pastell", [...values.slice(0, 3), "https://www.linkedin.com/in/maximiliane-charlotte-schwarz-hohenlohe-langenburg-1985/", values[4], values[5]]);
    fitDeckblattContacts(long.root);
    expect(long.state.cols).toBe(false);
    expect(long.state.wrap).toBe(false);
  });

  it("lets a row wrap only when even the smallest text would leave the page", () => {
    const impossible = fakePage("akzentband", ["https://www.linkedin.com/in/" + "x".repeat(140) + "/"]);
    fitDeckblattContacts(impossible.root);
    expect(impossible.state.pt).toBe(6.8);
    expect(impossible.state.wrap).toBe(true);
  });
});
