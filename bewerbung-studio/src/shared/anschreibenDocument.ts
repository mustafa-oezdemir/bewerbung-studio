import type { ResolvedCvDocument } from "./resolveCvDocument";
import type { DocumentDesignSettings } from "./documentDesign";
import { getColorContrastRatio, getDocumentDesignVariables, getDocumentFont } from "./documentDesign";
import { getReadableTextColor } from "./templates";
import { getZweispaltigLetterVariables, zweispaltigLetterCss } from "./zweispaltigLetterIdentity";
import { zeitgenoessischLetterCss } from "./zeitgenoessischDesign";
import { elegantLetterCss, getElegantDesignVariables } from "./elegantDesign";
import { kreativLetterCss } from "./kreativDesign";
import { stilvollLetterCss } from "./stilvollDesign";
import { gepflegtLetterCss } from "./gepflegtDesign";
import { kompaktLetterCss } from "./kompaktDesign";
import { documentSideMarginVariables, letterSideMarginCss, letterTopMarginCss, type DocumentSideMargins } from "./documentSideMargins";
import { resolveLetterTitleColor, resolveResumeNameColor } from "./resumeTitleColor";

/**
 * The Anschreiben page as the preview draws it: one element tree (`renderAnschreibenMarkup` for the PDF,
 * `AnschreibenPage` for the preview) with the same classes, style variables and template stylesheet, so the PDF prints
 * exactly what the preview shows. The texts are resolved by the caller.
 */
export type AnschreibenModel = {
  templateId: string;
  className: string;
  style: Record<string, string>;
  /** Stylesheets inside the page, in order: the shared side margins, then the template's letter identity. */
  stylesheets: string[];
  sender: { name: string; title: string; contact: string };
  recipientLines: string[];
  placeDate: string;
  subject: string;
  subjectClassName: string;
  greeting: string;
  paragraphs: Array<{ text: string; closing: boolean }>;
  signature: { greeting: string; source: string; name: string };
  /** The Anlagen list, or null when the letter shows none. */
  attachments: string[] | null;
};

const identityTemplates = ["zweispaltig", "zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt", "kompakt"];

/**
 * Sizes and fonts of every Anschreiben (karrierebibel.de, user 2026-10-15), after the template letter rules on both
 * preview and PDF: one font (the Lebenslauf's body font, never mixed); Fließtext 11 pt (12 pt at most, following a
 * larger Lebenslauf text) with one and a half line spacing; Briefkopf 10 pt; the name 15 pt (11-13-15 rule).
 */
export const anschreibenCvTypographyCss = `
.document-anschreiben .letter-preview,.document-anschreiben .letter-preview *{font-family:var(--cv-body-font)!important}
.document-anschreiben .letter-preview .sender-name{font-size:15pt!important;line-height:1.15!important}
.document-anschreiben .letter-preview :is(.sender-title,.sender-contact){font-size:10pt!important;line-height:1.3!important}
.document-anschreiben .letter-preview :is(address,address *,.paper-date,.letter-attachments,.letter-attachments *){font-size:var(--letter-body-size)!important;line-height:1.3!important}
.document-anschreiben .letter-preview :is(.letter-salutation,.letter-body,.letter-signature,.letter-signature *){font-size:var(--letter-body-size)!important;line-height:var(--letter-line-height,1.5)!important}
.document-anschreiben .letter-preview .letter-rule{height:1.25pt!important;min-height:0!important;border:0!important;background:var(--doc-accent)!important}
.document-anschreiben.letter-cv-colors .letter-preview .sender-name{color:var(--letter-name-color)!important}
.document-anschreiben.letter-cv-colors .letter-preview .sender-title{color:var(--letter-subject-color)!important}
.document-anschreiben.letter-cv-colors .letter-preview :is(.sender-contact,address,.paper-date,.letter-salutation,.letter-body,.letter-signature,.signature-name,.letter-attachments){color:var(--letter-text-color)!important}
`;

