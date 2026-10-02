import { ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
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
  templateId: string;
  templateName: string;
  /** The document's own settings; the shared layer and the template values are resolved from them. */
  settings: DocumentDesignSettings;
  global: ResumeDesignLayer | undefined;
  /** False for a one-column layout and for the plain ATS output: the side-column colours have nothing to colour. */
  hasSidebar: boolean;
  /** The shared layer was edited and is saved with "Texte speichern". */
  unsaved?: boolean;
  onEditToken: (scope: DesignScope, group: TokenGroup, key: string, value: Value | undefined) => void;
  onEditAppearance: (scope: DesignScope, key: keyof ResumeAppearance, value: Value | undefined) => void;
  onPreset: (preset: "compact" | "standard" | "large") => void;
  onReset: (scope: DesignScope) => void;
};

const german = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2, useGrouping: false });

const countOverrides = (layer: ResumeDesignLayer | undefined) =>
  Object.values(layer?.cvOverrides ?? {}).reduce((sum, fields) => sum + Object.values(fields ?? {}).filter((value) => value !== undefined).length, 0)
  + Object.values(layer?.resumeAppearance ?? {}).filter((value) => value !== undefined).length;

const sourceLabel: Record<ResumeDesignSource, string> = { template: "Vorlage", global: "Global", document: "Bewerbung" };

type FieldFrame = {
  label: string;
  source: ResumeDesignSource;
  scope: DesignScope;
  /** What the template draws, as text. */
  templateText: string;
  /** What the shared layer sets, when it sets this field. */
  globalText?: string;
  onReset: () => void;
  hasShared: boolean;
  canResetGlobal?: boolean;
  children: ReactNode;
  disabled?: boolean;
  note?: string;
};

/** Every control shows the effective value; below it, where the value comes from and what the template says. */
function FieldFrame({ label, source, scope, templateText, globalText, onReset, hasShared, canResetGlobal, children, disabled, note }: FieldFrame) {
  // A reset removes the override of the active scope; the label says where the value returns to.
  const resettable = scope === "global" ? Boolean(canResetGlobal) : source === "document";
  const resetLabel = scope === "global" && source === "document" ? "Globalen Wert entfernen"
    : scope === "document" && hasShared ? "Auf übernommenen Wert zurücksetzen" : "Auf Vorlagenwert zurücksetzen";
  return <div className={`rds-field${source === "template" ? "" : ` rds-field--${source}`}${disabled ? " rds-field--disabled" : ""}`}>
    <span className="rds-field__label">
      {label}
      {source !== "template" ? <b className={`rds-badge rds-badge--${source}`}>{sourceLabel[source]}</b> : null}
    </span>
    {children}
    <span className="rds-field__hint">
      <span>Vorlage: {templateText}{globalText ? ` · Global: ${globalText}` : ""}</span>
      {resettable ? <button type="button" className="rds-link" onClick={onReset} disabled={disabled}>
        <RotateCcw size={10} aria-hidden="true" /> {resetLabel}
      </button> : null}
    </span>
    {note ? <span className="rds-field__note">{note}</span> : null}
  </div>;
}

function NumberField({
  label, unit, value, templateValue, globalValue, min, max, step, source, scope, hasShared, canResetGlobal, disabled, note, onCommit, onReset,
}: {
  label: string; unit: string; value: number; templateValue: number; globalValue?: number; min: number; max: number; step: number;
  source: ResumeDesignSource; scope: DesignScope; hasShared: boolean; canResetGlobal?: boolean; disabled?: boolean; note?: string;
  onCommit: (value: number) => void; onReset: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(german(value));
  useEffect(() => setText(german(value)), [value]);
  const parse = (raw: string) => Number(raw.trim().replace(",", "."));
  const clamp = (entered: number) => Math.round(Math.max(min, Math.min(max, entered)) * 100) / 100;
  const apply = (entered: number) => { const next = clamp(entered); setText(german(next)); if (next !== value) onCommit(next); };
  const key = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const entered = parse(text);
    apply((Number.isFinite(entered) ? entered : value) + (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1));
  };
  const titled = `${label}${unit ? ` (${unit})` : ""}`;
  return <FieldFrame label={titled} source={source} scope={scope} hasShared={hasShared} canResetGlobal={canResetGlobal} onReset={onReset} disabled={disabled} note={note}
    templateText={`${german(templateValue)}${unit ? ` ${unit}` : ""}`} globalText={globalValue === undefined ? undefined : `${german(globalValue)}${unit ? ` ${unit}` : ""}`}>
    <span className="rds-input">
      <input id={id} type="text" inputMode="decimal" role="spinbutton" aria-label={titled}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} autoComplete="off" disabled={disabled} value={text}
        onChange={(event) => {
          setText(event.target.value);
          const entered = parse(event.target.value);
          // A value inside the limits applies while typing; anything else waits until the field is left.
          if (event.target.value.trim() !== "" && Number.isFinite(entered) && entered >= min && entered <= max && entered !== value) onCommit(entered);
        }}
        onBlur={() => { const entered = parse(text); if (text.trim() === "" || !Number.isFinite(entered)) setText(german(value)); else apply(entered); }}
        onKeyDown={key} />
    </span>
  </FieldFrame>;
}

