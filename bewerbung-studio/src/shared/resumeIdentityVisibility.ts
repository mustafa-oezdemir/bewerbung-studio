import {
  getResumeSemanticSection,
  type ResumeSectionInstance,
} from "../features/resume-sections/resume-section-system";

// Scope visibility to CV pages so cover letters and cover sheets stay independent.
export const getResumeIdentityVisibilityCss = (
  sections: readonly ResumeSectionInstance[] | undefined,
) => {
  // The Überschrift is Pflicht and never hidden; only the personal data can be switched off.
  const hidden = (type: "personalData") => {
    const section = getResumeSemanticSection(sections, type);
    return !section.visible || !section.enabled;
  };
  const scope = ":is(.document-lebenslauf, .cv-sheet)";
  const rules: string[] = [];
  if (hidden("personalData")) {
    rules.push(
      `${scope} :is(address,[data-element-id$=".contacts"],[data-resume-personal],.resume-personal-data,.pehlione-contacts,.pehlione-ats-contact,.pehlione-pdf-ats-contact,.zeitgenoessisch-contacts),${scope} section:has(>address),${scope} section:has(>.modern-contact-list){display:none!important}`,
    );
  }
  return rules.join("\n");
};
