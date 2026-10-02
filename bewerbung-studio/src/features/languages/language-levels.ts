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

/**
 * The words that stay in the visual Lebenslauf next to the level dots: "Muttersprache", "C1 · Verhandlungssicher".
 * A level the user wrote in their own words is shown as written; an empty level has no text.
 */
export const describeLanguageLevel = (level: string) => {
  const text = level.trim();
  if (!text) return "";
  if (/^(?:muttersprache|native)$/i.test(text)) return "Muttersprache";
  const exact = cefrLanguageLevels.find((entry) => entry.value === text.toLocaleUpperCase("de-DE"));
  return exact ? exact.label.replace(" – ", " · ") : text;
};

/** A level inside one pair of brackets: "C1 (verhandlungssicher)" becomes "(C1, verhandlungssicher)", never "((…))". */
export const bracketLanguageLevel = (level: string) => {
  const text = level.trim();
  return text ? `(${text.replace(/\s*\((.*)\)\s*$/, ", $1")})` : "";
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
