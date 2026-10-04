import type { CSSProperties } from "react";
import { zeitgenoessischDefaults } from "./zeitgenoessisch.defaults";
import type { ZeitgenoessischResumeProps } from "./zeitgenoessisch.types";
import { ZeitgenoessischPage } from "./ZeitgenoessischPage";
import "./zeitgenoessisch.css";

export function ZeitgenoessischResume({
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
}: ZeitgenoessischResumeProps) {
  const variables = {
    "--zeit-primary":
      accentColor || zeitgenoessischDefaults.colors.primary,
    "--zeit-primary-dark": zeitgenoessischDefaults.colors.primaryDark,
    "--zeit-primary-soft":
      secondaryColor || zeitgenoessischDefaults.colors.primarySoft,
  } as CSSProperties;

  return (
    <article
      className="zeitgenoessisch-template"
      data-ats-mode={atsMode}
      data-continuation={plan.pageNumber > 1}
      data-density={plan.density}
      lang="de"
      style={variables}
    >
      <ZeitgenoessischPage
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

export default ZeitgenoessischResume;
