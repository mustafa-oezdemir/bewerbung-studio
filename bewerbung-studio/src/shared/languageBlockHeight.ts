import { languageDotsFollowName, languageGridSpan, wideLanguageLineChars, type LanguagePresentation } from "../features/languages/language-levels";
import { wrappedLines } from "./textMetrics";

/**
 * Lebenslauf → Sprachen as the templates set it, for the page planner (millimetres at the template's own design, measured in
 * the PDF with scripts/language-height-qa.mjs + check-language-height-qa.cjs): the block's `head` (title), one grid `row` of
 * languages (name line plus the gap to the next), the description line behind the dots (`desc`), the pitch of one more
 * wrapped name line (`line`), the width of the dots with their gap (`dots`), the gap between grid columns and the width of
 * one character (`cw`). `cols`: languages per grid row (Ivy-League: up to three); `indent` / `maxWidth`: what the list takes
 * off the column. `meter`: what follows the name in a row that shows only the dots (`Deutsch – dots`, measured 2026-11-10) –
 * the space, the dash, its gap and the template's six dots; they wrap as one piece. `gridLine`: the line they take below
 * the name then, where the name line of the language grid is taller than `line`.
 */
type LanguageRowModel = {
  cols: number | "ivy"; head: number; row: number; desc: number; line: number; dots: number; colGap: number; cw: number;
  meter: number; gridLine?: number;
  indent?: number; maxWidth?: number;
  /** The list spans the whole column (no `maxWidth`) as soon as a line is longer than `wideLanguageLineChars`. */
  wideWhenLong?: boolean;
};

const languageRowModels: Record<string, LanguageRowModel> = {
  // Einspaltig (11 pt, measured 2026-10-07): ruled title 7.19 + 2.5 mm, rows of name (4.85) + 1.5 mm row gap, description 0.6 + 3.82 mm.
  einspaltig: { cols: 3, head: 8.19, row: 6.35, desc: 4.42, line: 4.85, dots: 20.2, colGap: 8, cw: 2.0, meter: 21.7 },
  // Elegant (10.5 pt, measured 2026-10-13 in its sidebar): title 9.48 mm, rows of name (4.63) 2 mm apart (head = title − one gap).
  elegant: { cols: 1, head: 7.48, row: 6.63, desc: 3.51, line: 3.95, dots: 14.8, colGap: 0, cw: 1.37, meter: 11, gridLine: 4.64 },
  gepflegt: { cols: 1, head: 9.86, row: 7.04, desc: 5.04, line: 5.04, dots: 22.5, colGap: 0, cw: 2.3, meter: 22.7 },
  "ivy-league": { cols: "ivy", head: 6.21, row: 6.94, desc: 3.51, line: 3.95, dots: 19.6, colGap: 8, cw: 1.43, meter: 19.4 },
  kompakt: { cols: 2, head: 3.7, row: 5.96, desc: 3.51, line: 2.96, dots: 17.7, colGap: 8, cw: 1.44, meter: 24.8, gridLine: 4.36 },
  kreativ: { cols: 1, head: 7.22, row: 6.57, desc: 3.51, line: 3.57, dots: 28, colGap: 0, cw: 1.51, meter: 28.4, gridLine: 4.67 },
  modern: { cols: 1, head: 5.15, row: 6.26, desc: 3.51, line: 3.76, dots: 23.3, colGap: 0, cw: 1.43, meter: 20.6 },
  stilvoll: { cols: 1, head: 4.55, row: 6.22, desc: 3.51, line: 3.22, dots: 14, colGap: 0, cw: 1.48, meter: 18.2, gridLine: 4.63 },
  zeitgenoessisch: { cols: 1, head: 6.49, row: 6.57, desc: 3.51, line: 3.57, dots: 13.1, colGap: 0, cw: 1.63, meter: 15.5, gridLine: 4.67 },
  zweispaltig: { cols: 1, head: 6.54, row: 6.06, desc: 3.52, line: 3.57, dots: 22, colGap: 0, cw: 1.51, meter: 22.3, gridLine: 4.41 },
  // Türkis Profil (11 pt, measured 2026-10-24 in its left column): ruled title 6.33 + 2.5 mm, rows of name (4.85) 2 mm apart,
  // description and wrapped lines one text line (4.85 mm).
  "tuerkis-profil": { cols: 1, head: 6.83, row: 6.85, desc: 4.85, line: 4.85, dots: 22, colGap: 0, cw: 1.66, meter: 22.5 },
  // Klassisch (11 pt, measured 2026-10-07): heading 5.93 + 2.5 mm, rows of name (4.85) + 1.5 mm row gap, description 0.6 + 3.82 mm.
  klassisch: { cols: 2, head: 6.93, row: 6.35, desc: 4.42, line: 4.85, dots: 20.2, colGap: 14, cw: 2.0, meter: 20.7, wideWhenLong: true },
  tabellarisch: { cols: 1, head: 8.05, row: 5.47, desc: 3.79, line: 5.47, dots: 23, colGap: 3, cw: 1.47, meter: 20.2 },
  pehlione_white: { cols: 1, head: 8.65, row: 4.79, desc: 3.5, line: 3.44, dots: 18, colGap: 0, cw: 1.32, meter: 17.2, gridLine: 4.06, indent: 6.5 },
  pehlione_white_blue: { cols: 1, head: 9.65, row: 4.79, desc: 3.5, line: 3.44, dots: 18, colGap: 0, cw: 1.32, meter: 17.2, gridLine: 4.06, indent: 4 },
};

