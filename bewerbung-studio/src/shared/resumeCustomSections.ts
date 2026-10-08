import type { ApplicantProfile } from "./schema";
import type { ResumeCustomContentType } from "./resumeCustomSectionTypes";
import { safeExternalUrl } from "./safeExternalUrl";

type Section = ApplicantProfile["specialSections"][number];
type Entry = Section["entries"][number];
/** Compact native interests list text, shared by Pehlione preview and PDF. */
export const interestEntryText = (entry: Entry): string =>
  [entry.title.trim(), entry.description.trim()].filter(Boolean).join(" – ");
/**
 * Projekte and Hobbys & Interessen space their entries like the career entries: the template's entry rule, its list gap, the
 * central Eintragsabstand and the Abstand nach Eintragstitel below a title (resumeManagedOutput, resumeSpacing, the planner).
 */
export const spacesEntriesLikeCareer = (kind: Section["kind"] | undefined): boolean => kind === "projects" || kind === "interests";
export const careerLikeEntryListSelector = ':is([data-custom-kind="projects"],[data-custom-kind="interests"]) [data-custom-role="entries"]';
const hasMetadata = (entry: Entry) => Boolean(entry.subtitle.trim() || entry.location.trim() || entry.date.trim() || entry.from.trim() || entry.to.trim());
const hasContent = (entry: Entry) => Boolean(entry.title.trim() || entry.description.trim() || entry.url.trim() || hasMetadata(entry) || entry.bullets.some(value => value.trim()));

/** Legacy sections are resolved without modifying stored data or inspecting headings. */
export const normalizeCustomSection = (section: Section) => {
  const entries = section.entries.filter(hasContent);
  const contentType: ResumeCustomContentType = section.kind === "projects" ? "entries" : section.contentType ?? (
    entries.some(hasMetadata) ? "entries" :
    entries.length > 1 || entries.some(entry => entry.bullets.some(value => value.trim())) ? "list" : "text"
  );
  return { ...section, sectionType: "main-section" as const, contentType,
    entries: entries.map(entry => ({ ...entry, sectionType: contentType === "entries" || contentType === "timeline" ? "subsection" as const : "text" as const })) };
};

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Shared escaped markup for React preview and Electron PDF output. A section that breaks between two pages passes
 * the entries (`from`..`to`, exclusive, of `normalizeCustomSection(section).entries`) the page draws.
 */
export const renderCustomSectionContent = (section: Section, range?: { from: number; to: number }): string => {
  const normalized = normalizeCustomSection(section);
  const items = normalized.entries.slice(range?.from ?? 0, range?.to).map(entry => {
    if (section.kind === "projects") {
      const title = entry.title.trim();
      const url = safeExternalUrl(entry.url.trim());
      const heading = title ? `<h3 data-custom-role="entry-title" data-section-type="subsection">${url
        ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(title)}</a>`
        : escape(title)}</h3>` : "";
      const technologies = entry.technologies.map((technology) => technology.trim()).filter(Boolean);
      const technologyLine = technologies.length
        ? `<p class="resume-special-output__technologies" data-custom-role="supporting">${technologies.map(escape).join(" · ")}</p>` : "";
      const description = entry.description.trim()
        ? `<p data-custom-role="body">${escape(entry.description)}</p>` : "";
      return `<article data-custom-role="entry" class="resume-special-output__entry resume-special-output__project" data-entry-id="${escape(entry.id)}">${heading}${technologyLine}${description}</article>`;
    }
    const period = entry.date.trim() || [entry.from, entry.to].filter(value => value.trim()).join(" – ");
    const metadata = [entry.location, period].filter(value => value.trim()).join(" · ");
    const titleTag = entry.sectionType === "subsection" ? "h3" : "p";
    const details = `${entry.title.trim() ? `<${titleTag} data-custom-role="${entry.sectionType === "subsection" ? "entry-title" : "body"}" data-section-type="${entry.sectionType}">${escape(entry.title)}</${titleTag}>` : ""}${entry.subtitle.trim() ? `<p data-custom-role="supporting">${escape(entry.subtitle)}</p>` : ""}${metadata ? `<p data-custom-role="metadata" class="resume-special-output__meta">${escape(metadata)}</p>` : ""}${entry.description.trim() ? `<p data-custom-role="body">${escape(entry.description)}</p>` : ""}${entry.bullets.some(value => value.trim()) ? `<ul>${entry.bullets.filter(value => value.trim()).map(value => `<li>${escape(value)}</li>`).join("")}</ul>` : ""}${entry.url.trim() ? `<p class="resume-special-output__url">${escape(entry.url)}</p>` : ""}`;
    const tag = ["list", "skills", "timeline"].includes(normalized.contentType) ? "li" : "article";
    return `<${tag} data-custom-role="entry" class="resume-special-output__entry" data-entry-id="${escape(entry.id)}">${details}</${tag}>`;
  }).join("");
  if (!items) return "";
  const tag = normalized.contentType === "list" || normalized.contentType === "skills" ? "ul" : normalized.contentType === "timeline" ? "ol" : "div";
  return `<${tag} data-custom-role="entries" class="resume-special-output__entries" data-content-type="${normalized.contentType}">${items}</${tag}>`;
};
