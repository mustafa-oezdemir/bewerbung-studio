import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applicationSchema, profileSchema, type Application, type ApplicantProfile } from "../src/shared/schema";
import { deckblattDesignIds } from "../src/shared/deckblattDesigns";
import { getTemplate } from "../src/shared/templates";
import { getTemplateDocumentDesignDefaults } from "../src/shared/cvDesign";
import { buildDocumentHtml } from "./documents";

const now = "2026-09-26T09:00:00.000Z";
const titleA = "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung";
const titleB = "Technisch und prozessorientierter Quereinsteiger mit Erfahrung im Produktionsumfeld";
const jobTitle = "Junior Backend Developer (m/w/d)";

const makeProfile = (extra: Record<string, unknown>) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: false, updatedAt: now, postalCode: "34117", country: "Deutschland", photoPath: "data:image/png;base64,AA==",
    experiences: [{ id: crypto.randomUUID(), from: "2020", to: "2024", role: "Entwickler", company: "Beispiel GmbH", city: "Kassel", achievements: ["Plattform betrieben."] }],
    skills: ["TypeScript", "React", "Node.js"], languages: ["Deutsch – C1"],
    ...extra,
  });

const profileA = makeProfile({ firstName: "Mustafa", lastName: "Özdemir", title: titleA, street: "Gartenweg 7", city: "Kassel", email: "mustafa@a-profil.test", phone: "0561 111111", isDefault: true });
const profileB = makeProfile({ firstName: "Mina", lastName: "Kaya", title: titleB, street: "Ringstraße 2", city: "Berlin", email: "mina@b-profil.test", phone: "030 222222" });

const application = (templateId = "modern", documents: Record<string, unknown> = {}): Application => {
  const template = getTemplate(templateId);
  return applicationSchema.parse({
    schemaVersion: 1, id: "d50ac50f-cafe-4ca3-b06b-a98b0bb1fa11", folderName: "Nordlicht", company: { name: "Nordlicht AG", city: "Hamburg" }, contact: {},
    job: { title: jobTitle }, status: "Entwurf", templateId, accentColor: template.accent, secondaryColor: template.secondary,
    designSettings: getTemplateDocumentDesignDefaults(templateId), documents, statusHistory: [], createdAt: now, updatedAt: now,
  });
};

const body = (html: string) => html.slice(html.indexOf("<body>"));
const targets = ["deckblatt", "anschreiben", "lebenslauf", "mappe"] as const;

/** What only one profile prints: a document must not show anything of the other profile. */
const only = (own: ApplicantProfile, other: ApplicantProfile) => ({
  shows: [own.title, `${own.firstName} ${own.lastName}`, own.email],
  hides: [other.title, `${other.firstName} ${other.lastName}`, other.firstName, other.email, other.phone, other.street],
});

