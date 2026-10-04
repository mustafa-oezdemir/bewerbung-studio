import type { CSSProperties } from "react";
import { kreativDefaults } from "./kreativ.defaults";
import type { KreativResumeProps } from "./kreativ.types";
import { KreativPage } from "./KreativPage";
import "./kreativ.css";

export function KreativResume({
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
}: KreativResumeProps) {
  const variables = {
    "--kreativ-header-to-content-gap": `${kreativDefaults.layout.headerToContentGapMm}mm`,
    "--kreativ-footer-clearance": `${kreativDefaults.layout.footerClearanceMm}mm`,
    "--kreativ-entry-divider-gap": `${kreativDefaults.layout.entryDividerGapMm}mm`,
    "--kreativ-entry-gap-base": `${kreativDefaults.layout.entryGapMm}mm`,
    "--kreativ-section-gap-base": `${kreativDefaults.layout.sectionGapMm}mm`,
    "--kreativ-primary":
      accentColor || kreativDefaults.colors.primary,
    "--kreativ-primary-soft":
      secondaryColor || kreativDefaults.colors.primarySoft,
  } as CSSProperties;

  return (
    <article
      className="kreativ-template"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={variables}
    >
      <KreativPage
        profile={profile}
        name={name}
        atsMode={atsMode}
        plan={plan}
        totalPages={totalPages}
        photoSource={photoSource}
        resumeProfile={resumeProfile}
        sections={sections}
      />
    </article>
  );
}

export default KreativResume;
