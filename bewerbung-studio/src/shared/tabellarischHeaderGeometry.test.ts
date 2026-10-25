import { describe, expect, it } from "vitest";
import { resolveCvDocument } from "./resolveCvDocument";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import { estimateResumeHeaderTop, estimateTabellarischTop, getTabellarischHeaderContacts, tabellarischContactRows } from "./resumeHeaderGeometry";
import type { ResumePagePlan } from "./documentPagination";
import {
  calibrationCheckboxes, makeTabellarischProfile, transportpilotBullets, type CalibrationCheckbox, type TabellarischFixtureOptions,
} from "./__tabellarischHeaderFixture";

/**
 * The page planner has to follow the REAL header: a Kontaktdaten checkbox (Website, GitHub, LinkedIn, phone, …) that
 * puts one more contact into a grid row that is there already adds no height, so it must not move a career bullet.
 * The expectations below are what Chromium drew for these headers (`scripts/tabellarisch-header-calibration.mjs` +
 * `check-tabellarisch-header-calibration.cjs`: the top of the first section and the lines of every grid row).
 */
const extras = ["birthDate", "birthPlace", "nationality", "familyStatus", "children", "onlineProfiles", "xing"] as const;
const everything = Object.fromEntries(extras.map((key) => [key, true])) as Partial<Record<CalibrationCheckbox, boolean>>;
const reported = (visibility: Partial<Record<CalibrationCheckbox, boolean>> = {}, options: TabellarischFixtureOptions = {}) =>
  makeTabellarischProfile({ ...options, visibility, career: false });
const display = (options: TabellarischFixtureOptions) => getResumeDisplayProfile(makeTabellarischProfile(options))!;
const top = (options: TabellarischFixtureOptions) => estimateTabellarischTop(display(options), true, options.photo ?? true).top;

describe("Tabellarisch header: the left-aligned identity and contacts", () => {
  it("places address parts, e-mail and phone in the requested order before optional links", () => {
    const contacts = getTabellarischHeaderContacts(display({ visibility: everything }));
    expect(contacts.map((contact) => contact.kind)).toEqual([
      "street", "location", "email", "phone", "linkedin", "github", "website", "birth",
      "nationality", "familyStatus", "children", "onlineProfile", "onlineProfile",
    ]);
    expect(contacts.slice(0, 4).map((contact) => contact.text)).toEqual([
      "Beispielallee 20", "35039 Marburg, Deutschland", "mina.beispiel1408@example.com", "+49 176 12345678",
    ]);
    expect(contacts.slice(0, 4).every((contact) => contact.primary)).toBe(true);
    expect(contacts.slice(4).every((contact) => !contact.primary)).toBe(true);
  });

  it("respects field visibility without leaving an empty separator", () => {
    const kinds = (visibility: Partial<Record<CalibrationCheckbox, boolean>>) => getTabellarischHeaderContacts(display({ visibility })).map((contact) => contact.kind);
    expect(kinds({})).toEqual(["street", "location", "email", "phone", "linkedin", "github", "website"]);
    expect(kinds({ address: false })).toEqual(["email", "phone", "linkedin", "github", "website"]);
    expect(kinds({ email: false, phone: false })).toEqual(["street", "location", "linkedin", "github", "website"]);
  });

  it("measures one primary line and the optional grid separately", () => {
    const rows = (fields: Record<string, unknown> = {}) => tabellarischContactRows(getTabellarischHeaderContacts(display({ fields })));
    expect(rows()).toEqual([1, 1, 1]);
    expect(rows({ email: "mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com" })[0]).toBe(2);
    expect(rows({ portfolio: "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung" }).at(-1)).toBe(4);
  });
});

