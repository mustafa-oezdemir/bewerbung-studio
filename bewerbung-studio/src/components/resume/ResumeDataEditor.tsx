import { resumeCustomContentLabels, type ResumeCustomContentType } from "../../shared/resumeCustomSectionTypes";
import { ChevronDown, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
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
} from "../../features/knowledge/knowledge.service";
import {
  type ApplicantProfile,
  type ResumeSpecialSectionKind,
} from "../../shared/schema";
import { KnowledgeSectionEditor } from "../knowledge/KnowledgeSectionEditor";
import { LanguageLevelEditor } from "../languages/LanguageLevelEditor";
import { LanguageDisplayOptions } from "../languages/LanguageDisplayOptions";
import type { SectionColumnMode } from "../../shared/documentDesign";
import {
  CertificateListEditor,
  EntryListEditor,
} from "../profile/EntryListEditor";
import { TechnologyIconPicker } from "../profile/TechnologyIconPicker";
import { CareerEditor } from "../profile/CareerEditor";
import { EducationEditor } from "../profile/EducationEditor";
import { normalizeApplicantProfileForSave, validateApplicantProfile } from "../../shared/profileEditor";
import { ProjectEntryEditor } from "./ProjectEntryEditor";
import { ResumeSpecialSectionPicker } from "./ResumeSpecialSectionPicker";
import {
  canAddResumeSpecialSection,
  createResumeSpecialSection,
  resumeSpecialSectionCatalog,
  resumeSpecialSectionLabel,
} from "../../shared/resumeSpecialSectionCatalog";

type Props = {
  profile: ApplicantProfile;
  onPreview: (profile: ApplicantProfile | null) => void;
  onSave: (profile: ApplicantProfile) => Promise<void>;
  defaultOpen?: boolean;
  section?: string;
  controlledDraft?: ApplicantProfile;
  onDraftChange?: Dispatch<SetStateAction<ApplicantProfile>>;
  languagesColumns?: SectionColumnMode;
  onLanguagesColumnsChange?: (value: SectionColumnMode) => void;
  /** The Bewerbung's choice of certificates, shown above the certificate list (Lebenslauf only). */
  certificateSelection?: ReactNode;
};

const cloneProfile = (profile: ApplicantProfile): ApplicantProfile => ({
  ...structuredClone(profile),
  knowledgeSection: ensureKnowledgeSection(
    profile.knowledgeSection,
    profile.skills,
  ),
});

export const normalizeResumeDataDraft = normalizeApplicantProfileForSave;

export function ResumeDataEditor({
  profile,
  onPreview,
  onSave,
  defaultOpen = false,
  section,
  controlledDraft,
  onDraftChange,
  languagesColumns = "auto",
  onLanguagesColumnsChange,
  certificateSelection,
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

  const reset = () => setDraft(cloneProfile(profile));

  const save = async () => {
    const issue = validateApplicantProfile(draft)[0];
    if (issue) {
      window.alert(issue.startsWith("personal:") ? "Bitte Pflichtangaben im Profil prüfen." : issue);
      return;
    }
    const normalized = normalizeResumeDataDraft(draft);
    setDraft(normalized);
    await onSave(normalized);
  };

  const updateSection = () => void save();
  /**
   * In a card of the Lebenslauf (`section`) the editor of that one section stands open: no second accordion, no other
   * section's editor, no title field of its own (the card names the section) and no extra save button (the draft is the
   * Bewerbung's, saved with „Änderungen speichern“). Standing alone it keeps its groups.
   */
  const inCard = Boolean(section);
  const group = (id: string, summary: ReactNode, body: ReactNode, update = true) => {
    if (section) return section === id ? <div className="resume-data-section" key={id}>{body}</div> : null;
    return (
      <details className="resume-data-group" key={id}>
        <summary>{summary}</summary>
        {body}
        {update ? <SectionUpdateButton onClick={updateSection} /> : null}
      </details>
    );
  };

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
          {!section ? (
            <p className="resume-data-editor-hint">
              Diese Daten gehören zum ausgewählten Profil und werden in allen
              damit verbundenen Bewerbungen verwendet.
            </p>
          ) : null}

          {group("strengths", draft.resumeSectionTitles.strengths, <>
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
            {!inCard ? (
              <ResumeSectionTitleEditor
                profile={draft}
                section="strengths"
                onChange={setDraft}
              />
            ) : null}
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
          </>)}

          {/* The same editors as in the profile (Profil → 5. and 6.); the title is managed by the panel. */}
          {group("experience", <span>{getResumeSectionTitle(draft, "experience")} ({draft.experiences.length})</span>,
            <CareerEditor profile={draft} onChange={setDraft} showTitle={false} />, false)}
          {group("education", <>{getResumeSectionTitle(draft, "education")} ({draft.education.length})</>,
            <EducationEditor profile={draft} onChange={setDraft} showTitle={false} />)}

          {group("knowledge", draft.knowledgeSection.title || "Kenntnisse",
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
            />)}

          {group("languages", draft.resumeSectionTitles.languages, <>
            {!inCard ? (
              <ResumeSectionTitleEditor
                profile={draft}
                section="languages"
                onChange={setDraft}
              />
            ) : null}
            <LanguageLevelEditor
              values={draft.languages}
              onChange={(languages) =>
                setDraft((current) => ({ ...current, languages }))
              }
            />
            <LanguageDisplayOptions profile={draft} onChange={setDraft} />
            {onLanguagesColumnsChange ? <label className="field">
              <span>Darstellung</span>
              <select aria-label="Sprachen – Spalten" value={languagesColumns}
                onChange={(event) => onLanguagesColumnsChange(event.target.value === "auto" ? "auto" : Number(event.target.value) as 1 | 2 | 3 | 4)}>
                <option value="auto">Automatisch</option>
                {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} {count === 1 ? "Spalte" : "Spalten"}</option>)}
              </select>
            </label> : null}
          </>)}

          {group("certifications", draft.resumeSectionTitles.certifications, <>
            {!inCard ? (
              <ResumeSectionTitleEditor
                profile={draft}
                section="certifications"
                onChange={setDraft}
              />
            ) : null}
            {certificateSelection}
            <CertificateListEditor
              profile={draft}
              onChange={(fields) =>
                setDraft((current) => ({ ...current, ...fields }))
              }
            />
          </>)}

          {!section || section.startsWith("special:") ? (
            <ResumeSpecialSectionsEditor
              selectedId={section?.slice(8)}
              value={draft.specialSections}
              onChange={(specialSections) =>
                setDraft((current) => ({ ...current, specialSections }))
              }
              onUpdate={controlledDraft ? undefined : updateSection}
            />
          ) : null}

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

