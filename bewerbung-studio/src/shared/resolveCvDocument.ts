import type { ApplicantProfile, Application } from "./schema";
import { defaultDocumentDesign, type DocumentDesignSettings } from "./documentDesign";
import { resolveTemplateId } from "./templates";
import { resolveResumePresentation } from "./resumePresentation";
import { getResumeDisplayProfile } from "./resumeDisplayProfile";
import { resolveResumeLayout } from "./resumeLayoutEngine";
import { applyGlobalResumeDesign, resolveEffectiveDesignTokens, resolveResumeAppearance } from "./resumeDesignSystem";
import type { ResumeDesignLayer } from "./cvDesignSchema";
import { getProfileMediaSource } from "./profileMedia";
import { effectiveManagerZone, getManagerSections } from "../features/resume-sections/resume-manager";
import { resolveKnowledgeGroups } from "../features/resume-sections/resume-section-system";
import { createResumePagePlan, type ResumePlanContext } from "./documentPagination";
import { formatApplicationDate, type ApplicationDateSource } from "./applicationDate";
import { resolveResumeClosingLine } from "./resumeClosing";
import { resolveResumeSummary } from "./resumeSummary";
import { formatLanguageForAts } from "../features/languages/language-levels";
import { getZeitgenoessischDesignVariables } from "./zeitgenoessischDesign";
import { getKreativDesignVariables } from "./kreativDesign";
import { getStilvollDesignVariables } from "./stilvollDesign";
import { getGepflegtDesignVariables } from "./gepflegtDesign";
import { getKompaktDesignVariables } from "./kompaktDesign";
import { getKlassischDesignVariables } from "./klassischDesign";
import { getEinspaltigDesignVariables } from "./einspaltigDesign";

type CvDocumentInput = {
  profile: ApplicantProfile | undefined;
  templateId: string;
  settings?: DocumentDesignSettings;
  resumeProfile?: string;
  /** Live section-editor previews have already applied presentation overrides. */
  presentationAlreadyApplied?: boolean;
  /** The application the résumé belongs to: its date is the date of the closing (`Ort, DD.MM.YYYY`). */
  application?: ApplicationDateSource & Partial<Pick<Application, "accentColor" | "secondaryColor">>;
  globalDesign?: ResumeDesignLayer;
};

