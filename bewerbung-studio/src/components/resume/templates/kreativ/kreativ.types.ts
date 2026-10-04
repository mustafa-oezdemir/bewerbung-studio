import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";

export type KreativCareerItem = {
  id: string;
  from: string;
  to: string;
  title: string;
  organization: string;
  city?: string;
  achievements?: string[];
};

export type KreativLanguage = {
  raw: string;
  name: string;
  level: string;
  score: number;
};

export type KreativResumeProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  accentColor: string;
  secondaryColor: string;
  photoSource: string | null;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
};

export type KreativPageProps = Omit<
  KreativResumeProps,
  "accentColor" | "secondaryColor"
>;

export type KreativHeaderProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  photoSource: string | null;
  compact?: boolean;
  atsMode?: boolean;
};

export type KreativCareerSectionProps = {
  kind: "experience" | "education";
  title: string;
  items: KreativCareerItem[];
  continuation?: boolean;
  atsMode?: boolean;
};

export type KreativColumnProps = {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
  summary?: string;
};

export type KreativFooterProps = {
  profile: ApplicantProfile | undefined;
  pageNumber: number;
  totalPages: number;
  atsMode: boolean;
};
