import { useState } from "react";
import { deviconOptions, dotnetIconOptions, otherDeviconOptions } from "../../shared/deviconCatalog";
import { goFrameworkIconOptions } from "../../shared/goFrameworkIcons";
import { categorySymbolOptions, getStrengthSymbolMarkup, strengthSymbolOptions } from "../../shared/strengthSymbols";
import { getVscodeIconEntry, vscodeIcons } from "../../shared/vscodeIconCatalog";
import { getMaterialIconEntry, materialIcons } from "../../shared/materialIconCatalog";
import { TechnologyBrandIcon } from "../resume/TechnologyBrandIcon";

type SourceFilter = "all" | "material" | "vscode" | "legacy";
type KindFilter = "all" | "file" | "folder";
const pageSize = 48;
const sourceFilters: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "Alle Quellen" }, { id: "material", label: "Material Icon Theme" },
  { id: "vscode", label: "vscode-icons" }, { id: "legacy", label: "Bisherige Icons" },
];
const kindFilters: { id: KindFilter; label: string }[] = [
  { id: "all", label: "Alle" }, { id: "file", label: "Datei-Icons" }, { id: "folder", label: "Ordner-Icons" },
];
const catalogIcons = [
  ...materialIcons.map((entry) => ({ id: entry.id, name: entry.name, kind: entry.kind, available: true, source: "Material Icon Theme" as const,
    search: `${entry.name} ${entry.concept}`.toLocaleLowerCase("en-US") })),
  ...vscodeIcons.map((entry) => ({ id: entry.id, name: entry.name, kind: entry.kind, available: entry.available, source: "vscode-icons" as const,
    search: `${entry.name} ${entry.name === "js" ? "javascript" : ""}`.toLocaleLowerCase("en-US") })),
];
export const filterCatalogIcons = (query: string, sourceFilter: SourceFilter, kindFilter: KindFilter) =>
  sourceFilter === "legacy" ? [] : catalogIcons
    .filter((entry) => (sourceFilter === "all" || sourceFilter === "material" && entry.source === "Material Icon Theme"
      || sourceFilter === "vscode" && entry.source === "vscode-icons")
      && (kindFilter === "all" || entry.kind === kindFilter)
      && entry.search.includes(query.trim().toLocaleLowerCase("en-US")))
    .sort((a, b) => Number(b.available) - Number(a.available) || Number(b.source === "Material Icon Theme") - Number(a.source === "Material Icon Theme") || a.name.localeCompare(b.name));

