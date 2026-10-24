import type { CvDesignTokens } from "./cvDesignSchema";
import { resolveEinspaltigGeometry } from "./einspaltigDesign";
import { resolveKlassischGeometry } from "./klassischDesign";
import { resolveTuerkisGeometry } from "./tuerkisProfilDesign";
import { resolveKompaktGeometry } from "./kompaktDesign";
import { resolveKreativSideMargins } from "./kreativDesign";
import { resolveStilvollSideMargins } from "./stilvollDesign";
import { resolveZeitgenoessischSideMargins } from "./zeitgenoessischDesign";
import { resolveTemplateId } from "./templates";
import { pehlioneWhiteBlueDefaults } from "./cvTemplateDefaults/pehlione.defaults";

export type DocumentSideMargins = { leftMm: number; rightMm: number };

/** Pehlione's main column right padding on the first page (`.pehlione-main` / `.pehlione-pdf-main`). */
const pehlioneMainRightMm = 10;

/**
 * The left and right page margin of the selected Lebenslauf (sheet edge to text), exactly as its template draws it
 * with the chosen Seitenränder. Deckblatt, Anschreiben and Motivationsschreiben take these two values, so every
 * document of a Bewerbungsmappe shares the Lebenslauf's left and right margin; top and bottom stay each document's own.
 */
export const resolveDocumentSideMargins = (
  templateId: string,
  spacing: Pick<CvDesignTokens["spacing"], "pageMarginMm" | "columnGapMm">,
): DocumentSideMargins => {
  const margin = spacing.pageMarginMm;
  const pair = (left: number, right: number) => ({ leftMm: Math.round(left * 100) / 100, rightMm: Math.round(right * 100) / 100 });
  switch (resolveTemplateId(templateId)) {
    case "einspaltig": {
      const geometry = resolveEinspaltigGeometry(margin);
      return pair(geometry.left, geometry.right);
    }
    case "klassisch": {
      const geometry = resolveKlassischGeometry(margin);
      return pair(geometry.left, geometry.right);
    }
    case "tuerkis-profil": {
      const geometry = resolveTuerkisGeometry(margin, spacing.columnGapMm);
      return pair(geometry.left, geometry.right);
    }
    case "kompakt": {
      const geometry = resolveKompaktGeometry(margin, spacing.columnGapMm);
      return pair(geometry.left, geometry.right);
    }
    case "kreativ": {
      const sides = resolveKreativSideMargins(margin);
      return pair(sides.left, sides.right);
    }
    case "stilvoll": {
      const sides = resolveStilvollSideMargins(margin);
      return pair(sides.left, sides.right);
    }
    case "zeitgenoessisch": {
      const sides = resolveZeitgenoessischSideMargins(margin);
      return pair(sides.left, sides.right);
    }
    case "pehlione_white":
    case "pehlione_white_blue":
      // The sidebar text starts at Seitenränder (native 7 mm); the main column keeps its native 10 mm right padding
      // (`.pehlione-main` on page 1), moved by the same shift.
      return pair(margin, margin + pehlioneMainRightMm - pehlioneWhiteBlueDefaults.layout.sidebarMarginMm);
    // Gepflegt, Elegant, Zweispaltig, Modern, Tabellarisch and Ivy League: Seitenränder is the same on both sides (the
    // outer text edge of the sidebar and of the main column).
    default:
      return pair(margin, margin);
  }
};

/** The two margins as the CSS variables Deckblatt, Anschreiben and Motivationsschreiben read. */
export const documentSideMarginVariables = (margins: DocumentSideMargins): Record<string, string> => ({
  "--side-left": `${margins.leftMm}mm`,
  "--side-right": `${margins.rightMm}mm`,
});

/** One line of the letters' Fließtext: 11 pt with one and a half line spacing (karrierebibel), in mm. */
export const documentTextLineMm = (11 * 1.5 * 25.4) / 72;

/**
 * Space above the Briefkopf of the Anschreiben and the Motivationsschreiben, the same in every template: 20 mm less
 * one text line (user 2026-10-15), 14.2 mm.
 */
export const documentTopMarginMm = Math.round((20 - documentTextLineMm) * 10) / 10;

/**
 * The Anschreiben starts as far from the top edge as the Motivationsschreiben, whatever the template letter style says.
 * Kreativ is the exception: its coloured band begins at the edge by design and carries the Briefkopf inside it.
 */
export const letterTopMarginCss =
  `.page.letter-page>.letter-content:not(.kreativ-letter .letter-content),.document-paper.document-anschreiben:not(.kreativ-letter)>.letter-preview{padding-top:${documentTopMarginMm}mm!important}`;

/**
 * The Anschreiben's text area (PDF `.letter-content`, preview `.letter-preview`) takes the Lebenslauf's left and right
 * margin over every template letter style; its top and bottom stay the letter's own. One rule for both outputs.
 */
export const letterSideMarginCss =
  ".page.letter-page>.letter-content,.document-paper.document-anschreiben>.letter-preview{padding-left:var(--side-left)!important;padding-right:var(--side-right)!important}";
