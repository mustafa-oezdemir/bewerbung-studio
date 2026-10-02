import type { ApplicantProfile } from "./schema";
import { getResumeFullName, getResumeHeaderContactTexts } from "./resumePersonalData";

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
  "tabellarisch": {
    main: { layout: "grid", a: 2, b: 50, titleChars: 36, nameChars: 18, base: 40.65, row: 0.03, line: 4.43, title: 2.06, hasTitle: 2.84, name: 4.82, margin: 6.7 },
    mainPhoto: { layout: "flow", a: 100, b: 6, titleChars: 36, nameChars: 26, base: 38.36, row: 6.51, line: 0.0, title: 2.9, hasTitle: 4.59, name: 17.66, margin: 6.9 },
  },
  "zeitgenoessisch": {
    main: { layout: "flow", a: 240, b: 2, titleChars: 60, nameChars: 18, base: 48.33, row: 0.0, line: 0.0, title: 3.19, hasTitle: 0.53, name: 2.9, margin: 2.5 },
    side: { layout: "grid", a: 1, b: 32, titleChars: 52, nameChars: 26, base: 65.99, row: 3.51, line: 3.39, title: 2.31, hasTitle: 0.0, name: 6.49, margin: 4.6 },
    mainPhoto: { layout: "flow", a: 140, b: 6, titleChars: 70, nameChars: 26, base: 60.06, row: 0.0, line: 0.0, title: 4.88, hasTitle: 1.29, name: 10.26, margin: 5.1 },
    sidePhoto: { layout: "grid", a: 1, b: 16, titleChars: 52, nameChars: 26, base: 77.46, row: 3.86, line: 1.85, title: 3.55, hasTitle: 0.22, name: 11.83, margin: 7.0 },
  },
  "zweispaltig": {
    main: { layout: "grid", a: 2, b: 16, titleChars: 95, nameChars: 18, base: 32.07, row: 1.39, line: 1.67, title: 4.57, hasTitle: 5.76, name: 4.42, margin: 3.0 },
    side: { layout: "grid", a: 2, b: 16, titleChars: 95, nameChars: 18, base: 32.07, row: 1.39, line: 1.67, title: 4.57, hasTitle: 5.76, name: 4.42, margin: 3.0 },
    mainPhoto: { layout: "flow", a: 60, b: 2, titleChars: 52, nameChars: 14, base: 42.78, row: 3.07, line: 0.0, title: 2.76, hasTitle: 0.6, name: 2.46, margin: 7.3 },
    sidePhoto: { layout: "flow", a: 60, b: 2, titleChars: 52, nameChars: 14, base: 42.78, row: 3.07, line: 0.0, title: 2.76, hasTitle: 0.6, name: 2.46, margin: 7.3 },
  },
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
