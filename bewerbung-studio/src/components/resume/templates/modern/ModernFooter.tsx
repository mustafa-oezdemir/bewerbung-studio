/**
 * ModernFooter component
 * Renders page footer with portfolio/website and page numbers
 */

import type { ModernFooterProps } from "./modern.types";

export function ModernFooter({
  pageNumber,
  totalPages,
  portfolio = "",
  atsMode,
}: ModernFooterProps) {
  return (
    <footer className="modern-resume-footer">
      <div className="modern-resume-footer__left">{portfolio}</div>
      <div className="modern-resume-footer__right">
        {atsMode ? null : `Seite ${pageNumber} / ${totalPages}`}
      </div>
    </footer>
  );
}
