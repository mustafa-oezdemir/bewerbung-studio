export const documentFontIds = [
  "rubik",
  "inter",
  "roboto",
  "open-sans",
  "lato",
  "arimo",
  "raleway",
  "bitter",
  "exo-2",
  "chivo",
  "tinos",
  "source-sans",
  "merriweather",
  "montserrat",
  "oswald",
  "volkhov",
  "arial",
  "georgia",
] as const;

export const fontSizeIds = ["small", "medium", "large"] as const;

export const resumeOutputModes = ["visual", "ats"] as const;
export const documentBackgroundScopes = [
  "page",
  "sidebar",
  "header",
  "sections",
] as const;

export const columnLayoutIds = [
  "template",
  "single",
  "two-column-left-wide",
  "two-column-right-wide",
  "two-column-equal",
  "left-sidebar",
  "right-sidebar",
  "three-column",
  "timeline",
  "compact-ats",
] as const;

export const documentBackgroundIds = [
  "white",
  "soft",
  "geometric",
  "hexagons",
  "waves",
  "lines",
  "dots",
  "abstract",
  "corner",
  "pastel-gradient",
  "top-band",
  "bottom-band",
  "programming-languages-bg",
  "classic-soft-blue-waves",
] as const;

export type DocumentFontId = (typeof documentFontIds)[number];
export type DocumentFontSize = (typeof fontSizeIds)[number];
export type ResumeOutputMode = (typeof resumeOutputModes)[number];
export type ColumnLayout = (typeof columnLayoutIds)[number];
export type DocumentBackgroundId = (typeof documentBackgroundIds)[number];
export type DesignLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type DocumentBackgroundScope = (typeof documentBackgroundScopes)[number];

export type SectionColumnMode = "auto" | 1 | 2 | 3 | 4;

export type DocumentDesignSettings = {
  strengthsColumns: SectionColumnMode;
  knowledgeColumns: SectionColumnMode;
  marginLevel: DesignLevel;
  paddingLevel: DesignLevel;
  sectionSpacingLevel: DesignLevel;
  fontSize: DocumentFontSize;
  lineHeightLevel: DesignLevel;
  backgroundShadeLevel: DesignLevel;
  fontId: DocumentFontId;
  headingFontId: DocumentFontId;
  columnLayout: ColumnLayout;
  resumeOutputMode: ResumeOutputMode;
  backgroundId: DocumentBackgroundId;
  backgroundScope: DocumentBackgroundScope;
  textColor: string;
  headingColor: string;
  lineColor: string;
  backgroundColor: string;
  showBackgroundInPrint: boolean;
  syncAcrossDocuments: boolean;
};

export type ResumeFont = {
  id: DocumentFontId;
  name: string;
  family: string;
  category: "sans-serif" | "serif";
  headingWeight: number;
  bodyWeight: number;
};

export type DocumentBackground = {
  id: DocumentBackgroundId;
  name: string;
  description: string;
  category: "minimal" | "geometric" | "creative" | "technical";
  previewType: "css" | "svg" | "image";
  previewValue: string;
  supportsPrint: boolean;
  atsFriendly: boolean;
};

export type ColumnLayoutOption = {
  id: ColumnLayout;
  name: string;
  description: string;
};

export const defaultDocumentDesign: DocumentDesignSettings = {
  strengthsColumns: "auto",
  knowledgeColumns: "auto",
  marginLevel: 5,
  paddingLevel: 5,
  sectionSpacingLevel: 5,
  fontSize: "medium",
  lineHeightLevel: 5,
  backgroundShadeLevel: 1,
  fontId: "source-sans",
  headingFontId: "source-sans",
  columnLayout: "template",
  resumeOutputMode: "visual",
  backgroundId: "white",
  backgroundScope: "page",
  textColor: "#142235",
  headingColor: "#0b3d86",
  lineColor: "#b8c3d0",
  backgroundColor: "#ffffff",
  showBackgroundInPrint: true,
  syncAcrossDocuments: true,
};

