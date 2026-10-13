import { Plus, Trash2 } from "lucide-react";
import { OrderControls } from "./OrderControls";
import { moveListItem } from "../../shared/listOrder";
import { useState } from "react";
import type { ApplicantProfile } from "../../shared/schema";
import {
  certificateEntries, certificateFields, createCertificateId, formatCertificate, parseCertificate, parseCertificateLines,
  type CertificateEntry, type CertificateParts,
} from "../../shared/certificates";

type EntryListEditorProps = {
  values: string[];
  onChange: (values: string[]) => void;
  addLabel?: string;
  emptyText?: string;
  placeholder?: string;
  multiline?: boolean;
};

export function EntryListEditor({
  values,
  onChange,
  addLabel = "Eintrag hinzufügen",
  emptyText = "Noch kein Eintrag vorhanden.",
  placeholder = "Eintrag",
  multiline = false,
}: EntryListEditorProps) {
  const update = (index: number, value: string) =>
    onChange(values.map((entry, current) => (current === index ? value : entry)));

  return (
    <div className="entry-list-editor">
      <div className="entry-list-editor__items">
        {values.map((value, index) => (
          <div className="entry-list-editor__row" key={index}>
            <OrderControls index={index} length={values.length} label={`Eintrag ${index + 1}`} onMove={(target) => onChange(moveListItem(values, index, target))} />
            <label className="field">
              <span>Eintrag {index + 1}</span>
              {multiline ? (
                <textarea
                  rows={2}
                  value={value}
                  placeholder={placeholder}
                  onChange={(event) => update(index, event.target.value)}
                />
              ) : (
                <input
                  value={value}
                  placeholder={placeholder}
                  onChange={(event) => update(index, event.target.value)}
                />
              )}
            </label>
            <button
              type="button"
              className="icon-button danger"
              aria-label={`Eintrag ${index + 1} löschen`}
              title="Eintrag löschen"
              onClick={() => onChange(values.filter((_, current) => current !== index))}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!values.length ? <p className="entry-list-editor__empty">{emptyText}</p> : null}
      </div>
      <button
        type="button"
        className="button secondary small-button align-start"
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}


/**
 * The certificates of a profile. Every change keeps each certificate's id (`certificationIds`, see certificates.ts), so
 * a Bewerbung that chose a certificate keeps it when its text is edited or the list is reordered.
 */
export function CertificateListEditor({
  profile,
  onChange,
}: {
  profile: Pick<ApplicantProfile, "certifications" | "certificationIds">;
  onChange: (fields: Pick<ApplicantProfile, "certifications" | "certificationIds">) => void;
}) {
  const entries = certificateEntries(profile);
  const values = entries.map((entry) => entry.text);
  const commit = (next: CertificateEntry[]) => onChange(certificateFields(next));
  const update = (index: number, change: Partial<CertificateParts>) =>
    commit(entries.map((entry, current) =>
      current === index ? { ...entry, text: formatCertificate({ ...parseCertificate(entry.text), ...change }) } : entry));
  const [pasted, setPasted] = useState("");
  const pastedLines = parseCertificateLines(pasted, values);

  return (
    <div className="certificate-list-editor">
      <div className="certificate-list-editor__items">
        {values.map((value, index) => {
          const certificate = parseCertificate(value);
          return (
            <article className="certificate-list-editor__card" key={index}>
              <OrderControls index={index} length={values.length} label={`Zertifikat ${index + 1}`} onMove={(target) => commit(moveListItem(entries, index, target))} />
              <div className="certificate-list-editor__fields">
                <label className="field">
                  <span>Zertifikat / Weiterbildung</span>
                  <input
                    value={certificate.title}
                    placeholder="z. B. Professional Scrum Master I"
                    onChange={(event) => update(index, { title: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Anbieter / Institution</span>
                  <input
                    value={certificate.provider}
                    placeholder="z. B. Scrum.org"
                    onChange={(event) => update(index, { provider: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Datum / Zeitraum</span>
                  <input
                    value={certificate.date}
                    placeholder="MM/JJJJ oder MM/JJJJ – MM/JJJJ"
                    onChange={(event) => update(index, { date: event.target.value })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Zertifikat ${index + 1} löschen`}
                title="Zertifikat löschen"
                onClick={() => commit(entries.filter((_, current) => current !== index))}
              >
                <Trash2 size={15} />
              </button>
            </article>
          );
        })}
        {!values.length ? (
          <p className="entry-list-editor__empty">Noch kein Zertifikat erfasst.</p>
        ) : null}
      </div>
      <button
        type="button"
        className="button secondary small-button align-start"
        onClick={() => commit([...entries, { id: createCertificateId(), text: "" }])}
      >
        <Plus size={15} /> Zertifikat hinzufügen
      </button>
      <details className="certificate-list-editor__paste">
        <summary>Liste einfügen</summary>
        <p className="field-hint">
          Ein Zertifikat pro Zeile: „Datum · Titel · Anbieter“ oder „Titel | Anbieter | Datum“.
          Bereits vorhandene Einträge werden übersprungen.
        </p>
        <label className="field">
          <span>Zertifikate (eine Zeile je Zertifikat)</span>
          <textarea rows={6} value={pasted} onChange={(event) => setPasted(event.target.value)}
            placeholder={"05/2026 · Professional Scrum Master I · Scrum.org"} />
        </label>
        <button
          type="button"
          className="button secondary small-button align-start"
          disabled={!pastedLines.length}
          onClick={() => {
            commit([...entries, ...pastedLines.map((text) => ({ id: createCertificateId(), text }))]);
            setPasted("");
          }}>
          <Plus size={15} /> {pastedLines.length === 1 ? "1 Zertifikat hinzufügen" : `${pastedLines.length} Zertifikate hinzufügen`}
        </button>
      </details>
    </div>
  );
}
