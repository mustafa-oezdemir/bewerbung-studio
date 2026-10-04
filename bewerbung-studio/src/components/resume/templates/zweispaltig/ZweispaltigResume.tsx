import type { CSSProperties } from "react";
import { zweispaltigDefaults } from "./zweispaltig.defaults";
import type { ZweispaltigResumeProps } from "./zweispaltig.types";
import { ZweispaltigPage } from "./ZweispaltigPage";
import "./zweispaltig.css";

export function ZweispaltigResume({
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
}: ZweispaltigResumeProps) {
  const normalizedAccent = accentColor.toUpperCase();
  const normalizedSecondary = secondaryColor.toUpperCase();
  const primary =
    !accentColor || normalizedAccent === "#165DAA"
      ? zweispaltigDefaults.colors.primary
      : accentColor;
  const highlight =
    !secondaryColor || normalizedSecondary === "#EAF2FA"
      ? zweispaltigDefaults.colors.accent
      : secondaryColor;
  const variables = {
    "--zweispaltig-primary": atsMode
      ? zweispaltigDefaults.colors.primaryDark
      : primary,
    "--zweispaltig-accent": highlight,
    "--zweispaltig-section-gap-base": `${zweispaltigDefaults.layout.sectionGapMm}mm`,
    "--zweispaltig-left-ratio": `${zweispaltigDefaults.layout.leftColumnRatio}fr`,
    "--zweispaltig-right-ratio": `${zweispaltigDefaults.layout.rightColumnRatio}fr`,
  } as CSSProperties;

  return (
    <article
      className="zweispaltig-template"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={variables}
    >
      <ZweispaltigPage
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

export default ZweispaltigResume;
