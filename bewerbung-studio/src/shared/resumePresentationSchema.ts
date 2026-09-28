import { z } from "zod";
import { resumePersonalFieldKeys } from "../features/resume-sections/resume-section-system";
import { resumeBlockRendererTypes, resumeKnowledgeSlots } from "../features/resume-sections/knowledge-block-registry";

export const resumePresentationSchema = z.object({
  sections: z.record(z.string(), z.object({
    title: z.string().trim().min(1).optional(),
    visible: z.boolean().optional(),
    zone: z.enum(["main", "sidebar"]).optional(),
    order: z.number().int().nonnegative().optional(),
  })).optional(),
  personalFields: z.partialRecord(z.enum(resumePersonalFieldKeys), z.boolean()).optional(),
  closing: z.object({
    showPlace: z.boolean().optional(),
    showDate: z.boolean().optional(),
    showSignature: z.boolean().optional(),
    placement: z.enum(["footer", "main"]).optional(),
    alignment: z.enum(["left", "center", "right", "distributed"]).optional(),
  }).optional(),
  blocks: z.record(z.string(), z.object({
    rendererType: z.enum(resumeBlockRendererTypes).optional(),
    slot: z.enum(resumeKnowledgeSlots).optional(),
    pageBreakBefore: z.boolean().optional(),
  })).optional(),
  showKnowledgeTitle: z.boolean().optional(),
  layoutMode: z.enum(["single", "two-column"]).optional(),
  sidebarSide: z.enum(["left", "right"]).optional(),
  sidebarWidthPercent: z.union([z.literal(20), z.literal(25), z.literal(30), z.literal(35), z.literal(40)]).optional(),
});

export type ResumePresentation = z.infer<typeof resumePresentationSchema>;
