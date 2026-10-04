export const cefrLanguageLevels = [
  { value: "A1", label: "A1 – Anfänger" },
  { value: "A2", label: "A2 – Grundlegende Kenntnisse" },
  { value: "B1", label: "B1 – Gute Kenntnisse" },
  { value: "B2", label: "B2 – Fließend" },
  { value: "C1", label: "C1 – Verhandlungssicher" },
  { value: "C2", label: "C2 – Annähernd muttersprachlich" },
] as const;

export type CefrLanguageLevel = (typeof cefrLanguageLevels)[number]["value"];

export const cefrLanguageLevelCount = cefrLanguageLevels.length;

const defaultCefrLevel: CefrLanguageLevel = "B1";

export const getCefrLanguageLevel = (level: string): CefrLanguageLevel => {
  const normalized = level.trim().toLocaleLowerCase("de-DE");
  const exactLevel = normalized.match(/(?:^|\s)(a1|a2|b1|b2|c1|c2)(?:\s|$)/i)?.[1];
  if (exactLevel) return exactLevel.toLocaleUpperCase("de-DE") as CefrLanguageLevel;
  if (/muttersprache|native/.test(normalized)) return "C2";
  if (/verhandlung|fließ|fliess|fachkund/.test(normalized)) return "C1";
  if (/fortgeschritten|advanced|erweitert|versiert/.test(normalized)) return "B2";
  if (/gut|mittelstufe/.test(normalized)) return "B1";
  if (/grundkennt/.test(normalized)) return "A2";
  if (/anfänger|anfaenger|einsteiger|beginner/.test(normalized)) return "A1";
  return defaultCefrLevel;
};

export const getLanguageLevelScore = (level: string) =>
  cefrLanguageLevels.findIndex(
    (entry) => entry.value === getCefrLanguageLevel(level),
  ) + 1;

export const getCefrLevelByScore = (score: number): CefrLanguageLevel => {
  const safeIndex = Math.max(
    0,
    Math.min(cefrLanguageLevelCount - 1, Math.round(score) - 1),
  );
  return cefrLanguageLevels[safeIndex].value;
};

export const parseLanguageEntry = (raw: string) => {
  const normalized = raw.trim();
  const match = normalized.match(/^(.*?)\s+[–—-]\s+(.*)$/);
  const name = match?.[1]?.trim() || normalized;
  const level = match?.[2]?.trim() ?? "";
  return { raw: normalized, name, level };
};

/** The GER level a stored level contains ("C1", "C1 (Verhandlungssicher)"), or "" for a native language or own words. */
const findCefrLevel = (level: string) =>
  (/\b(A1|A2|B1|B2|C1|C2)\b/i.exec(level)?.[1]?.toLocaleUpperCase("de-DE") ?? "") as CefrLanguageLevel | "";

/** A native language: "Muttersprache", also as the older "C2 (Muttersprache)". */
const holdsNativeLevel = (level: string) => isNativeLanguageLevel(level) || /\(muttersprache\)/i.test(level);

/**
 * What a stored level means in words, the part of the Lebenslauf that "Beschreibung" shows: "Verhandlungssicher" for C1
 * (the terms of the language editor), "Muttersprache" for a native language, a level the user wrote in their own words
 * as written. Nothing is invented; an empty level has no words.
 */
export const describeLanguageLevel = (level: string) => {
  const text = level.trim();
  if (!text) return "";
  if (holdsNativeLevel(text)) return "Muttersprache";
  const code = findCefrLevel(text);
  return code ? cefrLanguageLevels.find((entry) => entry.value === code)!.label.split(" – ")[1] : text;
};

/**
 * What the visual Lebenslauf shows of a language level (Lebenslauf → Sprachen, any combination the user ticks):
 * the template's level `dots`, the GER `level` ("C1") and its `description` ("Verhandlungssicher").
 */
export const languageLevelDisplayKeys = ["dots", "level", "description"] as const;
export type LanguageLevelDisplayKey = (typeof languageLevelDisplayKeys)[number];
export type LanguageLevelDisplay = Record<LanguageLevelDisplayKey, boolean>;
export const languageLevelDisplayLabels: Record<LanguageLevelDisplayKey, string> = {
  dots: "Punkte",
  level: "Niveau (z. B. C1)",
  description: "Beschreibung (z. B. Verhandlungssicher)",
};
/** Everything on: the look the templates had so far. */
export const defaultLanguageLevelDisplay: LanguageLevelDisplay = { dots: true, level: true, description: true };

/** Older profiles know no such setting: a missing or invalid key takes its default. */
export const resolveLanguageLevelDisplay = (value: unknown): LanguageLevelDisplay => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    languageLevelDisplayKeys.map((key) => [key, typeof source[key] === "boolean" ? source[key] : defaultLanguageLevelDisplay[key]]),
  ) as LanguageLevelDisplay;
};

/**
 * Templates with native dot artwork. The managed visual language output also supplies dots
 * for templates without native artwork when "Punkte" is selected.
 */
export const languageDotTemplates = [
  "einspaltig", "elegant", "gepflegt", "ivy-league", "klassisch", "kompakt", "kreativ", "modern", "stilvoll", "tabellarisch",
  "zeitgenoessisch", "zweispaltig",
] as const;
export const templateDrawsLanguageDots = (templateId: string | undefined) =>
  Boolean(templateId) && (languageDotTemplates as readonly string[]).includes(templateId as string);

