import type { ApplicantProfile } from "./schema";
import { externalUrl } from "./contactPresentation";

/** The profile link the footer offers: the website, otherwise GitHub, otherwise LinkedIn (the historic footer order). */
export const resumeFooterWebsiteSource = (
  profile: Pick<ApplicantProfile, "portfolio" | "github" | "linkedin"> | undefined,
) => [profile?.portfolio, profile?.github, profile?.linkedin].map((value) => value?.trim() ?? "").find(Boolean) ?? "";

/**
 * The website in the footer of every Lebenslauf template, for the preview and the PDF alike. It is shown only when the
 * user switches it on under "Ort, Datum und Unterschrift" (`resumeClosing.showWebsite`) and never in the ATS output.
 * The text is the link as entered; the target is the one normalised http(s) URL.
 */
export const resolveResumeFooterWebsite = (
  profile: Pick<ApplicantProfile, "portfolio" | "github" | "linkedin" | "resumeClosing"> | undefined,
  atsMode = false,
): { text: string; href: string } | null => {
  if (atsMode || !profile?.resumeClosing?.showWebsite) return null;
  const text = resumeFooterWebsiteSource(profile);
  const href = externalUrl(text);
  return text && href ? { text, href } : null;
};
