import { Plus, RotateCcw } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  predefinedKnowledgeCategories,
} from "../../features/knowledge/knowledge.constants";
import {
  professionPresetLabels,
} from "../../features/knowledge/knowledge.presets";
import {
  addProfessionPreset,
  duplicateKnowledgeCategory,
} from "../../features/knowledge/knowledge.service";
import { moveKnowledgeEntry } from "../../features/knowledge/knowledge.store";
import {
  type KnowledgeCategory,
  type KnowledgeProfessionPreset,
  type KnowledgeSection,
} from "../../features/knowledge/knowledge.types";
import { createKnowledgeCategory } from "../../features/knowledge/knowledge.utils";
import { validateKnowledgeSection } from "../../features/knowledge/knowledge.validation";
import { KnowledgeCategoryCard } from "./KnowledgeCategoryCard";

export function KnowledgeSectionEditor({
  value,
  onChange,
  onCopyCategory,
}: {
  value: KnowledgeSection;
  onChange: (value: KnowledgeSection) => void;
  onCopyCategory?: (categoryId: string) => void;
}) {
  const [customName, setCustomName] = useState("");
  const titleOptionsId = useId();
  const [predefined, setPredefined] = useState<string>(
    predefinedKnowledgeCategories[0],
  );
  const [preset, setPreset] =
    useState<KnowledgeProfessionPreset>("software");
  const [draggedCategoryId, setDraggedCategoryId] = useState<string>();
  const issues = useMemo(() => validateKnowledgeSection(value), [value]);

  const addCategory = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onChange({
      ...value,
      categories: [
        ...value.categories,
        createKnowledgeCategory(trimmed, value.categories.length),
      ],
    });
  };

  const updateCategory = (changed: KnowledgeCategory) =>
    onChange({
      ...value,
      categories: value.categories.map((category) =>
        category.id === changed.id ? changed : category,
      ),
    });

  return (
    <div className="knowledge-section-editor">
      <div className="knowledge-section-heading">
        <label className="field">
          <span>Überschrift</span>
          <input list={titleOptionsId}
            value={value.title}
            onChange={(event) =>
              onChange({ ...value, title: event.target.value })
            }
          />
          <datalist id={titleOptionsId}>
            {["Besondere Kenntnisse", "Kenntnisse", "Kenntnisse und Fertigkeiten", "Zusätzliche Skills", "Qualifikationen und Kompetenzen"].map((title) => <option key={title} value={title} />)}
          </datalist>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={value.isVisible}
            onChange={(event) =>
              onChange({ ...value, isVisible: event.target.checked })
            }
          />
          <span>Abschnitt im Lebenslauf anzeigen</span>
        </label>
      </div>

      <div className="knowledge-add-panel">
        <div>
          <label className="field">
            <span>Vordefinierte Kategorie</span>
            <select
              value={predefined}
              onChange={(event) => setPredefined(event.target.value)}
            >
              {predefinedKnowledgeCategories.map((title) => (
                <option key={title}>{title}</option>
              ))}
            </select>
          </label>
          <button
            className="button secondary small-button"
            type="button"
            onClick={() => addCategory(predefined)}
          >
            <Plus size={15} /> Hinzufügen
          </button>
        </div>
        <div>
          <label className="field">
            <span>Eigene Kategorie</span>
            <input
              value={customName}
              placeholder="z. B. Branchensoftware"
              onChange={(event) => setCustomName(event.target.value)}
            />
          </label>
          <button
            className="button secondary small-button"
            type="button"
            onClick={() => {
              addCategory(customName);
              setCustomName("");
            }}
          >
            <Plus size={15} /> Hinzufügen
          </button>
        </div>
        <div>
          <label className="field">
            <span>Berufsset</span>
            <select
              value={preset}
              onChange={(event) =>
                setPreset(event.target.value as KnowledgeProfessionPreset)
              }
            >
              {(Object.keys(
                professionPresetLabels,
              ) as KnowledgeProfessionPreset[]).map((key) => (
                <option key={key} value={key}>
                  {professionPresetLabels[key]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary small-button"
            type="button"
            onClick={() => onChange(addProfessionPreset(value, preset))}
          >
            Vorlage hinzufügen – anschließend prüfen
          </button>
        </div>
      </div>

      {issues.length ? (
        <div className="knowledge-validation" role="alert">
          <strong>Bitte vor dem Speichern prüfen:</strong>
          <ul>
            {issues.slice(0, 5).map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="knowledge-category-list">
        {[...value.categories]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((category) => (
            <details className="knowledge-category-disclosure" key={category.id}>
              <summary>{category.title || "Neue Kategorie"} · {category.items.filter((item) => item.isVisible && item.name.trim()).length + category.subcategories.reduce((count, subcategory) => count + (subcategory.isVisible ? subcategory.items.filter((item) => item.isVisible && item.name.trim()).length : 0), 0)} sichtbare Kenntnisse</summary>
            <KnowledgeCategoryCard
              key={category.id}
              category={category}
              onChange={updateCategory}
              onRemove={() =>
                onChange({
                  ...value,
                  categories: value.categories.filter(
                    (candidate) => candidate.id !== category.id,
                  ),
                })
              }
              onDuplicate={() =>
                onChange(duplicateKnowledgeCategory(value, category.id))
              }
              onCopy={
                onCopyCategory
                  ? () => onCopyCategory(category.id)
                  : undefined
              }
              onDragStart={() => setDraggedCategoryId(category.id)}
              onDrop={() => {
                if (!draggedCategoryId) return;
                onChange({
                  ...value,
                  categories: moveKnowledgeEntry(
                    value.categories,
                    draggedCategoryId,
                    category.id,
                  ),
                });
                setDraggedCategoryId(undefined);
              }}
            />
            </details>
          ))}
      </div>

      {!value.categories.length ? (
        <p className="editor-empty">
          Noch keine Kategorie vorhanden. Wählen Sie oben eine Kategorie oder
          ein Berufsset.
        </p>
      ) : null}
      {value.categories.length ? (
        <button
          className="button ghost small-button"
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Alle Kategorien und Kenntnisse dieses Abschnitts zurücksetzen?",
              )
            )
              onChange({ ...value, categories: [] });
          }}
        >
          <RotateCcw size={15} /> Alle Kategorien zurücksetzen
        </button>
      ) : null}
    </div>
  );
}
