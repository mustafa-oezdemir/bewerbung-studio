import { Plus, X } from "lucide-react";
import { useId, useState } from "react";

/** A short list as removable chips with one input: Enter or "+" adds, every chip has its own remove button. */
export function ChipListEditor({
  values,
  onChange,
  label,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (!values.some((item) => item.trim().toLocaleLowerCase("de-DE") === value.toLocaleLowerCase("de-DE")))
      onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="chip-list-editor">
      <ul className="chip-list" aria-label={label}>
        {values
          .map((value, index) => ({ value, index }))
          .filter(({ value }) => value.trim())
          .map(({ value, index }) => (
            <li className="chip" key={`${value}-${index}`}>
              <span>{value}</span>
              <button
                type="button"
                aria-label={`${value} entfernen`}
                onClick={() => onChange(values.filter((_, current) => current !== index))}>
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
      </ul>
      <div className="chip-list-input">
        <input
          id={id}
          aria-label={`${label} hinzufügen`}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="button secondary small-button" onClick={add} disabled={!draft.trim()}>
          <Plus size={14} aria-hidden="true" /> Hinzufügen
        </button>
      </div>
    </div>
  );
}
