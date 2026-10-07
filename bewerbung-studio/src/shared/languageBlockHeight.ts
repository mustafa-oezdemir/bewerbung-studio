import { languageGridSpan, wideLanguageLineChars, type LanguagePresentation } from "../features/languages/language-levels";

/**
 * Lebenslauf → Sprachen as the templates set it, for the page planner (millimetres at the template's own design, measured in
 * the PDF with scripts/language-height-qa.mjs + check-language-height-qa.cjs): the block's `head` (title), one grid `row` of
 * languages (name line plus the gap to the next), the description line behind the dots (`desc`), the pitch of one more
 * wrapped name line (`line`), the width of the dots with their gap (`dots`), the gap between grid columns and the width of
 * one character (`cw`). `cols`: languages per grid row (Ivy-League: up to three); `indent` / `maxWidth`: what the list takes
 * off the column.
 */
type LanguageRowModel = {
  cols: number | "ivy"; head: number; row: number; desc: number; line: number; dots: number; colGap: number; cw: number;
  indent?: number; maxWidth?: number;
  /** The list spans the whole column (no `maxWidth`) as soon as a line is longer than `wideLanguageLineChars`. */
  wideWhenLong?: boolean;
};

const languageRowModels: Record<string, LanguageRowModel> = {
  einspaltig: { cols: 3, head: 5.95, row: 6.69, desc: 3.93, line: 3.68, dots: 24.8, colGap: 8, cw: 1.63 },
  elegant: { cols: 1, head: 5.86, row: 6.95, desc: 3.51, line: 3.95, dots: 14.8, colGap: 0, cw: 1.37 },
  gepflegt: { cols: 1, head: 9.86, row: 7.04, desc: 5.04, line: 5.04, dots: 22.5, colGap: 0, cw: 2.3 },
  "ivy-league": { cols: "ivy", head: 6.21, row: 6.94, desc: 3.51, line: 3.95, dots: 19.6, colGap: 8, cw: 1.43 },
  kompakt: { cols: 2, head: 3.7, row: 5.96, desc: 3.51, line: 2.96, dots: 17.7, colGap: 8, cw: 1.44 },
  kreativ: { cols: 1, head: 7.22, row: 6.57, desc: 3.51, line: 3.57, dots: 28, colGap: 0, cw: 1.51 },
  modern: { cols: 1, head: 5.15, row: 6.26, desc: 3.51, line: 3.76, dots: 23.3, colGap: 0, cw: 1.43 },
  stilvoll: { cols: 1, head: 4.55, row: 6.22, desc: 3.51, line: 3.22, dots: 14, colGap: 0, cw: 1.48 },
  zeitgenoessisch: { cols: 1, head: 6.49, row: 6.57, desc: 3.51, line: 3.57, dots: 13.1, colGap: 0, cw: 1.63 },
  zweispaltig: { cols: 1, head: 6.54, row: 6.06, desc: 3.52, line: 3.57, dots: 22, colGap: 0, cw: 1.51 },
  // Klassisch (11 pt, measured 2026-10-07): heading 5.93 + 2.5 mm, rows of name (4.85) + 1.5 mm row gap, description 0.6 + 3.82 mm.
  klassisch: { cols: 2, head: 6.93, row: 6.35, desc: 4.42, line: 4.85, dots: 20.2, colGap: 14, cw: 2.0, wideWhenLong: true },
  tabellarisch: { cols: 1, head: 8.05, row: 5.47, desc: 3.79, line: 5.47, dots: 23, colGap: 3, cw: 1.47 },
  pehlione_white: { cols: 1, head: 8.65, row: 4.79, desc: 3.5, line: 3.44, dots: 18, colGap: 0, cw: 1.32, indent: 6.5 },
  pehlione_white_blue: { cols: 1, head: 9.65, row: 4.79, desc: 3.5, line: 3.44, dots: 18, colGap: 0, cw: 1.32, indent: 4 },
};

/**
 * Tabellarisch sets its languages as wrapping lines of bulleted items in the right half of the additional sections. An item
 * with dots is name (+ level), dots (fixed width) and – under them – the description; a line that holds a described item is taller.
 */
const TABELLARISCH_LANGUAGES = {
  head: 8.05, line: 5.47, descExtra: 3.79, itemGap: 6, columnGap: 12,
  cw: 1.47, bullet: 3.9,
  dotted: { nameCw: 1.55, fixed: 23, descCw: 1.28, descFixed: 3.8 },
};

export type LanguageBlockMeasure = {
  /** Width of the column the block stands in (mm). */
  column: number;
  /** The design's font scale and the factor that raises line boxes with it (the planner's `scale.font` / `scale.textHeight`). */
  font: number;
  textHeight: number;
  /** The same resolved grid count used by the preview and PDF. */
  columns?: number;
  zone?: "main" | "sidebar";
};

