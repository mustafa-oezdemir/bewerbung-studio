import { ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ColorCard } from "../document/ColorCard";
import { cvDesignLimits, type CvDesignTokens, type ResumeDesignLayer } from "../../shared/cvDesignSchema";
import { documentFonts, hasReadableColorContrast, type DocumentDesignSettings } from "../../shared/documentDesign";
import type { DesignScope } from "../../shared/documentEditorState";
import type { ResolvedResumeAppearance, ResumeAppearance } from "../../shared/resumeAppearance";
import { resumeAppearanceLimits } from "../../shared/resumeAppearance";
import {
  resolveResumeDesignView, type ResumeDesignSource, type ResumeDesignView,
} from "../../shared/resumeDesignSystem";
import { getResumeSpacingPreset, resumeSpacingFields, type ResumeSpacingPreset } from "../../shared/resumeSpacing";

type TokenGroup = keyof CvDesignTokens;
type Value = string | number | boolean;

export type ResumeDesignPanelProps = {
  documentId?: string;
  templateId: string;
  templateName: string;
  /** The settings of this Bewerbung; the template values are resolved from them. */
  settings: DocumentDesignSettings;
  global?: ResumeDesignLayer;
  unsaved?: boolean;
  /** False for a one-column layout and for the plain ATS output: the side-column colours have nothing to colour. */
  hasSidebar: boolean;
  onEditToken: (scope: DesignScope, group: TokenGroup, key: string, value: Value | undefined) => void;
  onEditAppearance: (scope: DesignScope, key: keyof ResumeAppearance, value: Value | undefined) => void;
  onPreset: (preset: "compact" | "standard" | "large") => void;
  onReset: (scope: DesignScope) => void;
};

const german = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });

const countOverrides = (layer: ResumeDesignLayer | undefined) =>
  Object.values(layer?.cvOverrides ?? {}).reduce((sum, fields) => sum + Object.values(fields ?? {}).filter((value) => value !== undefined).length, 0)
  + Object.values(layer?.resumeAppearance ?? {}).filter((value) => value !== undefined).length;

const sourceLabel: Partial<Record<ResumeDesignSource, string>> = { global: "Global", document: "Bewerbung" };

type FieldFrame = {
  label: string;
  source: ResumeDesignSource;
  /** What the template draws, as text. */
  templateText: string;
  globalText?: string;
  overrideText?: string;
  resettable?: boolean;
  resetLabel?: string;
  onReset: () => void;
  children: ReactNode;
  disabled?: boolean;
  note?: string;
};

/** Every control shows the effective value; below it, where the value comes from and what the template says. */
function FieldFrame({ label, source, templateText, globalText, overrideText, resettable, resetLabel, onReset, children, disabled, note }: FieldFrame) {
  return <div className={`rds-field${source !== "template" ? ` rds-field--${source}` : ""}${disabled ? " rds-field--disabled" : ""}`}>
    <span className="rds-field__label">
      {label}
      {source !== "template" ? <b className={`rds-badge rds-badge--${source}`}>{sourceLabel[source]}</b> : null}
    </span>
    {children}
    <span className="rds-field__hint">
      <span>Vorlage: {templateText}{globalText ? ` · Global: ${globalText}` : ""}</span>
      {resettable ? <button type="button" className="rds-link" onClick={onReset} disabled={disabled}>
        <RotateCcw size={10} aria-hidden="true" /> {resetLabel ?? "Auf Vorlagenwert zurücksetzen"}
      </button> : null}
    </span>
    {note ? <span className="rds-field__note">{note}</span> : null}
    {overrideText ? <span className="rds-field__note" role="status">{overrideText}</span> : null}
  </div>;
}

