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

describe("Tabellarisch header: the contacts and their grid", () => {
  it("lists the contacts in the order the header draws them, with the values it prints", () => {
    const contacts = getTabellarischHeaderContacts(display({ visibility: everything }));
    expect(contacts.map((contact) => contact.kind)).toEqual([
      "phone", "email", "linkedin", "location", "github", "website", "birth", "nationality", "familyStatus", "children", "onlineProfile", "onlineProfile",
    ]);
    expect(contacts[0].text).toBe("+49 176 12345678");
    expect(contacts[2].text).toBe("https://www.linkedin.com/in/mina-beispiel-k/");
    expect(contacts[3].text).toBe("Beispielallee 20, 35039 Marburg, Deutschland");
  });

  it("leaves out what a checkbox switches off", () => {
    const kinds = (visibility: Partial<Record<CalibrationCheckbox, boolean>>) => getTabellarischHeaderContacts(display({ visibility })).map((contact) => contact.kind);
    expect(kinds({})).toEqual(["phone", "email", "linkedin", "location", "github", "website"]);
    expect(kinds({ website: false })).toEqual(["phone", "email", "linkedin", "location", "github"]);
    expect(kinds({ github: false })).toEqual(["phone", "email", "linkedin", "location", "website"]);
    expect(kinds({ address: false })).toEqual(["phone", "email", "linkedin", "github", "website"]);
  });

  // The text lines of every grid row of the browser (Chromium, real PDF) for the same data.
  it.each<[string, Partial<Record<CalibrationCheckbox, boolean>>, number[]]>([
    ["everything", everything, [1, 2, 1, 1, 1, 1]],
    ["no address", { ...everything, address: false }, [1, 1, 1, 1, 1, 1]],
    ["no Website: the next contact takes its cell", { ...everything, website: false }, [1, 2, 1, 1, 2, 1]],
    ["no LinkedIn", { ...everything, linkedin: false }, [1, 1, 1, 1, 1, 1]],
    ["no phone", { ...everything, phone: false }, [2, 1, 1, 1, 1, 1]],
    ["the reported header", {}, [1, 2, 1]],
    ["the reported header without the Website", { website: false }, [1, 2, 1]],
    ["GitHub and Website without LinkedIn share a row", { linkedin: false }, [1, 1, 1]],
  ])("places the contacts like the browser: %s", (_label, visibility, lines) => {
    expect(tabellarischContactRows(getTabellarischHeaderContacts(display({ visibility })))).toEqual(lines);
  });

  it("wraps a long Website over the lines the browser drew", () => {
    const rows = (fields: Record<string, unknown>) => tabellarischContactRows(getTabellarischHeaderContacts(display({ fields })));
    expect(rows({ portfolio: "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung" })).toEqual([1, 2, 4]);
    expect(rows({ email: "mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com" })).toEqual([3, 2, 1]);
  });
});

