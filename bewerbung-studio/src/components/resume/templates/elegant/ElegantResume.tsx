import type { CSSProperties } from "react";
import { getElegantDesignVariables } from "../../../../shared/elegantDesign";
import { resolveEffectiveDesignTokens } from "../../../../shared/resumeDesignSystem";
import type { ElegantResumeProps } from "./elegant.types";
import { ElegantPage } from "./ElegantPage";
import "./elegant.css";

export function ElegantResume({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  accentColor,
  secondaryColor,
  design,
  designSettings,
  photoSource,
  resumeProfile,
  sections,
}: ElegantResumeProps) {
  const cssVariables = getElegantDesignVariables(
    design ?? (designSettings ? resolveEffectiveDesignTokens("elegant", designSettings) : undefined),
    designSettings, atsMode ? undefined : accentColor, secondaryColor,
  ) as CSSProperties;

  return (
    <article
      className="elegant-template"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={cssVariables}
    >
      <ElegantPage
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

export default ElegantResume;
