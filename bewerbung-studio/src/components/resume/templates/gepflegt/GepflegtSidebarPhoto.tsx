export interface GepflegtSidebarPhotoProps {
  photoSource: string | null;
  name: string;
  atsMode: boolean;
}

export function GepflegtSidebarPhoto({
  photoSource,
  name,
  atsMode,
}: GepflegtSidebarPhotoProps) {
  if (atsMode || !photoSource) {
    return null;
  }

  return (
    <figure
      className="gepflegt-sidebar__photo"
      data-element-id="gepflegt.profile-photo"
    >
      <img src={photoSource} alt={`Bewerbungsfoto von ${name}`} />
    </figure>
  );
}
