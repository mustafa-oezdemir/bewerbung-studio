import { resolveResumeHeading, type ResumeHeadingSource } from "../../../../shared/resumeHeading";
export function KompaktHeader({
  name,
  title,
  profile,
  compact = false,
  photoSource,
}: {
  name: string;
  title?: string;
  profile?: ResumeHeadingSource;
  compact?: boolean;
  photoSource?: string | null;
}) {
  return (
    <header
      className={`kompakt-header${compact ? " kompakt-header--compact" : ""}${photoSource ? " kompakt-header--with-photo" : ""}`}
      data-element-id="kompakt.header"
    >
      {compact ? <p>{resolveResumeHeading(profile).continuationKicker}</p> : null}
      <h1>{name}</h1>
      {title ? <h2>{title}</h2> : null}
      {photoSource ? (
        <img className="kompakt-header__photo" src={photoSource} alt="" />
      ) : null}
    </header>
  );
}
