import type { CSSProperties } from "react";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import { resolveTemplateSummary } from "../resume-template-data";
import { GepflegtFooter } from "./GepflegtFooter";
import { GepflegtHeader } from "./GepflegtHeader";
import { GepflegtMainContent } from "./GepflegtMainContent";
import { GepflegtSidebar } from "./GepflegtSidebar";
import { gepflegtDefaults } from "./gepflegt.defaults";
import type { GepflegtResumeProps } from "./gepflegt.types";
import "./gepflegt.css";

export function GepflegtResume({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  accentColor,
  secondaryColor,
  photoSource,
  resumeProfile,
  sections,
}: GepflegtResumeProps) {
  const isContinuation = plan.pageNumber > 1;
  const experienceIds = new Set(
    plan.items
      .filter((item) => item.kind === "experience")
      .map((item) => item.id),
  );
  const educationIds = new Set(
    plan.items
      .filter((item) => item.kind === "education")
      .map((item) => item.id),
  );
  const pageProfile = profile
    ? {
        ...profile,
        experiences: sections.experience
          ? profile.experiences.filter((item) => experienceIds.has(item.id))
          : [],
        education: sections.education
          ? profile.education.filter((item) => educationIds.has(item.id))
          : [],
      }
    : undefined;
  const summary = sections.profile
    ? resolveTemplateSummary(profile, resumeProfile)
    : "";
  const cssVariables = {
    "--gepflegt-sidebar-width": `${gepflegtDefaults.layout.sidebarWidthMm}mm`,
    "--gepflegt-topbar-height": `${gepflegtDefaults.layout.topBarHeightMm}mm`,
    "--gepflegt-sidebar-background":
      secondaryColor || gepflegtDefaults.colors.sidebarBackground,
    "--gepflegt-topbar": gepflegtDefaults.colors.sidebarTopBar,
    "--gepflegt-sidebar-text": gepflegtDefaults.colors.sidebarText,
    "--gepflegt-sidebar-muted": gepflegtDefaults.colors.sidebarMutedText,
    "--gepflegt-accent": accentColor || gepflegtDefaults.colors.accent,
    "--gepflegt-heading": gepflegtDefaults.colors.heading,
    "--gepflegt-text": gepflegtDefaults.colors.text,
    "--gepflegt-muted": gepflegtDefaults.colors.mutedText,
    "--gepflegt-divider": gepflegtDefaults.colors.divider,
    "--gepflegt-paper": gepflegtDefaults.colors.pageBackground,
    "--gepflegt-sidebar-padding-top": `${gepflegtDefaults.sidebar.paddingTopMm}mm`,
    "--gepflegt-sidebar-padding-right": `${gepflegtDefaults.sidebar.paddingRightMm}mm`,
    "--gepflegt-sidebar-padding-bottom": `${gepflegtDefaults.sidebar.paddingBottomMm}mm`,
    "--gepflegt-sidebar-padding-left": `${gepflegtDefaults.sidebar.paddingLeftMm}mm`,
    "--gepflegt-photo-size": `${gepflegtDefaults.sidebar.photoSizeMm}mm`,
    "--gepflegt-main-padding-top": `${gepflegtDefaults.main.paddingTopMm}mm`,
    "--gepflegt-main-padding-right": `${gepflegtDefaults.main.paddingRightMm}mm`,
    "--gepflegt-main-padding-bottom": `${gepflegtDefaults.main.paddingBottomMm}mm`,
    "--gepflegt-main-padding-left": `${gepflegtDefaults.main.paddingLeftMm}mm`,
    "--gepflegt-section-gap": `${gepflegtDefaults.spacing.sectionGapMm}mm`,
    "--gepflegt-entry-gap": `${gepflegtDefaults.spacing.entryGapMm}mm`,
    "--gepflegt-name-size": `${gepflegtDefaults.typography.nameSizePt}pt`,
    "--gepflegt-title-size": `${gepflegtDefaults.typography.jobTitleSizePt}pt`,
    "--gepflegt-section-title-size": `${gepflegtDefaults.typography.sectionTitleSizePt}pt`,
    "--gepflegt-sidebar-title-size": `${gepflegtDefaults.typography.sidebarTitleSizePt}pt`,
    "--gepflegt-entry-title-size": `${gepflegtDefaults.typography.entryTitleSizePt}pt`,
    "--gepflegt-body-size": `${gepflegtDefaults.typography.bodySizePt}pt`,
    "--gepflegt-small-size": `${gepflegtDefaults.typography.smallSizePt}pt`,
    "--gepflegt-line-height": gepflegtDefaults.typography.bodyLineHeight,
    "--gepflegt-font": gepflegtDefaults.typography.fontFamily,
  } as CSSProperties;

  return (
    <article
      className={`gepflegt-page ${atsMode ? "gepflegt-page--ats" : ""}`}
      data-ats-mode={atsMode}
      data-continuation={isContinuation}
      data-density={plan.density}
      lang="de"
      style={cssVariables}
    >
      <div className="gepflegt-layout">
        {!atsMode ? (
          <GepflegtSidebar
            profile={profile}
            name={name}
            summary={summary}
            sections={sections}
            atsMode={false}
            photoSource={photoSource}
            isContinuation={isContinuation}
            pageNumber={plan.pageNumber}
            totalPages={totalPages}
          />
        ) : null}

        <div className="gepflegt-content">
          <GepflegtHeader
            name={name}
            profile={profile}
            atsMode={atsMode}
            compact={isContinuation}
          />
          {atsMode && !isContinuation && summary ? (
            <section className="gepflegt-section gepflegt-ats-summary">
              <h2 className="gepflegt-section__title">{getResumeSectionTitle(profile, "summary")}</h2>
              <p>{summary}</p>
            </section>
          ) : null}
          <GepflegtMainContent
            profile={pageProfile}
            atsMode={atsMode}
            isContinuation={isContinuation}
          >
            {!atsMode && plan.pageNumber === totalPages ? <ResumeSpecialSections profile={profile} sectionClassName="gepflegt-section" headingClassName="gepflegt-section__title" /> : null}
          </GepflegtMainContent>
          {atsMode && plan.pageNumber === totalPages ? (
            <GepflegtSidebar
              profile={profile}
              name={name}
              summary=""
              sections={sections}
              atsMode
              photoSource={null}
              isContinuation={false}
              pageNumber={plan.pageNumber}
              totalPages={totalPages}
            />
          ) : null}
          {atsMode && plan.pageNumber === totalPages ? <ResumeSpecialSections profile={profile} sectionClassName="gepflegt-section" headingClassName="gepflegt-section__title" /> : null}
          <GepflegtFooter
            profile={profile}
            pageNumber={plan.pageNumber}
            totalPages={totalPages}
            atsMode={atsMode}
          />
        </div>
      </div>
    </article>
  );
}

export default GepflegtResume;
