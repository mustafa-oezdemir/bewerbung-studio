// Shared quality rules for every résumé template. They run on the DOM that both
// the React preview and the PDF produce, so a rule fixed here is fixed everywhere.

import { defaultResumeHeadingTitle } from "../features/resume-sections/resume-section-system";
import { formatPhoneForDisplay, phoneHref } from "./contactPresentation";

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
 * The contact details a later page may carry: only what the user chose in the continuation visibility
 * (`resumeContinuationContactVisibility`). Every other personal detail (address, links, birth data, family data, …)
 * stays on the first page.
 */
export type ContinuationContacts = { email?: string; phone?: string };

/** The one markup of a continuation contact, shared by every path that adds one. */
const continuationContactLink = (document: Document, kind: "email" | "phone", value: string): HTMLAnchorElement => {
  const link = document.createElement("a");
  link.setAttribute("href", kind === "email" ? `mailto:${value}` : phoneHref(value));
  link.textContent = kind === "email" ? value : formatPhoneForDisplay(value);
  return link;
};

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
  // A number is shown formatted ("+49 170 12345678"): compare the digits, not the stored spelling.
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
  if (missingEmail) details.appendChild(continuationContactLink(header.ownerDocument, "email", email));
  if (missingPhone) details.appendChild(continuationContactLink(header.ownerDocument, "phone", phone));
  // Under the Berufsbezeichnung (an `h2`, or the plain text that follows the name), else under the name.
  const name = header.querySelector("h1,strong");
  const next = name?.nextElementSibling;
  const title = header.querySelector("h2")
    ?? (next && hasText(next) && !next.matches(headerContactSelector) && !next.querySelector("a[href],address") ? next : null);
  (title ?? name ?? header.lastElementChild)?.after(details);
};

/** Blocks of a header that print contact or personal details (the templates draw them as `address`, a contact list, …). */
const headerContactSelector =
  "address,[class*='contact' i],[data-resume-header-extra-contact],[data-resume-continuation-contact],ul,ol";

/** A node says something in text (style and script content does not count). */
const hasText = (node: Element) =>
  Array.from(node.querySelectorAll("*")).concat(node).some((leaf) =>
    !leaf.closest("style,script") && Array.from(leaf.childNodes).some((child) => child.nodeType === 3 && (child.textContent ?? "").trim()));

const sameText = (left: string, right: string) => left.replace(/\s+/g, " ").trim() === right.replace(/\s+/g, " ").trim();

/**
 * The header of a continuation page keeps the identity of the first page — the Lebenslauf heading, the name, the
 * Berufsbezeichnung and the photo with its decoration — and nothing else: an allowlist, not a list of things to remove. Everything the header
 * prints besides that (the contact block with the address, links, birth, nationality and family data, an icon shell
 * left by a removed contact, markup a template adds later) is dropped with the block that holds it. The details the
 * user chose for later pages are added by the caller (`ensureResumeHeaderContacts`).
 */
export const sanitizeContinuationHeader = (header: Element, identity: { title?: string } = {}): void => {
  const name = header.querySelector("h1,[class*='__name']");
  if (!name) {
    // No identity to anchor on: still never carry a contact block or a link.
    header.querySelectorAll(`${headerContactSelector},a[href]`).forEach((node) => node.remove());
    return;
  }
  const isIdentityText = (node: Element) => hasText(node) && !node.matches(headerContactSelector) && !node.querySelector("a[href],address");
  // The Berufsbezeichnung: the element that says the profile's title, else the first plain text after the name.
  const wanted = identity.title?.trim();
  const byText = wanted
    ? Array.from(header.querySelectorAll("*")).filter((node) => !node.closest("style,script") && node !== name && !name.contains(node)
      && isIdentityText(node) && sameText(node.textContent ?? "", wanted))
    : [];
  const container = name.parentElement ?? header;
  const following = Array.from(container.children).slice(Array.from(container.children).indexOf(name) + 1);
  // The outermost match, so that a title wrapped in an extra element stays whole.
  const title = byText.find((node) => !byText.some((other) => other !== node && other.contains(node))) ?? following.find(isIdentityText);
  // The Lebenslauf heading above the name (the user's Überschrift) is part of the identity too.
  const kickers = Array.from(header.querySelectorAll("[class*='kicker' i]")).filter((node) => !node.matches(headerContactSelector));
  const keep = [name, title, ...kickers].filter((node): node is Element => Boolean(node));
  const holdsKeep = (node: Element) => keep.some((kept) => node.contains(kept));
  const prune = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (keep.includes(child)) continue;
      if (holdsKeep(child)) {
        prune(child);
        continue;
      }
      // Photo, frame and decoration carry neither text nor a link: they stay.
      if (child.matches(headerContactSelector) || child.matches("a") || child.querySelector("a[href],address") || hasText(child)) child.remove();
    }
  };
  prune(header);
};

