import { Fragment, type CSSProperties } from "react";
import {
  getProfileResumeSectionLayout,
  getResumeSectionTitle,
  hasSavedTemplateSectionLayout,
  type ResumeSectionType,
} from "../../../../features/resume-sections/resume-sections";
import {
  getTemplateKnowledge,
  parseTemplateStrengths,
  resolveTemplateSummary,
  uniqueTemplateValues,
} from "../resume-template-data";
import type { ModernResumeProps } from "./modern.types";
import { ModernContactSection } from "./ModernContactSection";
import { ModernEducationSection } from "./ModernEducationSection";
import { ModernExperienceSection } from "./ModernExperienceSection";
import { ModernFooter } from "./ModernFooter";
import { ModernHeader } from "./ModernHeader";
import { ModernLanguagesSection } from "./ModernLanguagesSection";
import { ModernLeftColumn } from "./ModernLeftColumn";
import { ModernRightColumn } from "./ModernRightColumn";
import { ModernStrengthsSection } from "./ModernStrengthsSection";
import { ModernSummarySection } from "./ModernSummarySection";
import { ResumeSpecialSections } from "../../ResumeSpecialSections";
import "./modern.css";

export function ModernResume({
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
}: ModernResumeProps) {
  const isContinuation = plan.pageNumber > 1;
  const isLastPage = plan.pageNumber === totalPages;
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
        summary: sections.profile
          ? resolveTemplateSummary(profile, resumeProfile)
          : "",
        experiences: sections.experience
          ? profile.experiences.filter((item) => experienceIds.has(item.id))
          : [],
        education: sections.education
          ? profile.education.filter((item) => educationIds.has(item.id))
          : [],
        skills: sections.skills ? profile.skills : [],
        strengths: sections.strengths ? profile.strengths : [],
        languages: sections.languages ? profile.languages : [],
        certifications: sections.certifications
          ? profile.certifications
          : [],
      }
    : undefined;
  const cssVariables = {
    "--modern-primary": accentColor,
    "--modern-primary-soft": secondaryColor,
  } as CSSProperties;
  const portfolio =
    profile?.portfolio || profile?.github || profile?.linkedin || "";
  const hasCustomLayout = hasSavedTemplateSectionLayout(profile, "modern");
  const savedLayout = getProfileResumeSectionLayout(profile, "modern");
  const mainOrder = savedLayout
    .filter(({ zone }) => zone === "main" || zone === "full")
    .map(({ type }) => type);
  const sidebarOrder = savedLayout
    .filter(({ zone }) => zone === "sidebar")
    .map(({ type }) => type);
  const knowledge = getTemplateKnowledge(profile);
  const strengths = parseTemplateStrengths(profile, 4);
  const certifications = uniqueTemplateValues(profile?.certifications ?? []);
  const renderOrderedSection = (
    type: ResumeSectionType,
    variant: "visual" | "ats",
  ) => {
    if (type === "summary") {
      return !isContinuation && sections.profile ? (
        <ModernSummarySection profile={pageProfile} />
      ) : null;
    }
    if (type === "experience") {
      return sections.experience ? (
        <ModernExperienceSection profile={pageProfile} />
      ) : null;
    }
    if (type === "education") {
      return sections.education ? (
        <ModernEducationSection profile={pageProfile} />
      ) : null;
    }
    if (!isLastPage) return null;
    if (type === "knowledge") {
      return sections.skills && knowledge.length ? (
        <section className={`modern-section ${variant === "visual" ? "modern-knowledge" : ""}`}>
          <h2 className="modern-section__title">
            {getResumeSectionTitle(profile, "knowledge")}
          </h2>
          {variant === "ats" ? (
            <p className="modern-summary-text">{knowledge.join(" · ")}</p>
          ) : (
            <div className="modern-knowledge__list">
              {knowledge.map((item) => <span className="modern-knowledge__item" key={item}>{item}</span>)}
            </div>
          )}
        </section>
      ) : null;
    }
    if (type === "languages") {
      return sections.languages ? (
        <ModernLanguagesSection profile={pageProfile} accentColor={accentColor} atsMode={variant === "ats"} />
      ) : null;
    }
    if (type === "strengths") {
      return sections.strengths && strengths.length ? <ModernStrengthsSection profile={pageProfile} /> : null;
    }
    if (type === "certifications") {
      if (!sections.certifications || !certifications.length) return null;
      return variant === "ats" ? (
        <section className="modern-section">
          <h2 className="modern-section__title">{getResumeSectionTitle(profile, "certifications")}</h2>
          <ul className="modern-ats-list">{certifications.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : (
        <section className="modern-section modern-achievements">
          <h2 className="modern-section__title">{getResumeSectionTitle(profile, "certifications")}</h2>
          <div className="modern-achievements__list">
            {certifications.map((item) => <div className="modern-achievements__item" key={item}><p>{item}</p></div>)}
          </div>
        </section>
      );
    }
    return null;
  };

  if (atsMode) {
    return (
      <article
        className="modern-resume-page modern-resume-page--ats"
        data-ats-mode="true"
        data-continuation={isContinuation}
        data-density={plan.density}
        style={cssVariables}
      >
        <div className="modern-resume-container">
          <main className="modern-resume-content modern-resume-ats">
            <ModernHeader
              name={name}
              profile={profile}
              accentColor={accentColor}
              atsMode
              compact={isContinuation}
            />
            {!isContinuation ? (
              <>
                <ModernContactSection
                  profile={profile}
                  accentColor={accentColor}
                  atsMode
                />
                {!hasCustomLayout && sections.profile ? (
                  <ModernSummarySection profile={pageProfile} />
                ) : null}
              </>
            ) : null}
            {hasCustomLayout
              ? savedLayout.map(({ type }) => (
                  <Fragment key={type}>{renderOrderedSection(type, "ats")}</Fragment>
                ))
              : null}
            {!hasCustomLayout && sections.experience ? (
              <ModernExperienceSection profile={pageProfile} />
            ) : null}
            {!hasCustomLayout && sections.education ? (
              <ModernEducationSection profile={pageProfile} />
            ) : null}
            {!hasCustomLayout && isLastPage && sections.skills && knowledge.length ? (
              <section className="modern-section">
                <h2 className="modern-section__title">{getResumeSectionTitle(profile, "knowledge")}</h2>
                <p className="modern-summary-text">{knowledge.join(" · ")}</p>
              </section>
            ) : null}
            {!hasCustomLayout && isLastPage && sections.languages ? (
              <ModernLanguagesSection
                profile={pageProfile}
                accentColor={accentColor}
                atsMode
              />
            ) : null}
            {!hasCustomLayout && isLastPage && sections.strengths && strengths.length ? (
              <ModernStrengthsSection profile={pageProfile} />
            ) : null}
            {!hasCustomLayout && isLastPage && sections.certifications && certifications.length ? (
              <section className="modern-section">
                <h2 className="modern-section__title">{getResumeSectionTitle(profile, "certifications")}</h2>
                <ul className="modern-ats-list">
                  {certifications.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {isLastPage ? <ResumeSpecialSections profile={profile} sectionClassName="modern-section" headingClassName="modern-section__title" /> : null}
          </main>
          <ModernFooter
            pageNumber={plan.pageNumber}
            totalPages={totalPages}
            portfolio={portfolio}
            atsMode
          />
        </div>
      </article>
    );
  }

  return (
    <article
      className="modern-resume-page"
      data-ats-mode="false"
      data-continuation={isContinuation}
      data-density={plan.density}
      style={cssVariables}
    >
      <div className="modern-resume-container">
        <div className="modern-resume-content">
          <ModernHeader
            name={name}
            profile={profile}
            accentColor={accentColor}
            photoSource={photoSource}
            atsMode={false}
            compact={isContinuation}
          >
            {!isContinuation ? (
              <ModernContactSection
                profile={profile}
                accentColor={accentColor}
                atsMode={false}
                inline
              />
            ) : null}
          </ModernHeader>
          <div
            className="modern-resume-main"
            data-continuation={isContinuation}
          >
            {hasCustomLayout ? (
              <div className="modern-resume-left-column" data-ats-mode="false">
                {mainOrder.map((type) => <Fragment key={type}>{renderOrderedSection(type, "visual")}</Fragment>)}
              </div>
            ) : (
              <ModernLeftColumn
                profile={pageProfile}
                atsMode={false}
                showSummary={!isContinuation && sections.profile}
              />
            )}
            {!isContinuation ? (
              hasCustomLayout ? (
                <div className="modern-resume-right-column" data-ats-mode="false">
                  {sidebarOrder.map((type) => <Fragment key={type}>{renderOrderedSection(type, "visual")}</Fragment>)}
                </div>
              ) : (
                <ModernRightColumn
                  profile={pageProfile}
                  accentColor={accentColor}
                  atsMode={false}
                  showStrengths={sections.strengths}
                />
              )
            ) : null}
          </div>
        </div>
        <ModernFooter
          pageNumber={plan.pageNumber}
          totalPages={totalPages}
          portfolio={portfolio}
          atsMode={false}
        />
      </div>
    </article>
  );
}
