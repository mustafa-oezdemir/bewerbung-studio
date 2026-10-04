const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;

export const A4_PREVIEW_WIDTH_PX =
  (210 / MILLIMETERS_PER_INCH) * CSS_PIXELS_PER_INCH;
export const A4_PREVIEW_HEIGHT_PX =
  (297 / MILLIMETERS_PER_INCH) * CSS_PIXELS_PER_INCH;

export const calculateA4PreviewScale = (
  availableWidth: number,
  availableHeight: number,
) => {
  if (
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(availableHeight) ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return 1;
  }

  return Math.max(
    0.05,
    Math.min(
      1,
      availableWidth / A4_PREVIEW_WIDTH_PX,
      availableHeight / A4_PREVIEW_HEIGHT_PX,
    ),
  );
};
