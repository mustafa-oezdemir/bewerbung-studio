/**
 * Modern template TypeScript type definitions
 */

import type { ReactNode } from "react";
import type { ApplicantProfile } from "../../../../shared/schema";
import type { ResumePagePlan } from "../../../../shared/documentPagination";

export interface ModernResumeProps {
  profile?: ApplicantProfile;
  name: string;
  atsMode: boolean;
  plan: ResumePagePlan;
  totalPages: number;
  accentColor: string;
  secondaryColor: string;
  photoSource?: string;
  resumeProfile: string;
  sections: ApplicantProfile["resumeSections"];
}

export interface ModernHeaderProps {
  name: string;
  profile?: ApplicantProfile;
  accentColor: string;
  photoSource?: string;
  atsMode: boolean;
  compact?: boolean;
  /** Details under the profession (the contact line of page one). */
  children?: ReactNode;
}

export interface ModernLeftColumnProps {
  profile?: ApplicantProfile;
  atsMode: boolean;
  showSummary?: boolean;
}

export interface ModernRightColumnProps {
  profile?: ApplicantProfile;
  accentColor: string;
  atsMode: boolean;
  showStrengths: boolean;
}

export interface ModernContactSectionProps {
  profile?: ApplicantProfile;
  accentColor: string;
  atsMode: boolean;
  inline?: boolean;
}

export interface ModernSummarySectionProps {
  profile?: ApplicantProfile;
}

export interface ModernStrengthsSectionProps {
  profile?: ApplicantProfile;
}

export interface ModernLanguagesSectionProps {
  profile?: ApplicantProfile;
  accentColor: string;
  atsMode: boolean;
}

export interface ModernExperienceSectionProps {
  profile?: ApplicantProfile;
}

export interface ModernEducationSectionProps {
  profile?: ApplicantProfile;
}

export interface ModernFooterProps {
  pageNumber: number;
  totalPages: number;
  portfolio?: string;
  atsMode: boolean;
}
