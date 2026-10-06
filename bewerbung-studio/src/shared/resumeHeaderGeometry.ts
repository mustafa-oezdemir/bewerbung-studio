import type { ApplicantProfile } from "./schema";
import {
  formatResumeAddress,
  formatResumeBirth,
  getResumeFullName,
  getResumeHeaderContactTexts,
  getResumePersonalDetails,
} from "./resumePersonalData";
import { formatPhoneForDisplay } from "./contactPresentation";
import { getResumePhotoScale } from "./resumePhoto";
import { kreativDefaults } from "./cvTemplateDefaults/kreativ.defaults";
import { stilvollDefaults, stilvollDesign } from "./cvTemplateDefaults/stilvoll.defaults";

/**
 * How far down a Lebenslauf header pushes the page content, from the data it shows.
 *
 * A header grows with the user's contacts (count and length), a long Berufsbezeichnung and a long name; the page
 * planner's fixed `top1` was measured with a typical header. The models below were fitted on the real PDF output
 * (Electron, 46 synthetic profiles per template with and without a photo: 0–12 contacts, titles of 0–150 characters,
 * three name lengths): `base` + `row` per contact row + `line` per text line of the contact block + `title`/`name` per extra
 * wrapped line, plus `margin` = the largest under-estimate seen. Re-fit them when a header's CSS changes.
 * `main` is the top of the first section in the main column, `side` the first block of the sidebar (only where the
 * header or the contacts sit above it). A template draws contacts as a grid (`a` columns of `b` characters) or as a
 * flowing line (`a` characters per line, `b` characters of icon and gap per item).
 */
type HeaderModel = {
  layout: "grid" | "flow";
  a: number;
  b: number;
  titleChars: number;
  nameChars: number;
  base: number;
  row: number;
  line: number;
  title: number;
  hasTitle: number;
  name: number;
  margin: number;
};

