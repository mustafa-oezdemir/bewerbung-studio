import type { ApplicantProfile } from "../../shared/schema";
import { normalizeCustomSection, renderCustomSectionContent } from "../../shared/resumeCustomSections";

export function ResumeSpecialSections({ profile, sectionClassName, headingClassName }: {
  profile: ApplicantProfile | undefined;
  sectionClassName?: string;
  headingClassName?: string;
}) {
  const sections = (profile?.specialSections ?? []).map(normalizeCustomSection)
    .filter(section => section.isVisible && section.entries.length);
  if (!sections.length) return null;
  return <div className="resume-special-output-list">{sections.map(section => (
    <section className={[sectionClassName, "resume-special-output"].filter(Boolean).join(" ")}
      data-element-id={`special.${section.id}`} data-section-type={section.sectionType} key={section.id}>
      <h2 className={headingClassName}>{section.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: renderCustomSectionContent(section) }} />
    </section>
  ))}</div>;
}