describe("Tabellarisch header: the first section follows the rendered header", () => {
  // Measured with Electron/Chromium from the new PDF header; these fixtures use no personal data.
  it.each<[string, TabellarischFixtureOptions, number]>([
    ["all contacts", { visibility: everything, photo: false }, 73.95],
    ["all contacts with photo", { visibility: everything, photo: true }, 73.95],
    ["reported header", { photo: false }, 59.83],
    ["reported header with photo", { photo: true }, 59.83],
    ["no LinkedIn", { visibility: { ...everything, linkedin: false }, photo: true }, 69.24],
    ["long Website", { fields: { portfolio: "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung" }, photo: true }, 70.51],
    ["long e-mail", { fields: { email: "mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com" }, photo: true }, 63.39],
    ["long name", { fields: { firstName: "Mina-Alexandra", lastName: "Beispiel-Schmidt-Wolkenstein" }, photo: true }, 68.65],
    ["long title with photo", { fields: { title: "Technisch und prozessorientierter Quereinsteiger mit langjähriger Erfahrung im Produktionsumfeld sowie in der Prozessplanung und Digitalisierung" }, photo: true }, 65.31],
    ["no title", { fields: { title: "" }, photo: true }, 51.29],
  ])("%s", (_label, options, measured) => {
    const estimate = top(options);
    expect(estimate).toBeGreaterThanOrEqual(measured - 0.05);
    expect(estimate).toBeLessThanOrEqual(measured + (_label === "long e-mail" ? 3.6 : 0.5));
  });

  it("keeps the generic rule for other templates", () => {
    const profile = display({});
    expect(estimateResumeHeaderTop("tabellarisch", profile, "side", 60)).toBeUndefined();
    expect(estimateResumeHeaderTop("tabellarisch", profile, "main", 90)).toBe(90);
  });
});
describe("Tabellarisch: the page plan follows the real header", () => {
  const settings = getTemplateDocumentDesignDefaults("tabellarisch");
  const plan = (options: TabellarischFixtureOptions) => {
    const profile = makeTabellarischProfile(options);
    return resolveCvDocument({ profile, templateId: "tabellarisch", settings }).pagePlan;
  };
  const shape = (pages: ResumePagePlan[]) =>
    pages.map((page) => page.items.map((item) => `${item.kind}:${item.id.slice(-2)}${"bullets" in item && item.bullets ? `[${item.bullets.from}-${item.bullets.to}/${item.bullets.total}]` : ""}`).join(",")).join(" | ");

  // A Website contact that occupies the same header row must not change the career split.
  it("keeps the Transportpilot split unchanged with the Website on or off", () => {
    const off = plan({ visibility: { website: false } });
    const on = plan({ visibility: { website: true } });
    expect(shape(on)).toBe(shape(off));
    const pilot = (pages: ResumePagePlan[]) => pages.flatMap((page) => page.items).filter((item) => item.id.endsWith("12"));
    const ranges = pilot(on).map((item) => item.bullets ?? { from: 0, to: transportpilotBullets.length, total: transportpilotBullets.length });
    expect(ranges[0].from).toBe(0);
    expect(ranges.at(-1)?.to).toBe(transportpilotBullets.length);
    expect(ranges.every((range, index) => index === 0 || ranges[index - 1].to === range.from)).toBe(true);
    expect(on.flatMap((page) => page.items).map((item) => item.kind).lastIndexOf("experience"))
      .toBeLessThan(on.flatMap((page) => page.items).findIndex((item) => item.kind === "education"));
  });

  it("does the same without a photo", () => {
    expect(shape(plan({ photo: false, visibility: { website: true } }))).toBe(shape(plan({ photo: false, visibility: { website: false } })));
  });

  it("leaves the plan alone for every checkbox that adds no row: GitHub with the Website, LinkedIn with its neighbours", () => {
    const base = shape(plan({ visibility: { website: false } }));
    for (const visibility of [{ website: true }, { website: true, birthDate: false }, { website: true, onlineProfiles: false }] as const)
      expect(shape(plan({ visibility })), JSON.stringify(visibility)).toBe(base);
  });

  it("follows a header that really grows: a Website that wraps takes bullets away from page one", () => {
    const long = "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung";
    const grown = plan({ visibility: { website: true }, fields: { portfolio: long } });
    const normal = plan({ visibility: { website: true } });
    expect(shape(grown)).not.toBe(shape(normal));
    // …and nothing of the career is lost or doubled on the way
    const bullets = (pages: ResumePagePlan[]) => pages.flatMap((page) => page.items).filter((item) => item.id.endsWith("12"))
      .reduce((total, item) => total + ("bullets" in item && item.bullets ? item.bullets.to - item.bullets.from : transportpilotBullets.length), 0);
    expect(bullets(grown)).toBe(transportpilotBullets.length);
    expect(bullets(normal)).toBe(transportpilotBullets.length);
  });

  it.each(calibrationCheckboxes)("a switch of the %s checkbox moves the plan only when it moves the header", (key: CalibrationCheckbox) => {
    // Every stage of the headers from "nothing" to "everything": the switch is tried with the checkbox on and off.
    const stages: Array<Partial<Record<CalibrationCheckbox, boolean>>> = [{}, everything, { website: false }, { github: false, website: false }, { linkedin: false }];
    for (const stage of stages) {
      for (const bullets of [[4, 8], [3, 9], [5, 7], [4, 9]] as Array<[number, number]>) {
        const on = { visibility: { ...stage, [key]: true }, bullets };
        const off = { visibility: { ...stage, [key]: false }, bullets };
        // same header top (the model) => the same page plan, whatever the content
        if (top(on) === top(off)) expect(shape(plan(on)), `${key} ${JSON.stringify(stage)} ${bullets}`).toBe(shape(plan(off)));
      }
    }
  });
});
