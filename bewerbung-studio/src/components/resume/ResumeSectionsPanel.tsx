import { ManagedBlockEditor } from "./ManagedBlockEditor";
import { ResumeHeadingEditor } from "./ResumeHeadingEditor";
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
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import type { SectionColumnMode } from "../../shared/documentDesign";
import {
  baseGroupType,
  getManagerSections,
  managerAllowedZones,
  managerZones,
  moveManagerSection,
  reorderManagerSection,
  updateManagerSection,
  type ManagerSection,
  type ManagerZone,
} from "../../features/resume-sections/resume-manager";
import { resolveKnowledgeGroups } from "../../features/resume-sections/resume-section-system";
import { resolveResumeLayout } from "../../shared/resumeLayoutEngine";
import {
  createKnowledgeBlock,
  resumeBlockRegistry,
} from "../../features/resume-sections/knowledge-block-registry";
import { normalizeResumeDataDraft, ResumeDataEditor } from "./ResumeDataEditor";
import { validateApplicantProfile } from "../../shared/profileEditor";
import { PersonalDataVisibility } from "./PersonalDataVisibility";
import { PersonalDataEditor } from "../profile/PersonalDataEditor";
import { SummaryEditor } from "../profile/SummaryEditor";
import { ClosingEditor } from "../profile/ClosingEditor";
import { PhotoSettingsEditor } from "../profile/PhotoSettingsEditor";
import { KnowledgeProfileEditor } from "../profile/KnowledgeProfileEditor";
import { InterestsEditor } from "../profile/InterestsEditor";

