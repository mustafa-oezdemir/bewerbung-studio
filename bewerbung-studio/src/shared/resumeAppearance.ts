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
  sectionDividerPosition: z.enum(["none", "bottom", "top", "both"]).optional(),
  sectionHeadingAlignment: z.enum(["left", "center", "right"]).optional(),
  sectionHeadingMarginBeforeMm: z.number().min(0).max(12).optional(),
  /** Legacy alias of the spacing token `sectionTitleGapMm`: both set the space under a section title. */
  sectionHeadingMarginAfterMm: z.number().min(0).max(8).optional(),
  photoDecorationVisible: z.boolean().optional(),
  photoDecorationColor: color.optional(),
  contactDividerColor: color.optional(),
  photoLayout: z.enum(["template", "circle", "rounded", "square", "hidden"]).optional(),
  headerLayout: z.enum(["template", "left", "center", "split"]).optional(),
});

export type ResumeAppearance = z.infer<typeof resumeAppearanceSchema>;

/** Width of a section rule when the user turns one on in a template that draws none (and names no width). */
export const defaultSectionDividerWidthMm = 0.3;

/** Physical limits shared by the controls and the sparse schema above. */
export const resumeAppearanceLimits = {
  sectionDividerWidthMm: [0.1, 2],
  sectionHeadingMarginBeforeMm: [0, 12],
  sectionHeadingMarginAfterMm: [0, 8],
} as const;

/**
 * What a template draws when nothing is overridden. Every field has a value: the design panel shows it as the
 * effective value, and a sparse `ResumeAppearance` replaces single fields of it. The space below a section title is
 * the spacing token `sectionTitleGapMm`, so it is not repeated here; "divider visible" is `sectionDividerPosition !== "none"`.
 */
export const nativeResumeAppearanceSchema = z.object({
  sidebarBackgroundColor: color,
  sidebarTextColor: color,
  sidebarSectionHeadingColor: color,
  mainBackgroundColor: color,
  sectionDividerPosition: z.enum(["none", "bottom", "top", "both"]),
  sectionDividerWidthMm: z.number().min(0).max(resumeAppearanceLimits.sectionDividerWidthMm[1]),
  sectionHeadingAlignment: z.enum(["left", "center", "right"]),
  sectionHeadingMarginBeforeMm: z.number().min(0).max(resumeAppearanceLimits.sectionHeadingMarginBeforeMm[1]),
  photoDecorationVisible: z.boolean(),
  photoDecorationColor: color,
  contactDividerColor: color,
  photoLayout: z.enum(["circle", "rounded", "square", "hidden"]),
  headerLayout: z.enum(["left", "center", "split"]),
});

export type NativeResumeAppearance = z.infer<typeof nativeResumeAppearanceSchema>;

/** The appearance a document really shows: native values with the saved overrides on top. */
export type ResolvedResumeAppearance = NativeResumeAppearance & { sectionDividerVisible: boolean };

/** Project optional appearance controls onto the existing template columns.
 * Native CSS remains authoritative when a field has no saved override. */
export const applyGeneralResumeAppearance = (
  page: Element, templateId: string, settings: DocumentDesignSettings,
  main: Element, sidebar: Element,
  /** The divider colour the document shows; a rule the template does not draw by itself takes it. */
  dividerColor?: string,
): void => {
  const appearance = resumeAppearanceSchema.parse(settings.resumeAppearance ?? {});
  const set = (element: Element, property: string, value: string) =>
    (element as HTMLElement).style.setProperty(property, value, "important");
  if (appearance.headerLayout && appearance.headerLayout !== "template") {
    const header = page.querySelector('header,[class*="header"],[class*="Header"]');
    if (header) {
      set(header, "text-align", appearance.headerLayout === "center" ? "center" : "left");
      if (appearance.headerLayout === "center") set(header, "justify-content", "center");
      if (appearance.headerLayout === "split") set(header, "justify-content", "space-between");
    }
  }
  if (appearance.photoLayout) {
    for (const photo of page.querySelectorAll('img[class*="photo"],img[class*="Photo"],img[alt*="foto" i]')) {
      const target = photo.parentElement?.className && /photo/i.test(String(photo.parentElement.className))
        ? photo.parentElement : photo;
      if (appearance.photoLayout === "hidden") set(target, "display", "none");
      if (appearance.photoLayout === "circle") set(target, "border-radius", "50%");
      if (appearance.photoLayout === "rounded") set(target, "border-radius", "12px");
      if (appearance.photoLayout === "square") set(target, "border-radius", "0");
    }
  }
  if (sidebar !== main && appearance.sidebarTextColor) {
    set(sidebar, "color", appearance.sidebarTextColor);
    for (const node of sidebar.querySelectorAll("p,li,small,a")) set(node, "color", appearance.sidebarTextColor);
  }
  // Pehlione's theme owns its column backgrounds, while all other shared
  // controls still apply to it just like to every CV.
  if (!templateId.startsWith("pehlione_")) {
    if (appearance.mainBackgroundColor) set(main, "background", appearance.mainBackgroundColor);
    if (sidebar !== main && appearance.sidebarBackgroundColor)
      set(sidebar, "background", appearance.sidebarBackgroundColor);
  }
  if (appearance.sectionDividerVisible === false || appearance.sectionDividerWidthMm !== undefined ||
      appearance.sectionDividerPosition || appearance.sectionHeadingAlignment ||
      appearance.sectionHeadingMarginBeforeMm !== undefined || appearance.sectionHeadingMarginAfterMm !== undefined) {
    for (const section of page.querySelectorAll("[data-managed-section]")) {
      const heading = section.querySelector("h2,h3");
      if (!heading || heading.closest("[data-managed-section]") !== section) continue;
      if (appearance.sectionHeadingAlignment) set(heading, "text-align", appearance.sectionHeadingAlignment);
      if (appearance.sectionHeadingMarginBeforeMm !== undefined)
        set(heading, "margin-top", `${appearance.sectionHeadingMarginBeforeMm}mm`);
      if (appearance.sectionHeadingMarginAfterMm !== undefined)
        set(heading, "margin-bottom", `${appearance.sectionHeadingMarginAfterMm}mm`);
      for (const node of [heading, ...heading.querySelectorAll("b,span")]) {
        if (settings.cvOverrides?.colors?.divider)
          set(node, "border-color", settings.cvOverrides.colors.divider);
        const position = appearance.sectionDividerVisible === false ? "none" : appearance.sectionDividerPosition;
        if (position && position !== "none" && dividerColor && !settings.cvOverrides?.colors?.divider) set(node, "border-color", dividerColor);
        if (position) {
          set(node, "border-top-width", position === "top" || position === "both" ? `${appearance.sectionDividerWidthMm ?? defaultSectionDividerWidthMm}mm` : "0");
          set(node, "border-bottom-width", position === "bottom" || position === "both" ? `${appearance.sectionDividerWidthMm ?? defaultSectionDividerWidthMm}mm` : "0");
          if (position !== "none") {
            set(node, "border-top-style", "solid");
            set(node, "border-bottom-style", "solid");
          }
        } else if (appearance.sectionDividerVisible === false) set(node, "border-bottom-width", "0");
        else if (appearance.sectionDividerWidthMm !== undefined) set(node, "border-bottom-width", `${appearance.sectionDividerWidthMm}mm`);
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
