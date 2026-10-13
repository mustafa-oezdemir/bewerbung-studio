import type { CvDesignTokens } from "./cvDesignSchema";
import { getDocumentFont } from "./documentDesign";
import { tabellarischDefaults } from "./cvTemplateDefaults/tabellarisch.defaults";
import { textWidthMm, wrappedLines } from "./textMetrics";

const PT_TO_MM = 25.4 / 72;
const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;
const lineMm = (pt: number, lineHeight: number) => pt * PT_TO_MM * lineHeight;

/**
 * The one physical page geometry of Tabellarisch for the preview, the PDF and the page planner. "Seitenränder" moves the
 * left and right edge (header, sections and footer share them); top and bottom stay, so a page holds the same height of
 * text whatever the side margins are. `contentBottom` is the single bottom boundary of the flowing text: the bottom
 * margin plus the clearance for the page footer (19 mm above the sheet edge). The stylesheets pad the content box by the
 * same two values and the planner fills a page down to it.
 */
export const resolveTabellarischGeometry = (pageMarginMm?: number) => {
  const { page, margins, layout } = tabellarischDefaults;
  const side = pageMarginMm === undefined ? margins.leftMm : Math.max(0, pageMarginMm);
  const contentWidth = Math.max(40, page.widthMm - 2 * side);
  const timelineWidth = Math.max(20, contentWidth - layout.metaColumnMm - layout.railColumnMm - 2 * layout.timelineGapMm);
  return {
    left: side,
    right: side,
    top: margins.topMm,
    bottom: margins.bottomMm,
    contentWidth,
    /** Text column of a timeline entry (beside the date column and the rail). */
    timelineWidth,
    /** Text width of a bullet: the list takes its indent and the item padding off the timeline column. */
    bulletWidth: timelineWidth - layout.listIndentMm - layout.listItemPaddingMm,
    /** Lowest y (mm) the flowing text may reach. */
    contentBottom: page.heightMm - margins.bottomMm - layout.footerClearanceMm,
  };
};

/** Line boxes (mm) of the native type scale: the planner's geometry is computed from them. */
export const tabellarischLines = (() => {
  const { typography: type, layout } = tabellarischDefaults;
  const body = lineMm(type.bodySizePt, type.bodyLineHeight);
  const role = lineMm(type.entryTitleSizePt, type.entryTitleLineHeight);
  const organization = lineMm(type.organizationSizePt, type.organizationLineHeight);
  const sectionTitle = lineMm(type.sectionTitleSizePt, type.sectionTitleLineHeight);
  return {
    body,
    role,
    organization,
    sectionTitle,
    /** A section title with the gap below it. */
    sectionHead: sectionTitle + layout.sectionTitleGapMm,
    /** Role, the Abstand nach Eintragstitel, organisation and the space below it: an entry without bullets. */
    entryHead: role + 1 + organization + layout.organizationGapAfterMm,
  };
})();

/**
 * One resolved set of Tabellarisch variables for both rendering surfaces (`tabellarisch.css` and the PDF's
 * `tabellarischDocumentCss` only reference them): geometry, typography, spacing and the neutral palette. The two
 * application colours (`--tabellarisch-primary`, `--tabellarisch-accent`) stay with the template's colour handling
 * (Bewerbung colours, central accent override).
 */
export const getTabellarischDesignVariables = (design: CvDesignTokens): Record<string, string> => {
  const { typography: type, layout } = tabellarischDefaults;
  const geometry = resolveTabellarischGeometry(design.spacing.pageMarginMm);
  return {
    "--tabellarisch-margin-top": mm(geometry.top),
    "--tabellarisch-margin-right": mm(geometry.right),
    "--tabellarisch-margin-bottom": mm(geometry.bottom),
    "--tabellarisch-margin-left": mm(geometry.left),
    "--tabellarisch-footer-clearance": mm(layout.footerClearanceMm),
    "--tabellarisch-footer-bottom": mm(layout.footerBottomMm),
    "--tabellarisch-font": getDocumentFont(design.typography.fontId).family,
    "--tabellarisch-heading-font": getDocumentFont(design.typography.headingFontId).family,
    "--tabellarisch-body-size": `${design.typography.bodySizePt}pt`,
    "--tabellarisch-line-height": String(design.typography.lineHeight),
    "--tabellarisch-name-size": `${design.typography.headingSizePt}pt`,
    "--tabellarisch-name-weight": String(design.typography.headingWeight),
    "--tabellarisch-title-size": `${design.typography.subheadingSizePt}pt`,
    "--tabellarisch-title-weight": String(design.typography.subheadingWeight),
    "--tabellarisch-section-title-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--tabellarisch-section-title-weight": String(design.typography.sectionHeadingWeight),
    "--tabellarisch-heading-case": design.typography.sectionHeadingUppercase ? "uppercase" : "none",
    "--tabellarisch-entry-title-size": `${design.typography.entryHeadingSizePt}pt`,
    "--tabellarisch-section-gap": mm(design.spacing.sectionGapMm),
    "--tabellarisch-entry-gap": mm(design.spacing.entryGapMm),
    "--tabellarisch-section-title-gap": mm(design.spacing.sectionTitleGapMm),
    "--tabellarisch-entry-content-gap": mm(design.spacing.entryContentGapMm),
    "--tabellarisch-continuation-name-size": `${type.continuationNameSizePt}pt`,
    "--tabellarisch-continuation-title-size": `${type.continuationTitleSizePt}pt`,
    "--tabellarisch-section-title-color": design.colors.sectionHeading,
    "--tabellarisch-text": design.colors.text,
    "--tabellarisch-muted": design.colors.muted,
    "--tabellarisch-line": design.colors.divider,
  };
};

