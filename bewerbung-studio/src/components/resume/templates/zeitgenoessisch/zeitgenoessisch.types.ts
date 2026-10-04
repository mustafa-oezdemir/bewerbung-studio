import type { ResumePagePlan } from "../../../../shared/documentPagination";
import type { ApplicantProfile } from "../../../../shared/schema";

export type ZeitgenoessischIcon =
  | "contacts"
  | "strengths"
  | "languages"
  | "summary"
  | "experience"
  | "education"
  | "knowledge"
  | "certifications";

export type ZeitgenoessischCareerItem = {
  id: string;
  from: string;
  to: string;
  title: string;
  organization: string;
  city?: string;
  achievements?: string[];
};

export type ZeitgenoessischLanguage = {
  raw: string;
  name: string;
  level: string;
  score: number;
};

export type ZeitgenoessischResumeProps = {
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

export type ZeitgenoessischPageProps = Omit<
  ZeitgenoessischResumeProps,
  "accentColor" | "secondaryColor"
>;

export type ZeitgenoessischHeaderProps = {
  profile: ApplicantProfile | undefined;
  name: string;
  photoSource: string | null;
  compact?: boolean;
  atsMode?: boolean;
};

export type ZeitgenoessischCareerSectionProps = {
  kind: "experience" | "education";
  title: string;
  items: ZeitgenoessischCareerItem[];
  continuation?: boolean;
  atsMode?: boolean;
};

export type ZeitgenoessischColumnsProps = {
  profile: ApplicantProfile | undefined;
  sections: ApplicantProfile["resumeSections"];
};

export type ZeitgenoessischFooterProps = {
  profile: ApplicantProfile | undefined;
  pageNumber: number;
  totalPages: number;
  atsMode: boolean;
};
