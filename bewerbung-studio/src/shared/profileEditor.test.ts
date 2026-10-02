import { describe, expect, it, vi } from "vitest";
import { applicationSchema, defaultSettings, profileSchema, workspaceSchema } from "./schema";
import { migrateLegacyResumeProfiles } from "./legacyResumeProfile";
import { normalizeApplicantProfileForSave, rebaseApplicantProfileDraft, validateApplicantProfile } from "./profileEditor";
import { resolveApplicationProfile } from "./profileSelection";
import { resolveCvDocument } from "./resolveCvDocument";
import { persistDocumentDraft } from "./documentEditorState";

const now = "2026-10-02T00:00:00.000Z";
const makeProfile = (id: string, change: Record<string, unknown> = {}) => profileSchema.parse({
  id, isDefault: id.endsWith("1"), firstName: "Mina", lastName: "Kaya",
  email: "mina@example.com", summary: "Profiltext", updatedAt: now, ...change,
});
const makeApplication = (id: string, profileId: string, resumeProfile = "") => applicationSchema.parse({
  schemaVersion: 1, id, profileId, folderName: id, company: { name: "Firma", city: "Berlin" },
  contact: {}, job: { title: "Entwicklung" }, status: "Entwurf", templateId: "modern",
  accentColor: "#123456", documents: { resumeProfile }, statusHistory: [], createdAt: now, updatedAt: now,
});

