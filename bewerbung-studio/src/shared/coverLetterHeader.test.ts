import { describe, expect, it } from "vitest";
import { applicationSchema, type Application } from "./schema";
import { coverLetterAuto, defaultCoverIntroduction, resolveCoverLetterDocuments, storeCoverLetterDocuments } from "./coverLetterHeader";

const now = "2026-10-24T09:00:00.000Z";
const hdi = applicationSchema.parse({
  schemaVersion: 1, id: "c1000000-0000-4000-8000-000000000001", folderName: "HDI",
  company: { name: "HDI AG", street: "HDI-Platz 1", postalCode: "30659", city: "Hannover" },
  contact: { salutation: "Herr", firstName: "Aref", lastName: "Olya" },
  job: { title: "Sachbearbeiter IT" }, status: "Entwurf", templateId: "modern", accentColor: "#0f766e", secondaryColor: "#e6f4f1",
  documents: {
    coverIntroduction: defaultCoverIntroduction({ company: { name: "HDI AG" } as Application["company"], job: { title: "Sachbearbeiter IT" } as Application["job"] }),
    coverMainBody: "Mein eigener Hauptteil.", coverCompanyFit: "Mein eigener Unternehmensbezug.", coverClosing: "Mein Schluss.",
  },
  statusHistory: [], createdAt: now, updatedAt: now,
});

/** A copy whose Unternehmen & Position and Ansprechpartner were changed afterwards. */
const changeToKlingelnberg = (source: Application): Application => ({
  ...structuredClone(source),
  company: { ...source.company, name: "Klingelnberg GmbH", street: "Peterstraße 45", postalCode: "42499", city: "Hückeswagen" },
  job: { ...source.job, title: "Anwendungsingenieur" },
  contact: { ...source.contact, salutation: "Frau", firstName: "Yasmin", lastName: "Baumstark" },
});

const klingelnbergHead = {
  coverRecipientAddress: "Klingelnberg GmbH\nFrau Yasmin Baumstark\nPeterstraße 45\n42499 Hückeswagen",
  coverSubject: "Bewerbung als Anwendungsingenieur",
  coverGreeting: "Sehr geehrte Frau Baumstark,",
};

