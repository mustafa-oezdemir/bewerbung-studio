import type { CSSProperties } from "react";
import { einspaltigDesign } from "./einfach.defaults";
import { getEinspaltigDesignVariables } from "../../../../shared/einspaltigDesign";
import type { EinspaltigResumeProps } from "./einfach.types";
import { EinfachPage } from "./EinfachPage";
import "./einfach.css";

/** The native Einspaltig variables with the application's accent; the managed output replaces them with the resolved design. */
export function EinspaltigResume({
  accentColor,
  secondaryColor: _secondaryColor,
  ...props
}: EinspaltigResumeProps) {
  const variables = getEinspaltigDesignVariables(einspaltigDesign.tokens, undefined, accentColor) as CSSProperties;
  return (
    <article
      className="einfach-template"
      data-template="einspaltig"
      data-ats-mode={props.atsMode}
      data-continuation={props.plan.pageNumber > 1}
      data-density={props.plan.density}
      lang="de"
      style={variables}
    >
      <EinfachPage {...props} />
    </article>
  );
}

/** @deprecated Bestehende Importe werden auf Einspaltig weitergeleitet. */
export const EinfachResume = EinspaltigResume;

export default EinspaltigResume;
