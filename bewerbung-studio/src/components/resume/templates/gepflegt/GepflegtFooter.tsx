import { toTemplateExternalHref } from "../resume-template-data";
import type { GepflegtFooterProps } from "./gepflegt.types";

export function GepflegtFooter({
  profile,
  pageNumber,
  totalPages,
  atsMode,
}: GepflegtFooterProps) {
  const portfolio =
    profile?.portfolio || profile?.github || profile?.linkedin || "";

  if (atsMode || (!portfolio && totalPages === 1)) {
    return null;
  }

  return (
    <footer className="gepflegt-footer" data-element-id="gepflegt.footer">
      {portfolio ? (
        <a href={toTemplateExternalHref(portfolio)}>{portfolio}</a>
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
