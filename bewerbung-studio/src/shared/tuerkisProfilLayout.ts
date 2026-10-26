import { parseHTML } from "linkedom";
import type { ManagerSection } from "../features/resume-sections/resume-manager";
import type { ResumePagePlan } from "./documentPagination";

/**
 * The sections that go on at page `number` from the page before: a career section whose entries run on, and every list
 * or paragraph the plan breaks between the two pages.
 */
const continuedOn = (plan: readonly ResumePagePlan[] | undefined, number: number) => {
  const ids = new Set<string>();
  const page = plan?.[number - 1];
  const before = plan?.[number - 2];
  if (!page || !before) return ids;
  const first = page.items[0];
  if (first && before.items.some((item) => item.kind === first.kind)) ids.add(first.kind);
  for (const [id, range] of Object.entries(page.blockRanges ?? {})) if (range.from > 0) ids.add(id);
  return ids;
};

/**
 * The rows of the Kontakt list on page `number` where the plan breaks the list (the lane block `personalData`): `null`
 * on a page without a part of it, `undefined` where the plan leaves the list whole on page one.
 */
const contactRowsOn = (plan: readonly ResumePagePlan[] | undefined, number: number) => {
  if (!plan?.some((page) => page.blocks?.includes("personalData"))) return undefined;
  const page = plan[number - 1];
  if (!page?.blocks?.includes("personalData")) return null;
  return page.blockRanges?.personalData ?? { from: 0, to: Number.POSITIVE_INFINITY, total: Number.POSITIVE_INFINITY };
};
const contactListSelector = ".zweispaltig-header__contacts,.zweispaltig-pdf-contacts";

/**
 * Arrange the same resolved CV nodes on both surfaces after their shared pagination/section pass. `pagePlan` and
 * `pageNumber` (the preview renders one page; the PDF's sheets name theirs) let a later page finish the main column's
 * section that runs on from the page before before the rest of the Seitenspalte opens it. `firstPageHtml` is page one
 * of the preview (it renders every page on its own): a later page takes the rest of a Kontakt list that breaks from it.
 */
