import {
  createTemplatePageData,
  resolveTemplateSummary,
  toTemplateExternalHref,
} from "../resume-template-data";
import type { KompaktResumeProps } from "./kompakt.types";
import { KompaktBackground } from "./KompaktBackground";
import { KompaktHeader } from "./KompaktHeader";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import {
  KompaktAtsExtras,
  KompaktCareer,
  KompaktLanguages,
  KompaktRightColumn,
  KompaktHeading,
} from "./KompaktSections";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";
import { getResumeSemanticTitle } from "../../../../features/resume-sections/resume-section-system";
import { formatResumeContactLine } from "../../../../shared/resumePersonalData";

type Props = Omit<KompaktResumeProps, "accentColor" | "secondaryColor">;

export function KompaktPage({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  backgroundId,
  photoSource,
  resumeProfile,
  sections,
}: Props) {
  const { experiences, education, isContinuation } =
    createTemplatePageData(profile, plan);
  const summary = resolveTemplateSummary(profile, resumeProfile);
  const isLastPage = plan.pageNumber === totalPages;
  const portfolio =
    profile?.portfolio || profile?.github || profile?.linkedin || "";
  const portfolioHref = portfolio
    ? toTemplateExternalHref(portfolio)
    : "";

  if (atsMode) {
    return (
      <main className="kompakt-ats" data-renderer="ats">
        <KompaktHeader
          name={name}
          title={profile?.title}
          profile={profile}
          compact={isContinuation}
        />
        {!isContinuation ? (
          <section className="kompakt-section" data-element-id="kompakt.contacts">
            <KompaktHeading>{getResumeSemanticTitle(profile?.resumeSemanticSections, "personalData")}</KompaktHeading>
            <p>{formatResumeContactLine(profile)}</p>
          </section>
        ) : null}
        {sections.profile && summary && !isContinuation ? (
          <section className="kompakt-section" data-element-id="kompakt.summary">
            <KompaktHeading>{getResumeSectionTitle(profile, "summary")}</KompaktHeading>
            <p>{summary}</p>
          </section>
        ) : null}
        {sections.experience ? (
          <KompaktCareer
            kind="experience"
            title={getResumeSectionTitle(profile, "experience")}
            items={experiences}
            continuation={isContinuation}
          />
        ) : null}
        {sections.education ? (
          <KompaktCareer kind="education" title={getResumeSectionTitle(profile, "education")} items={education} />
        ) : null}
        {isLastPage ? (
          <KompaktAtsExtras profile={profile} sections={sections} />
        ) : null}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="kompakt-section" headingClassName="kompakt-section__title" /> : null}
      </main>
    );
  }

  return (
    <div className="kompakt-page__visual" data-renderer="visual">
      {backgroundId === "abstract" ? <KompaktBackground /> : null}
      <KompaktHeader
        name={name}
        title={profile?.title}
        profile={profile}
        compact={isContinuation}
        photoSource={isContinuation ? null : photoSource}
      />
      <div
        className={`kompakt-content ${isContinuation ? "kompakt-content--continuation" : ""}`}
      >
        <main className="kompakt-left">
          {sections.profile && summary && !isContinuation ? (
            <section className="kompakt-section" data-element-id="kompakt.summary">
              <KompaktHeading>{getResumeSectionTitle(profile, "summary")}</KompaktHeading>
              <p className="kompakt-summary">{summary}</p>
            </section>
          ) : null}
          {sections.experience ? (
            <KompaktCareer
              kind="experience"
              title={getResumeSectionTitle(profile, "experience")}
              items={experiences}
              continuation={isContinuation}
            />
          ) : null}
          {sections.education ? (
            <KompaktCareer kind="education" title={getResumeSectionTitle(profile, "education")} items={education} />
          ) : null}
          {plan.blocks?.includes("languages") && sections.languages ? (
            <KompaktLanguages profile={profile} />
          ) : null}
          {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="kompakt-section" headingClassName="kompakt-section__title" /> : null}
        </main>
        {!isContinuation ? (
          <KompaktRightColumn
            profile={profile}
            sections={sections}
          />
        ) : null}
      </div>
      <footer className="kompakt-footer" data-element-id="kompakt.footer">
        {portfolio ? (
          <a href={portfolioHref}>{portfolioHref}</a>
        ) : (
          <span />
        )}
        {totalPages > 1 ? (
          <span>
            Seite {plan.pageNumber} / {totalPages}
          </span>
        ) : null}
      </footer>
    </div>
  );
}
