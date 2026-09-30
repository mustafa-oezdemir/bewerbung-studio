import { ManagedBlockEditor } from "./ManagedBlockEditor";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  baseGroupType,
  getManagerSections,
  managerAllowedZones,
  managerZones,
  moveManagerSection,
  updateManagerSection,
  type ManagerSection,
  type ManagerZone,
} from "../../features/resume-sections/resume-manager";
import {
  defaultResumePersonalFieldVisibility,
  resolveKnowledgeGroups,
  resumePersonalFieldKeys,
  resumePersonalFieldLabels,
} from "../../features/resume-sections/resume-section-system";
import {
  createKnowledgeBlock,
  resumeBlockRegistry,
} from "../../features/resume-sections/knowledge-block-registry";
import { normalizeResumeDataDraft, ResumeDataEditor } from "./ResumeDataEditor";
import { validateKnowledgeSection } from "../../features/knowledge/knowledge.validation";
import { getProfileMediaSource } from "../../shared/profileMedia";
import { usesApplicationClosingDate } from "../../shared/resumeSectionPresentation";

const noop = () => {};
type Props = {
  profile: ApplicantProfile;
  templateId: string;
  layoutMode?: "single" | "two-column";
  singlePageExceeded: boolean;
  onSave: (profile: ApplicantProfile) => Promise<void>;
  onPreview: (templateId: string, profile: ApplicantProfile | null) => void;
  summaryValue?: string;
  onSummaryChange?: (value: string) => void;
  onPickMedia?: (kind: "photo" | "signature") => void;
  onRemoveMedia?: (kind: "photo" | "signature") => void;
  closingPlacement?: "footer" | "main";
  closingAlignment?: "left" | "center" | "right" | "distributed";
  onClosingLayoutChange?: (key: "placement" | "alignment", value: "footer" | "main" | "left" | "center" | "right" | "distributed") => void;
};

