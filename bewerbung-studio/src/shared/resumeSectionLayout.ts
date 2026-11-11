import { defaultDocumentDesign, marginLevelToMm, type DocumentDesignSettings, type SectionColumnMode } from "./documentDesign";
import { getTemplate } from "./templates";
import { resolveResumeLayout } from "./resumeLayoutEngine";

/** Lebenslauf → Sprachen, "Automatisch": the grid of the column the section really stands in. */
export const automaticLanguageColumns = { main: 3, sidebar: 1 } as const;

/**
 * The columns of the Sprachen grid, the one decision of the preview, the PDF and the page planner. "Automatisch" follows
 * the section's real place – three columns in the Hauptbereich (also for two languages), one in the Seitenspalte – and
 * never the template's name; a count the user picked (1–4) is kept as it is. The ATS layout is one text column.
 */
export function resolveLanguageColumns(mode: SectionColumnMode | undefined, zone: "main" | "sidebar", atsMode = false): 1 | 2 | 3 | 4 {
  if (atsMode) return 1;
  return mode && mode !== "auto" ? mode : automaticLanguageColumns[zone];
}

/** A4 dimensions, not viewport width: the editor and PDF make the same decision. */
export function resolveSectionColumns(
  mode: SectionColumnMode | undefined,
  templateId: string,
  zone: "main" | "sidebar",
  items: readonly { title: string; description?: string }[],
  settings: DocumentDesignSettings = defaultDocumentDesign,
  hasSidebar?: boolean,
) {
  if (mode && mode !== "auto") return mode;
  const template = getTemplate(templateId);
  const layout = resolveResumeLayout(templateId, settings.resumePresentation,
    settings.resumeOutputMode === "ats" || settings.columnLayout === "compact-ats");
  const single = ["single", "compact-ats", "timeline"].includes(settings.columnLayout);
  const split = layout.overridden
    ? layout.mode === "two-column"
    : !single && (hasSidebar ?? !["centered", "minimal", "timeline"].includes(template.layout));
  if (split && zone === "sidebar") return 1;
  const pageMargin = settings.cvOverrides?.spacing?.pageMarginMm ?? marginLevelToMm[settings.marginLevel];
  const width = (210 - 2 * pageMargin) *
    (split ? (100 - layout.sidebarWidthPercent) / 100 : 1);
  const longest = Math.max(0, ...items.map((item) => item.title.length));
  const detailed = items.some((item) => (item.description?.length ?? 0) > 90);
  const minWidth = (longest > 45 || detailed ? 80 : longest > 25 ? 65 : 48) * (settings.fontSize === "large" ? 1.15 : 1);
  return Math.max(1, Math.min(3, items.length || 1, Math.floor(width / minWidth)));
}
