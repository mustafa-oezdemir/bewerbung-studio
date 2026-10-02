const internationalDigits = (value: string) =>
  value
    .trim()
    .replace(/^00/, "+")
    .replace(/[^\d+]/g, "");

/** Formats German mobile numbers for display without changing their stored value. */
export const formatPhoneForDisplay = (value = "") => {
  const normalized = internationalDigits(value);
  const digits = normalized.replace(/\D/g, "");

  if (digits.startsWith("49") && /^1\d{9,10}$/.test(digits.slice(2))) {
    return `+49 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  return value.trim();
};

/**
 * The one URL normalisation of every profile link (LinkedIn, GitHub, Website, Online-Profile) in the editors,
 * the preview and the PDF: "linkedin.com/in/x" becomes "https://linkedin.com/in/x". Only http(s) targets are
 * produced; a scheme the user typed (also script-like ones such as "javascript:") is dropped, never kept.
 */
export const externalUrl = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const withoutScheme = trimmed.replace(
    /^(?:[a-z][a-z\d+.-]*:\/\/|(?:javascript|data|vbscript|file|mailto|tel):)\/*/i,
    "",
  );
  return withoutScheme ? `https://${withoutScheme}` : "";
};

/** `tel:` target of a phone number; the stored number itself is never rewritten. */
export const phoneHref = (value = "") => {
  const digits = value.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
};

/** Keeps the URL readable while the complete URL remains the link destination. */
export const formatUrlForDisplay = (value = "") =>
  externalUrl(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
