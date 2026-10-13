import type { ApplicantProfile, Application, DocumentDraft } from "./schema";
import type { ResolvedCvDocument } from "./resolveCvDocument";
import { applicationGreeting } from "./applicationContacts";
import { formatApplicationDateLong } from "./applicationDate";
import { formatPhoneForDisplay, phoneHref } from "./contactPresentation";
import { getColorContrastRatio, getDocumentFont } from "./documentDesign";
import { resolveDocumentSideMargins } from "./documentSideMargins";
import { getTemplateDocumentDesignDefaults } from "./cvDesign";
import { resolveEffectiveDesignTokens, resolveResumeAppearance } from "./resumeDesignSystem";
import { getProfileMediaSource } from "./profileMedia";
import { resolveLetterTitleColor } from "./resumeTitleColor";
import { getTemplate } from "./templates";

/**
 * The standalone Motivationsschreiben ("Dritte Seite", see karrierebibel.de/motivationsschreiben), DIN-5008-oriented
 * and plain: a Briefkopf with the name on the left and address, phone and e-mail on the right, the Überschrift, the
 * Anrede from the application's Ansprechpartner, the user's own paragraphs, the Grußformel with the profile's
 * signature and Ort und Datum. No recipient block, no position or company line, no decoration.
 *
 * Fonts, colours and spacing are the selected Lebenslauf's effective design (`resolveCvDocument`); where the user has
 * not changed a value there, the letter starts from DIN-oriented defaults (11 pt, line height 1.3, Überschrift 16 pt
 * bold). The left and right margin are always the Lebenslauf's own (`resolveDocumentSideMargins`, shared with Deckblatt
 * and Anschreiben); top and bottom are 20 mm. The paragraphs are set justified (Blocksatz, German hyphenation), the
 * Briefkopf and the Überschrift stay left-aligned. The preview and the PDF render this one model with this one
 * stylesheet.
 */

export type MotivationPart = "introduction" | "mainBody" | "evidence" | "goals" | "closing";

export type MotivationParagraph = { part: MotivationPart; text: string };

export type MotivationContact = { kind: "street" | "city" | "phone" | "email"; text: string; href: string };

export type MotivationModel = {
  templateId: string;
  name: string;
  contacts: MotivationContact[];
  heading: string;
  salutation: string;
  paragraphs: MotivationParagraph[];
  closing: { greeting: string; signatureSource: string; signer: string; placeDate: string };
  style: Record<string, string>;
  isEmpty: boolean;
};

/** The editor fields of the document, in the order they are printed. */
export const motivationParts: ReadonlyArray<{ part: MotivationPart; field: keyof DocumentDraft; label: string; placeholder: string }> = [
  { part: "introduction", field: "motivationIntroduction", label: "Einleitung", placeholder: "Was treibt Sie persönlich an? Starten Sie direkt und konkret." },
  { part: "mainBody", field: "motivationMainBody", label: "Meine Motivation", placeholder: "Warum genau diese Position und dieses Unternehmen? Welche Werte oder Aufgaben passen zu Ihnen?" },
  { part: "evidence", field: "motivationEvidence", label: "Meine Erfahrungen und Stärken", placeholder: "Belegen Sie Ihre Eignung mit konkreten Erfahrungen, Ergebnissen oder Beispielen." },
  { part: "goals", field: "motivationGoals", label: "Meine Ziele und mein Beitrag", placeholder: "Was möchten Sie erreichen und welchen konkreten Beitrag möchten Sie leisten?" },
  { part: "closing", field: "motivationClosing", label: "Schluss", placeholder: "Kurz, positiv und selbstbewusst abschließen." },
];

export const motivationGreeting = "Mit freundlichen Grüßen";

/** DIN-oriented spacing and section-heading defaults; name and reading typography always follow the CV. */
export const motivationDefaults = {
  lineHeight: 1.3,
  headingSizePt: 16,
  headingWeight: 700,
  marginTopMm: 20,
  marginBottomMm: 20,
  /** Empty lines (of the body text) between the Briefkopf and the Überschrift, and between it and the Anrede. */
  headerGapLines: 8,
  titleGapLines: 4,
} as const;

