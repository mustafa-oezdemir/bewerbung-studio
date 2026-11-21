import { ImagePlus, UserRound, X } from "lucide-react";
import { useState } from "react";

export function ContactPhotoField({ photo, onChange }: {
  photo?: string;
  onChange: (photo: string | undefined) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const pick = async () => {
    setPicking(true);
    setError("");
    try {
      const selected = await window.bewerbungsManager.media.pickContactPhoto();
      if (selected) onChange(selected.dataUrl);
    } catch {
      setError("Das Kontaktfoto konnte nicht geladen werden. Wählen Sie eine PNG- oder JPEG-Datei mit höchstens 8 MB.");
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="contact-photo-field full" role="group" aria-label="Kontaktfoto (optional)">
      <div className="contact-photo-preview">
        {photo ? <img src={photo} alt="Kontaktfoto" /> : <UserRound size={23} aria-hidden="true" />}
      </div>
      <div className="contact-photo-controls">
        <strong>Kontaktfoto <small>(optional)</small></strong>
        <div className="contact-photo-actions">
          <button type="button" className="button secondary small-button" disabled={picking} onClick={() => void pick()}>
            <ImagePlus size={15} aria-hidden="true" /> {photo ? "Foto ersetzen" : "Foto auswählen"}
          </button>
          {photo && (
            <button type="button" className="button tertiary small-button" disabled={picking} onClick={() => {
              setError("");
              onChange(undefined);
            }}>
              <X size={15} aria-hidden="true" /> Foto entfernen
            </button>
          )}
        </div>
        {error && <small role="alert">{error}</small>}
      </div>
    </div>
  );
}
