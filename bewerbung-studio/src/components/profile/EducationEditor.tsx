import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { useId, useState, type Dispatch, type SetStateAction } from "react";
import { moveListItem } from "../../shared/listOrder";
import {
  createEducation, educationStatusOptions, educationTypeOptions, resolveEducationPresentation,
  resolveResumeEducationFieldVisibility, resumeEducationFieldKeys, resumeEducationFieldLabels, setResumeEducationFieldVisible,
  sortEducationLatestFirst, type Education,
} from "../../shared/resumeEducation";
import type { ApplicantProfile } from "../../shared/schema";
import { FlexibleDateField } from "./FlexibleDateField";
import { OrderControls } from "./OrderControls";
import { SectionTitleSelect } from "./SectionTitleSelect";

const titleOptions = ["Bildungsweg", "Ausbildung", "Schulbildung", "Berufsausbildung", "Studium"];

export function EducationEditor({ profile, onChange, showTitle = true }: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  showTitle?: boolean;
}) {
  const id = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const visibility = resolveResumeEducationFieldVisibility(profile.resumeEducationFieldVisibility);
  const update = (fn: (entries: Education[]) => Education[]) =>
    onChange((current) => ({ ...current, education: fn(current.education) }));
  const change = (entryId: string, patch: Partial<Education>) =>
    update((entries) => entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry));
  const add = () => {
    const entry = createEducation();
    update((entries) => [entry, ...entries]);
    setOpenId(entry.id);
  };
  const drop = (targetId: string) => {
    if (!dragged || dragged === targetId) return;
    update((entries) => {
      const from = entries.findIndex((entry) => entry.id === dragged);
      const to = entries.findIndex((entry) => entry.id === targetId);
      return from < 0 || to < 0 ? entries : moveListItem(entries, from, to);
    });
    setDragged(null);
  };
  const input = (entry: Education, label: string, key: keyof Education, required = false) => (
    <label className="field" key={key}>
      <span>{label}{required ? " *" : ""}</span>
      <input value={entry[key]} onChange={(event) => change(entry.id, { [key]: event.target.value })} />
    </label>
  );
  return (
    <div className="career-editor education-editor">
      {showTitle ? <SectionTitleSelect profile={profile} section="education" options={titleOptions}
        ariaLabel="Bildungsweg Überschrift" onChange={onChange} /> : null}
      <div className="career-toolbar">
        <div className="career-sorting">
          <span className="career-sorting__label">Sortierung</span>
          <strong>Manuelle Reihenfolge · neueste Station zuerst empfohlen</strong>
          {profile.education.length > 1 ? <button type="button" className="button tertiary small-button"
            onClick={() => update(sortEducationLatestFirst)}>Nach Datum sortieren (neueste zuerst)</button> : null}
        </div>
        <button type="button" className="button secondary small-button" onClick={add}>
          <Plus size={15} aria-hidden="true" /> Bildungsstation hinzufügen
        </button>
      </div>
      <fieldset className="career-visibility">
        <legend>Im Lebenslauf anzeigen</legend>
        <div className="visibility-checkbox-grid">
          {resumeEducationFieldKeys.map((key) => (
            <label className="checkbox-field compact" key={key}>
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={(event) => {
                  const visible = event.target.checked;
                  onChange((current) => setResumeEducationFieldVisible(current, key, visible));
                }}
              />
              <span>{resumeEducationFieldLabels[key]}</span>
            </label>
          ))}
        </div>
        <small className="field-hint">
          Abschluss, Einrichtung, Ort und Zeitraum stehen immer im Lebenslauf. Das Ausblenden löscht nichts: die Angaben
          bleiben im Profil gespeichert.
        </small>
      </fieldset>
      <ol className="career-list">
        {profile.education.map((entry, index) => {
          const view = resolveEducationPresentation(entry);
          const open = openId === entry.id;
          const panelId = `${id}-${entry.id}`;
          const current = view.to === "heute";
          const missing = [entry.from, entry.to, entry.institution, entry.city,
            ...(view.incomplete ? [] : [entry.degree])].filter((value) => !value.trim()).length;
          return <li key={entry.id} className={`career-card${open ? " is-open" : ""}`} draggable
            onDragStart={() => setDragged(entry.id)} onDragEnd={() => setDragged(null)}
            onDragOver={(event) => event.preventDefault()} onDrop={() => drop(entry.id)}>
            <div className="career-card__head">
              <span className="drag-handle" title="Zum Sortieren ziehen" aria-hidden="true"><GripVertical size={18} /></span>
              <div className="career-card__summary">
                <strong>{view.title || "Neue Bildungsstation"}</strong>
                <span>{[view.institution, view.location].filter(Boolean).join(" · ") || "Bildungseinrichtung und Ort ergänzen"}</span>
                <small>{view.dateRange || "Zeitraum ergänzen"}</small>
                {[view.type, view.status].filter(Boolean).length ? <small>{[view.type, view.status].filter(Boolean).join(" · ")}</small> : null}
                {missing ? <small className="field-hint">{missing} Pflichtangabe{missing === 1 ? "" : "n"} ergänzen</small> : null}
              </div>
              <div className="career-card__actions">
                <OrderControls index={index} length={profile.education.length} label={view.title || `Bildungsstation ${index + 1}`}
                  onMove={(target) => update((entries) => moveListItem(entries, index, target))} />
                <button type="button" className="button secondary small-button" aria-expanded={open} aria-controls={panelId}
                  onClick={() => setOpenId(open ? null : entry.id)}>
                  {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {open ? "Schließen" : "Bearbeiten"}
                </button>
                <button type="button" className="icon-button danger" aria-label={`${view.title || "Bildungsstation"} löschen`}
                  onClick={() => setConfirmId(entry.id)}><Trash2 size={15} /></button>
              </div>
            </div>
            {confirmId === entry.id ? <div className="career-confirm" role="alertdialog" aria-label="Bildungsstation löschen">
              <span>Bildungsstation wirklich löschen?</span>
              <button type="button" className="button small-button danger" onClick={() => {
                update((entries) => entries.filter((item) => item.id !== entry.id));
                setConfirmId(null); if (openId === entry.id) setOpenId(null);
              }}>Löschen</button>
              <button type="button" className="button tertiary small-button" onClick={() => setConfirmId(null)}>Abbrechen</button>
            </div> : null}
            {open ? <div className="career-card__body" id={panelId}>
              <fieldset className="career-group"><legend>Zeitraum</legend>
                <div className="split-fields full">
                  <FlexibleDateField label="Von *" value={entry.from} mode="month" onChange={(from) => change(entry.id, { from })} />
                  <FlexibleDateField label="Bis / heute *" value={current ? "heute" : entry.to} mode="month"
                    disabled={current} onChange={(to) => change(entry.id, { to })} />
                </div>
                <label className="checkbox-field"><input type="checkbox" checked={current} onChange={(event) =>
                  change(entry.id, { to: event.target.checked ? "heute" : "", status: event.target.checked ? "Laufend" : entry.status === "Laufend" ? "" : entry.status })} />
                  <span>Laufende Ausbildung / laufendes Studium</span></label>
              </fieldset>
              <fieldset className="career-group"><legend>Abschluss und Einrichtung</legend>
                <div className="form-grid">
                  <label className="field"><span>Art der Ausbildung</span>
                    <input list={`${id}-education-types`} value={entry.type} onChange={(event) => change(entry.id, { type: event.target.value })} />
                  </label>
                  {input(entry, "Abschluss / angestrebter Abschluss", "degree", true)}
                  {input(entry, "Bildungseinrichtung", "institution", true)}
                  {input(entry, "Fachrichtung / Schwerpunkt", "fieldOfStudy")}
                </div>
                {view.incomplete ? <small className="field-hint">Ohne Abschluss: Im Lebenslauf wird keine erworbene Abschlussbezeichnung behauptet.</small> : null}
              </fieldset>
              <fieldset className="career-group"><legend>Ort und weitere Angaben</legend>
                <div className="form-grid">
                  {input(entry, "Ort", "city", true)}
                  {input(entry, "Land", "country")}
                  <label className="field"><span>Status</span>
                    <input list={`${id}-education-status`} value={entry.status} onChange={(event) => {
                      const status = event.target.value;
                      change(entry.id, { status,
                        ...(/^laufend$/i.test(status) ? { to: "heute" }
                          : entry.to === "heute" && /^laufend$/i.test(entry.status) ? { to: "" } : {}),
                      });
                    }} />
                  </label>
                  {input(entry, "Abschlussnote", "grade")}
                </div>
                <label className="field"><span>Weitere relevante Angaben</span>
                  <textarea rows={3} value={entry.description} onChange={(event) => change(entry.id, { description: event.target.value })} />
                </label>
              </fieldset>
            </div> : null}
          </li>;
        })}
      </ol>
      {!profile.education.length ? <p className="editor-empty">Noch kein Bildungsweg erfasst.</p> : null}
      <datalist id={`${id}-education-types`}>{educationTypeOptions.map((option) => <option key={option} value={option} />)}</datalist>
      <datalist id={`${id}-education-status`}>{educationStatusOptions.map((option) => <option key={option} value={option} />)}</datalist>
    </div>
  );
}
