import { z } from "zod";

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
