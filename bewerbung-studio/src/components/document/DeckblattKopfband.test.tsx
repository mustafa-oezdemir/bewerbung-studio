import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applicationSchema, profileSchema, type Attachment } from "../../shared/schema";
import { getTemplate } from "../../shared/templates";
import { getTemplateDocumentDesignDefaults } from "../../shared/cvDesign";
import { getDeckblattExperienceYears, getDeckblattQualifications } from "../../shared/deckblatt";
import { buildDeckblattModel, deckblattCss, getDeckblattDesign, renderDeckblattMarkup } from "../../shared/deckblattDesigns";
import { getStrengthSymbolMarkup } from "../../shared/strengthSymbols";
import { DeckblattPreview } from "./DeckblattPreview";

const now = "2026-09-26T09:00:00.000Z";
const photo = "data:image/png;base64,AA==";
const settings = getTemplateDocumentDesignDefaults("modern");
const id = () => crypto.randomUUID();

const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: id(), isDefault: true, firstName: "Zora", lastName: "Quellmalz", title: "Softwareentwicklerin",
    street: "Gartenweg 7", postalCode: "34117", city: "Kassel", phone: "+49 555 0101", email: "zora@quellmalz.test",
    linkedin: "linkedin.com/in/zora", github: "github.com/zora", portfolio: "", photoPath: photo, updatedAt: now,
    birthDate: "1992-05-12", nationality: "deutsch", familyStatus: "Ledig",
    resumePersonalFieldVisibility: { birthDate: true, nationality: true, familyStatus: true },
    strengths: [{ id: id(), title: "Java" }, { id: id(), title: "Docker" }, { id: id(), title: "Laravel", iconId: "" }],
    education: [
      { id: id(), from: "2010", to: "2014", degree: "B.Sc.", fieldOfStudy: "Informatik", institution: "Uni Kassel", status: "Abgeschlossen" },
      { id: id(), from: "2014", to: "09/2017", degree: "M.Sc.", fieldOfStudy: "Angewandte Informatik", institution: "Uni Kassel", status: "Abgeschlossen" },
    ],
    experiences: [{ id: id(), from: "01/2018", to: "", isCurrent: true, role: "Entwicklerin", company: "Nordlicht", achievements: [] }],
    ...extra,
  });

const build = (options: { profile?: ReturnType<typeof profile>; job?: string; documents?: Record<string, unknown>; files?: string[] } = {}) => {
  const current = applicationSchema.parse({
    schemaVersion: 1, id: id(), folderName: "Test", company: { name: "Nordlicht AG", city: "Hamburg" }, contact: {},
    job: { title: options.job ?? "Software Engineer" }, status: "Entwurf", templateId: "modern", accentColor: getTemplate("modern").accent,
    secondaryColor: getTemplate("modern").secondary, designSettings: settings, documents: { coverSheetDesign: "kopfband", ...options.documents },
    statusHistory: [], createdAt: now, updatedAt: now,
  });
  const attachments: Attachment[] = (options.files ?? []).map((fileName, order) => ({
    id: id(), applicationId: current.id, category: "Zeugnisse", fileName, description: "", documentDate: "", order, includedInPackage: true, createdAt: now,
  }));
  const model = buildDeckblattModel({
    application: current, profile: options.profile ?? profile(), documents: current.documents, attachments,
    accentColor: current.accentColor, secondaryColor: current.secondaryColor, settings: current.designSettings,
  });
  const markup = renderDeckblattMarkup(model);
  const page = parseHTML(`<html><body>${markup}</body></html>`).document.querySelector(".deckblatt")!;
  const text = (selector: string) => Array.from(page.querySelectorAll(selector)).map((node) => node.textContent?.trim());
  return { model, markup, page, text };
};

