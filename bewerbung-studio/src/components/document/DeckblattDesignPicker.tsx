import {
  deckblattDesigns,
  type DeckblattDesignId,
} from "../../shared/deckblattDesigns";

/** The choice of the Deckblatt design; the options come from the central registry. */
export function DeckblattDesignPicker({
  value,
  onChange,
}: {
  value: DeckblattDesignId;
  onChange: (id: DeckblattDesignId) => void;
}) {
  return (
    <div
      className="deckblatt-design-picker"
      role="radiogroup"
      aria-label="Design des Deckblatts">
      {deckblattDesigns.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={`deckblatt-design-option deckblatt-design-option--${option.id}${
            value === option.id ? " active" : ""
          }`}
          data-deckblatt-design={option.id}
          key={option.id}
          onClick={() => onChange(option.id)}>
          <i aria-hidden="true" />
          <b>{option.label}</b>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  );
}