const noop = () => {};
type Props = {
  profile: ApplicantProfile;
  templateId: string;
  layoutMode?: "single" | "two-column";
  singlePageExceeded: boolean;
  onSave: (profile: ApplicantProfile) => Promise<void>;
  onPreview: (templateId: string, profile: ApplicantProfile | null) => void;
  /** Preserved, read-only text from a pre-migration Bewerbung. */
  legacySummary?: string;
  controlledDraft?: ApplicantProfile;
  onDraftChange?: Dispatch<SetStateAction<ApplicantProfile>>;
  onPickMedia?: (kind: "photo" | "signature") => void;
  onRemoveMedia?: (kind: "photo" | "signature") => void;
  closingPlacement?: "footer" | "main";
  closingAlignment?: "left" | "center" | "right" | "distributed";
  onClosingLayoutChange?: (key: "placement" | "alignment", value: "footer" | "main" | "left" | "center" | "right" | "distributed") => void;
  /** The card that starts opened (a card opens by click otherwise). */
  initialExpanded?: string;
  languagesColumns?: SectionColumnMode;
  onLanguagesColumnsChange?: (value: SectionColumnMode) => void;
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
  legacySummary,
  controlledDraft,
  onDraftChange,
  initialExpanded,
  languagesColumns,
  onLanguagesColumnsChange,
}: Props) {
  const [localDraft, setLocalDraft] = useState(profile);
  const draft = controlledDraft ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
  const [expanded, setExpanded] = useState<string | null>(initialExpanded ?? null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [newBlock, setNewBlock] = useState(resumeBlockRegistry[0].id);
  useEffect(() => {
    if (!controlledDraft) setLocalDraft(profile);
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
  // The effective layout decides the list: one column shows one order of all sections (their saved columns are
  // kept for a two-column layout), two columns show one list per column.
  const single = (layoutMode ?? resolveResumeLayout(templateId, undefined).mode) === "single";
  const zones = managerZones(templateId, single ? "single" : "two-column");
  const change = (id: string, update: { title?: string; visible?: boolean }) =>
    setDraft((current) =>
      updateManagerSection(current, templateId, id, update),
    );
  /** Moves a section to `index` of the list it is shown in: the whole order (one column) or the column `zone`. */
  const move = (id: string, zone: ManagerZone, index: number) =>
    setDraft((current) =>
      single
        ? reorderManagerSection(current, templateId, id, index)
        : moveManagerSection(current, templateId, id, zone, index),
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
    const issue = validateApplicantProfile(draft)[0];
    if (issue) { window.alert(issue.startsWith("personal:") ? "Bitte Pflichtangaben im Profil prüfen." : issue); return; }
    if (entries.some((entry) => !entry.title.trim())) {
      window.alert("Bitte jedem Abschnitt eine Überschrift geben.");
      return;
    }
    await onSave(normalizeResumeDataDraft(draft));
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
          <ResumeHeadingEditor
            profile={draft}
            onChange={setDraft}
            variant="compact"
          />
        )}
        {entry.id === "photo" && <PhotoSettingsEditor profile={draft} onChange={setDraft}
          onPick={() => onPickMedia?.("photo")} onRemove={() => onRemoveMedia?.("photo")} />}
        {entry.id === "personalData" && (
          <><PersonalDataEditor profile={draft} onChange={setDraft} showIssues={false} />
            <PersonalDataVisibility profile={draft} onChange={setDraft} /></>
        )}
        {entry.id === "closing" && (
          <>
            <ClosingEditor profile={draft} onChange={setDraft}
              onPickSignature={() => onPickMedia?.("signature")}
              onRemoveSignature={() => onRemoveMedia?.("signature")} />
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
          </>
        )}
        {entry.id === "summary" && (
          <><SummaryEditor profile={draft} onChange={setDraft} />
            {legacySummary?.trim() && legacySummary.trim() !== draft.summary.trim() ?
              <details className="legacy-summary"><summary>Früherer Bewerbungstext anzeigen</summary>
                <p>Dieser Text bleibt in der Bewerbung archiviert. Der Lebenslauf verwendet das gemeinsame Profil.</p>
                <blockquote>{legacySummary}</blockquote>
                <button type="button" className="button secondary small-button"
                  onClick={() => setDraft(current => ({ ...current, summary: legacySummary }))}>
                  In das Profil übernehmen
                </button>
              </details> : null}</>
        )}
        {entry.id === "projects" && (
          <p className="manager-hint">
            Das Projekt-Highlight wird aus den Projekten Ihrer Berufserfahrung
            übernommen. Bearbeiten Sie diese unter Berufserfahrung.
          </p>
        )}
        {entry.id === "knowledge" && <KnowledgeProfileEditor profile={draft} onChange={setDraft} />}
        {draft.specialSections.some((section) => `special:${section.id}` === entry.id && section.kind === "interests") &&
          <InterestsEditor profile={draft} onChange={setDraft} />}
        {!entry.id.startsWith("group:") &&
          !["heading", "personalData", "photo", "closing", "projects", "summary", "knowledge"].includes(
            entry.id,
          ) && !draft.specialSections.some((section) => `special:${section.id}` === entry.id && section.kind === "interests") && (
            <ResumeDataEditor
              profile={profile}
              controlledDraft={draft}
              onDraftChange={setDraft}
              section={entry.id}
              languagesColumns={languagesColumns}
              onLanguagesColumnsChange={entry.id === "languages" ? onLanguagesColumnsChange : undefined}
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
            aria-label={single
              ? `${entry.title} verschieben: Pfeil hoch oder runter für Reihenfolge`
              : `${entry.title} verschieben: Pfeil hoch oder runter für Reihenfolge, Pfeil links oder rechts für Spalte`}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" && index > 0) move(entry.id, entry.zone, index - 1);
              else if (event.key === "ArrowDown" && index < siblings.length - 1) move(entry.id, entry.zone, index + 1);
              else if (!single && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
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
        {entry.required ? (
          <span className="manager-required-badge" title="Pflichtbereich: kann nicht ausgeblendet werden">
            Pflicht
          </span>
        ) : (
          <button
            type="button"
            className="icon-button"
            aria-label={`${entry.title} ${entry.visible ? "ausblenden" : "anzeigen"}`}
            aria-pressed={entry.visible}
            onClick={() => change(entry.id, { visible: !entry.visible })}>
            {entry.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}
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
        {!entry.fixed && !single &&
          managerAllowedZones(templateId, entry.id).length > 1 && (
            <select
              aria-label={`${entry.title} Position`}
              value={entry.zone}
              onChange={(event) =>
                move(
                  entry.id,
                  event.target.value as ManagerZone,
                  entries.filter((item) => item.zone === event.target.value).length,
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
          {single && <small>Im einspaltigen Layout werden alle Bereiche in einer gemeinsamen Reihenfolge angeordnet.</small>}
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
      {single ? (
        <div
          className={`resume-section-zone${dropTarget === "zone:order" ? " is-drop-target" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDropTarget("zone:order"); }}
          onDrop={(event) => {
            event.preventDefault();
            const source = dragged || event.dataTransfer.getData("text/plain");
            if (source) move(source, "main", entries.filter((entry) => !entry.fixed).length - 1);
            setDragged(null);
            setDropTarget(null);
          }}>
          <span>Reihenfolge im Lebenslauf</span>
          <div className="resume-section-list">
            {entries.filter((entry) => !entry.fixed).map((entry, index, siblings) => card(entry, index, siblings))}
          </div>
        </div>
      ) : <div className="resume-section-zones">
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
      </div>}
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
