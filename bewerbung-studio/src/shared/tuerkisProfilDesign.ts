import type { CvDesignTokens } from "./cvDesignSchema";
import { tuerkisProfilDefaults } from "./cvTemplateDefaults/tuerkis-profil.defaults";

const mm = (value: number) => `${Math.round(value * 100) / 100}mm`;

/**
 * The one physical page of Türkis Profil for the preview, the PDF and the page planner. "Seitenränder" is a horizontal
 * control: without a chosen value the DIN text box applies (25 mm left, 20 mm right); a chosen value N sets both sides
 * to N mm. The top (25 mm) and the bottom (20 mm) never move, so the height a page offers stays the same. The left
 * column takes 40 % of the text width beside the column gap, the main column the rest.
 */
export const resolveTuerkisGeometry = (pageMarginMm?: number, columnGapMm?: number) => {
  const { page, layout } = tuerkisProfilDefaults;
  const native = pageMarginMm === undefined || Math.abs(pageMarginMm - page.marginLeftMm) < 0.05;
  const left = native ? page.marginLeftMm : Math.max(0, pageMarginMm);
  const right = native ? page.marginRightMm : Math.max(0, pageMarginMm);
  const gap = Math.max(0, columnGapMm ?? layout.columnGapMm);
  const contentWidth = Math.max(0, page.widthMm - left - right);
  const sideWidth = (contentWidth - gap) * layout.sidebarShare;
  const mainWidth = contentWidth - gap - sideWidth;
  return {
    left, right, top: page.marginTopMm, bottom: page.marginBottomMm, gap,
    contentWidth, sideWidth, mainWidth,
    mainLeft: left + sideWidth + gap,
    /** Lowest y (mm) the flowing text may reach. */
    contentBottom: page.heightMm - page.marginBottomMm,
  };
};

/**
 * One resolved set of Türkis Profil variables for both surfaces (tuerkis-profil.css only references them): the page
 * edges, the column gap and the type sizes of the design. Colours stay with the shared Zweispaltig colour handling.
 */
export const getTuerkisDesignVariables = (design: CvDesignTokens): Record<string, string> => {
  const geometry = resolveTuerkisGeometry(design.spacing.pageMarginMm, design.spacing.columnGapMm);
  const type = tuerkisProfilDefaults.typography;
  return {
    "--tuerkis-margin-top": mm(geometry.top),
    "--tuerkis-margin-right": mm(geometry.right),
    "--tuerkis-margin-bottom": mm(geometry.bottom),
    "--tuerkis-margin-left": mm(geometry.left),
    "--tuerkis-column-gap": mm(geometry.gap),
    "--doc-body-size": `${design.typography.bodySizePt}pt`,
    "--doc-line-height": String(design.typography.lineHeight),
    "--tuerkis-name-size": `${design.typography.headingSizePt}pt`,
    "--tuerkis-profession-size": `${design.typography.subheadingSizePt}pt`,
    "--tuerkis-section-title-size": `${design.typography.sectionHeadingSizePt}pt`,
    "--tuerkis-entry-title-size": `${design.typography.entryHeadingSizePt}pt`,
    "--tuerkis-meta-size": `${type.metaSizePt}pt`,
    "--tuerkis-contact-size": `${type.contactSizePt}pt`,
    // The Hervorhebungsfarbe of the project technologies (the shared Zweispaltig accent is the grey of the rules here).
    "--tuerkis-accent": design.colors.accent,
  };
};
