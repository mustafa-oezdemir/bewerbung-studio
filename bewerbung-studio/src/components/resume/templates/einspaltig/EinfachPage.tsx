import {
  createTemplatePageData,
  resolveTemplateSummary,
  toTemplateExternalHref,
} from "../resume-template-data";
import type { EinspaltigResumeProps } from "./einfach.types";
import { EinfachBackground } from "./EinfachBackground";
import { EinfachHeader } from "./EinfachHeader";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  hasSavedTemplateSectionLayout,
} from "../../../../features/resume-sections/resume-sections";
import {
  EinfachCareer,
  EinfachCertifications,
  EinfachHeading,
  EinfachKnowledge,
  EinfachLanguages,
  EinfachStrengths,
} from "./EinfachSections";
import { getResumeSemanticTitle } from "../../../../features/resume-sections/resume-section-system";
import { formatResumeContactLine } from "../../../../shared/resumePersonalData";

type Props = Omit<EinspaltigResumeProps, "accentColor" | "secondaryColor">;

export function EinfachPage({
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
  const { experiences, education, isContinuation } = createTemplatePageData(
    profile,
    plan,
  );
  const summary = resolveTemplateSummary(profile, resumeProfile);
  const isLastPage = plan.pageNumber === totalPages;
  const portfolio =
    profile?.portfolio || profile?.github || profile?.linkedin || "";
  const sectionLayout = getProfileResumeSectionLayout(profile, "einspaltig");
  const hasCustomLayout = hasSavedTemplateSectionLayout(profile, "einspaltig");
  const renderOrderedSections = () => {
    const order = hasCustomLayout
      ? sectionLayout.map(({ type }) => type)
      : atsMode
        ? [
            "summary",
            "experience",
            "education",
            "knowledge",
            "languages",
            "strengths",
            "certifications",
          ]
        : [
            "summary",
            "strengths",
            "experience",
            "education",
            "knowledge",
            "languages",
            "certifications",
          ];
    return order.map((type) => {
      if (type === "summary") {
        return sections.profile && summary && !isContinuation ? (
          <section
            key={type}
            className="einfach-section"
            data-element-id="einspaltig.summary">
            <EinfachHeading>
              {getResumeSectionTitle(profile, "summary")}
            </EinfachHeading>
            <p className="einfach-summary">{summary}</p>
          </section>
        ) : null;
      }
      if (type === "strengths") {
        return sections.strengths &&
          !isContinuation &&
          (!atsMode || isLastPage) ? (
          <EinfachStrengths key={type} profile={profile} atsMode={atsMode} />
        ) : null;
      }
      if (type === "experience") {
        return sections.experience ? (
          <EinfachCareer
            key={type}
            kind="experience"
            title={getResumeSectionTitle(profile, "experience")}
            items={experiences}
            continuation={isContinuation}
          />
        ) : null;
      }
      if (type === "education") {
        return sections.education ? (
          <EinfachCareer
            key={type}
            kind="education"
            title={getResumeSectionTitle(profile, "education")}
            items={education}
          />
        ) : null;
      }
      if (type === "knowledge") {
        return isLastPage && sections.skills ? (
          <EinfachKnowledge key={type} profile={profile} />
        ) : null;
      }
      if (type === "languages") {
        return isLastPage && sections.languages ? (
          <EinfachLanguages key={type} profile={profile} atsMode={atsMode} />
        ) : null;
      }
      if (type === "certifications") {
        return isLastPage && sections.certifications ? (
          <EinfachCertifications key={type} profile={profile} />
        ) : null;
      }
      return null;
    });
  };
  const body = (
    <>
      {renderOrderedSections()}
      {isLastPage ? (
        <ResumeSpecialSections
          profile={profile}
          sectionClassName="einfach-section"
          headingClassName="einfach-section__title"
        />
      ) : null}
    </>
  );
  if (atsMode) {
    return (
      <main className="einfach-ats" data-renderer="ats">
        <EinfachHeader
          profile={profile}
          name={name}
          photoSource={null}
          compact={isContinuation}
          atsMode
        />
        {!isContinuation ? (
          <section className="einfach-section" data-resume-personal>
            <EinfachHeading>{getResumeSemanticTitle(profile?.resumeSemanticSections, "personalData")}</EinfachHeading>
            <p>{formatResumeContactLine(profile)}</p>
          </section>
        ) : null}
        {body}
      </main>
    );
  }
  return (
    <div className="einfach-page__visual" data-renderer="visual">
      {backgroundId === "geometric" ? <EinfachBackground /> : null}
      <div className="einfach-content">
        <EinfachHeader
          profile={profile}
          name={name}
          photoSource={photoSource}
          compact={isContinuation}
        />
        {body}
      </div>
      <footer className="einfach-footer" data-element-id="einspaltig.footer">
        {portfolio ? (
          <a href={toTemplateExternalHref(portfolio)}>{portfolio}</a>
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
