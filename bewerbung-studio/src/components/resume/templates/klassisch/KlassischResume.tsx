import type { CSSProperties } from "react";
import { klassischDefaults, klassischDesign } from "./klassisch.defaults";
import { getKlassischDesignVariables } from "../../../../shared/klassischDesign";
import "./klassisch.css";
import { KlassischPage } from "./KlassischPage";
import type { KlassischResumeProps } from "./klassisch.types";

/** The native Klassisch variables; the managed output replaces them with the document's resolved design. */
const nativeVariables = getKlassischDesignVariables(klassischDesign.tokens);

export function KlassischResume({
  accentColor,
  secondaryColor,
  ...props
}: KlassischResumeProps) {
  const variables = {
    ...nativeVariables,
    "--klassisch-primary":
      accentColor || klassischDefaults.colors.primary,
    "--klassisch-accent":
      secondaryColor || klassischDefaults.colors.accent,
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
