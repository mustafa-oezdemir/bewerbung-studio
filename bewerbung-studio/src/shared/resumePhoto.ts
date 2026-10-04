import {
  defaultResumePhotoSize,
  getResumeSemanticSection,
  resolveResumeSectionInstances,
  resumePhotoSizes,
  type ResumePhotoSize,
} from "../features/resume-sections/resume-section-system";
import type { DocumentDesignSettings } from "./documentDesign";
import { getProfileMediaSource } from "./profileMedia";
import { resumeAppearanceSchema } from "./resumeAppearance";
import type { ApplicantProfile } from "./schema";
import { resolveTemplateId } from "./templates";

export { defaultResumePhotoSize, resumePhotoSizes, type ResumePhotoSize };

/**
 * The size of the Bewerbungsfoto in the Lebenslauf: one profile setting with exactly three steps.
 *
 * A step is never a measure in millimetres. Every template has its own native photo (Klassisch 32 mm, Kompakt
 * 20 mm, Zeitgenössisch 36 mm, the Pehlione hero …), and "Mittel" is that native photo, untouched. "Klein" and
 * "Groß" scale the template's own photo, its frame and (where the photo is part of an artwork) the artwork by
 * the factors below. The templates multiply their native lengths with `--resume-photo-scale`; with the
 * variable unset (Mittel, or a profile saved before this setting existed) every rule resolves to its native
 * value, so nothing moves.
 *
 * Three settings stay apart: the size (this file), the shape (`resumeAppearance.photoLayout`) and whether the
 * photo is used at all (the semantic "photo" section). None of them overwrites another.
 */
export const resumePhotoSizeLabels: Record<ResumePhotoSize, string> = {
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
};

/** Factors on the template's native photo. */
export const resumePhotoScales: Record<ResumePhotoSize, number> = {
  small: 0.8,
  medium: 1,
  large: 1.2,
};

export const resumePhotoScaleVariable = "--resume-photo-scale";

export const resolveResumePhotoSize = (
  profile: Pick<ApplicantProfile, "resumePhotoSize"> | undefined,
): ResumePhotoSize =>
  profile?.resumePhotoSize && resumePhotoSizes.includes(profile.resumePhotoSize)
    ? profile.resumePhotoSize
    : defaultResumePhotoSize;

export const getResumePhotoScale = (
  profile: Pick<ApplicantProfile, "resumePhotoSize"> | undefined,
) => resumePhotoScales[resolveResumePhotoSize(profile)];

/**
 * How much room page one loses when the photo grows. The planner measured every template with its native photo,
 * so "Klein" never needs more room and "Mittel" is exactly what was measured; only the extra height of "Groß"
 * is added to the header and the columns below it (`main`) or to the sidebar (`side`).
 */
export type ResumePhotoGrowth = { main: number; side: number };
const noGrowth: ResumePhotoGrowth = { main: 0, side: 0 };

/**
 * "Groß" (x1.2) per template: how far the first section of the main column / of a sidebar moves down on page one,
 * measured on the real preview and PDF layout (the larger of the two, rounded up) by `scripts/check-photo-qa.cjs`,
 * which fails when a layout needs more than listed here. Pehlione grows its hero (46 mm); Elegant and Gepflegt
 * carry the photo in the sidebar, so only the sidebar moves; Ivy League shows no photo.
 */
export const resumePhotoLargeGrowthMm: Record<string, ResumePhotoGrowth> = {
  pehlione_white_blue: { main: 0, side: 9.2 },
  pehlione_white: { main: 0, side: 9.2 },
  zweispaltig: { main: 6, side: 6 },
  zeitgenoessisch: { main: 8.4, side: 8.4 },
  kreativ: { main: 5.6, side: 5.6 },
  stilvoll: { main: 5.2, side: 5.2 },
  kompakt: { main: 4, side: 4 },
  einspaltig: { main: 5.8, side: 0 },
  klassisch: { main: 5.4, side: 0 },
  gepflegt: { main: 0, side: 5.2 },
  elegant: { main: 0, side: 5.4 },
  modern: { main: 3.2, side: 3.2 },
  tabellarisch: { main: 3, side: 0 },
};

/** Extra height (mm) of page one for a template at a photo size, relative to its native photo. */
export const getResumePhotoGrowth = (
  templateId: string,
  profile: Pick<ApplicantProfile, "resumePhotoSize"> | undefined,
): ResumePhotoGrowth => {
  if (resolveResumePhotoSize(profile) !== "large") return noGrowth;
  return resumePhotoLargeGrowthMm[resolveTemplateId(templateId)] ?? noGrowth;
};