export function TechnologyIconPicker({ technologyTitle, value, onChange }: {
  technologyTitle: string; value: string; onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [page, setPage] = useState(0);
  const selected = getMaterialIconEntry(value) ?? getVscodeIconEntry(value);
  const selectedAvailable = Boolean(getMaterialIconEntry(value) || getVscodeIconEntry(value)?.available);
  const matching = filterCatalogIcons(query, sourceFilter, kindFilter);
  const lastPage = Math.max(0, Math.ceil(matching.length / pageSize) - 1);
  const visible = matching.slice(page * pageSize, (page + 1) * pageSize);
  const chooseSource = (next: SourceFilter) => { setSourceFilter(next); setPage(0); };
  const chooseKind = (next: KindFilter) => { setKindFilter(next); setPage(0); };

  return <div className="technology-icon-picker"><div className="field">
    <span>Symbol / Technologie-Icon</span>
    <div className="technology-icon-picker__examples">
      <div className="technology-icon-picker__example">
        <span className="technology-icon-picker__preview"><TechnologyBrandIcon technology={technologyTitle || "Technologie"} iconId={value} mode="original" /></span>
        <small>Deckblatt und Lebenslauf – Originalfarben</small>
      </div>
      <div className="technology-icon-picker__example technology-icon-picker__example--themed">
        <span className="technology-icon-picker__preview"><TechnologyBrandIcon technology={technologyTitle || "Technologie"} iconId={value} /></span>
        <small>Lebenslauf – mit gewählter Farbe</small>
      </div>
    </div>
    {(value.startsWith("vscode:") || value.startsWith("material:")) && !selectedAvailable ? <small role="status">Dieses Icon ist nicht enthalten: Lizenz oder SVG-Verfügbarkeit ungeklärt. Die automatische Auswahl bleibt sichtbar.</small> : null}
    <span className="technology-icon-picker__label">Icon-Quelle</span>
    <div className="technology-icon-picker__filters" role="group" aria-label="Icon-Quelle">
      {sourceFilters.map((option) => <button type="button" key={option.id} aria-pressed={sourceFilter === option.id}
        onClick={() => chooseSource(option.id)}>{option.label}</button>)}
    </div>
    <span className="technology-icon-picker__label">Arama</span>
    <input type="search" aria-label="Icons durchsuchen" placeholder="Icons durchsuchen …" value={query}
      onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
    <span className="technology-icon-picker__label">Typ</span>
    <div className="technology-icon-picker__filters" role="group" aria-label="Icon-Typ">
      {kindFilters.map((option) => <button type="button" key={option.id} aria-pressed={kindFilter === option.id}
        onClick={() => chooseKind(option.id)}>{option.label}</button>)}
    </div>
    {sourceFilter !== "legacy" ? <>
      <div className="technology-icon-picker__grid" role="group" aria-label="Icon-Katalog">
        {visible.map((entry) => <button type="button" key={entry.id}
          title={`${entry.name} · ${entry.source} (${entry.kind === "file" ? "Datei" : "Ordner"})${entry.available ? "" : " – Lizenz offen"}`}
          aria-label={`${entry.name}, ${entry.source}, ${entry.kind === "file" ? "Datei-Icon" : "Ordner-Icon"}${entry.available ? "" : ", nicht verfügbar"}`}
          aria-pressed={value === entry.id} disabled={!entry.available} onClick={() => onChange(entry.id)}>
          {entry.available ? <span className="technology-icon-picker__grid-icon"><TechnologyBrandIcon technology={entry.name} iconId={entry.id} mode="original" /></span> : <span className="technology-icon-picker__missing" aria-hidden="true">–</span>}
          <span className="technology-icon-picker__name">{entry.name}</span>
          <span className="technology-icon-picker__source">{entry.source}</span>
        </button>)}
      </div>
      {matching.length === 0 ? <small role="status">Keine Icons gefunden.</small> : null}
      <div className="technology-icon-picker__pages">
        <small>{matching.length} Katalogeinträge · {matching.filter((entry) => entry.available).length} verfügbar</small>
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Zurück</button>
        <span>Seite {page + 1} / {lastPage + 1}</span>
        <button type="button" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Weiter</button>
      </div>
    </> : null}
    {(sourceFilter === "all" || sourceFilter === "legacy") ? <div className="technology-icon-picker__legacy">
      <div className="strength-symbol-picker" role="group" aria-label="Aufzählungszeichen">
        {strengthSymbolOptions.map((option) => <button key={option.id} type="button" title={option.label}
          aria-label={option.label} aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}>{option.glyph}</button>)}
      </div>
      <div className="strength-symbol-picker strength-symbol-picker--categories" role="group" aria-label="Kategorie-Symbole">
        {categorySymbolOptions.map((option) => <button key={option.id} type="button" title={option.label}
          aria-label={option.label} aria-pressed={value === option.id}
          onClick={() => onChange(option.id)} dangerouslySetInnerHTML={{ __html: getStrengthSymbolMarkup(option.id) }} />)}
      </div>
      <select aria-label="Symbol / Technologie-Icon" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Automatisch nach Bezeichnung</option>
        {selected ? <option value={selected.id}>{selected.name} ({selected.kind === "file" ? "Datei" : "Ordner"})</option> : null}
        <optgroup label="Aufzählungszeichen">{strengthSymbolOptions.map((option) => <option key={option.id} value={option.id}>{option.glyph} {option.label}</option>)}</optgroup>
        <optgroup label="Kategorie-Symbole">{categorySymbolOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</optgroup>
        <optgroup label="Go-Frameworks und Tools">{goFrameworkIconOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</optgroup>
        <optgroup label="C# / .NET">{dotnetIconOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</optgroup>
        <optgroup label="Technologie-Icons">{otherDeviconOptions.map((option) => <option key={option.id} value={option.id}>{option.label} ({option.id})</option>)}</optgroup>
      </select>
      <small>Aufzählungszeichen übernehmen die Textfarbe, Kategorie-Symbole die Icon-Farbe der Vorlage. {deviconOptions.length} bisherige Technologie-Icons verfügbar.</small>
    </div> : null}
  </div></div>;
}
