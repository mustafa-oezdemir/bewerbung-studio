import { describe, expect, it } from "vitest";
import {
  appSettingsSchema,
  applicationStatuses,
  applicationDraftSchema,
  applicationInputSchema,
  attachmentSchema,
  defaultSettings,
  profileSchema,
  workspaceSchema,
  todoSchema,
} from "./schema";

describe("BewerbungsManager schemas", () => {
  it("loads older workspaces with empty todo and custom design collections", () => {
    const workspace = workspaceSchema.parse({
      schemaVersion: 1, applications: [], profiles: [], events: [], attachments: [],
      settings: defaultSettings, updatedAt: "2026-09-29T10:00:00.000Z",
    });
    expect(workspace.todos).toEqual([]);
    expect(workspace.customCvDesigns).toEqual([]);
    expect(todoSchema.safeParse({ id: crypto.randomUUID(), title: "Unterlagen prüfen", description: "", priority: "high", dueDate: "2026-09-30", completed: false, createdAt: "2026-09-29T10:00:00.000Z", updatedAt: "2026-09-29T10:00:00.000Z" }).success).toBe(true);
  });
  it("offers self-created and sent application statuses", () => {
    expect(applicationStatuses).toContain("Selbst erstellt");
    expect(applicationStatuses).toContain("Gesendet");
  });

  it("accepts a complete minimal application input", () => {
    const result = applicationInputSchema.safeParse({
      company: {
        name: "Beispiel GmbH",
        street: "",
        postalCode: "10115",
        city: "Berlin",
        country: "Deutschland",
        website: "",
      },
      contact: {
        salutation: "",
        firstName: "",
        lastName: "",
        position: "",
        email: "",
        phone: "",
      },
      job: {
        title: "Softwareentwickler",
        reference: "DEV-2026-17",
        source: "Karriereseite",
        url: "",
        fullText: "",
        workModel: "Hybrid",
        contractType: "Unbefristet",
        salaryExpectation: "",
      },
      templateId: "classic-professional",
      accentColor: "#155e58",
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secondaryColor).toBe("#244766");
      expect(result.data.designSettings.columnLayout).toBe("template");
      expect(result.data.designSettings.resumeOutputMode).toBe("visual");
      expect(result.data.designSettings.marginLevel).toBe(5);
      expect(result.data.designSettings.paddingLevel).toBe(5);
      expect(result.data.designSettings.syncAcrossDocuments).toBe(true);
      expect(result.data.job.reference).toBe("DEV-2026-17");
    }
  });

  it("allows one optional second contact in a new application", () => {
    const baseInput = {
      company: { name: "Beispiel GmbH", city: "Berlin" },
      contact: {},
      job: { title: "Softwareentwickler" },
      templateId: "classic-professional",
      accentColor: "#155e58",
    };
    const secondContact = {
      salutation: "Divers",
      firstName: "Alex",
      lastName: "Muster",
      position: "Recruiting",
      email: "alex@example.com",
      phone: "+49 30 123456",
    };

    const result = applicationInputSchema.safeParse({
      ...baseInput,
      additionalContacts: [secondContact],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.additionalContacts?.[0].lastName).toBe("Muster");
    }
    expect(
      applicationInputSchema.safeParse({
        ...baseInput,
        additionalContacts: [secondContact, secondContact],
      }).success,
    ).toBe(false);
  });

  it("keeps old applications compatible and allows one additional contact", () => {
    const now = "2026-08-29T10:00:00.000Z";
    const baseApplication = {
      schemaVersion: 1,
      id: "10000000-0000-4000-8000-000000000001",
      folderName: "Beispiel_2026-08-29/Entwickler",
      company: { name: "Beispiel GmbH", city: "Berlin" },
      contact: { salutation: "Herr", lastName: "Mustermann" },
      job: { title: "Entwickler" },
      status: "Beworben",
      templateId: "classic-professional",
      accentColor: "#155e58",
      documents: {},
      statusHistory: [{ at: now, to: "Beworben" }],
      createdAt: now,
      updatedAt: now,
    };

    const legacyResult = workspaceSchema.safeParse({
      schemaVersion: 1,
      applications: [baseApplication],
      profiles: [],
      events: [],
      attachments: [],
      settings: defaultSettings,
      updatedAt: now,
    });
    expect(legacyResult.success).toBe(true);
    if (legacyResult.success) {
      expect(legacyResult.data.applications[0].additionalContacts).toEqual([]);
    }

    const secondContactResult = workspaceSchema.safeParse({
      ...(legacyResult.success ? legacyResult.data : {}),
      applications: [
        {
          ...baseApplication,
          additionalContacts: [
            {
              salutation: "Frau",
              firstName: "Erika",
              lastName: "Musterfrau",
              position: "HR Business Partner",
              email: "erika@example.com",
              phone: "+49 30 123456",
            },
          ],
        },
      ],
    });
    expect(secondContactResult.success).toBe(true);
    if (secondContactResult.success) {
      expect(
        secondContactResult.data.applications[0].additionalContacts[0]
          .salutation,
      ).toBe("Frau");
    }
  });

  it("rejects unsafe or incomplete application input", () => {
    const result = applicationInputSchema.safeParse({
      company: { name: "", city: "" },
      job: { title: "", url: "javascript:alert(1)" },
      templateId: "",
      accentColor: "red",
    });
    expect(result.success).toBe(false);
  });

  it("requires a versioned central workspace", () => {
    expect(workspaceSchema.safeParse({ schemaVersion: 99 }).success).toBe(
      false,
    );
  });

  it("adds an empty dynamic knowledge section to older profiles", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      title: "",
      street: "",
      postalCode: "",
      city: "",
      country: "Deutschland",
      phone: "",
      email: "",
      linkedin: "",
      github: "",
      portfolio: "",
      birthDate: "",
      birthPlace: "",
      nationality: "",
      photoPath: "",
      signaturePath: "",
      summary: "",
      skills: ["React"],
      experiences: [],
      education: [],
      languages: [],
      certifications: [],
      updatedAt: new Date().toISOString(),
    });
    expect(profile.knowledgeSection.title).toBe(
      "Kenntnisse & Zusatzangaben",
    );
    expect(profile.knowledgeSection.categories).toEqual([]);
    expect(profile.resumeSectionLayout).toEqual([]);
    expect(profile.resumeSectionLayouts).toEqual({});
    expect(profile.onlineProfiles).toEqual([]);
    expect(profile.familyStatus).toBe("");
    expect(profile.children).toBe("");
    expect(profile.specialSections).toEqual([]);
    expect(profile.strengths).toEqual([]);
    expect(profile.resumeSections.strengths).toBe(true);
    expect(profile.resumeSectionTitles).toMatchObject({
      summary: "Zusammenfassung",
      strengths: "Stärken",
      experience: "Berufserfahrung",
      education: "Ausbildung",
      languages: "Sprachen",
      certifications: "Zertifikate",
    });
    expect(profile.applicationPlace).toBe("");
    expect(profile.applicationDate).toBe("");
    expect(profile.resumeSemanticSections).toEqual([]);
    expect(profile.resumePersonalFieldVisibility.email).toBe(true);
    expect(profile.resumePersonalFieldVisibility.birthDate).toBe(false);
    expect(profile.resumeKnowledgeGroups).toEqual([]);
    expect(profile.resumeKnowledgeContainer).toEqual({ showTitle: false });
    expect(profile.resumeColumnRatio).toBe(30);
    expect(profile.resumeClosing).toEqual({
      showPlace: true,
      showDate: true,
      showSignature: true,
    });
  });

  it("migrates legacy knowledge block strings into editable block items", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      resumeKnowledgeGroups: [{
        id: "legacy-group",
        title: "Tools",
        semanticType: "tools",
        visible: true,
        order: 0,
        items: ["Git", "Docker"],
        rendererType: "tags",
      }],
      updatedAt: new Date().toISOString(),
    });

    expect(profile.resumeKnowledgeGroups[0].rendererType).toBe("tag-list");
    expect(profile.resumeKnowledgeGroups[0].items).toMatchObject([
      { text: "Git", visible: true, order: 0 },
      { text: "Docker", visible: true, order: 1 },
    ]);
  });

  it("keeps independent strengths and editable resume section titles", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      strengths: [
        {
          id: crypto.randomUUID(),
          title: "Analytisches Denken",
          description: "Komplexe Probleme strukturiert lösen",
        },
      ],
      resumeSectionTitles: {
        summary: "Über mich",
        strengths: "Kernkompetenzen",
        experience: "Praxis",
        education: "Bildungsweg",
        languages: "Sprachprofil",
        certifications: "Qualifikationen",
      },
      updatedAt: new Date().toISOString(),
    });

    expect(profile.strengths[0].title).toBe("Analytisches Denken");
    expect(profile.resumeSectionTitles.strengths).toBe("Kernkompetenzen");
    expect(profile.resumeSectionTitles.experience).toBe("Praxis");
  });

  it("adds detailed defaults to older experience and education entries", () => {
    const profile = profileSchema.parse({
      id: crypto.randomUUID(),
      isDefault: true,
      firstName: "Mina",
      lastName: "Kaya",
      experiences: [
        {
          id: crypto.randomUUID(),
          from: "01/2024",
          to: "heute",
          role: "Entwicklerin",
          company: "Beispiel GmbH",
          achievements: [],
        },
      ],
      education: [
        {
          id: crypto.randomUUID(),
          from: "10/2018",
          to: "09/2022",
          degree: "Bachelor",
          institution: "Beispiel Hochschule",
        },
      ],
      updatedAt: new Date().toISOString(),
    });

    expect(profile.experiences[0]).toMatchObject({
      isCurrent: false,
      description: "",
      tasks: [],
      projects: [],
      technologies: [],
    });
    expect(profile.education[0]).toMatchObject({
      country: "",
      type: "",
      fieldOfStudy: "",
      grade: "",
      status: "",
      description: "",
    });
  });

  it("migrates existing attachments into the PDF package by default", () => {
    const attachment = attachmentSchema.parse({
      id: crypto.randomUUID(),
      applicationId: crypto.randomUUID(),
      category: "Zeugnisse",
      fileName: "Arbeitszeugnis.pdf",
      storedName: "20260719_Arbeitszeugnis.pdf",
      description: "",
      documentDate: "",
      order: 0,
      createdAt: new Date().toISOString(),
    });
    expect(attachment.includedInPackage).toBe(true);
  });

  it("fills new data-safety settings when older settings are loaded", () => {
    const settings = appSettingsSchema.parse({
      followUpDays: 14,
      notificationsEnabled: true,
      theme: "system",
      archiveAccepted: false,
      language: "de",
    });
    expect(settings.autoBackupEnabled).toBe(true);
    expect(settings.backupRetention).toBe(10);
    expect(settings.autoSaveDelaySeconds).toBe(2);
  });

  it("rejects unsafe backup retention values", () => {
    expect(
      appSettingsSchema.safeParse({
        followUpDays: 14,
        notificationsEnabled: true,
        theme: "system",
        archiveAccepted: false,
        autoBackupEnabled: true,
        backupRetention: 500,
        autoSaveDelaySeconds: 2,
        language: "de",
      }).success,
    ).toBe(false);
  });

  it("validates partial wizard drafts without requiring completed fields", () => {
    const result = applicationDraftSchema.safeParse({
      company: { name: "Beispiel GmbH" },
      job: { title: "" },
      templateId: "classic-professional",
      accentColor: "#155e58",
    });
    expect(result.success).toBe(true);
  });
});
