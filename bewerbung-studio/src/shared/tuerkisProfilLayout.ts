import { parseHTML } from "linkedom";
import type { ManagerSection } from "../features/resume-sections/resume-manager";

/** Arrange the same resolved CV nodes on both surfaces after their shared pagination/section pass. */
export const arrangeTuerkisProfilPage = (
  html: string,
  managerSections: readonly ManagerSection[],
  summaryContinues = false,
): string => {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const roots = document.querySelectorAll(".tuerkis-profil-template,[data-template='tuerkis-profil']");
  if (!roots.length) return html;
  for (const root of roots) {
  if (root.getAttribute("data-ats-mode") === "true" || root.querySelector(".zweispaltig-pdf-ats,.zweispaltig-ats")) {
    // When a long profile ends beside the first career entry, the ATS planner
    // may place strengths on that page. Keep the plain reading order intact.
    const strengths = root.querySelector('[data-managed-section="strengths"]');
    const experience = root.querySelector('[data-managed-section="experience"]');
    if (strengths && experience && strengths.parentElement === experience.parentElement)
      experience.before(strengths);
    continue;
  }
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
  const continuation = root.getAttribute("data-continuation") === "true"
    || Number(root.getAttribute("data-resume-page")) > 1;
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
    if (summary) { summary.classList.add("tuerkis-profil-summary"); (photo ?? hero).after(summary); }
    if (contacts) { contacts.classList.add("tuerkis-profil-contacts"); (summary ?? photo ?? hero).after(contacts); }
    if ((contacts?.children.length ?? 0) > 8 || (identity?.textContent?.trim().length ?? 0) > 115)
      root.setAttribute("data-tuerkis-dense", "true");
    header.remove();
  }
  // Follow the section manager, including a user's later column changes.
  for (const entry of managerSections) {
    if (["heading", "personalData", "photo", "closing"].includes(entry.id)) continue;
    const selector = `[data-managed-section="${entry.id}"],` +
      `[data-element-id="zweispaltig.${entry.id}"]`;
    const node = columns.querySelector(selector);
    if (!node || node.closest(".tuerkis-profil-hero") || (!continuation && entry.id === "summary" && node.parentElement === sidebar)) continue;
    // A profile that continues in the sidebar must finish before another sidebar
    // section starts. The planner still paginates the other sections in the main lane.
    const target = entry.zone === "sidebar"
      && (!summaryContinues || entry.id === "summary" || entry.id === "languages") ? sidebar : main;
    target.appendChild(node);
    node.setAttribute("data-cv-zone", target === sidebar ? "sidebar" : "main");
  }
  }
  return document.body.innerHTML;
};
