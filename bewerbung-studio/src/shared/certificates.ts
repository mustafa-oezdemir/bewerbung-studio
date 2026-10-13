import type { ApplicantProfile } from "./schema";

/**
 * Zertifikate & Weiterbildungen: the profile keeps them as text (`certifications`, "Datum · Titel · Anbieter") with a
 * parallel list of stable ids (`certificationIds`, same order). An id never depends on the position or on a text the
 * user may edit later; a record without ids (older workspaces) gets ids derived from its current text, which the next
 * save keeps for good. Each Bewerbung chooses and orders its certificates by these ids
 * (`resumePresentation.selectedCertificateIds`).
 */

export type CertificateParts = {
  date: string;
  title: string;
  provider: string;
};

const looksLikeDate = (part: string) => /^(?:\d{2}[./-]\d{4}|\d{4}|seit\b|bis\b)/i.test(part);

export const parseCertificate = (value: string): CertificateParts => {
  const parts = value.split(/\s+·\s+/).map((part) => part.trim());
  if (parts.length >= 3) {
    return {
      date: parts[0],
      title: parts.slice(1, -1).join(" · "),
      provider: parts.at(-1) ?? "",
    };
  }
  if (parts.length === 2) {
    return looksLikeDate(parts[0])
      ? { date: parts[0], title: parts[1], provider: "" }
      : { date: "", title: parts[0], provider: parts[1] };
  }
  return looksLikeDate(parts[0] ?? "")
    ? { date: parts[0], title: "", provider: "" }
    : { date: "", title: value.trim(), provider: "" };
};

export const formatCertificate = ({ date, title, provider }: CertificateParts) =>
  [date.trim(), title.trim(), provider.trim()].filter(Boolean).join(" · ");

export type CertificateEntry = { id: string; text: string };

/** FNV-1a, base 36: a short, stable fingerprint of a certificate text. */
const fingerprint = (text: string) => {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

/** The id of a certificate saved before ids existed: its text (and, for repeated texts, the repetition). */
export const legacyCertificateId = (text: string, repetition = 0) =>
  `cert-${fingerprint(text.trim())}${repetition ? `-${repetition}` : ""}`;

export const createCertificateId = () => `cert-${crypto.randomUUID()}`;

/** The profile's certificates with their ids, in the profile's order. Ids are unique within the list. */
export const certificateEntries = (
  profile: Pick<ApplicantProfile, "certifications" | "certificationIds"> | undefined,
): CertificateEntry[] => {
  if (!profile) return [];
  const repetitions = new Map<string, number>();
  const used = new Set<string>();
  return profile.certifications.map((text, index) => {
    let id = profile.certificationIds?.[index]?.trim() || "";
    if (!id) {
      const key = text.trim();
      const repetition = repetitions.get(key) ?? 0;
      repetitions.set(key, repetition + 1);
      id = legacyCertificateId(key, repetition);
    }
    // A repeated id (a damaged record) must not make two certificates one.
    for (let suffix = 1; used.has(id); suffix += 1) id = `${id.replace(/~\d+$/, "")}~${suffix}`;
    used.add(id);
    return { id, text };
  });
};

/** Profile fields for a list of entries: the texts and their ids, in the same order. */
export const certificateFields = (entries: readonly CertificateEntry[]) => ({
  certifications: entries.map((entry) => entry.text),
  certificationIds: entries.map((entry) => entry.id),
});

/**
 * The certificates a Bewerbung shows: absent selection = every certificate in the profile's order (the behaviour
 * before the selection existed); a selection = exactly the chosen ones, in the chosen order; [] = none. An id whose
 * certificate was deleted from the profile is ignored.
 */
export const selectCertificateEntries = (
  entries: readonly CertificateEntry[],
  selectedIds: readonly string[] | undefined,
): CertificateEntry[] => {
  if (selectedIds === undefined) return [...entries];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return [...new Set(selectedIds)].flatMap((id) => byId.get(id) ?? []);
};

/**
 * Lines pasted into the Profil ("Datum · Titel · Anbieter", or "Titel | Anbieter | Datum"): one certificate per
 * non-empty line, in the app's format. Lines already in the profile (same text) are left out.
 */
export const parseCertificateLines = (input: string, existing: readonly string[] = []) => {
  const known = new Set(existing.map((text) => text.trim().toLocaleLowerCase("de-DE")));
  const result: string[] = [];
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    const piped = line.split("|").map((part) => part.trim());
    const text = piped.length >= 2
      ? formatCertificate({ title: piped[0], provider: piped[1] ?? "", date: piped[2] ?? "" })
      : formatCertificate(parseCertificate(line));
    const key = text.toLocaleLowerCase("de-DE");
    if (!text || known.has(key)) continue;
    known.add(key);
    result.push(text);
  }
  return result;
};