describe("one ApplicantProfile for Profil and Lebenslauf", () => {
  const minaId = "00000000-0000-4000-8000-000000000001";
  const maxId = "00000000-0000-4000-8000-000000000002";
  const aId = "10000000-0000-4000-8000-000000000001";
  const bId = "10000000-0000-4000-8000-000000000002";
  const cId = "10000000-0000-4000-8000-000000000003";

  it("normalizes and validates the same profile fields for both editors", () => {
    const draft = makeProfile(minaId, {
      summary: "  Neuer Text  ", linkedin: "example.com/me", languages: [" Deutsch ", ""],
      certifications: [" Zertifikat ", ""],
    });
    const normalized = normalizeApplicantProfileForSave(draft);
    expect(normalized.summary).toBe("Neuer Text");
    expect(normalized.linkedin).toBe("https://example.com/me");
    expect(normalized.languages).toEqual(["Deutsch"]);
    expect(normalized.certifications).toEqual(["Zertifikat"]);
    expect(validateApplicantProfile(normalized)).toEqual([]);
  });

  it("rebases an old editor draft without reverting phone, photo or closing changes", () => {
    const base = makeProfile(minaId, { phone: "111" });
    const draft = { ...base, summary: "Lebenslauftext" };
    const latest = { ...base, phone: "222", photoPath: "data:image/png;base64,AA", resumeClosing: { ...base.resumeClosing, showDate: false }, updatedAt: "2026-10-02T01:00:00.000Z" };
    const merged = rebaseApplicantProfileDraft(base, draft, latest);
    expect(merged.summary).toBe("Lebenslauftext");
    expect(merged.phone).toBe("222");
    expect(merged.photoPath).toBe(latest.photoPath);
    expect(merged.resumeClosing.showDate).toBe(false);
    expect(merged.updatedAt).toBe(latest.updatedAt);
  });

  it("saves once to the linked profile and all its applications see the edit", async () => {
    const mina = makeProfile(minaId);
    const max = makeProfile(maxId, { firstName: "Max", summary: "Maxtext" });
    const a = makeApplication(aId, minaId);
    const b = makeApplication(bId, minaId);
    const c = makeApplication(cId, maxId);
    const profiles = [mina, max];
    const saved = normalizeApplicantProfileForSave({ ...mina, summary: "Neuer Lebenslauftext", phone: "222" });
    const saveProfile = vi.fn(async (value: typeof mina) => { profiles[0] = value; });
    const saveApplication = vi.fn(async () => {});
    await persistDocumentDraft(a, saved, saveProfile, saveApplication);
    expect(saveProfile).toHaveBeenCalledWith(saved);
    expect(saveApplication).toHaveBeenCalledWith(a);
    expect(resolveCvDocument({ profile: resolveApplicationProfile(profiles, b.profileId), templateId: b.templateId }).summary).toBe("Neuer Lebenslauftext");
    expect(resolveApplicationProfile(profiles, b.profileId)?.phone).toBe("222");
    expect(resolveCvDocument({ profile: resolveApplicationProfile(profiles, c.profileId), templateId: c.templateId }).summary).toBe("Maxtext");
  });

  it("persists career, education, knowledge, interests, media and closing in the shared profile", async () => {
    const mina = makeProfile(minaId);
    const application = makeApplication(aId, minaId);
    const edited = profileSchema.parse({
      ...mina,
      experiences: [{ id: "20000000-0000-4000-8000-000000000001", role: "Entwicklerin", company: "Studio", from: "2022", to: "Heute", achievements: ["Produkt gebaut"] }],
      education: [{ id: "20000000-0000-4000-8000-000000000002", degree: "B.Sc.", institution: "Universität", from: "2019", to: "2022" }],
      knowledgeSection: { ...mina.knowledgeSection, categories: [{ id: "20000000-0000-4000-8000-000000000003", title: "IT", type: "it", items: [{ id: "20000000-0000-4000-8000-000000000004", name: "TypeScript", level: "expert", isVisible: true, sortOrder: 0 }], subcategories: [], displayMode: "tags", showLevels: false, showYearsOfExperience: false, isVisible: true, sortOrder: 0 }] },
      specialSections: [{ id: "20000000-0000-4000-8000-000000000005", kind: "interests", title: "Interessen", isVisible: true, entries: [{ id: "20000000-0000-4000-8000-000000000006", title: "Wandern" }] }],
      photoPath: "data:image/png;base64,AA==", signaturePath: "data:image/png;base64,BB==",
      resumeClosing: { ...mina.resumeClosing, showDate: false },
    });
    let persisted = mina;
    await persistDocumentDraft(application, normalizeApplicantProfileForSave(edited), async (value) => { persisted = value; }, async () => {});
    const cv = resolveCvDocument({ profile: persisted, templateId: application.templateId });
    expect(cv.profile?.experiences[0].company).toBe("Studio");
    expect(cv.profile?.education[0].degree).toBe("B.Sc.");
    expect(persisted.knowledgeSection.categories[0].items[0].name).toBe("TypeScript");
    expect(persisted.specialSections[0].entries[0].title).toBe("Wandern");
    expect(persisted.photoPath).toBe(edited.photoPath);
    expect(persisted.signaturePath).toBe(edited.signaturePath);
    expect(persisted.resumeClosing.showDate).toBe(false);
  });

  it("archives conflicting legacy texts, promotes one deterministically, and migrates only once", () => {
    const workspace = workspaceSchema.parse({
      schemaVersion: 1, profiles: [makeProfile(minaId, { summary: "" }), makeProfile(maxId, { summary: "Maxtext" })],
      applications: [makeApplication(bId, minaId, "Zweiter Text"), makeApplication(aId, minaId, "Erster Text"), makeApplication(cId, maxId, "Max alt")],
      events: [], attachments: [], settings: defaultSettings, updatedAt: now,
    });
    const migrated = migrateLegacyResumeProfiles(workspace);
    expect(migrated.profiles[0].summary).toBe("Erster Text");
    expect(migrated.profiles[1].summary).toBe("Maxtext");
    expect(migrated.applications.map((item) => item.documents.resumeProfile)).toEqual(["", "", ""]);
    expect(migrated.applications.map((item) => item.documents.legacyResumeProfile)).toEqual(["Zweiter Text", "Erster Text", "Max alt"]);
    expect(migrateLegacyResumeProfiles(migrated)).toEqual(migrated);
    expect(workspace.applications[0].documents.resumeProfile).toBe("Zweiter Text");
  });
});
