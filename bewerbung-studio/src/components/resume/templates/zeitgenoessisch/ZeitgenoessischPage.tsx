import {
  createZeitgenoessischPageData,
  resolveZeitgenoessischSummary,
} from "./zeitgenoessisch.model";
import type { ZeitgenoessischPageProps } from "./zeitgenoessisch.types";
import { ZeitgenoessischAdditionalSections } from "./ZeitgenoessischAdditionalSections";
import { ZeitgenoessischCareerSection } from "./ZeitgenoessischCareerSection";
import { ZeitgenoessischFooter } from "./ZeitgenoessischFooter";
import { ZeitgenoessischHeader } from "./ZeitgenoessischHeader";
import { ZeitgenoessischLeftColumn } from "./ZeitgenoessischLeftColumn";
import { ZeitgenoessischSectionHeading } from "./ZeitgenoessischSectionHeading";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";

export function ZeitgenoessischPage({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  photoSource,
  resumeProfile,
  sections,
}: ZeitgenoessischPageProps) {
  const { education, experiences, isContinuation } =
    createZeitgenoessischPageData(profile, plan);
  const summary = resolveZeitgenoessischSummary(profile, resumeProfile);
  const isLastPage = plan.pageNumber === totalPages;
  // A continuation page keeps its sidebar while the page plan has sidebar content for it: the managed layer fills
  // this empty column with the planned sections (never the contacts or the strengths of page one again).
  const continuedSidebar = isContinuation && plan.sidebar === true;

  if (atsMode) {
    return (
      <main className="zeitgenoessisch-ats" data-renderer="ats">
        <ZeitgenoessischHeader
          profile={profile}
          name={name}
          photoSource={null}
          compact={isContinuation}
          atsMode
        />
        {sections.profile && summary && !isContinuation ? (
          <section
            className="zeitgenoessisch-section"
            data-element-id="zeitgenoessisch.summary"
          >
            <ZeitgenoessischSectionHeading
              title={getResumeSectionTitle(profile, "summary")}
              icon="summary"
            />
            <p className="zeitgenoessisch-summary">{summary}</p>
          </section>
        ) : null}
        {sections.experience ? (
          <ZeitgenoessischCareerSection
            kind="experience"
            title={getResumeSectionTitle(profile, "experience")}
            items={experiences}
            continuation={isContinuation}
            atsMode
          />
        ) : null}
        {sections.education ? (
          <ZeitgenoessischCareerSection
            kind="education"
            title={getResumeSectionTitle(profile, "education")}
            items={education}
            atsMode
          />
        ) : null}
        {isLastPage ? (
          <ZeitgenoessischAdditionalSections
            profile={profile}
            sections={sections}
          />
        ) : null}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="zeitgenoessisch-section" headingClassName="zeitgenoessisch-section__title" /> : null}
      </main>
    );
  }

  return (
    <div className="zeitgenoessisch-page__visual" data-renderer="visual">
      <ZeitgenoessischHeader
        profile={profile}
        name={name}
        photoSource={photoSource}
        compact={isContinuation}
      />
      <div
        className={`zeitgenoessisch-columns ${isContinuation && !continuedSidebar ? "zeitgenoessisch-columns--continuation" : ""}`}
      >
        {!isContinuation ? (
          <ZeitgenoessischLeftColumn
            profile={profile}
            sections={sections}
          />
        ) : continuedSidebar ? (
          <aside className="zeitgenoessisch-left-column zeitgenoessisch-left-column--continued" />
        ) : null}
        <main className="zeitgenoessisch-main-column">
          {sections.profile && summary && !isContinuation ? (
            <section
              className="zeitgenoessisch-section"
              data-element-id="zeitgenoessisch.summary"
            >
              <ZeitgenoessischSectionHeading
                title={getResumeSectionTitle(profile, "summary")}
                icon="summary"
              />
              <p className="zeitgenoessisch-summary">{summary}</p>
            </section>
          ) : null}
          {sections.experience ? (
            <ZeitgenoessischCareerSection
              kind="experience"
              title={getResumeSectionTitle(profile, "experience")}
              items={experiences}
              continuation={isContinuation}
            />
          ) : null}
          {sections.education ? (
            <ZeitgenoessischCareerSection
              kind="education"
              title={getResumeSectionTitle(profile, "education")}
              items={education}
            />
          ) : null}
          {!experiences.length &&
          !education.length &&
          plan.pageNumber === 1 ? (
            <p className="zeitgenoessisch-empty">
              Berufserfahrung und Ausbildung im Profil ergänzen.
            </p>
          ) : null}
          {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="zeitgenoessisch-section" headingClassName="zeitgenoessisch-section__title" /> : null}
        </main>
      </div>
      <ZeitgenoessischFooter
        profile={profile}
        pageNumber={plan.pageNumber}
        totalPages={totalPages}
        atsMode={atsMode}
      />
    </div>
  );
}
