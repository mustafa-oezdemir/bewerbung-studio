import type { CSSProperties } from "react";
import { stilvollDefaults } from "./stilvoll.defaults";
import type { StilvollResumeProps } from "./stilvoll.types";
import { StilvollPage } from "./StilvollPage";
import "./stilvoll.css";

export function StilvollResume({
  accentColor,
  secondaryColor,
  ...props
}: StilvollResumeProps) {
  const variables = {
    "--stilvoll-primary": accentColor || stilvollDefaults.colors.primary,
    "--stilvoll-primary-dark": secondaryColor || stilvollDefaults.colors.primaryDark,
    "--stilvoll-header-content-gap": `${stilvollDefaults.layout.headerToContentGapMm}mm`,
    "--stilvoll-section-gap-base": `${stilvollDefaults.layout.sectionGapMm}mm`,
    "--stilvoll-entry-gap-base": `${stilvollDefaults.layout.entryGapMm}mm`,
    "--stilvoll-section-title-gap": `${stilvollDefaults.layout.sectionTitleGapMm}mm`,
    "--stilvoll-entry-content-gap": `${stilvollDefaults.layout.entryContentGapMm}mm`,
  } as CSSProperties;
  return (
    <article
      className="stilvoll-template"
      data-ats-mode={props.atsMode}
      data-continuation={props.plan.pageNumber > 1}
      data-density={props.plan.density}
      lang="de"
      style={variables}
    >
      <StilvollPage {...props} />
    </article>
  );
}

export default StilvollResume;
