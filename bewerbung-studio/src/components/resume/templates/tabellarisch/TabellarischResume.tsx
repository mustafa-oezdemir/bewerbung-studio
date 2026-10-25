/**
 * Tabellarisch Template - Main Resume Component
 * Modern timeline-based CV template for experienced professionals
 */

import type { CSSProperties } from "react";
import { TabellarischPage } from "./TabellarischPage";
import { tabellarischAtsColor, tabellarischDefaults } from "./tabellarisch.defaults";
import type { TabellarischResumeProps } from "./tabellarisch.types";
import "./tabellarisch.css";

export function TabellarischResume({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  accentColor,
  secondaryColor,
  photoSource,
  resumeProfile,
  sections,
}: TabellarischResumeProps) {
  const cssVariables = {
    "--tabellarisch-primary":
      atsMode && secondaryColor?.toUpperCase() === tabellarischDefaults.colors.primary.toUpperCase()
        ? tabellarischAtsColor : secondaryColor || tabellarischDefaults.colors.primary,
    "--tabellarisch-accent":
      atsMode && accentColor?.toUpperCase() === tabellarischDefaults.colors.accent.toUpperCase()
        ? tabellarischAtsColor : accentColor || tabellarischDefaults.colors.accent,
  } as CSSProperties;

  return (
    <article
      className="tabellarisch-template tabellarisch-page"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={cssVariables}
    >
      <TabellarischPage
        profile={profile}
        name={name}
        atsMode={atsMode}
        plan={plan}
        totalPages={totalPages}
        photoSource={photoSource}
        resumeProfile={resumeProfile}
        sections={sections}
      />
    </article>
  );
}

export default TabellarischResume;
