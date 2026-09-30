import { resumeCustomContentTypes } from "./resumeCustomSectionTypes";
import { deckblattDesignIds, defaultDeckblattDesign } from "./deckblattDesignIds";
import { z } from "zod";
import { cvDesignOverridesSchema } from "./cvDesignSchema";
import { resumeAppearanceSchema } from "./resumeAppearance";
import { resumePresentationSchema } from "./resumePresentationSchema";
import {
  columnLayoutIds,
  defaultDocumentDesign,
  documentBackgroundScopes,
  documentBackgroundIds,
  documentFontIds,
  fontSizeIds,
  resumeOutputModes,
} from "./documentDesign";
import {
  defaultResumePersonalFieldVisibility,
  resumePersonalFieldKeys,
  resumeSemanticTypes,
} from "../features/resume-sections/resume-section-system";
import {
  resumeBlockRendererTypes,
  resumeKnowledgeSlots,
} from "../features/resume-sections/knowledge-block-registry";
import { defaultKnowledgeSection } from "../features/knowledge/knowledge.constants";
import { knowledgeSectionSchema } from "../features/knowledge/knowledge.validation";
import {
  defaultEditableResumeSectionTitles,
  resumeSectionTypes,
  sectionZones,
} from "../features/resume-sections/resume-sections";

export const applicationStatuses = [
  "Entwurf",
  "Selbst erstellt",
  "Bewerbungsbereit",
  "Gesendet",
  "Beworben",
  "Eingangsbestätigung",
  "In Prüfung",
  "Vorstellungsgespräch",
  "Zweites Gespräch",
  "Zusage",
  "Absage",
  "Zurückgezogen",
  "Archiviert",
] as const;

export const rejectionReasons = [
  "Keine Begründung",
  "Andere Kandidatin / anderer Kandidat",
  "Qualifikation nicht passend",
  "Stelle bereits besetzt",
  "Stelle gestrichen",
  "Gehaltsvorstellung",
  "Standort / Entfernung",
  "Sprachkenntnisse",
  "Berufserfahrung",
  "Automatische Absage",
  "Eigene Absage",
  "Sonstiges",
] as const;

export const workModels = ["Vor Ort", "Hybrid", "Remote"] as const;
export const contractTypes = [
  "Unbefristet",
  "Befristet",
  "Praktikum",
  "Ausbildung",
  "Werkstudent",
  "Freelance",
] as const;
export const attachmentCategories = ["Zeugnisse", "Zertifikate"] as const;
export const calendarEventTypes = [
  "application-sent",
  "application-rejected",
  "application-deadline",
  "interview",
  "second-interview",
  "phone-interview",
  "online-interview",
  "trial-work",
  "assessment",
  "follow-up-call",
  "follow-up-email",
  "contract-start",
  "contract-end",
  "fixed-term-end",
  "probation-end",
  "custom",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];
export type RejectionReason = (typeof rejectionReasons)[number];
export type CalendarEventType = (typeof calendarEventTypes)[number];
export type AttachmentCategory = (typeof attachmentCategories)[number];

export const resumeSpecialSectionKinds = [
  "projects",
  "internships",
  "trainings",
  "internationalExperience",
  "scholarships",
  "awards",
  "publications",
  "volunteer",
  "interests",
  "drivingLicenses",
  "additional",
  "references",
  "custom",
] as const;

export type ResumeSpecialSectionKind =
  (typeof resumeSpecialSectionKinds)[number];

const optionalText = z.string().trim().optional().default("");
const optionalIsoDate = z.iso.datetime().optional();

const onlineProfileSchema = z.object({
  id: z.uuid(),
  label: optionalText,
  url: optionalText,
});

const resumeSpecialSectionEntrySchema = z.object({
  id: z.uuid(),
  title: optionalText,
  subtitle: optionalText,
  from: optionalText,
  to: optionalText,
  date: optionalText,
  location: optionalText,
  url: optionalText,
  description: optionalText,
  bullets: z.array(z.string()).default([]),
});

