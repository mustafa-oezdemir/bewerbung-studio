import type { CSSProperties } from "react";
import { klassischDefaults } from "./klassisch.defaults";
import "./klassisch.css";
import { KlassischPage } from "./KlassischPage";
import type { KlassischResumeProps } from "./klassisch.types";

export function KlassischResume({
  accentColor,
  secondaryColor,
  ...props
}: KlassischResumeProps) {
  const variables = {
    "--klassisch-primary":
      accentColor || klassischDefaults.colors.primary,
    "--klassisch-accent":
      secondaryColor || klassischDefaults.colors.accent,
    "--klassisch-entry-gap-base": `${klassischDefaults.layout.entryGapMm}mm`,
    "--klassisch-section-title-gap": `${klassischDefaults.layout.sectionTitleGapMm}mm`,
    "--klassisch-entry-content-gap": `${klassischDefaults.layout.entryContentGapMm}mm`,
  } as CSSProperties;
  return (
    <article
      className="klassisch-template"
      data-template="klassisch"
      data-ats-mode={props.atsMode}
      data-continuation={props.plan.pageNumber > 1}
      data-density={props.plan.density}
      lang="de"
      style={variables}
    >
      <KlassischPage {...props} />
    </article>
  );
}

export default KlassischResume;
