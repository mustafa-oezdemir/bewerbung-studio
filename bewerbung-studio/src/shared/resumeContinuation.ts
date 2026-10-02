// Shared quality rules for every résumé template. They run on the DOM that both
// the React preview and the PDF produce, so a rule fixed here is fixed everywhere.

import { defaultResumeHeadingTitle } from "../features/resume-sections/resume-section-system";

export const resumeContinuationCss = `
[data-resume-continuation]{min-height:0!important;height:auto!important;margin:0 0 5mm!important;padding-bottom:2.5mm!important}
[data-resume-continuation] h1{margin:0!important;font-size:15pt!important;line-height:1.1!important;letter-spacing:0!important}
[data-resume-continuation] [data-resume-continuation-meta]{display:block!important;margin:.8mm 0 0!important;padding:0!important;color:var(--doc-muted-color,#5c6870)!important;font-family:inherit!important;font-size:8pt!important;font-weight:500!important;letter-spacing:.04em!important;line-height:1.25!important;text-transform:none!important;opacity:1!important}
[data-resume-continuation-identity]{display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;width:100%!important}
[data-resume-continuation-contact]{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:1mm 5mm!important;width:100%!important;margin:1.5mm 0 0!important;padding:0!important;color:var(--doc-muted-color,#5c6870)!important;font-family:inherit!important;font-size:8pt!important;font-style:normal!important;font-weight:400!important;line-height:1.25!important;letter-spacing:0!important;text-transform:none!important}
[data-resume-continuation-contact] a{color:inherit!important;text-decoration:none!important;overflow-wrap:anywhere!important}
[data-resume-header-extra-contact]{display:flex;flex-wrap:wrap;gap:1mm 5mm;margin:1.5mm 0 0;color:inherit;font-size:8pt;font-style:normal;line-height:1.25}
[data-resume-header-extra-contact] a{color:inherit;text-decoration:none;overflow-wrap:anywhere}
[data-pehlione-continuation-header]{margin-bottom:5mm!important;padding-bottom:2.5mm!important}
[data-pehlione-continuation-header] h1{font-size:17pt!important;line-height:1.05!important;letter-spacing:.02em!important;text-transform:uppercase!important}
[data-pehlione-continuation-header] h2{margin-top:1mm!important;font-size:8.5pt!important;line-height:1.15!important}
[data-pehlione-continuation-header] [data-resume-header-extra-contact]{margin-top:1.5mm;font-size:6.5pt}
aside[class*="continuation"]{display:block!important;height:auto!important;min-height:0!important}
[data-managed-section]>:is(h2,h3){break-after:avoid;page-break-after:avoid}
[data-managed-section] :is(h4,h5){break-after:avoid;page-break-after:avoid}
[data-managed-section] li{break-inside:auto;page-break-inside:auto;orphans:2;widows:2}
[data-resume-nowrap]{white-space:nowrap!important}
`;

/**
 * Headers that stand in for the large first-page header on later pages.
 * PDF templates mark them `compact`/`continuation`; React previews use BEM
 * modifiers; Pehlione uses its regular header on the second page.
 */
const continuationHeaderSelector =
  'header[class*="compact"],header[class*="continuation"],header.continuation,.pehlione-header';

/**
 * The first page of a longer Lebenslauf names e-mail and phone. A detail is added to the header only when the
 * page shows it nowhere: a template whose own Kontakte column (Zeitgenössisch, Kompakt, Elegant, …) already lists
 * it keeps it there, so the same contact never stands twice on one page.
 */
export const ensureResumeHeaderContacts = (
  root: Element,
  contact?: { email?: string; phone?: string },
): void => {
  const header = root.querySelector("header");
  if (!header || !contact) return;
  const email = contact.email?.trim();
  const phone = contact.phone?.trim();
  // A number is shown formatted ("+49 176 93153406"): compare the digits, not the stored spelling.
  const digits = (value: string) => value.replace(/\D/g, "");
  // The texts of the page one by one (leaves), so digits of neighbouring values never run together.
  const texts = Array.from(root.querySelectorAll("*"))
    .filter((node) => !node.closest("style,script") && !Array.from(node.children).some((child) => (child.textContent ?? "").trim()))
    .map((node) => node.textContent ?? "");
  const shown = (test: (text: string) => boolean) => test(header.textContent ?? "") || texts.some(test);
  const missingEmail = email && !shown((text) => text.includes(email));
  const missingPhone = phone && !shown((text) => digits(text).includes(digits(phone)));
  if (!missingEmail && !missingPhone) return;
  const details = header.ownerDocument.createElement("address");
  details.setAttribute("data-resume-header-extra-contact", "");
  if (missingEmail) {
    const link = header.ownerDocument.createElement("a");
    link.setAttribute("href", `mailto:${email}`);
    link.textContent = email;
    details.appendChild(link);
  }
  if (missingPhone) {
    const link = header.ownerDocument.createElement("a");
    link.setAttribute("href", `tel:${phone.replace(/[^\d+]/g, "")}`);
    link.textContent = phone;
    details.appendChild(link);
  }
  (header.querySelector("h2") ?? header.querySelector("h1,strong") ?? header.lastElementChild)?.after(details);
};

