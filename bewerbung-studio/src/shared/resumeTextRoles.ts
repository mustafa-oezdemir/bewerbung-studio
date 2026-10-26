import type { CvDesignTokens } from "./cvDesignSchema";
import { ivyLeagueAtsColors } from "./cvTemplateDefaults/ivy-league.defaults";
import { klassischDefaults } from "./cvTemplateDefaults/klassisch.defaults";
import { modernAtsColors } from "./cvTemplateDefaults/modern.defaults";
import { tabellarischAtsColor } from "./cvTemplateDefaults/tabellarisch.defaults";
import type { DocumentDesignSettings } from "./documentDesign";
import { resolveTemplateId } from "./templates";

/**
 * The text roles of a Lebenslauf entry. Every template marks them in its markup (`data-cv-role`) on both surfaces, so the
 * design settings reach exactly these texts and nothing else (never a generic `p`, `strong`, `.meta` or `time`):
 *   - entry-title   Position, Abschluss, Projekt- und Hobbytitel (Eintragstitel)
 *   - organization  Unternehmen / Einrichtung
 *   - period        Datum / Zeitraum
 *   - location      Ort / Standort
 *   - technologies  the technology line of a project
 *   - description   the description paragraph of a project
 * A template that sets two roles in one line wraps each in its own inline element, so the line looks the same.
 */
export const resumeTextRoles = ["entry-title", "organization", "period", "location", "technologies", "description"] as const;
export type ResumeTextRole = typeof resumeTextRoles[number];

/** JSX props of a role (`<p {...cvRole("organization")}>`); the Electron PDF markup writes the same attribute. */
export const cvRole = (role: ResumeTextRole) => ({ "data-cv-role": role });

export const cvRoleSelector = (role: ResumeTextRole) => `[data-cv-role="${role}"]`;

/**
 * The design tokens of every role. A project's technologies take the Hervorhebungsfarbe, its description the Absatztext;
 * Werdegang, Bildungsweg, Projekte and Hobbys share the other roles.
 */
export const resumeTextRoleTokens: Record<ResumeTextRole, { color: keyof CvDesignTokens["colors"]; size: keyof CvDesignTokens["typography"] }> = {
  "entry-title": { color: "entryHeading", size: "entryHeadingSizePt" },
  organization: { color: "organization", size: "organizationSizePt" },
  period: { color: "date", size: "dateSizePt" },
  location: { color: "location", size: "locationSizePt" },
  technologies: { color: "accent", size: "projectTechnologiesSizePt" },
  description: { color: "paragraph", size: "projectDescriptionSizePt" },
};

/**
 * The general value a role token follows while it has no value of its own (resolveEffectiveDesignTokens): the entry
 * texts grow with a chosen Lesetext at their native ratio (the entry title keeps its size, it has a control of its own),
 * dates and places are secondary texts, which saved designs coloured through the Sekundärtext before they had colours of
 * their own.
 */
export const resumeTextRoleFallbacks: {
  colors: Partial<Record<keyof CvDesignTokens["colors"], keyof CvDesignTokens["colors"]>>;
  typography: Partial<Record<keyof CvDesignTokens["typography"], keyof CvDesignTokens["typography"]>>;
} = {
  colors: { date: "muted", location: "muted" },
  typography: {
    dateSizePt: "bodySizePt", organizationSizePt: "bodySizePt", locationSizePt: "bodySizePt",
    projectTechnologiesSizePt: "bodySizePt", projectDescriptionSizePt: "bodySizePt",
  },
};

/**
 * Where a template draws its organisations in another colour than the organisation token (measured): the plain (ATS)
 * layouts with their own palette, Klassisch's Bildungsweg in the text colour. A changed Hervorhebungsfarbe keeps them.
 */
const nativeOrganizationColors: Record<string, { ats?: string; education?: string }> = {
  "ivy-league": { ats: ivyLeagueAtsColors.primary },
  modern: { ats: modernAtsColors.primary },
  tabellarisch: { ats: tabellarischAtsColor },
  klassisch: { education: klassischDefaults.colors.text },
};

/** Templates whose experience entries carry Zweispaltig's own Arbeitgebernamen colour (`data-cv-employer`). */
const employerTemplates = new Set(["zweispaltig", "tuerkis-profil"]);

/**
 * Colour and size of the role texts, on the preview and on the PDF alike. Only what the user chose is written (inline,
 * so the template's own rules of the same text give way); an untouched role keeps the template's native look.
 * Zweispaltig's Arbeitgebernamen are the more specific choice for the employers of the Werdegang and stay theirs.
 */
