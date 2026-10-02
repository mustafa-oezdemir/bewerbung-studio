import { resumeCustomContentLabels, type ResumeCustomContentType } from "../shared/resumeCustomSectionTypes";
import {
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  GraduationCap,
  Layers3,
  Plus,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addTechnologyStrengths } from "../shared/strengthPresets";
import { moveListItem } from "../shared/listOrder";
import { OrderControls } from "../components/profile/OrderControls";
import { ResumeSectionTitleEditor } from "../components/resume/ResumeSectionTitleEditor";
import { ResumeHeadingEditor } from "../components/resume/ResumeHeadingEditor";
import {
  copyResumeHeading,
} from "../shared/resumeHeading";
import { EntryListEditor } from "../components/profile/EntryListEditor";
import { KnowledgeProfileEditor } from "../components/profile/KnowledgeProfileEditor";
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
import type { ProfileMediaKind } from "../shared/ipc";
import {
  type ApplicantProfile,
  type ResumeSpecialSectionKind,
} from "../shared/schema";
import { resolveSelectedProfile } from "../shared/profileSelection";
import { useAppStore } from "../store/useAppStore";
import { PersonalDataEditor, personalFieldId } from "../components/profile/PersonalDataEditor";
import { FlexibleDateField } from "../components/profile/FlexibleDateField";
import { PhotoSettingsEditor } from "../components/profile/PhotoSettingsEditor";
import { ClosingEditor } from "../components/profile/ClosingEditor";
import { copyResumePhotoSettings, removeResumePhoto, setResumePhoto } from "../shared/resumePhoto";
import { SummaryEditor } from "../components/profile/SummaryEditor";
import { isResumeSummaryVisible, setResumeSummaryVisible } from "../shared/resumeSummary";
import { CareerEditor } from "../components/profile/CareerEditor";
import { defaultResumeCareerFieldVisibility } from "../shared/resumeCareer";
import { EducationEditor } from "../components/profile/EducationEditor";
import { InterestsEditor } from "../components/profile/InterestsEditor";
import { normalizeApplicantProfileForSave, rebaseApplicantProfileDraft, validateApplicantProfile } from "../shared/profileEditor";

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
  resumeCareerFieldVisibility: { ...defaultResumeCareerFieldVisibility },
  resumeColumnRatio: 30,
  resumePhotoSize: "medium",
  resumeClosing: { showPlace: true, showDate: true, showSignature: true, dateMode: "application" },
  updatedAt: new Date().toISOString(),
});

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
  { kind: "interests", label: "Interessen und Hobbys" },
  { kind: "drivingLicenses", label: "Führerschein" },
  { kind: "additional", label: "Zusatzangaben" },
  { kind: "references", label: "Referenzen" },
  { kind: "custom", label: "Eigener Abschnitt" },
];

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
  const baselineRef = useRef(draft);
  const persistedDraft = profiles.find((profile) => profile.id === draft.id);
  useEffect(() => {
    if (!persistedDraft || persistedDraft.updatedAt === baselineRef.current.updatedAt) return;
    setDraft((current) => rebaseApplicantProfileDraft(baselineRef.current, current, persistedDraft));
    baselineRef.current = persistedDraft;
  }, [persistedDraft]);
  // Set once a save was attempted: from then on every missing Pflichtangabe is marked in the editor.
  const [personalAttempted, setPersonalAttempted] = useState(false);
  const [savingSection, setSavingSection] = useState<string>();
  const [savedSection, setSavedSection] = useState<string>();
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const hasUnsavedChanges = JSON.stringify({ ...draft, updatedAt: "" }) !==
    JSON.stringify({ ...baselineRef.current, updatedAt: "" });
  // Only known for a photo picked in this session; the stored picture carries no file name.
  const [photoFileName, setPhotoFileName] = useState<string>();

  const selectProfile = (profile: ApplicantProfile) => {
    selectActiveProfile(profile.id);
    const editable = {
      ...structuredClone(profile),
      knowledgeSection: ensureKnowledgeSection(
        profile.knowledgeSection,
        profile.skills,
      ),
    };
    baselineRef.current = editable;
    setDraft(editable);
  };

  const createProfile = () => {
    const profile = newProfile();
    selectActiveProfile(profile.id);
    baselineRef.current = profile;
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

  const validateBeforeSave = (profile: ApplicantProfile) => {
    const issues = validateApplicantProfile(profile);
    if (issues[0]?.startsWith("personal:")) {
      setPersonalAttempted(true);
      window.requestAnimationFrame(() => {
        const target = document.getElementById(personalFieldId(issues[0].slice("personal:".length)));
        target?.scrollIntoView({ block: "center" });
        target?.focus();
      });
      return false;
    }
    if (issues.length) {
      window.alert(issues[0]);
      return false;
    }
    return true;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const latest = useAppStore.getState().workspace.profiles.find((profile) => profile.id === draft.id);
    const merged = latest ? rebaseApplicantProfileDraft(baselineRef.current, draft, latest) : draft;
    if (!validateBeforeSave(merged)) return;
    const next = normalizeApplicantProfileForSave(merged);
    setSavingAll(true);
    setSaveError(false);
    try {
      await saveProfile(next);
      baselineRef.current = next;
      setDraft(next);
      onSaved();
    } catch { setSaveError(true); }
    finally { setSavingAll(false); }
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
    // The Überschrift section writes only the heading entry, never the other semantic sections.
    if (sectionId === "heading") next = copyResumeHeading(draft, next);
    if (sectionId === "photo") next = copyResumePhotoSettings(draft, next);
    if ((sectionId === "summary" || sectionId === "visibility") && isResumeSummaryVisible(draft) !== isResumeSummaryVisible(next))
      next = setResumeSummaryVisible(next, isResumeSummaryVisible(draft));
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
      const normalized = normalizeApplicantProfileForSave(next);
      await saveProfile(normalized);
      baselineRef.current = normalized;
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
        if (sectionId === "heading") return copyResumeHeading(normalized, updated);
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
      setSaveError(false);
      window.setTimeout(
        () =>
          setSavedSection((current) =>
            current === sectionId ? undefined : current,
          ),
        1800,
      );
    } catch { setSaveError(true); }
    finally {
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
    if (kind === "photo") setPhotoFileName(selected.fileName);
    setDraft((current) =>
      kind === "photo"
        ? setResumePhoto(current, selected.dataUrl)
        : { ...current, signaturePath: selected.dataUrl },
    );
  };

  // Removing the photo clears the picture only; its size and whether it is shown stay as the user set them.
  const removeMedia = (kind: ProfileMediaKind) => {
    if (kind === "photo") setPhotoFileName(undefined);
    setDraft((current) =>
      kind === "photo"
        ? removeResumePhoto(current)
        : { ...current, signaturePath: "" },
    );
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
            <span className={`resume-save-status is-${saveError ? "error" : savingAll || savingSection ? "saving" : hasUnsavedChanges ? "dirty" : savedSection ? "saved" : "idle"}`}>
              {saveError ? "Fehler beim Speichern" : savingAll || savingSection ? "Speichert …" : hasUnsavedChanges ? "Ungespeicherte Änderungen" : savedSection ? "Gespeichert" : "Profil verbunden"}
            </span>
          </div>
          <span className="large-icon">
            <BriefcaseBusiness />
          </span>
        </header>

        <form noValidate onSubmit={(event) => void save(event)}>
          <EditorSection
            title="1. Überschrift"
            description="Titel des Lebenslaufs. Wird im Lebenslauf und auf Folgeseiten verwendet."
            action={<span className="profile-required-badge">Pflicht</span>}
            onSave={() => void saveSection("heading", [])}
            saving={savingSection === "heading"}
            saved={savedSection === "heading"}>
            <ResumeHeadingEditor profile={draft} onChange={setDraft} />
          </EditorSection>

          <EditorSection
            title="2. Persönliche Daten"
            description="Kontakt- und persönliche Angaben für den Lebenslauf."
            action={<span className="profile-required-badge">Pflicht</span>}
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
                "birthDate",
                "birthPlace",
                "nationality",
                "familyStatus",
                "children",
              ])
            }
            saving={savingSection === "personal"}
            saved={savedSection === "personal"}>
            <PersonalDataEditor
              profile={draft}
              onChange={setDraft}
              showIssues={personalAttempted || profiles.some((profile) => profile.id === draft.id)}
            />
          </EditorSection>

          <EditorSection
            title="3. Bewerbungsfoto"
            description="Ein professionelles Bewerbungsfoto kann den persönlichen Eindruck unterstützen."
            action={<span className="profile-optional-badge">Optional</span>}
            onSave={() =>
              void saveSection("photo", ["photoPath", "resumePhotoSize"])
            }
            saving={savingSection === "photo"}
            saved={savedSection === "photo"}>
            <PhotoSettingsEditor
              profile={draft}
              onChange={setDraft}
              fileName={photoFileName}
              onPick={() => void pickMedia("photo")}
              onRemove={() => removeMedia("photo")}
            />
          </EditorSection>

          <EditorSection
            title="4. Kurzprofil"
            description="Fassen Sie Ihre wichtigsten Erfahrungen, Kompetenzen und beruflichen Schwerpunkte in wenigen Sätzen zusammen."
            action={<span className="profile-recommended-badge">Empfohlen</span>}
            onSave={() =>
              void saveSection(
                "summary",
                ["summary", "resumeSectionTitles"],
                "summary",
              )
            }
            saving={savingSection === "summary"}
            saved={savedSection === "summary"}>
            <SummaryEditor profile={draft} onChange={setDraft} />
          </EditorSection>

          <EditorSection
            title="5. Beruflicher Werdegang"
            description="Berufliche Stationen, Aufgaben, Projekte und Erfolge."
            action={<span className="profile-required-badge">Pflicht</span>}
            onSave={() =>
              void saveSection(
                "experience",
                ["experiences", "resumeSectionTitles"],
                "experience",
              )
            }
            saving={savingSection === "experience"}
            saved={savedSection === "experience"}>
            <CareerEditor profile={draft} onChange={setDraft} />
          </EditorSection>

          <EditorSection
            title="6. Bildungsweg · Pflicht"
            description="Schule, Berufsausbildung, Studium und Umschulung."
            onSave={() => void saveSection("education", ["education", "resumeSectionTitles"], "education")}
            saving={savingSection === "education"}
            saved={savedSection === "education"}>
            <EducationEditor profile={draft} onChange={setDraft} />
          </EditorSection>

          <EditorSection
            title="7. Besondere Kenntnisse · Empfohlen"
            description="Relevante Fach-, IT- und Sprachkenntnisse sowie Zusatzqualifikationen."
            onSave={() => void saveSection("knowledge", ["knowledgeSection", "skills", "languages", "certifications", "specialSections", "resumeSectionTitles"])}
            saving={savingSection === "knowledge"}
            saved={savedSection === "knowledge"}>
            <KnowledgeProfileEditor profile={draft} onChange={setDraft} onCopyCategory={copyKnowledgeCategory} />
          </EditorSection>

          <EditorSection
            title="8. Interessen und Hobbys"
            description="Persönliche Interessen, die Ihr Profil sinnvoll ergänzen."
            action={<span className="profile-optional-badge">Optional</span>}
            onSave={() => void saveSection("interests", ["specialSections", "resumeSemanticSections"])}
            saving={savingSection === "interests"}
            saved={savedSection === "interests"}>
            <InterestsEditor profile={draft} onChange={setDraft} />
          </EditorSection>

          <EditorSection
            title="9. Ort, Datum und Unterschrift"
            description="Formeller Abschluss des Lebenslaufs."
            action={<span className="profile-recommended-badge">Empfohlen</span>}
            onSave={() => void saveSection("closing", ["applicationPlace", "applicationDate", "signaturePath", "resumeClosing"])}
            saving={savingSection === "closing"}
            saved={savedSection === "closing"}>
            <ClosingEditor profile={draft} onChange={setDraft}
              onPickSignature={() => void pickMedia("signature")}
              onRemoveSignature={() => removeMedia("signature")} />
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
            title="Sichtbare Lebenslauf-Abschnitte"
            onSave={() => void saveSection("visibility", ["resumeSections"])}
            saving={savingSection === "visibility"}
            saved={savedSection === "visibility"}>
            <div className="section-toggle-grid">
              {(
                [
                  ["profile", getResumeSectionTitle(draft, "summary")],
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
                    checked={key === "profile" ? isResumeSummaryVisible(draft) : draft.resumeSections[key]}
                    onChange={(event) =>
                      setDraft((current) =>
                        // The Kurzprofil switch is the one of section 4 (all three places that describe it).
                        key === "profile"
                          ? setResumeSummaryVisible(current, event.target.checked)
                          : {
                              ...current,
                              resumeSections: {
                                ...current.resumeSections,
                                [key]: event.target.checked,
                              },
                            },
                      )
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
            <button className="button primary" type="submit" disabled={savingAll}>
              <Save size={17} /> {savingAll ? "Speichert …" : "Profil speichern"}
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
