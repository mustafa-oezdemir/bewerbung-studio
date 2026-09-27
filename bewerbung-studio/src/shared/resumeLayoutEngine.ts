import type { DocumentDesignSettings } from "./documentDesign";
import type { ResumePresentation } from "./resumePresentationSchema";
import { getTemplate, resolveTemplateId } from "./templates";

export type ResolvedResumeLayout = {
  mode: "single" | "two-column";
  sidebarSide: "left" | "right";
  sidebarWidthPercent: number;
  overridden: boolean;
};

const nativeLayout: Record<string, { mode: ResolvedResumeLayout["mode"]; side: ResolvedResumeLayout["sidebarSide"] }> = {
  pehlione_white: { mode: "two-column", side: "left" },
  pehlione_white_blue: { mode: "two-column", side: "left" },
  zweispaltig: { mode: "two-column", side: "right" },
  zeitgenoessisch: { mode: "two-column", side: "left" },
  kreativ: { mode: "two-column", side: "right" },
  stilvoll: { mode: "two-column", side: "left" },
  kompakt: { mode: "two-column", side: "right" },
  gepflegt: { mode: "two-column", side: "left" },
  elegant: { mode: "two-column", side: "right" },
  modern: { mode: "two-column", side: "right" },
};

/** Missing overrides leave each native template and its exact CSS widths intact. */
export const resolveResumeLayout = (
  templateId: string,
  presentation: ResumePresentation | undefined,
  ats = false,
  legacySidebarPercent?: number,
): ResolvedResumeLayout => {
  const id = resolveTemplateId(templateId);
  const native = nativeLayout[id] ?? { mode: "single" as const, side: "right" as const };
  const mode = ats ? "single" : presentation?.layoutMode ?? native.mode;
  const sidebarSide = presentation?.sidebarSide ?? native.side;
  const fallback = id.startsWith("pehlione_") && legacySidebarPercent !== undefined
    ? legacySidebarPercent : Math.round((getTemplate(id).sidebarWidthRatio ?? 0.3) * 100);
  const sidebarWidthPercent = presentation?.sidebarWidthPercent ?? fallback;
  return {
    mode,
    sidebarSide,
    sidebarWidthPercent,
    overridden: !ats && (presentation?.layoutMode !== undefined || presentation?.sidebarSide !== undefined || presentation?.sidebarWidthPercent !== undefined),
  };
};

const nativeHosts: Record<string, { preview: string; pdf: string }> = {
  pehlione_white: { preview: ".pehlione-resume", pdf: ".pehlione-pdf" },
  pehlione_white_blue: { preview: ".pehlione-resume", pdf: ".pehlione-pdf" },
  zweispaltig: { preview: ".zweispaltig-columns", pdf: ".zweispaltig-pdf-columns" },
  zeitgenoessisch: { preview: ".zeitgenoessisch-columns", pdf: ".zeit-pdf-columns" },
  kreativ: { preview: ".kreativ-content", pdf: ".kreativ-pdf-content" },
  stilvoll: { preview: ".stilvoll-content", pdf: ".stilvoll-pdf-columns" },
  kompakt: { preview: ".kompakt-content", pdf: ".kompakt-pdf-columns" },
  gepflegt: { preview: ".gepflegt-layout", pdf: ".gepflegt-pdf" },
  elegant: { preview: ".elegant-page__visual", pdf: ".elegant-pdf" },
  modern: { preview: ".modern-resume-main", pdf: ".modern-pdf-columns" },
};

const singleHosts: Record<string, { preview: string; pdf: string }> = {
  einspaltig: { preview: ".einfach-content", pdf: ".einfach-pdf-inner" },
  "ivy-league": { preview: ".ivy-league-content", pdf: ".ivy-pdf-content" },
  klassisch: { preview: ".klassisch-content", pdf: ".klassisch-pdf-content" },
  tabellarisch: { preview: ".tabellarisch-page__content", pdf: ".tabellarisch-pdf-content" },
};

export const getResumeLayoutHost = (page: Element, templateId: string, surface: "preview" | "pdf"): Element | null => {
  const id = resolveTemplateId(templateId);
  const selector = nativeHosts[id]?.[surface] ?? singleHosts[id]?.[surface];
  return selector ? (page.matches(selector) ? page : page.querySelector(selector)) : null;
};

const sidebarDefaults = new Set(["summary", "strengths", "knowledge", "languages", "certifications"]);

