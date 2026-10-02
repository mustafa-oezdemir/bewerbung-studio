import { ImagePlus, PenLine, X } from "lucide-react";
import type { ProfileMediaKind } from "../../shared/ipc";

/**
 * The card for a picture of the profile (Bewerbungsfoto, Unterschrift): preview, short description and the
 * buttons to pick, replace and remove it. The photo section passes its own button texts and the file name.
 */
export function ProfileMediaCard({
  kind,
  label,
  description,
  source,
  onPick,
  onRemove,
  fileName,
  pickLabel,
  removeLabel,
  emptyText,
}: {
  kind: ProfileMediaKind;
  label: string;
  description: string;
  source: string;
  onPick: () => void;
  onRemove: () => void;
  /** The name of the file the picture came from, while it is known. */
  fileName?: string;
  /** Text buttons instead of the compact ones, e.g. "Foto auswählen" / "Foto entfernen". */
  pickLabel?: { select: string; replace: string };
  removeLabel?: string;
  /** Shown while no picture is selected. */
  emptyText?: string;
}) {
  const Icon = kind === "photo" ? ImagePlus : PenLine;
  return (
    <article className={`profile-media-card media-${kind}`}>
      <div className="profile-media-preview">
        {source ? (
          <img src={source} alt={`${label} Vorschau`} />
        ) : (
          <Icon size={28} />
        )}
      </div>
      <div>
        <strong>{label}</strong>
        {!source && emptyText ? <small>{emptyText}</small> : null}
        {source && fileName ? <small>Datei: {fileName}</small> : null}
        <small>{description}</small>
        <div className="profile-media-actions">
          <button
            className="button secondary small-button"
            type="button"
            onClick={onPick}>
            <Icon size={15} />{" "}
            {source
              ? (pickLabel?.replace ?? "Ersetzen")
              : (pickLabel?.select ?? "Auswählen")}
          </button>
          {source && removeLabel ? (
            <button
              className="button tertiary small-button"
              type="button"
              onClick={onRemove}>
              <X size={15} /> {removeLabel}
            </button>
          ) : source ? (
            <button
              className="icon-button danger"
              type="button"
              aria-label={`${label} entfernen`}
              onClick={onRemove}>
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
