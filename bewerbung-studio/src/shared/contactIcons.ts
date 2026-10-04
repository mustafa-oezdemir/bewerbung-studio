// Shared Zweispaltig contact symbols for previews and exported documents.
export const contactIconPaths = {
      phone:
        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1 .37 1.98.72 2.9a2 2 0 0 1-.45 2.11L8.1 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.92.35 1.9.59 2.9.72A2 2 0 0 1 22 16.92z"/>',
      email:
        '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
      linkedin:
        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
      location:
        '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
      birth:
        '<path d="M4 12h16v8H4zM7 12V9h10v3M8 6V4M12 6V4M16 6V4"/>',
      github:
        '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.28-.36 6.72-1.61 6.72-7.25A5.7 5.7 0 0 0 19.22 3.3 5.3 5.3 0 0 0 19.07.1S17.88-.3 15 1.6a13.4 13.4 0 0 0-7 0C5.12-.3 3.93.1 3.93.1a5.3 5.3 0 0 0-.15 3.2 5.7 5.7 0 0 0-1.5 3.95c0 5.63 3.44 6.88 6.72 7.25A4.8 4.8 0 0 0 8 18v4"/><path d="M8 19c-3 .92-3-1.5-4-2"/>',
      portfolio:
        '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/>',
      calendar:
        '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
      nationality:
        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
      familyStatus:
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      children:
        '<circle cx="12" cy="8" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/>',
    } as const;
export type ContactIconDescriptor = { kind?: string; href?: string; value?: string; icon?: string };
export function resolveContactIcon({ kind, href = "", value = "", icon = "" }: ContactIconDescriptor): keyof typeof contactIconPaths {
  if (/^tel:/i.test(href)) return "phone";
  if (/^mailto:/i.test(href)) return "email";
  if (/^https?:\/\/(?:www\.)?github\.com(?:\/|$)/i.test(href)) return "github";
  if (/^https?:\/\/(?:www\.)?linkedin\.com(?:\/|$)/i.test(href)) return "linkedin";
  if (kind === "website" || kind === "portfolio" || kind === "onlineProfile") return "portfolio";
  if (kind && Object.hasOwn(contactIconPaths, kind)) return kind as keyof typeof contactIconPaths;
  if (/^https?:/i.test(href)) return "portfolio";
  if (["☆", "★", "G"].includes(icon) || /^Geb\.|^\d{2}[./]\d{2}[./]/.test(value)) return "birth";
  return "location";
}
export function renderContactIcon(contact: ContactIconDescriptor) {
  const kind = resolveContactIcon(contact);
  const label = kind === "portfolio" ? "website" : kind;
  return `<svg data-contact-icon="${label}" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0">${contactIconPaths[kind]}</svg>`;
}
