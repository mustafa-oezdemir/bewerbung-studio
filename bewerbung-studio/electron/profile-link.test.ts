import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { profileSchema, type ApplicationInput } from "../src/shared/schema";
import { defaultDocumentDesign } from "../src/shared/documentDesign";
import { DataStore } from "./storage";

const titleA = "Softwareentwickler | Fachinformatiker für Anwendungsentwicklung";
const titleB = "Technisch und prozessorientierter Quereinsteiger mit Erfahrung im Produktionsumfeld";

const applicationInput = (): ApplicationInput => ({
  company: { name: "Nordlicht AG", street: "", postalCode: "20095", city: "Hamburg", country: "Deutschland", website: "" },
  contact: { salutation: "", firstName: "", lastName: "", position: "", email: "", phone: "" },
  job: { title: "Junior Backend Developer (m/w/d)", reference: "", source: "", url: "", fullText: "", workModel: "Hybrid", contractType: "Unbefristet", salaryExpectation: "" },
  templateId: "modern",
  accentColor: "#06B6C9",
  secondaryColor: "#C7F1F5",
  designSettings: defaultDocumentDesign,
  notes: "",
});

const profile = (extra: Record<string, unknown>) =>
  profileSchema.parse({ id: crypto.randomUUID(), isDefault: false, updatedAt: "2026-09-26T09:00:00.000Z", postalCode: "34117", ...extra });
const profileA = profile({ firstName: "Mara", lastName: "Beispiel", title: titleA, street: "Gartenweg 7", city: "Kassel", email: "mara@a-profil.test", isDefault: true });
const profileB = profile({ firstName: "Lena", lastName: "Fiktiv", title: titleB, street: "Ringstraße 2", city: "Berlin", email: "lena@b-profil.test" });

const targets = ["deckblatt", "anschreiben", "lebenslauf", "mappe"] as const;

