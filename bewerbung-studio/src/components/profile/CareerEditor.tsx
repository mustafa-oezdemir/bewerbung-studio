import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useId, useState, type Dispatch, type SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  careerBulletRecommendation,
  countExperiencePoints,
  employmentTypeOptions,
  findCareerGaps,
  findUnreadableCareerDates,
  formatCareerOrganization,
  formatCareerPeriod,
  getBulletRange,
  isCurrentExperience,
  isLatestFirst,
  resolveExperience,
  resolveResumeCareerFieldVisibility,
  resumeCareerFieldKeys,
  resumeCareerFieldLabels,
  setExperienceCurrent,
  setExperienceEnd,
  sortExperiencesLatestFirst,
  type Experience,
} from "../../shared/resumeCareer";
import { moveListItem } from "../../shared/listOrder";
import { ChipListEditor } from "./ChipListEditor";
import { EntryListEditor } from "./EntryListEditor";
import { FlexibleDateField } from "./FlexibleDateField";
import { OrderControls } from "./OrderControls";
import { SectionTitleSelect } from "./SectionTitleSelect";

export const careerTitleOptions = [
  "Beruflicher Werdegang",
  "Berufserfahrung",
  "Berufliche Erfahrung",
  "Praxiserfahrung",
  "Berufspraxis",
  "Berufs- und Projekterfahrung",
] as const;

const legalFormSuggestions = ["GmbH", "AG", "UG (haftungsbeschränkt)", "GmbH & Co. KG", "KG", "OHG", "GbR", "e. K.", "SE", "gGmbH", "e. V."];

/** A new station is empty: nothing is filled in for the user. */
export const createExperience = (): Experience => ({
  id: crypto.randomUUID(),
  from: "",
  to: "",
  role: "",
  company: "",
  city: "",
  isCurrent: false,
  legalForm: "",
  employmentType: "",
  description: "",
  teamSize: "",
  compact: false,
  tasks: [],
  projects: [],
  technologies: [],
  achievements: [],
});

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;
const filled = (values: readonly string[]) => values.filter((value) => value.trim()).length;

/**
 * "5. Beruflicher Werdegang": the berufliche Stationen of `profile.experiences`, one card each. A card shows the
 * station in a few lines and opens into its sections (Zeitraum, Position & Arbeitgeber, Aufgaben, Projekte,
 * Technologien, Erfolge, Weitere Angaben). Tasks, projects, technologies and achievements stay separate lists.
 * The order is the user's: a new station goes on top (newest first), "Nach Datum sortieren" sorts once on request,
 * and nothing is ever sorted by itself. Guidance (3–6 points, gaps) only informs and never blocks a save.
 */
