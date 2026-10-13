import { useId, useState } from "react";
import { OrderControls } from "../profile/OrderControls";
import { moveListItem } from "../../shared/listOrder";
import { parseCertificate, type CertificateEntry } from "../../shared/certificates";

/** The certificates shown in the order the Lebenslauf prints them: the chosen ones first, then the rest. */
export const certificateSelectionRows = (entries: readonly CertificateEntry[], selectedIds: readonly string[] | undefined) => {
  const chosen = selectedIds ?? entries.map((entry) => entry.id);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const selected = [...new Set(chosen)].flatMap((id) => byId.get(id) ?? []);
  const selectedSet = new Set(selected.map((entry) => entry.id));
  return {
    selected: selected.map((entry) => entry.id),
    rows: [...selected, ...entries.filter((entry) => !selectedSet.has(entry.id))]
      .map((entry) => ({ entry, parts: parseCertificate(entry.text), checked: selectedSet.has(entry.id) })),
  };
};

/** Ticking adds a certificate at the end of the order, unticking removes it. */
export const toggleCertificate = (selected: readonly string[], id: string, checked: boolean) =>
  checked ? [...selected.filter((current) => current !== id), id] : selected.filter((current) => current !== id);

/** „Alle auswählen“: the order chosen so far, then every other certificate in the profile's order. */
export const selectAllCertificates = (entries: readonly CertificateEntry[], selected: readonly string[]) =>
  [...selected, ...entries.map((entry) => entry.id).filter((id) => !selected.includes(id))];

/** The search only narrows the list on screen; it never changes the choice. */
export const filterCertificateRows = <Row extends { entry: CertificateEntry }>(rows: readonly Row[], query: string) => {
  const needle = query.trim().toLocaleLowerCase("de-DE");
  return needle ? rows.filter(({ entry }) => entry.text.toLocaleLowerCase("de-DE").includes(needle)) : [...rows];
};

/**
 * Which of the profile's certificates this Bewerbung's Lebenslauf shows, and in which order. The choice is the
 * Bewerbung's own (`resumePresentation.selectedCertificateIds`); the profile keeps every certificate. Without a choice
 * every certificate is shown in the profile's order.
 */
export function CertificateSelection({
  entries,
  selectedIds,
  onChange,
  initialQuery = "",
}: {
  entries: readonly CertificateEntry[];
  selectedIds: readonly string[] | undefined;
  onChange: (selectedIds: string[]) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const searchId = useId();
  const { selected, rows } = certificateSelectionRows(entries, selectedIds);
  const visibleRows = filterCertificateRows(rows, query);
  const toggle = (id: string, checked: boolean) => onChange(toggleCertificate(selected, id, checked));

  return (
    <section className="certificate-selection" aria-label="Zertifikate auswählen">
      <header>
        <strong>Zertifikate auswählen</strong>
        <small>
          Nur die ausgewählten Zertifikate erscheinen in diesem Lebenslauf, in dieser Reihenfolge. Die Auswahl gilt nur
          für diese Bewerbung; das Profil behält alle Zertifikate.
        </small>
      </header>
      {entries.length ? (
        <>
          <div className="certificate-selection__tools">
            <label className="field" htmlFor={searchId}>
              <span className="sr-only">Zertifikate suchen</span>
              <input id={searchId} type="search" value={query} placeholder="Zertifikate suchen …"
                onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button type="button" className="button secondary small-button"
              disabled={selected.length === entries.length}
              onClick={() => onChange(selectAllCertificates(entries, selected))}>
              Alle auswählen
            </button>
            <button type="button" className="button secondary small-button" disabled={!selected.length}
              onClick={() => onChange([])}>
              Auswahl aufheben
            </button>
          </div>
          <p className="certificate-selection__status" role="status">
            Ausgewählt: {selected.length} von {entries.length} Zertifikaten
          </p>
          <ul className="certificate-selection__list">
            {visibleRows.map(({ entry, parts, checked }) => {
              const name = parts.title || entry.text || "Zertifikat ohne Namen";
              const position = selected.indexOf(entry.id);
              return (
                <li key={entry.id} className={checked ? "is-selected" : undefined}>
                  <label className="certificate-selection__item">
                    <input type="checkbox" checked={checked} aria-label={`${name}: Im Lebenslauf anzeigen`}
                      onChange={(event) => toggle(entry.id, event.target.checked)} />
                    <span>
                      <strong>{name}</strong>
                      {parts.provider ? <small>{parts.provider}</small> : null}
                      {parts.date ? <small>{parts.date}</small> : null}
                    </span>
                  </label>
                  {checked ? (
                    <OrderControls index={position} length={selected.length} label={name}
                      onMove={(target) => onChange(moveListItem(selected, position, target))} />
                  ) : <span className="certificate-selection__hidden">Nicht im Lebenslauf</span>}
                </li>
              );
            })}
            {!visibleRows.length ? <li className="certificate-selection__empty">Kein Zertifikat passt zur Suche.</li> : null}
          </ul>
          <small>Im Lebenslauf anzeigen: Häkchen setzen. Die Reihenfolge der ausgewählten Zertifikate ist die des Lebenslaufs. Mit „Texte speichern“ sichern.</small>
        </>
      ) : (
        <p className="entry-list-editor__empty">Im Profil ist noch kein Zertifikat erfasst.</p>
      )}
    </section>
  );
}
