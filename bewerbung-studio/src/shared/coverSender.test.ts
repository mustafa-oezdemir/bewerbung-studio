import { describe, expect, it } from "vitest";
import { documentDraftSchema, profileSchema } from "./schema";
import {
  clearProfileDerivedDocumentFields,
  coverSenderFromProfile,
  dropStaleProfileCopies,
  keepCoverSenderOverrides,
  resolveCoverSender,
} from "./coverSender";

const now = "2026-09-26T09:00:00.000Z";
const profile = (extra: Record<string, unknown> = {}) =>
  profileSchema.parse({
    id: crypto.randomUUID(), isDefault: false, firstName: "Mustafa", lastName: "Özdemir",
    title: "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung",
    street: "Gartenweg 7", postalCode: "34117", city: "Kassel", email: "m@example.test", phone: "0561 123", updatedAt: now, ...extra,
  });
const profileA = profile();
const profileB = profile({ firstName: "Mina", lastName: "Kaya", title: "Technisch und prozessorientierter Quereinsteiger mit Erfahrung im Produktionsumfeld", street: "Ringstraße 2", postalCode: "10115", city: "Berlin", email: "mina@example.test", phone: "030 99" });
const drafts = (extra: Record<string, unknown> = {}) => documentDraftSchema.parse(extra);

describe("the sender of the Anschreiben", () => {
  it("comes from the profile of the application, the title being profile.title", () => {
    expect(resolveCoverSender(profileA, drafts())).toEqual({
      name: "Mustafa Özdemir",
      title: "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung",
      contact: "Gartenweg 7 | 34117 Kassel | m@example.test | 0561 123",
    });
    expect(resolveCoverSender(profileB, drafts()).title).toBe(profileB.title);
  });

  it("prints what the user typed on purpose instead", () => {
    expect(resolveCoverSender(profileA, drafts({ coverSenderTitle: "Leitung IT" })).title).toBe("Leitung IT");
  });

  it("never holds a copy of the profile: a typed value that equals the profile's own is no override", () => {
    const own = coverSenderFromProfile(profileA);
    expect(keepCoverSenderOverrides(own, profileA)).toEqual({ coverSenderName: "", coverSenderTitle: "", coverSenderContact: "" });
    expect(keepCoverSenderOverrides({ ...own, title: "Leitung IT" }, profileA)).toEqual({ coverSenderName: "", coverSenderTitle: "Leitung IT", coverSenderContact: "" });
  });

  it("starts from the new profile when the application is linked to another one", () => {
    const old = drafts({ coverSenderName: "Mustafa Özdemir", coverSenderTitle: profileA.title, coverSenderContact: "Gartenweg 7", coverSheetProfessionalTitle: profileA.title, coverSubject: "Bewerbung als X" });
    const cleared = clearProfileDerivedDocumentFields(old);
    expect(cleared).toMatchObject({ coverSenderName: "", coverSenderTitle: "", coverSenderContact: "", coverSheetProfessionalTitle: "", coverSubject: "Bewerbung als X" });
    expect(resolveCoverSender(profileB, cleared).title).toBe(profileB.title);
  });

  it("drops copies of another profile that an earlier profile choice left behind, and keeps everything else", () => {
    const stale = drafts({ coverSenderTitle: profileA.title, coverSheetProfessionalTitle: profileA.title, coverSenderName: "Frau Dr. Kaya", coverSenderContact: profileB.email });
    const next = dropStaleProfileCopies(stale, profileB, [profileA, profileB]);
    expect(next.coverSenderTitle).toBe("");
    expect(next.coverSheetProfessionalTitle).toBe("");
    // A name nobody's profile prints, and a value that equals the profile's own, stay.
    expect(next.coverSenderName).toBe("Frau Dr. Kaya");
    expect(dropStaleProfileCopies(drafts({ coverSenderTitle: profileB.title }), profileB, [profileA, profileB]).coverSenderTitle).toBe(profileB.title);
  });
});
