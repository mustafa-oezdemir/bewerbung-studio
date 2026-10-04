import { toKreativExternalHref } from "./kreativ.model";
import type { KreativFooterProps } from "./kreativ.types";

export function KreativFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: KreativFooterProps) {
  if (atsMode) return null;
  const link = profile?.portfolio || profile?.github || profile?.linkedin;

  return (
    <footer
      className="kreativ-footer"
      data-element-id="kreativ.footer"
    >
      {link ? (
        <a href={toKreativExternalHref(link)}>{link}</a>
      ) : (
        <span />
      )}
      <span>
        Seite {pageNumber} / {totalPages}
      </span>
    </footer>
  );
}