const differs = (left: number, right: number) => Math.abs(left - right) > 0.001;
const round = (value: number) => Math.round(value * 100) / 100;

/** A user text as paragraphs: an empty line starts a new one, a single line break stays inside it. */
export const splitMotivationParagraphs = (text: string) =>
  text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

export const buildMotivationModel = ({
  application,
  profile,
  documents,
  resolvedCv,
  themeColors,
}: {
  /** Ansprechpartner (Anrede) and date of the application. */
  application: Pick<Application, "contact" | "additionalContacts" | "sentAt" | "createdAt" | "accentColor" | "secondaryColor">;
  /** The Bewerbung's theme colours as the Lebenslauf draws them (the preview's unsaved choice); default: the saved ones. */
  themeColors?: { accentColor: string; secondaryColor: string };
  /** The profile bound to the application: Briefkopf, Ort and signature come from it. */
  profile: ApplicantProfile | undefined;
  documents: Pick<DocumentDraft, "motivationHeading" | "motivationHeadingGapReduction" | "motivationIntroduction" | "motivationMainBody" | "motivationEvidence" | "motivationGoals" | "motivationClosing">;
  /** The selected Lebenslauf, resolved: its effective design is the Motivationsschreiben's design. */
  resolvedCv: ResolvedCvDocument;
}): MotivationModel => {
  const { templateId, design, settings } = resolvedCv;
  const appearance = resolveResumeAppearance(templateId, settings.resumeAppearance);
  const { typography, spacing, colors } = design;

  // A value counts as the user's when it is set as an override or differs from the template's native design.
  const native = resolveEffectiveDesignTokens(templateId, getTemplateDocumentDesignDefaults(templateId));
  const typographyChanged = (key: "lineHeight" | "sectionHeadingSizePt" | "sectionHeadingWeight") =>
    settings.cvOverrides?.typography?.[key] !== undefined || differs(typography[key], native.typography[key]);
  const spacingChanged = (key: "entryGapMm") =>
    settings.cvOverrides?.spacing?.[key] !== undefined || differs(spacing[key], native.spacing[key]);

  const bodySize = typography.bodySizePt;
  const lineHeight = typographyChanged("lineHeight") ? typography.lineHeight : motivationDefaults.lineHeight;
  const sides = resolveDocumentSideMargins(templateId, spacing);
  // One empty line between paragraphs (DIN 5008) unless the Lebenslauf sets its own entry gap.
  const lineMm = round((bodySize * lineHeight * 25.4) / 72);
  const readableColor = (...candidates: string[]) => candidates.find((candidate) => getColorContrastRatio(candidate, colors.background) >= 4.5) ?? colors.text;
  const ruleWidth = Math.min(0.6, appearance.sectionDividerWidthMm > 0 ? appearance.sectionDividerWidthMm : 0.3);

  const style: Record<string, string> = {
    "--mv-font": getDocumentFont(typography.fontId).family,
    "--mv-heading-font": getDocumentFont(typography.headingFontId).family,
    "--mv-body-size": `${bodySize}pt`,
    "--mv-line-height": String(lineHeight),
    "--mv-text": readableColor(colors.paragraph, colors.text),
    "--mv-name-color": readableColor(colors.heading, colors.sectionHeading, colors.text),
    "--mv-name-size": `${typography.headingSizePt}pt`,
    "--mv-name-weight": String(typography.headingWeight),
    "--mv-contact-color": readableColor(colors.muted, colors.text),
    "--mv-contact-size": `${round(Math.max(9, bodySize - 1))}pt`,
    // The Überschrift has the colour of the Lebenslauf's professional title (green, blue, red … as chosen there).
    "--mv-heading-color": resolveLetterTitleColor(resolvedCv, themeColors ?? {
      accentColor: application.accentColor || getTemplate(templateId).accent,
      secondaryColor: application.secondaryColor || getTemplate(templateId).secondary,
    }, colors.background),
    "--mv-heading-size": `${typographyChanged("sectionHeadingSizePt") ? typography.sectionHeadingSizePt : motivationDefaults.headingSizePt}pt`,
    "--mv-heading-weight": String(typographyChanged("sectionHeadingWeight") ? typography.sectionHeadingWeight : motivationDefaults.headingWeight),
    "--mv-line": colors.divider,
    "--mv-rule-width": `${ruleWidth}mm`,
    "--mv-background": colors.background,
    "--mv-margin-top": `${motivationDefaults.marginTopMm}mm`,
    "--mv-margin-right": `${sides.rightMm}mm`,
    "--mv-margin-bottom": `${motivationDefaults.marginBottomMm}mm`,
    "--mv-margin-left": `${sides.leftMm}mm`,
    // Move the heading and all following content together; the Briefkopf stays in place.
    "--mv-header-gap": `calc(var(--mv-body-size) * var(--mv-line-height) * ${motivationDefaults.headerGapLines - documents.motivationHeadingGapReduction})`,
    "--mv-title-gap": `calc(var(--mv-body-size) * var(--mv-line-height) * ${motivationDefaults.titleGapLines})`,
    "--mv-paragraph-gap": `${spacingChanged("entryGapMm") ? spacing.entryGapMm : lineMm}mm`,
  };

  const name = [profile?.firstName, profile?.lastName].map((value) => value?.trim() ?? "").filter(Boolean).join(" ");
  const street = profile?.street?.trim() ?? "";
  const city = [profile?.postalCode?.trim(), profile?.city?.trim()].filter(Boolean).join(" ");
  const phone = profile?.phone?.trim() ?? "";
  const email = profile?.email?.trim() ?? "";
  const contacts: MotivationContact[] = [
    ...(street ? [{ kind: "street" as const, text: street, href: "" }] : []),
    ...(city ? [{ kind: "city" as const, text: city, href: "" }] : []),
    ...(phone ? [{ kind: "phone" as const, text: formatPhoneForDisplay(phone), href: phoneHref(phone) }] : []),
    ...(email ? [{ kind: "email" as const, text: email, href: `mailto:${email}` }] : []),
  ];

  const fields: Record<MotivationPart, string> = {
    introduction: documents.motivationIntroduction,
    mainBody: documents.motivationMainBody,
    evidence: documents.motivationEvidence,
    goals: documents.motivationGoals,
    closing: documents.motivationClosing,
  };
  const paragraphs = motivationParts.flatMap(({ part }) =>
    splitMotivationParagraphs(fields[part] ?? "").map((text) => ({ part, text })));
  const place = profile?.city?.trim() ?? "";
  return {
    templateId,
    name,
    contacts,
    heading: documents.motivationHeading.trim() || "Meine Motivation",
    // The Anrede is never stored: it follows the application's Ansprechpartner (the Anschreiben's rule).
    salutation: applicationGreeting(application),
    paragraphs,
    closing: {
      greeting: motivationGreeting,
      signatureSource: getProfileMediaSource(profile?.signaturePath),
      signer: name,
      placeDate: [place, formatApplicationDateLong(application)].filter(Boolean).join(", "),
    },
    style,
    isEmpty: !paragraphs.length,
  };
};

