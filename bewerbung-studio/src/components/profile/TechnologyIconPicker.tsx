import { deviconOptions } from "../../shared/deviconCatalog";
import { strengthSymbolOptions } from "../../shared/strengthSymbols";
import { TechnologyBrandIcon } from "../resume/TechnologyBrandIcon";

export function TechnologyIconPicker({
  technologyTitle,
  value,
  onChange,
}: {
  technologyTitle: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="technology-icon-picker">
      <span className="technology-icon-picker__preview">
        <TechnologyBrandIcon
          technology={technologyTitle || "Technologie"}
          iconId={value}
        />
      </span>
      <div className="field">
        <span>Symbol / Technologie-Icon</span>
        <div className="strength-symbol-picker" role="group" aria-label="Aufzählungszeichen">
          {strengthSymbolOptions.map((option) => (
            <button key={option.id} type="button" title={option.label}
              aria-label={option.label} aria-pressed={value === option.id}
              onClick={() => onChange(option.id)}>{option.glyph}</button>
          ))}
        </div>
        <select aria-label="Symbol / Technologie-Icon" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Automatisch nach Bezeichnung</option>
          <optgroup label="Aufzählungszeichen">
            {strengthSymbolOptions.map((option) => <option key={option.id} value={option.id}>{option.glyph} {option.label}</option>)}
          </optgroup>
          <optgroup label="Technologie-Icons">
          {deviconOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} ({option.id})
            </option>
          ))}
          </optgroup>
        </select>
        <small>Aufzählungszeichen übernehmen die Textfarbe. {deviconOptions.length} Technologie-Icons verfügbar.</small>
      </div>
    </div>
  );
}
