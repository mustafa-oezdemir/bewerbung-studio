import type { ApplicantProfile } from "./schema";
import { externalUrl, formatPhoneForDisplay, phoneHref } from "./contactPresentation";
import { formatResumeBirth, getResumePersonalDetails, resumeAddressLines } from "./resumePersonalData";

export type TabellarischHeaderContact = {
  kind: string;
  label: string;
  text: string;
  href: string;
  primary: boolean;
};

/** The visual header, PDF and page planner use the same contact order and visible values. */
export const getTabellarischHeaderContacts = (profile: ApplicantProfile | undefined): TabellarischHeaderContact[] => {
  const address = resumeAddressLines(profile);
  const [street, locality] = profile?.street?.trim()
    ? [address[0] ?? "", address[1] ?? ""]
    : ["", address[0] ?? ""];
  const primary = [
    { kind: "street", label: "Adresse", text: street, href: "", primary: true },
    { kind: "location", label: "Wohnort", text: locality, href: "", primary: true },
    { kind: "email", label: "E-Mail", text: profile?.email ?? "", href: profile?.email ? `mailto:${profile.email}` : "", primary: true },
    { kind: "phone", label: "Telefon", text: formatPhoneForDisplay(profile?.phone), href: phoneHref(profile?.phone), primary: true },
  ];
  const extra = [
    { kind: "linkedin", label: "LinkedIn", text: profile?.linkedin ?? "", href: externalUrl(profile?.linkedin), primary: false },
    { kind: "github", label: "GitHub", text: profile?.github ?? "", href: externalUrl(profile?.github), primary: false },
    { kind: "website", label: "Portfolio", text: profile?.portfolio ?? "", href: externalUrl(profile?.portfolio), primary: false },
    { kind: "birth", label: "Geboren", text: formatResumeBirth(profile), href: "", primary: false },
    ...getResumePersonalDetails(profile).map((detail) => ({
      kind: detail.kind, label: detail.label, text: detail.href ? detail.value : detail.text,
      href: detail.href, primary: false,
    })),
  ];
  return [...primary, ...extra].filter((contact) => contact.text.trim());
};