/** Class names of the page root; the React preview and the HTML export use the same list. */
export const motivationRootClassName = () => "motivation";

export const motivationHeadingClassName = () => "mv-heading";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** `style` attribute text of the root, in the order React writes it. */
export const motivationStyleText = (model: MotivationModel) =>
  Object.entries(model.style).map(([property, value]) => `${property}:${value}`).join(";");

/** The page as HTML for the PDF export. Every user text is escaped; the preview renders the same tree with React. */
export const renderMotivationMarkup = (model: MotivationModel) => {
  const contacts = model.contacts.length
    ? `<ul class="mv-contacts">${model.contacts.map((contact) => `<li data-kind="${contact.kind}">${contact.href
      ? `<a href="${escapeHtml(contact.href)}">${escapeHtml(contact.text)}</a>`
      : escapeHtml(contact.text)}</li>`).join("")}</ul>`
    : "";
  const signature = model.closing.signatureSource
    ? `<img class="mv-signature" src="${escapeHtml(model.closing.signatureSource)}" alt="Unterschrift"/>`
    : "";
  return `<article class="${motivationRootClassName()}" data-motivation-template="${escapeHtml(model.templateId)}" style="${escapeHtml(motivationStyleText(model))}">`
    + `<header class="mv-header"><h1 class="mv-name">${escapeHtml(model.name)}</h1>${contacts}</header>`
    + `<h2 class="${motivationHeadingClassName()}">${escapeHtml(model.heading)}</h2>`
    + `<p class="mv-salutation">${escapeHtml(model.salutation)}</p>`
    + (model.paragraphs.length ? `<div class="mv-body">${model.paragraphs.map((paragraph) =>
      `<p class="mv-paragraph" data-part="${paragraph.part}">${escapeHtml(paragraph.text)}</p>`).join("")}</div>` : "")
    + `<footer class="mv-closing"><div class="mv-sign-off"><p class="mv-greeting">${escapeHtml(model.closing.greeting)}</p>${signature}${
      model.closing.signer ? `<p class="mv-signer">${escapeHtml(model.closing.signer)}</p>` : ""}</div>${
      model.closing.placeDate ? `<p class="mv-place-date">${escapeHtml(model.closing.placeDate)}</p>` : ""}</footer>`
    + "</article>";
};