/** One DOM projection is used by both React preview and Electron PDF. */
export const applyResumePageLayout = (
  page: Element,
  templateId: string,
  surface: "preview" | "pdf",
  settings: DocumentDesignSettings,
  legacySidebarPercent?: number,
  sectionZones?: ReadonlyMap<string, "main" | "sidebar">,
): void => {
  const id = resolveTemplateId(templateId);
  const presentation = settings.resumePresentation;
  const ats = settings.resumeOutputMode === "ats" || settings.columnLayout === "compact-ats";
  const layout = resolveResumeLayout(id, presentation, ats, legacySidebarPercent);
  if (!layout.overridden) return;
  const descriptor = nativeHosts[id];
  const host = getResumeLayoutHost(page, id, surface);
  if (!host) return;

  const nativeMain = descriptor ? Array.from(host.children).find(child => child.matches("main,[class*='-content'],[class*='-left-column'],[class*='-main-column'],[class*='-pdf-main'],[class*='-pdf-left'],[class*='-resume-left-column']") && !child.matches("aside")) : undefined;
  const nativeSidebar = descriptor ? Array.from(host.children).find(child => child.matches("aside,[class*='-sidebar'],[class*='-right-column'],[class*='-pdf-right'],[class*='-pdf-left'],[class*='-resume-right-column']") && child !== nativeMain) : undefined;

  let main = nativeMain;
  let sidebar = nativeSidebar;
  if (!descriptor && layout.mode === "two-column") {
    const document = host.ownerDocument;
    main = document.createElement("div");
    sidebar = document.createElement("aside");
    main.setAttribute("data-resume-layout-zone", "main");
    sidebar.setAttribute("data-resume-layout-zone", "sidebar");
    const sections = Array.from(host.children).filter(child => child.hasAttribute("data-managed-section") || child.classList.contains("resume-special-output-list"));
    if (!sections.length) return;
    host.insertBefore(main, sections[0]);
    host.insertBefore(sidebar, main.nextSibling);
    for (const section of sections) {
      const id = section.getAttribute("data-managed-section") ?? "";
      const explicit = sectionZones?.get(id) ?? presentation?.sections?.[id]?.zone;
      (explicit === "sidebar" || (!explicit && sidebarDefaults.has(id)) ? sidebar : main).appendChild(section);
    }
    // The header and footer stay full width; decorative absolute layers keep their position.
    for (const child of Array.from(host.children)) if (child !== main && child !== sidebar) (child as HTMLElement).style.gridColumn = "1 / -1";
  }
  if (!main || !sidebar) return;

  host.setAttribute("data-resume-layout", layout.mode);
  host.setAttribute("data-resume-sidebar-side", layout.sidebarSide);
  (host as HTMLElement).style.display = "grid";
  if (layout.mode === "single") {
    (host as HTMLElement).style.gridTemplateColumns = "minmax(0, 1fr)";
    (host as HTMLElement).style.height = "auto";
    (host as HTMLElement).style.minHeight = "0";
    (main as HTMLElement).style.gridColumn = "1";
    (sidebar as HTMLElement).style.gridColumn = "1";
    (main as HTMLElement).style.gridRow = "1";
    (sidebar as HTMLElement).style.gridRow = "2";
    (main as HTMLElement).style.height = "auto";
    (sidebar as HTMLElement).style.minHeight = "0";
    (sidebar as HTMLElement).style.height = "auto";
    (sidebar as HTMLElement).style.width = "auto";
    const closing = main.querySelector("footer,[class*='closing']");
    if (closing && closing.parentElement === main) {
      host.appendChild(closing);
      (closing as HTMLElement).style.gridColumn = "1";
      (closing as HTMLElement).style.gridRow = "3";
    }
    return;
  }

  const sidebarTrack = `minmax(0, ${layout.sidebarWidthPercent}fr)`;
  const mainTrack = `minmax(0, ${100 - layout.sidebarWidthPercent}fr)`;
  (host as HTMLElement).style.gridTemplateColumns = layout.sidebarSide === "left"
    ? `${sidebarTrack} ${mainTrack}` : `${mainTrack} ${sidebarTrack}`;
  (main as HTMLElement).style.gridColumn = layout.sidebarSide === "left" ? "2" : "1";
  (sidebar as HTMLElement).style.gridColumn = layout.sidebarSide === "left" ? "1" : "2";
  // Explicitly share a row: CSS Grid otherwise auto-places the second zone on
  // the next row when it appears before the first column in DOM order.
  (main as HTMLElement).style.gridRow = descriptor ? "1" : "2";
  (sidebar as HTMLElement).style.gridRow = descriptor ? "1" : "2";
  (main as HTMLElement).style.minWidth = "0";
  (sidebar as HTMLElement).style.minWidth = "0";
  (main as HTMLElement).style.width = "auto";
  (sidebar as HTMLElement).style.width = "auto";
};
