import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";
import type { CvDesignTokens } from "../../../../shared/cvDesignSchema";
import type { DocumentDesignSettings } from "../../../../shared/documentDesign";

export type ElegantCareerItem = {
  id: string;
  from: string;
  to: string;
  title: string;
  organization: string;
  city?: string;
  achievements?: string[];
};

export type ElegantResumeProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  accentColor: string;
  secondaryColor: string;
  design?: CvDesignTokens;
  designSettings?: DocumentDesignSettings;
  photoSource: string | null;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
};

export type ElegantPageProps = Omit<
  ElegantResumeProps,
  "accentColor" | "secondaryColor" | "design" | "designSettings"
>;

export type ElegantHeaderProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  compact?: boolean;
};

export type ElegantCareerSectionProps = {
  kind: "experience" | "education";
  title: string;
  items: ElegantCareerItem[];
  continuation?: boolean;
};

export type ElegantSidebarProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  photoSource: string | null;
  summary: string;
  sections: ApplicantProfile["resumeSections"];
  isContinuation: boolean;
  pageNumber: number;
  totalPages: number;
};

export type ElegantKnowledgeProps = {
  profile: ApplicantProfile | undefined;
  variant: "sidebar" | "ats";
};

export type ElegantStrengthsProps = {
  profile: ApplicantProfile | undefined;
  variant: "sidebar" | "ats";
};

export type ElegantFooterProps = {
  profile: ApplicantProfile | undefined;
  pageNumber: number;
  totalPages: number;
  atsMode: boolean;
};