export const applyResumeTextRoleStyles = (
  scope: Element,
  templateId: string,
  settings: DocumentDesignSettings,
  design: CvDesignTokens,
  /** The template's native sizes: its tokens and the size it draws a role text in (per section and layout). */
  native?: { typography: CvDesignTokens["typography"]; size: (role: ResumeTextRole, node: Element) => number },
): void => {
  // A project's technology line is drawn at its design size (the one the panel shows) on both surfaces; without it the
  // template's supporting rules decided its size by specificity, differently in the preview and the PDF. Like the other
  // design variables it goes on the page and on its content (the preview keeps only the page's inner markup).
  const content = scope.matches(".cv-sheet") ? scope.querySelector(".page-content") : scope.firstElementChild;
  for (const element of [scope, content])
    (element as HTMLElement | null)?.style.setProperty("--resume-technologies-size", `${design.typography.projectTechnologiesSizePt}pt`);
  const colors = settings.cvOverrides?.colors;
  const typography = settings.cvOverrides?.typography;
  if (!colors && !typography) return;
  // Zweispaltig's Arbeitgebernamen keep their own precedence (Arbeitgeberfarbe, Unternehmen / Einrichtung, then the older
  // Hervorhebungsfarbe chain of getZweispaltigDesignVariables, which the card above the panel shows): an employer line is
  // written only for an own Unternehmen / Einrichtung without an own Arbeitgeberfarbe.
  const employerChain = employerTemplates.has(resolveTemplateId(templateId))
    && (colors?.employer !== undefined || colors?.organization === undefined);
  // Written into the attribute: linkedom drops the priority of `style.setProperty`, and a template rule with !important on
  // the same text (Elegant's and Stilvoll's body paragraphs) would win over a plain inline value.
  const set = (element: Element, property: string, value: string) => {
    const kept = (element.getAttribute("style") ?? "").split(";").map((declaration) => declaration.trim())
      .filter((declaration) => declaration && declaration.split(":")[0].trim().toLowerCase() !== property);
    element.setAttribute("style", [...kept, `${property}:${value}!important`].join(";"));
  };
  // Template accent variables also colour the organisations. Keep their native colour (in the plain layout its own
  // palette) when only the highlight colour changes; an explicit organisation (or legacy employer) choice still wins.
  const pinned = colors?.accent !== undefined && colors.organization === undefined;
  const nativeOrganization = nativeOrganizationColors[resolveTemplateId(templateId)];
  const organizationColor = (node: Element) => {
    if (!pinned) return design.colors.organization;
    if (nativeOrganization?.education && node.closest('[data-managed-section="education"]')) return nativeOrganization.education;
    return settings.resumeOutputMode === "ats" && nativeOrganization?.ats ? nativeOrganization.ats : design.colors.organization;
  };
  for (const role of resumeTextRoles) {
    const { color, size } = resumeTextRoleTokens[role];
    const colorFrom = resumeTextRoleFallbacks.colors[color];
    const sizeFrom = resumeTextRoleFallbacks.typography[size];
    const ownColor = colors?.[color] !== undefined || (role === "organization" && pinned)
      || (colorFrom !== undefined && colors?.[colorFrom] !== undefined);
    const chosenSize = typography?.[size] !== undefined;
    const followsSize = !chosenSize && sizeFrom !== undefined && typography?.[sizeFrom] !== undefined;
    // Each text grows from the size its template draws it in (Projekte / Hobbys and the plain layout have their own); an
    // entry title keeps that size while the Lesetext changes, also where the template would scale it.
    const ratio = followsSize && sizeFrom && native ? design.typography[sizeFrom] as number / (native.typography[sizeFrom] as number) : undefined;
    const keepsSize = !chosenSize && role === "entry-title" && typography?.bodySizePt !== undefined && native !== undefined;
    if (!ownColor && !chosenSize && !followsSize && !keepsSize) continue;
    for (const node of scope.querySelectorAll(cvRoleSelector(role))) {
      if (ownColor && !(role === "organization" && employerChain && node.hasAttribute("data-cv-employer")))
        set(node, "color", role === "organization" ? organizationColor(node) : design.colors[color]);
      if (chosenSize || (followsSize && !native)) set(node, "font-size", `${design.typography[size]}pt`);
      else if (native && (ratio !== undefined || keepsSize))
        set(node, "font-size", `${Math.round(native.size(role, node) * (ratio ?? 1) * 100) / 100}pt`);
    }
  }
};
