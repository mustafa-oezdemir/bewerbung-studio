import type { CSSProperties } from "react";
import { elegantDefaults } from "./elegant.defaults";
import type { ElegantResumeProps } from "./elegant.types";
import { ElegantPage } from "./ElegantPage";
import "./elegant.css";

export function ElegantResume({
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
}: ElegantResumeProps) {
  const cssVariables = {
    "--elegant-accent": atsMode
      ? elegantDefaults.colors.heading
      : accentColor || elegantDefaults.colors.primary,
    "--elegant-sidebar":
      secondaryColor || elegantDefaults.colors.sidebarBackground,
    "--elegant-sidebar-width": `${elegantDefaults.layout.sidebarWidthMm}mm`,
    "--elegant-heading": elegantDefaults.colors.heading,
    "--elegant-text": elegantDefaults.colors.text,
    "--elegant-muted": elegantDefaults.colors.mutedText,
    "--elegant-line": elegantDefaults.colors.divider,
    "--elegant-paper": elegantDefaults.colors.pageBackground,
    "--elegant-sidebar-text": elegantDefaults.colors.sidebarText,
    "--elegant-sidebar-muted": elegantDefaults.colors.sidebarMutedText,
    "--elegant-name-size": `${elegantDefaults.typography.nameSizePt}pt`,
    "--elegant-profession-size": `${elegantDefaults.typography.professionSizePt}pt`,
    "--elegant-section-title-size": `${elegantDefaults.typography.sectionTitleSizePt}pt`,
    "--elegant-sidebar-title-size": `${elegantDefaults.typography.sidebarSectionTitleSizePt}pt`,
    "--elegant-entry-title-size": `${elegantDefaults.typography.entryTitleSizePt}pt`,
    "--elegant-small-size": `${elegantDefaults.typography.smallSizePt}pt`,
  } as CSSProperties;

  return (
    <article
      className="elegant-template"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={cssVariables}
    >
      <ElegantPage
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

export default ElegantResume;
