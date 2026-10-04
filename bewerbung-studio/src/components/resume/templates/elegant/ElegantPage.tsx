import {
  createElegantPageData,
  resolveElegantSummary,
} from "./elegant.model";
import type { ElegantPageProps } from "./elegant.types";
import { ElegantAdditionalSections } from "./ElegantAdditionalSections";
import { ElegantCareerSection } from "./ElegantCareerSection";
import { ElegantFooter } from "./ElegantFooter";
import { ElegantHeader } from "./ElegantHeader";
import { ElegantSidebar } from "./ElegantSidebar";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function ElegantPage({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  photoSource,
  resumeProfile,
  sections,
}: ElegantPageProps) {
  const { education, experiences, isContinuation } = createElegantPageData(
    profile,
    plan,
  );
  const summary = resolveElegantSummary(profile, resumeProfile);
  const isLastPage = plan.pageNumber === totalPages;

  if (atsMode) {
    return (
      <main className="elegant-ats" data-renderer="ats">
        <ElegantHeader profile={profile} name={name} compact={isContinuation} />

        {sections.profile && summary && !isContinuation ? (
          <section
            className="elegant-section elegant-ats__summary"
            data-element-id="elegant.summary"
          >
            <h2 className="elegant-section__title">{getResumeSectionTitle(profile, "summary")}</h2>
            <p>{summary}</p>
          </section>
        ) : null}

        {sections.experience ? (
          <ElegantCareerSection
            kind="experience"
            title={getResumeSectionTitle(profile, "experience")}
            items={experiences}
            continuation={isContinuation}
          />
        ) : null}
        {sections.education ? (
          <ElegantCareerSection kind="education" title={getResumeSectionTitle(profile, "education")} items={education} />
        ) : null}
        {isLastPage ? (
          <ElegantAdditionalSections profile={profile} sections={sections} />
        ) : null}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="elegant-section" headingClassName="elegant-section__title" /> : null}
      </main>
    );
  }

  return (
    <div className="elegant-page__visual" data-renderer="visual">
      <main className="elegant-main">
        <ElegantHeader profile={profile} name={name} compact={isContinuation} />
        {sections.experience ? (
          <ElegantCareerSection
            kind="experience"
            title={getResumeSectionTitle(profile, "experience")}
            items={experiences}
            continuation={isContinuation}
          />
        ) : null}
        {sections.education ? (
          <ElegantCareerSection kind="education" title={getResumeSectionTitle(profile, "education")} items={education} />
        ) : null}
        {!experiences.length &&
        !education.length &&
        plan.pageNumber === 1 ? (
          <p className="elegant-main__empty">
            Berufserfahrung und Ausbildung im Profil ergänzen.
          </p>
        ) : null}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="elegant-section" headingClassName="elegant-section__title" /> : null}
        <ElegantFooter
          profile={profile}
          pageNumber={plan.pageNumber}
          totalPages={totalPages}
          atsMode={atsMode}
        />
      </main>
      <ElegantSidebar
        profile={profile}
        name={name}
        photoSource={photoSource}
        summary={summary}
        sections={sections}
        isContinuation={isContinuation}
        pageNumber={plan.pageNumber}
        totalPages={totalPages}
      />
    </div>
  );
}
