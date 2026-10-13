import type { CSSProperties } from "react";
import { zweispaltigDefaults } from "./zweispaltig.defaults";
import { zweispaltigPageVariables } from "../../../../shared/cvTemplateDefaults/zweispaltig.defaults";
import { resolveTemplateCvDesign } from "../../../../shared/cvDesign";
import { getZweispaltigDesignVariables } from "../../../../shared/zweispaltigDesign";
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
  designVariables,
  photoSource,
  resumeProfile,
  sections,
}: ZweispaltigResumeProps) {
  const colors = designVariables ?? getZweispaltigDesignVariables(
    resolveTemplateCvDesign("zweispaltig"), undefined, accentColor, secondaryColor);
  const variables = {
    ...zweispaltigPageVariables,
    ...colors,
    "--zweispaltig-primary": atsMode
      ? zweispaltigDefaults.colors.primaryDark
      : colors["--zweispaltig-primary"],
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
