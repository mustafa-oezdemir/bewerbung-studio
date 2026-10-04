import {
  createZweispaltigPageData,
  resolveZweispaltigSummary,
} from "./zweispaltig.model";
import type { ZweispaltigPageProps } from "./zweispaltig.types";
import { ZweispaltigAdditionalSections } from "./ZweispaltigAdditionalSections";
import { ZweispaltigCareerSection } from "./ZweispaltigCareerSection";
import { ZweispaltigFooter } from "./ZweispaltigFooter";
import { ZweispaltigHeader } from "./ZweispaltigHeader";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import {
  ZweispaltigSidebar,
  ZweispaltigSupplementalSections,
} from "./ZweispaltigSidebar";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  hasSavedTemplateSectionLayout,
  type ResumeSectionType,
} from "../../../../features/resume-sections/resume-sections";

export function ZweispaltigPage({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  photoSource,
  resumeProfile,
  sections,
}: ZweispaltigPageProps) {
  const { education, experiences, isContinuation } =
    createZweispaltigPageData(profile, plan);
  const experienceContinuation = (plan.items.find((item) => item.kind === "experience")?.bullets?.from ?? 0) > 0;
  const summary = resolveZweispaltigSummary(profile, resumeProfile);
  const isLastPage = plan.pageNumber === totalPages;
  const hasCustomLayout = hasSavedTemplateSectionLayout(profile, "zweispaltig");
  const savedLayout = getProfileResumeSectionLayout(profile, "zweispaltig");
  const mainOrder: ResumeSectionType[] = hasCustomLayout
    ? savedLayout.filter(({ zone }) => zone === "main" || zone === "full").map(({ type }) => type)
    : ["experience", "education"];
  const sidebarOrder: ResumeSectionType[] = hasCustomLayout
    ? savedLayout.filter(({ zone }) => zone === "sidebar").map(({ type }) => type)
    : ["summary", "strengths", "knowledge", "languages", "certifications"];
  const atsOrder: ResumeSectionType[] = hasCustomLayout
    ? savedLayout.map(({ type }) => type)
    : ["summary", "experience", "education", "knowledge", "languages", "strengths", "certifications"];

  const renderOrderedSection = (type: ResumeSectionType, variant: "visual" | "ats") => {
    if (type === "summary") {
      return sections.profile && summary && !isContinuation ? (
        <section className="zweispaltig-section" data-element-id="zweispaltig.summary">
          <h2 className="zweispaltig-section__title">{getResumeSectionTitle(profile, "summary")}</h2>
          <p className="zweispaltig-summary">{summary}</p>
        </section>
      ) : null;
    }
    if (type === "experience") return sections.experience ? <ZweispaltigCareerSection kind="experience" title={getResumeSectionTitle(profile, "experience")} items={experiences} continuation={experienceContinuation} /> : null;
    if (type === "education") return sections.education ? <ZweispaltigCareerSection kind="education" title={getResumeSectionTitle(profile, "education")} items={education} /> : null;
    if (!isLastPage) return null;
    return (
      <ZweispaltigSupplementalSections
        order={[type]}
        profile={profile}
        sections={sections}
        summary={summary}
        variant={variant === "ats" ? "ats" : "sidebar"}
      />
    );
  };

  if (atsMode) {
    return (
      <main className="zweispaltig-ats" data-renderer="ats">
        <ZweispaltigHeader
          profile={profile}
          name={name}
          photoSource={null}
          atsMode
        />
        {hasCustomLayout ? atsOrder.map((type) => <div className="zweispaltig-ordered-section" key={type}>{renderOrderedSection(type, "ats")}</div>) : null}
        {!hasCustomLayout && sections.profile && summary && !isContinuation ? (
          <section className="zweispaltig-section" data-element-id="zweispaltig.summary"><h2 className="zweispaltig-section__title">{getResumeSectionTitle(profile, "summary")}</h2><p>{summary}</p></section>
        ) : null}
        {!hasCustomLayout && sections.experience ? <ZweispaltigCareerSection kind="experience" title={getResumeSectionTitle(profile, "experience")} items={experiences} continuation={experienceContinuation} /> : null}
        {!hasCustomLayout && sections.education ? <ZweispaltigCareerSection kind="education" title={getResumeSectionTitle(profile, "education")} items={education} /> : null}
        {!hasCustomLayout && isLastPage ? (
          <ZweispaltigAdditionalSections
            profile={profile}
            sections={sections}
          />
        ) : null}
        {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="zweispaltig-section" headingClassName="zweispaltig-section__title" /> : null}
      </main>
    );
  }

  return (
    <div className="zweispaltig-page__visual" data-renderer="visual">
      <ZweispaltigHeader
        profile={profile}
        name={name}
        photoSource={photoSource}
      />
      <div
        className={`zweispaltig-columns ${isContinuation ? "zweispaltig-columns--continuation" : ""}`}
      >
        <main className="zweispaltig-main">
          {mainOrder.map((type) => <div className="zweispaltig-ordered-section" key={type}>{renderOrderedSection(type, "visual")}</div>)}
          {!experiences.length &&
          !education.length &&
          plan.pageNumber === 1 ? (
            <p className="zweispaltig-empty">
              Berufserfahrung und Ausbildung im Profil ergänzen.
            </p>
          ) : null}
          {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="zweispaltig-section" headingClassName="zweispaltig-section__title" /> : null}
        </main>
        {!isContinuation ? (
          <ZweispaltigSidebar profile={profile} sections={sections} order={sidebarOrder} summary={summary} />
        ) : null}
      </div>
      <ZweispaltigFooter
        profile={profile}
        pageNumber={plan.pageNumber}
        totalPages={totalPages}
        atsMode={atsMode}
      />
    </div>
  );
}
