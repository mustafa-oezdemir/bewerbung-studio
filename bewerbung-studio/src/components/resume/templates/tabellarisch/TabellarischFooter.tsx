/**
 * Tabellarisch Template - Footer Component
 */

import type { TabellarischFooterProps } from "./tabellarisch.types";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function TabellarischFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: TabellarischFooterProps) {
  const footerWebsite = resolveResumeFooterWebsite(profile, atsMode);

  if (atsMode) return null;

  return (
    <footer
      className="tabellarisch-footer"
      data-element-id="tabellarisch.footer"
    >
      {footerWebsite ? (
        <p className="tabellarisch-footer__portfolio">
          <a href={footerWebsite.href}>{footerWebsite.text}</a>
        </p>
      ) : (
        <span />
      )}
      <p className="tabellarisch-footer__pages">
        Seite {pageNumber} von {totalPages}
      </p>
    </footer>
  );
}
