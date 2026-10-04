import { toElegantExternalHref } from "./elegant.model";
import type { ElegantFooterProps } from "./elegant.types";

export function ElegantFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: ElegantFooterProps) {
  if (atsMode) return null;

  const portfolio = profile?.portfolio || profile?.github || profile?.linkedin;
  const portfolioHref = portfolio
    ? toElegantExternalHref(portfolio)
    : "";

  return (
    <footer className="elegant-footer" data-element-id="elegant.footer">
      {portfolio ? (
        <a href={portfolioHref}>{portfolioHref}</a>
      ) : (
        <span />
      )}
      {totalPages > 1 ? (
        <p>
          Seite {pageNumber} von {totalPages}
        </p>
      ) : null}
    </footer>
  );
}