describe("one Bewerbung, one profile, in every document", () => {
  it("A/B. Deckblatt, Anschreiben, Lebenslauf and Mappe print the profile of the application and nothing of another profile", () => {
    for (const [own, other] of [[profileA, profileB], [profileB, profileA]] as const) {
      const { shows, hides } = only(own, other);
      for (const target of targets) {
        const html = body(buildDocumentHtml(application(), own, target));
        // The e-mail address is part of the Deckblatt contacts and of the Lebenslauf header, the title of all four.
        for (const value of [own.title, `${own.firstName} ${own.lastName}`]) expect(html, `${target} shows ${value}`).toContain(value);
        if (target !== "anschreiben") expect(html, `${target} shows ${shows[2]}`).toContain(shows[2]);
        for (const value of hides) expect(html, `${target} hides ${value}`).not.toContain(value);
      }
    }
  });

  it("C. every Deckblatt design takes the same name, title and contacts from the profile", () => {
    for (const designId of deckblattDesignIds) {
      const html = body(buildDocumentHtml(application("modern", { coverSheetDesign: designId }), profileA, "deckblatt"));
      for (const value of [profileA.title, "Mustafa Özdemir", profileA.email, "Gartenweg 7"]) expect(html, `${designId} ${value}`).toContain(value);
      for (const value of [titleB, "Mina", profileB.email]) expect(html, `${designId} ${value}`).not.toContain(value);
    }
  });

  it("every résumé template prints the professional title of the profile, and only that one", () => {
    const templates = ["modern", "elegant", "zweispaltig", "kreativ", "stilvoll", "kompakt", "klassisch", "einspaltig", "tabellarisch", "ivy-league", "zeitgenoessisch", "gepflegt", "pehlione_white", "pehlione_white_blue"];
    const missing: string[] = [];
    for (const templateId of templates) {
      for (const [own, other] of [[profileA, profileB], [profileB, profileA]] as const) {
        const html = body(buildDocumentHtml(application(templateId), own, "lebenslauf"));
        const title = own.title.replace(/&/g, "&amp;");
        // The Modern header appends specialties after the title; the title itself is always there.
        if (!html.includes(title)) missing.push(`${templateId} ${own.firstName}`);
        expect(html, `${templateId} hides the other title`).not.toContain(other.title);
      }
    }
    expect(missing).toEqual([]);
  });

  it("a saved Deckblatt or Anschreiben title of another profile does not override the profile of the application", () => {
    const stale = application("modern", { coverSheetProfessionalTitle: titleA });
    const deckblatt = body(buildDocumentHtml(stale, profileB, "deckblatt"));
    expect(deckblatt).toContain(titleB);
    expect(deckblatt).not.toContain(titleA);
    // The Anschreiben keeps only what the user typed on purpose.
    expect(body(buildDocumentHtml(application("modern"), profileB, "anschreiben"))).toContain(`<span class="sender-title">${titleB}</span>`);
    expect(body(buildDocumentHtml(application("modern", { coverSenderTitle: "Leitung IT" }), profileB, "anschreiben"))).toContain('<span class="sender-title">Leitung IT</span>');
  });

  it("D. the position applied for and the professional title of the profile stay two things", () => {
    for (const designId of deckblattDesignIds) {
      const html = body(buildDocumentHtml(application("modern", { coverSheetDesign: designId }), profileA, "deckblatt"));
      expect(html, designId).toContain(`Bewerbung als ${jobTitle}`);
      expect(html, designId).toContain(titleA);
    }
    // Without a title in the profile the job title does not stand in for it, in any document.
    const untitled = makeProfile({ ...profileA, id: crypto.randomUUID(), title: "" });
    const classic = body(buildDocumentHtml(application(), untitled, "deckblatt"));
    expect(classic).toContain(`Bewerbung als ${jobTitle}`);
    expect(classic).toMatch(/<h2>Mustafa Özdemir<\/h2><\/section>|<h2>Mustafa Özdemir<\/h2><p class="cover-statement"/);
    for (const templateId of ["modern", "elegant", "stilvoll", "kompakt", "klassisch", "pehlione_white", "tabellarisch"]) {
      const resume = body(buildDocumentHtml(application(templateId), untitled, "lebenslauf"));
      expect(resume, templateId).not.toContain(jobTitle);
      expect(resume, templateId).not.toContain("Professional");
      expect(resume, templateId).not.toContain("Fachkraft");
    }
    expect(body(buildDocumentHtml(application(), untitled, "anschreiben"))).not.toContain('class="sender-title"');
  });

  it("the Mappe prints the very pages of the single documents", () => {
    const current = application("modern", { coverSheetDesign: "pastell" });
    const mappe = body(buildDocumentHtml(current, profileB, "mappe"));
    for (const target of ["anschreiben", "deckblatt"] as const) {
      const page = body(buildDocumentHtml(current, profileB, target));
      const section = page.slice(page.indexOf("<section class=\"page"), page.lastIndexOf("</section>") + "</section>".length);
      expect(mappe, target).toContain(section);
    }
    expect(mappe).toContain(titleB);
    expect(mappe).not.toContain(titleA);
  });
});

describe("the views and the store resolve the profile in one place", () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");

  it("takes the profile of the documents from the application, not from what the profile editor selected", () => {
    const view = read("../src/views/DocumentsView.tsx");
    expect(view).toContain("resolveApplicationProfile(profiles, application.profileId)");
    expect(view).not.toContain("resolveSelectedProfile");
    expect(view).toContain("resolveCoverSender(");
    expect(view).toContain("keepCoverSenderOverrides(");
  });

  it("lets the data store resolve the profile with the shared function", () => {
    const storage = read("./storage.ts");
    expect(storage).toContain("resolveApplicationProfile(this.workspace.profiles, application.profileId)");
    expect(storage).not.toContain("profile.id === application.profileId");
  });
});

describe("no document has a professional title of its own", () => {
  const files = (directory: string): string[] =>
    readdirSync(directory).flatMap((entry) => {
      const full = path.join(directory, entry);
      if (statSync(full).isDirectory()) return entry === "node_modules" ? [] : files(full);
      return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$|^__/.test(entry) ? [full] : [];
    });
  const production = [...files(path.resolve(__dirname, "../src")), ...files(path.resolve(__dirname, "."))];

  it("contains no example title as a literal in production code", () => {
    const offenders = production.filter((file) => /Softwareentwickler|Fachinformatiker für Anwendungsentwicklung|Quereinsteiger mit Erfahrung/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(__dirname, file))).toEqual([]);
  });

  it("never lets a document fall back from the profile title to the job title or to a fixed word", () => {
    const pattern = /[pP]rofile\??\.title\s*\|\|\s*(?:role\b|application\.job\.title|"(?:Professional|Fachkraft)")|coverSheetProfessionalTitle\s*\|\|/;
    const offenders = production.filter((file) => pattern.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(__dirname, file))).toEqual([]);
  });
});