function SelectField({
  label, value, options, templateText, globalText, source, scope, hasShared, canResetGlobal, disabled, onChange, onReset,
}: {
  label: string; value: string; options: readonly (readonly [string, string])[]; templateText: string; globalText?: string;
  source: ResumeDesignSource; scope: DesignScope; hasShared: boolean; canResetGlobal?: boolean; disabled?: boolean;
  onChange: (value: string) => void; onReset: () => void;
}) {
  return <FieldFrame label={label} source={source} scope={scope} hasShared={hasShared} canResetGlobal={canResetGlobal} onReset={onReset} disabled={disabled}
    templateText={templateText} globalText={globalText}>
    <span className="rds-input">
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </span>
  </FieldFrame>;
}

function CheckField({
  label, checked, templateText, globalText, source, scope, hasShared, canResetGlobal, disabled, onChange, onReset,
}: {
  label: string; checked: boolean; templateText: string; globalText?: string; source: ResumeDesignSource; scope: DesignScope;
  hasShared: boolean; canResetGlobal?: boolean; disabled?: boolean; onChange: (checked: boolean) => void; onReset: () => void;
}) {
  return <FieldFrame label={label} source={source} scope={scope} hasShared={hasShared} canResetGlobal={canResetGlobal} onReset={onReset} disabled={disabled}
    templateText={templateText} globalText={globalText}>
    <label className="rds-check">
      <input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? "Ja" : "Nein"}</span>
    </label>
  </FieldFrame>;
}

