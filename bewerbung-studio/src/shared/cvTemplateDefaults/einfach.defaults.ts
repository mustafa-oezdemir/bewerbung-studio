export const einspaltigDefaults = {
  page: {
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 14,
    marginRightMm: 15,
    marginBottomMm: 12,
    marginLeftMm: 15,
  },
  layout: {
    headerHeightMm: 35,
    sectionGapMm: 7,
    entryGapMm: 4.5,
    strengthsColumnGapMm: 15,
    photoDiameterMm: 34,
  },
  colors: {
    primary: "#0B3485",
    accent: "#4AAAF4",
    text: "#3E484E",
    muted: "#68747A",
    pattern: "#EAF5FD",
    inactive: "#E3E7EA",
  },
} as const;

/** @deprecated Nur für bestehende interne Importe. */
export const einfachDefaults = einspaltigDefaults;
