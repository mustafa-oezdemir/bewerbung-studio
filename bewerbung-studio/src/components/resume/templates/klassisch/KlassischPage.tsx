import {
  createTemplatePageData,
  resolveTemplateSummary,
  toTemplateExternalHref,
} from "../resume-template-data";
import { KlassischBackground } from "./KlassischBackground";
import { KlassischHeader } from "./KlassischHeader";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import {
  KlassischCareer,
  KlassischCertifications,
  KlassischHeading,
  KlassischKnowledge,
  KlassischLanguages,
  KlassischStrengths,
} from "./KlassischSections";
import type { KlassischResumeProps } from "./klassisch.types";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  hasSavedTemplateSectionLayout,
  type ResumeSectionType,
} from "../../../../features/resume-sections/resume-sections";
import { getResumeSemanticTitle } from "../../../../features/resume-sections/resume-section-system";
import { formatResumeContactLine } from "../../../../shared/resumePersonalData";

type Props = Omit<KlassischResumeProps, "accentColor" | "secondaryColor">;

export function KlassischPage({
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
  const portfolio = profile?.portfolio || profile?.github || profile?.linkedin || "";
  const hasCustomLayout = hasSavedTemplateSectionLayout(profile, "klassisch");
  const savedOrder = getProfileResumeSectionLayout(profile, "klassisch").map(
    ({ type }) => type,
  );
  const renderSection = (type: ResumeSectionType, mode: "visual" | "ats") => {
    if (type === "summary") {
      return sections.profile && summary && !isContinuation ? (
        <section key={type} className="klassisch-section" data-element-id="klassisch.summary">
          <KlassischHeading>{getResumeSectionTitle(profile, "summary")}</KlassischHeading>
          <p className="klassisch-summary">{summary}</p>
        </section>
      ) : null;
    }
    if (type === "strengths") return !isContinuation && sections.strengths ? <KlassischStrengths key={type} profile={profile} atsMode={mode === "ats"} /> : null;
    if (type === "experience") return sections.experience ? <KlassischCareer key={type} kind="experience" title={getResumeSectionTitle(profile, "experience")} items={experiences} continuation={isContinuation} /> : null;
    if (type === "education") return sections.education ? <KlassischCareer key={type} kind="education" title={getResumeSectionTitle(profile, "education")} items={education} /> : null;
    if (type === "knowledge") return isLastPage && sections.skills ? <KlassischKnowledge key={type} profile={profile} /> : null;
    if (type === "languages") return isLastPage && sections.languages ? <KlassischLanguages key={type} profile={profile} atsMode={mode === "ats"} /> : null;
    if (type === "certifications") return isLastPage && sections.certifications ? <KlassischCertifications key={type} profile={profile} /> : null;
    return null;
  };
  const visualOrder: ResumeSectionType[] = hasCustomLayout
    ? savedOrder
    : ["summary", "strengths", "experience", "education", "knowledge", "languages", "certifications"];
  const atsOrder: ResumeSectionType[] = hasCustomLayout
    ? savedOrder
    : ["summary", "experience", "education", "knowledge", "languages", "strengths", "certifications"];
  const visualBody = <>{visualOrder.map((type) => renderSection(type, "visual"))}</>;
  if (atsMode) {
    return (
      <main className="klassisch-ats" data-renderer="ats">
        <KlassischHeader
          profile={profile}
          name={name}
          photoSource={null}
          compact={isContinuation}
          atsMode
        />
        {!isContinuation && profile ? (
          <section className="klassisch-section" data-resume-personal>
            <KlassischHeading>{getResumeSemanticTitle(profile?.resumeSemanticSections, "personalData")}</KlassischHeading>
            <p>{formatResumeContactLine(profile)}</p>
          </section>
        ) : null}
        {atsOrder.map((type) => renderSection(type, "ats"))}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="klassisch-section" headingClassName="klassisch-section__title" /> : null}
      </main>
    );
  }
  return (
    <div className="klassisch-page__visual" data-renderer="visual">
      {!isContinuation && backgroundId === "classic-soft-blue-waves" ? (
        <KlassischBackground />
      ) : null}
      <div className="klassisch-content">
        <KlassischHeader
          profile={profile}
          name={name}
          photoSource={photoSource}
          compact={isContinuation}
        />
        {visualBody}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="klassisch-section" headingClassName="klassisch-section__title" /> : null}
      </div>
      <footer className="klassisch-footer" data-element-id="klassisch.footer">
        {portfolio ? (
          <a href={toTemplateExternalHref(portfolio)}>{portfolio}</a>
        ) : (
          <span />
        )}
        {totalPages > 1 ? (
          <span>Seite {plan.pageNumber} / {totalPages}</span>
        ) : null}
      </footer>
    </div>
  );
}
