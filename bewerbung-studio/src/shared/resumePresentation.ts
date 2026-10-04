import type { ApplicantProfile } from "./schema";
import { getManagerSections } from "../features/resume-sections/resume-manager";
import { resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import { getResumeEditorSettings } from "../features/resume-sections/resume-editor-settings";
import { resumePresentationSchema, type ResumePresentation } from "./resumePresentationSchema";
import { resolveTemplateId } from "./templates";

/** Editing section content must not discard the document's layout controls. */
export const keepResumeLayoutOverrides = (
  next: ResumePresentation,
  previous: ResumePresentation | undefined,
): ResumePresentation => ({
  ...Object.fromEntries(Object.entries(next).filter(([key]) => key !== "sidebarWidthPercent")),
  ...((next.closing || previous?.closing?.placement || previous?.closing?.alignment) ? { closing: {
    ...next.closing,
    ...(previous?.closing?.placement ? { placement: previous.closing.placement } : {}),
    ...(previous?.closing?.alignment ? { alignment: previous.closing.alignment } : {}),
  } } : {}),
  ...(previous?.layoutMode !== undefined ? { layoutMode: previous.layoutMode } : {}),
  ...(previous?.sidebarSide !== undefined ? { sidebarSide: previous.sidebarSide } : {}),
  ...(previous?.sidebarWidthPercent !== undefined ? { sidebarWidthPercent: previous.sidebarWidthPercent } : {}),
});

/** Compatibility projection: old renderers receive their established profile shape.
 * The returned object is never the object saved as profile content. */
export const resolveResumePresentation = (
  profile: ApplicantProfile | undefined,
  templateId: string,
  overrides: ResumePresentation | undefined,
): ApplicantProfile | undefined => {
  if (!profile || !overrides) return profile;
  const id = resolveTemplateId(templateId);
  const presentation = resumePresentationSchema.parse(overrides);
  let projected: ApplicantProfile = {
    ...profile,
    resumeColumnRatio: presentation.sidebarWidthPercent ?? profile.resumeColumnRatio,
  };
  if (presentation.blocks) {
    projected.resumeKnowledgeGroups = resolveKnowledgeGroups(id, profile.resumeKnowledgeGroups)
      .map((block) => {
        const override = presentation.blocks?.[block.id];
        return override ? { ...block,
          rendererType: override.rendererType ?? block.rendererType,
          slot: override.slot ?? block.slot,
          pageBreakBefore: override.pageBreakBefore ?? block.pageBreakBefore,
        } : block;
      });
  }
  if (Object.values(presentation.sections ?? {}).some((settings) => settings.order !== undefined || settings.zone !== undefined)) {
    const ordered = getManagerSections(projected, id).filter((section) => !section.fixed)
      .map((section, index) => ({ ...section, order: index, ...presentation.sections?.[section.id] }))
      .sort((left, right) => left.order - right.order);
    projected.resumeManagerLayouts = {
      ...profile.resumeManagerLayouts,
      [id]: ordered.map((section) => ({ id: section.id, zone: section.zone })),
    };
  }
  return projected;
};

/** Preserve historical presentation fields in the profile; only new content is saved. */
export const separateResumeDraft = (
  original: ApplicantProfile,
  draft: ApplicantProfile,
  templateId: string,
): { profile: ApplicantProfile; presentation: ResumePresentation } => {
  const id = resolveTemplateId(templateId);
  const originalBlocks = resolveKnowledgeGroups(id, original.resumeKnowledgeGroups);
  const profile: ApplicantProfile = {
    ...draft,
    ...getResumeEditorSettings(original),
    resumeSectionTitles: original.resumeSectionTitles,
    knowledgeSection: { ...draft.knowledgeSection, title: original.knowledgeSection.title },
    resumeKnowledgeGroups: draft.resumeKnowledgeGroups.map((block) => {
      const previous = originalBlocks.find((item) => item.id === block.id);
      return previous ? {
        ...block, title: previous.title, visible: previous.visible, order: previous.order,
        rendererType: previous.rendererType, slot: previous.slot,
        slotOverrides: previous.slotOverrides, pageBreakBefore: previous.pageBreakBefore,
      } : block;
    }),
    specialSections: draft.specialSections.map((section) => {
      const previous = original.specialSections.find((item) => item.id === section.id);
      return previous ? { ...section, title: previous.title, isVisible: previous.isVisible } : section;
    }),
  };
  const baseline = getManagerSections(profile, id);
  const edited = getManagerSections(draft, id);
  const presentation: ResumePresentation = {};
  const sections: NonNullable<ResumePresentation["sections"]> = {};
  const baseOrder = baseline.filter((section) => !section.fixed).map((section) => section.id);
  const draftOrder = edited.filter((section) => !section.fixed).map((section) => section.id);
  for (const section of edited) {
    const previous = baseline.find((item) => item.id === section.id);
    if (!previous) continue;
    const changes: NonNullable<ResumePresentation["sections"]>[string] = {};
    if (section.title.trim() && section.title !== previous.title) changes.title = section.title;
    if (section.visible !== previous.visible) changes.visible = section.visible;
    if (section.zone !== previous.zone) changes.zone = section.zone;
    if (!section.fixed && baseOrder.indexOf(section.id) !== draftOrder.indexOf(section.id)) changes.order = draftOrder.indexOf(section.id);
    if (Object.keys(changes).length) sections[section.id] = changes;
  }
  if (Object.keys(sections).length) presentation.sections = sections;
  const difference = <T extends object>(base: T, next: T): Partial<T> =>
    Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== base[key as keyof T])) as Partial<T>;
  const personalFields = difference(original.resumePersonalFieldVisibility, draft.resumePersonalFieldVisibility);
  if (Object.keys(personalFields).length) presentation.personalFields = personalFields;
  const closing = difference(original.resumeClosing, draft.resumeClosing);
  if (Object.keys(closing).length) presentation.closing = closing;
  if (original.resumeColumnRatio !== draft.resumeColumnRatio) presentation.sidebarWidthPercent = draft.resumeColumnRatio;
  if (original.resumeKnowledgeContainer.showTitle !== draft.resumeKnowledgeContainer.showTitle) presentation.showKnowledgeTitle = draft.resumeKnowledgeContainer.showTitle;
  const blocks: NonNullable<ResumePresentation["blocks"]> = {};
  for (const block of resolveKnowledgeGroups(id, draft.resumeKnowledgeGroups)) {
    const previous = originalBlocks.find((item) => item.id === block.id);
    if (!previous) continue;
    const changes: NonNullable<ResumePresentation["blocks"]>[string] = {};
    if (previous.rendererType !== block.rendererType) changes.rendererType = block.rendererType;
    if (previous.slot !== block.slot) changes.slot = block.slot;
    if (previous.pageBreakBefore !== block.pageBreakBefore) changes.pageBreakBefore = block.pageBreakBefore;
    if (Object.keys(changes).length) blocks[block.id] = changes;
  }
  if (Object.keys(blocks).length) presentation.blocks = blocks;
  return { profile, presentation: resumePresentationSchema.parse(presentation) };
};