function Group({ title, summary, children, defaultOpen = false }: { title: string; summary: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="rds-group" open={defaultOpen || undefined}>
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
export function ResumeDesignPanel({ templateId, templateName, settings, global, hasSidebar, unsaved = false, onEditToken, onEditAppearance, onPreset, onReset }: ResumeDesignPanelProps) {
  const [scope, setScope] = useState<DesignScope>("global");
  const view: ResumeDesignView = useMemo(() => resolveResumeDesignView(templateId, settings, global), [templateId, settings, global]);
  const { native, effective } = view;
  const sharedCount = countOverrides(global);
  const ownCount = countOverrides({ cvOverrides: settings.cvOverrides, resumeAppearance: settings.resumeAppearance });
  const hasShared = view.hasGlobalOverrides;
  const preset: ResumeSpacingPreset = getResumeSpacingPreset(templateId, settings, global);

  const sharedToken = (group: TokenGroup, key: string): number | string | boolean | undefined =>
    (global?.cvOverrides?.[group] as Record<string, Value | undefined> | undefined)?.[key];
  const sharedAppearance = (key: keyof ResumeAppearance): Value | undefined => (global?.resumeAppearance as Record<string, Value | undefined> | undefined)?.[key];
  const frame = { scope, hasShared };
  const token = (group: TokenGroup, key: string) => ({
    source: view.sourceOfToken(group, key as never), canResetGlobal: sharedToken(group, key) !== undefined,
    onReset: () => onEditToken(scope, group, key, undefined), ...frame,
  });
  const appearance = (key: keyof ResumeAppearance) => ({
    source: view.sourceOfAppearance(key),
    canResetGlobal: key === "sectionDividerPosition" || key === "sectionDividerVisible"
      ? sharedAppearance("sectionDividerPosition") !== undefined || sharedAppearance("sectionDividerVisible") !== undefined
      : sharedAppearance(key) !== undefined,
    onReset: () => onEditAppearance(scope, key, undefined), ...frame,
  });
  const tokenNumber = (group: TokenGroup, key: string, label: string, unit: string, min: number, max: number, step: number, note?: string) => {
    const read = (tokens: CvDesignTokens) => (tokens[group] as Record<string, number>)[key];
    const shared = sharedToken(group, key);
    return <NumberField key={`${group}.${key}`} label={label} unit={unit} min={min} max={max} step={step} note={note}
      value={read(effective.tokens)} templateValue={read(native.tokens)} globalValue={typeof shared === "number" ? shared : undefined}
      onCommit={(value) => onEditToken(scope, group, key, value)} {...token(group, key)} />;
  };
  const dividerText = (position: ResolvedResumeAppearance["sectionDividerPosition"]) => dividerLabels[position];

  return <section className="rds" aria-label="Lebenslauf-Designsystem">
    <header className="rds-header">
      <div className="rds-header__top">
        <div className="rds-title">
          <strong>Lebenslauf-Design</strong>
          <small>Gleiche Einstellungen für alle Vorlagen – ohne Änderung zeigt jede Vorlage ihren eigenen Stil.</small>
        </div>
        <button type="button" className="rds-reset" onClick={() => onReset(scope)}
          disabled={scope === "global" ? !hasShared : !ownCount}>
          <RotateCcw size={13} aria-hidden="true" /> {scope === "global" ? "Vorlagenwerte wiederherstellen" : "Eigene Werte entfernen"}
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
        <b className={`rds-chip${ownCount ? " rds-chip--document" : ""}`}>{ownCount ? `${ownCount} Anpassung${ownCount === 1 ? "" : "en"} dieser Bewerbung` : "Keine eigenen Anpassungen"}</b>
        {unsaved ? <b className="rds-chip rds-chip--document">Nicht gespeichert</b> : null}
        {scope === "global" && ownCount ? <><span>Eigene Werte dieser Bewerbung haben Vorrang.</span>
          <button type="button" className="rds-link" onClick={() => onReset("document")}>Eigene Werte dieser Bewerbung entfernen</button></> : null}
      </p>
    </header>

    <Group title="Farben und Dekoration" summary="Farben, Abschnittstitel, Linien, Foto und Kopfbereich" defaultOpen>
      {colorGroups.map(([title, colors]) => <section className="rds-sub" key={title} aria-label={title}>
        <h4>{title}</h4>
        <div className="rds-grid rds-grid--colors">
          {colors.map(([key, label]) => {
            const shared = sharedToken("colors", key);
            const source = view.sourceOfToken("colors", key);
            return <ColorCard key={key} label={label} value={effective.tokens.colors[key]} onChange={(color) => onEditToken(scope, "colors", key, color)}>
              <ColorHint source={source} scope={scope} hasShared={hasShared} templateText={native.tokens.colors[key].toUpperCase()}
                globalText={typeof shared === "string" ? shared.toUpperCase() : undefined} onReset={() => onEditToken(scope, "colors", key, undefined)} />
            </ColorCard>;
          })}
        </div>
      </section>)}
      {!hasReadableColorContrast(effective.tokens.colors.paragraph, effective.tokens.colors.background) ? (
        <p className="resume-sections-warning" role="status">
          Der Kontrast zwischen Lesetext und Hintergrund ist zu niedrig. Für gute Lesbarkeit bitte eine hellere oder dunklere Textfarbe wählen.
        </p>
      ) : null}
      <section className="rds-sub" aria-label="Spalten und Dekoration">
        <h4>Spalten und Dekoration</h4>
        {!hasSidebar ? <p className="rds-note">Die Farben der Seitenspalte wirken nur bei einem zweispaltigen Layout.</p> : null}
        <div className="rds-grid rds-grid--colors">
          {[...columnColors, ...decorationColors].map(([key, label]) => {
            const shared = sharedAppearance(key);
            const side = (columnColors as readonly (readonly [string, string])[]).slice(0, 3).some(([name]) => name === key);
            return <ColorCard key={key} label={label} value={effective.appearance[key]} disabled={side && !hasSidebar}
              onChange={(color) => onEditAppearance(scope, key, color)}>
              <ColorHint source={view.sourceOfAppearance(key)} scope={scope} hasShared={hasShared} templateText={native.appearance[key].toUpperCase()}
                globalText={typeof shared === "string" ? shared.toUpperCase() : undefined} onReset={() => onEditAppearance(scope, key, undefined)} />
            </ColorCard>;
          })}
        </div>
      </section>

      {hasSidebar && !hasReadableColorContrast(effective.appearance.sidebarTextColor, effective.appearance.sidebarBackgroundColor) ? (
        <p className="resume-sections-warning" role="status">Der Kontrast zwischen Seitenspalten-Text und Hintergrund ist zu niedrig.</p>
      ) : null}
      <Sub title="Abschnittstitel">
        <SelectField label="Ausrichtung Abschnittstitel" value={effective.appearance.sectionHeadingAlignment}
          options={(["left", "center", "right"] as const).map((key) => [key, key === native.appearance.sectionHeadingAlignment ? `${alignmentLabels[key]} (Vorlage)` : alignmentLabels[key]] as const)}
          templateText={alignmentLabels[native.appearance.sectionHeadingAlignment]}
          globalText={sharedAppearance("sectionHeadingAlignment") ? alignmentLabels[sharedAppearance("sectionHeadingAlignment") as keyof typeof alignmentLabels] : undefined}
          onChange={(value) => onEditAppearance(scope, "sectionHeadingAlignment", value)} {...appearance("sectionHeadingAlignment")} />
        <NumberField label="Abstand davor" unit="mm" min={resumeAppearanceLimits.sectionHeadingMarginBeforeMm[0]} max={resumeAppearanceLimits.sectionHeadingMarginBeforeMm[1]} step={0.5}
          value={effective.appearance.sectionHeadingMarginBeforeMm} templateValue={native.appearance.sectionHeadingMarginBeforeMm}
          globalValue={sharedAppearance("sectionHeadingMarginBeforeMm") as number | undefined} note="Zusätzlich zum Abschnittsabstand."
          onCommit={(value) => onEditAppearance(scope, "sectionHeadingMarginBeforeMm", value)} {...appearance("sectionHeadingMarginBeforeMm")} />
        {tokenNumber("spacing", "sectionTitleGapMm", "Abstand danach", "mm", cvDesignLimits.sectionTitleGapMm[0], cvDesignLimits.sectionTitleGapMm[1], 0.1, "Das ist der Abstand nach Abschnittstitel.")}
      </Sub>

      <Sub title="Linien und Foto">
        <SelectField label="Abschnittslinie" value={effective.appearance.sectionDividerPosition}
          options={(["none", "bottom", "top", "both"] as const).map((key) => [key, key === native.appearance.sectionDividerPosition ? `${dividerLabels[key]} (Vorlage)` : dividerLabels[key]] as const)}
          templateText={dividerText(native.appearance.sectionDividerPosition)}
          onChange={(value) => onEditAppearance(scope, "sectionDividerPosition", value)} {...appearance("sectionDividerPosition")} />
        <NumberField label="Linienstärke" unit="mm" min={resumeAppearanceLimits.sectionDividerWidthMm[0]} max={resumeAppearanceLimits.sectionDividerWidthMm[1]} step={0.05}
          value={effective.appearance.sectionDividerWidthMm} templateValue={native.appearance.sectionDividerWidthMm} disabled={!effective.appearance.sectionDividerVisible}
          globalValue={sharedAppearance("sectionDividerWidthMm") as number | undefined}
          onCommit={(value) => onEditAppearance(scope, "sectionDividerWidthMm", value)} {...appearance("sectionDividerWidthMm")} />
        <CheckField label="Fotolinien sichtbar" checked={effective.appearance.photoDecorationVisible} templateText={native.appearance.photoDecorationVisible ? "sichtbar" : "keine"}
          onChange={(checked) => onEditAppearance(scope, "photoDecorationVisible", checked)} {...appearance("photoDecorationVisible")} />
        <SelectField label="Foto-Layout" value={effective.appearance.photoLayout}
          options={(["circle", "rounded", "square", "hidden"] as const).map((key) => [key, key === native.appearance.photoLayout ? `${photoLabels[key]} (Vorlage)` : photoLabels[key]] as const)}
          templateText={photoLabels[native.appearance.photoLayout]}
          onChange={(value) => onEditAppearance(scope, "photoLayout", value)} {...appearance("photoLayout")} />
        <SelectField label="Kopfbereich" value={effective.appearance.headerLayout}
          options={(["left", "center", "split"] as const).map((key) => [key, key === native.appearance.headerLayout ? `${headerLabels[key]} (Vorlage)` : headerLabels[key]] as const)}
          templateText={headerLabels[native.appearance.headerLayout]}
          onChange={(value) => onEditAppearance(scope, "headerLayout", value)} {...appearance("headerLayout")} />
      </Sub>
    </Group>

    <Group title="Typografie im Detail" summary="Schriften, Größen, Zeilenhöhe und Gewichte">
      <Sub title="Schrift">
        {(["fontId", "headingFontId"] as const).map((key) => {
          const shared = sharedToken("typography", key);
          const nameOf = (id: string) => documentFonts.find((font) => font.id === id)?.name ?? id;
          return <SelectField key={key} label={key === "fontId" ? "Schriftart" : "Überschrift-Schriftart"} value={effective.tokens.typography[key]}
            options={documentFonts.map((font) => [font.id, font.id === native.tokens.typography[key] ? `${font.name} (Vorlage)` : font.name] as const)}
            templateText={nameOf(native.tokens.typography[key])} globalText={typeof shared === "string" ? nameOf(shared) : undefined}
            onChange={(value) => onEditToken(scope, "typography", key, value)} {...token("typography", key)} />;
        })}
      </Sub>
      <Sub title="Größen und Zeilenhöhe">
        {sizeFields.map(([key, label]) => tokenNumber("typography", key, `${label}`, "pt", cvDesignLimits[key][0], cvDesignLimits[key][1], 0.1))}
        {tokenNumber("typography", "lineHeight", "Zeilenhöhe", "", cvDesignLimits.lineHeight[0], cvDesignLimits.lineHeight[1], 0.01)}
      </Sub>
      <Sub title="Gewichte und Schreibweise">
        {weightFields.map(([key, label]) => {
          const current = effective.tokens.typography[key];
          const shared = sharedToken("typography", key);
          const weights = [...new Set([...standardWeights, current, native.tokens.typography[key]])].sort((first, second) => first - second);
          return <SelectField key={key} label={label} value={String(current)}
            options={weights.map((weight) => [String(weight), weight === native.tokens.typography[key] ? `${weight} (Vorlage)` : String(weight)] as const)}
            templateText={String(native.tokens.typography[key])} globalText={typeof shared === "number" ? String(shared) : undefined}
            onChange={(value) => onEditToken(scope, "typography", key, Number(value))} {...token("typography", key)} />;
        })}
        <CheckField label="Abschnittstitel großschreiben" checked={effective.tokens.typography.sectionHeadingUppercase}
          templateText={native.tokens.typography.sectionHeadingUppercase ? "ja" : "nein"}
          globalText={typeof sharedToken("typography", "sectionHeadingUppercase") === "boolean" ? (sharedToken("typography", "sectionHeadingUppercase") ? "ja" : "nein") : undefined}
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
          "spacing", key, spacingTitles[key], "mm", cvDesignLimits[key][0], cvDesignLimits[key][1], 0.1, spacingNotes[key]))}
      </Sub>
      <p className="rds-note">Der Abstand nach dem Abschnittstitel und die Zeilenhöhe stehen nur einmal im Panel: unter „Abschnittstitel“ bzw. „Typografie im Detail“.</p>
    </Group>
  </section>;
}

/** The line below a colour: the template's value, a shared value if one exists, and the way back. */
function ColorHint({ source, scope, hasShared, templateText, globalText, onReset }: {
  source: ResumeDesignSource; scope: DesignScope; hasShared: boolean; templateText: string; globalText?: string; onReset: () => void;
}) {
  const resettable = scope === "global" ? globalText !== undefined : source === "document";
  return <span className="rds-field__hint">
    <span>{source !== "template" ? <b className={`rds-badge rds-badge--${source}`}>{sourceLabel[source]}</b> : null} Vorlage: {templateText}{globalText ? ` · Global: ${globalText}` : ""}</span>
    {resettable ? <button type="button" className="rds-link" onClick={onReset}>
      <RotateCcw size={10} aria-hidden="true" /> {scope === "global" && source === "document" ? "Globalen Wert entfernen"
        : scope === "document" && hasShared ? "Auf übernommenen Wert zurücksetzen" : "Auf Vorlagenwert zurücksetzen"}
    </button> : null}
  </span>;
}
