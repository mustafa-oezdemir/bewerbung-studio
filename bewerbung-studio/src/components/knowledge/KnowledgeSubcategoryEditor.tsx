import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type {
  KnowledgeItem,
  KnowledgeSubcategory,
} from "../../features/knowledge/knowledge.types";
import {
  createKnowledgeItem,
} from "../../features/knowledge/knowledge.utils";
import { moveKnowledgeEntry } from "../../features/knowledge/knowledge.store";
import { KnowledgeDisplayModeSelector } from "./KnowledgeDisplayModeSelector";
import { KnowledgeItemEditor } from "./KnowledgeItemEditor";

export function KnowledgeSubcategoryEditor({
  subcategory,
  categoryTitle,
  showLevels,
  showYears,
  onChange,
  onRemove,
  onDragStart,
  onDrop,
}: {
  subcategory: KnowledgeSubcategory;
  categoryTitle: string;
  showLevels: boolean;
  showYears: boolean;
  onChange: (subcategory: KnowledgeSubcategory) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [draggedItemId, setDraggedItemId] = useState<string>();
  const updateItem = (item: KnowledgeItem) =>
    onChange({
      ...subcategory,
      items: subcategory.items.map((candidate) =>
        candidate.id === item.id ? item : candidate,
      ),
    });
  return (
    <section
      className={`knowledge-subcategory ${subcategory.isVisible ? "" : "hidden-entry"}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header>
        <span className="knowledge-drag-handle" title="Reihenfolge ändern">
          <GripVertical size={16} />
        </span>
        <label className="field">
          <span>Unterkategorie</span>
          <input
            value={subcategory.title}
            placeholder="Unterkategoriename"
            onChange={(event) =>
              onChange({ ...subcategory, title: event.target.value })
            }
          />
        </label>
        <KnowledgeDisplayModeSelector
          value={subcategory.displayMode}
          allowInherited
          onChange={(displayMode) =>
            onChange({ ...subcategory, displayMode })
          }
        />
        <button
          className="icon-button"
          type="button"
          title={subcategory.isVisible ? "Ausblenden" : "Einblenden"}
          onClick={() =>
            onChange({
              ...subcategory,
              isVisible: !subcategory.isVisible,
            })
          }
        >
          {subcategory.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        <button
          className="icon-button danger"
          type="button"
          aria-label="Unterkategorie löschen"
          onClick={() => {
            if (
              window.confirm(
                `Unterkategorie „${subcategory.title || "Ohne Titel"}“ löschen?`,
              )
            )
              onRemove();
          }}
        >
          <Trash2 size={16} />
        </button>
      </header>
      <div className="knowledge-item-list">
        {subcategory.items.map((item) => (
          <KnowledgeItemEditor
            key={item.id}
            item={item}
            categoryTitle={`${categoryTitle} ${subcategory.title}`}
            showLevels={showLevels}
            showYears={showYears}
            onChange={updateItem}
            onRemove={() =>
              onChange({
                ...subcategory,
                items: subcategory.items.filter(
                  (candidate) => candidate.id !== item.id,
                ),
              })
            }
            onDragStart={() => setDraggedItemId(item.id)}
            onDrop={() => {
              if (!draggedItemId) return;
              onChange({
                ...subcategory,
                items: moveKnowledgeEntry(
                  subcategory.items,
                  draggedItemId,
                  item.id,
                ),
              });
              setDraggedItemId(undefined);
            }}
          />
        ))}
      </div>
      <button
        className="button secondary small-button knowledge-add-item"
        type="button"
        onClick={() =>
          onChange({
            ...subcategory,
            items: [
              ...subcategory.items,
              createKnowledgeItem("", subcategory.items.length),
            ],
          })
        }
      >
        <Plus size={15} /> Kenntnis hinzufügen
      </button>
    </section>
  );
}
