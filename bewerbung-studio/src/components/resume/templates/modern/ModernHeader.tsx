/**
 * ModernHeader component
 * Renders header with name, profession, and optional profile photo
 */

import type { ModernHeaderProps } from "./modern.types";
import { parseTemplateStrengths } from "../resume-template-data";
import { getProfessionalTitle } from "../../../../shared/profileSelection";

export function ModernHeader({
  name,
  profile,
  accentColor,
  photoSource,
  atsMode,
  compact = false,
  children,
}: ModernHeaderProps) {
  const hasPhoto = !compact && !atsMode && photoSource;
  const title = getProfessionalTitle(profile);
  const specialties =
    title.length < 48
      ? parseTemplateStrengths(profile, 2).map((item) => item.title)
      : [];
  const profession = [title, ...specialties].filter(Boolean).join(" | ");

  return (
    <header
      className={`modern-resume-header ${compact ? "modern-resume-header--compact" : ""}`}
      data-no-photo={!hasPhoto}
    >
      <div className="modern-resume-header__identity">
        {compact ? <p className="modern-resume-header__kicker">Lebenslauf · Fortsetzung</p> : null}
        <h1 className="modern-resume-header__name">{name}</h1>
        {profession ? <p className="modern-resume-header__profession">{profession}</p> : null}
        {children}
      </div>
      {hasPhoto && (
        <div className="modern-resume-header__photo">
          <img src={photoSource} alt={`Profilfoto von ${name}`} />
        </div>
      )}
    </header>
  );
}
