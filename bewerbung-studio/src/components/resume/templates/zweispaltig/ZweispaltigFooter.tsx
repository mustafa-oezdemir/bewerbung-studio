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
  const showContact = pageNumber > 1 && Boolean(profile?.email || profile?.phone);

  return (
    <footer
      className={`zweispaltig-footer${showContact ? " zweispaltig-footer--with-contact" : ""}`}
      data-element-id="zweispaltig.footer"
    >
      {link ? (
        <a href={toZweispaltigExternalHref(link)}>{link}</a>
      ) : (
        <span />
      )}
      {showContact ? (
        <div className="zweispaltig-footer__contact" data-resume-continuation-contact="">
          {profile?.email ? <a href={`mailto:${profile.email}`}>{profile.email}</a> : null}
          {profile?.phone ? <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a> : null}
        </div>
      ) : null}
      <span>
        Seite {pageNumber} von {totalPages}
      </span>
    </footer>
  );
}
