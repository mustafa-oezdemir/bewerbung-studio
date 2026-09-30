import type { ResumePageItem } from "./documentPagination";

// Shared by the React preview and the PDF: both run the page plan through
// applyManagedResumeOutput, so an entry breaks at the same bullet in either.

export const resumeEntrySplitCss = `
[data-resume-entry-marker]{margin-left:.45em!important;font-family:inherit!important;font-size:.72em!important;font-style:normal!important;font-weight:500!important;letter-spacing:.02em!important;text-transform:none!important;white-space:nowrap!important;opacity:.7}
`;

const directBullets = (list: Element) => Array.from(list.children).filter((child) => child.tagName.toLowerCase() === "li");

/**
 * An experience entry that breaks between two pages is drawn on both with the same
 * header (dates, role, company); the page plan says which bullets belong to which
 * page. The second part is marked as a continuation, like a continued section.
 */
export const applyEntryBreaks = (
  sections: readonly Element[],
  entrySelector: string,
  titleSelector: string,
  items: readonly ResumePageItem[],
): void => {
  const experience = items.filter((item) => item.kind === "experience");
  if (!entrySelector || !experience.some((item) => item.kind === "experience" && item.bullets)) return;
  const entries = sections.flatMap((section) => Array.from(section.querySelectorAll(entrySelector)));
  // Unknown markup: keep every entry whole rather than cutting the wrong one.
  if (entries.length !== experience.length) return;
  experience.forEach((item, index) => {
    if (item.kind !== "experience" || !item.bullets) return;
    const { from, to, total } = item.bullets;
    const entry = entries[index];
    const lists = Array.from(entry.querySelectorAll("ul,ol")).filter((list) => directBullets(list).length === total);
    for (const list of lists.slice(0, 1)) {
      directBullets(list).forEach((bullet, position) => {
        if (position < from || position >= to) bullet.remove();
      });
    }
    if (to < total) entry.setAttribute("data-resume-entry-continues", "");
    if (from > 0) {
      entry.setAttribute("data-resume-entry-continued", "");
      const title = (titleSelector ? entry.querySelector(titleSelector) : null) ?? entry.querySelector("h3,h4");
      if (title) {
        const marker = entry.ownerDocument.createElement("span");
        marker.setAttribute("data-resume-entry-marker", "");
        marker.textContent = "· Fortsetzung";
        title.appendChild(marker);
      }
    }
  });
};