/** Whether the page really draws the photo: it is visible (the display profile keeps it) and its shape is not "hidden". */
export const resumePhotoShown = (
  profile: Pick<ApplicantProfile, "photoPath"> | undefined,
  settings: Pick<DocumentDesignSettings, "resumeAppearance"> | undefined,
) =>
  Boolean(getProfileMediaSource(profile?.photoPath)) &&
  resumeAppearanceSchema.parse(settings?.resumeAppearance ?? {}).photoLayout !== "hidden";

/** The signature in the closing is a data image too: it is never the photo. */
const signatureImage = '[data-resume-closing-signature], [class*="closing"], [class*="signature"]';

/** Whether a rendered page draws a Bewerbungsfoto (an embedded picture that is not the signature). */
const pageDrawsPhoto = (page: Element) =>
  Array.from(page.querySelectorAll('img[src^="data:image/"]')).some(
    (image) => !image.closest(signatureImage) && image.getAttribute("alt") !== "Unterschrift",
  );

/**
 * Hands the chosen scale to the page of a template (preview: the template root, PDF: `.page-content`, the same
 * scope the spacing output uses). Nothing is written for "Mittel", and nothing when the page shows no photo,
 * so a template without a photo (Ivy League, the plain ATS layout, a hidden photo) is never touched.
 */
export const applyResumePhotoOutput = (
  page: Element,
  surface: "preview" | "pdf",
  profile: Pick<ApplicantProfile, "resumePhotoSize"> | undefined,
): void => {
  const scale = getResumePhotoScale(profile);
  if (scale === 1) return;
  if (!pageDrawsPhoto(page)) return;
  const scope = (surface === "pdf" ? page.querySelector(".page-content") : page.firstElementChild) as HTMLElement | null;
  scope?.style.setProperty(resumePhotoScaleVariable, String(scale));
};

// --- the settings of the profile editor ---------------------------------------------------------------

type PhotoSettings = Pick<ApplicantProfile, "photoPath" | "resumePhotoSize" | "resumeSemanticSections" | "resumeManagerOverrides">;

/** Whether the photo is used in the Lebenslauf: the semantic "photo" section, the one source of truth. */
export const isResumePhotoVisible = (profile: Pick<ApplicantProfile, "resumeSemanticSections">) => {
  const photo = getResumeSemanticSection(profile.resumeSemanticSections, "photo");
  return photo.visible && photo.enabled;
};

/**
 * Shows or hides the photo in the Lebenslauf. Only the visibility changes: `photoPath` is kept, so "Foto
 * ausblenden" is never "Foto löschen". The section manager's override is written too, because the managed output
 * reads the photo's visibility through it (exactly what the eye in the section panel does).
 */
export const setResumePhotoVisible = <T extends Pick<ApplicantProfile, "resumeSemanticSections" | "resumeManagerOverrides">>(
  profile: T,
  visible: boolean,
): T => ({
  ...profile,
  resumeManagerOverrides: {
    ...profile.resumeManagerOverrides,
    photo: { ...profile.resumeManagerOverrides?.photo, visible },
  },
  resumeSemanticSections: resolveResumeSectionInstances(profile.resumeSemanticSections).map((section) =>
    section.semanticType === "photo" ? { ...section, visible, enabled: visible } : section,
  ),
});

/**
 * A picked picture becomes the photo. The first photo of a profile is used in the Lebenslauf at once; replacing
 * one keeps whatever the user chose (shown or hidden), and the size is never touched.
 */
export const setResumePhoto = <T extends Pick<ApplicantProfile, "photoPath" | "resumeSemanticSections" | "resumeManagerOverrides">>(
  profile: T,
  dataUrl: string,
): T => {
  const next = { ...profile, photoPath: dataUrl };
  return profile.photoPath ? next : setResumePhotoVisible(next, true);
};

/** Removing clears the picture only; the size and whether the photo is shown stay as the user set them. */
export const removeResumePhoto = <T extends Pick<ApplicantProfile, "photoPath">>(profile: T): T => ({
  ...profile,
  photoPath: "",
});

export const setResumePhotoSize = <T extends Pick<ApplicantProfile, "resumePhotoSize">>(
  profile: T,
  resumePhotoSize: ResumePhotoSize,
): T => ({ ...profile, resumePhotoSize });

/** `target` with the photo, its size and its visibility from `source` and nothing else (the section's own save). */
export const copyResumePhotoSettings = <T extends PhotoSettings>(source: PhotoSettings, target: T): T =>
  setResumePhotoVisible(
    { ...target, photoPath: source.photoPath, resumePhotoSize: source.resumePhotoSize },
    isResumePhotoVisible(source),
  );