const headerModels: Record<string, Partial<Record<"main" | "side" | "mainPhoto" | "sidePhoto", HeaderModel>>> = {
  "einspaltig": {
    main: { layout: "flow", a: 140, b: 6, titleChars: 95, nameChars: 18, base: 42.76, row: 6.31, line: 0.0, title: 4.17, hasTitle: 1.83, name: 2.33, margin: 8.4 },
    mainPhoto: { layout: "flow", a: 60, b: 2, titleChars: 36, nameChars: 26, base: 41.37, row: 3.29, line: 0.0, title: 2.09, hasTitle: 1.13, name: 13.51, margin: 8.5 },
  },
  "elegant": {
    main: { layout: "flow", a: 80, b: 4, titleChars: 60, nameChars: 18, base: 28.71, row: 5.35, line: 0.0, title: 5.44, hasTitle: 6.15, name: 8.56, margin: 2.1 },
    mainPhoto: { layout: "flow", a: 80, b: 4, titleChars: 60, nameChars: 18, base: 28.71, row: 5.35, line: 0.0, title: 5.44, hasTitle: 6.15, name: 8.56, margin: 2.1 },
  },
  "gepflegt": {
    main: { layout: "flow", a: 80, b: 4, titleChars: 44, nameChars: 26, base: 31.61, row: 5.45, line: 0.0, title: 5.2, hasTitle: 6.39, name: 17.49, margin: 2.9 },
    mainPhoto: { layout: "flow", a: 80, b: 4, titleChars: 44, nameChars: 26, base: 31.61, row: 5.45, line: 0.0, title: 5.2, hasTitle: 6.39, name: 17.49, margin: 2.9 },
  },
  "ivy-league": {
    main: { layout: "flow", a: 120, b: 2, titleChars: 95, nameChars: 26, base: 28.31, row: 4.11, line: 0.0, title: 3.44, hasTitle: 4.23, name: 4.57, margin: 3.6 },
    mainPhoto: { layout: "flow", a: 120, b: 2, titleChars: 95, nameChars: 26, base: 28.31, row: 4.11, line: 0.0, title: 3.44, hasTitle: 4.23, name: 4.57, margin: 3.6 },
  },
  "klassisch": {
    main: { layout: "flow", a: 140, b: 6, titleChars: 80, nameChars: 14, base: 41.24, row: 7.32, line: 0.0, title: 3.3, hasTitle: 2.85, name: 2.44, margin: 8.0 },
    mainPhoto: { layout: "flow", a: 140, b: 6, titleChars: 36, nameChars: 14, base: 40.23, row: 7.67, line: 0.0, title: 2.18, hasTitle: 0.93, name: 2.66, margin: 8.7 },
  },
  "kompakt": {
    main: { layout: "flow", a: 170, b: 9, titleChars: 36, nameChars: 18, base: 30.47, row: 0.04, line: 0.0, title: 0.73, hasTitle: 1.29, name: 3.36, margin: 2.0 },
    side: { layout: "grid", a: 1, b: 24, titleChars: 36, nameChars: 26, base: 37.86, row: 5.58, line: 1.46, title: 0.94, hasTitle: 2.29, name: 7.09, margin: 2.8 },
    mainPhoto: { layout: "grid", a: 1, b: 16, titleChars: 95, nameChars: 26, base: 30.55, row: 0.0, line: 0.0, title: 2.64, hasTitle: 2.12, name: 6.69, margin: 1.1 },
    sidePhoto: { layout: "grid", a: 1, b: 24, titleChars: 95, nameChars: 26, base: 37.99, row: 5.85, line: 1.3, title: 2.95, hasTitle: 3.27, name: 7.12, margin: 2.5 },
  },
  "kreativ": {
    main: { layout: "grid", a: 2, b: 20, titleChars: 95, nameChars: 14, base: 43.58, row: 0.2, line: 1.61, title: 5.13, hasTitle: 1.52, name: 1.95, margin: 6.8 },
    side: { layout: "grid", a: 2, b: 20, titleChars: 95, nameChars: 14, base: 43.58, row: 0.2, line: 1.61, title: 5.13, hasTitle: 1.52, name: 1.95, margin: 6.8 },
    mainPhoto: { layout: "flow", a: 80, b: 2, titleChars: 36, nameChars: 26, base: 43.61, row: 4.2, line: 0.0, title: 2.24, hasTitle: 0.8, name: 6.52, margin: 6.8 },
    sidePhoto: { layout: "flow", a: 80, b: 2, titleChars: 36, nameChars: 26, base: 43.61, row: 4.2, line: 0.0, title: 2.24, hasTitle: 0.8, name: 6.52, margin: 6.8 },
  },
  "modern": {
    main: { layout: "grid", a: 2, b: 50, titleChars: 95, nameChars: 14, base: 34.24, row: 1.97, line: 2.8, title: 3.98, hasTitle: 0.9, name: 3.35, margin: 5.0 },
    side: { layout: "grid", a: 2, b: 50, titleChars: 95, nameChars: 14, base: 34.24, row: 1.97, line: 2.8, title: 3.98, hasTitle: 0.9, name: 3.35, margin: 5.0 },
    mainPhoto: { layout: "grid", a: 1, b: 32, titleChars: 36, nameChars: 18, base: 36.52, row: 0.0, line: 2.19, title: 1.99, hasTitle: 0.0, name: 4.37, margin: 5.0 },
    sidePhoto: { layout: "grid", a: 1, b: 32, titleChars: 36, nameChars: 18, base: 36.52, row: 0.0, line: 2.19, title: 1.99, hasTitle: 0.0, name: 4.37, margin: 5.0 },
  },
  "pehlione_white": {
    main: { layout: "grid", a: 3, b: 16, titleChars: 44, nameChars: 18, base: 33.83, row: 0.0, line: 0.0, title: 4.94, hasTitle: 5.04, name: 10.21, margin: 2.3 },
    side: { layout: "grid", a: 1, b: 28, titleChars: 36, nameChars: 14, base: 63.75, row: 5.37, line: 3.25, title: 0.0, hasTitle: 0.0, name: 0.0, margin: 5.0 },
    mainPhoto: { layout: "grid", a: 3, b: 16, titleChars: 44, nameChars: 18, base: 33.83, row: 0.0, line: 0.0, title: 4.94, hasTitle: 5.04, name: 10.21, margin: 2.3 },
    sidePhoto: { layout: "grid", a: 1, b: 28, titleChars: 36, nameChars: 14, base: 63.75, row: 5.37, line: 3.25, title: 0.0, hasTitle: 0.0, name: 0.0, margin: 5.0 },
  },
  "pehlione_white_blue": {
    main: { layout: "flow", a: 170, b: 6, titleChars: 44, nameChars: 18, base: 31.71, row: 0.0, line: 0.0, title: 4.32, hasTitle: 7.51, name: 10.42, margin: 3.4 },
    side: { layout: "grid", a: 1, b: 28, titleChars: 36, nameChars: 14, base: 63.75, row: 5.37, line: 3.25, title: 0.0, hasTitle: 0.0, name: 0.0, margin: 5.0 },
    mainPhoto: { layout: "flow", a: 170, b: 6, titleChars: 44, nameChars: 18, base: 31.71, row: 0.0, line: 0.0, title: 4.32, hasTitle: 7.51, name: 10.42, margin: 3.4 },
    sidePhoto: { layout: "grid", a: 1, b: 28, titleChars: 36, nameChars: 14, base: 63.75, row: 5.37, line: 3.25, title: 0.0, hasTitle: 0.0, name: 0.0, margin: 5.0 },
  },
  "stilvoll": {
    main: { layout: "flow", a: 170, b: 9, titleChars: 95, nameChars: 18, base: 33.16, row: 4.77, line: 0.0, title: 4.59, hasTitle: 5.62, name: 4.01, margin: 4.6 },
    side: { layout: "flow", a: 170, b: 9, titleChars: 95, nameChars: 18, base: 33.16, row: 4.77, line: 0.0, title: 4.59, hasTitle: 5.62, name: 4.01, margin: 4.6 },
    mainPhoto: { layout: "flow", a: 140, b: 6, titleChars: 70, nameChars: 26, base: 37.25, row: 3.99, line: 0.0, title: 4.23, hasTitle: 4.18, name: 6.78, margin: 5.2 },
    sidePhoto: { layout: "flow", a: 140, b: 6, titleChars: 70, nameChars: 26, base: 37.25, row: 3.99, line: 0.0, title: 4.23, hasTitle: 4.18, name: 6.78, margin: 5.2 },
  },
  "zeitgenoessisch": {
    main: { layout: "flow", a: 240, b: 2, titleChars: 50, nameChars: 18, base: 45.5, row: 0, line: 0, title: 4.5, hasTitle: 0, name: 3, margin: 2 },
    side: { layout: "grid", a: 1, b: 25, titleChars: 45, nameChars: 26, base: 65, row: 4.7, line: 4.7, title: 3, hasTitle: 0, name: 7, margin: 3 },
    mainPhoto: { layout: "flow", a: 140, b: 6, titleChars: 50, nameChars: 26, base: 53, row: 0, line: 0, title: 5, hasTitle: 0, name: 8, margin: 2 },
    sidePhoto: { layout: "grid", a: 1, b: 16, titleChars: 45, nameChars: 26, base: 65, row: 4.7, line: 4.7, title: 3, hasTitle: 0, name: 8, margin: 3 },
  },
  "zweispaltig": {
    main: { layout: "grid", a: 2, b: 16, titleChars: 95, nameChars: 18, base: 32.07, row: 1.39, line: 1.67, title: 4.57, hasTitle: 5.76, name: 4.42, margin: 3.0 },
    side: { layout: "grid", a: 2, b: 16, titleChars: 95, nameChars: 18, base: 32.07, row: 1.39, line: 1.67, title: 4.57, hasTitle: 5.76, name: 4.42, margin: 3.0 },
    mainPhoto: { layout: "flow", a: 60, b: 2, titleChars: 52, nameChars: 14, base: 42.78, row: 3.07, line: 0.0, title: 2.76, hasTitle: 0.6, name: 2.46, margin: 7.3 },
    sidePhoto: { layout: "flow", a: 60, b: 2, titleChars: 52, nameChars: 14, base: 42.78, row: 3.07, line: 0.0, title: 2.76, hasTitle: 0.6, name: 2.46, margin: 7.3 },
  },
};

