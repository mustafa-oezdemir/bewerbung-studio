import { z } from "zod";
import type { DocumentDesignSettings } from "./documentDesign";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);

/** Sparse, reusable visual controls. Missing values preserve the native template. */
export const resumeAppearanceSchema = z.object({
  sidebarBackgroundColor: color.optional(),
  sidebarTextColor: color.optional(),
  sidebarSectionHeadingColor: color.optional(),
  mainBackgroundColor: color.optional(),
  sectionDividerVisible: z.boolean().optional(),
  sectionDividerWidthMm: z.number().min(0.1).max(2).optional(),
  photoDecorationVisible: z.boolean().optional(),
  photoDecorationColor: color.optional(),
  contactDividerColor: color.optional(),
});

export type ResumeAppearance = z.infer<typeof resumeAppearanceSchema>;

/** Project optional appearance controls onto the existing template columns.
 * Native CSS remains authoritative when a field has no saved override. */
export const applyGeneralResumeAppearance = (
  page: Element, templateId: string, settings: DocumentDesignSettings,
  main: Element, sidebar: Element,
): void => {
  const appearance = resumeAppearanceSchema.parse(settings.resumeAppearance ?? {});
  const set = (element: Element, property: string, value: string) =>
    (element as HTMLElement).style.setProperty(property, value, "important");
  if (sidebar !== main && appearance.sidebarTextColor) {
    set(sidebar, "color", appearance.sidebarTextColor);
    for (const node of sidebar.querySelectorAll("p,li,small,a")) set(node, "color", appearance.sidebarTextColor);
  }
  // Pehlione's existing theme projection owns backgrounds and decoration,
  // while body text follows the same semantic sidebar control as every CV.
  if (templateId.startsWith("pehlione_")) return;
  if (appearance.mainBackgroundColor) set(main, "background", appearance.mainBackgroundColor);
  if (sidebar !== main && appearance.sidebarBackgroundColor)
    set(sidebar, "background", appearance.sidebarBackgroundColor);
  if (appearance.sectionDividerVisible === false || appearance.sectionDividerWidthMm !== undefined) {
    for (const section of page.querySelectorAll("[data-managed-section]")) {
      const heading = section.querySelector("h2,h3");
      if (!heading || heading.closest("[data-managed-section]") !== section) continue;
      for (const node of [heading, ...heading.querySelectorAll("b,span")]) {
        if (appearance.sectionDividerVisible === false) set(node, "border-bottom-width", "0");
        else if (appearance.sectionDividerWidthMm !== undefined)
          set(node, "border-bottom-width", `${appearance.sectionDividerWidthMm}mm`);
      }
    }
  }
  if (appearance.photoDecorationVisible === false || appearance.photoDecorationColor) {
    for (const photo of page.querySelectorAll('img[class*="photo"],img[class*="Photo"]')) {
      const target = photo.parentElement?.className && /photo|Photo/.test(String(photo.parentElement.className))
        ? photo.parentElement : photo;
      if (appearance.photoDecorationVisible === false) {
        set(target, "border-width", "0");
        set(target, "box-shadow", "none");
      } else if (appearance.photoDecorationColor) set(target, "border-color", appearance.photoDecorationColor);
    }
    for (const decoration of page.querySelectorAll('[class*="photo-shape"],[class*="photo-pale"],[class*="photo-soft"],[class*="photo-accent"]')) {
      if (appearance.photoDecorationVisible === false) set(decoration, "display", "none");
      else if (appearance.photoDecorationColor) set(decoration, "background-color", appearance.photoDecorationColor);
    }
  }
};
