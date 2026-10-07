/** Only user-clicked web links without embedded credentials may leave the app. */
export const safeExternalUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
};
