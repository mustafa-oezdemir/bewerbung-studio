import type { DocumentBackgroundId } from "../../../../shared/documentDesign";
import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";

export type IvyLeagueCareerItem = {
  id: string;
  from: string;
  to: string;
  title: string;
  organization: string;
  city?: string;
  achievements: string[];
};

export type IvyLeagueStrength = {
  title: string;
  description: string;
};

export type IvyLeagueLanguage = {
  raw: string;
  name: string;
  level: string;
  score: number;
};

export type IvyLeagueResumeProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  accentColor: string;
  secondaryColor: string;
  backgroundId: DocumentBackgroundId;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
};

export type IvyLeaguePageProps = Omit<
  IvyLeagueResumeProps,
  "accentColor" | "secondaryColor"
>;