/**
 * Tabellarisch draws its contacts in a two-column grid (`.tabellarisch-header__contacts`: columns 1.15fr / 0.85fr,
 * 132 mm wide, with or without the photo) and places GitHub in column 1 and the Website in column 2 explicitly. Which
 * cell a contact lands in therefore depends on the contacts before it, and a contact that shares a row with another
 * adds no height: the generic list of texts cannot say that, a switch of one checkbox must only move the page plan when
 * it moves the real rows. This is the grid the template draws (the order of `TabellarischHeader.tsx` and of the PDF's
 * `tabellarischContacts`, with the values it prints: the full URLs, the address on one line), kept in step with both
 * by `tabellarischHeaderGeometry.test.tsx`.
 */
export type HeaderContact = { kind: string; text: string };

export const getTabellarischHeaderContacts = (profile: ApplicantProfile | undefined): HeaderContact[] =>
  [
    { kind: "phone", text: formatPhoneForDisplay(profile?.phone) },
    { kind: "email", text: profile?.email ?? "" },
    { kind: "linkedin", text: profile?.linkedin ?? "" },
    { kind: "location", text: formatResumeAddress(profile) },
    { kind: "github", text: profile?.github ?? "" },
    { kind: "website", text: profile?.portfolio ?? "" },
    { kind: "birth", text: formatResumeBirth(profile) },
    ...getResumePersonalDetails(profile).map((detail) => ({ kind: detail.kind as string, text: detail.href ? detail.value : detail.text })),
  ].filter((contact) => contact.text.trim());