/**
 * The one stylesheet of the page (preview and PDF). Every rule is scoped by `.motivation`, so neither the PDF's
 * element rules (`h1`, `p`) nor the preview's document rules reach it. The page is A4 wide and grows with the text:
 * nothing is cut, hidden or scaled; a following PDF page repeats margins and background (`box-decoration-break`).
 */
export const motivationCss = `
.motivation{position:relative;box-sizing:border-box;display:block;width:210mm;min-height:297mm;margin:0;padding:var(--mv-margin-top) var(--mv-margin-right) var(--mv-margin-bottom) var(--mv-margin-left);background:var(--mv-background);color:var(--mv-text);font-family:var(--mv-font);font-size:var(--mv-body-size);font-weight:400;line-height:var(--mv-line-height);text-align:left;-webkit-box-decoration-break:clone;box-decoration-break:clone;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.motivation *{box-sizing:border-box;margin:0;padding:0}
.motivation :where(p,li,ul,a,footer,header,div,h1,h2){font-size:inherit;line-height:inherit;font-weight:inherit;font-style:normal;color:inherit;text-decoration:none}
.motivation .mv-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8mm;padding-bottom:4mm;border-bottom:var(--mv-rule-width) solid var(--mv-line);break-inside:avoid}
.motivation .mv-name{flex:1 1 auto;min-width:0;font-family:var(--mv-heading-font);font-size:var(--mv-name-size);font-weight:var(--mv-name-weight);line-height:1.15;letter-spacing:0;text-transform:none;color:var(--mv-name-color);overflow-wrap:anywhere}
.motivation .mv-contacts{flex:0 1 auto;max-width:62%;list-style:none;font-size:var(--mv-contact-size);line-height:1.35;text-align:right;color:var(--mv-contact-color);overflow-wrap:anywhere}
.motivation .mv-heading{margin-top:var(--mv-header-gap);font-family:var(--mv-heading-font);font-size:var(--mv-heading-size);font-weight:var(--mv-heading-weight);line-height:1.2;letter-spacing:0;text-transform:none;text-align:left;color:var(--mv-heading-color);break-after:avoid}
.motivation .mv-salutation{margin-top:var(--mv-title-gap);break-after:avoid}
.motivation .mv-body{margin-top:var(--mv-paragraph-gap)}
.motivation .mv-paragraph{white-space:pre-line;overflow-wrap:break-word;text-align:justify;text-justify:inter-word;hyphens:auto;orphans:3;widows:3}
.motivation .mv-paragraph+.mv-paragraph{margin-top:var(--mv-paragraph-gap)}
.motivation .mv-closing{display:flex;align-items:flex-end;justify-content:space-between;gap:8mm;margin-top:var(--mv-paragraph-gap);break-inside:avoid}
.motivation .mv-signature{display:block;max-width:55mm;max-height:16mm;margin:2mm 0 1mm;object-fit:contain;object-position:left center}
.motivation .mv-place-date{text-align:right;white-space:nowrap}
`;
