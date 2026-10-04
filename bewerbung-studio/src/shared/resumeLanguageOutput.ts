import { languageGridSpan, resolveLanguagePresentation } from "../features/languages/language-levels";
import type { ApplicantProfile } from "./schema";
import type { DocumentDesignSettings } from "./documentDesign";
import { resolveSectionColumns } from "./resumeSectionLayout";

/** One DOM projection for the preview and the generated PDF. Keep the template's section,
 * item and dot classes, while giving every language the same atomic row structure. */
export function applyResumeLanguageOutput(
  section: Element,
  profile: ApplicantProfile,
  templateId: string,
  settings: DocumentDesignSettings,
  zone: "main" | "sidebar",
  hasSidebar: boolean,
  atsMode: boolean,
): void {
  const entries = [...new Set(profile.languages.map((value) => value.trim()).filter(Boolean))];
  if (!entries.length) return;
  const heading = section.querySelector("h2,h3");
  if (!heading) return;
  let headingHost: Element = heading;
  while (headingHost.parentElement && headingHost.parentElement !== section) headingHost = headingHost.parentElement;
  if (headingHost.parentElement !== section) return;

  const content = Array.from(section.children).find((child) => child !== headingHost && child.children.length >= entries.length);
  const directItems = Array.from(section.children).filter((child) => child !== headingHost);
  const nativeItems = content && content.children.length === entries.length ? Array.from(content.children)
    : directItems.length === entries.length ? directItems : [];
  const document = section.ownerDocument;
  const presentations = entries.map((entry) => resolveLanguagePresentation(entry, profile.resumeLanguageDisplay, { dots: !atsMode, ats: atsMode }));
  const columns = atsMode ? 1 : resolveSectionColumns(
    settings.languagesColumns, templateId, zone,
    presentations.map((language) => ({ title: language.primaryText, description: language.secondaryText })),
    settings, hasSidebar,
  );
  const grid = document.createElement(atsMode || content?.tagName === "UL" ? "ul" : "div");
  grid.className = `${content?.className ?? ""} ${atsMode ? "resume-language-ats" : "resume-language-grid"}`.trim();
  grid.setAttribute("data-columns", String(columns));
  if (!atsMode) grid.setAttribute("style", `--language-columns:${columns}`);

  presentations.forEach((language, index) => {
    const source = nativeItems[index];
    const item = document.createElement(atsMode ? "li" : source?.tagName.toLowerCase() === "li" && grid.tagName === "UL" ? "li" : "article");
    item.className = `${source?.className ?? ""} resume-language-item`.trim();
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
        if (!originalDots) dots.className = "resume-language-dots";
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
        item.appendChild(dots);
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
