import { resumeCustomContentLabels, type ResumeCustomContentType } from "../shared/resumeCustomSectionTypes";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  CalendarDays,
  GraduationCap,
  GripVertical,
  ImagePlus,
  Layers3,
  PenLine,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { addTechnologyStrengths } from "../shared/strengthPresets";
import { moveListItem } from "../shared/listOrder";
import { OrderControls } from "../components/profile/OrderControls";
import { ResumeSectionTitleEditor } from "../components/resume/ResumeSectionTitleEditor";
import { KnowledgeSectionEditor } from "../components/knowledge/KnowledgeSectionEditor";
import { LanguageLevelEditor } from "../components/languages/LanguageLevelEditor";
import {
  CertificateListEditor,
  EntryListEditor,
} from "../components/profile/EntryListEditor";
import { TechnologyIconPicker } from "../components/profile/TechnologyIconPicker";
import { defaultKnowledgeSection } from "../features/knowledge/knowledge.constants";
import {
  defaultEditableResumeSectionTitles,
  getResumeSectionTitle,
  setResumeSectionTitle,
  type EditableResumeSectionTitle,
} from "../features/resume-sections/resume-sections";
import {
  defaultResumePersonalFieldVisibility,
  defaultResumeSectionInstances,
} from "../features/resume-sections/resume-section-system";
import {
  cloneKnowledgeCategory,
  ensureKnowledgeSection,
  syncLegacySkills,
} from "../features/knowledge/knowledge.service";
import { validateKnowledgeSection } from "../features/knowledge/knowledge.validation";
import type { ProfileMediaKind } from "../shared/ipc";
import { getProfileMediaSource } from "../shared/profileMedia";
import {
  type ApplicantProfile,
  type ResumeSpecialSectionKind,
} from "../shared/schema";
import { resolveSelectedProfile } from "../shared/profileSelection";
import { useAppStore } from "../store/useAppStore";

const defaultSections: ApplicantProfile["resumeSections"] = {
  profile: true,
  strengths: true,
  experience: true,
  education: true,
  skills: true,
  languages: true,
  certifications: true,
};

const newProfile = (): ApplicantProfile => ({
  id: crypto.randomUUID(),
  isDefault: true,
  firstName: "",
  lastName: "",
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
  onlineProfiles: [],
  birthDate: "",
  birthPlace: "",
  nationality: "",
  familyStatus: "",
  children: "",
  photoPath: "",
  signaturePath: "",
  summary: "",
  strengths: [],
  skills: [],
  knowledgeSection: structuredClone(defaultKnowledgeSection),
  experiences: [],
  education: [],
  languages: [],
  certifications: [],
  specialSections: [],
  applicationPlace: "",
  applicationDate: "",
  resumeSectionTitles: { ...defaultEditableResumeSectionTitles },
  resumeSections: defaultSections,
  resumeSectionLayout: [],
  resumeSectionLayouts: {},
  resumeManagerLayouts: {},
  resumeManagerOverrides: {},
  resumeSemanticSections: defaultResumeSectionInstances(),
  resumePersonalFieldVisibility: { ...defaultResumePersonalFieldVisibility },
  resumeKnowledgeGroups: [],
  resumeKnowledgeContainer: { showTitle: false },
  resumeColumnRatio: 30,
  resumeClosing: { showPlace: true, showDate: true, showSignature: true },
  updatedAt: new Date().toISOString(),
});

type DragItem = {
  type: "experience" | "education";
  id: string;
};

type ProfileKey = keyof ApplicantProfile;

const specialSectionOptions: Array<{
  kind: ResumeSpecialSectionKind;
  label: string;
}> = [
  { kind: "projects", label: "Projekte" },
  { kind: "internships", label: "Praktika" },
  { kind: "trainings", label: "Weiterbildungen" },
  { kind: "internationalExperience", label: "Auslandserfahrung" },
  { kind: "scholarships", label: "Stipendien" },
  { kind: "awards", label: "Auszeichnungen" },
  { kind: "publications", label: "Veröffentlichungen" },
  { kind: "volunteer", label: "Ehrenamt" },
  { kind: "interests", label: "Interessen & Hobbys" },
  { kind: "drivingLicenses", label: "Führerschein" },
  { kind: "additional", label: "Zusatzangaben" },
  { kind: "references", label: "Referenzen" },
  { kind: "custom", label: "Eigener Abschnitt" },
];

const normalizeProfileUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^[a-z][a-z\d+.-]*:(?:\/\/)?/i, "")}`;
};

const moveItem = <T extends { id: string }>(
  items: T[],
  id: string,
  direction: number,
) => {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  return moveListItem(items, index, target);
};

const reorderItem = <T extends { id: string }>(
  items: T[],
  sourceId: string,
  targetId: string,
) => {
  const source = items.findIndex((item) => item.id === sourceId);
  const target = items.findIndex((item) => item.id === targetId);
  if (source < 0 || target < 0 || source === target) return items;
  const next = [...items];
  const [moved] = next.splice(source, 1);
  next.splice(target, 0, moved);
  return next;
};

export function ProfileView({ onSaved }: { onSaved: () => void }) {
  const profiles = useAppStore((state) => state.workspace.profiles);
  const applications = useAppStore((state) => state.workspace.applications);
  const saveProfile = useAppStore((state) => state.saveProfile);
  const removeProfile = useAppStore((state) => state.removeProfile);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const applicationProfileId = useAppStore(
    (state) =>
      state.workspace.applications.find(
        (application) => application.id === state.selectedApplicationId,
      )?.profileId,
  );
  const selectActiveProfile = useAppStore((state) => state.selectProfile);
  const initial =
    resolveSelectedProfile(profiles, selectedProfileId, applicationProfileId) ??
    newProfile();
  const [draft, setDraft] = useState<ApplicantProfile>(() => ({
    ...structuredClone(initial),
    knowledgeSection: ensureKnowledgeSection(
      initial.knowledgeSection,
      initial.skills,
    ),
  }));
  const [dragged, setDragged] = useState<DragItem>();
  const [savingSection, setSavingSection] = useState<string>();
  const [savedSection, setSavedSection] = useState<string>();
  const photoSource = getProfileMediaSource(draft.photoPath);
  const signatureSource = getProfileMediaSource(draft.signaturePath);

  const selectProfile = (profile: ApplicantProfile) => {
    selectActiveProfile(profile.id);
    setDraft({
      ...structuredClone(profile),
      knowledgeSection: ensureKnowledgeSection(
        profile.knowledgeSection,
        profile.skills,
      ),
    });
  };

  const createProfile = () => {
    const profile = newProfile();
    selectActiveProfile(profile.id);
    setDraft(profile);
  };

  const deleteProfile = async (profile: ApplicantProfile) => {
    const linkedApplications = applications.filter(
      (application) =>
        application.profileId === profile.id ||
        (!application.profileId && profile.isDefault),
    ).length;
    const name = `${profile.firstName} ${profile.lastName}`.trim();
    const consequence =
      profiles.length > 1
        ? linkedApplications
          ? ` ${linkedApplications} verbundene Bewerbung(en) werden auf das nächste verfügbare Profil umgestellt.`
          : ""
        : " Danach ist kein Profil mehr vorhanden.";
    if (!window.confirm(`Profil „${name}“ wirklich löschen?${consequence}`)) {
      return;
    }

    await removeProfile(profile.id);
    if (draft.id !== profile.id) return;
    const remainingProfiles = useAppStore.getState().workspace.profiles;
    const next = resolveSelectedProfile(remainingProfiles);
    if (next) selectProfile(next);
    else createProfile();
  };

  const normalizedProfile = (profile: ApplicantProfile): ApplicantProfile => ({
    ...profile,
    linkedin: normalizeProfileUrl(profile.linkedin),
    github: normalizeProfileUrl(profile.github),
    portfolio: normalizeProfileUrl(profile.portfolio),
    onlineProfiles: profile.onlineProfiles.map((entry) => ({
      ...entry,
      url: normalizeProfileUrl(entry.url),
    })),
    specialSections: profile.specialSections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => ({
        ...entry,
        url: normalizeProfileUrl(entry.url),
        bullets: entry.bullets.map((item) => item.trim()).filter(Boolean),
      })),
    })),
    strengths: profile.strengths.map((strength) => ({
      ...strength,
      title: strength.title.trim(),
      description: strength.description.trim(),
    })),
    resumeSectionTitles: Object.fromEntries(
      Object.entries(profile.resumeSectionTitles).map(([key, title]) => [
        key,
        title.trim(),
      ]),
    ) as ApplicantProfile["resumeSectionTitles"],
    skills: syncLegacySkills(profile.knowledgeSection),
    updatedAt: new Date().toISOString(),
  });

  const validateBeforeSave = (profile: ApplicantProfile) => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      window.alert("Bitte zuerst Vorname und Nachname eintragen.");
      return false;
    }
    if (profile.specialSections.some((section) => !section.title.trim())) {
      window.alert("Bitte jedem besonderen Bereich eine Überschrift geben.");
      return false;
    }
    if (profile.strengths.some((strength) => !strength.title.trim())) {
      window.alert("Bitte jeder Stärke eine Bezeichnung geben.");
      return false;
    }
    if (
      Object.values(profile.resumeSectionTitles).some((title) => !title.trim())
    ) {
      window.alert("Bitte jedem Lebenslauf-Abschnitt eine Überschrift geben.");
      return false;
    }
    const issues = validateKnowledgeSection(profile.knowledgeSection);
    if (issues.length) {
      window.alert(issues[0].message);
      return false;
    }
    return true;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateBeforeSave(draft)) return;
    const next = normalizedProfile(draft);
    await saveProfile(next);
    setDraft(next);
    onSaved();
  };

  const saveSection = async (
    sectionId: string,
    keys: ProfileKey[],
    sectionTitle?: EditableResumeSectionTitle,
  ) => {
    const persisted = profiles.find((profile) => profile.id === draft.id);
    const base = persisted
      ? structuredClone(persisted)
      : structuredClone(draft);
    let next = { ...base } as ApplicantProfile;
    for (const key of keys) {
      if (key === "resumeSectionTitles" && sectionTitle) {
        next.resumeSectionTitles = {
          ...base.resumeSectionTitles,
          [sectionTitle]: getResumeSectionTitle(draft, sectionTitle),
        };
      } else {
        (next as Record<ProfileKey, ApplicantProfile[ProfileKey]>)[key] =
          draft[key];
      }
    }
    if (sectionTitle)
      next = setResumeSectionTitle(
        next,
        sectionTitle,
        getResumeSectionTitle(draft, sectionTitle),
      );
    if (keys.includes("knowledgeSection"))
      next = setResumeSectionTitle(
        next,
        "knowledge",
        getResumeSectionTitle(draft, "knowledge"),
      );
    if (!validateBeforeSave(next)) return;
    setSavingSection(sectionId);
    try {
      const normalized = normalizedProfile(next);
      await saveProfile(normalized);
      setDraft((current) => {
        const updated = {
          ...current,
          ...Object.fromEntries(
            keys
              .filter((key) => key !== "resumeSectionTitles")
              .map((key) => [key, normalized[key]]),
          ),
          ...(keys.includes("resumeSectionTitles")
            ? {
                resumeSectionTitles: sectionTitle
                  ? {
                      ...current.resumeSectionTitles,
                      [sectionTitle]:
                        normalized.resumeSectionTitles[sectionTitle],
                    }
                  : normalized.resumeSectionTitles,
              }
            : {}),
          updatedAt: normalized.updatedAt,
        };
        if (sectionTitle)
          return setResumeSectionTitle(
            updated,
            sectionTitle,
            normalized.resumeSectionTitles[sectionTitle],
          );
        return keys.includes("knowledgeSection")
          ? setResumeSectionTitle(
              updated,
              "knowledge",
              normalized.knowledgeSection.title,
            )
          : updated;
      });
      setSavedSection(sectionId);
      window.setTimeout(
        () =>
          setSavedSection((current) =>
            current === sectionId ? undefined : current,
          ),
        1800,
      );
    } finally {
      setSavingSection(undefined);
    }
  };

  const copyKnowledgeCategory = async (categoryId: string) => {
    const source = draft.knowledgeSection.categories.find(
      (category) => category.id === categoryId,
    );
    if (!source) return;
    const targets = profiles.filter((profile) => profile.id !== draft.id);
    if (!targets.length) {
      window.alert("Es ist kein weiteres Profil vorhanden.");
      return;
    }
    const selection = window.prompt(
      `Kategorie in welches Profil kopieren?\n${targets
        .map((profile, index) =>
          `${index + 1}. ${profile.firstName} ${profile.lastName}`.trim(),
        )
        .join("\n")}`,
      "1",
    );
    if (!selection) return;
    const target = targets[Number(selection) - 1];
    if (!target) {
      window.alert("Bitte eine gültige Profilnummer eingeben.");
      return;
    }
    const targetSection = ensureKnowledgeSection(
      target.knowledgeSection,
      target.skills,
    );
    const knowledgeSection = {
      ...targetSection,
      categories: [
        ...targetSection.categories,
        cloneKnowledgeCategory(source, targetSection.categories.length),
      ],
    };
    await saveProfile({
      ...target,
      knowledgeSection,
      skills: syncLegacySkills(knowledgeSection),
      updatedAt: new Date().toISOString(),
    });
    window.alert("Kategorie wurde in das ausgewählte Profil kopiert.");
  };

  const pickMedia = async (kind: ProfileMediaKind) => {
    if (!window.bewerbungsManager) return;
    const selected =
      await window.bewerbungsManager.media.pickProfileImage(kind);
    if (!selected) return;
    setDraft((current) => ({
      ...current,
      [kind === "photo" ? "photoPath" : "signaturePath"]: selected.dataUrl,
    }));
  };

  const removeMedia = (kind: ProfileMediaKind) =>
    setDraft((current) => ({
      ...current,
      [kind === "photo" ? "photoPath" : "signaturePath"]: "",
    }));

  const addExperience = () =>
    setDraft((current) => ({
      ...current,
      experiences: [
        ...current.experiences,
        {
          id: crypto.randomUUID(),
          from: "",
          to: "heute",
          role: "",
          company: "",
          city: "",
          isCurrent: true,
          legalForm: "",
          employmentType: "",
          description: "",
          teamSize: "",
          tasks: [],
          projects: [],
          technologies: [],
          achievements: [""],
        },
      ],
    }));

  const addEducation = () =>
    setDraft((current) => ({
      ...current,
      education: [
        ...current.education,
        {
          id: crypto.randomUUID(),
          from: "",
          to: "",
          degree: "",
          institution: "",
          city: "",
          country: "",
          type: "",
          fieldOfStudy: "",
          grade: "",
          status: "",
          description: "",
        },
      ],
    }));

  const drop = (type: DragItem["type"], targetId: string) => {
    if (!dragged || dragged.type !== type) return;
    if (type === "experience") {
      setDraft((current) => ({
        ...current,
        experiences: reorderItem(current.experiences, dragged.id, targetId),
      }));
    } else {
      setDraft((current) => ({
        ...current,
        education: reorderItem(current.education, dragged.id, targetId),
      }));
    }
    setDragged(undefined);
  };

  return (
    <div className="profile-layout">
      <aside className="surface profile-list">
        <header>
          <p className="eyebrow">Absender</p>
          <h3>Profile</h3>
        </header>
        {profiles.map((profile) => (
          <div
            className={`profile-list-item ${profile.id === draft.id ? "active" : ""}`}
            key={profile.id}>
            <button
              className="profile-list-select"
              type="button"
              onClick={() => selectProfile(profile)}>
              <span>
                <UserRound size={18} />
              </span>
              <div>
                <strong>
                  {profile.firstName} {profile.lastName}
                </strong>
                <small>
                  {profile.title || "Kein Titel"}
                  {profile.isDefault ? " · Standard" : ""}
                </small>
              </div>
            </button>
            <button
              className="icon-button danger profile-delete-button"
              type="button"
              aria-label={`Profil ${profile.firstName} ${profile.lastName} löschen`}
              title="Profil löschen"
              onClick={() => void deleteProfile(profile)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button className="button secondary" onClick={createProfile}>
          <Plus size={17} /> Neues Profil
        </button>
      </aside>

      <main className="surface profile-editor">
        <header className="section-header">
          <div>
            <p className="eyebrow">Lebenslauf-Stammdaten</p>
            <h2>
              {draft.firstName
                ? `${draft.firstName} ${draft.lastName}`
                : "Neues Profil"}
            </h2>
          </div>
          <span className="large-icon">
            <BriefcaseBusiness />
          </span>
        </header>

        <form onSubmit={(event) => void save(event)}>
          <EditorSection
            title="Persönliche Daten"
            description="Nur relevante Kontakt- und Bewerbungsdaten."
            onSave={() =>
              void saveSection("personal", [
                "firstName",
                "lastName",
                "title",
                "street",
                "postalCode",
                "city",
                "country",
                "phone",
                "email",
                "linkedin",
                "github",
                "portfolio",
                "onlineProfiles",
              ])
            }
            saving={savingSection === "personal"}
            saved={savedSection === "personal"}>
            <div className="form-grid">
              <TextField
                label="Vorname *"
                value={draft.firstName}
                required
                onChange={(firstName) =>
                  setDraft((current) => ({ ...current, firstName }))
                }
              />
              <TextField
                label="Nachname *"
                value={draft.lastName}
                required
                onChange={(lastName) =>
                  setDraft((current) => ({ ...current, lastName }))
                }
              />
              <TextField
                label="Berufsbezeichnung"
                value={draft.title}
                full
                onChange={(title) =>
                  setDraft((current) => ({ ...current, title }))
                }
              />
              <TextField
                label="Straße"
                value={draft.street}
                onChange={(street) =>
                  setDraft((current) => ({ ...current, street }))
                }
              />
              <div className="split-fields">
                <TextField
                  label="PLZ"
                  value={draft.postalCode}
                  onChange={(postalCode) =>
                    setDraft((current) => ({ ...current, postalCode }))
                  }
                />
                <TextField
                  label="Ort"
                  value={draft.city}
                  onChange={(city) =>
                    setDraft((current) => ({ ...current, city }))
                  }
                />
              </div>
              <TextField
                label="Land"
                value={draft.country}
                onChange={(country) =>
                  setDraft((current) => ({ ...current, country }))
                }
              />
              <TextField
                label="Telefon"
                value={draft.phone}
                onChange={(phone) =>
                  setDraft((current) => ({ ...current, phone }))
                }
              />
              <TextField
                label="E-Mail"
                value={draft.email}
                type="email"
                onChange={(email) =>
                  setDraft((current) => ({ ...current, email }))
                }
              />
              <TextField
                label="LinkedIn"
                value={draft.linkedin}
                onChange={(linkedin) =>
                  setDraft((current) => ({ ...current, linkedin }))
                }
              />
              <TextField
                label="GitHub"
                value={draft.github}
                onChange={(github) =>
                  setDraft((current) => ({ ...current, github }))
                }
              />
              <TextField
                label="Portfolio"
                value={draft.portfolio}
                full
                onChange={(portfolio) =>
                  setDraft((current) => ({ ...current, portfolio }))
                }
              />
            </div>
            <div className="profile-subsection-header">
              <div>
                <strong>Weitere Online-Profile</strong>
                <small>
                  Zum Beispiel XING, persönliche Website oder Fachprofil.
                </small>
              </div>
              <button
                type="button"
                className="button secondary small-button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    onlineProfiles: [
                      ...current.onlineProfiles,
                      { id: crypto.randomUUID(), label: "", url: "" },
                    ],
                  }))
                }>
                <Plus size={15} /> Profil hinzufügen
              </button>
            </div>
            <div className="compact-entry-list">
              {draft.onlineProfiles.map((profile) => (
                <div className="compact-entry" key={profile.id}>
                  <TextField
                    label="Bezeichnung"
                    value={profile.label}
                    onChange={(label) =>
                      setDraft((current) => ({
                        ...current,
                        onlineProfiles: current.onlineProfiles.map((item) =>
                          item.id === profile.id ? { ...item, label } : item,
                        ),
                      }))
                    }
                  />
                  <TextField
                    label="Adresse / URL"
                    value={profile.url}
                    onChange={(url) =>
                      setDraft((current) => ({
                        ...current,
                        onlineProfiles: current.onlineProfiles.map((item) =>
                          item.id === profile.id ? { ...item, url } : item,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label="Online-Profil löschen"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        onlineProfiles: current.onlineProfiles.filter(
                          (item) => item.id !== profile.id,
                        ),
                      }))
                    }>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            title="Kurzprofil"
            description="Optionaler Einstiegstext für Zielrolle, Erfahrung und besondere Stärken."
            onSave={() =>
              void saveSection(
                "summary",
                ["summary", "resumeSectionTitles"],
                "summary",
              )
            }
            saving={savingSection === "summary"}
            saved={savedSection === "summary"}>
            <ResumeSectionTitleEditor
              profile={draft}
              section="summary"
              onChange={setDraft}
            />
            <label className="field full">
              <span>Kurzprofil</span>
              <textarea
                rows={5}
                value={draft.summary}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
              />
            </label>
          </EditorSection>

          <EditorSection
            title="Stärken"
            description="Alle Vorlagen zeigen Stärken in 3 Spalten. Neun Einträge ergeben 3 Zeilen; die Reihenfolge bleibt erhalten."
            action={
              <button
                type="button"
                className="button secondary small-button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    strengths: [
                      ...current.strengths,
                      {
                        id: crypto.randomUUID(),
                        title: "Neue Stärke",
                        description: "",
                        iconId: "",
                      },
                    ],
                  }))
                }>
                <Plus size={15} /> Stärke hinzufügen
              </button>
            }
            onSave={() =>
              void saveSection(
                "strengths",
                ["strengths", "resumeSectionTitles"],
                "strengths",
              )
            }
            saving={savingSection === "strengths"}
            saved={savedSection === "strengths"}>
            <button
              type="button"
              className="button secondary small-button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  strengths: addTechnologyStrengths(current.strengths),
                }))
              }>
              <Plus size={15} /> Go / React / Spring Boot ergänzen
            </button>
            <ResumeSectionTitleEditor
              profile={draft}
              section="strengths"
              onChange={setDraft}
            />
            <div className="special-entry-list">
              {draft.strengths.map((strength, index) => (
                <div className="special-entry-card" key={strength.id}>
                  <div className="resume-card-fields">
                    <TextField
                      label="Stärke"
                      value={strength.title}
                      onChange={(title) =>
                        setDraft((current) => ({
                          ...current,
                          strengths: current.strengths.map((item) =>
                            item.id === strength.id ? { ...item, title } : item,
                          ),
                        }))
                      }
                    />
                    <TechnologyIconPicker
                      technologyTitle={strength.title}
                      value={strength.iconId}
                      onChange={(iconId) =>
                        setDraft((current) => ({
                          ...current,
                          strengths: current.strengths.map((item) =>
                            item.id === strength.id
                              ? { ...item, iconId }
                              : item,
                          ),
                        }))
                      }
                    />
                    <label className="field">
                      <span>Beschreibung</span>
                      <textarea
                        rows={3}
                        value={strength.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            strengths: current.strengths.map((item) =>
                              item.id === strength.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <SortActions
                    index={index}
                    length={draft.strengths.length}
                    onMove={(direction) =>
                      setDraft((current) => ({
                        ...current,
                        strengths: moveItem(
                          current.strengths,
                          strength.id,
                          direction,
                        ),
                      }))
                    }
                    onRemove={() =>
                      setDraft((current) => ({
                        ...current,
                        strengths: current.strengths.filter(
                          (item) => item.id !== strength.id,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
              {!draft.strengths.length ? (
                <EditorEmpty text="Noch keine unabhängige Stärke erfasst." />
              ) : null}
            </div>
          </EditorSection>

          <EditorSection
            title="Bewerbungsfoto & Unterschrift"
            description="Beide Angaben sind optional."
            onSave={() =>
              void saveSection("media", ["photoPath", "signaturePath"])
            }
            saving={savingSection === "media"}
            saved={savedSection === "media"}>
            <div className="profile-media-grid">
              <ProfileMediaCard
                kind="photo"
                label="Lebenslauf-Foto"
                description="PNG, JPG oder WebP · maximal 8 MB"
                source={photoSource}
                onPick={() => void pickMedia("photo")}
                onRemove={() => removeMedia("photo")}
              />
              <ProfileMediaCard
                kind="signature"
                label="Unterschrift"
                description="Am besten als transparente PNG-Datei"
                source={signatureSource}
                onPick={() => void pickMedia("signature")}
                onRemove={() => removeMedia("signature")}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="Berufserfahrung"
            description="Zeiträume können direkt geschrieben oder über den Kalender gewählt werden."
            action={
              <button
                type="button"
                className="button secondary small-button"
                onClick={addExperience}>
                <Plus size={15} /> Station hinzufügen
              </button>
            }
            onSave={() =>
              void saveSection(
                "experience",
                ["experiences", "resumeSectionTitles"],
                "experience",
              )
            }
            saving={savingSection === "experience"}
            saved={savedSection === "experience"}>
            <ResumeSectionTitleEditor
              profile={draft}
              section="experience"
              onChange={setDraft}
            />
            <div className="resume-editor-list">
              {draft.experiences.map((experience, index) => (
                <article
                  className="resume-editor-card"
                  draggable
                  key={experience.id}
                  onDragStart={() =>
                    setDragged({ type: "experience", id: experience.id })
                  }
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => drop("experience", experience.id)}>
                  <div className="drag-handle" title="Zum Sortieren ziehen">
                    <GripVertical size={18} />
                  </div>
                  <div className="resume-card-fields">
                    <div className="split-fields">
                      <FlexibleDateField
                        label="Von"
                        value={experience.from}
                        mode="month"
                        onChange={(from) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? { ...item, from }
                                : item,
                            ),
                          }))
                        }
                      />
                      <FlexibleDateField
                        label="Bis"
                        value={experience.to}
                        mode="month"
                        onChange={(to) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? {
                                    ...item,
                                    to,
                                    isCurrent:
                                      to.trim().toLowerCase() === "heute",
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="form-grid">
                      <TextField
                        label="Position"
                        value={experience.role}
                        onChange={(role) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? { ...item, role }
                                : item,
                            ),
                          }))
                        }
                      />
                      <TextField
                        label="Unternehmen"
                        value={experience.company}
                        onChange={(company) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? { ...item, company }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <TextField
                      label="Ort"
                      value={experience.city}
                      onChange={(city) =>
                        setDraft((current) => ({
                          ...current,
                          experiences: current.experiences.map((item) =>
                            item.id === experience.id
                              ? { ...item, city }
                              : item,
                          ),
                        }))
                      }
                    />
                    <label className="checkbox-field field-checkbox">
                      <input
                        type="checkbox"
                        checked={experience.isCurrent}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? {
                                    ...item,
                                    isCurrent: event.target.checked,
                                    to: event.target.checked
                                      ? "heute"
                                      : item.to.trim().toLowerCase() === "heute"
                                        ? ""
                                        : item.to,
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                      <span>Aktuelle Position (bis heute)</span>
                    </label>
                    <div className="profile-subsection-header compact-heading">
                      <div>
                        <strong>Aufgaben & Erfolge</strong>
                        <small>
                          Kurze, konkrete Stichpunkte; jeder Punkt wird einzeln
                          angelegt.
                        </small>
                      </div>
                    </div>
                    <EntryListEditor
                      values={experience.achievements}
                      multiline
                      addLabel="Stichpunkt hinzufügen"
                      emptyText="Noch keine Aufgabe oder kein Erfolg erfasst."
                      placeholder="z. B. REST-API mit Symfony entwickelt"
                      onChange={(achievements) =>
                        setDraft((current) => ({
                          ...current,
                          experiences: current.experiences.map((item) =>
                            item.id === experience.id
                              ? { ...item, achievements }
                              : item,
                          ),
                        }))
                      }
                    />
                  </div>
                  <SortActions
                    index={index}
                    length={draft.experiences.length}
                    onMove={(direction) =>
                      setDraft((current) => ({
                        ...current,
                        experiences: moveItem(
                          current.experiences,
                          experience.id,
                          direction,
                        ),
                      }))
                    }
                    onRemove={() =>
                      setDraft((current) => ({
                        ...current,
                        experiences: current.experiences.filter(
                          (item) => item.id !== experience.id,
                        ),
                      }))
                    }
                  />
                </article>
              ))}
              {!draft.experiences.length && (
                <EditorEmpty text="Noch keine Berufserfahrung erfasst." />
              )}
            </div>
          </EditorSection>

          <EditorSection
            title="Ausbildung"
            description="Studium, Schule, Ausbildung oder laufender Abschluss."
            action={
              <button
                type="button"
                className="button secondary small-button"
                onClick={addEducation}>
                <Plus size={15} /> Ausbildung hinzufügen
              </button>
            }
            onSave={() =>
              void saveSection(
                "education",
                ["education", "resumeSectionTitles"],
                "education",
              )
            }
            saving={savingSection === "education"}
            saved={savedSection === "education"}>
            <ResumeSectionTitleEditor
              profile={draft}
              section="education"
              onChange={setDraft}
            />
            <div className="resume-editor-list">
              {draft.education.map((education, index) => (
                <article
                  className="resume-editor-card"
                  draggable
                  key={education.id}
                  onDragStart={() =>
                    setDragged({ type: "education", id: education.id })
                  }
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => drop("education", education.id)}>
                  <div className="drag-handle" title="Zum Sortieren ziehen">
                    <GripVertical size={18} />
                  </div>
                  <div className="resume-card-fields">
                    <div className="split-fields">
                      <FlexibleDateField
                        label="Von"
                        value={education.from}
                        mode="month"
                        onChange={(from) =>
                          setDraft((current) => ({
                            ...current,
                            education: current.education.map((item) =>
                              item.id === education.id
                                ? { ...item, from }
                                : item,
                            ),
                          }))
                        }
                      />
                      <FlexibleDateField
                        label="Bis"
                        value={education.to}
                        mode="month"
                        onChange={(to) =>
                          setDraft((current) => ({
                            ...current,
                            education: current.education.map((item) =>
                              item.id === education.id ? { ...item, to } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="form-grid">
                      <TextField
                        label="Abschluss"
                        value={education.degree}
                        onChange={(degree) =>
                          setDraft((current) => ({
                            ...current,
                            education: current.education.map((item) =>
                              item.id === education.id
                                ? { ...item, degree }
                                : item,
                            ),
                          }))
                        }
                      />
                      <TextField
                        label="Institution"
                        value={education.institution}
                        onChange={(institution) =>
                          setDraft((current) => ({
                            ...current,
                            education: current.education.map((item) =>
                              item.id === education.id
                                ? { ...item, institution }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <TextField
                      label="Ort"
                      value={education.city}
                      onChange={(city) =>
                        setDraft((current) => ({
                          ...current,
                          education: current.education.map((item) =>
                            item.id === education.id ? { ...item, city } : item,
                          ),
                        }))
                      }
                    />
                  </div>
                  <SortActions
                    index={index}
                    length={draft.education.length}
                    onMove={(direction) =>
                      setDraft((current) => ({
                        ...current,
                        education: moveItem(
                          current.education,
                          education.id,
                          direction,
                        ),
                      }))
                    }
                    onRemove={() =>
                      setDraft((current) => ({
                        ...current,
                        education: current.education.filter(
                          (item) => item.id !== education.id,
                        ),
                      }))
                    }
                  />
                </article>
              ))}
              {!draft.education.length && (
                <EditorEmpty text="Noch keine Ausbildung erfasst." />
              )}
            </div>
          </EditorSection>

          <EditorSection
            title="Kenntnisse"
            description="Kenntnisse werden unabhängig von Stärken, Sprachen und Zertifikaten verwaltet."
            onSave={() =>
              void saveSection("knowledge", ["knowledgeSection", "skills"])
            }
            saving={savingSection === "knowledge"}
            saved={savedSection === "knowledge"}>
            <KnowledgeSectionEditor
              value={{
                ...draft.knowledgeSection,
                title: getResumeSectionTitle(draft, "knowledge"),
              }}
              onChange={(knowledgeSection) =>
                setDraft((current) =>
                  setResumeSectionTitle(
                    { ...current, knowledgeSection },
                    "knowledge",
                    knowledgeSection.title,
                  ),
                )
              }
              onCopyCategory={copyKnowledgeCategory}
            />
          </EditorSection>

          <EditorSection
            title="Sprachen"
            description="Sprachen werden nach dem Gemeinsamen Europäischen Referenzrahmen (GER) von A1 bis C2 bewertet."
            onSave={() =>
              void saveSection(
                "languages",
                ["languages", "resumeSectionTitles"],
                "languages",
              )
            }
            saving={savingSection === "languages"}
            saved={savedSection === "languages"}>
            <ResumeSectionTitleEditor
              profile={draft}
              section="languages"
              onChange={setDraft}
            />
            <LanguageLevelEditor
              values={draft.languages}
              onChange={(languages) =>
                setDraft((current) => ({ ...current, languages }))
              }
            />
          </EditorSection>

          <EditorSection
            title="Zertifikate"
            description="Eigener Abschnitt mit frei änderbarer Überschrift."
            onSave={() =>
              void saveSection(
                "certifications",
                ["certifications", "resumeSectionTitles"],
                "certifications",
              )
            }
            saving={savingSection === "certifications"}
            saved={savedSection === "certifications"}>
            <ResumeSectionTitleEditor
              profile={draft}
              section="certifications"
              onChange={setDraft}
            />
            <CertificateListEditor
              values={draft.certifications}
              onChange={(certifications) =>
                setDraft((current) => ({ ...current, certifications }))
              }
            />
          </EditorSection>

          <EditorSection
            title="Besondere Lebenslauf-Bereiche"
            description="Füge nur passende Bereiche hinzu. Eigene Abschnitte decken besondere Muster ab."
            onSave={() =>
              void saveSection("special-sections", ["specialSections"])
            }
            saving={savingSection === "special-sections"}
            saved={savedSection === "special-sections"}>
            <SpecialSectionsEditor
              value={draft.specialSections}
              onChange={(specialSections) =>
                setDraft((current) => ({ ...current, specialSections }))
              }
            />
          </EditorSection>

          <EditorSection
            title="Ort, Datum & Abschluss"
            description="Für den Abschluss des Lebenslaufs; die Unterschrift wird oben verwaltet."
            onSave={() =>
              void saveSection("closing", [
                "applicationPlace",
                "applicationDate",
              ])
            }
            saving={savingSection === "closing"}
            saved={savedSection === "closing"}>
            <div className="form-grid">
              <TextField
                label="Ort"
                value={draft.applicationPlace}
                onChange={(applicationPlace) =>
                  setDraft((current) => ({ ...current, applicationPlace }))
                }
              />
              <FlexibleDateField
                label="Datum"
                value={draft.applicationDate}
                mode="date"
                onChange={(applicationDate) =>
                  setDraft((current) => ({ ...current, applicationDate }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="Sichtbare Lebenslauf-Abschnitte"
            onSave={() => void saveSection("visibility", ["resumeSections"])}
            saving={savingSection === "visibility"}
            saved={savedSection === "visibility"}>
            <div className="section-toggle-grid">
              {(
                [
                  ["profile", draft.resumeSectionTitles.summary],
                  ["strengths", draft.resumeSectionTitles.strengths],
                  ["experience", draft.resumeSectionTitles.experience],
                  ["education", draft.resumeSectionTitles.education],
                  ["skills", draft.knowledgeSection.title],
                  ["languages", draft.resumeSectionTitles.languages],
                  ["certifications", draft.resumeSectionTitles.certifications],
                ] as const
              ).map(([key, label]) => (
                <label className="checkbox-field" key={key}>
                  <input
                    type="checkbox"
                    checked={draft.resumeSections[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        resumeSections: {
                          ...current.resumeSections,
                          [key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{label} anzeigen</span>
                </label>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            title="Profileinstellung"
            onSave={() => void saveSection("settings", ["isDefault"])}
            saving={savingSection === "settings"}
            saved={savedSection === "settings"}>
            <label className="checkbox-field full profile-default">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isDefault: event.target.checked,
                  }))
                }
              />
              <span>Als Standardprofil verwenden</span>
            </label>
          </EditorSection>

          <div className="save-bar sticky-save">
            <span>
              Reihenfolge und Sichtbarkeit werden direkt in Lebenslauf und PDF
              übernommen.
            </span>
            <button className="button primary" type="submit">
              <Save size={17} /> Profil speichern
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function EditorSection({
  title,
  description,
  action,
  onSave,
  saving = false,
  saved = false,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="profile-editor-section">
      <header>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
      {onSave ? (
        <footer className="profile-section-save">
          {saved ? <span>Gespeichert</span> : <span />}
          <button
            type="button"
            className="button secondary small-button"
            disabled={saving}
            onClick={onSave}>
            <Save size={15} />{" "}
            {saving ? "Wird aktualisiert …" : "Abschnitt aktualisieren"}
          </button>
        </footer>
      ) : null}
    </section>
  );
}

function TextField({
  label,
  value,
  type = "text",
  required = false,
  full = false,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  full?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ListField({
  label,
  values,
  full = false,
  onChange,
}: {
  label: string;
  values: string[];
  full?: boolean;
  onChange: (values: string[]) => void;
}) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      <EntryListEditor
        values={values}
        onChange={onChange}
        multiline
        addLabel="Punkt hinzufügen"
        emptyText="Noch kein Punkt erfasst."
      />
    </div>
  );
}

function FlexibleDateField({
  label,
  value,
  mode,
  onChange,
}: {
  label: string;
  value: string;
  mode: "date" | "month";
  onChange: (value: string) => void;
}) {
  const pickerValue = (() => {
    if (mode === "month") {
      const match = value.match(/^(\d{2})[./-](\d{4})$/);
      return match ? `${match[2]}-${match[1]}` : "";
    }
    const match = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
  })();

  const pick = (selected: string) => {
    if (!selected) return;
    const parts = selected.split("-");
    onChange(
      mode === "month"
        ? `${parts[1]}/${parts[0]}`
        : `${parts[2]}.${parts[1]}.${parts[0]}`,
    );
  };

  return (
    <label className="field flexible-date-field">
      <span>{label}</span>
      <div>
        <input
          type="text"
          value={value}
          placeholder={mode === "month" ? "MM/JJJJ oder heute" : "TT.MM.JJJJ"}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="date-picker-control" title="Datum auswählen">
          <CalendarDays size={15} />
          <input
            type={mode}
            value={pickerValue}
            aria-label={`${label} auswählen`}
            onChange={(event) => pick(event.target.value)}
          />
        </span>
      </div>
    </label>
  );
}

function SpecialSectionsEditor({
  value,
  onChange,
}: {
  value: ApplicantProfile["specialSections"];
  onChange: (value: ApplicantProfile["specialSections"]) => void;
}) {
  const [newKind, setNewKind] = useState<ResumeSpecialSectionKind>("projects");

  const updateSection = (
    sectionId: string,
    update: Partial<ApplicantProfile["specialSections"][number]>,
  ) =>
    onChange(
      value.map((section) =>
        section.id === sectionId ? { ...section, ...update } : section,
      ),
    );

  const addSection = () => {
    const label =
      specialSectionOptions.find((option) => option.kind === newKind)?.label ??
      "Eigener Abschnitt";
    onChange([
      ...value,
      {
        id: crypto.randomUUID(),
        kind: newKind,
        title: label,
        isVisible: true,
        entries: [],
      },
    ]);
  };

  const addEntry = (sectionId: string) => {
    const section = value.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      entries: [
        ...section.entries,
        {
          id: crypto.randomUUID(),
          title: "",
          subtitle: "",
          from: "",
          to: "",
          date: "",
          location: "",
          url: "",
          description: "",
          bullets: [],
        },
      ],
    });
  };

  const updateEntry = (
    sectionId: string,
    entryId: string,
    update: Partial<
      ApplicantProfile["specialSections"][number]["entries"][number]
    >,
  ) => {
    const section = value.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      entries: section.entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...update } : entry,
      ),
    });
  };

  return (
    <div className="special-sections-editor">
      <div className="special-section-add">
        <label className="field">
          <span>Bereich auswählen</span>
          <select
            value={newKind}
            onChange={(event) =>
              setNewKind(event.target.value as ResumeSpecialSectionKind)
            }>
            {specialSectionOptions.map((option) => (
              <option key={option.kind} value={option.kind}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button secondary small-button"
          onClick={addSection}>
          <Plus size={15} /> Bereich hinzufügen
        </button>
      </div>

      {value.map((section, sectionIndex) => (
        <article className="special-section-card" key={section.id}>
          <header>
            <span className="large-icon compact-icon">
              <Layers3 size={18} />
            </span>
            <div className="special-section-heading-fields">
              <TextField
                label="Überschrift im Lebenslauf"
                value={section.title}
                onChange={(title) => updateSection(section.id, { title })}
              />
              <label className="field">
                <span>Inhaltstyp</span>
                <select value={section.contentType ?? ""} onChange={(event) => updateSection(section.id, { contentType: (event.target.value || undefined) as ResumeCustomContentType | undefined })}>
                  <option value="">Automatisch</option>
                  {Object.entries(resumeCustomContentLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Bereichstyp</span>
                <select
                  value={section.kind}
                  onChange={(event) =>
                    updateSection(section.id, {
                      kind: event.target.value as ResumeSpecialSectionKind,
                    })
                  }>
                  {specialSectionOptions.map((option) => (
                    <option key={option.kind} value={option.kind}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="special-section-actions">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={section.isVisible}
                  onChange={(event) =>
                    updateSection(section.id, {
                      isVisible: event.target.checked,
                    })
                  }
                />
                <span>Anzeigen</span>
              </label>
              <button
                type="button"
                className="icon-button"
                disabled={sectionIndex === 0}
                aria-label="Bereich nach oben verschieben"
                onClick={() => onChange(moveItem(value, section.id, -1))}>
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={sectionIndex === value.length - 1}
                aria-label="Bereich nach unten verschieben"
                onClick={() => onChange(moveItem(value, section.id, 1))}>
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                className="icon-button danger"
                aria-label="Bereich löschen"
                onClick={() =>
                  onChange(value.filter((item) => item.id !== section.id))
                }>
                <Trash2 size={15} />
              </button>
            </div>
          </header>

          <div className="special-entry-list">
            {section.entries.map((entry, entryIndex) => (
              <div className="special-entry-card" key={entry.id}>
                <div className="resume-card-fields">
                  <div className="form-grid">
                    <TextField
                      label="Titel / Bezeichnung"
                      value={entry.title}
                      onChange={(title) =>
                        updateEntry(section.id, entry.id, { title })
                      }
                    />
                    <TextField
                      label="Rolle / Organisation / Zusatz"
                      value={entry.subtitle}
                      onChange={(subtitle) =>
                        updateEntry(section.id, entry.id, { subtitle })
                      }
                    />
                    <FlexibleDateField
                      label="Von"
                      value={entry.from}
                      mode="month"
                      onChange={(from) =>
                        updateEntry(section.id, entry.id, { from })
                      }
                    />
                    <FlexibleDateField
                      label="Bis"
                      value={entry.to}
                      mode="month"
                      onChange={(to) =>
                        updateEntry(section.id, entry.id, { to })
                      }
                    />
                    <FlexibleDateField
                      label="Einzeldatum"
                      value={entry.date}
                      mode="date"
                      onChange={(date) =>
                        updateEntry(section.id, entry.id, { date })
                      }
                    />
                    <TextField
                      label="Ort"
                      value={entry.location}
                      onChange={(location) =>
                        updateEntry(section.id, entry.id, { location })
                      }
                    />
                    <TextField
                      label="Link / URL"
                      value={entry.url}
                      full
                      onChange={(url) =>
                        updateEntry(section.id, entry.id, { url })
                      }
                    />
                  </div>
                  <label className="field">
                    <span>Beschreibung</span>
                    <textarea
                      rows={3}
                      value={entry.description}
                      onChange={(event) =>
                        updateEntry(section.id, entry.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <ListField
                    label="Details / Erfolge"
                    values={entry.bullets}
                    full
                    onChange={(bullets) =>
                      updateEntry(section.id, entry.id, { bullets })
                    }
                  />
                </div>
                <SortActions
                  index={entryIndex}
                  length={section.entries.length}
                  onMove={(direction) =>
                    updateSection(section.id, {
                      entries: moveItem(section.entries, entry.id, direction),
                    })
                  }
                  onRemove={() =>
                    updateSection(section.id, {
                      entries: section.entries.filter(
                        (item) => item.id !== entry.id,
                      ),
                    })
                  }
                />
              </div>
            ))}
            {!section.entries.length ? (
              <EditorEmpty text="Noch kein Eintrag in diesem Bereich." />
            ) : null}
          </div>
          <button
            type="button"
            className="button secondary small-button align-start"
            onClick={() => addEntry(section.id)}>
            <Plus size={15} /> Eintrag hinzufügen
          </button>
        </article>
      ))}
      {!value.length ? (
        <EditorEmpty text="Noch kein besonderer Lebenslauf-Bereich angelegt." />
      ) : null}
    </div>
  );
}

function SortActions({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="sort-actions">
      <OrderControls
        index={index}
        length={length}
        onMove={(target) => onMove(target - index)}
      />
      <button
        type="button"
        className="icon-button danger"
        aria-label="Eintrag löschen"
        onClick={onRemove}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function EditorEmpty({ text }: { text: string }) {
  return (
    <div className="editor-empty">
      <GraduationCap size={20} />
      <span>{text}</span>
    </div>
  );
}

function ProfileMediaCard({
  kind,
  label,
  description,
  source,
  onPick,
  onRemove,
}: {
  kind: ProfileMediaKind;
  label: string;
  description: string;
  source: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  const Icon = kind === "photo" ? ImagePlus : PenLine;
  return (
    <article className={`profile-media-card media-${kind}`}>
      <div className="profile-media-preview">
        {source ? (
          <img src={source} alt={`${label} Vorschau`} />
        ) : (
          <Icon size={28} />
        )}
      </div>
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
        <div className="profile-media-actions">
          <button
            className="button secondary small-button"
            type="button"
            onClick={onPick}>
            <Icon size={15} /> {source ? "Ersetzen" : "Auswählen"}
          </button>
          {source ? (
            <button
              className="icon-button danger"
              type="button"
              aria-label={`${label} entfernen`}
              onClick={onRemove}>
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
