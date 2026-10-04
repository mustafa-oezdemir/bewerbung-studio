export function ZeitgenoessischPhoto({
  photoSource,
  name,
}: {
  photoSource: string | null;
  name: string;
}) {
  if (!photoSource) return null;

  return (
    <figure
      className="zeitgenoessisch-photo-composition"
      data-element-id="zeitgenoessisch.photo"
    >
      <span className="zeitgenoessisch-photo-shape zeitgenoessisch-photo-shape--pale" />
      <span className="zeitgenoessisch-photo-shape zeitgenoessisch-photo-shape--soft" />
      <span className="zeitgenoessisch-photo-shape zeitgenoessisch-photo-shape--accent" />
      <img
        className="zeitgenoessisch-photo"
        src={photoSource}
        alt={`Bewerbungsfoto von ${name}`}
      />
    </figure>
  );
}
