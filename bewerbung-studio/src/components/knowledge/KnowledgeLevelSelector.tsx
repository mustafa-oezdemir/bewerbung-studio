import {
  knowledgeLevelLabels,
} from "../../features/knowledge/knowledge.constants";
import {
  knowledgeLevels,
  type KnowledgeLevel,
} from "../../features/knowledge/knowledge.types";

export function KnowledgeLevelSelector({
  value,
  onChange,
}: {
  value: KnowledgeLevel;
  onChange: (value: KnowledgeLevel) => void;
}) {
  return (
    <label className="field knowledge-level-select">
      <span>Kenntnisstufe</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as KnowledgeLevel)
        }
      >
        {knowledgeLevels.map((level) => (
          <option value={level} key={level}>
            {knowledgeLevelLabels[level] || "Keine Kenntnisstufe"}
          </option>
        ))}
      </select>
    </label>
  );
}