function NumberField({
  label, unit, value, templateValue, min, max, step, source, disabled, note, contextKey, onCommit, onReset, globalText, overrideText, resettable, resetLabel,
}: {
  label: string; unit: string; value: number; templateValue: number; min: number; max: number; step: number;
  source: ResumeDesignSource; disabled?: boolean; note?: string; contextKey: string;
  globalText?: string; overrideText?: string; resettable?: boolean; resetLabel?: string;
  onCommit: (value: number) => void; onReset: () => void;
}) {
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef(contextKey);
  const valueRef = useRef(value);
  const acceptedRef = useRef(value);
  const emittedRef = useRef(new Set<number>());
  const [error, setError] = useState("");
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (contextRef.current !== contextKey) {
      contextRef.current = contextKey;
      emittedRef.current.clear();
      valueRef.current = value;
      acceptedRef.current = value;
      input.value = german(value);
      setError("");
      return;
    }
    if (Object.is(valueRef.current, value)) return;
    valueRef.current = value;
    acceptedRef.current = value;
    const ownEdit = emittedRef.current.has(value);
    emittedRef.current.clear();
    // Own live edits may contain a trailing separator or a caret in the middle of the text.
    // An external reset/update must replace that draft even while the field is focused.
    if (!ownEdit || document.activeElement !== input) {
      input.value = german(value);
      setError("");
    }
  }, [contextKey, value]);
  const read = (raw: string): { kind: "empty" | "partial" | "invalid" | "range" | "valid"; number?: number } => {
    const text = raw.trim();
    if (!text) return { kind: "empty" };
    if (/^-?(?:\d+[,.]?|[,.])$/.test(text) && /[,.]$/.test(text)) return { kind: "partial" };
    if (text === "-") return { kind: "partial" };
    if (!/^-?(?:\d+(?:[,.]\d{1,2})?|[,.]\d{1,2})$/.test(text)) return { kind: "invalid" };
    const number = Number(text.replace(",", "."));
    if (!Number.isFinite(number)) return { kind: "invalid" };
    if (number < min || number > max) return { kind: "range" };
    return { kind: "valid", number };
  };
  const message = (kind: "invalid" | "range") => kind === "range"
    ? `Bitte eine Zahl zwischen ${german(min)} und ${german(max)} eingeben.`
    : "Bitte eine gültige Zahl mit höchstens zwei Nachkommastellen eingeben.";
  const emit = (number: number) => {
    if (Object.is(number, acceptedRef.current)) return;
    acceptedRef.current = number;
    emittedRef.current.add(number);
    onCommit(number);
  };
  const input = (element: HTMLInputElement) => {
    if (contextRef.current !== contextKey) return;
    const result = read(element.value);
    setError(result.kind === "invalid" || result.kind === "range" ? message(result.kind) : "");
    if (result.kind === "valid") emit(result.number!);
  };
  const finish = (element: HTMLInputElement) => {
    if (contextRef.current !== contextKey) return;
    const result = read(element.value);
    if (result.kind === "empty") {
      element.value = german(acceptedRef.current);
      setError("");
    } else if (result.kind === "valid") {
      emit(result.number!);
      element.value = german(result.number!);
      setError("");
    } else setError(message(result.kind === "range" ? "range" : "invalid"));
  };
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(event.currentTarget);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const entered = read(event.currentTarget.value);
    const base = entered.kind === "valid" ? entered.number! : acceptedRef.current;
    const next = Math.round(Math.max(min, Math.min(max, base + (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1))) * 100) / 100;
    event.currentTarget.value = german(next);
    setError("");
    emit(next);
  };
  const titled = `${label}${unit ? ` (${unit})` : ""}`;
  return <FieldFrame label={titled} source={source} onReset={onReset} disabled={disabled} note={note}
    globalText={globalText} overrideText={overrideText} resettable={resettable} resetLabel={resetLabel}
    templateText={`${german(templateValue)}${unit ? ` ${unit}` : ""}`}>
    <span className="rds-input">
      <input ref={inputRef} type="text" inputMode="decimal" role="spinbutton" aria-label={titled}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined} autoComplete="off" disabled={disabled} defaultValue={german(value)}
        onInput={(event) => input(event.currentTarget)}
        onBlur={(event) => finish(event.currentTarget)}
        onKeyDown={key} />
    </span>
    {error ? <small id={errorId} className="rds-field__error" role="alert">{error}</small> : null}
  </FieldFrame>;
}

function SelectField({
  label, value, options, templateText, source, disabled, onChange, onReset, globalText, overrideText, resettable, resetLabel,
}: {
  label: string; value: string; options: readonly (readonly [string, string])[]; templateText: string;
  source: ResumeDesignSource; disabled?: boolean; globalText?: string; overrideText?: string; resettable?: boolean; resetLabel?: string;
  onChange: (value: string) => void; onReset: () => void;
}) {
  return <FieldFrame label={label} source={source} onReset={onReset} disabled={disabled} templateText={templateText}
    globalText={globalText} overrideText={overrideText} resettable={resettable} resetLabel={resetLabel}>
    <span className="rds-input">
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </span>
  </FieldFrame>;
}