describe("Tabellarisch header: where the first section starts", () => {
  // The top of the first section (mm) that Chromium measured, and what the model says. Never below, and at most a
  // text line above (a wrap that is a little pessimistic is cheaper than a bullet that runs into the footer).
  it.each<[string, TabellarischFixtureOptions, number]>([
    ["everything", { visibility: everything }, 77.51],
    ["no address", { visibility: { ...everything, address: false } }, 73.95],
    ["no phone", { visibility: { ...everything, phone: false } }, 77.51],
    ["no e-mail", { visibility: { ...everything, email: false } }, 77.51],
    ["no LinkedIn", { visibility: { ...everything, linkedin: false } }, 73.95],
    ["no GitHub", { visibility: { ...everything, github: false } }, 77.51],
    ["no Website", { visibility: { ...everything, website: false } }, 81.06],
    ["no online profiles", { visibility: { ...everything, onlineProfiles: false } }, 77.51],
    ["no birth date", { visibility: { ...everything, birthDate: false } }, 77.51],
    ["no nationality", { visibility: { ...everything, nationality: false } }, 81.06],
    ["no family status", { visibility: { ...everything, familyStatus: false } }, 81.06],
    ["no children", { visibility: { ...everything, children: false } }, 81.06],
    ["no Xing", { visibility: { ...everything, xing: false } }, 77.51],
    ["the reported header, Website off", { visibility: { website: false } }, 63.39],
    ["the reported header, Website on", { visibility: { website: true } }, 63.39],
    ["GitHub off, Website on", { visibility: { github: false } }, 63.39],
    ["no LinkedIn: GitHub and Website share a row", { visibility: { linkedin: false } }, 59.83],
    ["a long Website (4 lines)", { fields: { portfolio: "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung" } }, 74.06],
    ["a long e-mail (3 lines)", { fields: { email: "mina.beispiel.mit.einer.sehr.langen.adresse1408@beispiel-mail-anbieter.example.com" } }, 70.51],
    ["a long LinkedIn that fits its row", { fields: { linkedin: "https://www.linkedin.com/in/mina-beispiel-senior-entwicklerin-prozessplanung-123456789/" } }, 63.39],
    ["a long name", { fields: { firstName: "Mina-Alexandra", lastName: "Beispiel-Schmidt-Wolkenstein" } }, 72.21],
    ["a long title without a photo", { photo: false, fields: { title: "Technisch und prozessorientierter Quereinsteiger mit langjähriger Erfahrung im Produktionsumfeld sowie in der Prozessplanung und Digitalisierung" } }, 63.39],
    ["a long title beside the photo", { photo: true, fields: { title: "Technisch und prozessorientierter Quereinsteiger mit langjähriger Erfahrung im Produktionsumfeld sowie in der Prozessplanung und Digitalisierung" } }, 68.87],
    ["no title", { fields: { title: "" } }, 51.29],
  ])("%s", (label, options, measured) => {
    // The photo narrows only the column of the name and the title; the contacts are 132 mm wide with or without it.
    for (const photo of options.photo === undefined ? [true, false] : [options.photo]) {
      const estimate = top({ ...options, photo });
      expect(estimate, `${label}${photo ? "" : " (no photo)"}`).toBeGreaterThanOrEqual(measured - 0.01);
      expect(estimate, `${label}${photo ? "" : " (no photo)"}`).toBeLessThanOrEqual(measured + 3.6);
    }
  });

  it("adds no height when a Website joins the row GitHub is in, and one text line when it needs a row of its own", () => {
    const base = top({ visibility: { website: false } });
    expect(top({ visibility: { website: true } })).toBe(base);
    expect(top({ visibility: { website: true, github: false, linkedin: false } })).toBeLessThanOrEqual(top({ visibility: { website: false, github: false, linkedin: false } }) + 3.6);
    // a Website that wraps into more lines than the row had really is taller
    expect(top({ fields: { portfolio: "https://www.example.com/sehr-langer-pfad/portfolio/projekte/softwareentwicklung" } })).toBeGreaterThan(base + 8);
  });

  it("keeps the generic rule for the other templates: a header model reaches only Tabellarisch", () => {
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

  // The Lebenslauf of the report: the first two stations fill page one so that the four bullets of the Transportpilot
  // stand right at the bottom. Switching the Website on used to move the last two to page two.
  it("keeps the whole Transportpilot on page one with the Website on, as with it off", () => {
    const off = plan({ visibility: { website: false } });
    const on = plan({ visibility: { website: true } });
    expect(shape(on)).toBe(shape(off));
    const pilot = (pages: ResumePagePlan[]) => pages.flatMap((page) => page.items).filter((item) => item.id.endsWith("12"));
    expect(pilot(on)).toHaveLength(1);
    expect(pilot(on)[0]).not.toHaveProperty("bullets");
    expect(on[0].items.map((item) => item.id.slice(-2))).toEqual(["10", "11", "12"]);
    expect(on[1].items.map((item) => item.kind)).toEqual(["education"]);
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
