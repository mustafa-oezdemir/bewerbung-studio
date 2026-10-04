import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";
import type { ResumeSectionType } from "../../../../features/resume-sections/resume-sections";

export type ZweispaltigCareerItem = {
  id: string;
  from: string;
  to: string;
  title: string;
  organization: string;
  city?: string;
  achievements?: string[];
};

export type ZweispaltigLanguage = {
  raw: string;
  name: string;
  level: string;
  score: number;
};

export type ZweispaltigResumeProps = {
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

export type ZweispaltigPageProps = Omit<
  ZweispaltigResumeProps,
  "accentColor" | "secondaryColor"
>;

export type ZweispaltigHeaderProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  photoSource: string | null;
  compact?: boolean;
  atsMode?: boolean;
};

export type ZweispaltigCareerSectionProps = {
  kind: "experience" | "education";
  title: string;
  items: ZweispaltigCareerItem[];
  continuation?: boolean;
};

export type ZweispaltigKnowledgeProps = {
  profile: ApplicantProfile | undefined;
  variant: "sidebar" | "ats";
};

export type ZweispaltigStrengthsProps = {
  profile: ApplicantProfile | undefined;
  variant: "sidebar" | "ats";
};

export type ZweispaltigSidebarProps = {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
  order?: readonly ResumeSectionType[];
  summary?: string;
};

export type ZweispaltigFooterProps = {
  profile: ApplicantProfile | undefined;
  pageNumber: number;
  totalPages: number;
  atsMode: boolean;
};
