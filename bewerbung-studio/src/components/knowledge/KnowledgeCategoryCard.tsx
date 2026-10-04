import {
  Copy,
  Eye,
  EyeOff,
  FolderInput,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  knowledgeCategoryTypeLabels,
} from "../../features/knowledge/knowledge.constants";
import { moveKnowledgeEntry } from "../../features/knowledge/knowledge.store";
import {
  knowledgeCategoryTypes,
  type KnowledgeCategory,
  type KnowledgeItem,
} from "../../features/knowledge/knowledge.types";
import {
  createKnowledgeItem,
} from "../../features/knowledge/knowledge.utils";
import { KnowledgeDisplayModeSelector } from "./KnowledgeDisplayModeSelector";
import { KnowledgeItemEditor } from "./KnowledgeItemEditor";
import { KnowledgeSubcategoryEditor } from "./KnowledgeSubcategoryEditor";

export function KnowledgeCategoryCard({
  category,
  onChange,
  onRemove,
  onDuplicate,
  onCopy,
  onDragStart,
  onDrop,
}: {
  category: KnowledgeCategory;
  onChange: (category: KnowledgeCategory) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onCopy?: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [draggedItemId, setDraggedItemId] = useState<string>();
  const [draggedSubcategoryId, setDraggedSubcategoryId] =
    useState<string>();
  const updateItem = (item: KnowledgeItem) =>
    onChange({
      ...category,
      items: category.items.map((candidate) =>
        candidate.id === item.id ? item : candidate,
      ),
    });
  return (
    <article
      className={`knowledge-category-card ${category.isVisible ? "" : "hidden-entry"}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <header className="knowledge-category-header">
        <span className="knowledge-drag-handle" title="Reihenfolge ändern">
          <GripVertical size={18} />
        </span>
        <div>
          <strong>{category.title || "Neue Kategorie"}</strong>
          <small>
            {category.items.length} Kenntnisse ·{" "}
            {category.subcategories.length} Unterkategorien
          </small>
        </div>
        <div className="knowledge-category-actions">
          <button
            className="icon-button"
            type="button"
            title={category.isVisible ? "Ausblenden" : "Einblenden"}
            onClick={() =>
              onChange({ ...category, isVisible: !category.isVisible })
            }
          >
            {category.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button className="icon-button" type="button" title="Kategorie duplizieren" onClick={onDuplicate}>
            <Copy size={16} />
          </button>
          {onCopy ? (
            <button className="icon-button" type="button" title="In anderes Profil kopieren" onClick={onCopy}>
              <FolderInput size={16} />
            </button>
          ) : null}
          <button
            className="icon-button danger"
            type="button"
            aria-label="Kategorie löschen"
            onClick={() => {
              if (
                window.confirm(
                  `Kategorie „${category.title || "Ohne Titel"}“ löschen?`,
                )
              )
                onRemove();
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      <div className="knowledge-category-settings">
        <label className="field">
          <span>Kategoriename</span>
          <input
            value={category.title}
            onChange={(event) =>
              onChange({ ...category, title: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span>Optionale Unterüberschrift</span>
          <input
            value={category.subtitle ?? ""}
            onChange={(event) =>
              onChange({ ...category, subtitle: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span>Kategorietyp</span>
          <select
            value={category.type}
            onChange={(event) =>
              onChange({
                ...category,
                type: event.target.value as KnowledgeCategory["type"],
              })
            }
          >
            {knowledgeCategoryTypes.map((type) => (
              <option value={type} key={type}>
                {knowledgeCategoryTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <KnowledgeDisplayModeSelector
          value={category.displayMode}
          onChange={(displayMode) =>
            onChange({
              ...category,
              displayMode: displayMode ?? "comma-separated",
            })
          }
        />
      </div>
      <div className="knowledge-category-toggles">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={category.showLevels}
            onChange={(event) =>
              onChange({ ...category, showLevels: event.target.checked })
            }
          />
          <span>Kenntnisstufen anzeigen</span>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={category.showYearsOfExperience}
            onChange={(event) =>
              onChange({
                ...category,
                showYearsOfExperience: event.target.checked,
              })
            }
          />
          <span>Erfahrung in Jahren anzeigen</span>
        </label>
      </div>
      <div className="knowledge-item-list">
        {category.items.map((item) => (
          <KnowledgeItemEditor
            key={item.id}
            item={item}
            categoryTitle={category.title}
            showLevels={category.showLevels}
            showYears={category.showYearsOfExperience}
            onChange={updateItem}
            onRemove={() =>
              onChange({
                ...category,
                items: category.items.filter(
                  (candidate) => candidate.id !== item.id,
                ),
              })
            }
            onDragStart={() => setDraggedItemId(item.id)}
            onDrop={() => {
              if (!draggedItemId) return;
              onChange({
                ...category,
                items: moveKnowledgeEntry(
                  category.items,
                  draggedItemId,
                  item.id,
                ),
              });
              setDraggedItemId(undefined);
            }}
          />
        ))}
      </div>
      <div className="knowledge-category-add-actions">
        <button
          className="button secondary small-button"
          type="button"
          onClick={() =>
            onChange({
              ...category,
              items: [
                ...category.items,
                createKnowledgeItem("", category.items.length),
              ],
            })
          }
        >
          <Plus size={15} /> Kenntnis hinzufügen
        </button>
        <button
          className="button secondary small-button"
          type="button"
          onClick={() =>
            onChange({
              ...category,
              subcategories: [
                ...category.subcategories,
                {
                  id: crypto.randomUUID(),
                  title: "",
                  items: [],
                  isVisible: true,
                  sortOrder: category.subcategories.length,
                },
              ],
            })
          }
        >
          <Plus size={15} /> Unterkategorie hinzufügen
        </button>
      </div>
      <div className="knowledge-subcategory-list">
        {[...category.subcategories]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((subcategory) => (
            <KnowledgeSubcategoryEditor
              key={subcategory.id}
              subcategory={subcategory}
              categoryTitle={category.title}
              showLevels={category.showLevels}
              showYears={category.showYearsOfExperience}
              onChange={(changed) =>
                onChange({
                  ...category,
                  subcategories: category.subcategories.map((candidate) =>
                    candidate.id === changed.id ? changed : candidate,
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...category,
                  subcategories: category.subcategories.filter(
                    (candidate) => candidate.id !== subcategory.id,
                  ),
                })
              }
              onDragStart={() =>
                setDraggedSubcategoryId(subcategory.id)
              }
              onDrop={() => {
                if (!draggedSubcategoryId) return;
                onChange({
                  ...category,
                  subcategories: moveKnowledgeEntry(
                    category.subcategories,
                    draggedSubcategoryId,
                    subcategory.id,
                  ),
                });
                setDraggedSubcategoryId(undefined);
              }}
            />
          ))}
      </div>
    </article>
  );
}
