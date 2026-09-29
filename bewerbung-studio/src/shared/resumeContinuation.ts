// Shared quality rules for every résumé template. They run on the DOM that both
// the React preview and the PDF produce, so a rule fixed here is fixed everywhere.

export const resumeContinuationCss = `
[data-resume-continuation]{min-height:0!important;height:auto!important;margin:0 0 5mm!important;padding-bottom:2.5mm!important}
[data-resume-continuation] h1{margin:0!important;font-size:15pt!important;line-height:1.1!important;letter-spacing:0!important}
[data-resume-continuation] [data-resume-continuation-meta]{display:block!important;margin:.8mm 0 0!important;padding:0!important;color:var(--doc-muted-color,#5c6870)!important;font-family:inherit!important;font-size:8pt!important;font-weight:500!important;letter-spacing:.04em!important;line-height:1.25!important;text-transform:none!important;opacity:1!important}
aside[class*="continuation"]{display:block!important;height:auto!important;min-height:0!important;padding-top:12mm!important}
[data-managed-section]>:is(h2,h3){break-after:avoid;page-break-after:avoid}
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
 * Continuation pages carry only the name and a page indicator: the headline,
 * the “Lebenslauf · Fortsetzung” kicker and every other repeated identity
 * detail are dropped from the header.
 */
export const normalizeContinuationHeader = (
  root: Element,
  pageNumber: number,
  totalPages: number,
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
  const meta = header.ownerDocument.createElement("p");
  meta.setAttribute("data-resume-continuation-meta", "");
  meta.textContent = `Lebenslauf · Seite ${pageNumber} von ${totalPages}`;
  name.after(meta);
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

const dateRange = /^\s*(?:\d{1,2}\/)?\d{4}\s*[–—-]\s*(?:(?:\d{1,2}\/)?\d{4}|[A-Za-zÄÖÜäöüß.]+)\s*$/;

/** Date ranges such as “11/2024 – 06/2025” never wrap, whatever the column width. */
export const keepDatesOnOneLine = (root: Element): void => {
  for (const node of Array.from(root.querySelectorAll("time,p,span,small,strong,b,em,div,td,th"))) {
    // Only the date text itself: an icon may sit beside it, other elements may not.
    if (Array.from(node.children).some((child) => child.tagName.toLowerCase() !== "svg")) continue;
    if (dateRange.test(node.textContent ?? "")) node.setAttribute("data-resume-nowrap", "");
  }
};
