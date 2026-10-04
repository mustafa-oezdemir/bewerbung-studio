/**
 * Where the gear sits inside the artwork below, in viewBox units. The gear is not in the middle
 * of the drawing, so the hero centres the *gear* (see pehlioneHero.ts), not the SVG box.
 */
export const pehlioneGear = {
  viewBox: { width: 240, height: 160 },
  cx: 76,
  cy: 91,
  /** Circle that frames the photo, and the tips of the teeth. */
  ringRadius: 45,
  outerRadius: 57,
} as const;

// Static vector artwork shared by the white template preview and PDF export.
const gearPoints = Array.from({ length: 64 }, (_, index) => {
  const radius = index % 4 === 0 || index % 4 === 3 ? 49 : 57;
  const angle = (index * Math.PI * 2) / 64;
  return `${(76 + Math.cos(angle) * radius).toFixed(2)},${(91 + Math.sin(angle) * radius).toFixed(2)}`;
}).join(" ");

export const pehlioneBlueprintMarkup = `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="none" stroke="#dcecff" stroke-width=".65">
  <path d="M18 33 57 16 168 50 219 126 29 126Z M20 40 179 103 216 23 M57 16 76 91 168 50 M131 15H219M151 12V143M182 12V143M213 12V143M119 119H224M125 139H230" opacity=".65"/>
  <polygon points="${gearPoints}" stroke-width="1.2"/>
  <circle cx="76" cy="91" r="45"/><circle cx="76" cy="91" r="38"/><circle cx="76" cy="91" r="29"/><circle cx="76" cy="91" r="17" stroke-width="1.2"/>
  <path d="M9 91H143M76 27V153M37 51 116 132M32 131 117 50" opacity=".5"/>
  <circle cx="57" cy="16" r="4"/><circle cx="168" cy="50" r="3"/><circle cx="179" cy="103" r="4"/><circle cx="216" cy="23" r="3"/>
  <path d="M53 16h8m-4-4v8M146 119h10m-5-5v10M208 139h10m-5-5v10"/>
</svg>`;
