export const strengthSymbolOptions = [
  {
    id: "symbol:dot",
    label: "Punkt",
    glyph: "●",
    shape: '<circle cx="16" cy="16" r="5" fill="currentColor"/>',
  },
  {
    id: "symbol:circle",
    label: "Kreis",
    glyph: "○",
    shape: '<circle cx="16" cy="16" r="6"/>',
  },
  {
    id: "symbol:square",
    label: "Quadrat",
    glyph: "▪",
    shape: '<path d="M11 11h10v10H11z" fill="currentColor"/>',
  },
  {
    id: "symbol:diamond",
    label: "Raute",
    glyph: "◆",
    shape: '<path d="m16 8 8 8-8 8-8-8z" fill="currentColor"/>',
  },
  {
    id: "symbol:arrow",
    label: "Pfeil",
    glyph: "→",
    shape: '<path d="M5 16h22m-8-8 8 8-8 8"/>',
  },
  {
    id: "symbol:double-arrow",
    label: "Doppelpfeil",
    glyph: "⇒",
    shape: '<path d="M4 12h15M4 20h15m0-13 9 9-9 9"/>',
  },
  {
    id: "symbol:hash",
    label: "Rautezeichen",
    glyph: "#",
    shape: '<path d="m13 5-4 22M23 5l-4 22M5 12h23M3 21h23"/>',
  },
  {
    id: "symbol:check",
    label: "Häkchen",
    glyph: "✓",
    shape: '<path d="m6 16 7 7L27 8"/>',
  },
] as const;

