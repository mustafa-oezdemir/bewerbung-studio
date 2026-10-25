import type { CvDesignTokens } from "./cvDesignSchema";
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
): void => {
  const colors = settings.cvOverrides?.colors;
  const typography = settings.cvOverrides?.typography;
  if (!colors && !typography) return;
  const employer = employerTemplates.has(resolveTemplateId(templateId)) && colors?.employer !== undefined;
  // Written into the attribute: linkedom drops the priority of `style.setProperty`, and a template rule with !important on
  // the same text (Elegant's and Stilvoll's body paragraphs) would win over a plain inline value.
  const set = (element: Element, property: string, value: string) => {
    const kept = (element.getAttribute("style") ?? "").split(";").map((declaration) => declaration.trim())
      .filter((declaration) => declaration && declaration.split(":")[0].trim().toLowerCase() !== property);
    element.setAttribute("style", [...kept, `${property}:${value}!important`].join(";"));
  };
  for (const role of resumeTextRoles) {
    const { color, size } = resumeTextRoleTokens[role];
    // Template accent variables also colour some employer lines. Keep their native organisation colour when only the
    // highlight colour changes; an explicit organisation (or legacy employer) choice still wins.
    const ownColor = colors?.[color] !== undefined || (role === "organization" && colors?.accent !== undefined);
    const ownSize = typography?.[size] !== undefined;
    if (!ownColor && !ownSize) continue;
    for (const node of scope.querySelectorAll(cvRoleSelector(role))) {
      if (ownColor && !(role === "organization" && employer && node.hasAttribute("data-cv-employer")))
        set(node, "color", design.colors[color]);
      if (ownSize) set(node, "font-size", `${design.typography[size]}pt`);
    }
  }
};