describe("Anschreiben head follows the Bewerbung's data", () => {
  it("replaces the values an older version froze into a copied Bewerbung (Empfänger, Betreff, Anrede, Einleitung)", () => {
    // The old editor saved the automatic values as text; the copy carried them over without a basis.
    const frozen = { ...hdi, documents: { ...hdi.documents, ...{
      coverRecipientAddress: coverLetterAuto(hdi).recipient, coverSubject: "Bewerbung als Sachbearbeiter IT",
      coverGreeting: "Sehr geehrter Herr Olya,",
    } } };
    const copy = changeToKlingelnberg(frozen);
    const letter = resolveCoverLetterDocuments(copy, copy.documents);
    expect(letter).toMatchObject(klingelnbergHead);
    expect(letter.coverIntroduction).toBe("die Position als Anwendungsingenieur bei Klingelnberg GmbH verbindet genau die Aufgaben, in denen ich meine Erfahrung gezielt einbringen möchte.");
    // The user's own paragraphs stay untouched.
    expect(letter).toMatchObject({ coverMainBody: "Mein eigener Hauptteil.", coverCompanyFit: "Mein eigener Unternehmensbezug.", coverClosing: "Mein Schluss." });
  });

  it("follows every later change of Firma, Adresse, Position and Ansprechpartner", () => {
    const saved = { ...hdi, documents: storeCoverLetterDocuments(hdi, resolveCoverLetterDocuments(hdi, hdi.documents)) };
    // Automatic values are not stored: nothing is frozen.
    expect(saved.documents).toMatchObject({ coverRecipientAddress: "", coverSubject: "", coverGreeting: "" });
    expect(saved.documents.coverLetterBasis).toBeUndefined();
    const moved = { ...saved, company: { ...saved.company, street: "Neue Straße 2" } };
    expect(resolveCoverLetterDocuments(moved, moved.documents).coverRecipientAddress).toBe("HDI AG\nHerrn Aref Olya\nNeue Straße 2\n30659 Hannover");
    const otherContact = { ...saved, contact: { ...saved.contact, salutation: "Frau" as const, firstName: "Lea", lastName: "Brandt" } };
    expect(resolveCoverLetterDocuments(otherContact, otherContact.documents)).toMatchObject({
      coverGreeting: "Sehr geehrte Frau Brandt,", coverRecipientAddress: "HDI AG\nFrau Lea Brandt\nHDI-Platz 1\n30659 Hannover",
    });
    const noContact = { ...saved, contact: { ...saved.contact, salutation: "" as const, firstName: "", lastName: "" } };
    expect(resolveCoverLetterDocuments(noContact, noContact.documents).coverGreeting).toBe("Sehr geehrte Damen und Herren,");
    const retitled = { ...saved, job: { ...saved.job, title: "Systemadministrator" } };
    expect(resolveCoverLetterDocuments(retitled, retitled.documents).coverSubject).toBe("Bewerbung als Systemadministrator");
  });

  it("keeps the user's own Empfänger, Betreff and Anrede while they belong to the data", () => {
    const own = {
      coverRecipientAddress: "HDI AG\nPersonalabteilung\nHerrn Aref Olya\nHDI-Platz 1\n30659 Hannover",
      coverSubject: "Initiativbewerbung im Bereich Versicherungs-IT",
      coverGreeting: "Lieber Herr Olya,",
    };
    const saved = { ...hdi, documents: storeCoverLetterDocuments(hdi, { ...resolveCoverLetterDocuments(hdi, hdi.documents), ...own }) };
    expect(saved.documents).toMatchObject(own);
    expect(saved.documents.coverLetterBasis).toEqual(coverLetterAuto(hdi));
    expect(resolveCoverLetterDocuments(saved, saved.documents)).toMatchObject(own);
    // A change elsewhere (Kennziffer) leaves them alone; a Betreff naming the new title stays as well.
    const referenced = { ...saved, job: { ...saved.job, reference: "R-12" } };
    expect(resolveCoverLetterDocuments(referenced, referenced.documents)).toMatchObject(own);
    const subject = { ...saved, documents: storeCoverLetterDocuments(hdi, { ...saved.documents, coverSubject: "Bewerbung als Sachbearbeiter IT (m/w/d) – ab sofort" }) };
    const sameTitle = { ...subject, company: { ...subject.company, name: "HDI Global SE" } };
    expect(resolveCoverLetterDocuments(sameTitle, sameTitle.documents).coverSubject).toBe("Bewerbung als Sachbearbeiter IT (m/w/d) – ab sofort");
  });

  it("drops own head texts of the source company once the copy gets other data", () => {
    const saved = { ...hdi, documents: storeCoverLetterDocuments(hdi, { ...resolveCoverLetterDocuments(hdi, hdi.documents),
      coverRecipientAddress: "HDI AG\nPersonalabteilung\nHDI-Platz 1\n30659 Hannover",
      coverSubject: "Bewerbung als Sachbearbeiter IT – Kennziffer 4711",
      coverGreeting: "Sehr geehrter Herr Dr. Olya," }) };
    const copy = changeToKlingelnberg(saved);
    expect(resolveCoverLetterDocuments(copy, copy.documents)).toMatchObject(klingelnbergHead);
    // Saving the copy stores no stale text: the head follows the data from now on.
    const stored = storeCoverLetterDocuments(copy, resolveCoverLetterDocuments(copy, copy.documents));
    expect(stored).toMatchObject({ coverRecipientAddress: "", coverSubject: "", coverGreeting: "" });
  });

  it("updates only the changed data in an own Empfänger and keeps an older own spelling of the same address", () => {
    const own = "HDI AG\nPersonalabteilung\nHerrn Aref Olya\nHDI-Platz 1\n30659 Hannover";
    const saved = { ...hdi, documents: storeCoverLetterDocuments(hdi, { ...resolveCoverLetterDocuments(hdi, hdi.documents), coverRecipientAddress: own }) };
    // The street moved: the own text still holds the old line, so the address follows the data.
    const moved = { ...saved, company: { ...saved.company, street: "Neue Straße 2" } };
    expect(resolveCoverLetterDocuments(moved, moved.documents).coverRecipientAddress).toBe("HDI AG\nHerrn Aref Olya\nNeue Straße 2\n30659 Hannover");
    // Another Stellenbezeichnung does not touch the Empfänger.
    const retitled = { ...saved, job: { ...saved.job, title: "Systemadministrator" } };
    expect(resolveCoverLetterDocuments(retitled, retitled.documents).coverRecipientAddress).toBe(own);
    // Older own corrections (»Peterstraße« for »Peterstr.«, a shortened Firmenname) of the same company stay.
    const corrected = { ...hdi, company: { ...hdi.company, name: "HDI AG Channel 3", street: "HDI-Pl. 1" },
      documents: { ...hdi.documents, coverRecipientAddress: "HDI AG\nHerrn Aref Olya\nHDI-Platz 1\n30659 Hannover" } };
    expect(resolveCoverLetterDocuments(corrected, corrected.documents).coverRecipientAddress).toBe("HDI AG\nHerrn Aref Olya\nHDI-Platz 1\n30659 Hannover");
  });

  it("drops an own Betreff that names the old Stellenbezeichnung", () => {
    const saved = { ...hdi, documents: storeCoverLetterDocuments(hdi, { ...resolveCoverLetterDocuments(hdi, hdi.documents),
      coverSubject: "Bewerbung als Senior Sachbearbeiter IT – Kennziffer 4711" }) };
    const retitled = { ...saved, job: { ...saved.job, title: "Sachbearbeiter" } };
    expect(resolveCoverLetterDocuments(retitled, retitled.documents).coverSubject).toBe("Bewerbung als Sachbearbeiter");
  });

  it("keeps an own Anrede for the same person, with title or first name", () => {
    const legacy = { ...hdi, documents: { ...hdi.documents, coverGreeting: "Sehr geehrter Herr Dr. Olya," } };
    expect(resolveCoverLetterDocuments(legacy, legacy.documents).coverGreeting).toBe("Sehr geehrter Herr Dr. Olya,");
    const informal = { ...hdi, documents: { ...hdi.documents, coverGreeting: "Hallo Aref," } };
    expect(resolveCoverLetterDocuments(informal, informal.documents).coverGreeting).toBe("Hallo Aref,");
  });
});
