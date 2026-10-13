import type { ZweispaltigFooterProps } from "./zweispaltig.types";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function ZweispaltigFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: ZweispaltigFooterProps) {
  if (atsMode) return null;
  const footerWebsite = resolveResumeFooterWebsite(profile);

  return (
    <footer
      className="zweispaltig-footer"
      data-element-id="zweispaltig.footer"
    >
      {footerWebsite ? (
        <a href={footerWebsite.href}>{footerWebsite.text}</a>
      ) : (
        <span />
      )}
      <span>
        Seite {pageNumber} von {totalPages}
      </span>
    </footer>
  );
}
