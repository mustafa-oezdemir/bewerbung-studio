import type { CSSProperties } from "react";
import { einspaltigDefaults } from "./einfach.defaults";
import type { EinspaltigResumeProps } from "./einfach.types";
import { EinfachPage } from "./EinfachPage";
import "./einfach.css";

export function EinspaltigResume({
  accentColor,
  secondaryColor,
  ...props
}: EinspaltigResumeProps) {
  const variables = {
    "--einfach-primary":
      accentColor || einspaltigDefaults.colors.primary,
    "--einfach-accent":
      secondaryColor || einspaltigDefaults.colors.accent,
  } as CSSProperties;
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