/** The sole CV projection used by both preview and print renderers. */
export const resolveCvDocument = ({
  profile: sourceProfile,
  templateId: requestedTemplateId,
  settings: documentSettings = defaultDocumentDesign,
  resumeProfile = "",
  presentationAlreadyApplied = false,
  application,
  globalDesign,
}: CvDocumentInput) => {
  const templateId = resolveTemplateId(requestedTemplateId);
  const settings = applyGlobalResumeDesign(documentSettings, globalDesign);
  const projected = presentationAlreadyApplied
    ? sourceProfile
    : resolveResumePresentation(sourceProfile, templateId, settings.resumePresentation);
  const selectedProjectEntryIds = settings.resumePresentation?.selectedProjectEntryIds;
  const selectedProjects = selectedProjectEntryIds === undefined ? projected : projected && {
    ...projected,
    specialSections: projected.specialSections.map((section) => {
      if (section.kind !== "projects") return section;
      const selected = new Set(selectedProjectEntryIds);
      const entries = section.entries.filter((entry) => selected.has(entry.id));
      return { ...section, entries, isVisible: section.isVisible && entries.length > 0 };
    }),
  };
  let profile = getResumeDisplayProfile(selectedProjects);
  const sections = {
    ...(profile?.resumeSections ?? {
      profile: true,
      strengths: true,
      experience: true,
      education: true,
      skills: true,
      languages: true,
      certifications: true,
    }),
  };
  const managerSections = profile ? getManagerSections(profile, templateId) : [];
  // Kreativ's main flow is career, education, auxiliary sections, then closing.
  // Keep auxiliary and sidebar order stable within those groups.
  if (templateId === "kreativ") {
    const rank = (entry: typeof managerSections[number]) => entry.fixed && entry.id !== "closing" ? -1
      : entry.id === "experience" ? 0 : entry.id === "education" ? 1 : entry.id === "closing" ? 3 : 2;
    managerSections.sort((left, right) => rank(left) - rank(right));
  }
  const closingDate = application ? formatApplicationDate(application) : undefined;
  const closingLine = profile ? resolveResumeClosingLine(profile, closingDate).text : "";
  const knowledgeGroups = profile
    ? resolveKnowledgeGroups(templateId, profile.resumeKnowledgeGroups)
    : [];
  const atsMode = settings.resumeOutputMode === "ats" || settings.columnLayout === "compact-ats";
  if (atsMode && profile) profile = { ...profile, languages: profile.languages.map(formatLanguageForAts) };
  const layout = resolveResumeLayout(
    templateId, settings.resumePresentation, atsMode, sourceProfile?.resumeColumnRatio,
  );
  // One column: every section stands in the one content flow, in the order of the whole list. The saved columns
  // stay in the profile for a two-column layout; the preview, the PDF and the page plan read these effective zones.
  for (const entry of managerSections) entry.zone = effectiveManagerZone(entry.zone, layout.mode);
  const design = resolveEffectiveDesignTokens(templateId, settings);
  const zeitgenoessischVariables = templateId === "zeitgenoessisch"
    ? getZeitgenoessischDesignVariables(design, settings.cvOverrides?.colors,
        application?.accentColor, application?.secondaryColor)
    : undefined;
  const kreativVariables = templateId === "kreativ"
    ? getKreativDesignVariables(design, settings.cvOverrides?.colors,
        application?.accentColor, application?.secondaryColor)
    : undefined;
  const stilvollVariables = templateId === "stilvoll"
    ? getStilvollDesignVariables(design, settings.cvOverrides?.colors,
        application?.accentColor, application?.secondaryColor)
    : undefined;
  const gepflegtVariables = templateId === "gepflegt"
    ? getGepflegtDesignVariables(design, resolveResumeAppearance(templateId, settings.resumeAppearance),
        settings.cvOverrides?.colors, application?.accentColor, application?.secondaryColor)
    : undefined;
  const kompaktVariables = templateId === "kompakt"
    ? getKompaktDesignVariables(design, settings.cvOverrides?.colors,
        application?.accentColor, application?.secondaryColor)
    : undefined;
  // Klassisch: one geometry and type scale for the preview, the PDF and the planner (resolveKlassischGeometry).
  const klassischVariables = templateId === "klassisch" ? getKlassischDesignVariables(design) : undefined;
  // Einspaltig: the same for its page, type scale, spacing and its one accent colour (resolveEinspaltigGeometry).
  const einspaltigVariables = templateId === "einspaltig"
    ? getEinspaltigDesignVariables(design, settings.cvOverrides?.colors, application?.accentColor)
    : undefined;
  // The Kurzprofil every output shows (and the planner measures): the Bewerbung's own text, else the profile's.
  // The Deckblatt text is another field and never stands in for it.
  const summary = resolveResumeSummary(profile, resumeProfile);
  const paginatedProfile = profile && {
    ...profile,
    experiences: sections.experience ? profile.experiences : [],
    education: sections.education ? profile.education : [],
  };
  const closingSection = managerSections.find((entry) => entry.id === "closing");
  const overrides = settings.cvOverrides;
  const planContext: ResumePlanContext = {
    atsMode,
    layout: {
      mode: layout.mode,
      sidebarWidthPercent: layout.sidebarWidthPercent,
      overridden: layout.overridden,
      // The geometry was measured with the template's default sidebar; a profile column ratio widens it.
      nativeSidebarWidthPercent: resolveResumeLayout(templateId, undefined, false).sidebarWidthPercent,
    },
    sections: managerSections.map(({ id, visible, zone }) => ({ id, visible, zone })),
    closing: profile && {
      visible:
        closingSection?.visible !== false &&
        Boolean(closingLine || (!atsMode && profile.resumeClosing.showSignature && getProfileMediaSource(profile.signaturePath))),
      signature: !atsMode && profile.resumeClosing.showSignature && Boolean(getProfileMediaSource(profile.signaturePath)),
    },
    overrides: {
      bodySizePt: ["zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.typography.bodySizePt : overrides?.typography?.bodySizePt,
      headingSizePt: ["elegant", "stilvoll", "gepflegt", "klassisch", "einspaltig"].includes(templateId) ? design.typography.headingSizePt : undefined,
      subheadingSizePt: ["elegant", "stilvoll", "gepflegt", "klassisch", "einspaltig"].includes(templateId) ? design.typography.subheadingSizePt : undefined,
      fontId: templateId === "gepflegt" || templateId === "klassisch" || templateId === "einspaltig" ? design.typography.fontId : undefined,
      sectionHeadingPt: templateId === "gepflegt" || templateId === "klassisch" || templateId === "einspaltig" ? design.typography.sectionHeadingSizePt : undefined,
      lineHeight: ["zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.typography.lineHeight : overrides?.typography?.lineHeight,
      pageMarginMm: ["zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.spacing.pageMarginMm : overrides?.spacing?.pageMarginMm,
      innerPaddingMm: templateId === "elegant" ? design.spacing.innerPaddingMm : overrides?.spacing?.innerPaddingMm,
      sectionGapMm: ["elegant", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.spacing.sectionGapMm : overrides?.spacing?.sectionGapMm,
      entryGapMm: ["elegant", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.spacing.entryGapMm : overrides?.spacing?.entryGapMm,
      sectionTitleGapMm: ["elegant", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.spacing.sectionTitleGapMm : overrides?.spacing?.sectionTitleGapMm,
      entryContentGapMm: ["elegant", "kompakt", "klassisch", "einspaltig"].includes(templateId) ? design.spacing.entryContentGapMm : overrides?.spacing?.entryContentGapMm,
      columnGapMm: ["elegant", "kompakt", "gepflegt"].includes(templateId) ? design.spacing.columnGapMm : overrides?.spacing?.columnGapMm,
    },
    settings,
  };
  const planned = createResumePagePlan(
    paginatedProfile, summary, {}, templateId, planContext,
  );
  // Gepflegt's coloured sidebar is a full-page visual lane, including continuation identity pages.
  const pagePlan = templateId === "gepflegt" && !atsMode
    ? planned.map(page => ({ ...page, sidebar: true }))
    : planned;
  // The closing of these templates prints the date of the application, exactly like the Anschreiben;
  // the others keep printing the date typed into the profile.
  return {
    templateId,
    settings,
    profile,
    closingDate,
    sections,
    managerSections,
    knowledgeGroups,
    atsMode,
    layout,
    design,
    zeitgenoessischVariables,
    kreativVariables,
    stilvollVariables,
    gepflegtVariables,
    kompaktVariables,
    klassischVariables,
    einspaltigVariables,
    summary,
    pagePlan,
  };
};

export type ResolvedCvDocument = ReturnType<typeof resolveCvDocument>;