export const documentFonts: ResumeFont[] = [
  {
    id: "rubik",
    name: "Rubik",
    family: "Rubik, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "inter",
    name: "Inter",
    family: "Inter, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 750,
    bodyWeight: 400,
  },
  {
    id: "roboto",
    name: "Roboto",
    family: "Roboto, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "open-sans",
    name: "Open Sans",
    family: '"Open Sans", Arial, sans-serif',
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "lato",
    name: "Lato",
    family: "Lato, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "arimo",
    name: "Arimo",
    family: "Arimo, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "raleway",
    name: "Raleway",
    family: "Raleway, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 750,
    bodyWeight: 400,
  },
  {
    id: "bitter",
    name: "Bitter",
    family: "Bitter, Georgia, serif",
    category: "serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "exo-2",
    name: "Exo 2",
    family: '"Exo 2", Arial, sans-serif',
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "chivo",
    name: "Chivo",
    family: "Chivo, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "tinos",
    name: "Tinos",
    family: 'Tinos, "Times New Roman", serif',
    category: "serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "source-sans",
    name: "Source Sans 3",
    family: '"Source Sans 3", "Segoe UI", Arial, sans-serif',
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "merriweather",
    name: "Merriweather",
    family: "Merriweather, Georgia, serif",
    category: "serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "montserrat",
    name: "Montserrat",
    family: "Montserrat, Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 750,
    bodyWeight: 400,
  },
  {
    id: "oswald",
    name: "Oswald",
    family: 'Oswald, "Arial Narrow", Arial, sans-serif',
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "volkhov",
    name: "Volkhov",
    family: "Volkhov, Georgia, serif",
    category: "serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "arial",
    name: "Arial",
    family: "Arial, sans-serif",
    category: "sans-serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
  {
    id: "georgia",
    name: "Georgia",
    family: 'Georgia, "Times New Roman", serif',
    category: "serif",
    headingWeight: 700,
    bodyWeight: 400,
  },
];

export const columnLayoutOptions: ColumnLayoutOption[] = [
  {
    id: "template",
    name: "Vorlagenlayout",
    description: "Spalten der gewählten Vorlage",
  },
  {
    id: "single",
    name: "Eine Spalte",
    description: "Klassisch und ATS-sicher",
  },
  {
    id: "two-column-left-wide",
    name: "Links breit",
    description: "Inhalt links, Details rechts",
  },
  {
    id: "two-column-right-wide",
    name: "Rechts breit",
    description: "Details links, Inhalt rechts",
  },
  {
    id: "two-column-equal",
    name: "Zwei gleich",
    description: "Ausgewogene Spalten",
  },
  {
    id: "left-sidebar",
    name: "Sidebar links",
    description: "Farbfläche auf der linken Seite",
  },
  {
    id: "right-sidebar",
    name: "Sidebar rechts",
    description: "Farbfläche auf der rechten Seite",
  },
  {
    id: "three-column",
    name: "Drei Spalten",
    description: "Kompakte Informationsblöcke",
  },
  {
    id: "timeline",
    name: "Zeitleiste",
    description: "Stationen chronologisch betont",
  },
  {
    id: "compact-ats",
    name: "Kompakt ATS",
    description: "Einfach, dicht und maschinenlesbar",
  },
];

export const documentBackgrounds: DocumentBackground[] = [
  {
    id: "white",
    name: "Weiß",
    description: "Rein und klassisch",
    category: "minimal",
    previewType: "css",
    previewValue: "white",
    supportsPrint: true,
    atsFriendly: true,
  },
  {
    id: "soft",
    name: "Helle Fläche",
    description: "Dezente Grundfarbe",
    category: "minimal",
    previewType: "css",
    previewValue: "soft",
    supportsPrint: true,
    atsFriendly: true,
  },
  {
    id: "geometric",
    name: "Geometrisch",
    description: "Feine diagonale Formen",
    category: "geometric",
    previewType: "css",
    previewValue: "geometric",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "hexagons",
    name: "Hexagon",
    description: "Technisches Wabenmuster",
    category: "technical",
    previewType: "css",
    previewValue: "hexagons",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "waves",
    name: "Wellen",
    description: "Ruhige weiche Linien",
    category: "creative",
    previewType: "css",
    previewValue: "waves",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "lines",
    name: "Linien",
    description: "Minimal gerastert",
    category: "minimal",
    previewType: "css",
    previewValue: "lines",
    supportsPrint: true,
    atsFriendly: true,
  },
  {
    id: "dots",
    name: "Punkte",
    description: "Dezentes Punktraster",
    category: "minimal",
    previewType: "css",
    previewValue: "dots",
    supportsPrint: true,
    atsFriendly: true,
  },
  {
    id: "abstract",
    name: "Abstrakt",
    description: "Organische Akzentlinien",
    category: "creative",
    previewType: "css",
    previewValue: "abstract",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "corner",
    name: "Eckdekor",
    description: "Farbige obere Ecke",
    category: "geometric",
    previewType: "css",
    previewValue: "corner",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "pastel-gradient",
    name: "Pastell",
    description: "Sehr heller Verlauf",
    category: "creative",
    previewType: "css",
    previewValue: "pastel-gradient",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "top-band",
    name: "Kopfband",
    description: "Farbige obere Fläche",
    category: "geometric",
    previewType: "css",
    previewValue: "top-band",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "bottom-band",
    name: "Fußband",
    description: "Farbige untere Fläche",
    category: "geometric",
    previewType: "css",
    previewValue: "bottom-band",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "programming-languages-bg",
    name: "Programmiersprachen",
    description: "Dezente Technologie-Tags in den Seitenecken",
    category: "technical",
    previewType: "css",
    previewValue: "corner-cluster",
    supportsPrint: true,
    atsFriendly: false,
  },
  {
    id: "classic-soft-blue-waves",
    name: "Klassische blaue Wellen",
    description: "Organische hellblaue Flächen mit feinen Konturlinien",
    category: "minimal",
    previewType: "svg",
    previewValue: "classic-soft-blue-waves",
    supportsPrint: true,
    atsFriendly: false,
  },
];

export const programmingLanguageBackgroundTokens = [
  "Java",
  "TypeScript",
  "React",
  "Electron",
  "Go",
  "Rust",
  "C#",
  ".NET",
  "Python",
  "C",
  "C++",
  "HTML",
  "CSS",
  "PHP",
] as const;

export const marginLevelToMm: Record<DesignLevel, number> = {
  1: 9,
  2: 11,
  3: 13,
  4: 15,
  5: 17,
  6: 18.5,
  7: 20,
  8: 21.5,
  9: 23,
  10: 25,
};

export const paddingLevelToMm: Record<DesignLevel, number> = {
  1: 1.5,
  2: 2,
  3: 2.5,
  4: 3,
  5: 3.5,
  6: 4,
  7: 4.5,
  8: 5,
  9: 5.5,
  10: 6,
};

export const compactWordMarginLevelToMm: Record<
  DesignLevel,
  { vertical: number; horizontal: number }
> = {
  1: { vertical: 8, horizontal: 10 },
  2: { vertical: 9, horizontal: 11 },
  3: { vertical: 10, horizontal: 12 },
  4: { vertical: 11, horizontal: 14 },
  5: { vertical: 12, horizontal: 15 },
  6: { vertical: 13, horizontal: 16 },
  7: { vertical: 14, horizontal: 17 },
  8: { vertical: 15, horizontal: 18 },
  9: { vertical: 17, horizontal: 20 },
  10: { vertical: 19, horizontal: 22 },
};

export const sectionSpacingLevelToMm: Record<DesignLevel, number> = {
  1: 2.5,
  2: 3.2,
  3: 3.8,
  4: 4.5,
  5: 5.5,
  6: 6.2,
  7: 7,
  8: 7.8,
  9: 8.6,
  10: 9.5,
};

export const lineHeightLevelToValue: Record<DesignLevel, number> = {
  1: 1,
  2: 1.05,
  3: 1.1,
  4: 1.15,
  5: 1.2,
  6: 1.26,
  7: 1.32,
  8: 1.38,
  9: 1.44,
  10: 1.5,
};

export const backgroundShadeLevelToOpacity: Record<DesignLevel, number> = {
  1: 0.03,
  2: 0.06,
  3: 0.1,
  4: 0.14,
  5: 0.2,
  6: 0.28,
  7: 0.38,
  8: 0.5,
  9: 0.66,
  10: 0.82,
};

export const fontSizeToPt: Record<DocumentFontSize, number> = {
  small: 8.4,
  medium: 9.2,
  large: 10,
};

export const getDocumentFont = (id: DocumentFontId) =>
  documentFonts.find((font) => font.id === id) ??
  documentFonts.find((font) => font.id === "source-sans") ??
  documentFonts[0];

export const getDocumentDesignVariables = (
  settings: DocumentDesignSettings,
) => ({
  "--doc-margin": `${marginLevelToMm[settings.marginLevel]}mm`,
  "--doc-padding": `${paddingLevelToMm[settings.paddingLevel]}mm`,
  "--doc-section-gap": `${sectionSpacingLevelToMm[settings.sectionSpacingLevel]}mm`,
  "--doc-body-size": `${fontSizeToPt[settings.fontSize]}pt`,
  "--doc-line-height": String(lineHeightLevelToValue[settings.lineHeightLevel]),
  "--doc-font": getDocumentFont(settings.fontId).family,
  "--doc-heading-font": getDocumentFont(settings.headingFontId).family,
  "--doc-text-color": settings.textColor,
  "--doc-heading-color": settings.headingColor,
  "--doc-line-color": settings.lineColor,
  "--doc-background-color": settings.backgroundColor,
  "--doc-background-shade": `${backgroundShadeLevelToOpacity[settings.backgroundShadeLevel] * 100}%`,
});

const channel = (hex: string, offset: number) =>
  Number.parseInt(hex.slice(offset, offset + 2), 16);
const relativeLuminance = (hex: string) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000";
  const values = [
    channel(normalized, 1),
    channel(normalized, 3),
    channel(normalized, 5),
  ].map((value) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};

export const getColorContrastRatio = (
  foreground: string,
  background: string,
) => {
  const light = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const dark = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (light + 0.05) / (dark + 0.05);
};

export const hasReadableColorContrast = (
  foreground: string,
  background: string,
) => getColorContrastRatio(foreground, background) >= 4.5;
