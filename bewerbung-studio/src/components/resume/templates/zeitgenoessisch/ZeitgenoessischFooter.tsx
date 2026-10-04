import { toZeitgenoessischExternalHref } from "./zeitgenoessisch.model";
import type { ZeitgenoessischFooterProps } from "./zeitgenoessisch.types";

export function ZeitgenoessischFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: ZeitgenoessischFooterProps) {
  if (atsMode) return null;
  const link = profile?.portfolio || profile?.github || profile?.linkedin;

  return (
    <footer
      className="zeitgenoessisch-footer"
      data-element-id="zeitgenoessisch.footer"
    >
      {link ? (
        <a href={toZeitgenoessischExternalHref(link)}>{link}</a>
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
