import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { OrderControls } from "../profile/OrderControls";
import { moveListItem } from "../../shared/listOrder";
import {
  createResumeBlockItem,
  rendererTypeLabels,
  type ResumeBlockRendererType,
} from "../../features/resume-sections/knowledge-block-registry";
import type { ResumeKnowledgeGroup } from "../../features/resume-sections/resume-section-system";

export function ManagedBlockEditor({
  group,
  onChange,
  onRemove,
}: {
  group: ResumeKnowledgeGroup;
  onChange: (change: Partial<ResumeKnowledgeGroup>) => void;
  onRemove?: () => void;
}) {
  const update = (
    id: string,
    change: Partial<ResumeKnowledgeGroup["items"][number]>,
  ) =>
    onChange({
      items: group.items.map((item) =>
        item.id === id ? { ...item, ...change } : item,
      ),
    });
  const move = (index: number, target: number) => {
    const items = moveListItem(group.items, index, target);
    onChange({ items: items.map((item, order) => ({ ...item, order })) });
  };
  return (
    <div className="manager-block-editor">
      <label className="field">
        <span>Darstellung</span>
        <select
          value={group.rendererType}
          onChange={(event) =>
            onChange({
              rendererType: event.target.value as ResumeBlockRendererType,
            })
          }>
          {Object.entries(rendererTypeLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {group.items.map((item, index) => (
        <div className="manager-block-item" key={item.id}>
          <input
            aria-label={`Punkt ${index + 1}`}
            placeholder="Inhalt"
            value={item.text}
            onChange={(event) => update(item.id, { text: event.target.value })}
          />
          <input
            aria-label={`Beschreibung ${index + 1}`}
            placeholder="Beschreibung"
            value={item.description}
            onChange={(event) =>
              update(item.id, { description: event.target.value })
            }
          />
          <div className="manager-item-actions">
            <button
              type="button"
              className="icon-button"
              aria-label={`Punkt ${item.visible ? "ausblenden" : "anzeigen"}`}
              aria-pressed={item.visible}
              onClick={() => update(item.id, { visible: !item.visible })}>
              {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <OrderControls
              index={index}
              length={group.items.length}
              label={`Punkt ${index + 1}`}
              onMove={(target) => move(index, target)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Punkt löschen"
              onClick={() =>
                onChange({
                  items: group.items.filter(
                    (candidate) => candidate.id !== item.id,
                  ),
                })
              }>
              <Trash2 size={14} />
            </button>
          </div>
          {["icon-list", "skill-level", "language-level"].includes(
            group.rendererType,
          ) && (
            <input
              aria-label={`Symbol oder Niveau ${index + 1}`}
              placeholder={
                group.rendererType === "icon-list"
                  ? "Symbol (z. B. →)"
                  : "Niveau (z. B. B2)"
              }
              value={
                group.rendererType === "icon-list" ? item.icon : item.level
              }
              onChange={(event) =>
                update(
                  item.id,
                  group.rendererType === "icon-list"
                    ? { icon: event.target.value }
                    : { level: event.target.value },
                )
              }
            />
          )}
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          onChange({
            items: [...group.items, createResumeBlockItem(group.items.length)],
          })
        }>
        <Plus size={14} /> Punkt hinzufügen
      </button>
      <label className="checkbox-field compact">
        <input
          type="checkbox"
          checked={group.pageBreakBefore}
          onChange={(event) =>
            onChange({ pageBreakBefore: event.target.checked })
          }
        />
        Seitenumbruch davor
      </label>
      {onRemove && (
        <button type="button" className="button tertiary" onClick={onRemove}>
          <Trash2 size={14} /> Bereich löschen
        </button>
      )}
    </div>
  );
}