/**
 * Height of the languages block of a template in the visual layout, from what is actually printed (the shared
 * `resolveLanguagePresentation` result of every language): a description line only where the Beschreibung is shown behind
 * the dots, no dot row where Punkte is off, longer lines ("Deutsch – C1 · Verhandlungssicher") that wrap in a narrow
 * column. `undefined` for a template without a model.
 */
export const languageBlockHeight = (templateId: string, rows: readonly LanguagePresentation[], measure: LanguageBlockMeasure): number | undefined => {
  if (!rows.length) return 0;
  const { font, textHeight } = measure;
  if (templateId === "tabellarisch" && measure.columns === undefined) {
    const { head, line, descExtra, itemGap, columnGap, cw, bullet, dotted } = TABELLARISCH_LANGUAGES;
    const room = (measure.column - columnGap) / 2;
    let used = 0;
    let height = head;
    let lineHeight = 0;
    for (const row of rows) {
      const width = row.showDots
        ? Math.max(row.primaryText.length * dotted.nameCw * font + dotted.fixed, row.secondaryText ? row.secondaryText.length * dotted.descCw * font + dotted.descFixed : 0)
        : row.primaryText.length * cw * font + bullet;
      const itemHeight = line + (row.secondaryText ? descExtra : 0);
      if (used && used + itemGap + width > room) { height += lineHeight; lineHeight = itemHeight; used = width; } else {
        used += (used ? itemGap : 0) + width;
        lineHeight = Math.max(lineHeight, itemHeight);
      }
    }
    return (height + lineHeight) * textHeight;
  }
  const model = languageRowModels[templateId];
  if (!model) return undefined;
  const wide = model.wideWhenLong && rows.some((row) => row.primaryText.length > wideLanguageLineChars);
  const column = measure.columns === undefined
    ? Math.min(measure.column - (model.indent ?? 0), wide ? Infinity : model.maxWidth ?? Infinity)
    : measure.column;
  const cols = measure.columns ?? (model.cols === "ivy" ? Math.min(3, rows.length) : model.cols);
  const cell = Math.max(8, (column - (measure.columns === undefined ? model.colGap : 3) * (cols - 1)) / cols);
  let total = model.head;
  if (measure.columns !== undefined) {
    let used = 0;
    let tallest = 0;
    for (const row of rows) {
      const span = languageGridSpan(row, cols, measure.zone ?? "main");
      if (used && used + span > cols) { total += tallest; used = 0; tallest = 0; }
      // A single column leaves about 20px at its right edge and between the label and the right-aligned dots.
      const width = Math.max(8, cell * span + 3 * (span - 1) - (cols === 1 ? 5.3 : 0));
      const primaryLines = Math.max(1, Math.ceil(row.primaryText.length * model.cw * font / width));
      const dotLines = row.showDots && row.primaryText.length * model.cw * font + model.dots + (cols === 1 ? 5.3 : 1.5) > width
        ? Math.ceil(model.dots / width) : 0;
      const descriptionCharWidth = width < 28 ? 1.15 : 0.82;
      const descriptionLines = row.secondaryText
        ? Math.max(1, Math.ceil(row.secondaryText.length * model.cw * descriptionCharWidth * font / width)) : 0;
      const height = model.row + (primaryLines - 1) * model.line + dotLines * 3.2
        + (descriptionLines ? model.desc + (descriptionLines - 1) * model.line * 0.85 : 0);
      tallest = Math.max(tallest, height);
      used += span;
    }
    return (total + tallest) * textHeight;
  }
  for (let first = 0; first < rows.length; first += cols) {
    const group = rows.slice(first, first + cols);
    const wrapped = Math.max(...group.map((row) => {
      const room = Math.max(cell - (measure.columns === undefined && row.showDots ? model.dots : 0), 8);
      return Math.max(1, Math.ceil((row.primaryText.length * model.cw * font) / room)) - 1;
    }));
    // The description is set smaller than the name: a long one ("Annähernd muttersprachlich") still fits one line.
    const descriptionCharWidth = measure.columns !== undefined && cell < 28 ? 1.15 : 0.82;
    const descLines = Math.max(0, ...group.map((row) => (row.secondaryText ? Math.max(1, Math.ceil((row.secondaryText.length * model.cw * descriptionCharWidth * font) / cell)) : 0)));
    // The dots share the name row when both fit. In a narrow explicit cell they wrap below it,
    // while the description always starts after that row.
    const dotLines = measure.columns === undefined ? 0 : Math.max(0, ...group.map((row) =>
      row.showDots && row.primaryText.length * model.cw * font + model.dots + 1.5 > cell
        ? Math.ceil(model.dots / cell) : 0));
    total += model.row + wrapped * model.line + dotLines * 3.2 + (descLines ? model.desc + (descLines - 1) * model.line * 0.85 : 0);
  }
  return total * textHeight;
};