/** Measured on the real PDF (`scripts/tabellarisch-header-calibration.mjs`, 172 headers): see `tabellarischContactRows`. */
const tabellarischGrid = {
  /** One text line of a contact (8.4 pt, line-height 1.2) and the gap between two rows. */
  line: 3.556,
  rowGap: 1.15,
  /**
   * How many characters of a contact fit on one line and how many go on every further line, by column and by the kind
   * of text (a URL breaks at its slashes and hyphens, an e-mail only where it must, an address at its spaces). The
   * values are the largest that never count fewer lines than the browser drew.
   */
  column1: { one: 44, per: 43.5 },
  column2: { url: { one: 28, per: 25 }, spaced: { one: 31, per: 27 }, plain: { one: 29, per: 28 } },
};

const tabellarischContactLines = (text: string, column: 1 | 2) => {
  const length = text.trim().length;
  const fit = column === 1
    ? tabellarischGrid.column1
    : text.includes("/") ? tabellarischGrid.column2.url : /\s/.test(text.trim()) ? tabellarischGrid.column2.spaced : tabellarischGrid.column2.plain;
  return length <= fit.one ? 1 : Math.ceil(length / fit.per);
};

/**
 * The rows of the contact grid, placed like CSS grid's sparse auto-placement does it: every contact takes the next
 * free cell, except GitHub (column 1) and the Website (column 2), which look for a free cell in their column from the
 * cursor on and start a new row when their column lies before the cursor's. Returns the text lines of every row.
 */
export const tabellarischContactRows = (contacts: readonly HeaderContact[]): number[] => {
  const rows: number[] = [];
  const taken = new Set<string>();
  let row = 1;
  let column = 1;
  for (const contact of contacts) {
    const fixed = contact.kind === "github" ? 1 : contact.kind === "website" ? 2 : 0;
    if (fixed) {
      if (fixed < column) row += 1;
      column = fixed;
      while (taken.has(`${row},${column}`)) row += 1;
    } else {
      while (taken.has(`${row},${column}`)) {
        column += 1;
        if (column > 2) {
          column = 1;
          row += 1;
        }
      }
    }
    taken.add(`${row},${column}`);
    rows[row - 1] = Math.max(rows[row - 1] ?? 0, tabellarischContactLines(contact.text, column as 1 | 2));
  }
  return Array.from(rows, (lines) => lines ?? 1);
};

/** Chromium's wrap of the name (25 pt, capitals) and of the Berufsbezeichnung (13.5 pt) per mm of the identity column. */
const tabellarischText = { nameCharsPerMm: 0.16, titleOneLinePerMm: 0.42, titleCharsPerMm: 0.4, nameLine: 8.82, titleLine: 5.475 };

/**
 * Where the first section of the main column starts under the Tabellarisch header (mm from the top of the sheet):
 * the page margin and padding above the name, the name and the Berufsbezeichnung with their own wraps, the contact
 * grid, and the section gap below. The header is at least as high as its minimum (30 mm) and as the photo.
 */
