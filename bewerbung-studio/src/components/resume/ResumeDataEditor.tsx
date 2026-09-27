import { resumeCustomContentLabels, type ResumeCustomContentType } from "../../shared/resumeCustomSectionTypes";
import { ChevronDown, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { addTechnologyStrengths } from "../../shared/strengthPresets";
import { moveListItem } from "../../shared/listOrder";
import { OrderControls } from "../profile/OrderControls";
import { ResumeSectionTitleEditor } from "./ResumeSectionTitleEditor";
import {
  getResumeSectionTitle,
  setResumeSectionTitle,
} from "../../features/resume-sections/resume-sections";
import {
  ensureKnowledgeSection,
  syncLegacySkills,
} from "../../features/knowledge/knowledge.service";
import { validateKnowledgeSection } from "../../features/knowledge/knowledge.validation";
import {
  type ApplicantProfile,
  type ResumeSpecialSectionKind,
} from "../../shared/schema";
import { KnowledgeSectionEditor } from "../knowledge/KnowledgeSectionEditor";
import { LanguageLevelEditor } from "../languages/LanguageLevelEditor";
import {
  CertificateListEditor,
  EntryListEditor,
} from "../profile/EntryListEditor";
import { TechnologyIconPicker } from "../profile/TechnologyIconPicker";

type Props = {
  profile: ApplicantProfile;
  onPreview: (profile: ApplicantProfile | null) => void;
  onSave: (profile: ApplicantProfile) => Promise<void>;
  defaultOpen?: boolean;
  section?: string;
  controlledDraft?: ApplicantProfile;
  onDraftChange?: Dispatch<SetStateAction<ApplicantProfile>>;
};

const cloneProfile = (profile: ApplicantProfile): ApplicantProfile => ({
  ...structuredClone(profile),
  knowledgeSection: ensureKnowledgeSection(
    profile.knowledgeSection,
    profile.skills,
  ),
});

const normalizeProfileUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^[a-z][a-z\d+.-]*:(?:\/\/)?/i, "")}`;
};

export const normalizeResumeDataDraft = (
  draft: ApplicantProfile,
): ApplicantProfile => ({
  ...draft,
  linkedin: normalizeProfileUrl(draft.linkedin),
  github: normalizeProfileUrl(draft.github),
  portfolio: normalizeProfileUrl(draft.portfolio),
  onlineProfiles: draft.onlineProfiles.map((entry) => ({
    ...entry,
    url: normalizeProfileUrl(entry.url),
  })),
  resumeSemanticSections: draft.resumeSemanticSections.map((section) => ({
    ...section,
    customTitle: section.customTitle.trim(),
  })),
  resumeSectionTitles: Object.fromEntries(
    Object.entries(draft.resumeSectionTitles).map(([key, title]) => [
      key,
      title.trim(),
    ]),
  ) as ApplicantProfile["resumeSectionTitles"],
  strengths: draft.strengths
    .map((strength) => ({
      ...strength,
      title: strength.title.trim(),
      description: strength.description.trim(),
      iconId: strength.iconId.trim(),
    }))
    .filter((strength) => strength.title),
  experiences: draft.experiences.map((item) => ({
    ...item,
    tasks: item.tasks.map((value) => value.trim()).filter(Boolean),
    projects: item.projects.map((value) => value.trim()).filter(Boolean),
    technologies: item.technologies
      .map((value) => value.trim())
      .filter(Boolean),
    achievements: item.achievements
      .map((value) => value.trim())
      .filter(Boolean),
  })),
  languages: draft.languages.map((value) => value.trim()).filter(Boolean),
  certifications: draft.certifications
    .map((value) => value.trim())
    .filter(Boolean),
  specialSections: draft.specialSections.map((section) => ({
    ...section,
    title: section.title.trim(),
    entries: section.entries.map((entry) => ({
      ...entry,
      url: normalizeProfileUrl(entry.url),
      bullets: entry.bullets.map((value) => value.trim()).filter(Boolean),
    })),
  })),
  skills: syncLegacySkills(draft.knowledgeSection),
  updatedAt: new Date().toISOString(),
});

export function ResumeDataEditor({
  profile,
  onPreview,
  onSave,
  defaultOpen = false,
  section,
  controlledDraft,
  onDraftChange,
}: Props) {
  const [localDraft, setLocalDraft] = useState<ApplicantProfile>(() =>
    cloneProfile(profile),
  );
  const draft = controlledDraft ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!controlledDraft) setLocalDraft(cloneProfile(profile));
  }, [profile.id, profile.updatedAt]);

  useEffect(() => {
    if (!controlledDraft) onPreview(draft);
  }, [draft, onPreview]);

  useEffect(
    () => () => {
      if (!controlledDraft) onPreview(null);
    },
    [onPreview, Boolean(controlledDraft)],
  );

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
          achievements: [],
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

  const reset = () => setDraft(cloneProfile(profile));

  const save = async () => {
    const issues = validateKnowledgeSection(draft.knowledgeSection);
    if (issues.length) {
      window.alert(issues[0].message);
      return;
    }
    if (
      Object.values(draft.resumeSectionTitles).some((title) => !title.trim()) ||
      draft.specialSections.some((section) => !section.title.trim())
    ) {
      window.alert("Bitte jedem Lebenslauf-Abschnitt eine Überschrift geben.");
      return;
    }
    const normalized = normalizeResumeDataDraft(draft);
    setDraft(normalized);
    await onSave(normalized);
  };

  const updateSection = () => void save();

  return (
    <section
      className={
        section
          ? "resume-data-editor resume-managed-content"
          : "resume-data-editor"
      }>
      {!section && (
        <button
          className="resume-data-editor-trigger"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}>
          <span>
            <strong>Lebenslaufdaten bearbeiten</strong>
            <small>Einträge hinzufügen, ändern oder löschen</small>
          </span>
          <ChevronDown className={open ? "is-open" : ""} size={18} />
        </button>
      )}

      {open || section ? (
        <div className="resume-data-editor-body">
          <p className="resume-data-editor-hint" hidden={Boolean(section)}>
            Diese Daten gehören zum ausgewählten Profil und werden in allen
            damit verbundenen Bewerbungen verwendet.
          </p>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "personalData")}>
            <summary>Profil</summary>
            <div className="resume-data-field-grid resume-personal-fields">
              {!section && (
                <>
                  <EditorInput
                    label="Vorname"
                    value={draft.firstName}
                    onChange={(firstName) =>
                      setDraft((current) => ({ ...current, firstName }))
                    }
                  />
                  <EditorInput
                    label="Nachname"
                    value={draft.lastName}
                    onChange={(lastName) =>
                      setDraft((current) => ({ ...current, lastName }))
                    }
                  />
                  <EditorInput
                    label="Berufsbezeichnung"
                    value={draft.title}
                    onChange={(title) =>
                      setDraft((current) => ({ ...current, title }))
                    }
                  />
                </>
              )}
              <EditorInput
                label="Telefon"
                value={draft.phone}
                onChange={(phone) =>
                  setDraft((current) => ({ ...current, phone }))
                }
              />
              <EditorInput
                label="E-Mail"
                value={draft.email}
                onChange={(email) =>
                  setDraft((current) => ({ ...current, email }))
                }
              />
              <EditorInput
                label="Straße"
                value={draft.street}
                onChange={(street) =>
                  setDraft((current) => ({ ...current, street }))
                }
              />
              <EditorInput
                label="PLZ"
                value={draft.postalCode}
                onChange={(postalCode) =>
                  setDraft((current) => ({ ...current, postalCode }))
                }
              />
              <EditorInput
                label="Ort"
                value={draft.city}
                onChange={(city) =>
                  setDraft((current) => ({ ...current, city }))
                }
              />
              <EditorInput
                label="Land"
                value={draft.country}
                onChange={(country) =>
                  setDraft((current) => ({ ...current, country }))
                }
              />
              <EditorInput
                label="LinkedIn"
                value={draft.linkedin}
                onChange={(linkedin) =>
                  setDraft((current) => ({ ...current, linkedin }))
                }
              />
              <EditorInput
                label="GitHub"
                value={draft.github}
                onChange={(github) =>
                  setDraft((current) => ({ ...current, github }))
                }
              />
              <EditorInput
                label="Portfolio"
                value={draft.portfolio}
                onChange={(portfolio) =>
                  setDraft((current) => ({ ...current, portfolio }))
                }
              />
              {(
                [
                  ["birthDate", "Geburtsdatum"],
                  ["birthPlace", "Geburtsort"],
                  ["nationality", "Staatsangehörigkeit"],
                  ["familyStatus", "Familienstand"],
                  ["children", "Kinder"],
                ] as const
              ).map(([key, label]) => (
                <EditorInput
                  key={key}
                  label={label}
                  value={draft[key]}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, [key]: value }))
                  }
                />
              ))}
            </div>
            <div className="manager-online-profiles">
              {draft.onlineProfiles.map((entry) => (
                <div className="manager-block-item" key={entry.id}>
                  <EditorInput
                    label="Online-Profil"
                    value={entry.label}
                    onChange={(label) =>
                      setDraft((current) => ({
                        ...current,
                        onlineProfiles: current.onlineProfiles.map((item) =>
                          item.id === entry.id ? { ...item, label } : item,
                        ),
                      }))
                    }
                  />
                  <EditorInput
                    label="URL"
                    value={entry.url}
                    onChange={(url) =>
                      setDraft((current) => ({
                        ...current,
                        onlineProfiles: current.onlineProfiles.map((item) =>
                          item.id === entry.id ? { ...item, url } : item,
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Online-Profil entfernen"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        onlineProfiles: current.onlineProfiles.filter(
                          (item) => item.id !== entry.id,
                        ),
                      }))
                    }>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    onlineProfiles: [
                      ...current.onlineProfiles,
                      { id: crypto.randomUUID(), label: "", url: "" },
                    ],
                  }))
                }>
                <Plus size={14} /> Online-Profil hinzufügen
              </button>
            </div>
          </details>
          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "summary")}>
            <summary>Kurzprofil</summary>
            <label className="field">
              <span>{draft.resumeSectionTitles.summary}</span>
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
            <ResumeSectionTitleEditor
              profile={draft}
              section="summary"
              onChange={setDraft}
            />
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "strengths")}>
            <summary>{draft.resumeSectionTitles.strengths}</summary>
            <p>3 Spalten in allen Vorlagen · 9 Einträge ergeben 3 Zeilen.</p>
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
            <button
              className="button secondary small-button"
              type="button"
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
            <div className="resume-data-list">
              {draft.strengths.map((strength, index) => (
                <article className="resume-data-card" key={strength.id}>
                  <OrderControls
                    index={index}
                    length={draft.strengths.length}
                    label={strength.title || "Stärke"}
                    onMove={(target) =>
                      setDraft((current) => ({
                        ...current,
                        strengths: moveListItem(
                          current.strengths,
                          index,
                          target,
                        ),
                      }))
                    }
                  />
                  <div className="resume-data-card-heading">
                    <strong>{strength.title || "Neue Stärke"}</strong>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label="Stärke löschen"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          strengths: current.strengths.filter(
                            (item) => item.id !== strength.id,
                          ),
                        }))
                      }>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <EditorInput
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
                          item.id === strength.id ? { ...item, iconId } : item,
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
                </article>
              ))}
            </div>
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "experience")}>
            <summary>
              <span>
                {draft.resumeSectionTitles.experience} (
                {draft.experiences.length})
              </span>
            </summary>
            <ResumeSectionTitleEditor
              profile={draft}
              section="experience"
              onChange={setDraft}
            />
            <button
              className="button secondary small-button"
              type="button"
              onClick={addExperience}>
              <Plus size={15} /> Station hinzufügen
            </button>
            <div className="resume-data-list">
              {draft.experiences.map((experience, index) => (
                <article className="resume-data-card" key={experience.id}>
                  <OrderControls
                    index={index}
                    length={draft.experiences.length}
                    label={experience.role || "Berufserfahrung"}
                    onMove={(target) =>
                      setDraft((current) => ({
                        ...current,
                        experiences: moveListItem(
                          current.experiences,
                          index,
                          target,
                        ),
                      }))
                    }
                  />
                  <div className="resume-data-card-heading">
                    <strong>{experience.role || "Neue Station"}</strong>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label="Berufserfahrung löschen"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          experiences: current.experiences.filter(
                            (item) => item.id !== experience.id,
                          ),
                        }))
                      }>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="resume-data-field-grid">
                    <EditorInput
                      label="Von"
                      value={experience.from}
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
                    <EditorInput
                      label="Bis"
                      value={experience.to}
                      onChange={(to) =>
                        setDraft((current) => ({
                          ...current,
                          experiences: current.experiences.map((item) =>
                            item.id === experience.id ? { ...item, to } : item,
                          ),
                        }))
                      }
                    />
                    <EditorInput
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
                    <EditorInput
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
                    <EditorInput
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
                    {(
                      [
                        ["legalForm", "Rechtsform"],
                        ["employmentType", "Beschäftigungsart"],
                        ["teamSize", "Teamgröße"],
                      ] as const
                    ).map(([key, label]) => (
                      <EditorInput
                        key={key}
                        label={label}
                        value={experience[key]}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? { ...item, [key]: value }
                                : item,
                            ),
                          }))
                        }
                      />
                    ))}
                    <label className="checkbox-field">
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
                                    to: event.target.checked ? "heute" : "",
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                      Aktuelle Position
                    </label>
                    <label className="field">
                      <span>Beschreibung</span>
                      <textarea
                        rows={3}
                        value={experience.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                  {(
                    [
                      ["tasks", "Aufgaben"],
                      ["projects", "Projekte"],
                      ["technologies", "Technologien"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <strong>{label}</strong>
                      <EntryListEditor
                        values={experience[key]}
                        multiline={key !== "technologies"}
                        onChange={(values) =>
                          setDraft((current) => ({
                            ...current,
                            experiences: current.experiences.map((item) =>
                              item.id === experience.id
                                ? { ...item, [key]: values }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="field">
                    <span>Aufgaben & Erfolge</span>
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
                </article>
              ))}
            </div>
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "education")}>
            <summary>
              <span>
                {draft.resumeSectionTitles.education} ({draft.education.length})
              </span>
            </summary>
            <ResumeSectionTitleEditor
              profile={draft}
              section="education"
              onChange={setDraft}
            />
            <button
              className="button secondary small-button"
              type="button"
              onClick={addEducation}>
              <Plus size={15} /> Ausbildung hinzufügen
            </button>
            <div className="resume-data-list">
              {draft.education.map((education, index) => (
                <article className="resume-data-card" key={education.id}>
                  <OrderControls
                    index={index}
                    length={draft.education.length}
                    label={education.degree || "Ausbildung"}
                    onMove={(target) =>
                      setDraft((current) => ({
                        ...current,
                        education: moveListItem(
                          current.education,
                          index,
                          target,
                        ),
                      }))
                    }
                  />
                  <div className="resume-data-card-heading">
                    <strong>{education.degree || "Neue Ausbildung"}</strong>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label="Ausbildung löschen"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          education: current.education.filter(
                            (item) => item.id !== education.id,
                          ),
                        }))
                      }>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="resume-data-field-grid">
                    <EditorInput
                      label="Von"
                      value={education.from}
                      onChange={(from) =>
                        setDraft((current) => ({
                          ...current,
                          education: current.education.map((item) =>
                            item.id === education.id ? { ...item, from } : item,
                          ),
                        }))
                      }
                    />
                    <EditorInput
                      label="Bis"
                      value={education.to}
                      onChange={(to) =>
                        setDraft((current) => ({
                          ...current,
                          education: current.education.map((item) =>
                            item.id === education.id ? { ...item, to } : item,
                          ),
                        }))
                      }
                    />
                    <EditorInput
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
                    <EditorInput
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
                    <EditorInput
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
                    {(
                      [
                        ["country", "Land"],
                        ["type", "Typ"],
                        ["fieldOfStudy", "Fachrichtung"],
                        ["grade", "Note"],
                        ["status", "Status"],
                      ] as const
                    ).map(([key, label]) => (
                      <EditorInput
                        key={key}
                        label={label}
                        value={education[key]}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            education: current.education.map((item) =>
                              item.id === education.id
                                ? { ...item, [key]: value }
                                : item,
                            ),
                          }))
                        }
                      />
                    ))}
                    <label className="field">
                      <span>Beschreibung</span>
                      <textarea
                        rows={3}
                        value={education.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            education: current.education.map((item) =>
                              item.id === education.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          }))
                        }
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "knowledge")}>
            <summary>{draft.knowledgeSection.title || "Kenntnisse"}</summary>
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
            />
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "languages")}>
            <summary>{draft.resumeSectionTitles.languages}</summary>
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
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <details
            className="resume-data-group"
            open
            hidden={Boolean(section && section !== "certifications")}>
            <summary>{draft.resumeSectionTitles.certifications}</summary>
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
            <SectionUpdateButton onClick={updateSection} />
          </details>

          <ResumeSpecialSectionsEditor
            selectedId={
              section?.startsWith("special:")
                ? section.slice(8)
                : section
                  ? "__hidden"
                  : undefined
            }
            value={draft.specialSections}
            onChange={(specialSections) =>
              setDraft((current) => ({ ...current, specialSections }))
            }
            onUpdate={updateSection}
          />

          <div className="resume-data-actions" hidden={Boolean(section)}>
            <button className="button secondary" type="button" onClick={reset}>
              <RotateCcw size={15} /> Verwerfen
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => void save()}>
              <Save size={15} /> Profildaten speichern
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EditorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="field"
      data-heading-editor={/überschrift/i.test(label) || undefined}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SectionUpdateButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="resume-data-section-update">
      <button
        className="button secondary small-button"
        type="button"
        onClick={onClick}>
        <Save size={15} /> Abschnitt aktualisieren
      </button>
    </div>
  );
}

const specialSectionLabels: Record<ResumeSpecialSectionKind, string> = {
  projects: "Projekte",
  internships: "Praktika",
  trainings: "Weiterbildungen",
  internationalExperience: "Auslandserfahrung",
  scholarships: "Stipendien",
  awards: "Auszeichnungen",
  publications: "Veröffentlichungen",
  volunteer: "Ehrenamt",
  interests: "Interessen & Hobbys",
  drivingLicenses: "Führerschein",
  additional: "Zusatzangaben",
  references: "Referenzen",
  custom: "Eigener Abschnitt",
};

export function ResumeSpecialSectionsEditor({
  selectedId,
  value,
  onChange,
  onUpdate,
}: {
  selectedId?: string;
  value: ApplicantProfile["specialSections"];
  onChange: (value: ApplicantProfile["specialSections"]) => void;
  onUpdate: () => void;
}) {
  const [newKind, setNewKind] =
    useState<ResumeSpecialSectionKind>("additional");

  const updateSection = (
    sectionId: string,
    update: Partial<ApplicantProfile["specialSections"][number]>,
  ) =>
    onChange(
      value.map((section) =>
        section.id === sectionId ? { ...section, ...update } : section,
      ),
    );

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
    <div className="resume-special-section-groups">
      <div className="resume-special-section-add" hidden={Boolean(selectedId)}>
        <label className="field">
          <span>Weiteren Profilabschnitt hinzufügen</span>
          <select
            value={newKind}
            onChange={(event) =>
              setNewKind(event.target.value as ResumeSpecialSectionKind)
            }>
            {Object.entries(specialSectionLabels).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary small-button"
          type="button"
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                kind: newKind,
                title: specialSectionLabels[newKind],
                isVisible: true,
                entries: [],
              },
            ])
          }>
          <Plus size={15} /> Abschnitt hinzufügen
        </button>
      </div>

      {value
        .filter((item) => !selectedId || item.id === selectedId)
        .map((section) => (
          <details className="resume-data-group" key={section.id} open>
            <summary>
              {section.title || specialSectionLabels[section.kind]}
            </summary>
            {!selectedId && (
              <OrderControls
                index={value.findIndex((item) => item.id === section.id)}
                length={value.length}
                label={section.title}
                onMove={(target) =>
                  onChange(
                    moveListItem(
                      value,
                      value.findIndex((item) => item.id === section.id),
                      target,
                    ),
                  )
                }
              />
            )}
            <div className="resume-data-field-grid">
              <EditorInput
                label="Abschnittsüberschrift"
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
                  {Object.entries(specialSectionLabels).map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="checkbox-field" hidden={Boolean(selectedId)}>
              <input
                type="checkbox"
                checked={section.isVisible}
                onChange={(event) =>
                  updateSection(section.id, { isVisible: event.target.checked })
                }
              />
              <span>Im Lebenslauf anzeigen</span>
            </label>
            <div className="resume-data-list">
              {section.entries.map((entry, index) => (
                <article className="resume-data-card" key={entry.id}>
                  <OrderControls
                    index={index}
                    length={section.entries.length}
                    label={entry.title || "Eintrag"}
                    onMove={(target) =>
                      updateSection(section.id, {
                        entries: moveListItem(section.entries, index, target),
                      })
                    }
                  />
                  <div className="resume-data-card-heading">
                    <strong>{entry.title || "Neuer Eintrag"}</strong>
                    <button
                      className="icon-button danger"
                      type="button"
                      aria-label={`${section.title} Eintrag löschen`}
                      onClick={() =>
                        updateSection(section.id, {
                          entries: section.entries.filter(
                            (item) => item.id !== entry.id,
                          ),
                        })
                      }>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="resume-data-field-grid">
                    <EditorInput
                      label="Titel / Bezeichnung"
                      value={entry.title}
                      onChange={(title) =>
                        updateEntry(section.id, entry.id, { title })
                      }
                    />
                    <EditorInput
                      label="Rolle / Organisation / Zusatz"
                      value={entry.subtitle}
                      onChange={(subtitle) =>
                        updateEntry(section.id, entry.id, { subtitle })
                      }
                    />
                    <EditorInput
                      label="Von"
                      value={entry.from}
                      onChange={(from) =>
                        updateEntry(section.id, entry.id, { from })
                      }
                    />
                    <EditorInput
                      label="Bis"
                      value={entry.to}
                      onChange={(to) =>
                        updateEntry(section.id, entry.id, { to })
                      }
                    />
                    <EditorInput
                      label="Datum"
                      value={entry.date}
                      onChange={(date) =>
                        updateEntry(section.id, entry.id, { date })
                      }
                    />
                    <EditorInput
                      label="Ort"
                      value={entry.location}
                      onChange={(location) =>
                        updateEntry(section.id, entry.id, { location })
                      }
                    />
                    <EditorInput
                      label="Link / URL"
                      value={entry.url}
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
                  <div className="field">
                    <span>Details / Erfolge</span>
                    <EntryListEditor
                      values={entry.bullets}
                      multiline
                      addLabel="Punkt hinzufügen"
                      emptyText="Noch kein Punkt erfasst."
                      onChange={(bullets) =>
                        updateEntry(section.id, entry.id, {
                          bullets,
                        })
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
            <div className="resume-special-section-actions">
              <button
                className="button secondary small-button"
                type="button"
                onClick={() =>
                  updateSection(section.id, {
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
                  })
                }>
                <Plus size={15} /> Eintrag hinzufügen
              </button>
              <button
                className="button ghost danger"
                type="button"
                onClick={() =>
                  onChange(value.filter((item) => item.id !== section.id))
                }>
                <Trash2 size={15} /> Abschnitt löschen
              </button>
              <SectionUpdateButton onClick={onUpdate} />
            </div>
          </details>
        ))}
    </div>
  );
}
