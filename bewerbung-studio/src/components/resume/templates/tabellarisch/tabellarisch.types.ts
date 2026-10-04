/**
 * Tabellarisch Template - TypeScript Types
 */

import type { ApplicantProfile } from "../../../../shared/schema";
import type { ResumePagePlan } from "../../../../shared/documentPagination";

export type TabellarischTimelineItem = {
  id: string;
  from: string;
  to: string;
  role: string;
  organization: string;
  city?: string;
  summary?: string;
  achievements?: string[];
};

export interface TabellarischResumeProps {
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
}

export interface TabellarischPageProps {
  profile: ApplicantProfile | undefined;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  photoSource: string | null;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
}

export interface TabellarischHeaderProps {
  name: string;
  profile: ApplicantProfile | undefined;
  photoSource: string | null;
  atsMode: boolean;
}

export interface TabellarischSummaryProps {
  text: string;
  profile?: ApplicantProfile;
}

export interface TabellarischKnowledgeProps {
  profile: ApplicantProfile | undefined;
  atsMode: boolean;
}

export interface TabellarischTimelineProps {
  items: TabellarischTimelineItem[];
  atsMode: boolean;
  continuesOnNextPage?: boolean;
}

export interface TabellarischTimelineEntryProps
  extends TabellarischTimelineItem {
  atsMode: boolean;
}

export interface TabellarischFooterProps {
  profile: ApplicantProfile | undefined;
  pageNumber: number;
  totalPages: number;
  atsMode: boolean;
}
