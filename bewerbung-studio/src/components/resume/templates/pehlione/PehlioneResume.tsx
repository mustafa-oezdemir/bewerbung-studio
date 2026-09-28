import {
  BriefcaseBusiness,
  Code2,
  Database,
  GraduationCap,
  Lightbulb,
  UserRound,
  Wrench,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { getTemplateKnowledge, parseTemplateStrengths, resolveTemplateSummary } from "../resume-template-data";
import type { ApplicantProfile } from "../../../../shared/schema";
import type { ResumePagePlan } from "../../../../shared/documentPagination";

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
};

const heading = (icon: ReactNode, title: string) => (
  <h2 className="pehlione-section-heading">
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
}: Props) {
  const continuation = plan.pageNumber > 1;
  const lastPage = plan.pageNumber === totalPages;
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
  const density = plan.items.length >= 5 ? "compact" : plan.density;
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
  const signatureSource = getProfileMediaSource(profile?.signaturePath);
  const style = {
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
      {items.map((item) => (
        <article className="pehlione-career-entry" key={item.id}>
          {templateId === "pehlione_white_blue" ? <div className="pehlione-career-entry__meta">
            <p className="pehlione-career-entry__period">{item.from} – {item.to}</p>
            {item.city ? <small className="pehlione-career-entry__location">{item.city}</small> : null}
          </div> : <p className="pehlione-career-entry__period">{item.from} – {item.to}</p>}
          <div>
            <h3>{kind === "experience" ? (item as ApplicantProfile["experiences"][number]).role : (item as ApplicantProfile["education"][number]).degree}</h3>
            <p className="pehlione-career-entry__organisation">
              {kind === "experience" ? (item as ApplicantProfile["experiences"][number]).company : (item as ApplicantProfile["education"][number]).institution}
              {templateId === "pehlione_white" && item.city ? ` · ${item.city}` : ""}
            </p>
            {kind === "experience" && (item as ApplicantProfile["experiences"][number]).achievements.filter(Boolean).length ? (
              <ul>{(item as ApplicantProfile["experiences"][number]).achievements.filter(Boolean).slice(0, 5).map((entry) => <li key={entry}>{entry}</li>)}</ul>
            ) : null}
          </div>
        </article>
      ))}
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
      {!atsMode && !continuation ? (
        <aside className="pehlione-sidebar">
          <div className={`pehlione-hero${photoSource ? " pehlione-hero--with-photo" : ""}`} aria-hidden="true">
            {templateId === "pehlione_white" ? <span className="pehlione-blueprint" dangerouslySetInnerHTML={{ __html: pehlioneBlueprintMarkup }} /> : <><i /><i /><i /></>}
            {photoSource ? <img className="pehlione-hero__photo" src={photoSource} alt="" /> : templateId !== "pehlione_white" ? <b>◉</b> : null}
          </div>
          <div dangerouslySetInnerHTML={{ __html: renderPehlioneContacts(profile) }} />
          {knowledgeSection.visible && profile?.resumeKnowledgeContainer?.showTitle && visibleKnowledgeGroups.some((group) => group.slot === "sidebar") ? <h3 className="pehlione-container-title">{getResumeSemanticTitle(semanticSections, "knowledge")}</h3> : null}
          {knowledgeSection.visible && sections.strengths && (coreGroup?.items.length || coreCompetencies.length || competencyGroups.length) ? (
            <section className="pehlione-sidebar-section">
              {heading(<Lightbulb />, coreGroup?.title || "Kernkompetenzen")}
              <ul className="pehlione-bullet-list">{coreGroup && visibleBlockItems(coreGroup).length
                ? visibleBlockItems(coreGroup).map((item) => <li key={item.id}>{item.text}{item.description ? <small>{item.description}</small> : null}</li>)
                : coreCompetencies.length
                ? coreCompetencies.map((item) => <li key={item}>{item}</li>)
                : competencyGroups.map((group) => <li key={group.title}><strong>{group.title}:</strong> {group.values.join(" · ")}</li>)}</ul>
            </section>
          ) : null}
          {knowledgeSection.visible && (focusGroup?.items.length || technicalFocus.length || (sections.skills && knowledge.length)) ? (
            <section className="pehlione-sidebar-section">
              {heading(<Wrench />, focusGroup?.title || "Technische Schwerpunkte")}
              {focusGroup && visibleBlockItems(focusGroup).length ? blockContent(focusGroup, true) : <ul className="pehlione-focus-list">{(technicalFocus.length ? technicalFocus : knowledge).map((item, index) => <li key={item}><span>{index % 2 ? <Database /> : <Code2 />}</span>{item}</li>)}</ul>}
            </section>
          ) : null}
          {knowledgeSection.visible && sidebarKnowledgeGroups.map((group) => visibleBlockItems(group).length ? (
            <section className="pehlione-sidebar-section" key={group.id}>
              {heading(<Lightbulb />, group.title)}
              {blockContent(group, true)}
            </section>
          ) : null)}
          {sections.languages && profile?.languages.filter(Boolean).length ? (
            <section className="pehlione-sidebar-section">
              {heading(<UserRound />, "Sprachen")}
              <ul className="pehlione-bullet-list">{profile.languages.filter(Boolean).map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ) : null}
        </aside>
      ) : null}
      <main className="pehlione-main">
        <header className="pehlione-header">
          <h1>{name}</h1>
          {profile?.title || templateId === "pehlione_white" ? <h2>{profile?.title || "Fachkraft"}</h2> : null}
        </header>
        {atsMode && !continuation ? (
          <section className="pehlione-ats-contact"><b>Kontakt:</b> {getPehlioneContacts(profile).map((item) => item.value).join(" · ")}</section>
        ) : null}
        {!continuation && summarySection.visible && sections.profile && summary ? <section className="pehlione-main-section">{heading(<UserRound />, getResumeSemanticTitle(semanticSections, "summary"))}<p className="pehlione-summary">{summary}</p></section> : null}
        {sections.experience && experiences.length ? <section className="pehlione-main-section">{heading(<BriefcaseBusiness />, `${getResumeSemanticTitle(semanticSections, "career")}${continuation ? " · Fortsetzung" : ""}`)}{career(experiences, "experience")}</section> : null}
        {sections.education && education.length ? <section className="pehlione-main-section">{heading(<GraduationCap />, getResumeSemanticTitle(semanticSections, "education"))}{career(education, "education")}</section> : null}
        {!continuation && project && !(templateId === "pehlione_white_blue" && hasPehlioneCustomProjectHighlight(profile)) && !mainKnowledgeGroups.some((group) => group.semanticType === "project-highlight" && visibleBlockItems(group).length) ? <section className="pehlione-main-section pehlione-project">{heading(<Lightbulb />, "Projekt-Highlight")}<h3>{project.title}</h3><p>{[project.company, ...project.technologies].filter(Boolean).join(" · ")}</p>{project.achievements.length ? <ul>{project.achievements.map((entry) => <li key={entry}>{entry}</li>)}</ul> : null}</section> : null}
        {lastPage && knowledgeSection.visible && profile?.resumeKnowledgeContainer?.showTitle && mainKnowledgeGroups.some((group) => visibleBlockItems(group).length) ? <section className="pehlione-main-section pehlione-knowledge-container-title">{heading(<Lightbulb />, getResumeSemanticTitle(semanticSections, "knowledge"))}</section> : null}
        {lastPage && knowledgeSection.visible && mainKnowledgeGroups.map((group) => visibleBlockItems(group).length ? <section className={`pehlione-main-section pehlione-flex-block renderer-${group.rendererType}`} key={group.id} style={{ breakBefore: group.pageBreakBefore ? "page" : "auto" }}>{heading(group.semanticType === "training" || group.semanticType === "certificates" ? <GraduationCap /> : <Lightbulb />, group.title)}{blockContent(group)}</section> : null)}
        {lastPage && sections.certifications && profile?.certifications.length && !mainKnowledgeGroups.some((group) => ["training", "certificates"].includes(group.semanticType)) ? <section className="pehlione-main-section pehlione-training">{heading(<GraduationCap />, "Weiterbildungen")}<ul>{profile.certifications.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
        {lastPage && interestsSection.visible && profile?.specialSections.filter((section) => section.kind === "interests" && section.isVisible).map((section) => (
          <section className="pehlione-main-section pehlione-training" data-element-id={`special.${section.id}`} key={section.id}>{heading(<Lightbulb />, section.title)}<ul>{section.entries.map((entry) => <li key={entry.id}>{entry.title || entry.description}</li>)}</ul></section>
        ))}
        {lastPage && closingSection.visible && (closing.showPlace || closing.showDate || closing.showSignature) ? (
          <footer className="pehlione-closing">
            {(closing.showPlace || closing.showDate) ? <p>{[closing.showPlace ? profile?.applicationPlace || profile?.city : "", closing.showDate ? profile?.applicationDate : ""].filter(Boolean).join(", ")}</p> : null}
            {closing.showSignature ? (
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