/** Repeat the already-managed first-page header without a compact variant. */
export const repeatResumeHeader = (root: Element, sourceHeader: Element): void => {
  root.querySelector("header")?.replaceWith(sourceHeader.cloneNode(true));
};

/**
 * Continuation pages carry the name and visible contact details. Templates
 * without a numbered footer also keep their page indicator. The headline and
 * other repeated identity details are dropped.
 */
export const normalizeContinuationHeader = (
  root: Element,
  pageNumber: number,
  totalPages: number,
  contact?: { email?: string; phone?: string },
  /** The resolved Überschrift (`resolveResumeHeading(profile).kicker`); the name stays in the h1 beside it. */
  headingLabel: string = defaultResumeHeadingTitle,
): void => {
  const header = root.querySelector(continuationHeaderSelector);
  if (!header || header.hasAttribute("data-resume-continuation")) return;
  const name = header.querySelector("h1,strong,[class*='__name']");
  if (!name) return;
  const container = name.parentElement ?? header;
  for (const sibling of Array.from(container.children)) if (sibling !== name) sibling.remove();
  if (container !== header) {
    for (const sibling of Array.from(header.children)) if (sibling !== container) sibling.remove();
  }
  container.setAttribute("data-resume-continuation-identity", "");
  const email = contact?.email?.trim();
  const phone = contact?.phone?.trim();
  if (email || phone) {
    const details = header.ownerDocument.createElement("div");
    details.setAttribute("data-resume-continuation-contact", "");
    if (email) {
      const link = header.ownerDocument.createElement("a");
      link.setAttribute("href", `mailto:${email}`);
      link.textContent = email;
      details.appendChild(link);
    }
    if (phone) {
      const link = header.ownerDocument.createElement("a");
      link.setAttribute("href", `tel:${phone.replace(/[^\d+]/g, "")}`);
      link.textContent = phone;
      details.appendChild(link);
    }
    name.after(details);
  }
  if (!header.classList.contains("zweispaltig-header") && !header.classList.contains("zweispaltig-pdf-header")) {
    const meta = header.ownerDocument.createElement("p");
    meta.setAttribute("data-resume-continuation-meta", "");
    meta.textContent = `${headingLabel} · Seite ${pageNumber} von ${totalPages}`;
    (container.querySelector("[data-resume-continuation-contact]") ?? name).after(meta);
  }
  header.setAttribute("data-resume-continuation", "");
};

const continuationSidebarSelector = 'aside[class*="continuation"]';

/**
 * Continuation pages never keep a sidebar column: a mostly empty side strip only
 * wastes the page. Sidebar-zone sections that did not fit on page one flow into
 * the main column instead, which then takes the full width.
 */
export const removeContinuationSidebar = (root: Element): void => {
  for (const aside of Array.from(root.querySelectorAll(continuationSidebarSelector))) {
    const host = aside.parentElement;
    aside.remove();
    if (!host) continue;
    const style = (host as HTMLElement).style;
    style.gridTemplateColumns = "minmax(0, 1fr)";
    style.display = "grid";
    for (const child of Array.from(host.children)) (child as HTMLElement).style.gridColumn = "1";
  }
};

/**
 * A career section that has no entry on this page is not drawn: a heading
 * without content below it (“orphan heading”) only says the entries live on
 * another page.
 */
export const removeEmptyCareerSections = (
  root: Element,
  present: { experience: boolean; education: boolean },
): void => {
  for (const kind of ["experience", "education"] as const) {
    if (present[kind]) continue;
    for (const section of Array.from(root.querySelectorAll(`[data-managed-section="${kind}"]`))) {
      const heading = section.querySelector("h2,h3");
      if (!heading) continue;
      const body = (section.textContent ?? "").replace(heading.textContent ?? "", "").trim();
      if (!body) section.remove();
    }
  }
};

/**
 * The “add your career to the profile” hint belongs to a résumé without any career
 * entry. It must not appear on a page that merely has none of them because the
 * entries fit on the pages before.
 */
export const removeEmptyCareerHint = (root: Element): void => {
  for (const node of Array.from(root.querySelectorAll("p,div,span"))) {
    if (node.children.length === 0 && /^Berufserfahrung und Ausbildung im Profil ergänzen\.?$/.test((node.textContent ?? "").trim())) node.remove();
  }
};

const dateRange = /^\s*(?:\d{1,2}\/)?\d{4}\s*[–—-]\s*(?:(?:\d{1,2}\/)?\d{4}|[A-Za-zÄÖÜäöüß.]+)\s*$/;

/** Date ranges such as “11/2024 – 06/2025” never wrap, whatever the column width. */
export const keepDatesOnOneLine = (root: Element): void => {
  for (const node of Array.from(root.querySelectorAll("time,p,span,small,strong,b,em,div,td,th"))) {
    // Only the date text itself: an icon may sit beside it, other elements may not.
    if (Array.from(node.children).some((child) => child.tagName.toLowerCase() !== "svg")) continue;
    if (dateRange.test(node.textContent ?? "")) node.setAttribute("data-resume-nowrap", "");
  }
};