export function ResumeSectionsPanel({
  profile,
  templateId,
  layoutMode,
  singlePageExceeded,
  onSave,
  onPreview,
  onPickMedia,
  onRemoveMedia,
  closingPlacement,
  closingAlignment,
  onClosingLayoutChange,
  summaryValue,
  onSummaryChange,
}: Props) {
  const [draft, setDraft] = useState(profile);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [newBlock, setNewBlock] = useState(resumeBlockRegistry[0].id);
  useEffect(() => {
    setDraft(profile);
  }, [profile.id, profile.updatedAt]);
  useEffect(() => {
    onPreview(templateId, draft);
  }, [draft, onPreview, templateId]);
  useEffect(() => () => onPreview(templateId, null), [onPreview, templateId]);
  const entries = useMemo(
    () => getManagerSections(draft, templateId),
    [draft, templateId],
  );
  const groups = resolveKnowledgeGroups(
    templateId,
    draft.resumeKnowledgeGroups,
  );
  const zones = managerZones(templateId);
  const change = (id: string, update: { title?: string; visible?: boolean }) =>
    setDraft((current) =>
      updateManagerSection(current, templateId, id, update),
    );
  const move = (id: string, zone: ManagerZone, index: number) =>
    setDraft((current) =>
      moveManagerSection(current, templateId, id, zone, index),
    );
  const updateGroup = (id: string, update: Partial<(typeof groups)[number]>) =>
    setDraft((current) => ({
      ...current,
      resumeKnowledgeGroups: resolveKnowledgeGroups(
        templateId,
        current.resumeKnowledgeGroups,
      ).map((group) => (group.id === id ? { ...group, ...update } : group)),
    }));
  const save = async () => {
    const issues = validateKnowledgeSection(draft.knowledgeSection);
    if (issues.length) {
      window.alert(issues[0].message);
      return;
    }
    if (entries.some((entry) => !entry.title.trim())) {
      window.alert("Bitte jedem Abschnitt eine Überschrift geben.");
      return;
    }
    await onSave(normalizeResumeDataDraft(draft));
  };
  const media = (kind: "photo" | "signature") => {
    const source = getProfileMediaSource(
      kind === "photo" ? draft.photoPath : draft.signaturePath,
    );
    return (
      <div className="manager-media">
        {source && (
          <img
            src={source}
            alt={kind === "photo" ? "Bewerbungsfoto" : "Unterschrift"}
          />
        )}
        <button
          type="button"
          className="button secondary"
          onClick={() => onPickMedia?.(kind)}>
          Bild auswählen
        </button>
        {source && (
          <button
            type="button"
            className="button tertiary"
            onClick={() => onRemoveMedia?.(kind)}>
            Bild entfernen
          </button>
        )}
      </div>
    );
  };
  const content = (entry: ManagerSection) => {
    const group = groups.find((item) => item.id === entry.groupId);
    return (
      <div className="manager-card-body">
        {!["heading", "photo", "closing", "personalData"].includes(
          entry.id,
        ) && (
          <label className="field">
            <span>Abschnittsüberschrift</span>
            <input
              aria-label={`${entry.title} Überschrift`}
              value={entry.title}
              onChange={(event) =>
                change(entry.id, { title: event.target.value })
              }
            />
          </label>
        )}
        {entry.id === "heading" && (
          <div className="resume-data-field-grid">
            {(
              [
                ["firstName", "Vorname"],
                ["lastName", "Nachname"],
                ["title", "Berufsbezeichnung"],
              ] as const
            ).map(([key, label]) => (
              <label className="field" key={key}>
                <span>{label}</span>
                <input
                  value={draft[key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        )}
        {entry.id === "photo" && media("photo")}
        {entry.id === "personalData" && (
          <>
            <div className="visibility-checkbox-grid">
              {resumePersonalFieldKeys.map((key) => (
                <label className="checkbox-field compact" key={key}>
                  <input
                    type="checkbox"
                    checked={draft.resumePersonalFieldVisibility[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        resumePersonalFieldVisibility: {
                          ...defaultResumePersonalFieldVisibility,
                          ...current.resumePersonalFieldVisibility,
                          [key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>{resumePersonalFieldLabels[key]}</span>
                </label>
              ))}
            </div>
          </>
        )}
        {entry.id === "closing" && (
          <>
            <div className="resume-data-field-grid">
              {(
                [
                  ["applicationPlace", "Ort"],
                  ["applicationDate", "Datum"],
                ] as const
              ).map(([key, label]) => {
                // Some templates print the date of the application (like the Anschreiben), not a date typed here.
                const fromApplication = key === "applicationDate" && usesApplicationClosingDate(templateId);
                return (
                  <label className="field" key={key}>
                    <span>{fromApplication ? "Datum (Bewerbungsdatum)" : label}</span>
                    <input
                      type={key === "applicationDate" ? "date" : "text"}
                      value={fromApplication ? "" : draft[key]}
                      disabled={fromApplication}
                      title={fromApplication ? "Das Datum stammt aus dem Bewerbungsdatum, wie im Anschreiben." : undefined}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            <div className="visibility-checkbox-grid">
              {(
                [
                  ["showPlace", "Ort"],
                  ["showDate", "Datum"],
                  ["showSignature", "Unterschrift"],
                ] as const
              ).map(([key, label]) => (
                <label className="checkbox-field compact" key={key}>
                  <input
                    type="checkbox"
                    checked={draft.resumeClosing[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        resumeClosing: {
                          ...current.resumeClosing,
                          [key]: event.target.checked,
                        },
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="resume-data-field-grid">
              <label className="field">
                <span>Platzierung</span>
                <select aria-label="Abschluss Platzierung" value={closingPlacement ?? "footer"}
                  onChange={(event) => onClosingLayoutChange?.("placement", event.target.value as "footer" | "main")}>
                  <option value="footer">Footer</option>
                  <option value="main">Hauptspalte</option>
                </select>
              </label>
              <label className="field">
                <span>Ausrichtung</span>
                <select aria-label="Abschluss Ausrichtung" value={closingAlignment ?? "left"}
                  onChange={(event) => onClosingLayoutChange?.("alignment", event.target.value as "left" | "center" | "right" | "distributed")}>
                  <option value="left">Links</option>
                  <option value="center">Mitte</option>
                  <option value="right">Rechts</option>
                  <option value="distributed">Verteilt</option>
                </select>
              </label>
            </div>
            {media("signature")}
          </>
        )}
        {entry.id === "summary" && (
          <label className="field">
            <span>Kurzprofil</span>
            <textarea
              rows={6}
              value={summaryValue || draft.summary}
              onChange={(event) => {
                const summary = event.target.value;
                setDraft((current) => ({ ...current, summary }));
                onSummaryChange?.(summary);
              }}
            />
          </label>
        )}
        {entry.id === "projects" && (
          <p className="manager-hint">
            Das Projekt-Highlight wird aus den Projekten Ihrer Berufserfahrung
            übernommen. Bearbeiten Sie diese unter Berufserfahrung.
          </p>
        )}
        {!entry.id.startsWith("group:") &&
          !["heading", "photo", "closing", "projects", "summary"].includes(
            entry.id,
          ) && (
            <ResumeDataEditor
              profile={profile}
              controlledDraft={draft}
              onDraftChange={setDraft}
              section={entry.id}
              onPreview={noop}
              onSave={onSave}
            />
          )}
        {group && (
          <details
            className="manager-block-details"
            open={entry.id.startsWith("group:") || undefined}>
            <summary>
              Eigene Inhalte für diesen Bereich
              {group.items.length ? ` (${group.items.length})` : ""}
            </summary>
            <p className="manager-hint">
              Eigene Inhalte ersetzen die Profilinhalte dieses Bereichs. Ohne
              eigene Inhalte werden die Profildaten verwendet.
            </p>
            <ManagedBlockEditor
              group={group}
              onChange={(update) => updateGroup(group.id, update)}
              onRemove={
                entry.id.startsWith("group:")
                  ? () =>
                      setDraft((current) => ({
                        ...current,
                        resumeKnowledgeGroups: resolveKnowledgeGroups(
                          templateId,
                          current.resumeKnowledgeGroups,
                        ).filter((item) => item.id !== group.id),
                      }))
                  : undefined
              }
            />
          </details>
        )}
      </div>
    );
  };
  const card = (
    entry: ManagerSection,
    index: number,
    siblings: ManagerSection[],
  ) => (
    <article
      key={entry.id}
      className={`manager-card${entry.visible ? "" : " is-hidden"}${dropTarget === entry.id ? " is-drop-target" : ""}`}
      draggable={!entry.fixed}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", entry.id);
        event.dataTransfer.effectAllowed = "move";
        setDragged(entry.id);
      }}
      onDragEnd={() => { setDragged(null); setDropTarget(null); }}
      onDragOver={(event) => {
        if (entry.fixed) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setDropTarget(entry.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const source = dragged || event.dataTransfer.getData("text/plain");
        if (source && source !== entry.id && !entry.fixed) {
          const after = event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2;
          const sourceIndex = siblings.findIndex((item) => item.id === source);
          const insertion = index + Number(after);
          move(source, entry.zone, sourceIndex >= 0 && sourceIndex < insertion ? insertion - 1 : insertion);
        }
        setDragged(null);
        setDropTarget(null);
      }}>
      <div className="resume-section-card">
        {entry.fixed ? <GripVertical size={16} aria-hidden="true" /> : (
          <button type="button" className="manager-drag-handle"
            aria-label={`${entry.title} verschieben: Pfeil hoch oder runter für Reihenfolge, Pfeil links oder rechts für Spalte`}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" && index > 0) move(entry.id, entry.zone, index - 1);
              else if (event.key === "ArrowDown" && index < siblings.length - 1) move(entry.id, entry.zone, index + 1);
              else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                const zone = event.key === "ArrowLeft" ? "main" : "sidebar";
                if (zone !== entry.zone) move(entry.id, zone, entries.filter((item) => !item.fixed && item.zone === zone).length);
                else return;
              } else return;
              event.preventDefault();
            }}>
            <GripVertical size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="manager-card-title"
          aria-expanded={expanded === entry.id}
          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
          {entry.title}
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`${entry.title} ${entry.visible ? "ausblenden" : "anzeigen"}`}
          aria-pressed={entry.visible}
          onClick={() => change(entry.id, { visible: !entry.visible })}>
          {entry.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        {!entry.fixed && (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label={`${entry.title} nach oben`}
              disabled={index === 0}
              onClick={() => move(entry.id, entry.zone, index - 1)}>
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={`${entry.title} nach unten`}
              disabled={index === siblings.length - 1}
              onClick={() => move(entry.id, entry.zone, index + 1)}>
              <ArrowDown size={16} />
            </button>
          </>
        )}
        {!entry.fixed &&
          managerAllowedZones(templateId, entry.id).length > 1 && (
            <select
              aria-label={`${entry.title} Position`}
              value={entry.zone}
              onChange={(event) =>
                move(
                  entry.id,
                  event.target.value as ManagerZone,
                  entries.filter((item) => item.zone === event.target.value)
                    .length,
                )
              }>
              {managerAllowedZones(templateId, entry.id).map((zone) => (
                <option key={zone} value={zone}>
                  {zone === "main" ? "Hauptspalte" : "Seitenspalte"}
                </option>
              ))}
            </select>
          )}
      </div>
      {expanded === entry.id && content(entry)}
    </article>
  );
  return (
    <section
      className="resume-sections-panel resume-manager"
      aria-label="Abschnitte neu ordnen">
      <div className="resume-sections-heading">
        <div>
          <strong>Abschnitte neu ordnen</strong>
          <small>
            Bereiche ziehen oder am Griff mit den Pfeiltasten verschieben.
            Mit dem Auge ein- oder ausblenden; Titel öffnen die Inhalte.
          </small>
          {layoutMode === "single" && <small>Im einspaltigen Layout erscheinen beide Gruppen in einer Spalte.</small>}
        </div>
      </div>
      <div className="resume-section-zone">
        <span>Kopf, persönliche Daten und Abschluss</span>
        <div className="resume-section-list">
          {entries
            .filter((entry) => entry.fixed)
            .map((entry, index, siblings) => card(entry, index, siblings))}
        </div>
      </div>
      <div className="resume-section-zones">
        {zones.map((zone) => {
          const siblings = entries.filter(
            (entry) => !entry.fixed && entry.zone === zone,
          );
          return (
            <div
              className={`resume-section-zone${dropTarget === `zone:${zone}` ? " is-drop-target" : ""}`}
              key={zone}
              onDragOver={(event) => { event.preventDefault(); setDropTarget(`zone:${zone}`); }}
              onDrop={(event) => {
                event.preventDefault();
                const source = dragged || event.dataTransfer.getData("text/plain");
                if (source) move(source, zone, siblings.length);
                setDragged(null);
                setDropTarget(null);
              }}>
              <span>{zone === "main" ? "Hauptspalte" : "Seitenspalte"}</span>
              <div className="resume-section-list">
                {siblings.map((entry, index) => card(entry, index, siblings))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="manager-add">
        <label className="field">
          <span>Weiteren Bereich hinzufügen</span>
          <select
            value={newBlock}
            onChange={(event) => setNewBlock(event.target.value)}>
            {resumeBlockRegistry.map((block) => (
              <option key={block.id} value={block.id}>
                {block.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            const definition = resumeBlockRegistry.find(
              (item) => item.id === newBlock,
            )!;
            const base = baseGroupType(definition.id);
            const existing = groups.find(
              (item) =>
                item.semanticType === definition.id ||
                (base && baseGroupType(item.semanticType) === base),
            );
            if (existing) {
              setExpanded(base ?? `group:${existing.id}`);
              return;
            }
            const block = createKnowledgeBlock(
              templateId,
              definition,
              groups.length,
            );
            setDraft((current) => ({
              ...current,
              resumeKnowledgeGroups: [
                ...resolveKnowledgeGroups(
                  templateId,
                  current.resumeKnowledgeGroups,
                ),
                block,
              ],
            }));
            setExpanded(base ?? `group:${block.id}`);
          }}>
          <Plus size={15} /> Bereich hinzufügen
        </button>
      </div>
      {singlePageExceeded && (
        <p className="resume-sections-warning">
          Der Lebenslauf umfasst mehr als eine Seite. Prüfen Sie die Vorschau
          nach dem Verschieben.
        </p>
      )}
      <div className="resume-section-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              resumeManagerLayouts: {
                ...current.resumeManagerLayouts,
                [templateId]: [],
              },
              resumeSectionLayout: [],
              resumeSectionLayouts: {
                ...current.resumeSectionLayouts,
                [templateId]: [],
              },
            }))
          }>
          <RotateCcw size={15} /> Reihenfolge zurücksetzen
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setDraft(profile)}>
          Verwerfen
        </button>
        <button type="button" className="button" onClick={() => void save()}>
          Änderungen übernehmen
        </button>
      </div>
    </section>
  );
}