/**
 * The Betreff of every Anschreiben: 13 pt bold (11-13-15 rule) in the colour of the Lebenslauf's professional title,
 * after every template letter style; preview and PDF alike.
 */
export const anschreibenSubjectCss = ".document-paper.document-anschreiben .letter-preview > h3{font-size:13pt!important;font-weight:700!important;line-height:1.25!important;color:var(--letter-subject-color)!important}";

/**
 * A letter longer than its page first gives up line spacing (one and a half lines down to 1.3) and only then is
 * scaled, so the Fließtext keeps its 11 pt as long as possible. Used by the preview and the PDF's fit script alike.
 */
export const letterLineHeightSteps = ["1.5", "1.45", "1.4", "1.35", "1.3"] as const;

/** The least space under the date (above the Betreff) the fit leaves: the „4 Zeilen nach oben“ setting's. */
export const letterMinimumBetreffGapMm = 4;

/**
 * The one fit of a letter that is longer than its page (`paper` 297 mm high, `content` its `.letter-preview`), run by
 * the preview (`fitLetterSpacing`) and inside the PDF's fit script. White space gives way first: the space above the
 * Betreff shrinks down to 4 mm, so „Standardabstand“ never changes the type. Only then the line spacing steps down
 * (1.5 → 1.3); whatever still does not fit is scaled by the caller. Lengths go through mm, so the preview's zoom does
 * not matter.
 */
export const letterSpacingFitSource = [
  "var mm = paper.clientHeight / 297;",
  "var over = function () { return content.scrollHeight - paper.clientHeight; };",
  "var date = content.querySelector('.paper-date');",
  "if (date) date.style.removeProperty('margin-bottom');",
  "content.style.removeProperty('--letter-line-height');",
  "if (date && over() > 0.5) {",
  "  var current = parseFloat(getComputedStyle(date).marginBottom) * 25.4 / 96;",
  `  var target = Math.max(${letterMinimumBetreffGapMm}, current - over() / mm - 0.2);`,
  "  if (target < current) date.style.setProperty('margin-bottom', target.toFixed(2) + 'mm', 'important');",
  "}",
  `var steps = ${JSON.stringify(letterLineHeightSteps)};`,
  "for (var i = 0; i < steps.length; i++) { content.style.setProperty('--letter-line-height', steps[i]); if (over() <= 0.5) break; }",
].join("\n");

export const fitLetterSpacing = new Function("paper", "content", letterSpacingFitSource) as (paper: HTMLElement, content: HTMLElement) => void;

/** Fließtext size: 11 pt at least (karrierebibel), the Lebenslauf's own text size up to 12 pt. */
export const letterBodySizePt = (cvBodySizePt: number) => Math.min(12, Math.max(11, cvBodySizePt));

/** The template's own letter stylesheet (Briefkopf, paddings, colours); "" for the templates without one. */
export const anschreibenTemplateCss = (templateId: string) =>
  templateId === "zweispaltig" ? zweispaltigLetterCss
    : templateId === "zeitgenoessisch" ? zeitgenoessischLetterCss
    : templateId === "elegant" ? elegantLetterCss
    : templateId === "kreativ" ? kreativLetterCss
    : templateId === "stilvoll" ? stilvollLetterCss
    : templateId === "gepflegt" ? gepflegtLetterCss
    : templateId === "kompakt" ? kompaktLetterCss : "";

/** The templates whose Betreff carries the `letter-subject` class of their letter stylesheet. */
export const anschreibenSubjectClassName = (templateId: string) =>
  ["zweispaltig", "zeitgenoessisch", "elegant", "kreativ", "stilvoll", "gepflegt"].includes(templateId) ? "letter-subject" : "";

/** Column and background classes of a document page (`column-…`, `background-…`, print background). */
export const documentDesignClassName = (settings: DocumentDesignSettings) => {
  const atsMode = settings.resumeOutputMode === "ats" || settings.columnLayout === "compact-ats";
  return `column-${atsMode ? "compact-ats" : settings.columnLayout} background-${settings.backgroundId} background-scope-${settings.backgroundScope} ${
    settings.showBackgroundInPrint ? "print-background" : "no-print-background"}`;
};

