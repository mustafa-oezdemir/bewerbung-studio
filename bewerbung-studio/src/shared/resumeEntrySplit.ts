import type { ResumePageItem } from "./documentPagination";
import { educationDetailUnits, resolveEducationPresentation, type Education } from "./resumeEducation";

// Shared by the React preview and the PDF: both run the page plan through
// applyManagedResumeOutput, so an entry breaks at the same bullet in either.

// The marker is dimmed by its colour, not by `opacity`: an element with an opacity is painted as a layer of its own, and
// the PDF then lists its text after everything else on the page (a lone "· Fortsetzung" behind the last section).
export const resumeEntrySplitCss = `
[data-resume-entry-marker]{margin-left:.45em!important;font-family:inherit!important;font-size:.72em!important;font-style:normal!important;font-weight:500!important;letter-spacing:.02em!important;text-transform:none!important;white-space:nowrap!important;color:color-mix(in srgb,currentColor 70%,transparent)!important}
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

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const ownText = (node: Element) => normalize(Array.from(node.childNodes).filter((child) => child.nodeType === 3).map((child) => child.textContent ?? "").join(""));
const leaves = (root: Element, text: string) =>
  Array.from(root.querySelectorAll("*")).filter((node) => !node.closest("style,script") && ownText(node) === text);

/**
 * An education entry that breaks between two pages is drawn on both with the same header (Abschluss, Institution,
 * Zeitraum, Ort); the page plan says which detail units (`educationDetailUnits`) belong to which page, and the description
 * goes on where the page ended. Like the experience bullets this is done on the output both the preview and the PDF
 * produce, so every template cuts an entry at the same place. The entry is found by its text: the title and the details
 * the shared presentation prints, whatever markup the template draws them in. The second part is marked as a continuation.
 */
export const applyEducationBreaks = (
  sections: readonly Element[],
  education: readonly Education[],
  visibility: unknown,
  items: readonly ResumePageItem[],
): void => {
  const pieces = items.filter((item) => item.kind === "education");
  if (!pieces.some((item) => item.bullets)) return;
  const used = new Set<Element>();
  for (const item of pieces) {
    if (!item.bullets) continue;
    const entry = education.find((candidate) => candidate.id === item.id);
    if (!entry) continue;
    const view = resolveEducationPresentation(entry, visibility);
    const units = educationDetailUnits(view.details, view.descriptionIndex);
    const { from, to } = item.bullets;
    if (units.length !== item.bullets.total) continue;
    // The title of this entry on this page, and the smallest element around it that holds every detail of the entry.
    const title = sections.flatMap((section) => leaves(section, normalize(view.title))).find((node) => !used.has(node));
    if (!title) continue;
    let root: Element | null = title;
    while (root && !view.details.every((detail) => leaves(root!, normalize(detail)).length || normalize(root!.textContent ?? "").includes(normalize(detail)))) root = root.parentElement;
    if (!root || !sections.some((section) => section.contains(root))) continue;
    used.add(title);
    view.details.forEach((detail, index) => {
      const mine = units.map((unit, position) => ({ unit, position })).filter(({ unit }) => unit.detail === index);
      const kept = mine.filter(({ position }) => position >= from && position < to).map(({ unit }) => unit.text);
      const node = leaves(root!, normalize(detail))[0];
      if (!node) return;
      if (!kept.length) {
        const holder = node.closest("li,p") ?? node;
        const list = holder.parentElement;
        holder.remove();
        if (list && /^(?:ul|ol)$/i.test(list.tagName) && !list.children.length) list.remove();
      } else if (kept.length < mine.length) node.textContent = kept.join(" ");
    });
    if (to < units.length) root.setAttribute("data-resume-entry-continues", "");
    if (from > 0) {
      root.setAttribute("data-resume-entry-continued", "");
      const marker = root.ownerDocument.createElement("span");
      marker.setAttribute("data-resume-entry-marker", "");
      marker.textContent = "· Fortsetzung";
      title.appendChild(marker);
    }
  }
};