describe("Deckblatt design Kopfband", () => {
  it("is an additional design next to the existing ones", () => {
    expect(getDeckblattDesign("kopfband")).toMatchObject({ id: "kopfband", label: "Kopfband", usesDocumentBackground: false });
    expect(getDeckblattDesign(undefined).id).toBe("klassisch");
    for (const line of deckblattCss.split("\n").filter((rule) => rule.includes("kopfband")))
      expect(line.split(/[{,]/)[0].startsWith(".deckblatt--kopfband"), line).toBe(true);
  });

  it("lays the page out like the reference: header band, name, data blocks, Tech-Stack, no signature, no Ort, Datum", () => {
    const { page, text } = build();
    expect(Array.from(page.children).map((child) => child.getAttribute("class"))).toEqual(["dk-head", "dk-main"]);
    expect(page.querySelector(".dk-head .dk-photo img")?.getAttribute("src")).toBe(photo);
    expect(text(".dk-head .dk-lead")).toEqual(["Bewerbung"]);
    expect(text(".dk-head .dk-role")).toEqual(["als Software Engineer"]);
    // The name stands once on the page, under the band (user: not twice).
    expect(page.querySelector(".dk-head .dk-head-name")).toBeNull();
    expect(page.textContent?.split("Zora Quellmalz").length).toBe(2);
    expect(text(".dk-head .dk-app")).toEqual(["bei Nordlicht AG · Hamburg"]);
    expect(page.querySelector(".dk-head .dk-lines")).toBeNull();
    expect(text(".dk-person .dk-name")).toEqual(["Zora Quellmalz"]);
    expect(text(".dk-person .dk-title")).toEqual(["Softwareentwicklerin"]);
    expect(text(".dk-facts h3")).toEqual(["Persönliche Daten", "Qualifikationen"]);
    expect(text(".dk-facts .dk-block:first-child li")).toEqual(["Geboren: 12.05.1992", "Staatsangehörigkeit: deutsch", "Familienstand: Ledig"]);
    expect(text(".dk-facts .dk-block:last-child li")[0]).toBe("M.Sc. Angewandte Informatik");
    // A Deckblatt is not signed (user): no signature, not even a saved profile one, and no "Ort, Datum" line.
    const signature = "data:image/png;base64,BB==";
    const signed = build({ profile: profile({ signaturePath: signature }) });
    expect(signed.model).not.toHaveProperty("signatureSource");
    expect(signed.markup).not.toContain(signature);
    expect(Array.from(signed.page.querySelectorAll("img"), (image) => image.getAttribute("src"))).toEqual([photo]);
    expect(signed.page.querySelector(".dk-signature")).toBeNull();
    expect(signed.page.textContent).not.toContain("Unterschrift");
    expect(signed.page.querySelector(".dk-sign, .dk-place")).toBeNull();
    expect(signed.page.textContent).not.toContain("Kassel, 26.09.2026");
    expect(signed.page.textContent).not.toContain("26.09.2026");
    expect(signed.model).not.toHaveProperty("place");
    expect(deckblattCss).not.toMatch(/\.deckblatt--kopfband \.dk-(sign|signature|place)\b/);
    // Anlagen and Kontakt close the page at its foot instead.
    expect(page.querySelector(".dk-main")!.lastElementChild?.className).toBe("dk-bottom");
    expect(deckblattCss).toContain(".deckblatt--kopfband .dk-bottom{margin-top:auto;");
  });

  it("sets Anlagen (one third) beside Kontakt (two thirds) at the foot of the page", () => {
    const { page, text } = build({ files: ["Zeugnis.pdf"] });
    expect(Array.from(page.querySelectorAll(".dk-bottom > div")).map((cell) => cell.className)).toEqual(["dk-docs", "dk-contact"]);
    expect(text(".dk-docs li")).toEqual(["Anschreiben", "Lebenslauf", "Zeugnis.pdf"]);
    expect(text(".dk-contact .dk-lines li")).toEqual(["Gartenweg 7, 34117 Kassel", "+49 555 0101", "zora@quellmalz.test", "linkedin.com/in/zora", "github.com/zora"]);
    expect(page.querySelector('.dk-contact a[href="mailto:zora@quellmalz.test"]')).toBeTruthy();
    expect(deckblattCss).toContain(".deckblatt--kopfband .dk-bottom{margin-top:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);");
    expect(deckblattCss).toContain(".deckblatt--kopfband .dk-bottom>:only-child{grid-column:1/-1}");
  });

  it("takes the Tech-Stack from the Stärken, with the icon each one has in the Lebenslauf", () => {
    const { page, text } = build();
    expect(text(".dk-stack h3")).toEqual(["Tech-Stack"]);
    expect(text(".dk-stack li span")).toEqual(["Java", "Docker", "Laravel"]);
    for (const icon of Array.from(page.querySelectorAll(".dk-stack-icon"))) expect(icon.innerHTML).toContain("<svg");
    // Skills that are not Stärken do not appear, and without Stärken the section is gone.
    const plain = build({ profile: profile({ strengths: [], skills: ["Excel"] }) });
    expect(plain.page.querySelector(".dk-stack")).toBeNull();
  });

  it("shows the category symbols in the Tech-Stack: detected from the name, a saved icon first, order and names kept", () => {
    const titles = ["API", "Backend", "Frontend", "Datenbank", "Monitoring", "CI/CD", "CD", "Testing", "Cloud", "Go", "React", "Docker"];
    const strengths = titles.map((title) => ({ id: id(), title, iconId: title === "Datenbank" ? "symbol:check" : title === "Go" ? "symbol:cloud" : "" }));
    const { model, markup, page, text } = build({ profile: profile({ strengths }) });
    expect(text(".dk-stack li span")).toEqual(titles);
    const symbols = Array.from(page.querySelectorAll(".dk-stack-icon svg"), (svg) =>
      svg.getAttribute("data-strength-symbol") ?? svg.getAttribute("data-brand"));
    expect(symbols).toEqual([
      "symbol:api", "symbol:backend", "symbol:frontend", "symbol:check", "symbol:monitoring", "symbol:ci",
      "symbol:cd", "symbol:test", "symbol:cloud", "symbol:cloud", "react", "devicon:docker",
    ]);
    expect(model.techStack[0]!.icon).toBe(getStrengthSymbolMarkup("symbol:api"));
    // The preview prints the very markup of the PDF, icons included, and colours them like the export's
    // `.technology-brand-svg{color:var(--accent)}`; Aufzählungszeichen keep their inline `color:inherit`.
    expect(renderToStaticMarkup(<DeckblattPreview model={model} />)).toContain(markup);
    expect(deckblattCss).toContain(".deckblatt--kopfband .dk-stack-icon svg{color:var(--accent)}");
    expect(markup).toContain('data-strength-symbol="symbol:check" style="color:inherit"');
  });

  it("centres the Tech-Stack rows, however many Stärken there are (six per row)", () => {
    expect(deckblattCss).toContain(".deckblatt--kopfband .dk-stack ul{display:flex;flex-wrap:wrap;justify-content:center;");
    expect(deckblattCss).toContain(".deckblatt--kopfband .dk-stack li{display:flex;flex:0 0 calc((100% - 15mm) / 6);");
  });

  it("fills Qualifikationen with the Kurzprofil of the Deckblatt, justified, and falls back to degrees and years without it", () => {
    const statement = "Zuverlässige Entwicklerin mit acht Jahren Erfahrung in Java und Cloud.";
    const own = build({ documents: { deckblattStatement: statement } });
    expect(own.text(".dk-facts .dk-block:last-child h3")).toEqual(["Qualifikationen"]);
    expect(own.text(".dk-facts .dk-block:last-child .dk-statement")).toEqual([statement]);
    expect(own.page.querySelector(".dk-facts .dk-block:last-child ul")).toBeNull();
    expect(deckblattCss).toMatch(/\.deckblatt--kopfband \.dk-statement\{[^}]*text-align:justify/);
    expect(build().text(".dk-facts .dk-block:last-child li")).toEqual(["M.Sc. Angewandte Informatik", "B.Sc. Informatik", "8+ Jahre Berufserfahrung"]);
  });

  it("follows the Lebenslauf's privacy switches for personal data and drops empty blocks", () => {
    const hidden = build({ profile: profile({ resumePersonalFieldVisibility: {} }) });
    expect(hidden.model.personalDetails).toEqual([]);
    expect(hidden.text(".dk-facts h3")).toEqual(["Qualifikationen"]);
    const bare = build({ profile: profile({ resumePersonalFieldVisibility: {}, education: [], experiences: [], photoPath: "", phone: "", email: "", linkedin: "", github: "", street: "", postalCode: "", city: "", title: "" }) });
    expect(bare.page.querySelector(".dk-facts")).toBeNull();
    expect(bare.page.querySelector(".dk-contact")).toBeNull();
    expect(bare.page.querySelector(".dk-photo .dk-initials")?.textContent).toBe("ZQ");
    expect(bare.text(".dk-bottom > div > h3")).toEqual(["Anlagen"]);
  });

  it("is drawn by the preview with the very markup and stylesheet of the PDF", () => {
    const { model, markup } = build();
    const preview = renderToStaticMarkup(<DeckblattPreview model={model} />);
    expect(preview).toContain(markup);
    expect(preview).toContain(".deckblatt--kopfband .dk-head{");
  });

  it("escapes every value it prints", () => {
    const { markup } = build({ job: "<b>Dev</b> & Ops", profile: profile({ strengths: [{ id: id(), title: "<script>x</script>" }] }) });
    expect(markup).not.toContain("<b>Dev</b>");
    expect(markup).not.toContain("<script>x");
  });
});

describe("Kopfband Qualifikationen", () => {
  const today = new Date("2026-10-15T12:00:00Z");

  it("counts overlapping stations once and leaves out gaps, Praktika and Werkstudent jobs", () => {
    const experiences = [
      { id: id(), from: "01/2015", to: "12/2016", role: "A", company: "A", achievements: [] },
      { id: id(), from: "06/2016", to: "12/2017", role: "B", company: "B", achievements: [] },
      { id: id(), from: "01/2020", to: "12/2020", role: "C", company: "C", achievements: [] },
      { id: id(), from: "01/2010", to: "12/2014", role: "D", company: "D", employmentType: "Werkstudent", achievements: [] },
      { id: id(), from: "01/2009", to: "12/2009", role: "E", company: "E", employmentType: "Praktikum", achievements: [] },
    ];
    // 2015–2017 (36 months, overlap counted once) + 2020 (12 months) = 4 years.
    expect(getDeckblattExperienceYears(profile({ experiences }), today)).toBe(4);
    expect(getDeckblattExperienceYears(profile({ experiences: [] }), today)).toBe(0);
  });

  it("names the latest two degrees first and marks a running one", () => {
    const qualifications = getDeckblattQualifications(profile({
      education: [
        { id: id(), from: "2008", to: "2010", degree: "Abitur", institution: "Gymnasium", status: "Abgeschlossen" },
        { id: id(), from: "2010", to: "2014", degree: "B.Sc.", fieldOfStudy: "Informatik", institution: "Uni", status: "Abgeschlossen" },
        { id: id(), from: "2024", to: "", degree: "M.Sc.", fieldOfStudy: "Data Science", institution: "Uni", status: "Laufend" },
        { id: id(), from: "2015", to: "2016", degree: "MBA", institution: "Uni", status: "Ohne Abschluss" },
      ],
    }), today);
    expect(qualifications).toEqual(["M.Sc. Data Science (laufend)", "B.Sc. Informatik", "8+ Jahre Berufserfahrung"]);
  });
});
