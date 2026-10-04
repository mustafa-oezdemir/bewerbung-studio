import { defaultDocumentDesign, marginLevelToMm, type DocumentDesignSettings, type SectionColumnMode } from "./documentDesign";
import { getTemplate } from "./templates";
import { resolveResumeLayout } from "./resumeLayoutEngine";

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
