import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** A colour value with a native picker and a HEX field. Complete HEX values update the preview while typing. */
export function ColorCard({
  label, value, onChange, disabled = false, contextKey = "", children,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  contextKey?: string;
  /** Extra line below the colour, for example the template value and a reset link. */
  children?: ReactNode;
}) {
  const errorId = useId();
  const hexRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef(contextKey);
  const valueRef = useRef(value.toUpperCase());
  const acceptedRef = useRef(value.toUpperCase());
  const emittedRef = useRef(new Set<string>());
  const [error, setError] = useState("");
  useEffect(() => {
    const input = hexRef.current;
    if (!input) return;
    const normalized = value.toUpperCase();
    if (contextRef.current !== contextKey) {
      contextRef.current = contextKey;
      emittedRef.current.clear();
      valueRef.current = normalized;
      acceptedRef.current = normalized;
      input.value = normalized;
      setError("");
      return;
    }
    if (valueRef.current === normalized) return;
    valueRef.current = normalized;
    acceptedRef.current = normalized;
    const ownEdit = emittedRef.current.has(normalized);
    emittedRef.current.clear();
    if (!ownEdit || document.activeElement !== input) {
      input.value = normalized;
      setError("");
    }
  }, [contextKey, value]);
  const normalizedHex = (candidate: string) => {
    const trimmed = candidate.trim();
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
  };
  const emit = (color: string) => {
    if (color === acceptedRef.current) return;
    acceptedRef.current = color;
    emittedRef.current.add(color);
    onChange(color);
  };
  const inputHex = (input: HTMLInputElement) => {
    if (contextRef.current !== contextKey) return;
    const normalized = normalizedHex(input.value);
    if (normalized) {
      setError("");
      emit(normalized);
    } else setError(/^#?[0-9a-f]{0,5}$/i.test(input.value.trim()) ? "" : "Bitte eine sechsstellige HEX-Farbe eingeben, z. B. #123ABC.");
  };
  const finishHex = (input: HTMLInputElement) => {
    if (contextRef.current !== contextKey) return;
    const normalized = normalizedHex(input.value);
    if (normalized) {
      input.value = normalized;
      setError("");
      emit(normalized);
    } else setError("Bitte eine sechsstellige HEX-Farbe eingeben, z. B. #123ABC.");
  };
  return <div className="design-color-card-wrap">
    <label className="design-color-card" aria-disabled={disabled || undefined}>
      <span>{label}</span>
      <span className="design-color-card__choice">
        <input type="color" aria-label={label} value={value} disabled={disabled} onChange={(event) => {
          const normalized = event.target.value.toUpperCase();
          if (hexRef.current) hexRef.current.value = normalized;
          setError("");
          emit(normalized);
        }} />
        <input ref={hexRef} className="design-color-card__hex" type="text" aria-label={`${label} HEX`} disabled={disabled}
          inputMode="text" maxLength={7} defaultValue={value.toUpperCase()} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
          onInput={(event) => inputHex(event.currentTarget)}
          onBlur={(event) => finishHex(event.currentTarget)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); finishHex(event.currentTarget); } }} />
      </span>
    </label>
    {error ? <small id={errorId} className="design-color-card__error" role="alert">{error}</small> : null}
    {children}
  </div>;
}