/**
 * A line of more characters than this (`Deutsch – C1 · Verhandlungssicher`) no longer fits a narrow list column: the plain
 * two-column list of Klassisch then spans the whole page width.
 */
export const wideLanguageLineChars = 28;

/** The accessible name of the level dots: the whole meaning of the level, whatever the text beside them shows. */
export const languageDotsLabel = (language: { name: string; cefrLevel: string; description: string }) =>
  `${language.name}: ${[language.cefrLevel, language.description].filter(Boolean).join(" · ")}`;

/** One language as the Lebenslauf prints it – the same for every template, the preview and the PDF. */
export type LanguagePresentation = {
  raw: string;
  /** "Deutsch" */
  name: string;
  /** "C1" when the stored level is (or contains) a GER level, else "". */
  cefrLevel: CefrLanguageLevel | "";
  /** What the level means: "Verhandlungssicher", "Muttersprache" or – for a level written in own words – that text. */
  description: string;
  native: boolean;
  /** 1–6 filled dots (the language editor's slider). */
  score: number;
  /** Dots are drawn when "Punkte" is ticked, a level exists and this is visual output. */
  showDots: boolean;
  /** The part of the first line behind the name ("C1 · Verhandlungssicher"; with dots only "C1"); "" if nothing is chosen. */
  detail: string;
  /** First line: "Deutsch – C1 · Verhandlungssicher", "Deutsch – C1" (dots) or just "Deutsch". */
  primaryText: string;
  /** With dots the description gets a line of its own behind the dots: "Verhandlungssicher". Without dots "". */
  secondaryText: string;
};

/** A long language card may use two tracks in an explicitly narrow sidebar grid.
 * The grid keeps the requested column count and the language remains one item. */
export const languageGridSpan = (language: LanguagePresentation, columns: number, zone: "main" | "sidebar") =>
  zone === "sidebar" && columns >= 3 && (language.primaryText.length > 25 || language.secondaryText.length > 28) ? 2 : 1;

export type LanguagePresentationOptions = {
  /** Visual output draws level dots. */
  dots?: boolean;
  /** ATS layout: no dots, the level is always written as text (formatLanguageForAts). */
  ats?: boolean;
};

/**
 * The one place that decides how a stored language ("Deutsch – C1") is shown, from the three ticks of Lebenslauf → Sprachen
 * ("Punkte", "Niveau", "Beschreibung"): "Deutsch – C1 · Verhandlungssicher" in one line without dots; with dots the first
 * line holds name and level, the dots follow and the description sits behind them. Nothing is guessed: a level written in
 * own words stays as written, a native language is not turned into "C2", and the stored string is never rewritten.
 */
export const resolveLanguagePresentation = (
  raw: string,
  displayValue?: unknown,
  { dots = false, ats = false }: LanguagePresentationOptions = {},
): LanguagePresentation => {
  const { raw: stored, name, level } = parseLanguageEntry(raw);
  const display = resolveLanguageLevelDisplay(displayValue);
  const native = holdsNativeLevel(level);
  const cefrLevel = findCefrLevel(level);
  const description = describeLanguageLevel(level);
  const score = getLanguageLevelScore(level);

  if (ats) {
    const text = formatLanguageForAts(stored);
    const detail = text.startsWith(name) ? text.slice(name.length).replace(/^\s+[–—-]\s+/, "") : "";
    return { raw: stored, name, cefrLevel, description, native, score, showDots: false, detail, primaryText: text, secondaryText: "" };
  }

  // A level in own words (and "Muttersprache") is a description; it only stands in for the level when the description is off.
  const levelText = display.level ? cefrLevel || (display.description ? "" : description) : "";
  const descriptionText = display.description ? description : "";
  const showDots = dots && display.dots && Boolean(level);
  const detail = showDots ? levelText : [levelText, descriptionText].filter(Boolean).join(" · ");
  return {
    raw: stored, name, cefrLevel, description, native, score, showDots, detail,
    primaryText: detail ? `${name} – ${detail}` : name,
    secondaryText: showDots ? descriptionText : "",
  };
};

export const isNativeLanguageLevel = (level: string) => /^(?:muttersprache|native)$/i.test(level.trim());

/** Keep the stored wording and include a readable GER meaning in ATS text. */
export const formatLanguageForAts = (raw: string) => {
  const { name, level } = parseLanguageEntry(raw);
  if (!name || !level) return name;
  if (isNativeLanguageLevel(level)) return `${name} – Muttersprache`;
  if (/\([^)]*\)/.test(level)) return `${name} – ${level}`;
  const code = getCefrLanguageLevel(level);
  const description: Record<CefrLanguageLevel, string> = {
    A1: "Anfänger", A2: "Grundkenntnisse", B1: "gute Kenntnisse",
    B2: "fließend", C1: "verhandlungssicher", C2: "annähernd muttersprachlich",
  };
  return `${name} – ${level}${level.toUpperCase() === code ? ` (${description[code]})` : ` (${code})`}`;
};

export const formatLanguageEntry = (
  name: string,
  level: string,
) => {
  const normalizedName = name.trim();
  return normalizedName ? `${normalizedName} – ${level}` : "";
};
