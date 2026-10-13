import type { ApplicantProfile } from "../../../../shared/schema";
import { resolveResumeFooterWebsite } from "../../../../shared/resumeFooter";

export function IvyLeagueFooter({
  profile,
  pageNumber,
  totalPages,
}: {
  profile: ApplicantProfile | undefined;
  pageNumber: number;
  totalPages: number;
}) {
  const footerWebsite = resolveResumeFooterWebsite(profile);
  return (
    <footer
      className="ivy-league-footer"
      data-element-id="ivy-league.footer"
    >
      {footerWebsite ? (
        <a href={footerWebsite.href}>{footerWebsite.text}</a>
      ) : (
        <span />
      )}
      {totalPages > 1 ? (
        <span>
          Seite {pageNumber} / {totalPages}
        </span>
      ) : null}
    </footer>
  );
}
