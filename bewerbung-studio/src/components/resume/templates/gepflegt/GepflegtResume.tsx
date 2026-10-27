import type { CSSProperties } from "react";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import { resolveTemplateSummary } from "../resume-template-data";
import { GepflegtAtsExtra } from "./GepflegtAtsExtra";
import { GepflegtFooter } from "./GepflegtFooter";
import { GepflegtHeader } from "./GepflegtHeader";
import { GepflegtMainContent } from "./GepflegtMainContent";
import { GepflegtSidebar } from "./GepflegtSidebar";
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
  designVariables,
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
  // The native stylesheet is the fallback; the resolved document owns every live value.
  const cssVariables = (designVariables ?? {
    "--gepflegt-accent": accentColor,
    "--gepflegt-sidebar-background": secondaryColor,
  }) as CSSProperties;

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
            {plan.pageNumber === totalPages ? <ResumeSpecialSections profile={profile} sectionClassName="gepflegt-section" headingClassName="gepflegt-section__title" /> : null}
          </GepflegtMainContent>
          {/* Like the PDF: the plain sheet's extra blocks follow the main column (its special sections and the closing). */}
          {atsMode && plan.pageNumber === totalPages ? <GepflegtAtsExtra profile={profile} sections={sections} /> : null}
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
