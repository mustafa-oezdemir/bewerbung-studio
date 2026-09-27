import { defaultDocumentDesign, marginLevelToMm, type DocumentDesignSettings, type SectionColumnMode } from "./documentDesign";
import { getTemplate } from "./templates";

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
  const single = ["single", "compact-ats", "timeline"].includes(settings.columnLayout);
  const split = !single && (hasSidebar ?? !["centered", "minimal", "timeline"].includes(template.layout));
  if (split && zone === "sidebar") return 1;
  const width = (210 - 2 * marginLevelToMm[settings.marginLevel]) * (split ? 0.62 : 1);
  const longest = Math.max(0, ...items.map((item) => item.title.length));
  const detailed = items.some((item) => (item.description?.length ?? 0) > 90);
  const minWidth = (longest > 45 || detailed ? 80 : longest > 25 ? 65 : 48) * (settings.fontSize === "large" ? 1.15 : 1);
  return Math.max(1, Math.min(3, items.length || 1, Math.floor(width / minWidth)));
}