/**
 * Repeat the already-managed first-page header on a later page: the same identity (name, Berufsbezeichnung, photo),
 * and only the contacts the user chose for later pages. The first page's own personal details are not copied.
 */
export const repeatResumeHeader = (
  root: Element,
  sourceHeader: Element,
  contacts?: ContinuationContacts,
  identity: { title?: string } = {},
): void => {
  const header = root.querySelector("header");
  if (!header) return;
  const copy = sourceHeader.cloneNode(true) as Element;
  sanitizeContinuationHeader(copy, identity);
  header.replaceWith(copy);
  ensureResumeHeaderContacts(root, contacts);
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
    if (email) details.appendChild(continuationContactLink(header.ownerDocument, "email", email));
    if (phone) details.appendChild(continuationContactLink(header.ownerDocument, "phone", phone));
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
 * A continuation page whose page plan has no sidebar content collapses its idle sidebar column: a mostly empty
 * side strip only wastes the page, and the main column takes the full width. Pages whose plan names sidebar
 * content keep it (see `applyContinuationColumns`).
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
 * A continuation page whose plan names sidebar content, but whose template draws no sidebar there, gets one from
 * page one: its column host takes over the class list of the host of page one (which drops the "continuation"
 * modifier of a single-column page) and an empty copy of the sidebar element of page one joins it on the side it
 * stands on there. The managed layer fills that shell with the planned sections; nothing of page one's own sidebar
 * (hero, contacts, strengths, languages) is repeated.
 */
export const ensureContinuationSidebar = (
  root: Element,
  firstRoot: Element | null | undefined,
  hostOf: (page: Element) => Element | null,
  isSidebar: (element: Element) => boolean,
): boolean => {
  if (Array.from(root.querySelectorAll("*")).some(isSidebar)) return false;
  const host = hostOf(root);
  const firstHost = firstRoot ? hostOf(firstRoot) : null;
  if (!host || !firstHost) return false;
  const columns = Array.from(firstHost.children);
  const firstSidebar = columns.find(isSidebar);
  if (!firstSidebar) return false;
  const shell = firstSidebar.cloneNode(false) as Element;
  shell.setAttribute("data-resume-continued-sidebar", "");
  host.setAttribute("class", firstHost.getAttribute("class") ?? "");
  // The side it stands on: first in the host (a left sidebar) or behind the main column.
  const standsFirst = columns.indexOf(firstSidebar) < columns.findIndex((child) => child !== firstSidebar && !isSidebar(child) && child.matches("main,[class*='main'],[class*='content']"));
  if (standsFirst) host.insertBefore(shell, host.firstChild);
  else host.appendChild(shell);
  return true;
};

/**
 * The columns of a continuation page follow its page plan. A page whose plan names sidebar content (a template with
 * a continuation sidebar, see `supportsSidebarContinuation`) keeps its sidebar and the sections the user put there;
 * a page without any collapses an idle sidebar as before (`removeContinuationSidebar`).
 */
export const applyContinuationColumns = (root: Element, plan: { sidebar?: boolean } | undefined): void => {
  if (plan?.sidebar) return;
  removeContinuationSidebar(root);
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