const resumeSpecialSectionSchema = z.object({
  id: z.uuid(),
  kind: z.enum(resumeSpecialSectionKinds),
  contentType: z.enum(resumeCustomContentTypes).optional(),
  title: z.string().trim().min(1),
  isVisible: z.boolean().default(true),
  entries: z.array(resumeSpecialSectionEntrySchema).default([]),
});

const profileStrengthSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1),
  description: optionalText,
  iconId: optionalText,
});

const resumeSectionTitlesSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .default(defaultEditableResumeSectionTitles.summary),
    strengths: z
      .string()
      .trim()
      .min(1)
      .default(defaultEditableResumeSectionTitles.strengths),
    experience: z
      .string()
      .trim()
      .min(1)
      .default(defaultEditableResumeSectionTitles.experience),
    education: z
      .string()
      .trim()
      .min(1)
      .default(defaultEditableResumeSectionTitles.education),
    languages: z
      .string()
      .trim()
      .min(1)
      .default(defaultEditableResumeSectionTitles.languages),
    certifications: z
      .string()
      .trim()
      .min(1)
      .default(defaultEditableResumeSectionTitles.certifications),
  })
  .default(defaultEditableResumeSectionTitles);

export const companySchema = z.object({
  name: z.string().trim().min(1, "Unternehmen ist erforderlich."),
  street: optionalText,
  postalCode: optionalText,
  city: z.string().trim().min(1, "Ort ist erforderlich."),
  country: z.string().trim().default("Deutschland"),
  website: z.union([z.url(), z.literal("")]).default(""),
});

export const contactPersonSchema = z.object({
  salutation: z.enum(["Frau", "Herr", "Divers", ""]).default(""),
  firstName: optionalText,
  lastName: optionalText,
  position: optionalText,
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: optionalText,
});

export const jobAdvertisementSchema = z.object({
  title: z.string().trim().min(1, "Position ist erforderlich."),
  reference: optionalText,
  source: optionalText,
  url: z.union([z.url(), z.literal("")]).default(""),
  fullText: optionalText,
  workModel: z.enum(workModels).default("Hybrid"),
  contractType: z.enum(contractTypes).default("Unbefristet"),
  salaryExpectation: optionalText,
});

export const statusHistorySchema = z.object({
  at: z.iso.datetime(),
  from: z.enum(applicationStatuses).optional(),
  to: z.enum(applicationStatuses),
  note: optionalText,
});

export const documentDraftSchema = z.object({
  coverSenderName: optionalText,
  coverSenderTitle: optionalText,
  coverSenderContact: optionalText,
  coverSheetProfessionalTitle: optionalText,
  coverSheetDesign: z.enum(deckblattDesignIds).default(defaultDeckblattDesign),
  coverSheetContactVisibility: z
    .record(
      z.enum(["address", "phone", "email", "linkedin", "github", "website"]),
      z.boolean(),
    )
    .default({
      address: true,
      phone: true,
      email: true,
      linkedin: true,
      github: true,
      website: true,
    }),
  coverRecipientAddress: optionalText,
  coverSubject: optionalText,
  coverSubjectGapReduction: z.number().int().min(0).max(4).default(0),
  coverGreeting: optionalText,
  coverIntroduction: optionalText,
  coverMainBody: optionalText,
  coverMotivation: optionalText,
  coverQualification: optionalText,
  coverCompanyFit: optionalText,
  coverExtraParagraph: optionalText,
  coverClosing: optionalText,
  resumeProfile: optionalText,
  deckblattStatement: optionalText,
  emailSubject: optionalText,
  emailMessage: optionalText,
  emailAttachmentNote: optionalText,
  emailAttachmentMode: z.enum(["package", "separate"]).default("package"),
  emailPackageFileName: z
    .string()
    .trim()
    .min(1)
    .default("Bewerbungsunterlagen.pdf"),
  showCoverLetterAttachments: z.boolean().default(true),
  documentListSettings: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        label: optionalText,
        isVisible: z.boolean().default(true),
        isDeleted: z.boolean().default(false),
      }),
    )
    .default([]),
});

const designLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
]);

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const sectionColumnSchema = z.union([z.literal("auto"), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

// Sparse records must not run field defaults: Zod's .partial() on a field with
// .default() still materializes that default when loading an empty object.
const documentDesignValuesSchema = z.object({
  cvOverrides: cvDesignOverridesSchema.optional(),
  resumeAppearance: resumeAppearanceSchema.optional(),
  resumePresentation: resumePresentationSchema.optional(),
  metadataLayout: z.enum(["side-by-side", "stacked"]).optional(),
  metadataOrder: z.enum(["details-first", "dates-first"]).optional(),
  strengthsColumns: sectionColumnSchema,
  knowledgeColumns: sectionColumnSchema,
  marginLevel: designLevelSchema,
  paddingLevel: designLevelSchema,
  sectionSpacingLevel: designLevelSchema,
  fontSize: z.enum(fontSizeIds),
  lineHeightLevel: designLevelSchema,
  backgroundShadeLevel: designLevelSchema,
  fontId: z.enum(documentFontIds),
  headingFontId: z.enum(documentFontIds),
  columnLayout: z.enum(columnLayoutIds),
  resumeOutputMode: z.enum(resumeOutputModes),
  backgroundId: z.enum(documentBackgroundIds),
  backgroundScope: z.enum(documentBackgroundScopes),
  textColor: hexColorSchema,
  headingColor: hexColorSchema,
  lineColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  showBackgroundInPrint: z.boolean(),
  syncAcrossDocuments: z.boolean(),
});

export const documentDesignOverridesSchema = documentDesignValuesSchema.partial();

// Keep the historic defaults/required fields for full saved application records.
export const documentDesignSchema = documentDesignValuesSchema.extend({
  strengthsColumns: sectionColumnSchema.default("auto"),
  knowledgeColumns: sectionColumnSchema.default("auto"),
  marginLevel: designLevelSchema.default(defaultDocumentDesign.marginLevel),
  paddingLevel: designLevelSchema.default(defaultDocumentDesign.paddingLevel),
  sectionSpacingLevel: designLevelSchema.default(defaultDocumentDesign.sectionSpacingLevel),
  lineHeightLevel: designLevelSchema.default(defaultDocumentDesign.lineHeightLevel),
  backgroundShadeLevel: designLevelSchema.default(defaultDocumentDesign.backgroundShadeLevel),
  resumeOutputMode: z.enum(resumeOutputModes).default(defaultDocumentDesign.resumeOutputMode),
  backgroundScope: z.enum(documentBackgroundScopes).default(defaultDocumentDesign.backgroundScope),
  textColor: hexColorSchema.default(defaultDocumentDesign.textColor),
  headingColor: hexColorSchema.default(defaultDocumentDesign.headingColor),
  lineColor: hexColorSchema.default(defaultDocumentDesign.lineColor),
  backgroundColor: hexColorSchema.default(defaultDocumentDesign.backgroundColor),
  syncAcrossDocuments: z.boolean().default(true),
});

export const applicationSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  folderName: z.string().min(1),
  company: companySchema,
  contact: contactPersonSchema,
  additionalContacts: z.array(contactPersonSchema).max(1).default([]),
  job: jobAdvertisementSchema,
  status: z.enum(applicationStatuses),
  templateId: z.string().min(1),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#244766"),
  designSettings: documentDesignSchema.default(defaultDocumentDesign),
  // Inactive templates only; the selected template uses the fields above.
  templateDesigns: z
    .record(
      z.string(),
      z.object({
        accentColor: hexColorSchema.optional(),
        secondaryColor: hexColorSchema.optional(),
        settings: documentDesignOverridesSchema,
      }),
    )
    .default({}),
  profileId: z.uuid().optional(),
  notes: optionalText,
  sentAt: optionalIsoDate,
  deadlineAt: optionalIsoDate,
  interviewAt: optionalIsoDate,
  secondInterviewAt: optionalIsoDate,
  startAt: optionalIsoDate,
  contractEndAt: optionalIsoDate,
  fixedTermEndAt: optionalIsoDate,
  probationEndAt: optionalIsoDate,
  rejectionAt: optionalIsoDate,
  rejectionReason: z.enum(rejectionReasons).optional(),
  acceptedAt: optionalIsoDate,
  withdrawnAt: optionalIsoDate,
  archivedAt: optionalIsoDate,
  documents: documentDraftSchema,
  attachmentIds: z.array(z.uuid()).default([]),
  statusHistory: z.array(statusHistorySchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const applicationInputSchema = z.object({
  company: companySchema,
  contact: contactPersonSchema,
  additionalContacts: z.array(contactPersonSchema).max(1).optional(),
  job: jobAdvertisementSchema,
  templateId: z.string().min(1),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#244766"),
  designSettings: documentDesignSchema.default(defaultDocumentDesign),
  profileId: z.uuid().optional(),
  notes: optionalText,
  sentAt: optionalIsoDate,
  deadlineAt: optionalIsoDate,
  interviewAt: optionalIsoDate,
  startAt: optionalIsoDate,
});

export const applicationDraftSchema = z.object({
  company: z
    .object({
      name: z.string().optional(),
      street: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  contact: z
    .object({
      salutation: z.enum(["Frau", "Herr", "Divers", ""]).optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      position: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  additionalContacts: z.array(contactPersonSchema).max(1).optional(),
  job: z
    .object({
      title: z.string().optional(),
      reference: z.string().optional(),
      source: z.string().optional(),
      url: z.string().optional(),
      fullText: z.string().optional(),
      workModel: z.enum(workModels).optional(),
      contractType: z.enum(contractTypes).optional(),
      salaryExpectation: z.string().optional(),
    })
    .optional(),
  templateId: z.string().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  designSettings: documentDesignSchema.partial().optional(),
  profileId: z.uuid().optional(),
  notes: z.string().optional(),
  sentAt: optionalIsoDate,
  deadlineAt: optionalIsoDate,
  interviewAt: optionalIsoDate,
  startAt: optionalIsoDate,
});

export const profileSchema = z.object({
  id: z.uuid(),
  isDefault: z.boolean(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  title: optionalText,
  street: optionalText,
  postalCode: optionalText,
  city: optionalText,
  country: z.string().default("Deutschland"),
  phone: optionalText,
  email: z.union([z.email(), z.literal("")]).default(""),
  linkedin: optionalText,
  github: optionalText,
  portfolio: optionalText,
  onlineProfiles: z.array(onlineProfileSchema).default([]),
  birthDate: optionalText,
  birthPlace: optionalText,
  nationality: optionalText,
  familyStatus: optionalText,
  children: optionalText,
  photoPath: optionalText,
  signaturePath: optionalText,
  summary: optionalText,
  strengths: z.array(profileStrengthSchema).default([]),
  skills: z.array(z.string()).default([]),
  knowledgeSection: knowledgeSectionSchema.default(defaultKnowledgeSection),
  experiences: z
    .array(
      z.object({
        id: z.uuid(),
        from: z.string(),
        to: z.string(),
        role: z.string(),
        company: z.string(),
        city: optionalText,
        isCurrent: z.boolean().default(false),
        legalForm: optionalText,
        employmentType: optionalText,
        description: optionalText,
        teamSize: optionalText,
        tasks: z.array(z.string()).default([]),
        projects: z.array(z.string()).default([]),
        technologies: z.array(z.string()).default([]),
        achievements: z.array(z.string()),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        id: z.uuid(),
        from: z.string(),
        to: z.string(),
        degree: z.string(),
        institution: z.string(),
        city: optionalText,
        country: optionalText,
        type: optionalText,
        fieldOfStudy: optionalText,
        grade: optionalText,
        status: optionalText,
        description: optionalText,
      }),
    )
    .default([]),
  languages: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  specialSections: z.array(resumeSpecialSectionSchema).default([]),
  applicationPlace: optionalText,
  applicationDate: optionalText,
  resumeSectionTitles: resumeSectionTitlesSchema,
  resumeSections: z
    .object({
      profile: z.boolean(),
      strengths: z.boolean().default(true),
      experience: z.boolean(),
      education: z.boolean(),
      skills: z.boolean(),
      languages: z.boolean(),
      certifications: z.boolean(),
    })
    .default({
      profile: true,
      strengths: true,
      experience: true,
      education: true,
      skills: true,
      languages: true,
      certifications: true,
    }),
  resumeSectionLayout: z
    .array(
      z.object({
        type: z.enum(resumeSectionTypes),
        zone: z.enum(sectionZones),
      }),
    )
    .default([]),
  resumeManagerLayouts: z
    .record(
      z.string(),
      z.array(
        z.object({
          id: z.string().min(1),
          zone: z.enum(["main", "sidebar"]),
        }),
      ),
    )
    .default({}),
  resumeManagerOverrides: z
    .record(
      z.string(),
      z.object({
        title: z.string().optional(),
        visible: z.boolean().optional(),
      }),
    )
    .default({}),
  resumeSectionLayouts: z
    .record(
      z.string(),
      z.array(
        z.object({
          type: z.enum(resumeSectionTypes),
          zone: z.enum(sectionZones),
        }),
      ),
    )
    .default({}),
  resumeSemanticSections: z
    .array(
      z.object({
        semanticType: z.enum(resumeSemanticTypes),
        customTitle: optionalText,
        visible: z.boolean().default(true),
        enabled: z.boolean().default(true),
        order: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  resumePersonalFieldVisibility: z
    .record(z.enum(resumePersonalFieldKeys), z.boolean())
    .default(defaultResumePersonalFieldVisibility),
  resumeKnowledgeGroups: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().trim().min(1),
        semanticType: z.string().trim().min(1),
        visible: z.boolean().default(true),
        order: z.number().int().nonnegative(),
        items: z
          .array(
            z.union([
              z.string(),
              z.object({
                id: z.string().min(1),
                text: optionalText,
                description: optionalText,
                icon: optionalText,
                level: optionalText,
                order: z.number().int().nonnegative(),
                visible: z.boolean().default(true),
              }),
            ]),
          )
          .transform((items) =>
            items.map((item, order) =>
              typeof item === "string"
                ? {
                    id: `legacy-${order}-${item.toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, "-")}`,
                    text: item,
                    description: "",
                    icon: "",
                    level: "",
                    order,
                    visible: true,
                  }
                : item,
            ),
          )
          .default([]),
        rendererType: z
          .preprocess(
            (value) =>
              value === "list"
                ? "bullet-list"
                : value === "tags"
                  ? "tag-list"
                  : value,
            z.enum(resumeBlockRendererTypes),
          )
          .default("bullet-list"),
        slot: z.enum(resumeKnowledgeSlots).default("sidebar"),
        slotOverrides: z
          .record(z.string(), z.enum(resumeKnowledgeSlots))
          .default({}),
        pageBreakBefore: z.boolean().default(false),
      }),
    )
    .default([]),
  resumeKnowledgeContainer: z
    .object({ showTitle: z.boolean().default(false) })
    .default({ showTitle: false }),
  resumeColumnRatio: z.number().int().min(20).max(45).default(30),
  resumeClosing: z
    .object({
      showPlace: z.boolean().default(true),
      showDate: z.boolean().default(true),
      showSignature: z.boolean().default(true),
    })
    .default({ showPlace: true, showDate: true, showSignature: true }),
  updatedAt: z.iso.datetime(),
});

export const calendarEventSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid().optional(),
  type: z.enum(calendarEventTypes),
  title: z.string().min(1),
  description: optionalText,
  startAt: z.iso.datetime(),
  endAt: optionalIsoDate,
  allDay: z.boolean(),
  completed: z.boolean(),
  cancelled: z.boolean(),
  reminderMinutes: z.array(z.number().int().nonnegative()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const todoPriorities = ["low", "medium", "high"] as const;
/** `manual` = created by the user; `application-deadline` = kept in sync with `Application.deadlineAt`. */
export const todoSources = ["manual", "application-deadline"] as const;
export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).default(""),
  priority: z.enum(todoPriorities).default("medium"),
  dueDate: z.iso.date().optional(),
  completed: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  // Both are optional so that todos stored before this field existed load unchanged; a missing source means "manual".
  applicationId: z.uuid().optional(),
  source: z.enum(todoSources).optional(),
});

export const customCvDesignSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  baseTemplateId: z.string().min(1),
  accentColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  settings: documentDesignSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const attachmentSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  category: z.enum(attachmentCategories),
  fileName: z.string().min(1),
  storedName: z.string().min(1).optional(),
  archiveRelativePath: z.string().min(1).optional(),
  description: optionalText,
  documentDate: optionalText,
  order: z.number().int().nonnegative(),
  includedInPackage: z.boolean().default(true),
  createdAt: z.iso.datetime(),
});

export const appSettingsSchema = z.object({
  followUpDays: z.number().int().positive().nullable(),
  notificationsEnabled: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
  archiveAccepted: z.boolean(),
  autoBackupEnabled: z.boolean().default(true),
  backupRetention: z.number().int().min(3).max(50).default(10),
  autoSaveDelaySeconds: z.number().int().min(1).max(30).default(2),
  sidebarCollapsed: z.boolean().default(false),
  language: z.literal("de"),
});

export const workspaceSchema = z.object({
  schemaVersion: z.literal(1),
  applications: z.array(applicationSchema),
  profiles: z.array(profileSchema),
  events: z.array(calendarEventSchema),
  attachments: z.array(attachmentSchema),
  todos: z.array(todoSchema).default([]),
  customCvDesigns: z.array(customCvDesignSchema).default([]),
  settings: appSettingsSchema,
  updatedAt: z.iso.datetime(),
});

export const deletedApplicationRecordSchema = z.object({
  deletedAt: z.iso.datetime(),
  application: applicationSchema,
  events: z.array(calendarEventSchema),
  attachments: z.array(attachmentSchema),
});

export const deletedApplicationsArchiveSchema = z.object({
  schemaVersion: z.literal(1),
  deletedApplications: z.array(deletedApplicationRecordSchema),
  updatedAt: z.iso.datetime(),
});

export type Company = z.infer<typeof companySchema>;
export type ContactPerson = z.infer<typeof contactPersonSchema>;
export type JobAdvertisement = z.infer<typeof jobAdvertisementSchema>;
export type DocumentDraft = z.infer<typeof documentDraftSchema>;
export type DocumentListSetting = DocumentDraft["documentListSettings"][number];
export type DocumentDesign = z.infer<typeof documentDesignSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ApplicationInput = z.infer<typeof applicationInputSchema>;
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;
export type ApplicantProfile = z.infer<typeof profileSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type Todo = z.infer<typeof todoSchema>;
export type TodoSource = (typeof todoSources)[number];
export type CustomCvDesign = z.infer<typeof customCvDesignSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type DeletedApplicationRecord = z.infer<
  typeof deletedApplicationRecordSchema
>;
export type DeletedApplicationsArchive = z.infer<
  typeof deletedApplicationsArchiveSchema
>;

export const defaultSettings: AppSettings = {
  followUpDays: 14,
  notificationsEnabled: true,
  theme: "system",
  archiveAccepted: false,
  autoBackupEnabled: true,
  backupRetention: 10,
  autoSaveDelaySeconds: 2,
  sidebarCollapsed: false,
  language: "de",
};
