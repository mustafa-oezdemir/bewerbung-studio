import type { GepflegtFooterProps } from "./gepflegt.types";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function GepflegtFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: GepflegtFooterProps) {
  const footerWebsite = resolveResumeFooterWebsite(profile, atsMode);

  if (atsMode || (!footerWebsite && totalPages === 1)) {
    return null;
  }

  return (
    <footer className="gepflegt-footer" data-element-id="gepflegt.footer">
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