export function ResumeSpecialSectionsEditor({
  selectedId,
  value,
  onChange,
  onUpdate,
}: {
  selectedId?: string;
  value: ApplicantProfile["specialSections"];
  onChange: (value: ApplicantProfile["specialSections"]) => void;
  /** Saves the section where the editor stands alone; a card of the Lebenslauf saves with the Bewerbung. */
  onUpdate?: () => void;
}) {
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
      {!selectedId && (
        <div className="resume-special-section-add">
          <ResumeSpecialSectionPicker
            title="Weiteren Profilabschnitt hinzufügen"
            sections={value}
            onAdd={(kind) => {
              if (canAddResumeSpecialSection(kind, value))
                onChange([...value, createResumeSpecialSection(kind)]);
            }}
          />
        </div>
      )}

      {value
        .filter((item) => !selectedId || item.id === selectedId)
        .map((section) => (
          // In its card of the Lebenslauf the section stands open; the list of all sections keeps one group each.
          <SpecialSectionGroup key={section.id} open={Boolean(selectedId)}
            summary={section.title || resumeSpecialSectionLabel(section.kind)}>
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
              {/* In a card the card's own title field names the section. */}
              {!selectedId ? <EditorInput
                label="Abschnittsüberschrift"
                value={section.title}
                onChange={(title) => updateSection(section.id, { title })}
              /> : null}
              {section.kind !== "projects" && <label className="field">
                <span>Inhaltstyp</span>
                <select value={section.contentType ?? ""} onChange={(event) => updateSection(section.id, { contentType: (event.target.value || undefined) as ResumeCustomContentType | undefined })}>
                  <option value="">Automatisch</option>
                  {Object.entries(resumeCustomContentLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                </select>
              </label>}
              {section.kind !== "projects" && <label className="field">
                <span>Bereichstyp</span>
                <select
                  value={section.kind}
                  onChange={(event) =>
                    updateSection(section.id, {
                      kind: event.target.value as ResumeSpecialSectionKind,
                    })
                  }>
                  {resumeSpecialSectionCatalog.map((option) => (
                    <option key={option.kind} value={option.kind}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>}
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
                  {section.kind === "projects" ? <ProjectEntryEditor entry={entry}
                    onChange={(change) => updateEntry(section.id, entry.id, change)} /> : <>
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
                  </>}
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
                        technologies: [],
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
              {onUpdate ? <SectionUpdateButton onClick={onUpdate} /> : null}
            </div>
          </SpecialSectionGroup>
        ))}
    </div>
  );
}

function SpecialSectionGroup({ open, summary, children }: { open: boolean; summary: string; children: ReactNode }) {
  return open
    ? <div className="resume-data-section">{children}</div>
    : <details className="resume-data-group"><summary>{summary}</summary>{children}</details>;
}