export const arrangeTuerkisProfilPage = (
  html: string,
  managerSections: readonly ManagerSection[],
  pagePlan?: readonly ResumePagePlan[],
  pageNumber?: number,
  firstPageHtml?: string,
): string => {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const roots = document.querySelectorAll(".tuerkis-profil-template,[data-template='tuerkis-profil']");
  if (!roots.length) return html;
  const isContinuation = (root: Element) => root.getAttribute("data-continuation") === "true"
    || Number(root.getAttribute("data-resume-page")) > 1;
  // The Kontakt list as page one's header draws it, before that page takes it apart.
  const firstRoot = Array.from(roots).find((root) => !isContinuation(root) && (pageNumber ?? 1) === 1);
  const contactSource = (firstRoot?.querySelector(contactListSelector)
    ?? (firstPageHtml ? parseHTML(`<html><body>${firstPageHtml}</body></html>`).document.querySelector(contactListSelector) : null))
    ?.cloneNode(true) as Element | undefined;
  const contactTitle = managerSections.find((entry) => entry.id === "personalData")?.title.trim() || "Kontakt";
  /** The list with its title and the rows of `range` (the part on a later page says "· Fortsetzung"). */
  const contactList = (contacts: Element, range: { from: number; to: number; total: number } | undefined) => {
    contacts.classList.add("tuerkis-profil-contacts");
    for (const old of contacts.querySelectorAll(":scope > .tuerkis-profil-contacts__title")) old.remove();
    // (the last part takes every row that is left)
    if (range) Array.from(contacts.children).forEach((row, index) => {
      if (index < range.from || (range.to < range.total && index >= range.to)) row.remove();
    });
    // The list's title is the Persönliche Daten section's (editable like every section title; Türkis default "Kontakt").
    const heading = document.createElement("h3");
    heading.className = "tuerkis-profil-contacts__title";
    heading.textContent = range && range.from > 0 ? `${contactTitle} · Fortsetzung` : contactTitle;
    contacts.prepend(heading);
    return contacts;
  };
  for (const root of roots) {
  // The plain page keeps the order of the section list (the managed output draws it, Stärken included).
  if (root.getAttribute("data-ats-mode") === "true" || root.querySelector(".zweispaltig-pdf-ats,.zweispaltig-ats")) continue;
  const header = root.querySelector(".zweispaltig-header,.zweispaltig-pdf-header");
  const columns = root.querySelector(".zweispaltig-columns,.zweispaltig-pdf-columns");
  const main = columns?.querySelector(".zweispaltig-main,.zweispaltig-pdf-main");
  const sidebar = columns?.querySelector(".zweispaltig-sidebar,.zweispaltig-pdf-sidebar");
  if (!columns || !main) continue;
  // The React renderer wraps ordered sections; the PDF renderer writes the sections directly.
  for (const wrapper of columns.querySelectorAll(".zweispaltig-ordered-section,.resume-special-output-list")) {
    while (wrapper.firstChild) wrapper.parentElement?.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  }
  for (const icon of columns.querySelectorAll(".zweispaltig-career-entry__meta svg,.zweispaltig-pdf-entry-meta svg"))
    icon.remove();
  if (!sidebar) {
    const zones = new Map(managerSections.map((entry) => [entry.id, entry.zone]));
    for (const node of columns.querySelectorAll("[data-managed-section]"))
      if (zones.get(node.getAttribute("data-managed-section") ?? "") === "sidebar")
        node.setAttribute("data-cv-zone", "sidebar");
    continue;
  }
  if (!header) continue;
  const continuation = isContinuation(root);
  const number = Number(root.getAttribute("data-resume-page")) || pageNumber || 1;
  const contactRows = contactRowsOn(pagePlan, number);
  columns.insertBefore(sidebar, main);
  if (!continuation) {
    const hero = document.createElement("div");
    hero.className = "tuerkis-profil-hero";
    const identity = header.querySelector(".zweispaltig-header__identity") ?? header.querySelector("div");
    const contacts = header.querySelector(".zweispaltig-header__contacts,.zweispaltig-pdf-contacts");
    const photo = header.querySelector(".zweispaltig-header__photo,.zweispaltig-pdf-photo");
    const summary = sidebar.querySelector('[data-managed-section="summary"],[data-element-id="zweispaltig.summary"]');
    if (identity) {
      contacts?.remove();
      hero.appendChild(identity);
    }
    sidebar.prepend(hero);
    if (photo) { photo.classList.add("tuerkis-profil-photo"); hero.after(photo); }
    // Kontakt stands above the Kurzprofil: the Kurzprofil opens the flowing sections of the column (it may go on at
    // the next page, with nothing of page one's top block below it).
    if (summary) { summary.classList.add("tuerkis-profil-summary"); (photo ?? hero).after(summary); }
    // A list the plan breaks keeps the rows of this page (none where all of it starts on the next page).
    if (contacts && contactRows !== null) (photo ?? hero).after(contactList(contacts, contactRows));
    header.remove();
  } else if (contactRows && contactSource) {
    // The rest of a Kontakt list that breaks opens the Seitenspalte of this page, above its sections.
    sidebar.prepend(contactList(contactSource.cloneNode(true) as Element, contactRows));
  }
  // Follow the section manager, including a user's later column changes.
  for (const entry of managerSections) {
    if (["heading", "personalData", "photo", "closing"].includes(entry.id)) continue;
    const selector = `[data-managed-section="${entry.id}"],` +
      `[data-element-id="zweispaltig.${entry.id}"]`;
    const node = columns.querySelector(selector);
    if (!node || node.closest(".tuerkis-profil-hero") || (!continuation && entry.id === "summary" && node.parentElement === sidebar)) continue;
    // The column's sections keep their order across the pages (the planner's sidebar lane): nothing moves to main.
    const target = entry.zone === "sidebar" ? sidebar : main;
    target.appendChild(node);
    node.setAttribute("data-cv-zone", target === sidebar ? "sidebar" : "main");
  }
  // A later page: the main column's section that runs on from the page before finishes first, above the rest of the
  // Seitenspalte (a second main box of the same kind keeps its styles).
  const continued = continuation ? continuedOn(pagePlan, number) : new Set<string>();
  const lead = Array.from(main.children).filter((child, index, all) =>
    all.slice(0, index + 1).every((node) => continued.has(node.getAttribute("data-managed-section") ?? "")));
  if (lead.length && sidebar.children.length) {
    const box = main.cloneNode(false) as Element;
    box.setAttribute("data-tuerkis-lead", "");
    for (const node of lead) box.appendChild(node);
    columns.insertBefore(box, sidebar);
  }
  // The closing (Ort, Datum, Unterschrift) follows the text of the main column: the sections were appended behind it.
  const closing = root.querySelector('[data-resume-closing][data-resume-closing-placement="main"]');
  if (closing) main.appendChild(closing);
  }
  return document.body.innerHTML;
};
