import { Plus, Trash2 } from "lucide-react";
import { OrderControls } from "./OrderControls";
import { moveListItem } from "../../shared/listOrder";

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

type CertificateParts = {
  date: string;
  title: string;
  provider: string;
};

const parseCertificate = (value: string): CertificateParts => {
  const parts = value.split(/\s+·\s+/).map((part) => part.trim());
  if (parts.length >= 3) {
    return {
      date: parts[0],
      title: parts.slice(1, -1).join(" · "),
      provider: parts.at(-1) ?? "",
    };
  }
  const looksLikeDate = (part: string) =>
    /^(?:\d{2}[./-]\d{4}|\d{4}|seit\b|bis\b)/i.test(part);
  if (parts.length === 2) {
    return looksLikeDate(parts[0])
      ? { date: parts[0], title: parts[1], provider: "" }
      : { date: "", title: parts[0], provider: parts[1] };
  }
  return looksLikeDate(parts[0] ?? "")
    ? { date: parts[0], title: "", provider: "" }
    : { date: "", title: value.trim(), provider: "" };
};

const formatCertificate = ({ date, title, provider }: CertificateParts) =>
  [date.trim(), title.trim(), provider.trim()].filter(Boolean).join(" · ");

export function CertificateListEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const update = (index: number, change: Partial<CertificateParts>) =>
    onChange(
      values.map((value, current) =>
        current === index
          ? formatCertificate({ ...parseCertificate(value), ...change })
          : value,
      ),
    );

  return (
    <div className="certificate-list-editor">
      <div className="certificate-list-editor__items">
        {values.map((value, index) => {
          const certificate = parseCertificate(value);
          return (
            <article className="certificate-list-editor__card" key={index}>
              <OrderControls index={index} length={values.length} label={`Zertifikat ${index + 1}`} onMove={(target) => onChange(moveListItem(values, index, target))} />
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
                onClick={() => onChange(values.filter((_, current) => current !== index))}
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
        onClick={() => onChange([...values, ""])}
      >
        <Plus size={15} /> Zertifikat hinzufügen
      </button>
    </div>
  );
}
