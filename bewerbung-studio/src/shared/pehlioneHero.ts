import { pehlioneGear } from "./pehlioneBlueprint";

/**
 * The blue hero at the top of the Pehlione sidebar holds the profile photo and the artwork behind it
 * (a gear in White, circles and lines in White Blue). Photo and artwork are laid out from the *centre*
 * of the hero instead of from fixed `top`/`left` offsets, so they stay concentric and centred in the
 * blue area for every sidebar width. The React preview (`.pehlione-hero`) and the PDF (`.pehlione-pdf-hero`)
 * take their geometry from this one block.
 */

/** Millimetres per artwork unit: the whole height of the drawing fits the 46 mm hero with half a millimetre to spare. */
const gearUnitMm = 0.285;
/** The photo fills the gear up to its inner ring (radius 42 of 45 units); White Blue keeps its 28 mm photo. */
const photoMm = { pehlione_white: Math.round(84 * gearUnitMm * 10) / 10, pehlione_white_blue: 28 } as const;

const surface = (template: keyof typeof photoMm, preview: string, pdf: string) =>
  `.pehlione-resume[data-template="${template}"] ${preview},\n.cv-sheet[data-template="${template}"] ${pdf}`;
/**
 * The profile's Fotogröße (`--resume-photo-scale`, unset = 1 = the native hero) scales the photo, the artwork
 * behind it and the hero itself together, so photo and decoration stay concentric at every size.
 */
const scaled = (mm: number) => `calc(${mm}mm * var(--resume-photo-scale,1))`;
const centred = (size: string) => `left:calc(50% - ${size} / 2);top:calc(50% - ${size} / 2)`;

const { viewBox, cx, cy } = pehlioneGear;

export const pehlioneHeroCss = `
${surface("pehlione_white", ".pehlione-hero", ".pehlione-pdf-hero")}{--pehlione-hero-photo:${scaled(photoMm.pehlione_white)};--pehlione-gear-unit:${scaled(gearUnitMm)};height:${scaled(46)}}
${surface("pehlione_white_blue", ".pehlione-hero", ".pehlione-pdf-hero")}{--pehlione-hero-photo:${scaled(photoMm.pehlione_white_blue)};height:${scaled(46)}}
${surface("pehlione_white", ".pehlione-blueprint svg", ".pehlione-pdf-blueprint svg")}{position:absolute;left:calc(50% - ${cx} * var(--pehlione-gear-unit));top:calc(50% - ${cy} * var(--pehlione-gear-unit));width:calc(${viewBox.width} * var(--pehlione-gear-unit));height:calc(${viewBox.height} * var(--pehlione-gear-unit))}
${["pehlione_white", "pehlione_white_blue"].map((template) => surface(template as keyof typeof photoMm, ".pehlione-hero__photo", ".pehlione-pdf-photo")).join(",\n")}{position:absolute;z-index:1;box-sizing:border-box;${centred("var(--pehlione-hero-photo)")};width:var(--pehlione-hero-photo);height:var(--pehlione-hero-photo);border:.25mm solid #d9ebff;border-radius:50%;object-fit:cover;object-position:center 30%}
${surface("pehlione_white_blue", ".pehlione-hero:before", ".pehlione-pdf-hero:before")}{${centred("var(--pehlione-hero-photo)")};width:var(--pehlione-hero-photo);height:var(--pehlione-hero-photo);box-sizing:border-box}
${surface("pehlione_white_blue", ".pehlione-hero:after", ".pehlione-pdf-hero:after")}{${centred(scaled(16))};width:${scaled(16)};height:${scaled(16)};box-sizing:border-box}
${surface("pehlione_white_blue", ".pehlione-hero i", ".pehlione-pdf-hero i")}{left:calc(50% - ${scaled(15)});top:50%}
${surface("pehlione_white_blue", ".pehlione-hero i:nth-of-type(3)", ".pehlione-pdf-hero i:nth-of-type(3)")}{left:calc(50% + ${scaled(5)});top:calc(50% - ${scaled(11)})}
${surface("pehlione_white_blue", ".pehlione-hero b", ".pehlione-pdf-hero b")}{left:50%;top:50%;transform:translate(-50%,-50%)}
`;
