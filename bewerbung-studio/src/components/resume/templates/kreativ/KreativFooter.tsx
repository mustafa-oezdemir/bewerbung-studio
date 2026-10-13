import type { KreativFooterProps } from "./kreativ.types";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function KreativFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: KreativFooterProps) {
  if (atsMode) return null;
  const footerWebsite = resolveResumeFooterWebsite(profile);

  return (
    <footer
      className="kreativ-footer"
      data-element-id="kreativ.footer"
    >
      {footerWebsite ? (
        <a href={footerWebsite.href}>{footerWebsite.text}</a>
      ) : (
        <span />
      )}
      <span>
        Seite {pageNumber} / {totalPages}
      </span>
    </footer>
  );
}
