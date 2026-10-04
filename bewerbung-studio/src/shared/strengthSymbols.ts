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

export const getStrengthSymbolMarkup = (id: string) => {
  const symbol = strengthSymbolOptions.find((option) => option.id === id);
  return symbol
    ? `<svg class="technology-brand-svg" data-strength-symbol="${symbol.id}" style="color:inherit" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${symbol.shape}</svg>`
    : "";
};
