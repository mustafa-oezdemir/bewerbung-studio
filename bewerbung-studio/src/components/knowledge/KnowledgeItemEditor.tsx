import { TechnologyIconPicker } from "../profile/TechnologyIconPicker";
import { Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import type { KnowledgeItem } from "../../features/knowledge/knowledge.types";
import { KnowledgeAutocomplete } from "./KnowledgeAutocomplete";
import { KnowledgeLevelSelector } from "./KnowledgeLevelSelector";

export function KnowledgeItemEditor({
  item,
  categoryTitle,
  showLevels,
  showYears,
  onChange,
  onRemove,
  onDragStart,
  onDrop,
}: {
  item: KnowledgeItem;
  categoryTitle: string;
  showLevels: boolean;
  showYears: boolean;
  onChange: (item: KnowledgeItem) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  return (
    <article
      className={`knowledge-item-editor ${item.isVisible ? "" : "hidden-entry"}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <span className="knowledge-drag-handle" title="Reihenfolge ändern">
        <GripVertical size={16} />
      </span>
      <div className="knowledge-item-fields">
        <KnowledgeAutocomplete
          categoryTitle={categoryTitle}
          value={item.name}
          onChange={(name) => onChange({ ...item, name })}
        />
        <details className="knowledge-description-field">
          <summary>Icon: {item.iconId ? "Manuell" : "Automatisch"}</summary>
          <TechnologyIconPicker technologyTitle={item.name} value={item.iconId ?? ""}
            onChange={(iconId) => onChange({ ...item, iconId })} />
        </details>
        {showLevels ? (
          <KnowledgeLevelSelector
            value={item.level}
            onChange={(level) => onChange({ ...item, level })}
          />
        ) : null}
        {showYears ? (
          <label className="field">
            <span>Erfahrung in Jahren</span>
            <input
              type="number"
              min="0"
              max="80"
              step="0.5"
              value={item.yearsOfExperience ?? ""}
              onChange={(event) =>
                onChange({
                  ...item,
                  yearsOfExperience: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </label>
        ) : null}
        <label className="field">
          <span>Zuletzt verwendet</span>
          <input
            type="number"
            min="1900"
            max="2200"
            placeholder="z. B. 2026"
            value={item.lastUsedYear ?? ""}
            onChange={(event) =>
              onChange({
                ...item,
                lastUsedYear: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              })
            }
          />
        </label>
        <label className="field knowledge-description-field">
          <span>Optionale Beschreibung</span>
          <input
            value={item.description ?? ""}
            onChange={(event) =>
              onChange({ ...item, description: event.target.value })
            }
          />
        </label>
      </div>
      <div className="knowledge-item-actions">
        <button
          className="icon-button"
          type="button"
          title={item.isVisible ? "Ausblenden" : "Einblenden"}
          onClick={() => onChange({ ...item, isVisible: !item.isVisible })}
        >
          {item.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          className="icon-button danger"
          type="button"
          aria-label="Kenntnis löschen"
          onClick={() => {
            if (
              window.confirm(
                `Kenntnis „${item.name || "Ohne Namen"}“ löschen?`,
              )
            )
              onRemove();
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
