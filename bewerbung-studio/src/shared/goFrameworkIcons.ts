type GoFrameworkIcon = "echo" | "chi" | "buffalo" | "gin";

const icon = (brand: GoFrameworkIcon, content: string, viewBox = "0 0 32 32") =>
  `<svg class="technology-brand-svg" data-brand="${brand}" viewBox="${viewBox}" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

// Compact vector marks for the CV, icon picker and generated PDF. Fiber uses its bundled Devicon logo.
const marks: Record<GoFrameworkIcon, string> = {
  echo: icon("echo",
    '<path d="M3 4 14 10v16L3 20z" fill="#15b8d4"/><path d="M3 20 14 26v4L3 24z" fill="#088aab"/><path d="M17 11 29 18v12L17 23z" fill="#29c9df"/>'),
  chi: icon("chi",
    '<path d="M14 11h-4a6 6 0 0 0 0 12h4M19 6v9h2a4 4 0 0 1 4 4v4" fill="none" stroke="#00a653" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="7" r="2.5" fill="#84c420"/><path d="M31 14v9" fill="none" stroke="#00a653" stroke-width="4.5" stroke-linecap="round"/>',
    "0 0 36 32"),
  buffalo: icon("buffalo",
    '<path d="M7 12 3 9l1 7 3 2M25 12l4-3-1 7-3 2" fill="#6e482f"/><circle cx="16" cy="16" r="12" fill="#72523b"/><path d="M6 15c-2-7 4-12 10-12 7 0 12 5 10 12-2-4-5-6-10-6S8 11 6 15z" fill="#4b3429"/><ellipse cx="16" cy="19" rx="9.5" ry="8" fill="#6bc8d4"/><ellipse cx="11.5" cy="18" rx="3.3" ry="4" fill="#fff"/><ellipse cx="20.5" cy="18" rx="3.3" ry="4" fill="#fff"/><circle cx="12" cy="18" r="1.4" fill="#26313a"/><circle cx="20" cy="18" r="1.4" fill="#26313a"/><ellipse cx="16" cy="24" rx="3.4" ry="2.1" fill="#f4eee5"/><path d="M14 23.5h4" stroke="#4b3429" stroke-width="1.2" stroke-linecap="round"/>'),
  gin: icon("gin",
    '<path d="M5 10h22l-2.6 18.5c-.2 1.5-1.5 2.5-3 2.5H10.6c-1.5 0-2.8-1-3-2.5z" fill="#009dcc"/><path d="M5 10h22l-.6 4H5.6z" fill="#007eaa"/><path d="m15 9 12-7-3 11-8 1z" fill="#ffd132"/><path d="m17 9 10-7-3 7z" fill="#ffe56d"/><circle cx="12" cy="21" r="2.5" fill="#fff"/><circle cx="20" cy="21" r="2.5" fill="#fff"/><circle cx="12.5" cy="21.3" r="1" fill="#16384a"/><circle cx="19.5" cy="21.3" r="1" fill="#16384a"/><path d="M14 26q2 1.5 4 0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>'),
};

export const goFrameworkIconOptions = [
  { id: "go-framework:echo", label: "Echo" },
  { id: "fiber", label: "Fiber" },
  { id: "go-framework:chi", label: "Chi" },
  { id: "go-framework:buffalo", label: "Buffalo" },
  { id: "go-framework:gin", label: "Gin" },
] as const;

const nameToIcon: Record<string, GoFrameworkIcon> = {
  echo: "echo", "echo framework": "echo", "labstack echo": "echo", "labstack/echo": "echo",
  chi: "chi", "go chi": "chi", "go-chi": "chi", "chi router": "chi",
  buffalo: "buffalo", gobuffalo: "buffalo", "go buffalo": "buffalo",
  gin: "gin", "gin web framework": "gin", "gin-gonic": "gin", "gin gonic": "gin",
};

export const getGoFrameworkIconMarkup = (iconId: string) => {
  const brand = iconId.startsWith("go-framework:") ? iconId.slice("go-framework:".length) : "";
  return Object.hasOwn(marks, brand) ? marks[brand as GoFrameworkIcon] : undefined;
};

export const getAutomaticGoFrameworkIconMarkup = (name: string) => {
  const brand = nameToIcon[name];
  return brand ? marks[brand] : undefined;
};
