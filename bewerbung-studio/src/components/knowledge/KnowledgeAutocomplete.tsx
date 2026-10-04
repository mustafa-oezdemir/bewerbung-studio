import { getKnowledgeSuggestions } from "../../features/knowledge/knowledge.presets";
import { useId } from "react";

export function KnowledgeAutocomplete({
  categoryTitle,
  value,
  onChange,
}: {
  categoryTitle: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const reactId = useId();
  const listId = `knowledge-${reactId.replaceAll(":", "")}`;
  const suggestions = getKnowledgeSuggestions(categoryTitle, value);
  return (
    <label className="field knowledge-name-field">
      <span>Kenntnis</span>
      <input
        value={value}
        list={listId}
        placeholder="Kenntnis frei eingeben …"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {suggestions.map((suggestion) => (
          <option value={suggestion} key={suggestion} />
        ))}
      </datalist>
    </label>
  );
}
