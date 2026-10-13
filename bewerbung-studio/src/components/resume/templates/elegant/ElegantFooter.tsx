import type { ElegantFooterProps } from "./elegant.types";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function ElegantFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: ElegantFooterProps) {
  if (atsMode) return null;

  const footerWebsite = resolveResumeFooterWebsite(profile);

  return (
    <footer className="elegant-footer" data-element-id="elegant.footer">
      {footerWebsite ? (
        <a href={footerWebsite.href}>{footerWebsite.text}</a>
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
