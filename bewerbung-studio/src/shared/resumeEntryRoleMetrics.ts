import { resumeTextRoles, resumeTextRoleTokens, type ResumeTextRole } from "./resumeTextRoles";
import type { CvDesignTokens } from "./cvDesignSchema";

/** Points to millimetres. */
const PT_TO_MM = 25.4 / 72;

/** A line of an entry head: one role, or roles set inline in one line (the line is as tall as the largest of them). */
export type EntryHeadLine = ResumeTextRole | readonly ResumeTextRole[];
/**
 * The head of a career entry as a template draws it: rows from top to bottom, the cells of a row side by side, the lines of
 * a cell from top to bottom, and the line height of every role as a share of its size (measured on the PDF).
 */
export type EntryHeadModel = {
  rows: readonly (readonly (readonly EntryHeadLine[])[])[];
  lineRatio: Partial<Record<ResumeTextRole, number>>;
  /** The cells beside the first one have a width of their own (a grid column), so a larger text there does not narrow it. */
  fixedCells?: boolean;
  /** Roles set inline in a line of the template's own size: a smaller one keeps that line as tall as before. */
  inline?: readonly ResumeTextRole[];
};

/** Title beside the period, organisation beside the place: the head of most templates. */
export const sideBySideEntryHead = (lineRatio: Partial<Record<ResumeTextRole, number>>): EntryHeadModel => ({
  rows: [[["entry-title"], ["period"]], [["organization"], ["location"]]],
  lineRatio,
});

/** The sizes (pt) of the entry roles: the template's own and the ones the user chose (Lebenslauf-Design → Typografie). */
export type EntryRoleSizes = {
  native: Record<ResumeTextRole, number>;
  chosen: Partial<Record<ResumeTextRole, number>>;
};

/** The chosen role sizes of a document (only what its overrides name), or `undefined` when it names none. */
export const chosenEntryRoleSizes = (
  typography: Partial<CvDesignTokens["typography"]> | undefined,
): Partial<Record<ResumeTextRole, number>> | undefined => {
  const chosen = Object.fromEntries(resumeTextRoles.flatMap((role) => {
    const value = typography?.[resumeTextRoleTokens[role].size];
    return typeof value === "number" ? [[role, value]] : [];
  })) as Partial<Record<ResumeTextRole, number>>;
  return Object.keys(chosen).length ? chosen : undefined;
};

export const nativeEntryRoleSizes = (typography: CvDesignTokens["typography"]): Record<ResumeTextRole, number> =>
  Object.fromEntries(resumeTextRoles.map((role) => [role, typography[resumeTextRoleTokens[role].size] as number])) as Record<ResumeTextRole, number>;

/** How many lines a text of `fontMm` takes in `widthMm`. */
export type LineCounter = (text: string, widthMm: number, fontMm: number, role: ResumeTextRole) => number;
/** The width (mm) a role may wrap in when the roles have the sizes `sizeOf` (pt); `undefined`: it never wraps. */
export type HeadWidth = (role: ResumeTextRole, sizeOf: (role: ResumeTextRole) => number) => number | undefined;

/** The roles in the other cells of the row a role stands in: what stands beside it. */
export const rolesBeside = (model: EntryHeadModel, role: ResumeTextRole): ResumeTextRole[] => {
  for (const row of model.rows) {
    const at = row.findIndex((cell) => cell.flat().includes(role));
    if (at >= 0) return row.filter((_, index) => index !== at).flat(2) as ResumeTextRole[];
  }
  return [];
};

/**
 * How much taller (or shorter) the head of one entry becomes with the chosen role sizes: the head with them less the head
 * with the template's sizes, every line wrapped at its own size. Zero while no role of the head has a size of its own, so
 * a document without such a choice is planned exactly as before.
 */
export const entryHeadDelta = (
  model: EntryHeadModel,
  sizes: EntryRoleSizes | undefined,
  texts: Partial<Record<ResumeTextRole, string>>,
  width: HeadWidth,
  lines: LineCounter,
): number => {
  if (!sizes) return 0;
  const roles = model.rows.flat(2).flat() as ResumeTextRole[];
  if (!roles.some((role) => sizes.chosen[role] !== undefined)) return 0;
  const head = (size: (role: ResumeTextRole) => number) => model.rows.reduce((total, row) => total + Math.max(0, ...row.map((cell) =>
    cell.reduce((height, line) => {
      const members = (typeof line === "string" ? [line] : [...line]).filter((role) => texts[role]?.trim());
      if (!members.length) return height;
      const strut = (role: ResumeTextRole) => model.inline?.includes(role) ? sizes.native[role] : 0;
      const pitch = Math.max(...members.map((role) => Math.max(size(role), strut(role)) * PT_TO_MM * (model.lineRatio[role] ?? 1.2)));
      const fontMm = Math.max(...members.map((role) => size(role) * PT_TO_MM));
      const text = members.map((role) => texts[role]!.trim()).join(" · ");
      // An inline line wraps in the room of its leading role (the organisation a place follows).
      const room = width(members[0], size) ?? Infinity;
      return height + Math.max(1, Number.isFinite(room) ? lines(text, Math.max(room, 12), fontMm, members[0]) : 1) * pitch;
    }, 0))), 0);
  return head((role) => sizes.chosen[role] ?? sizes.native[role]) - head((role) => sizes.native[role]);
};

/**
 * The same for a text of a Projekte / Hobbys entry that stands on lines of its own (title, technologies, description,
 * the organisation line, the place and period line): its height at the chosen size less its height at the size the
 * template draws it in (`drawn`), at the line height `lineRatio`.
 */
export const roleTextDelta = (
  sizes: EntryRoleSizes | undefined,
  roles: readonly ResumeTextRole[],
  text: string,
  widthMm: number,
  lineRatio: number,
  lines: (text: string, widthMm: number, fontMm: number) => number,
  drawn: Partial<Record<ResumeTextRole, number>> = {},
): number => {
  if (!sizes || !text.trim() || !roles.some((role) => sizes.chosen[role] !== undefined)) return 0;
  const native = Math.max(...roles.map((role) => drawn[role] ?? sizes.native[role]));
  const chosen = Math.max(...roles.map((role) => sizes.chosen[role] ?? drawn[role] ?? sizes.native[role]));
  const height = (pt: number) => lines(text, widthMm, pt * PT_TO_MM) * pt * PT_TO_MM * lineRatio;
  return height(chosen) - height(native);
};