export function CareerEditor({
  profile,
  onChange,
  showTitle = true,
  defaultOpenId = null,
}: {
  profile: ApplicantProfile;
  onChange: Dispatch<SetStateAction<ApplicantProfile>>;
  /** The title select is shown where the editor stands alone (the profile); the section panel has its own. */
  showTitle?: boolean;
  /** The station whose card starts open. */
  defaultOpenId?: string | null;
}) {
  const id = useId();
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const stations = profile.experiences;
  const latestFirst = isLatestFirst(stations);
  const gaps = findCareerGaps(stations);
  const visibility = resolveResumeCareerFieldVisibility(profile.resumeCareerFieldVisibility);

  const setStations = (update: (current: Experience[]) => Experience[]) =>
    onChange((current) => ({ ...current, experiences: update(current.experiences) }));
  const change = (stationId: string, patch: Partial<Experience>) =>
    setStations((current) => current.map((item) => (item.id === stationId ? { ...item, ...patch } : item)));
  const add = () => {
    const station = createExperience();
    setStations((current) => [station, ...current]);
    setOpenId(station.id);
  };
  const dropOn = (targetId: string) => {
    if (!dragged || dragged === targetId) return;
    setStations((current) => {
      const from = current.findIndex((item) => item.id === dragged);
      const to = current.findIndex((item) => item.id === targetId);
      return from < 0 || to < 0 ? current : moveListItem(current, from, to);
    });
    setDragged(null);
  };

  return (
    <div className="career-editor">
      {showTitle ? (
        <SectionTitleSelect
          profile={profile}
          section="experience"
          options={careerTitleOptions}
          ariaLabel="Beruflicher Werdegang Überschrift"
          onChange={onChange}
        />
      ) : null}

      <div className="career-toolbar">
        <div className="career-sorting">
          <span className="career-sorting__label">Sortierung</span>
          <strong>{latestFirst ? "Neueste Station zuerst" : "Manuelle Reihenfolge"}</strong>
          {stations.length > 1 && !latestFirst ? (
            <button
              type="button"
              className="button tertiary small-button"
              onClick={() => setStations((current) => sortExperiencesLatestFirst(current))}>
              Nach Datum sortieren (neueste zuerst)
            </button>
          ) : null}
        </div>
        <button type="button" className="button secondary small-button" onClick={add}>
          <Plus size={15} aria-hidden="true" /> Station hinzufügen
        </button>
      </div>

      {gaps.map((gap) => (
        <p className="career-hint" key={`${gap.from}-${gap.to}`} role="note">
          <TriangleAlert size={13} aria-hidden="true" /> Hinweis: Zwischen {gap.from} und {gap.to} besteht eine zeitliche
          Lücke. Das ist nur ein Hinweis; fügen Sie bei Bedarf eine Station hinzu.
        </p>
      ))}

      <fieldset className="career-visibility">
        <legend>Im Lebenslauf anzeigen</legend>
        <div className="visibility-checkbox-grid">
          {resumeCareerFieldKeys.map((key) => (
            <label className="checkbox-field compact" key={key}>
              <input
                type="checkbox"
                checked={visibility[key]}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    resumeCareerFieldVisibility: {
                      ...resolveResumeCareerFieldVisibility(current.resumeCareerFieldVisibility),
                      [key]: event.target.checked,
                    },
                  }))
                }
              />
              <span>{resumeCareerFieldLabels[key]}</span>
            </label>
          ))}
        </div>
        <small className="field-hint">
          Das Ausblenden löscht nichts: die Angaben bleiben im Profil gespeichert.
        </small>
      </fieldset>

      <ol className="career-list">
        {stations.map((station, index) => {
          const resolved = resolveExperience(station);
          const open = openId === station.id;
          const panelId = `${id}-${station.id}`;
          const points = countExperiencePoints(station);
          const range = getBulletRange(points);
          const unreadable = findUnreadableCareerDates(station);
          const current = isCurrentExperience(station);
          const summary = [
            filled(station.tasks) ? count(filled(station.tasks), "Aufgabe", "Aufgaben") : "",
            filled(station.projects) ? count(filled(station.projects), "Projekt", "Projekte") : "",
            filled(station.technologies) ? count(filled(station.technologies), "Technologie", "Technologien") : "",
            filled(station.achievements) ? count(filled(station.achievements), "Erfolg", "Erfolge") : "",
          ].filter(Boolean);
          const field = (name: string) => `${panelId}-${name}`;
          return (
            <li
              className={`career-card${open ? " is-open" : ""}`}
              key={station.id}
              draggable
              onDragStart={() => setDragged(station.id)}
              onDragEnd={() => setDragged(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(station.id)}>
              <div className="career-card__head">
                <span className="drag-handle" title="Zum Sortieren ziehen" aria-hidden="true">
                  <GripVertical size={18} />
                </span>
                <div className="career-card__summary">
                  <strong>{resolved.role || "Neue Station"}</strong>
                  <span>{[resolved.organization, resolved.city].filter(Boolean).join(" · ") || "Unternehmen und Ort ergänzen"}</span>
                  <small>{resolved.period || "Zeitraum ergänzen"}</small>
                  {resolved.compact ? <small className="career-card__tag">Kompakt</small> : null}
                  {summary.length ? <small>{summary.join(" · ")}</small> : null}
                </div>
                <div className="career-card__actions">
                  <OrderControls
                    index={index}
                    length={stations.length}
                    label={resolved.role || `Station ${index + 1}`}
                    onMove={(target) => setStations((list) => moveListItem(list, index, target))}
                  />
                  <button
                    type="button"
                    className="button secondary small-button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenId(open ? null : station.id)}>
                    {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}{" "}
                    {open ? "Schließen" : "Bearbeiten"}
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={`${resolved.role || "Station"} löschen`}
                    onClick={() => setConfirmId(station.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {confirmId === station.id ? (
                <div className="career-confirm" role="alertdialog" aria-label="Station löschen">
                  <span>Station „{resolved.role || "Neue Station"}“ wirklich löschen?</span>
                  <button
                    type="button"
                    className="button small-button danger"
                    onClick={() => {
                      setStations((list) => list.filter((item) => item.id !== station.id));
                      setConfirmId(null);
                      if (openId === station.id) setOpenId(null);
                    }}>
                    Löschen
                  </button>
                  <button type="button" className="button tertiary small-button" onClick={() => setConfirmId(null)}>
                    Abbrechen
                  </button>
                </div>
              ) : null}

              {unreadable.map((value) => (
                <p className="career-hint" key={value} role="note">
                  <TriangleAlert size={13} aria-hidden="true" /> Das Datum „{value}“ kann nicht gelesen werden. Es bleibt
                  unverändert; für Sortierung und Lücken-Hinweis wird es nicht berücksichtigt.
                </p>
              ))}

              {open ? (
                <div className="career-card__body" id={panelId}>
                  <fieldset className="career-group">
                    <legend>1. Zeitraum</legend>
                    <div className="split-fields full">
                      <FlexibleDateField
                        id={field("from")}
                        label="Von *"
                        mode="month"
                        value={station.from}
                        onChange={(from) => change(station.id, { from })}
                      />
                      <FlexibleDateField
                        id={field("to")}
                        label="Bis"
                        mode="month"
                        value={current ? "heute" : station.to}
                        disabled={current}
                        onChange={(to) => setStations((list) => list.map((item) => (item.id === station.id ? setExperienceEnd(item, to) : item)))}
                      />
                    </div>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={current}
                        onChange={(event) =>
                          setStations((list) =>
                            list.map((item) => (item.id === station.id ? setExperienceCurrent(item, event.target.checked) : item)),
                          )
                        }
                      />
                      <span>Aktuelle Position</span>
                    </label>
                    <small className="field-hint">
                      Angezeigt als: {formatCareerPeriod(station.from, current ? "heute" : station.to) || "–"}
                    </small>
                  </fieldset>

                  <fieldset className="career-group">
                    <legend>2. Position &amp; Arbeitgeber</legend>
                    <div className="form-grid">
                      <div className={`field${resolved.role ? "" : " has-issue"}`}>
                        <label htmlFor={field("role")}>Position *</label>
                        <input id={field("role")} value={station.role} onChange={(event) => change(station.id, { role: event.target.value })} />
                      </div>
                      <div className={`field${resolved.company ? "" : " has-issue"}`}>
                        <label htmlFor={field("company")}>Unternehmen *</label>
                        <input id={field("company")} value={station.company} onChange={(event) => change(station.id, { company: event.target.value })} />
                      </div>
                      <div className="field">
                        <label htmlFor={field("legal")}>Rechtsform</label>
                        <input
                          id={field("legal")}
                          list={`${panelId}-legal-list`}
                          value={station.legalForm}
                          placeholder="z. B. GmbH"
                          onChange={(event) => change(station.id, { legalForm: event.target.value })}
                        />
                        <datalist id={`${panelId}-legal-list`}>
                          {legalFormSuggestions.map((form) => <option key={form} value={form} />)}
                        </datalist>
                        {station.legalForm.trim() && station.company.trim() ? (
                          <small className="field-hint">
                            Angezeigt als: {formatCareerOrganization(station.company, station.legalForm)}
                          </small>
                        ) : null}
                      </div>
                      <div className="field">
                        <label htmlFor={field("city")}>Ort</label>
                        <input id={field("city")} value={station.city} onChange={(event) => change(station.id, { city: event.target.value })} />
                      </div>
                      <div className="field full">
                        <label htmlFor={field("type")}>Beschäftigungsart</label>
                        <input
                          id={field("type")}
                          list={`${panelId}-type-list`}
                          value={station.employmentType}
                          placeholder="z. B. Vollzeit, Teilzeit · 20 Std./Woche"
                          onChange={(event) => change(station.id, { employmentType: event.target.value })}
                        />
                        <datalist id={`${panelId}-type-list`}>
                          {employmentTypeOptions.map((type) => <option key={type} value={type} />)}
                        </datalist>
                        <small className="field-hint">
                          Auch Zeiten wie Elternzeit oder Familienphase lassen sich hier als Station festhalten; Angaben
                          dazu sind freiwillig und bleiben knapp.
                        </small>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="career-group">
                    <legend>3. Aufgaben</legend>
                    <small className="field-hint">Relevante Aufgaben: konkret, relevant und aktiv formuliert.</small>
                    <EntryListEditor
                      values={station.tasks}
                      multiline
                      addLabel="Aufgabe hinzufügen"
                      emptyText="Noch keine Aufgabe erfasst."
                      placeholder="z. B. Schnittstellen entworfen und umgesetzt"
                      onChange={(tasks) => change(station.id, { tasks })}
                    />
                  </fieldset>

                  <fieldset className="career-group">
                    <legend>4. Projekte</legend>
                    <EntryListEditor
                      values={station.projects}
                      multiline
                      addLabel="Projekt hinzufügen"
                      emptyText="Noch kein Projekt erfasst."
                      placeholder="z. B. Einführung eines neuen Bestellportals"
                      onChange={(projects) => change(station.id, { projects })}
                    />
                  </fieldset>

                  <fieldset className="career-group">
                    <legend>5. Technologien / Werkzeuge</legend>
                    <ChipListEditor
                      label="Technologie"
                      values={station.technologies}
                      placeholder="z. B. PostgreSQL"
                      onChange={(technologies) => change(station.id, { technologies })}
                    />
                  </fieldset>

                  <fieldset className="career-group">
                    <legend>6. Erfolge</legend>
                    <small className="field-hint">
                      Wenn möglich mit Ergebnis. Hilfe: Problem → Aktion → Resultat, z. B. „Bestehenden Prozess
                      analysiert, automatisiert und Durchlaufzeit reduziert.“ Eine Zahl ist nicht nötig.
                    </small>
                    <EntryListEditor
                      values={station.achievements}
                      multiline
                      addLabel="Erfolg hinzufügen"
                      emptyText="Noch kein Erfolg erfasst."
                      placeholder="Nur Erfolge, die tatsächlich eingetreten sind"
                      onChange={(achievements) => change(station.id, { achievements })}
                    />
                  </fieldset>

                  <p className={`career-count${range === "many" ? " is-many" : ""}`} aria-live="polite">
                    {count(points, "Stichpunkt", "Stichpunkte")} · Empfohlen: {careerBulletRecommendation.min}–
                    {careerBulletRecommendation.max} relevante Punkte
                    {range === "many"
                      ? " – Für einen übersichtlichen Lebenslauf besser auf relevante Punkte konzentrieren."
                      : ""}
                  </p>

                  <details className="career-group career-more">
                    <summary>7. Weitere Angaben</summary>
                    <div className="field">
                      <label htmlFor={field("description")}>Kurze Beschreibung</label>
                      <textarea
                        id={field("description")}
                        rows={2}
                        value={station.description}
                        onChange={(event) => change(station.id, { description: event.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={field("team")}>Team / Verantwortung</label>
                      <input id={field("team")} value={station.teamSize} onChange={(event) => change(station.id, { teamSize: event.target.value })} />
                    </div>
                    <div className="field">
                      <span id={field("display")}>Darstellung im Lebenslauf</span>
                      <div className="career-display-options" role="radiogroup" aria-labelledby={field("display")}>
                        {([[false, "Ausführlich"], [true, "Kompakt"]] as const).map(([value, text]) => (
                          <label className={`photo-size-option${station.compact === value ? " is-selected" : ""}`} key={text}>
                            <input
                              type="radio"
                              name={field("display")}
                              checked={station.compact === value}
                              onChange={() => change(station.id, { compact: value })}
                            />
                            <span>{text}</span>
                          </label>
                        ))}
                      </div>
                      <small className="field-hint">
                        Kompakt zeigt nur Zeitraum, Position, Unternehmen und Ort. Die Details bleiben im Profil
                        gespeichert.
                      </small>
                    </div>
                  </details>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!stations.length ? <p className="entry-list-editor__empty">Noch keine Station erfasst.</p> : null}
    </div>
  );
}