function CheckField({
  label, checked, templateText, source, disabled, onChange, onReset, globalText, overrideText, resettable, resetLabel,
}: {
  label: string; checked: boolean; templateText: string; source: ResumeDesignSource;
  disabled?: boolean; globalText?: string; overrideText?: string; resettable?: boolean; resetLabel?: string;
  onChange: (checked: boolean) => void; onReset: () => void;
}) {
  return <FieldFrame label={label} source={source} onReset={onReset} disabled={disabled} templateText={templateText}
    globalText={globalText} overrideText={overrideText} resettable={resettable} resetLabel={resetLabel}>
    <label className="rds-check">
      <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? "Ja" : "Nein"}</span>
    </label>
  </FieldFrame>;
}

function Group({ title, summary, children, defaultOpen = false }: { title: string; summary: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details className="rds-group" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>
      <ChevronRight size={15} className="rds-chevron" aria-hidden="true" />
      <span><strong>{title}</strong><small>{summary}</small></span>
    </summary>
    <div className="rds-group__body">{children}</div>
  </details>;
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rds-sub" aria-label={title}><h4>{title}</h4><div className="rds-grid">{children}</div></section>;
}

const colorGroups = [
  ["Text", [["text", "Lesetext"], ["paragraph", "Absatztext"], ["muted", "Sekundärtext"]]],
  ["Überschriften", [["heading", "Überschrift"], ["subheading", "Unterüberschrift"], ["sectionHeading", "Hauptabschnitt"], ["entryHeading", "Unterabschnitt"]]],
  ["Design", [["accent", "Akzent"], ["divider", "Linien"], ["background", "Hintergrund"], ["surface", "Fläche"], ["icon", "Icon-Farbe"]]],
] as const;

const columnColors = [
  ["sidebarBackgroundColor", "Seitenspalte"], ["sidebarTextColor", "Seitenspalte Text"],
  ["sidebarSectionHeadingColor", "Seitenspalte Abschnittstitel"], ["mainBackgroundColor", "Hauptspalte"],
] as const;
const decorationColors = [["photoDecorationColor", "Fotolinien-Farbe"], ["contactDividerColor", "Kontaktlinie"]] as const;

const sizeFields = [
  ["bodySizePt", "Lesetext"], ["headingSizePt", "Hauptüberschrift"], ["subheadingSizePt", "Unterüberschrift"],
  ["sectionHeadingSizePt", "Abschnittsüberschrift"], ["entryHeadingSizePt", "Eintragstitel"],
] as const;
const weightFields = [
  ["headingWeight", "Name – Gewicht"], ["subheadingWeight", "Untertitel – Gewicht"], ["sectionHeadingWeight", "Abschnittstitel – Gewicht"],
] as const;
const standardWeights = [300, 400, 500, 600, 700, 800, 900];

const alignmentLabels = { left: "Links", center: "Mitte", right: "Rechts" } as const;
const dividerLabels = { none: "Keine", bottom: "Unten", top: "Oben", both: "Oben + unten" } as const;
const photoLabels = { circle: "Rund", rounded: "Abgerundet", square: "Eckig", hidden: "Ausblenden" } as const;
const headerLabels = { left: "Linksbündig", center: "Zentriert", split: "Geteilt" } as const;
const spacingTitles: Record<string, string> = {
  pageMarginMm: "Seitenränder", innerPaddingMm: "Innenabstand", sectionGapMm: "Abschnittsabstand", entryGapMm: "Eintragsabstand",
  sectionTitleGapMm: "Abstand nach Abschnittstitel", entryContentGapMm: "Abstand nach Eintragstitel", columnGapMm: "Spaltenabstand",
};
const spacingNotes: Record<string, string> = {
  pageMarginMm: "Abstand der Inhalte zum Blattrand.",
  innerPaddingMm: "Kommt zusätzlich zum Seitenrand hinzu und ändert ihn nicht.",
};

/**
 * The Lebenslauf design in one panel for every template: the same controls, the same resolver. Each control shows the
 * effective value; the template's own value and the origin of the effective one are named beneath it.
 */
export function ResumeDesignPanel({ documentId = "", templateId, templateName, settings, global, hasSidebar, unsaved, onEditToken, onEditAppearance, onPreset, onReset }: ResumeDesignPanelProps) {
  const [scope, setScope] = useState<DesignScope>("document");
  const view: ResumeDesignView = useMemo(() => resolveResumeDesignView(templateId, settings, global), [templateId, settings, global]);
  const { native, editableGlobal, effective } = view;
  const displayed = scope === "global" ? editableGlobal : effective;
  const contextKey = `${documentId}:${templateId}:${scope}`;
  const ownCount = countOverrides({ cvOverrides: settings.cvOverrides, resumeAppearance: settings.resumeAppearance });
  const sharedCount = countOverrides(global);
  const preset: ResumeSpacingPreset = getResumeSpacingPreset(templateId, settings, global);

  const asText = (value: Value) => typeof value === "number" ? german(value) : typeof value === "boolean" ? (value ? "Ja" : "Nein") : value;
  const fieldInfo = (documentSource: ResumeDesignSource, hasShared: boolean, hasOwn: boolean, sharedValue: Value, currentValue: Value) => ({
    source: scope === "global" ? (hasShared ? "global" : "template") as ResumeDesignSource : documentSource,
    resettable: scope === "global" ? hasShared : hasOwn,
    resetLabel: scope === "global" ? "Globalen Wert entfernen" : hasShared ? "Auf übernommenen Wert zurücksetzen" : "Auf Vorlagenwert zurücksetzen",
    globalText: hasShared ? asText(sharedValue) : undefined,
    overrideText: scope === "global" && documentSource === "document"
      ? `Diese Bewerbung verwendet einen eigenen Wert. Aktuell: ${asText(currentValue)}. Wählen Sie „Nur diese Bewerbung“, um ihn zu ändern.`
      : undefined,
  });

  const token = (group: TokenGroup, key: string) => {
    const own = (settings.cvOverrides?.[group] as Record<string, Value> | undefined)?.[key] !== undefined
      || (group === "spacing" && key === "sectionTitleGapMm" && settings.resumeAppearance?.sectionHeadingMarginAfterMm !== undefined);
    const shared = (global?.cvOverrides?.[group] as Record<string, Value> | undefined)?.[key] !== undefined
      || (group === "spacing" && key === "sectionTitleGapMm" && global?.resumeAppearance?.sectionHeadingMarginAfterMm !== undefined);
    const globalValues = editableGlobal.tokens[group] as Record<string, Value>;
    const currentValues = effective.tokens[group] as Record<string, Value>;
    return {
      ...fieldInfo(view.sourceOfToken(group, key as never), shared, own, globalValues[key], currentValues[key]),
      onReset: () => onEditToken(scope, group, key, undefined),
    };
  };
  const appearance = (key: keyof ResumeAppearance) => {
    const fields = key === "sectionDividerPosition" || key === "sectionDividerVisible" ? ["sectionDividerPosition", "sectionDividerVisible"] : [key];
    const own = fields.some((field) => (settings.resumeAppearance as Record<string, Value> | undefined)?.[field] !== undefined);
    const shared = fields.some((field) => (global?.resumeAppearance as Record<string, Value> | undefined)?.[field] !== undefined);
    return {
      ...fieldInfo(view.sourceOfAppearance(key), shared, own,
        (editableGlobal.appearance as unknown as Record<string, Value>)[key],
        (effective.appearance as unknown as Record<string, Value>)[key]),
      onReset: () => onEditAppearance(scope, key, undefined),
    };
  };
  const tokenNumber = (group: TokenGroup, key: string, label: string, unit: string, min: number, max: number, step: number, note?: string) => {
    const read = (tokens: CvDesignTokens) => (tokens[group] as Record<string, number>)[key];
    return <NumberField key={`${group}.${key}`} label={label} unit={unit} min={min} max={max} step={step} note={note} contextKey={contextKey}
      value={read(displayed.tokens)} templateValue={read(native.tokens)}
      onCommit={(value) => onEditToken(scope, group, key, value)} {...token(group, key)} />;
  };
  const dividerText = (position: ResolvedResumeAppearance["sectionDividerPosition"]) => dividerLabels[position];

  return <section className="rds" aria-label="Lebenslauf-Designsystem">
    <header className="rds-header">
      <div className="rds-header__top">
        <div className="rds-title">
          <strong>Lebenslauf-Design</strong>
          <small>Wählen Sie, ob Änderungen für alle Lebensläufe oder nur für diese Bewerbung gelten.</small>
        </div>
        <button type="button" className="rds-reset" onClick={() => onReset(scope)} disabled={scope === "global" ? !sharedCount : !ownCount}>
          <RotateCcw size={13} aria-hidden="true" /> {scope === "global" ? "Globale Werte entfernen" : "Eigene Werte entfernen"}
        </button>
      </div>
      <div className="rds-scope" role="group" aria-label="Geltungsbereich der Änderungen">
        <span id="rds-scope-label">Änderungen gelten für</span>
        <div className="segmented-design-control" aria-labelledby="rds-scope-label">
          {([["global", "Alle Lebensläufe"], ["document", "Nur diese Bewerbung"]] as const).map(([value, label]) => (
            <button key={value} type="button" className={scope === value ? "selected" : ""} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>
          ))}
        </div>
      </div>
      <p className="rds-status" role="status">
        <b className="rds-chip">{templateName}</b>
        <b className={`rds-chip${sharedCount ? " rds-chip--global" : ""}`}>{sharedCount ? `${sharedCount} globale Anpassung${sharedCount === 1 ? "" : "en"}` : "Keine globalen Anpassungen"}</b>
        <b className={`rds-chip${ownCount ? " rds-chip--document" : ""}`}>{ownCount ? `${ownCount} eigene Anpassung${ownCount === 1 ? "" : "en"}` : "Keine eigenen Anpassungen"}</b>
        {unsaved ? <b className="rds-chip rds-chip--document">Nicht gespeichert</b> : null}
      </p>
    </header>

    <Group title="Farben und Dekoration" summary="Farben, Abschnittstitel, Linien, Foto und Kopfbereich" defaultOpen>
      {colorGroups.map(([title, colors]) => <section className="rds-sub" key={title} aria-label={title}>
        <h4>{title}</h4>
        <div className="rds-grid rds-grid--colors">
          {colors.map(([key, label]) => {
            return <ColorCard key={key} label={label} value={displayed.tokens.colors[key]} contextKey={contextKey} onChange={(color) => onEditToken(scope, "colors", key, color)}>
              <ColorHint {...token("colors", key)} templateText={native.tokens.colors[key].toUpperCase()} />
            </ColorCard>;
          })}
        </div>
      </section>)}
      {!hasReadableColorContrast(displayed.tokens.colors.paragraph, displayed.tokens.colors.background) ? (
        <p className="resume-sections-warning" role="status">
          Der Kontrast zwischen Lesetext und Hintergrund ist zu niedrig. Für gute Lesbarkeit bitte eine hellere oder dunklere Textfarbe wählen.
        </p>
      ) : null}
      <section className="rds-sub" aria-label="Spalten und Dekoration">
        <h4>Spalten und Dekoration</h4>
        {!hasSidebar ? <p className="rds-note">Die Farben der Seitenspalte wirken nur bei einem zweispaltigen Layout.</p> : null}
        <div className="rds-grid rds-grid--colors">
          {[...columnColors, ...decorationColors].map(([key, label]) => {
            const side = (columnColors as readonly (readonly [string, string])[]).slice(0, 3).some(([name]) => name === key);
            return <ColorCard key={key} label={label} value={displayed.appearance[key]} contextKey={contextKey} disabled={side && !hasSidebar}
              onChange={(color) => onEditAppearance(scope, key, color)}>
              <ColorHint {...appearance(key)} templateText={native.appearance[key].toUpperCase()} />
            </ColorCard>;
          })}
        </div>
      </section>

      {hasSidebar && !hasReadableColorContrast(displayed.appearance.sidebarTextColor, displayed.appearance.sidebarBackgroundColor) ? (
        <p className="resume-sections-warning" role="status">Der Kontrast zwischen Seitenspalten-Text und Hintergrund ist zu niedrig.</p>
      ) : null}
      <Sub title="Abschnittstitel">
        <SelectField label="Ausrichtung Abschnittstitel" value={displayed.appearance.sectionHeadingAlignment}
          options={(["left", "center", "right"] as const).map((key) => [key, key === native.appearance.sectionHeadingAlignment ? `${alignmentLabels[key]} (Vorlage)` : alignmentLabels[key]] as const)}
          templateText={alignmentLabels[native.appearance.sectionHeadingAlignment]}
          onChange={(value) => onEditAppearance(scope, "sectionHeadingAlignment", value)} {...appearance("sectionHeadingAlignment")} />
      </Sub>

      <Sub title="Linien und Foto">
        <SelectField label="Abschnittslinie" value={displayed.appearance.sectionDividerPosition}
          options={(["none", "bottom", "top", "both"] as const).map((key) => [key, key === native.appearance.sectionDividerPosition ? `${dividerLabels[key]} (Vorlage)` : dividerLabels[key]] as const)}
          templateText={dividerText(native.appearance.sectionDividerPosition)}
          onChange={(value) => onEditAppearance(scope, "sectionDividerPosition", value)} {...appearance("sectionDividerPosition")} />
        <NumberField label="Linienstärke" unit="mm" min={resumeAppearanceLimits.sectionDividerWidthMm[0]} max={resumeAppearanceLimits.sectionDividerWidthMm[1]} step={0.05} contextKey={contextKey}
          value={displayed.appearance.sectionDividerWidthMm} templateValue={native.appearance.sectionDividerWidthMm} disabled={!displayed.appearance.sectionDividerVisible}
          onCommit={(value) => onEditAppearance(scope, "sectionDividerWidthMm", value)} {...appearance("sectionDividerWidthMm")} />
        <CheckField label="Fotolinien sichtbar" checked={displayed.appearance.photoDecorationVisible} templateText={native.appearance.photoDecorationVisible ? "sichtbar" : "keine"}
          onChange={(checked) => onEditAppearance(scope, "photoDecorationVisible", checked)} {...appearance("photoDecorationVisible")} />
        <SelectField label="Foto-Layout" value={displayed.appearance.photoLayout}
          options={(["circle", "rounded", "square", "hidden"] as const).map((key) => [key, key === native.appearance.photoLayout ? `${photoLabels[key]} (Vorlage)` : photoLabels[key]] as const)}
          templateText={photoLabels[native.appearance.photoLayout]}
          onChange={(value) => onEditAppearance(scope, "photoLayout", value)} {...appearance("photoLayout")} />
        <SelectField label="Kopfbereich" value={displayed.appearance.headerLayout}
          options={(["left", "center", "split"] as const).map((key) => [key, key === native.appearance.headerLayout ? `${headerLabels[key]} (Vorlage)` : headerLabels[key]] as const)}
          templateText={headerLabels[native.appearance.headerLayout]}
          onChange={(value) => onEditAppearance(scope, "headerLayout", value)} {...appearance("headerLayout")} />
      </Sub>
    </Group>

    <Group title="Typografie im Detail" summary="Schriften, Größen, Zeilenhöhe und Gewichte">
      <Sub title="Schrift">
        {(["fontId", "headingFontId"] as const).map((key) => {
          const nameOf = (id: string) => documentFonts.find((font) => font.id === id)?.name ?? id;
          return <SelectField key={key} label={key === "fontId" ? "Schriftart" : "Überschrift-Schriftart"} value={displayed.tokens.typography[key]}
            options={documentFonts.map((font) => [font.id, font.id === native.tokens.typography[key] ? `${font.name} (Vorlage)` : font.name] as const)}
            templateText={nameOf(native.tokens.typography[key])}
            onChange={(value) => onEditToken(scope, "typography", key, value)} {...token("typography", key)} />;
        })}
      </Sub>
      <Sub title="Größen und Zeilenhöhe">
        {sizeFields.map(([key, label]) => tokenNumber("typography", key, `${label}`, "pt", cvDesignLimits[key][0], cvDesignLimits[key][1], 0.1))}
        {tokenNumber("typography", "lineHeight", "Zeilenhöhe", "", cvDesignLimits.lineHeight[0], cvDesignLimits.lineHeight[1], 0.01)}
      </Sub>
      <Sub title="Gewichte und Schreibweise">
        {weightFields.map(([key, label]) => {
          const current = displayed.tokens.typography[key];
          const weights = [...new Set([...standardWeights, current, native.tokens.typography[key]])].sort((first, second) => first - second);
          return <SelectField key={key} label={label} value={String(current)}
            options={weights.map((weight) => [String(weight), weight === native.tokens.typography[key] ? `${weight} (Vorlage)` : String(weight)] as const)}
            templateText={String(native.tokens.typography[key])}
            onChange={(value) => onEditToken(scope, "typography", key, Number(value))} {...token("typography", key)} />;
        })}
        <CheckField label="Abschnittstitel großschreiben" checked={displayed.tokens.typography.sectionHeadingUppercase}
          templateText={native.tokens.typography.sectionHeadingUppercase ? "ja" : "nein"}
          onChange={(checked) => onEditToken(scope, "typography", "sectionHeadingUppercase", checked)} {...token("typography", "sectionHeadingUppercase")} />
      </Sub>
    </Group>

    <Group title="Erweiterte Abstände" summary="Ränder, Abschnitts-, Eintrags- und Spaltenabstände">
      <section className="rds-sub" aria-label="Voreinstellung">
        <h4>Voreinstellung für diese Bewerbung</h4>
        <div className="segmented-design-control" role="group" aria-label="Lebenslauf-Abstände">
          {(["compact", "standard", "large"] as const).map((value) => (
            <button key={value} type="button" className={preset === value ? "selected" : ""} aria-pressed={preset === value} onClick={() => onPreset(value)}>
              {value === "compact" ? "Kompakt" : value === "standard" ? "Standard" : "Groß"}
            </button>
          ))}
        </div>
        {preset === "custom" ? <small className="rds-note">Benutzerdefinierte Abstände</small> : null}
      </section>
      <Sub title="Abstände">
        {resumeSpacingFields.filter(({ key }) => key !== "sectionTitleGapMm").map(({ key }) => tokenNumber(
          "spacing", key, spacingTitles[key], "mm", cvDesignLimits[key][0], cvDesignLimits[key][1], 0.1,
          templateId === "zweispaltig" && key === "pageMarginMm"
            ? "Abstand der Inhalte zum Blattrand. Links und rechts gleich; Kopfbereich und beide Spalten folgen dem Seitenrand."
            : templateId === "klassisch" && key === "pageMarginMm"
              ? "Abstand der Inhalte zum Blattrand. Standard: links 25 mm, rechts 20 mm. Änderungen wirken nur auf den linken und rechten Seitenrand."
              : spacingNotes[key]))}
      </Sub>
      <Sub title="Abstände um Abschnittstitel">
        <NumberField label="Abstand davor" unit="mm" min={resumeAppearanceLimits.sectionHeadingMarginBeforeMm[0]} max={resumeAppearanceLimits.sectionHeadingMarginBeforeMm[1]} step={0.5} contextKey={contextKey}
          value={displayed.appearance.sectionHeadingMarginBeforeMm} templateValue={native.appearance.sectionHeadingMarginBeforeMm}
          note="Zusätzlich zum Abschnittsabstand."
          onCommit={(value) => onEditAppearance(scope, "sectionHeadingMarginBeforeMm", value)} {...appearance("sectionHeadingMarginBeforeMm")} />
        {tokenNumber("spacing", "sectionTitleGapMm", "Abstand danach", "mm", cvDesignLimits.sectionTitleGapMm[0], cvDesignLimits.sectionTitleGapMm[1], 0.1, "Das ist der Abstand nach Abschnittstitel.")}
      </Sub>
      <p className="rds-note">Die Zeilenhöhe steht unter „Typografie im Detail“.</p>
    </Group>
  </section>;
}

/** The line below a colour: the template's value and the way back to it. */
function ColorHint({ source, templateText, globalText, overrideText, resettable, resetLabel, onReset }: {
  source: ResumeDesignSource; templateText: string; globalText?: string; overrideText?: string;
  resettable?: boolean; resetLabel?: string; onReset: () => void;
}) {
  return <span className="rds-field__hint">
    <span>{source !== "template" ? <b className={`rds-badge rds-badge--${source}`}>{sourceLabel[source]}</b> : null} Vorlage: {templateText}{globalText ? ` · Global: ${globalText}` : ""}</span>
    {resettable ? <button type="button" className="rds-link" onClick={onReset}>
      <RotateCcw size={10} aria-hidden="true" /> {resetLabel ?? "Auf Vorlagenwert zurücksetzen"}
    </button> : null}
    {overrideText ? <span className="rds-field__note" role="status">{overrideText}</span> : null}
  </span>;
}