/** The compact head of a later page: name (left) beside the Berufsbezeichnung and the chosen contacts (right). */
const continuation = {
  nameLineHeight: 1.15,
  titleLineHeight: 1.25,
  contactSizePt: 8,
  contactLineHeight: 1.25,
  /** Above the contacts (below the title) and between two of them. */
  contactGapMm: 1,
  contactRowGapMm: 0.6,
  /** The right column takes the width its text needs, up to this share of the line. */
  titleShare: 0.6,
};

/**
 * Where the first section of a later Tabellarisch page starts (mm from the top of the sheet): the top margin, the compact
 * head (name beside the Berufsbezeichnung and the e-mail / phone chosen for later pages, each wrapped with the measured
 * font advances), its rule, and the larger of its gap and the first section's gap (the two margins collapse).
 */
export const estimateTabellarischContinuationTop = (options: {
  name: string;
  title: string;
  contacts: readonly string[];
  pageMarginMm?: number;
  sectionGapMm: number;
}) => {
  const { typography: type, layout } = tabellarischDefaults;
  const geometry = resolveTabellarischGeometry(options.pageMarginMm);
  const titleMm = type.continuationTitleSizePt * PT_TO_MM;
  const contactMm = continuation.contactSizePt * PT_TO_MM;
  const texts = [options.title.trim(), ...options.contacts.map((value) => value.trim())].filter(Boolean);
  const widest = Math.max(0, ...texts.map((text, index) => textWidthMm(text, index === 0 && options.title.trim() ? titleMm : contactMm, 600)));
  // fit-content(60 %): a share of the whole head, the column gap not taken off.
  const rightWidth = texts.length ? Math.min(widest + 0.5, geometry.contentWidth * continuation.titleShare) : 0;
  const nameWidth = geometry.contentWidth - (texts.length ? rightWidth + layout.continuationHeaderColumnGapMm : 0);
  const nameLines = Math.max(1, wrappedLines(options.name, nameWidth, type.continuationNameSizePt * PT_TO_MM, 750));
  const titleLines = options.title.trim() ? wrappedLines(options.title, rightWidth, titleMm, 600) : 0;
  const contacts = options.contacts.filter((value) => value.trim());
  const contactLines = contacts.reduce((total, value) => total + Math.max(1, wrappedLines(value, rightWidth, contactMm, 600)), 0);
  const left = nameLines * lineMm(type.continuationNameSizePt, continuation.nameLineHeight);
  const right = titleLines * lineMm(type.continuationTitleSizePt, continuation.titleLineHeight)
    + (contacts.length ? (titleLines ? continuation.contactGapMm : 0) + contactLines * lineMm(continuation.contactSizePt, continuation.contactLineHeight)
      + (contacts.length - 1) * continuation.contactRowGapMm : 0);
  const head = Math.max(left, right) + layout.continuationHeaderPaddingMm + layout.continuationHeaderRuleMm;
  // The head's bottom margin and the first section's top margin (its section gap) collapse into the larger one.
  return geometry.top + head + Math.max(layout.continuationHeaderGapMm, options.sectionGapMm);
};

/**
 * Section titles on both surfaces take the design's section heading colour. The preview's generic `.document-paper h2`
 * rule (the document heading colour) and the PDF's own heading colour would otherwise differ.
 */
export const tabellarischSectionTitleCss = `:is(.tabellarisch-template,.tabellarisch-pdf) [data-managed-section]>:is(h2,h3){color:var(--tabellarisch-section-title-color,${tabellarischDefaults.colors.sectionTitle})}`;

/** The continuation head's own rules (both surfaces): a grid, the right column holds title and contacts. */
export const tabellarischContinuationCss = (scope: string) => `
${scope}{display:grid;grid-template-columns:minmax(0,1fr) fit-content(${continuation.titleShare * 100}%);column-gap:${mm(tabellarischDefaults.layout.continuationHeaderColumnGapMm)};align-items:start;margin:0 0 ${mm(tabellarischDefaults.layout.continuationHeaderGapMm)};padding-bottom:${mm(tabellarischDefaults.layout.continuationHeaderPaddingMm)};border-bottom:${mm(tabellarischDefaults.layout.continuationHeaderRuleMm)} solid var(--tabellarisch-line)}
${scope}>:first-child{grid-column:1;grid-row:1/span 2;margin:0;color:var(--tabellarisch-primary);font-family:var(--tabellarisch-heading-font);font-size:var(--tabellarisch-continuation-name-size,${tabellarischDefaults.typography.continuationNameSizePt}pt);font-weight:750;line-height:${continuation.nameLineHeight};overflow-wrap:anywhere}
${scope}>:not(:first-child){grid-column:2;margin:0;text-align:right;overflow-wrap:anywhere}
${scope}>:nth-child(2):not([data-resume-header-extra-contact]){color:var(--tabellarisch-accent);font-size:var(--tabellarisch-continuation-title-size,${tabellarischDefaults.typography.continuationTitleSizePt}pt);font-weight:600;line-height:${continuation.titleLineHeight}}
${scope}>[data-resume-header-extra-contact]{display:flex;flex-direction:column;align-items:flex-end;gap:${mm(continuation.contactRowGapMm)};margin:${mm(continuation.contactGapMm)} 0 0;color:var(--tabellarisch-text);font-size:${continuation.contactSizePt}pt;font-style:normal;font-weight:600;line-height:${continuation.contactLineHeight}}
${scope}>[data-resume-header-extra-contact]:nth-child(2){margin-top:0}
${scope}>[data-resume-header-extra-contact] a{color:inherit;text-decoration:none}
`;
