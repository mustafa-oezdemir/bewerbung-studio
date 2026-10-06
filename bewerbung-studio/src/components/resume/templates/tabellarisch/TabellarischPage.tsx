/**
 * Tabellarisch Template - Page Component
 * Wrapper for a single A4 page
 */

import type { ApplicantProfile } from "../../../../shared/schema";
import { TabellarischHeader } from "./TabellarischHeader";
import { TabellarischBackground } from "./TabellarischBackground";
import { TabellarischSummary } from "./TabellarischSummary";
import { TabellarischStrengths } from "./TabellarischStrengths";
import { TabellarischTimeline } from "./TabellarischTimeline";
import { TabellarischContinuationHeader } from "./TabellarischContinuationHeader";
import { TabellarischFooter } from "./TabellarischFooter";
import { TabellarischAdditionalSections } from "./TabellarischAdditionalSections";
import {
  createTabellarischPageData,
  resolveTabellarischSummary,
} from "./tabellarisch.model";
import type { TabellarischPageProps } from "./tabellarisch.types";
import { getResumeSectionTitle } from "../../../../features/resume-sections/resume-sections";

export function TabellarischPage({
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  photoSource,
  resumeProfile,
  sections,
}: TabellarischPageProps) {
  const { education, experiences, isContinuation } =
    createTabellarischPageData(profile, plan);
  const summary = resolveTabellarischSummary(profile, resumeProfile);
  const isLastPage = plan.pageNumber === totalPages;
  const onPage = (id: string) => plan.blocks ? plan.blocks.includes(id) : !isContinuation;
  const experienceContinues =
    !isLastPage &&
    experiences.length > 0 &&
    experiences.at(-1)?.id !== profile?.experiences.at(-1)?.id;
  const educationContinues =
    !isLastPage &&
    education.length > 0 &&
    education.at(-1)?.id !== profile?.education.at(-1)?.id;

  return (
    <div className="tabellarisch-page__wrapper">
      {!atsMode && !isContinuation ? <TabellarischBackground /> : null}

      <main className="tabellarisch-page__content">
        {isContinuation && (
          <TabellarischContinuationHeader name={name} title={profile?.title} />
        )}

        {!isContinuation && (
          <TabellarischHeader
            name={name}
            profile={profile}
            photoSource={photoSource}
            atsMode={atsMode}
          />
        )}

        {sections.profile && onPage("summary") ? (
          <TabellarischSummary text={summary} profile={profile} />
        ) : null}

        {sections.strengths && onPage("strengths") ? (
          <TabellarischStrengths profile={profile} atsMode={atsMode} />
        ) : null}

        {sections.experience && experiences.length > 0 ? (
          <section
            className="tabellarisch-section"
            data-element-id="tabellarisch.experience"
          >
            <h2 className="tabellarisch-section__title">
              {getResumeSectionTitle(profile, "experience")}
              {isContinuation ? <small>Fortsetzung</small> : null}
            </h2>
            <TabellarischTimeline
              items={experiences}
              atsMode={atsMode}
              continuesOnNextPage={experienceContinues}
            />
          </section>
        ) : null}

        {sections.education && education.length > 0 ? (
          <section
            className="tabellarisch-section"
            data-element-id="tabellarisch.education"
          >
            <h2 className="tabellarisch-section__title">{getResumeSectionTitle(profile, "education")}</h2>
            <TabellarischTimeline
              items={education}
              atsMode={atsMode}
              continuesOnNextPage={educationContinues}
            />
          </section>
        ) : null}

        {plan.blocks?.some((id) => ["knowledge", "certifications", "languages"].includes(id)) || (!plan.blocks && isLastPage) ? (
          <TabellarischAdditionalSections
            profile={profile}
            sections={sections}
            atsMode={atsMode}
            blocks={plan.blocks}
          />
        ) : null}
      </main>

      <TabellarischFooter
        profile={profile}
        pageNumber={plan.pageNumber}
        totalPages={totalPages}
        atsMode={atsMode}
      />
    </div>
  );
}
