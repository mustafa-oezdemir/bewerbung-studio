import {
  BriefcaseBusiness,
  Code2,
  Database,
  GraduationCap,
  Languages,
  Lightbulb,
  UserRound,
  Wrench,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { getTemplateKnowledge, parseTemplateStrengths, resolveTemplateSummary } from "../resume-template-data";
import { presentLanguage } from "../LanguageLevelText";
import type { ApplicantProfile } from "../../../../shared/schema";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import { resolveResumeClosingLine } from "../../../../shared/resumeClosing";
import { interestEntryText } from "../../../../shared/resumeCustomSections";
import { resolveResumeHeading } from "../../../../shared/resumeHeading";
import { resolveEducationPresentation } from "../../../../shared/resumeEducation";
import { resolveExperience } from "../../../../shared/resumeCareer";

import { groupPehlioneCompetencies } from "../../../../shared/pehlioneCompetencies";
import {
  getPehlioneCoreCompetencies,
  getPehlioneProjectHighlight,
  hasPehlioneCustomProjectHighlight,
  getPehlioneTechnicalFocus,
} from "../../../../shared/pehlioneContent";
import {
  getResumeSemanticSection,
  getResumeSemanticTitle,
  resolveKnowledgeGroups,
} from "../../../../features/resume-sections/resume-section-system";
import { getProfileMediaSource } from "../../../../shared/profileMedia";
import { getPehlioneContacts, renderPehlioneContacts, pehlioneContactsCss } from "../../../../shared/pehlioneContacts";
import { pehlioneBlueprintMarkup } from "../../../../shared/pehlioneBlueprint";
import { getPehlioneNativeVariables } from "../../../../shared/pehlioneAppearance";
import "./pehlione.css";
import "./pehlione-blocks.css";
import "./pehlione-white.css";

type Props = {
  templateId?: "pehlione_white_blue" | "pehlione_white";
  profile?: ApplicantProfile;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  accentColor: string;
  secondaryColor: string;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
  /** Date of the application, for the templates whose closing prints it (`ResolvedCvDocument.closingDate`). */
  closingDate?: string;
};

const heading = (icon: ReactNode, title: string, className = "") => (
  <h2 className={`pehlione-section-heading${className ? ` ${className}` : ""}`}>
    <span>{icon}</span>
    <b>{title}</b>
  </h2>
);

export function PehlioneResume({
  templateId = "pehlione_white_blue",
  profile,
  name,
  atsMode,
  plan,
  totalPages,
  accentColor,
  secondaryColor,
  resumeProfile,
  sections,
  closingDate,
}: Props) {
  const continuation = plan.pageNumber > 1;
  const lastPage = plan.pageNumber === totalPages;
  // The page plan decides which page draws the project highlight (it follows the education entries).
  const projectHere = atsMode || !plan.blocks ? lastPage : plan.blocks.includes("projects");
  const experienceIds = new Set(plan.items.filter((item) => item.kind === "experience").map((item) => item.id));
  const educationIds = new Set(plan.items.filter((item) => item.kind === "education").map((item) => item.id));
  const experiences = (profile?.experiences ?? []).filter((item) => experienceIds.has(item.id));
  const education = (profile?.education ?? []).filter((item) => educationIds.has(item.id));
  const strengths = parseTemplateStrengths(profile, 8);
  const competencyGroups = groupPehlioneCompetencies(strengths);
  const knowledge = getTemplateKnowledge(profile).slice(0, 8);
  const coreCompetencies = getPehlioneCoreCompetencies(profile);
  const technicalFocus = getPehlioneTechnicalFocus(profile);
  const summary = resolveTemplateSummary(profile, resumeProfile);
  // Pehlione's `compact` mode is its strongest compaction; the `dense` stylesheet only trims margins.
  const density = plan.density === "dense" ? "compact" : plan.density;
  const project = getPehlioneProjectHighlight(profile);
  const semanticSections = profile?.resumeSemanticSections;
  const photoSource = getResumeSemanticSection(semanticSections, "photo").visible
    ? getProfileMediaSource(profile?.photoPath)
    : null;
  const summarySection = getResumeSemanticSection(semanticSections, "summary");
  const knowledgeSection = getResumeSemanticSection(semanticSections, "knowledge");
  const interestsSection = getResumeSemanticSection(semanticSections, "interests");
  const closingSection = getResumeSemanticSection(semanticSections, "closing");
  const knowledgeGroups = resolveKnowledgeGroups(templateId, profile?.resumeKnowledgeGroups);
  const visibleKnowledgeGroups = knowledgeGroups.filter((group) => group.visible);
  const coreGroup = visibleKnowledgeGroups.find((group) => group.semanticType === "core-competencies");
  const focusGroup = visibleKnowledgeGroups.find((group) => group.semanticType === "technical-focus");
  const sidebarKnowledgeGroups = visibleKnowledgeGroups.filter((group) =>
    group.slot === "sidebar" && group.id !== coreGroup?.id && group.id !== focusGroup?.id,
  );
  const mainKnowledgeGroups = visibleKnowledgeGroups.filter((group) => group.slot !== "sidebar");
  const closing = profile?.resumeClosing ?? { showPlace: true, showDate: true, showSignature: true };
  const closingLine = profile ? resolveResumeClosingLine(profile, closingDate, (value) => value).text : "";
  const signatureSource = atsMode ? null : getProfileMediaSource(profile?.signaturePath);
  const style = {
    ...getPehlioneNativeVariables(templateId),
    "--pehlione-primary": accentColor,
    "--pehlione-accent": secondaryColor,
    "--pehlione-column-width": `${(profile?.resumeColumnRatio ?? 30) * 2.1}mm`,
  } as CSSProperties;
  const visibleBlockItems = (group: (typeof knowledgeGroups)[number]) =>
    group.items.filter((item) => item.visible && item.text.trim());
  const blockContent = (group: (typeof knowledgeGroups)[number], sidebar = false) => {
    const items = visibleBlockItems(group);
    if (!items.length) return null;
    const className = `pehlione-block-list renderer-${group.rendererType}${sidebar ? " is-sidebar" : ""}`;
    return (
      <ul className={className}>
        {items.map((item, index) => (
          <li key={item.id}>
            {group.rendererType === "icon-list" ? <span>{index % 2 ? <Database /> : <Code2 />}</span> : null}
            <div><b>{item.text}</b>{item.description ? <small>{item.description}</small> : null}{item.level ? <em>{item.level}</em> : null}</div>
          </li>
        ))}
      </ul>
    );
  };
  const career = (
    items: Array<
      ApplicantProfile["experiences"][number] | ApplicantProfile["education"][number]
    >,
    kind: "experience" | "education",
  ) => (
    <div className="pehlione-career-list">
      {items.map((item) => {
        const educationView = kind === "education"
          ? resolveEducationPresentation(item as ApplicantProfile["education"][number], profile?.resumeEducationFieldVisibility) : null;
        const experienceView = kind === "experience" ? resolveExperience(item as ApplicantProfile["experiences"][number]) : null;
        const location = educationView?.location ?? experienceView?.location ?? item.city;
        const period = educationView?.dateRange ?? experienceView?.period ?? `${item.from} – ${item.to}`;
        return (
        <article className="pehlione-career-entry" key={item.id}>
          {templateId === "pehlione_white_blue" ? <div className="pehlione-career-entry__meta">
            <p className="pehlione-career-entry__period">{period}</p>
            {location ? <small className="pehlione-career-entry__location">{location}</small> : null}
          </div> : <p className="pehlione-career-entry__period">{period}</p>}
          <div>
            <h3>{educationView?.title ?? experienceView?.role}</h3>
            <p className="pehlione-career-entry__organisation">
              {educationView?.institution ?? experienceView?.organization}
              {templateId === "pehlione_white" && location ? ` · ${location}` : ""}
            </p>
            {experienceView?.bullets.length ? (
              <ul>{experienceView.bullets.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
            ) : null}
            {educationView?.details.length ? <ul>{educationView.details.map((entry, index) => <li key={index}>{entry}</li>)}</ul> : null}
          </div>
        </article>
      );})}
    </div>
  );

  return (
    <article
      className={`pehlione-resume ${atsMode ? "pehlione-resume--ats" : ""}${templateId === "pehlione_white" ? " pehlione-resume--white" : ""}`}
      data-template={templateId}
      data-density={density}
      data-page={plan.pageNumber}
      style={style}>
      <style>{pehlioneContactsCss}</style>
      {!atsMode ? (
        continuation ? (
          <aside className="pehlione-sidebar pehlione-sidebar--continuation">
            <div className="pehlione-continuation-intro">
              <p>{resolveResumeHeading(profile).kicker}</p>
              <h2>{name}</h2>
              {profile?.title ? <span>{profile.title}</span> : null}
              <i aria-hidden="true" />
              <small>Fortsetzung · Seite {plan.pageNumber} von {totalPages}</small>
            </div>
            {lastPage && knowledgeSection.visible && (focusGroup?.items.length || technicalFocus.length || (sections.skills && knowledge.length)) ? (
              <section className="pehlione-sidebar-section pehlione-continuation-knowledge">
                {heading(<Wrench />, focusGroup?.title || "Technische Schwerpunkte")}
                {focusGroup && visibleBlockItems(focusGroup).length ? blockContent(focusGroup, true) : <ul className="pehlione-focus-list">{(technicalFocus.length ? technicalFocus : knowledge).map((item, index) => <li key={item}><span>{index % 2 ? <Database /> : <Code2 />}</span>{item}</li>)}</ul>}
              </section>
            ) : null}
            {lastPage && knowledgeSection.visible && sidebarKnowledgeGroups.map((group) => visibleBlockItems(group).length ? (
              <section className="pehlione-sidebar-section" key={group.id}>
                {heading(<Lightbulb />, group.title)}
                {blockContent(group, true)}
              </section>
            ) : null)}
          </aside>
        ) : (
        <aside className="pehlione-sidebar">
          <div className={`pehlione-hero${photoSource ? " pehlione-hero--with-photo" : ""}`} aria-hidden="true">
            {templateId === "pehlione_white" ? <span className="pehlione-blueprint" dangerouslySetInnerHTML={{ __html: pehlioneBlueprintMarkup }} /> : <><i /><i /><i /></>}
            {photoSource ? <img className="pehlione-hero__photo" src={photoSource} alt="" /> : templateId !== "pehlione_white" ? <b>◉</b> : null}
          </div>
          <div dangerouslySetInnerHTML={{ __html: renderPehlioneContacts(profile) }} />
          {knowledgeSection.visible && profile?.resumeKnowledgeContainer?.showTitle && visibleKnowledgeGroups.some((group) => group.slot === "sidebar") ? <h3 className="pehlione-container-title">{getResumeSemanticTitle(semanticSections, "knowledge")}</h3> : null}
          {knowledgeSection.visible && sections.strengths && (coreGroup?.items.length || coreCompetencies.length || competencyGroups.length) ? (
            <section className="pehlione-sidebar-section">
              {heading(<Lightbulb />, coreGroup?.title || "Kernkompetenzen", templateId === "pehlione_white_blue" ? "pehlione-competencies-heading" : "")}
              <ul className="pehlione-bullet-list">{coreGroup && visibleBlockItems(coreGroup).length
                ? visibleBlockItems(coreGroup).map((item) => <li key={item.id}>{item.text}{item.description ? <small>{item.description}</small> : null}</li>)
                : coreCompetencies.length
                ? coreCompetencies.map((item) => <li key={item}>{item}</li>)
                : competencyGroups.map((group) => <li key={group.title}><strong>{group.title}:</strong> {group.values.join(" · ")}</li>)}</ul>
            </section>
          ) : null}
          {totalPages === 1 && knowledgeSection.visible && (focusGroup?.items.length || technicalFocus.length || (sections.skills && knowledge.length)) ? (
            <section className="pehlione-sidebar-section">
              {heading(<Wrench />, focusGroup?.title || "Technische Schwerpunkte")}
              {focusGroup && visibleBlockItems(focusGroup).length ? blockContent(focusGroup, true) : <ul className="pehlione-focus-list">{(technicalFocus.length ? technicalFocus : knowledge).map((item, index) => <li key={item}><span>{index % 2 ? <Database /> : <Code2 />}</span>{item}</li>)}</ul>}
            </section>
          ) : null}
          {totalPages === 1 && knowledgeSection.visible && sidebarKnowledgeGroups.map((group) => visibleBlockItems(group).length ? (
            <section className="pehlione-sidebar-section" key={group.id}>
              {heading(<Lightbulb />, group.title)}
              {blockContent(group, true)}
            </section>
          ) : null)}
          {sections.languages && profile?.languages.filter(Boolean).length ? (
            <section className="pehlione-sidebar-section">
              {heading(<Languages />, "Sprachen", templateId === "pehlione_white_blue" ? "pehlione-language-heading" : "")}
              <ul className="pehlione-bullet-list">{profile.languages.filter(Boolean).map((item) => <li key={item}>{presentLanguage(item, profile.resumeLanguageDisplay, { atsMode }).primaryText}</li>)}</ul>
            </section>
          ) : null}
        </aside>
        )
      ) : null}
      <main className="pehlione-main">
        <header className="pehlione-header">
          <h1>{name}</h1>
          {profile?.title || templateId === "pehlione_white" ? <h2>{profile?.title}</h2> : null}
        </header>
        {atsMode && !continuation ? (
          <section className="pehlione-ats-contact"><b>Kontakt:</b> {getPehlioneContacts(profile).map((item) => item.value).join(" · ")}</section>
        ) : null}
        {!continuation && summarySection.visible && sections.profile && summary ? <section className="pehlione-main-section">{heading(<UserRound />, getResumeSemanticTitle(semanticSections, "summary"))}<p className="pehlione-summary">{summary}</p></section> : null}
        {sections.experience && experiences.length ? <section className="pehlione-main-section">{heading(<BriefcaseBusiness />, `${getResumeSemanticTitle(semanticSections, "career")}${continuation ? " · Fortsetzung" : ""}`)}{career(experiences, "experience")}</section> : null}
        {sections.education && education.length ? <section className="pehlione-main-section">{heading(<GraduationCap />, getResumeSemanticTitle(semanticSections, "education"))}{career(education, "education")}</section> : null}
        {projectHere && project && !(templateId === "pehlione_white_blue" && hasPehlioneCustomProjectHighlight(profile)) && !mainKnowledgeGroups.some((group) => group.semanticType === "project-highlight" && visibleBlockItems(group).length) ? <section className="pehlione-main-section pehlione-project">{heading(<Lightbulb />, "Projekt-Highlight")}<h3>{project.title}</h3><p>{[project.company, ...project.technologies].filter(Boolean).join(" · ")}</p>{project.achievements.length ? <ul>{project.achievements.map((entry) => <li key={entry}>{entry}</li>)}</ul> : null}</section> : null}
        {lastPage && knowledgeSection.visible && profile?.resumeKnowledgeContainer?.showTitle && mainKnowledgeGroups.some((group) => visibleBlockItems(group).length) ? <section className="pehlione-main-section pehlione-knowledge-container-title">{heading(<Lightbulb />, getResumeSemanticTitle(semanticSections, "knowledge"))}</section> : null}
        {lastPage && knowledgeSection.visible && mainKnowledgeGroups.map((group) => visibleBlockItems(group).length ? <section className={`pehlione-main-section pehlione-flex-block renderer-${group.rendererType}`} key={group.id} style={{ breakBefore: group.pageBreakBefore ? "page" : "auto" }}>{heading(group.semanticType === "training" || group.semanticType === "certificates" ? <GraduationCap /> : <Lightbulb />, group.title)}{blockContent(group)}</section> : null)}
        {lastPage && sections.certifications && profile?.certifications.length && !mainKnowledgeGroups.some((group) => ["training", "certificates"].includes(group.semanticType)) ? <section className="pehlione-main-section pehlione-training">{heading(<GraduationCap />, "Weiterbildungen")}<ul>{profile.certifications.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
        {atsMode && lastPage && sections.languages && profile?.languages.filter(Boolean).length ? <section className="pehlione-main-section pehlione-training">{heading(<Languages />, "Sprachen")}<ul>{profile.languages.filter(Boolean).map((item) => <li key={item}>{presentLanguage(item, profile.resumeLanguageDisplay, { atsMode }).primaryText}</li>)}</ul></section> : null}
        {lastPage && profile?.specialSections.filter((section) => section.kind === "interests" && section.isVisible && section.entries.some(entry => interestEntryText(entry))).map((section) => (
          <section className="pehlione-main-section pehlione-training" data-element-id={`special.${section.id}`} key={section.id}>{heading(<Lightbulb />, section.title || interestsSection.customTitle || "Interessen und Hobbys")}<ul>{section.entries.filter(entry => interestEntryText(entry)).map((entry) => <li key={entry.id}>{interestEntryText(entry)}</li>)}</ul></section>
        ))}
        {lastPage && closingSection.visible && (closingLine || (closing.showSignature && signatureSource)) ? (
          <footer className="pehlione-closing">
            {closingLine ? <p>{closingLine}</p> : null}
            {closing.showSignature && signatureSource ? (
              <div className="pehlione-closing__signer">
                {signatureSource ? <img src={signatureSource} alt="Unterschrift" /> : null}
                <strong>{name}</strong>
              </div>
            ) : null}
          </footer>
        ) : null}
        {!experiences.length && !education.length ? <p className="pehlione-empty">Berufserfahrung und Ausbildung im Profil ergänzen.</p> : null}
      </main>
    </article>
  );
}