export const estimateTabellarischTop = (
  profile: ApplicantProfile,
  showContacts: boolean,
  withPhoto: boolean,
): { top: number; margin: number } => {
  const photoScale = withPhoto ? getResumePhotoScale(profile) : 1;
  // The photo takes a column of its own beside the identity (32 mm × scale and the 10 mm gap).
  const identityWidth = withPhoto ? 180 - 32 * photoScale - 10 : 180;
  const nameLines = Math.max(1, Math.ceil(getResumeFullName(profile).length / (identityWidth * tabellarischText.nameCharsPerMm)));
  const title = profile.title.trim().length;
  const titleLines = !title ? 0 : title <= identityWidth * tabellarischText.titleOneLinePerMm ? 1 : Math.ceil(title / (identityWidth * tabellarischText.titleCharsPerMm));
  const rows = showContacts ? tabellarischContactRows(getTabellarischHeaderContacts(profile)) : [];
  const contacts = rows.length
    ? 2.5 + rows.reduce((total, lines) => total + lines * tabellarischGrid.line, 0) + (rows.length - 1) * tabellarischGrid.rowGap
    : 0;
  const identity = 1 + nameLines * tabellarischText.nameLine + (title ? 2.3 + titleLines * tabellarischText.titleLine : 0) + contacts;
  const headerHeight = Math.max(identity, 30, withPhoto ? 30 * photoScale : 0);
  return { top: 15 + headerHeight + 6.3, margin: 1 };
};

const contactBlock = (lengths: readonly number[], model: HeaderModel) => {
  if (model.layout === "grid") {
    let rows = 0;
    let lines = 0;
    for (let index = 0; index < lengths.length; index += model.a) {
      rows += 1;
      lines += Math.max(...lengths.slice(index, index + model.a).map((length) => Math.max(1, Math.ceil(length / model.b))));
    }
    return { rows, lines };
  }
  let lines = 0;
  let used = 0;
  for (const length of lengths) {
    const width = length + model.b;
    if (!used || used + width > model.a) {
      lines += 1;
      used = width;
    } else used += width;
    while (used > model.a) {
      lines += 1;
      used -= model.a;
    }
  }
  return { rows: lines, lines };
};

/** Kreativ's full-width banner grows from the same inner width, font and contact grid as its renderer. */
export const estimateKreativHeaderTop = (
  profile: ApplicantProfile,
  showContacts: boolean,
  withPhoto: boolean,
  bodySizePt: number,
  lineHeight: number,
  marginShiftMm = 0,
): number => {
  const photoScale = withPhoto ? getResumePhotoScale(profile) : 1;
  const innerWidth = 210 - kreativDefaults.page.marginLeftMm - kreativDefaults.page.marginRightMm - 2 * marginShiftMm;
  const identityWidth = innerWidth - (withPhoto ? 28 * photoScale + 10 : 0);
  const lines = (length: number, width: number, fontMm: number, advance: number) =>
    Math.max(1, Math.ceil(length * fontMm * advance / Math.max(width, 12)));
  const name = getResumeFullName(profile);
  const nameHeight = lines(name.length, identityWidth, 23 * 25.4 / 72, 0.55) * 23 * 25.4 / 72;
  const titleHeight = profile.title.trim()
    ? 1.5 + lines(profile.title.trim().length, identityWidth, 11.5 * 25.4 / 72, 0.52) * 11.5 * 25.4 / 72 * lineHeight
    : 0;
  const contacts = showContacts ? getResumeHeaderContactTexts(profile) : [];
  const contactFontMm = bodySizePt * 0.88 * 25.4 / 72;
  // Address gets a full-width row, while other contacts occupy two equal cells.
  const location = formatResumeAddress(profile);
  const locationIndex = location ? contacts.indexOf(location) : -1;
  let contactRows = 0;
  let occupied = 0;
  contacts.forEach((_, index) => {
    if (index === locationIndex) {
      if (occupied) { contactRows += 1; occupied = 0; }
      contactRows += 1;
    } else {
      occupied += 1;
      if (occupied === 2) { contactRows += 1; occupied = 0; }
    }
  });
  if (occupied) contactRows += 1;
  const contactHeight = contacts.length
    ? 2.2 + contactRows * contactFontMm * lineHeight + Math.max(0, contactRows - 1)
    : 0;
  const contentHeight = 18 + nameHeight + titleHeight + contactHeight;
  const photoMinimum = kreativDefaults.layout.headerHeightMm + 28 * (photoScale - 1);
  return Math.max(photoMinimum, contentHeight) + kreativDefaults.layout.headerToContentGapMm + 1.5;
};

