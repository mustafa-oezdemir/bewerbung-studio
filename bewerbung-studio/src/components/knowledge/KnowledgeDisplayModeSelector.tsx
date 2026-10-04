import {
  knowledgeDisplayModeLabels,
} from "../../features/knowledge/knowledge.constants";
import {
  knowledgeDisplayModes,
  type KnowledgeDisplayMode,
} from "../../features/knowledge/knowledge.types";

export function KnowledgeDisplayModeSelector({
  value,
  onChange,
  allowInherited = false,
}: {
  value: KnowledgeDisplayMode | undefined;
  onChange: (value: KnowledgeDisplayMode | undefined) => void;
  allowInherited?: boolean;
}) {
  return (
    <label className="field knowledge-display-mode">
      <span>Darstellung auswählen</span>
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value
              ? (event.target.value as KnowledgeDisplayMode)
              : undefined,
          )
        }
      >
        {allowInherited ? (
          <option value="">Von Kategorie übernehmen</option>
        ) : null}
        {knowledgeDisplayModes.map((mode) => (
          <option value={mode} key={mode}>
            {knowledgeDisplayModeLabels[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}

