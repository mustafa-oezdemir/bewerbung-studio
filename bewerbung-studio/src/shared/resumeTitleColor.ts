import type { ResolvedCvDocument } from "./resolveCvDocument";
import { getColorContrastRatio } from "./documentDesign";
import { resolveTemplateCvDesign } from "./cvDesign";
import { getEinspaltigDesignVariables } from "./einspaltigDesign";
import { getElegantDesignVariables } from "./elegantDesign";
import { resolveZweispaltigApplicationColors } from "./zweispaltigLetterIdentity";
import { resolveTemplateId } from "./templates";

type TitleColorSource = Pick<ResolvedCvDocument, "templateId" | "design" | "settings" | "kreativVariables" | "stilvollVariables" | "gepflegtVariables" | "kompaktVariables" | "zeitgenoessischVariables">;

/**
 * The colour the Lebenslauf gives the professional title under the name (the profile's Berufsbezeichnung), exactly as
 * the selected template draws it with the current choices: an Untertitel
 * colour chosen in the Lebenslauf design wins (applyResumeDesignOverrides); otherwise each template's own rule, which
 * follows the Lebenslauf's Akzentfarbe or the Bewerbung's theme colours. Measured against the rendered preview and PDF
 * (14 templates × default, Untertitel, Akzentfarbe and theme colour changes).
 */
export const resolveResumeTitleColor = (
  cv: TitleColorSource,
  { accentColor, secondaryColor }: { accentColor: string; secondaryColor: string },
): string => {
  const templateId = resolveTemplateId(cv.templateId);
  const changed = cv.settings.cvOverrides?.colors;
  const chosenAccent = changed?.accent ? cv.design.colors.accent : undefined;
  if (templateId === "elegant") {
    return getElegantDesignVariables(cv.design, cv.settings, accentColor, secondaryColor)["--elegant-subheading"] ?? cv.design.colors.subheading;
  }
  if (changed?.subheading) return cv.design.colors.subheading;
  switch (templateId) {
    case "einspaltig":
      return chosenAccent ?? getEinspaltigDesignVariables(resolveTemplateCvDesign(templateId), undefined, accentColor)["--einfach-subheading"];
    case "ivy-league":
      return chosenAccent ?? (changed?.surface ? cv.design.colors.surface : secondaryColor);
    case "modern":
    case "tabellarisch":
      return chosenAccent ?? accentColor;
    case "zweispaltig":
      return chosenAccent ?? resolveZweispaltigApplicationColors(accentColor, secondaryColor).accent;
    case "klassisch": return cv.design.colors.text;
    case "stilvoll": return cv.stilvollVariables?.["--stilvoll-title"] ?? cv.design.colors.subheading;
    case "gepflegt": return cv.gepflegtVariables?.["--gepflegt-subheading"] ?? cv.design.colors.subheading;
    case "kompakt": return cv.kompaktVariables?.["--kompakt-subheading"] ?? cv.design.colors.subheading;
    case "zeitgenoessisch": return cv.zeitgenoessischVariables?.["--zeit-dark"] ?? cv.design.colors.subheading;
    case "kreativ": return cv.kreativVariables?.["--kreativ-header-text"] ?? cv.design.colors.subheading;
    default: return cv.design.colors.subheading;
  }
};

/**
 * The colour the Lebenslauf gives the name in its header, for the templates without a letter identity of their own
 * (their Anschreiben takes it from here). A colour chosen in the Lebenslauf design wins (Überschrift, then
 * Akzentfarbe where the template draws the name with it); otherwise the template's rule. Measured against the rendered
 * PDF (default, theme colour, Überschrift and Akzentfarbe changes). Pehlione sets the name white on its band, so the
 * letter takes the Überschrift colour there.
 */
export const resolveResumeNameColor = (
  cv: TitleColorSource,
  { accentColor }: { accentColor: string; secondaryColor: string },
): string => {
  const templateId = resolveTemplateId(cv.templateId);
  const changed = cv.settings.cvOverrides?.colors;
  if (changed?.heading) return cv.design.colors.heading;
  const chosenAccent = changed?.accent ? cv.design.colors.accent : undefined;
  switch (templateId) {
    case "ivy-league":
    case "klassisch": return chosenAccent ?? accentColor;
    case "tabellarisch": return chosenAccent ?? cv.design.colors.heading;
    default: return cv.design.colors.heading;
  }
};

/**
 * The title colour for a text on the white letter page (Betreff of the Anschreiben, Überschrift of the
 * Motivationsschreiben). A title the Lebenslauf sets on a coloured band (Kreativ: white on its header band) would be
 * unreadable there, so the band's colour stands in for it.
 */
export const resolveLetterTitleColor = (
  cv: TitleColorSource,
  colors: { accentColor: string; secondaryColor: string },
  background = "#ffffff",
): string => {
  const title = resolveResumeTitleColor(cv, colors);
  if (getColorContrastRatio(title, background) >= 2) return title;
  const band = resolveTemplateId(cv.templateId) === "kreativ" ? cv.kreativVariables?.["--kreativ-primary"] : undefined;
  return [band, cv.design.colors.accent, colors.accentColor, cv.design.colors.heading, cv.design.colors.text]
    .find((color): color is string => Boolean(color) && getColorContrastRatio(color!, background) >= 2) ?? cv.design.colors.text;
};