/** Stilvoll's flexible contact row and rounded photo share one growing header. */
export const estimateStilvollHeaderTop = (
  profile: ApplicantProfile,
  showContacts: boolean,
  withPhoto: boolean,
  bodySizePt: number,
  lineHeight: number,
  marginShiftMm = 0,
  nameSizePt = stilvollDesign.tokens.typography.headingSizePt,
  titleSizePt = stilvollDesign.tokens.typography.subheadingSizePt,
): number => {
  const photoScale = withPhoto ? getResumePhotoScale(profile) : 1;
  const innerWidth = 210 - stilvollDefaults.page.marginLeftMm - stilvollDefaults.page.marginRightMm - 2 * marginShiftMm;
  const identityWidth = innerWidth - (withPhoto ? 28 * photoScale + 10 : 0);
  const lines = (length: number, fontPt: number) => Math.max(1,
    Math.ceil(length * fontPt * 25.4 / 72 * .52 / Math.max(20, identityWidth)));
  const nameHeight = lines(getResumeFullName(profile).length, nameSizePt) * nameSizePt * 25.4 / 72;
  const titleHeight = profile.title.trim() ? 4.5 + lines(profile.title.trim().length, titleSizePt) * titleSizePt * 25.4 / 72 * lineHeight : 0;
  const contactFontMm = bodySizePt * .88 * 25.4 / 72;
  const topMargin = Math.max(10, stilvollDefaults.page.marginTopMm + marginShiftMm);
  const contacts = showContacts ? getResumeHeaderContactTexts(profile) : [];
  let rows = 0;
  let used = 0;
  for (const contact of contacts) {
    const width = contact.length * contactFontMm * .52 + 8;
    if (used && used + width > identityWidth) { rows += 1; used = 0; }
    rows += Math.max(0, Math.ceil(width / identityWidth) - 1);
    used = width % identityWidth || identityWidth;
  }
  if (used) rows += 1;
  const contactHeight = rows ? rows * contactFontMm * lineHeight + Math.max(0, rows - 1) : 0;
  const header = Math.max(stilvollDefaults.layout.headerHeightMm,
    topMargin + nameHeight + titleHeight + contactHeight,
    withPhoto ? topMargin + 26 * photoScale : 0);
  return header + stilvollDefaults.layout.headerToContentGapMm + 1;
};

/**
 * The point (mm from the top of the sheet) where the first section of `zone` starts under this profile's header, or
 * `undefined` for a template without a model. `measuredTop` is the template's own fixed geometry: a header the
 * model sees at or below it keeps it unchanged; a bigger one moves the content down, with the model's largest
 * under-estimate added in full once the header is clearly taller (10 mm) than the measured one.
 */
export const estimateResumeHeaderTop = (
  templateId: string | undefined,
  profile: ApplicantProfile | undefined,
  zone: "main" | "side",
  measuredTop: number,
  /** The "Persönliche Daten" are switched off: the header shows no contacts. */
  showContacts = true,
  /** A photo beside the name narrows the text: its own model. */
  withPhoto = false,
): number | undefined => {
  if (templateId === "tabellarisch") {
    if (zone !== "main" || !profile) return undefined;
    const { top, margin } = estimateTabellarischTop(profile, showContacts, withPhoto);
    if (top <= measuredTop) return measuredTop;
    return top + margin * Math.min(1, (top - measuredTop) / 10);
  }
  const models = templateId ? headerModels[templateId] : undefined;
  const model = withPhoto ? models?.[`${zone}Photo`] ?? models?.[zone] : models?.[zone];
  if (!model || !profile) return undefined;
  const texts = showContacts ? getResumeHeaderContactTexts(profile) : [];
  const contacts = contactBlock(texts.map((text) => text.length), model);
  const title = profile.title.trim().length;
  const titleLines = title ? Math.ceil(title / model.titleChars) : 0;
  const nameLines = Math.max(1, Math.ceil(getResumeFullName(profile).length / model.nameChars));
  const estimate =
    model.base +
    model.row * contacts.rows +
    model.line * contacts.lines +
    model.title * Math.max(0, titleLines - 1) +
    model.hasTitle * (title ? 1 : 0) +
    model.name * (nameLines - 1);
  if (estimate <= measuredTop) return measuredTop;
  return estimate + model.margin * Math.min(1, (estimate - measuredTop) / 10);
};
