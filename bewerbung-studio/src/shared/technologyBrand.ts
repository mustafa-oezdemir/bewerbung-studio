import { getStrengthSymbolMarkup } from "./strengthSymbols";

const technologyAliases: Record<string, string> = {
  golang: "go", "go language": "go", js: "javascript", ts: "typescript",
  "spring boot": "spring", springboot: "spring", "react.js": "react", reactjs: "react",
};
export const normalizeTechnologyName = (name: string) => {
  const normalized = name.trim().toLocaleLowerCase("en-US").replace(/^(?:programming|programmiersprache)\s*[:–-]?\s*/i, "");
  return technologyAliases[normalized] ?? normalized;
};
const escapeIconText = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const svg = (content: string, brand = "generic", viewBox = "0 0 32 32") =>
  `<svg class="technology-brand-svg" data-brand="${brand}" viewBox="${viewBox}" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

const letterMark = (text: string, shape = "rounded") =>
  svg(
    `${
      shape === "hexagon"
        ? '<path d="M16 2 28 9v14l-12 7L4 23V9z" fill="none" stroke="currentColor" stroke-width="2"/>'
        : shape === "oval"
          ? '<ellipse cx="16" cy="16" rx="14" ry="9" fill="none" stroke="currentColor" stroke-width="2"/>'
          : '<rect x="3" y="3" width="26" height="26" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>'
    }<text x="16" y="19" text-anchor="middle" fill="currentColor" font-family="Arial,sans-serif" font-size="${text.length > 3 ? 7 : 10}" font-weight="700">${text}</text>`,
  );

const shieldBrand = (
  brand: "html" | "css",
  color: string,
  insetColor: string,
  glyph: string,
) =>
  svg(
    `<path d="M3 2h26l-2.4 25L16 30 5.4 27z" fill="${color}"/><path d="M16 4v23.2l8.1-2.2 2-21z" fill="${insetColor}"/><path d="${glyph}" fill="#fff"/>`,
    brand,
  );

const goBrand = () =>
  svg(
    '<g fill="#00add8"><path d="M2 10h13l-2 3H0zM0 15h12l-2 3H0zM3 20h11l-2 3H1z"/><path fill-rule="evenodd" d="M28 5a11 11 0 1 0 0 22h8V15H25v5h5v2h-2a6 6 0 1 1 5-9l5-3A11 11 0 0 0 28 5z"/><path fill-rule="evenodd" d="M49 5a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm0 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/></g>',
    "go",
    "0 0 62 32",
  );

const javascriptBrand = () =>
  svg(
    '<path d="M4 2h24l-2.2 25L16 30 6.2 27z" fill="#d6b91f"/><path d="M16 4v22.7l7.4-2 1.8-20.7z" fill="#ffd92f"/><path d="M9 8h5v12c0 2.1-1.4 3.5-3.8 3.5-1.5 0-2.7-.4-3.7-1.2l1.7-3c.6.4 1.1.7 1.6.7.6 0 .8-.3.8-1V8zm8.2 11.1c1 .8 2 1.2 3 1.2.8 0 1.2-.3 1.2-.8 0-.6-.5-.8-1.7-1.3-2.1-.8-3.2-2.1-3.2-4 0-2.5 1.9-4.2 4.8-4.2 1.7 0 3.1.4 4.2 1.2l-1.8 3c-.8-.5-1.6-.8-2.4-.8-.7 0-1 .3-1 .7 0 .5.5.8 1.7 1.2 2.2.8 3.3 2.1 3.3 4 0 2.7-2 4.5-5.1 4.5-2.1 0-3.8-.6-5-1.7z" fill="#fff"/>',
    "javascript",
  );

const phpBrand = () =>
  svg(
    '<ellipse cx="24" cy="16" rx="22" ry="10.5" fill="#7185b5" stroke="#1f2430" stroke-width="1.2"/><text x="24" y="20.2" text-anchor="middle" fill="#111" stroke="#fff" stroke-width=".9" paint-order="stroke" font-family="Arial,sans-serif" font-size="13" font-style="italic" font-weight="800">php</text>',
    "php",
    "0 0 48 32",
  );

const typescriptBrand = () =>
  svg(
    '<rect x="3" y="3" width="26" height="26" rx="2" fill="#3178c6"/><path d="M8 9h15v4h-5v12h-5V13H8z" fill="#fff"/><path d="M19 17c0-3 2.2-4.8 5.4-4.8 1.7 0 3.1.4 4.2 1.2l-1.7 3c-.8-.5-1.6-.8-2.4-.8-.6 0-1 .3-1 .7 0 .5.6.7 1.8 1.2 2.2.8 3.2 2 3.2 4 0 2.5-1.9 4.2-5 4.2-2 0-3.7-.5-4.9-1.6l1.8-3c.9.8 2 1.2 3 1.2.8 0 1.2-.3 1.2-.8 0-.6-.6-.8-1.8-1.2-2.1-.8-3.2-2-3.2-3.3z" fill="#fff" transform="translate(-1 -1) scale(.82) translate(7 5)"/>',
    "typescript",
  );

const frameworkBrand = () =>
  svg(
    '<path d="m16 3 10 5.5v6L16 20 6 14.5v-6z" fill="#6f42c1"/><path d="m6 17 10 5.5L26 17v6L16 29 6 23z" fill="#9b72e5"/><path d="m16 3v17M6 8.5 16 14l10-5.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>',
    "framework",
  );

export const getTechnologyBrandIconMarkup = (
  technology: string,
  iconId = "",
) => {
  const symbol = getStrengthSymbolMarkup(iconId);
  if (symbol) return symbol;
  const selectedIcon = getDeviconMarkup(iconId);
  if (selectedIcon) return selectedIcon;

  const normalized = normalizeTechnologyName(technology);
  if (
    normalized === "react" ||
    normalized === "react.js" ||
    normalized === "reactjs"
  ) {
    return svg(
      '<circle cx="16" cy="16" r="2.3" fill="#61dafb"/><ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="#61dafb" stroke-width="1.6"/><ellipse cx="16" cy="16" rx="13" ry="5.2" transform="rotate(60 16 16)" fill="none" stroke="#61dafb" stroke-width="1.6"/><ellipse cx="16" cy="16" rx="13" ry="5.2" transform="rotate(120 16 16)" fill="none" stroke="#61dafb" stroke-width="1.6"/>',
      "react",
    );
  }
  if (normalized === "electron") {
    return svg(
      '<circle cx="16" cy="16" r="2" fill="currentColor"/><path d="M8 8c7-4 16 0 18 8M5 18c1 8 10 12 17 8M21 5c-7 0-14 7-14 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="7" cy="9" r="1.6" fill="currentColor"/><circle cx="25" cy="17" r="1.6" fill="currentColor"/><circle cx="21" cy="26" r="1.6" fill="currentColor"/>',
    );
  }
  if (normalized === "java") {
    return svg(
      '<path d="M10 20h13v2.5c0 3-2.5 5.5-5.5 5.5h-2A5.5 5.5 0 0 1 10 22.5zM23 21h2a3 3 0 0 1 0 6h-3" fill="none" stroke="#5382a1" stroke-width="2"/><path d="M14 17c-4-4 5-5 1-9M19 17c-3-3 4-4 1-8M18 7c1-2 3-3 5-4" fill="none" stroke="#e76f00" stroke-width="1.8" stroke-linecap="round"/>',
      "java",
    );
  }
  if (normalized === "python") {
    return svg(
      '<path d="M16 3c-7 0-8 3-8 7v4h9v2H6c-3 0-4 2-4 6s2 7 5 7h4v-5c0-4 3-6 7-6h7c3 0 5-3 5-7s-2-8-7-8z" fill="currentColor" opacity=".82"/><circle cx="13" cy="8" r="1.3" fill="white"/><circle cx="21" cy="24" r="1.3" fill="white"/>',
    );
  }
  if (normalized === "rust") {
    return svg(
      '<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="3 2"/><text x="16" y="20" text-anchor="middle" fill="currentColor" font-family="Georgia,serif" font-size="13" font-weight="700">R</text>',
    );
  }
  if (["html", "html5"].includes(normalized)) {
    return shieldBrand(
      "html",
      "#e44d26",
      "#f16529",
      "M9 8h15l-.4 4H14l.3 3.4h9l-.8 8.1-6.5 1.8-6.5-1.8-.4-4h4l.2 1.2 2.7.7 2.8-.8.3-3.3H9.8z",
    );
  }
  if (["css", "css3"].includes(normalized)) {
    return shieldBrand(
      "css",
      "#1572b6",
      "#33a9dc",
      "M9 8h15l-.4 4-8.8 3.5h8.5l-.8 8-6.5 1.8-6.5-1.8-.4-4h4l.2 1.2 2.7.7 2.8-.8.2-2.2H9.8l-.3-3.8 8.7-3.4H9.3z",
    );
  }
  if (normalized === "c#") return letterMark("C#", "hexagon");
  if (normalized === "c++") return letterMark("C++", "hexagon");
  if (normalized === "c") return letterMark("C", "hexagon");
  if (normalized === "php") return phpBrand();
  if (["go", "golang", "go language"].includes(normalized)) return goBrand();
  if (normalized === ".net") return letterMark(".NET");
  if (["typescript", "type script", "ts"].includes(normalized))
    return typescriptBrand();
  if (
    ["javascript", "java script", "javascript (es6+)", "js"].includes(
      normalized,
    )
  )
    return javascriptBrand();
  if (
    [
      "framework",
      "frameworks",
      "framework / libraries",
      "frameworks / libraries",
    ].includes(normalized)
  )
    return frameworkBrand();
  if (["kotlin", "kt"].includes(normalized)) return letterMark("KT", "hexagon");
  if (normalized === "swift") return letterMark("SW", "rounded");
  if (normalized === "ruby") return letterMark("RB", "hexagon");
  if (normalized === "dart") return letterMark("D", "hexagon");
  if (normalized === "scala") return letterMark("SC", "rounded");
  if (normalized === "r") return letterMark("R", "oval");
  if (["sql", "pl/sql", "tsql", "t-sql"].includes(normalized)) {
    return svg(
      '<ellipse cx="16" cy="7" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 7v18c0 2.2 4.5 4 10 4s10-1.8 10-4V7M6 16c0 2.2 4.5 4 10 4s10-1.8 10-4" fill="none" stroke="currentColor" stroke-width="2"/>',
    );
  }
  if (["bash", "shell", "zsh"].includes(normalized)) return letterMark(">_");
  if (["powershell", "power shell"].includes(normalized))
    return letterMark("PS");
  if (["visual basic", "vb", "vb.net"].includes(normalized))
    return letterMark("VB");
  if (["f#", "fsharp"].includes(normalized)) return letterMark("F#", "hexagon");
  if (normalized === "objective-c") return letterMark("ObjC", "rounded");
  if (normalized === "solidity") return letterMark("SOL", "hexagon");
  if (normalized === "elixir") return letterMark("EX", "rounded");
  if (normalized === "erlang") return letterMark("ER", "rounded");
  if (normalized === "haskell") return letterMark("HS", "rounded");
  if (normalized === "lua") return letterMark("Lua", "oval");
  if (normalized === "perl") return letterMark("PL", "oval");
  if (normalized === "matlab") return letterMark("MAT", "rounded");
  if (normalized === "groovy") return letterMark("GV", "rounded");
  if (["assembly", "assembler", "asm"].includes(normalized))
    return letterMark("ASM");
  if (normalized === "cobol") return letterMark("COB");
  const automaticDevicon = getDeviconMarkup(
    normalized.replace(/[^a-z0-9]/g, ""),
  );
  if (automaticDevicon) return automaticDevicon;
  return letterMark(escapeIconText(technology.slice(0, 3).toLocaleUpperCase("en-US")));
};
import { getDeviconMarkup } from "./deviconCatalog";

/** Preserve the existing icon catalogue and manual priority, with CV theme colors. */
export const getThemedTechnologyIconMarkup = (title: string, iconId = "") =>
  getTechnologyBrandIconMarkup(title, iconId)
    .replace(/(fill|stroke|stop-color)="(?!none"|currentColor"|white"|#fff"|#ffffff"|url\()[^"]+"/gi, '$1="currentColor"')
    .replace(/(fill|stroke|stop-color):\s*(#[0-9a-f]{3,8}|rgb\([^)]*\))/gi, "$1:currentColor");
