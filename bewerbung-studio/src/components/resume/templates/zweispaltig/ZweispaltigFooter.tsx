import { toZweispaltigExternalHref } from "./zweispaltig.model";
import type { ZweispaltigFooterProps } from "./zweispaltig.types";

export function ZweispaltigFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: ZweispaltigFooterProps) {
  if (atsMode) return null;
  const link = profile?.portfolio || profile?.github || profile?.linkedin;

  return (
    <footer
      className="zweispaltig-footer"
      data-element-id="zweispaltig.footer"
    >
      {link ? (
        <a href={toZweispaltigExternalHref(link)}>{link}</a>
      ) : (
        <span />
      )}
      <span>
        Seite {pageNumber} von {totalPages}
      </span>
    </footer>
  );
}
