import type { DocumentBackgroundId } from "../../../../shared/documentDesign";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";

export type EinspaltigResumeProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  accentColor: string;
  secondaryColor: string;
  backgroundId: DocumentBackgroundId;
  photoSource: string | null;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
};

/** @deprecated Nur für bestehende interne Importe. */
export type EinfachResumeProps = EinspaltigResumeProps;
