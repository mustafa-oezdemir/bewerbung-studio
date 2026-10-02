import { CalendarDays } from "lucide-react";

/** A date typed as text (kept exactly as written) with a picker that fills in the German form. */
export function FlexibleDateField({
  label,
  value,
  mode,
  onChange,
  id,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  mode: "date" | "month";
  onChange: (value: string) => void;
  id?: string;
  hint?: string;
  /** Read-only (for example "heute" of a current position): the value is shown, nothing can change it. */
  disabled?: boolean;
}) {
  const pickerValue = (() => {
    if (mode === "month") {
      const match = value.match(/^(\d{2})[./-](\d{4})$/);
      return match ? `${match[2]}-${match[1]}` : "";
    }
    const match = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
  })();

  const pick = (selected: string) => {
    if (!selected) return;
    const parts = selected.split("-");
    onChange(
      mode === "month"
        ? `${parts[1]}/${parts[0]}`
        : `${parts[2]}.${parts[1]}.${parts[0]}`,
    );
  };

  return (
    <label className="field flexible-date-field">
      <span>{label}</span>
      <div>
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={mode === "month" ? "MM/JJJJ oder heute" : "TT.MM.JJJJ"}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="date-picker-control" title="Datum auswählen">
          <CalendarDays size={15} />
          <input
            type={mode}
            value={pickerValue}
            disabled={disabled}
            aria-label={`${label} auswählen`}
            onChange={(event) => pick(event.target.value)}
          />
        </span>
      </div>
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}