/** Category marks for the Stärken (API, Backend, …): stroke-only, so every template's icon colour reaches the whole mark. */
export const categorySymbolOptions = [
  {
    id: "symbol:api",
    label: "API",
    shape: '<path d="M11 6H9.5A2.5 2.5 0 0 0 7 8.5V13a3 3 0 0 1-3 3 3 3 0 0 1 3 3v4.5A2.5 2.5 0 0 0 9.5 26H11M21 6h1.5A2.5 2.5 0 0 1 25 8.5V13a3 3 0 0 0 3 3 3 3 0 0 0-3 3v4.5a2.5 2.5 0 0 1-2.5 2.5H21M14 16h4"/><circle cx="12.5" cy="16" r="1.5"/><circle cx="19.5" cy="16" r="1.5"/>',
  },
  {
    id: "symbol:backend",
    label: "Backend",
    shape: '<rect x="5" y="5" width="22" height="9" rx="2"/><rect x="5" y="18" width="22" height="9" rx="2"/><path d="M9.5 9.5h0M9.5 22.5h0M17 9.5h6M17 22.5h6"/>',
  },
  {
    id: "symbol:frontend",
    label: "Frontend",
    shape: '<rect x="3" y="5" width="26" height="22" rx="3"/><path d="M3 11h26M7 8h0M10.5 8h0M14 8h0M8 16h7M8 20.5h5"/><rect x="19" y="15" width="6" height="7" rx="1"/>',
  },
  {
    id: "symbol:database",
    label: "Datenbank",
    shape: '<ellipse cx="16" cy="7.5" rx="10" ry="3.5"/><path d="M6 7.5v17c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5v-17M6 13.2c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5M6 18.9c0 1.9 4.5 3.5 10 3.5s10-1.6 10-3.5"/>',
  },
  {
    id: "symbol:monitoring",
    label: "Monitoring",
    shape: '<path d="M3 16.5h5.5l3-8.5 5 16 4-11.5 2.5 4H29"/>',
  },
  {
    id: "symbol:ci",
    label: "CI (Continuous Integration)",
    shape: '<circle cx="9" cy="7" r="3"/><circle cx="9" cy="25" r="3"/><circle cx="23" cy="16" r="3"/><path d="M9 10v12M9 10c0 3.3 2.7 6 6 6h5"/>',
  },
  {
    id: "symbol:cd",
    label: "CD (Continuous Deployment)",
    shape: '<path d="M16 3c4 3 6 7.5 6 12.5V22H10v-6.5C10 10.5 12 6 16 3zM10 16.5 6 21v4l4-3M22 16.5l4 4.5v4l-4-3M13.5 22v1.5c0 2 1.2 3.6 2.5 5 1.3-1.4 2.5-3 2.5-5V22"/><circle cx="16" cy="12" r="2.5"/>',
  },
  {
    id: "symbol:test",
    label: "Test",
    shape: '<g transform="rotate(35 16 16)"><path d="M10.5 4h11M13 4v19.5a3 3 0 0 0 6 0V4M13 15h6M16 19.5h0"/></g>',
  },
  {
    id: "symbol:cloud",
    label: "Cloud",
    shape: '<path d="M23.3 25.3H12a9.3 9.3 0 1 1 9-12h2.3a6 6 0 1 1 0 12z"/>',
  },
  {
    id: "symbol:devops",
    label: "DevOps",
    // ∞ loop of Continuous Integration and Delivery; the arrowheads give it the direction of the cycle.
    shape: '<path d="M16 16c-2.5-3.5-4.5-6-8-6a6 6 0 0 0 0 12c3.5 0 5.5-2.5 8-6s4.5-6 8-6a6 6 0 0 1 0 12c-3.5 0-5.5-2.5-8-6zM22 8l2 2-2 2M10 20l-2 2 2 2"/>',
  },
  // IT-Kenntnisse marks drawn on a 24×24 grid: scaled to the 32×32 box, their 1.5 stroke is the family's 2.
  {
    id: "symbol:linux-shell",
    label: "Linux Shell",
    shape: '<g transform="scale(1.3333)" stroke-width="1.5"><rect x="2.5" y="3.5" width="19" height="17" rx="2.5"/><path d="M2.5 8h19"/><path d="M5.7 5.8h.01M8.3 5.8h.01" stroke-width="2"/><path d="m6.6 12 3.1 2.5-3.1 2.5M11.8 17h5.4"/></g>',
  },
  {
    id: "symbol:powershell",
    label: "PowerShell",
    shape: '<g transform="scale(1.3333)" stroke-width="1.5"><path d="M7 3.5h12.3a2 2 0 0 1 1.94 2.5l-3.4 12.6a2.5 2.5 0 0 1-2.42 1.9H4.7a2 2 0 0 1-1.94-2.5L4.55 5.5A2.5 2.5 0 0 1 7 3.5Z"/><path d="m8 10 3.6 3.1L8 16.1M12.7 16.3h3.8"/></g>',
  },
  {
    id: "symbol:gpo",
    label: "GPO (Gruppenrichtlinien)",
    shape: '<g transform="scale(1.3333)" stroke-width="1.5"><path d="M6 2.8h8l4 4V21H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z"/><path d="M14 2.8v4h4"/><path d="M8 10.5h1.55M12.45 10.5H16M8 14.5h3.55M14.45 14.5H16M8 18.5h.55M11.45 18.5H16"/><circle cx="11" cy="10.5" r="1.45"/><circle cx="13" cy="14.5" r="1.45"/><circle cx="10" cy="18.5" r="1.45"/></g>',
  },
  {
    id: "symbol:active-directory",
    label: "Active Directory",
    shape: '<g transform="scale(1.3333)" stroke-width="1.5"><rect x="9" y="2.5" width="6" height="5" rx="1"/><path d="M12 7.5v4.1M5 15v-3.4h14V15M12 11.6V15"/><rect x="2.5" y="15" width="5" height="6" rx="1"/><rect x="9.5" y="15" width="5" height="6" rx="1"/><rect x="16.5" y="15" width="5" height="6" rx="1"/></g>',
  },
] as const;

/** Aufzählungszeichen take the text colour; category symbols keep the template's icon colour like technology marks. */
export const isBulletSymbolId = (id: string) => strengthSymbolOptions.some((option) => option.id === id);

export const getStrengthSymbolMarkup = (id: string) => {
  const symbol =
    strengthSymbolOptions.find((option) => option.id === id) ?? categorySymbolOptions.find((option) => option.id === id);
  return symbol
    ? `<svg class="technology-brand-svg" data-strength-symbol="${symbol.id}"${isBulletSymbolId(symbol.id) ? ' style="color:inherit"' : ""} viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${symbol.shape}</svg>`
    : "";
};
