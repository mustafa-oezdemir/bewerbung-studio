/**
 * Tabellarisch Template - Footer Component
 */

import type { TabellarischFooterProps } from "./tabellarisch.types";
import { toExternalHref } from "./tabellarisch.model";

export function TabellarischFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: TabellarischFooterProps) {
  const portfolioUrl =
    profile?.portfolio || profile?.github || profile?.linkedin;

  if (atsMode) return null;

  return (
    <footer
      className="tabellarisch-footer"
      data-element-id="tabellarisch.footer"
    >
      {portfolioUrl ? (
        <p className="tabellarisch-footer__portfolio">
          <a href={toExternalHref(portfolioUrl)}>{portfolioUrl}</a>
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
