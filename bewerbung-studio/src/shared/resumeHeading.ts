import {
  defaultResumeHeadingTitle,
  getResumeSemanticSection,
  resolveResumeSectionInstances,
  type ResumeHeadingMode,
  type ResumeSectionInstance,
} from "../features/resume-sections/resume-section-system";
import type { ApplicantProfile } from "./schema";

/**
 * The one place that builds the Lebenslauf-Überschrift. Preview, PDF, continuation pages and the profile
 * editor all read it, so no template spells "Lebenslauf" itself. The source of truth is the `heading` entry of
 * `profile.resumeSemanticSections` (mode + `customTitle`); `profile.title` is the Berufsbezeichnung and never
 * takes part.
 */
export type ResumeHeadingSource = Pick<
  ApplicantProfile,
  "firstName" | "lastName" | "resumeSemanticSections"
>;

export const curriculumVitaeHeadingTitle = "Curriculum Vitae";
export const resumeContinuationSuffix = " · Fortsetzung";

export type ResumeHeading = {
  mode: ResumeHeadingMode;
  /** The full heading: "Lebenslauf Mustafa Özdemir" in with-name mode. */
  title: string;
  continuationTitle: string;
  /**
   * The heading for a slot that prints the candidate name right beside it (a kicker above the name). In
   * with-name mode the name is already there, so it is not repeated; every other mode equals `title`.
   */
  kicker: string;
  continuationKicker: string;
  /** The stored text of the custom mode, trimmed; kept while another mode is active. */
  customTitle: string;
  /** Custom mode without text: the heading falls back to "Lebenslauf" until a text is entered. */
  customTitleMissing: boolean;
};

const personName = (source: ResumeHeadingSource | undefined) =>
  [source?.firstName, source?.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

/** The mode a heading entry stands for; a legacy entry without a mode that holds a custom text is custom. */
export const getResumeHeadingMode = (
  heading: Pick<ResumeSectionInstance, "headingMode" | "customTitle">,
): ResumeHeadingMode =>
  heading.headingMode ?? (heading.customTitle?.trim() ? "custom" : "default");

export const resolveResumeHeading = (
  source: ResumeHeadingSource | undefined,
): ResumeHeading => {
  const heading = getResumeSemanticSection(
    source?.resumeSemanticSections,
    "heading",
  );
  const mode = getResumeHeadingMode(heading);
  const customTitle = heading.customTitle?.trim() ?? "";
  const kicker =
    mode === "curriculum-vitae"
      ? curriculumVitaeHeadingTitle
      : mode === "custom" && customTitle
        ? customTitle
        : defaultResumeHeadingTitle;
  const name = personName(source);
  const title = mode === "with-name" && name ? `${kicker} ${name}` : kicker;
  return {
    mode,
    title,
    continuationTitle: `${title}${resumeContinuationSuffix}`,
    kicker,
    continuationKicker: `${kicker}${resumeContinuationSuffix}`,
    customTitle,
    customTitleMissing: mode === "custom" && !customTitle,
  };
};

/** Changes mode and/or custom text of the heading; the heading stays visible and enabled (Pflicht). */
export const setResumeHeading = <T extends Pick<ApplicantProfile, "resumeSemanticSections">>(
  profile: T,
  change: { mode?: ResumeHeadingMode; customTitle?: string },
): T => ({
  ...profile,
  resumeSemanticSections: resolveResumeSectionInstances(
    profile.resumeSemanticSections,
  ).map((section) =>
    section.semanticType === "heading"
      ? {
          ...section,
          ...(change.mode ? { headingMode: change.mode } : {}),
          ...(change.customTitle !== undefined
            ? { customTitle: change.customTitle }
            : {}),
        }
      : section,
  ),
});

/** `target` with the heading entry of `source`; the section save of the profile writes nothing else. */
export const copyResumeHeading = <T extends Pick<ApplicantProfile, "resumeSemanticSections">>(
  source: Pick<ApplicantProfile, "resumeSemanticSections">,
  target: T,
): T => {
  const heading = getResumeSemanticSection(
    source.resumeSemanticSections,
    "heading",
  );
  return {
    ...target,
    resumeSemanticSections: resolveResumeSectionInstances(
      target.resumeSemanticSections,
    ).map((section) => (section.semanticType === "heading" ? heading : section)),
  };
};

/** A message while the heading cannot be saved (custom mode without text), otherwise undefined. */
export const validateResumeHeading = (
  source: ResumeHeadingSource | undefined,
) =>
  resolveResumeHeading(source).customTitleMissing
    ? "Bitte eine eigene Überschrift für den Lebenslauf eingeben."
    : undefined;

/** The custom text is stored trimmed; a text entered for a mode that is not active stays untouched. */
export const normalizeResumeHeading = <T extends Pick<ApplicantProfile, "resumeSemanticSections">>(
  profile: T,
): T => {
  const { customTitle } = getResumeSemanticSection(
    profile.resumeSemanticSections,
    "heading",
  );
  return customTitle === customTitle?.trim()
    ? profile
    : setResumeHeading(profile, { customTitle: customTitle.trim() });
};
