import { useEffect, useState, type ReactNode } from "react";

/** A colour value with a native picker and a HEX field; the HEX field commits on blur or Enter. */
export function ColorCard({
  label, value, onChange, disabled = false, children,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  /** Extra line below the colour, for example the template value and a reset link. */
  children?: ReactNode;
}) {
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => setHex(value.toUpperCase()), [value]);
  const commit = (candidate: string) => {
    const normalized = candidate.startsWith("#") ? candidate : `#${candidate}`;
    if (/^#[0-9a-f]{6}$/i.test(normalized)) onChange(normalized.toUpperCase());
    else setHex(value.toUpperCase());
  };
  return <div className="design-color-card-wrap">
    <label className="design-color-card" aria-disabled={disabled || undefined}>
      <span>{label}</span>
      <span className="design-color-card__choice">
        <input type="color" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
        <input className="design-color-card__hex" type="text" aria-label={`${label} HEX`} disabled={disabled}
          inputMode="text" maxLength={7} value={hex}
          onChange={(event) => setHex(event.target.value.toUpperCase())}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(event.currentTarget.value); } }} />
      </span>
    </label>
    {children}
  </div>;
}
