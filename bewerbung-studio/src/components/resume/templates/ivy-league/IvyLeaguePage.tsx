import {
  createIvyLeaguePageData,
  resolveIvyLeagueSummary,
  uniqueIvyLeagueValues,
} from "./ivy-league.model";
import type { IvyLeaguePageProps } from "./ivy-league.types";
import { IvyLeagueBackground } from "./IvyLeagueBackground";
import { IvyLeagueCareerSection } from "./IvyLeagueCareerSection";
import { IvyLeagueFooter } from "./IvyLeagueFooter";
import { IvyLeagueHeader } from "./IvyLeagueHeader";
import { IvyLeagueKnowledgeSection } from "./IvyLeagueKnowledgeSection";
import { IvyLeagueLanguagesSection } from "./IvyLeagueLanguagesSection";
import { IvyLeagueSectionHeading } from "./IvyLeagueSectionHeading";
import { IvyLeagueStrengthsSection } from "./IvyLeagueStrengthsSection";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  hasSavedTemplateSectionLayout,
} from "../../../../features/resume-sections/resume-sections";

export function IvyLeaguePage({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  backgroundId,
  resumeProfile,
  sections,
}: IvyLeaguePageProps) {
  const { education, experiences, isContinuation } =
    createIvyLeaguePageData(profile, plan);
  const summary = resolveIvyLeagueSummary(profile, resumeProfile);
  const certifications = uniqueIvyLeagueValues(
    profile?.certifications ?? [],
  );
  const isLastPage = plan.pageNumber === totalPages;
  const showWatercolor =
    backgroundId === "pastel-gradient" && !atsMode;
  const sectionLayout = getProfileResumeSectionLayout(profile, "ivy-league");
  const hasCustomLayout = hasSavedTemplateSectionLayout(profile, "ivy-league");

  const certificationSection =
    sections.certifications && certifications.length ? (
      <section
        className="ivy-league-section ivy-league-certifications"
        data-element-id="ivy-league.certifications"
      >
        <IvyLeagueSectionHeading>{getResumeSectionTitle(profile, "certifications")}</IvyLeagueSectionHeading>
        <ul>
          {certifications.map((certification) => (
            <li key={certification}>{certification}</li>
          ))}
        </ul>
      </section>
    ) : null;

  const renderOrderedSections = (mode: "visual" | "ats") => {
    const order = hasCustomLayout
      ? sectionLayout.map(({ type }) => type)
      : mode === "ats"
        ? ["summary", "experience", "education", "knowledge", "languages", "strengths", "certifications"]
        : ["summary", "strengths", "experience", "education", "knowledge", "languages", "certifications"];
    return order.map((type) => {
      if (type === "summary") {
        return sections.profile && summary && !isContinuation ? (
          <section className="ivy-league-section" data-element-id="ivy-league.summary" key={type}>
            <IvyLeagueSectionHeading>{getResumeSectionTitle(profile, "summary")}</IvyLeagueSectionHeading>
            <p className="ivy-league-summary">{summary}</p>
          </section>
        ) : null;
      }
      if (type === "strengths") {
        return sections.strengths && !isContinuation ? (
          <IvyLeagueStrengthsSection key={type} profile={profile} atsMode={mode === "ats"} />
        ) : null;
      }
      if (type === "experience") {
        return sections.experience ? (
          <IvyLeagueCareerSection key={type} kind="experience" title={getResumeSectionTitle(profile, "experience")} items={experiences} continuation={isContinuation} atsMode={mode === "ats"} />
        ) : null;
      }
      if (type === "education") {
        return sections.education ? (
          <IvyLeagueCareerSection key={type} kind="education" title={getResumeSectionTitle(profile, "education")} items={education} atsMode={mode === "ats"} />
        ) : null;
      }
      if (type === "knowledge") {
        return isLastPage && sections.skills ? <IvyLeagueKnowledgeSection key={type} profile={profile} /> : null;
      }
      if (type === "languages") {
        return isLastPage && sections.languages ? <IvyLeagueLanguagesSection key={type} profile={profile} atsMode={mode === "ats"} /> : null;
      }
      if (type === "certifications") {
        return isLastPage ? <div key={type}>{certificationSection}</div> : null;
      }
      return null;
    });
  };

  if (atsMode) {
    return (
      <main className="ivy-league-ats" data-renderer="ats">
        <IvyLeagueHeader
          profile={profile}
          name={name}
          compact={isContinuation}
          atsMode
        />
        {renderOrderedSections("ats")}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="ivy-league-section" headingClassName="ivy-league-section__title" /> : null}
      </main>
    );
  }

  return (
    <div className="ivy-league-page__visual" data-renderer="visual">
      {showWatercolor ? <IvyLeagueBackground /> : null}
      <div className="ivy-league-content">
        <IvyLeagueHeader
          profile={profile}
          name={name}
          compact={isContinuation}
        />
        {renderOrderedSections("visual")}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="ivy-league-section" headingClassName="ivy-league-section__title" /> : null}
        {!experiences.length &&
        !education.length &&
        plan.pageNumber === 1 ? (
          <p className="ivy-league-empty">
            Berufserfahrung und Ausbildung im Profil ergänzen.
          </p>
        ) : null}
      </div>
      <IvyLeagueFooter
        profile={profile}
        pageNumber={plan.pageNumber}
        totalPages={totalPages}
      />
    </div>
  );
}