describe("the profile of a Bewerbung in the data store", () => {
  let root: string;
  let store: DataStore;

  const createLinked = async (link?: string) => {
    await store.saveProfile(profileA);
    await store.saveProfile(profileB);
    await store.createApplication({ ...applicationInput(), ...(link ? { profileId: link } : {}) });
    return store.getWorkspace().applications[0];
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "bewerbungsmanager-profile-"));
    store = new DataStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("links a new Bewerbung to the profile it is written with, also when the default was meant", async () => {
    const application = await createLinked();
    expect(application.profileId).toBe(profileA.id);
    // A later change of the default profile does not move the Bewerbung.
    await store.saveProfile({ ...profileB, isDefault: true });
    const workspace = store.getWorkspace();
    expect(workspace.profiles.find((item) => item.id === profileB.id)?.isDefault).toBe(true);
    expect(store.getProfileForApplication(workspace.applications[0])?.id).toBe(profileA.id);
  });

  it("uses one resolver for every export, also for a dangling link", async () => {
    const application = await createLinked(profileB.id);
    expect(store.getProfileForApplication(application)?.id).toBe(profileB.id);
    expect(store.getProfileForApplication({ profileId: crypto.randomUUID() })?.id).toBe(profileA.id);
    expect(store.getProfileForApplication({ profileId: undefined })?.id).toBe(profileA.id);
  });

  it("copies the selected profile across a restart for every export", async () => {
    const application = await createLinked();
    await store.saveApplication({ ...application, profileId: profileB.id });

    const restarted = new DataStore(root);
    await restarted.initialize();
    const reloaded = restarted.getWorkspace().applications[0];
    expect(reloaded.profileId).toBe(profileB.id);
    expect(reloaded.profileSnapshot).toEqual(profileB);
    for (const target of targets) {
      const html = restarted.getExportHtml(reloaded.id, target);
      expect(html, target).toContain("Lena Fiktiv");
      expect(html, target).toContain(titleB);
      expect(html, target).not.toContain("Mara Beispiel");
      expect(html, target).not.toContain(titleA);
    }
  });

  it("an export snapshot uses its own profile copy", async () => {
    const application = await createLinked();
    const snapshot = { ...application, profileSnapshot: structuredClone(profileB) };
    for (const target of targets) {
      expect(store.getExportHtml(application.id, target, snapshot), target).toContain(titleB);
      expect(store.getExportHtml(application.id, target), target).toContain(titleA);
    }
  });

  it("changing the source link replaces only the application profile, keeping document text", async () => {
    const application = await createLinked();
    await store.saveApplication({
      ...application,
      documents: { ...application.documents, coverSenderName: "Mara Beispiel", coverSenderTitle: titleA, coverSenderContact: "Gartenweg 7", coverSheetProfessionalTitle: titleA, coverSubject: "Bewerbung als Entwickler" },
    });
    const linkedToA = store.getWorkspace().applications[0];
    expect(linkedToA.documents.coverSenderTitle).toBe(titleA);

    await store.saveApplication({ ...linkedToA, profileId: profileB.id });
    const moved = store.getWorkspace().applications[0];
    expect(moved.profileSnapshot).toEqual(profileB);
    expect(moved.documents).toMatchObject({ coverSenderName: "Mara Beispiel", coverSenderTitle: titleA, coverSenderContact: "Gartenweg 7", coverSheetProfessionalTitle: titleA });
    // Other wording of the Bewerbung stays.
    expect(moved.documents.coverSubject).toBe("Bewerbung als Entwickler");
    for (const target of ["deckblatt", "lebenslauf"] as const) {
      const html = store.getExportHtml(moved.id, target);
      expect(html, target).toContain(titleB);
      expect(html, target).not.toContain(titleA);
    }
  });

  it("refreshes one application from its edited main profile without changing another copy", async () => {
    const first = await createLinked(profileA.id);
    await store.createApplication({ ...applicationInput(), company: { ...applicationInput().company, name: "Westwind GmbH" }, profileId: profileB.id });
    const second = store.getWorkspace().applications.find((item) => item.id !== first.id)!;
    const updatedMain = profile({ ...profileB, id: profileB.id, title: "Neue fiktive Rolle", skills: ["C#"],
      experiences: [{ id: crypto.randomUUID(), from: "2024", to: "", role: "Entwicklung", company: "Beispiel GmbH", achievements: [] }] });
    await store.saveProfile(updatedMain);
    await store.saveApplication({ ...first, profileId: profileB.id, profileSnapshot: first.profileSnapshot });
    const switched = store.getApplication(first.id);
    expect(switched.profileSnapshot).toEqual(updatedMain);
    expect(store.getApplication(second.id).profileSnapshot).toEqual(profileB);

    // The same link does not silently refresh during an ordinary document save.
    await store.saveApplication({ ...switched, documents: { ...switched.documents, coverSubject: "Eigener Text" } });
    expect(store.getApplication(first.id).profileSnapshot).toEqual(updatedMain);
    const refreshedMain = { ...updatedMain, summary: "Später ergänzt", updatedAt: "2026-09-27T09:00:00.000Z" };
    await store.saveProfile(refreshedMain);
    expect(store.getApplication(first.id).profileSnapshot?.summary).not.toBe("Später ergänzt");
    await store.saveApplication({ ...store.getApplication(first.id), profileSnapshot: structuredClone(refreshedMain) });
    expect(store.getApplication(first.id).profileSnapshot).toEqual(refreshedMain);
    expect(store.getApplication(second.id).profileSnapshot).toEqual(profileB);
    expect(store.getWorkspace().profiles.find((item) => item.id === profileB.id)).toEqual(refreshedMain);
  });

  it("rejects a deleted target profile before changing the saved application", async () => {
    const application = await createLinked(profileA.id);
    const absentId = crypto.randomUUID();
    await expect(store.saveApplication({ ...application, profileId: absentId })).rejects.toThrow("nicht mehr vorhanden");
    expect(store.getApplication(application.id)).toEqual(application);
  });

  it("saving again with the same profile keeps what the user typed, a legacy link to the default profile included", async () => {
    const application = await createLinked();
    await store.saveApplication({ ...application, profileId: undefined, documents: { ...application.documents, coverSenderTitle: "Leitung IT" } });
    const legacy = store.getWorkspace().applications[0];
    await store.saveApplication({ ...legacy, profileId: profileA.id });
    const saved = store.getWorkspace().applications[0];
    expect(saved.profileId).toBe(profileA.id);
    expect(saved.documents.coverSenderTitle).toBe("Leitung IT");
    expect(store.getExportHtml(saved.id, "anschreiben")).toContain('<span class="sender-title">Leitung IT</span>');
  });

  it("preserves authored document fields after a restart", async () => {
    const application = await createLinked(profileB.id);
    await store.saveApplication({ ...application, documents: { ...application.documents, coverSenderTitle: titleA, coverSheetProfessionalTitle: titleA, coverSenderName: "Dr. Fiktiv" } });
    expect(store.getWorkspace().applications[0].documents.coverSenderTitle).toBe(titleA);

    const restarted = new DataStore(root);
    await restarted.initialize();
    const cleaned = restarted.getWorkspace().applications[0];
    expect(cleaned.documents.coverSenderTitle).toBe(titleA);
    expect(cleaned.documents.coverSheetProfessionalTitle).toBe(titleA);
    expect(cleaned.documents.coverSenderName).toBe("Dr. Fiktiv");
    expect(restarted.getExportHtml(cleaned.id, "deckblatt")).toContain(titleB);
    expect(restarted.getExportHtml(cleaned.id, "deckblatt")).not.toContain(titleA);
  });

  it("keeps the application profile when its main profile is deleted", async () => {
    const application = await createLinked(profileB.id);
    await store.saveApplication({ ...application, documents: { ...application.documents, coverSenderTitle: "Leitung IT" } });
    await store.removeProfile(profileB.id);
    const moved = store.getWorkspace().applications[0];
    expect(moved.profileId).toBe(profileB.id);
    expect(moved.profileSnapshot).toEqual(application.profileSnapshot);
    expect(moved.documents.coverSenderTitle).toBe("Leitung IT");
    expect(store.getExportHtml(moved.id, "deckblatt")).toContain(titleB);
  });
});
