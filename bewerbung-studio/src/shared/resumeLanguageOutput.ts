import { languageDotsFollowName, languageGridSpan, resolveLanguagePresentation } from "../features/languages/language-levels";
import type { ApplicantProfile } from "./schema";
import type { DocumentDesignSettings } from "./documentDesign";
import { resolveLanguageColumns } from "./resumeSectionLayout";

/** One DOM projection for the preview and the generated PDF. Keep the template's section,
 * item and dot classes, while giving every language the same atomic row structure. `zone` is where the section
 * really stands on this page: it alone decides the automatic grid (resolveLanguageColumns). */
export function applyResumeLanguageOutput(
  section: Element,
  profile: ApplicantProfile,
  templateId: string,
  settings: DocumentDesignSettings,
  zone: "main" | "sidebar",
  atsMode: boolean,
  range?: { from: number; to: number },
): void {
  const allEntries = [...new Set(profile.languages.map((value) => value.trim()).filter(Boolean))];
  const entries = range ? allEntries.slice(range.from, range.to) : allEntries;
  if (!entries.length) return;
  const heading = section.querySelector("h2,h3");
  if (!heading) return;
  let headingHost: Element = heading;
  while (headingHost.parentElement && headingHost.parentElement !== section) headingHost = headingHost.parentElement;
  if (headingHost.parentElement !== section) return;

  const directItems = Array.from(section.children).filter((child) => child !== headingHost);
  // A template may set its rows straight into the section. They are the rows then – not a list: a row has as many parts
  // (name, dots, description) as a short list has languages, and its parts' classes are not those of a row.
  const rowsAreDirect = directItems.length > 1 && (directItems.length === entries.length || directItems.length === allEntries.length)
    && directItems.every((child) => child.tagName === directItems[0].tagName && child.className === directItems[0].className);
  const content = rowsAreDirect ? undefined : directItems.find((child) => child.children.length >= entries.length);
  // The template's rows: one per language of this page, or one per language of the whole list (the page draws a
  // range of them), else any row as the pattern of the template's markup.
  const rows = content ? Array.from(content.children) : directItems;
  const wholeList = Boolean(range) && rows.length === allEntries.length && rows.length !== entries.length;
  const offset = wholeList ? range!.from : 0;
  const nativeItems = rows.length === entries.length || wholeList ? rows : [];
  const patternItem = nativeItems.length ? undefined : rows.find((row) => row.querySelector('[aria-label][class*="dot"],[class*="dots"],[aria-label][role="img"]')) ?? rows[0];
  const document = section.ownerDocument;
  const presentations = entries.map((entry) => resolveLanguagePresentation(entry, profile.resumeLanguageDisplay, { dots: !atsMode, ats: atsMode }));
  const columns = resolveLanguageColumns(settings.languagesColumns, zone, atsMode);
  const grid = document.createElement(atsMode || content?.tagName === "UL" ? "ul" : "div");
  grid.className = `${content?.className ?? ""} ${atsMode ? "resume-language-ats" : "resume-language-grid"}`.trim();
  grid.setAttribute("data-columns", String(columns));
  if (!atsMode) grid.setAttribute("style", `--language-columns:${columns}`);

  presentations.forEach((language, index) => {
    const source = nativeItems[offset + index] ?? patternItem;
    const item = document.createElement(atsMode ? "li" : source?.tagName.toLowerCase() === "li" && grid.tagName === "UL" ? "li" : "article");
    // Only the dots of the level: name, dash and dots are one compact group that wraps like running text.
    // (No class of this row may contain "dots": that word selects the dot rows.)
    const compact = !atsMode && languageDotsFollowName(language);
    item.className = `${source?.className ?? ""} resume-language-item${compact ? " resume-language-item--compact" : ""}`.trim();
    if (!atsMode) {
      const span = languageGridSpan(language, columns, zone);
      if (span > 1) item.setAttribute("style", `grid-column:span ${span}`);
    }
    if (atsMode) {
      item.textContent = language.primaryText;
    } else {
      const primarySource = source?.querySelector("[class*='__name'],strong,h3,h4");
      const primary = document.createElement("span");
      primary.className = `${primarySource?.className ?? ""} resume-language-primary`.trim();
      const name = document.createElement("strong");
      name.textContent = language.name;
      primary.appendChild(name);
      if (language.detail) {
        const detail = document.createElement("span");
        detail.className = "resume-language-level";
        detail.textContent = ` – ${language.detail}`;
        primary.appendChild(detail);
      }
      item.appendChild(primary);
      if (language.showDots) {
        const originalDots = source?.querySelector('[aria-label][class*="dot"],[class*="dots"],[aria-label][role="img"]');
        const dots = originalDots?.cloneNode(true) as Element | undefined ?? document.createElement("span");
        // The template's dots show this language's level (a pattern row may belong to another language).
        if (originalDots) Array.from(dots.children).forEach((marker, dot) => {
          if (dot < language.score) marker.classList.add("filled");
          else marker.classList.remove("filled");
        });
        if (!originalDots) dots.className = templateId === "elegant"
          ? section.closest(".cv-sheet") ? "elegant-pdf-language-dots" : "elegant-language__dots"
          : "resume-language-dots";
        dots.setAttribute("data-resume-language-dots", "");
        dots.setAttribute("role", "img");
        dots.setAttribute("aria-label", `${language.name}: ${[language.cefrLevel, language.description].filter(Boolean).join(" · ")}`);
        if (!originalDots) {
          for (let dot = 0; dot < 6; dot++) {
            const marker = document.createElement("i");
            if (dot < language.score) marker.className = "filled";
            dots.appendChild(marker);
          }
        }
        if (compact) {
          // Dash and dots continue the name's line, in its line height. The dash never leaves the dots: a narrow cell
          // moves both to the next line, the dots never stand alone.
          const meter = document.createElement("span");
          meter.className = "resume-language-meter";
          const separator = document.createElement("span");
          separator.className = "resume-language-separator";
          separator.setAttribute("aria-hidden", "true");
          separator.textContent = "–";
          meter.appendChild(separator);
          meter.appendChild(dots);
          primary.appendChild(document.createTextNode(" "));
          primary.appendChild(meter);
        } else item.appendChild(dots);
      }
      if (language.secondaryText) {
        const description = document.createElement("small");
        description.className = "resume-language-description";
        description.textContent = language.secondaryText;
        item.appendChild(description);
      }
    }
    grid.appendChild(item);
  });
  section.replaceChildren(headingHost, grid);
}
