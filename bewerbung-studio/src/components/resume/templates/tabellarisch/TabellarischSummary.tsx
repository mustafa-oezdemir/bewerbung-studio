/**
 * Tabellarisch Template - Summary Component
 */

import type { TabellarischSummaryProps } from "./tabellarisch.types";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function TabellarischSummary({ text, profile }: TabellarischSummaryProps) {
  if (!text) return null;

  return (
    <section
      className="tabellarisch-section tabellarisch-summary"
      data-element-id="tabellarisch.summary"
    >
      <h2 className="tabellarisch-section__title">{getResumeSectionTitle(profile, "summary")}</h2>
      <p className="tabellarisch-summary__text">{text}</p>
    </section>
  );
}
