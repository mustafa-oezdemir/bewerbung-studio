import type { ZeitgenoessischFooterProps } from "./zeitgenoessisch.types";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function ZeitgenoessischFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: ZeitgenoessischFooterProps) {
  if (atsMode) return null;
  const footerWebsite = resolveResumeFooterWebsite(profile);

  return (
    <footer
      className="zeitgenoessisch-footer"
      data-element-id="zeitgenoessisch.footer"
    >
      {footerWebsite ? (
        <a href={footerWebsite.href}>{footerWebsite.text}</a>
      ) : (
        <span />
      )}
      {totalPages > 1 ? (
        <span>
          Seite {pageNumber} von {totalPages}
        </span>
      ) : null}
    </footer>
  );
}
