import type { CSSProperties } from "react";
import { kompaktDefaults } from "./kompakt.defaults";
import type { KompaktResumeProps } from "./kompakt.types";
import { KompaktPage } from "./KompaktPage";
import "./kompakt.css";

export function KompaktResume({
  accentColor,
  secondaryColor,
  ...props
}: KompaktResumeProps) {
  const variables = {
    "--kompakt-primary":
      accentColor || kompaktDefaults.colors.primary,
    "--kompakt-accent":
      secondaryColor || kompaktDefaults.colors.accent,
    "--kompakt-header-content-gap": `${kompaktDefaults.layout.headerToContentGapMm}mm`,
    "--kompakt-footer-clearance": `${kompaktDefaults.layout.footerClearanceMm}mm`,
    "--kompakt-section-gap-base": `${kompaktDefaults.layout.sectionGapMm}mm`,
    "--kompakt-entry-gap-base": `${kompaktDefaults.layout.entryGapMm}mm`,
    "--kompakt-section-title-gap": `${kompaktDefaults.layout.sectionTitleGapMm}mm`,
    "--kompakt-entry-content-gap": `${kompaktDefaults.layout.entryContentGapMm}mm`,
  } as CSSProperties;
  return (
    <article
      className="kompakt-template"
      data-ats-mode={props.atsMode}
      data-continuation={props.plan.pageNumber > 1}
      data-density={props.plan.density}
      lang="de"
      style={variables}
    >
      <KompaktPage {...props} />
    </article>
  );
}

export default KompaktResume;