/** The shared managed grid's heading, one text line and one description line, in mm. Measured in Chromium with
 * scripts/language-height-qa.mjs after the automatic main/sidebar grid was introduced. Its row gap is always 2 mm. */
const managedGridRows: Record<string, { head: number; line: number; description: number; textScale?: number; dotLine?: number; dotRoomSlack?: number }> = {
  einspaltig: { head: 9.62, line: 4.85, description: 4.42 },
  elegant: { head: 9.47, line: 4.64, description: 4.60, textScale: 2.36 },
  gepflegt: { head: 11.86, line: 5.04, description: 5.04, textScale: 1.7 },
  "ivy-league": { head: 9.19, line: 3.71, description: 3.52 },
  kompakt: { head: 8.85, line: 4.36, description: 3.58, textScale: 2.36 },
  kreativ: { head: 10.23, line: 4.67, description: 4.70, textScale: 2.1 },
  modern: { head: 7.65, line: 3.70, description: 3.51 },
  stilvoll: { head: 9.05, line: 4.63, description: 5.23, textScale: 2.36, dotLine: 2.40, dotRoomSlack: 2 },
  zeitgenoessisch: { head: 9.49, line: 4.67, description: 4.71, dotLine: 2.2 },
  zweispaltig: { head: 9.03, line: 4.41, description: 4.07, textScale: 2.36 },
  "tuerkis-profil": { head: 8.83, line: 4.85, description: 4.42, textScale: 2.36 },
  klassisch: { head: 8.43, line: 4.85, description: 4.42 },
  tabellarisch: { head: 9.05, line: 4.06, description: 3.79, textScale: 2.36 },
  pehlione_white: { head: 10.00, line: 4.06, description: 3.79, textScale: 2.60 },
  pehlione_white_blue: { head: 11.00, line: 4.06, description: 3.79, textScale: 2.60 },
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
    const grid = managedGridRows[templateId];
    const line = grid?.line ?? model.gridLine ?? model.line;
    total = grid?.head ?? model.head;
    let used = 0;
    let tallest = 0;
    for (const row of rows) {
      const span = languageGridSpan(row, cols, measure.zone ?? "main");
      if (used && used + span > cols) { total += tallest + 2; used = 0; tallest = 0; }
      // A single column leaves about 20px at its right edge and between the label and the right-aligned dots.
      const width = Math.max(8, cell * span + 3 * (span - 1) - (cols === 1 ? 5.3 : 0));
      if (languageDotsFollowName(row)) {
        // Only the dots: dash and dots continue the name's line and move to the next one together when they do not fit
        // (a name that already wraps may fill its last line). In a cell narrower than they are, the dots wrap below the dash.
        const nameWidth = row.name.length * model.cw * font;
        const meter = model.meter * Math.max(1, font);
        const nameLines = Math.max(1, wrappedLines(row.name, width, model.cw * 2 * font, 700));
        const lines = nameLines + (nameLines > 1 || nameWidth + meter > width ? 1 : 0);
        const dotRows = meter > width ? Math.max(0, Math.ceil(model.dots / width) - 1) : 0;
        tallest = Math.max(tallest, lines * line + dotRows * line);
        used += span;
        continue;
      }
      const primaryLines = Math.max(1, wrappedLines(row.primaryText, width, model.cw * (row.detail ? grid?.textScale ?? 2 : 2) * font, 700));
      const dotsWidth = templateId === "kompakt" ? Math.max(model.dots, model.meter) : model.dots;
      const dotsShareLine = font <= 1 && row.primaryText.length <= 18 && ((templateId === "gepflegt" && width >= 59)
        || ((templateId === "einspaltig" || templateId === "klassisch") && cols === 3 && width >= 50));
      const dotLines = row.showDots && !dotsShareLine && primaryLines === 1 && row.primaryText.length * model.cw * font + dotsWidth + (cols === 1 ? 5.3 : 1.5) + (grid?.dotRoomSlack ?? 0) > width
        ? Math.ceil(dotsWidth / width) : 0;
      const descriptionCharWidth = templateId === "stilvoll" ? 1.2 : width < 28 || templateId === "kompakt" ? 1.15 : 0.82;
      const descriptionLines = row.secondaryText
        ? Math.max(1, Math.ceil(row.secondaryText.length * model.cw * descriptionCharWidth * font / width)) : 0;
      const height = primaryLines * line + dotLines * (grid?.dotLine ?? line)
        + (descriptionLines ? (grid?.description ?? model.desc) + (descriptionLines - 1) * line : 0);
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