/** The first colour that reads on the white letter page (a name set white on a CV band does not). */
const readableOnPaper = (...colors: string[]) =>
  colors.find((color) => getColorContrastRatio(color, "#ffffff") >= 3) ?? colors.at(-1)!;

/** Classes, style variables and stylesheets of the Anschreiben page. */
export const buildAnschreibenFrame = ({
  templateId,
  layout,
  density,
  gapReduction,
  settings,
  resolvedCv,
  accentColor,
  secondaryColor,
  sideMargins,
}: {
  templateId: string;
  layout: string;
  density: string;
  gapReduction: number;
  settings: DocumentDesignSettings;
  resolvedCv: Pick<ResolvedCvDocument, "templateId" | "design" | "settings" | "zeitgenoessischVariables" | "kreativVariables" | "stilvollVariables" | "gepflegtVariables" | "kompaktVariables">;
  accentColor: string;
  secondaryColor: string;
  sideMargins: DocumentSideMargins;
}) => {
  const paper: Record<string, string> = {
    "--doc-accent": accentColor,
    "--doc-secondary": secondaryColor,
    "--doc-on-secondary": getReadableTextColor(secondaryColor),
    ...getDocumentDesignVariables(settings),
  };
  const identity: Record<string, string> | undefined = templateId === "zweispaltig"
    ? getZweispaltigLetterVariables(resolvedCv.design, resolvedCv.settings, accentColor, secondaryColor)
    : templateId === "zeitgenoessisch" ? resolvedCv.zeitgenoessischVariables
    : templateId === "elegant" ? getElegantDesignVariables(resolvedCv.design, resolvedCv.settings, accentColor, secondaryColor)
    : templateId === "kreativ" ? resolvedCv.kreativVariables
    : templateId === "stilvoll" ? resolvedCv.stilvollVariables
    : templateId === "gepflegt" ? resolvedCv.gepflegtVariables
    : templateId === "kompakt" ? resolvedCv.kompaktVariables : undefined;
  const templateCss = anschreibenTemplateCss(templateId);
  return {
    className: `document-paper document-anschreiben letter-${density} letter-gap-${gapReduction} layout-${layout} ${documentDesignClassName(settings)}${
      identityTemplates.includes(templateId) ? ` ${templateId}-letter` : " letter-cv-colors"}`,
    style: {
      ...paper,
      ...(identity ?? {}),
      ...documentSideMarginVariables(sideMargins),
      "--letter-subject-color": resolveLetterTitleColor(resolvedCv, { accentColor, secondaryColor }),
      // Templates without a letter identity take the Lebenslauf's name and text colours (the others draw their own).
      "--letter-name-color": readableOnPaper(resolveResumeNameColor(resolvedCv, { accentColor, secondaryColor }),
        resolveLetterTitleColor(resolvedCv, { accentColor, secondaryColor }), resolvedCv.design.colors.text),
      "--letter-text-color": readableOnPaper(resolvedCv.design.colors.paragraph, resolvedCv.design.colors.text, "#222b2a"),
      "--letter-body-size": `${letterBodySizePt(resolvedCv.design.typography.bodySizePt)}pt`,
      "--cv-name-font": getDocumentFont(resolvedCv.design.typography.headingFontId).family,
      "--cv-name-size": `${resolvedCv.design.typography.headingSizePt}pt`,
      "--cv-body-font": getDocumentFont(resolvedCv.design.typography.fontId).family,
      "--cv-body-size": `${resolvedCv.design.typography.bodySizePt}pt`,
    } as Record<string, string>,
    stylesheets: [letterSideMarginCss, letterTopMarginCss, ...(templateCss ? [templateCss] : []), anschreibenCvTypographyCss, anschreibenSubjectCss],
  };
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * The Anschreiben's Briefkopf on its own: the sender line and the rule inside the page's classes, style variables and
 * stylesheets, so another page (the Motivationsschreiben) shows exactly the Anschreiben's Briefkopf of the template.
 */
export type AnschreibenLetterhead = Pick<AnschreibenModel, "templateId" | "className" | "style" | "stylesheets" | "sender">;

/** The Briefkopf of an Anschreiben page; its background classes stay behind (they decorate a whole sheet). */
export const anschreibenLetterhead = (model: AnschreibenLetterhead): AnschreibenLetterhead => ({
  templateId: model.templateId,
  className: `${model.className.split(/\s+/).filter((name) => name && !/^(background-|print-background$|no-print-background$)/.test(name)).join(" ")} letterhead-only`,
  style: model.style,
  stylesheets: model.stylesheets,
  sender: model.sender,
});

const senderMarkup = (sender: AnschreibenModel["sender"]) =>
  `<div class="letter-header"><p class="sender-line"><span class="sender-name">${escapeHtml(sender.name)}</span><span class="sender-title">${
    escapeHtml(sender.title)}</span><span class="sender-contact">${escapeHtml(sender.contact)}</span></p></div>`
  + `<i class="paper-rule letter-rule"></i>`;

/** `style` attribute text of the page, in the order React writes it. */
export const anschreibenStyleText = (model: Pick<AnschreibenModel, "style">) =>
  Object.entries(model.style).map(([property, value]) => `${property}:${value}`).join(";");

/**
 * The page as HTML for the PDF; every text is escaped. `backgroundMarkup` is the document background layer (the
 * preview draws the same layer with React).
 */
export const renderAnschreibenMarkup = (model: AnschreibenModel, backgroundMarkup = "") =>
  `<div class="${escapeHtml(model.className)}" data-resume-template="${escapeHtml(model.templateId)}" style="${escapeHtml(anschreibenStyleText(model))}">`
  + model.stylesheets.map((css) => `<style>${css}</style>`).join("")
  + backgroundMarkup
  + `<div class="letter-preview">`
  + senderMarkup(model.sender)
  + `<address>${model.recipientLines.map((line, index) => `<span>${escapeHtml(line)}${index < model.recipientLines.length - 1 ? "<br/>" : ""}</span>`).join("")}</address>`
  + `<p class="paper-date">${escapeHtml(model.placeDate)}</p>`
  + `<h3${model.subjectClassName ? ` class="${model.subjectClassName}"` : ""}>${escapeHtml(model.subject)}</h3>`
  + `<p class="letter-salutation">${escapeHtml(model.greeting)}</p>`
  + model.paragraphs.map((paragraph) => `<p class="letter-body${paragraph.closing ? " letter-closing" : ""}">${escapeHtml(paragraph.text)}</p>`).join("")
  + `<p class="letter-signature"><span>${escapeHtml(model.signature.greeting)}</span>${model.signature.source
    ? `<img class="signature-image" src="${escapeHtml(model.signature.source)}" alt="${escapeHtml(`Unterschrift von ${model.signature.name}`)}"/>`
    : ""}<span class="signature-name">${escapeHtml(model.signature.name)}</span></p>`
  + (model.attachments ? `<div class="letter-attachments"><strong>Anlagen</strong>${model.attachments.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : "")
  + `</div></div>`;

/** The Briefkopf alone as HTML (PDF); the preview draws the same tree with `AnschreibenLetterheadBlock`. */
export const renderAnschreibenLetterheadMarkup = (letterhead: AnschreibenLetterhead) =>
  `<div class="${escapeHtml(letterhead.className)}" data-resume-template="${escapeHtml(letterhead.templateId)}" style="${escapeHtml(anschreibenStyleText(letterhead))}">`
  + letterhead.stylesheets.map((css) => `<style>${css}</style>`).join("")
  + `<div class="letter-preview">${senderMarkup(letterhead.sender)}</div></div>`;
