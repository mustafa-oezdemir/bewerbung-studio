type GoFrameworkIcon =
  | "echo" | "chi" | "buffalo" | "gin" | "fyne" | "gorilla" | "beego"
  | "revel" | "gokit" | "krakend" | "fx" | "goa" | "iris" | "flamingo";

const icon = (brand: GoFrameworkIcon, content: string, viewBox = "0 0 32 32") =>
  `<svg class="technology-brand-svg" data-brand="${brand}" viewBox="${viewBox}" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

// Compact vector marks for the CV, icon picker and generated PDF. Fiber and Hugo use bundled Devicon logos.
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
  fyne: icon("fyne",
    '<rect x="3" y="3" width="26" height="26" rx="3" fill="#006bd7"/><circle cx="16" cy="16" r="3.3" fill="#e6f8ff"/><path d="M16 5v7M16 20v7M5 16h7M20 16h7M8.2 8.2l5 5M18.8 18.8l5 5M23.8 8.2l-5 5M13.2 18.8l-5 5" stroke="#8be2ff" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="5" r="1.5" fill="#fff"/><circle cx="27" cy="16" r="1.5" fill="#fff"/><circle cx="16" cy="27" r="1.5" fill="#fff"/><circle cx="5" cy="16" r="1.5" fill="#fff"/>'),
  gorilla: icon("gorilla",
    '<circle cx="5" cy="17" r="4" fill="#777"/><circle cx="27" cy="17" r="4" fill="#777"/><path d="M6 16c0-8 4-13 10-13s10 5 10 13v7c0 4-4 7-10 7S6 27 6 23z" fill="#65686a"/><path d="M9 18c0-5 3-8 7-8s7 3 7 8v6c0 3-3 5-7 5s-7-2-7-5z" fill="#a6a8a8"/><ellipse cx="12" cy="17" rx="2.2" ry="2.7" fill="#fff"/><ellipse cx="20" cy="17" rx="2.2" ry="2.7" fill="#fff"/><circle cx="12.5" cy="17" r=".9" fill="#202426"/><circle cx="19.5" cy="17" r=".9" fill="#202426"/><path d="M14 22h4l-2 2z" fill="#303335"/><path d="M13 26q3 2 6 0" fill="none" stroke="#3c3f40" stroke-width="1.2" stroke-linecap="round"/>'),
  beego: icon("beego",
    '<path d="M12 9 8 5M20 9l4-4" stroke="#26333b" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="5" r="2" fill="#26333b"/><circle cx="24" cy="5" r="2" fill="#26333b"/><ellipse cx="16" cy="19" rx="11" ry="11" fill="#dd413c"/><path d="M16 8v22" stroke="#26333b" stroke-width="2"/><ellipse cx="16" cy="10" rx="6" ry="4" fill="#26333b"/><circle cx="10" cy="17" r="2" fill="#26333b"/><circle cx="22" cy="17" r="2" fill="#26333b"/><circle cx="11" cy="24" r="2" fill="#26333b"/><circle cx="21" cy="24" r="2" fill="#26333b"/><path d="M3 18h4M25 18h4" stroke="#26333b" stroke-width="1.5" stroke-linecap="round"/>'),
  revel: icon("revel",
    '<path d="M4 4v24h6V14l14 14h5L10 4z" fill="#343a40"/><path d="m12 4 17 17v7L12 11z" fill="#7c858d"/><path d="M4 4h6l7 7-5 5z" fill="#e7ebed"/>'),
  gokit: icon("gokit",
    '<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 16h26M16 3v26M6 9h20M6 23h20M16 3c-5 3-8 7-8 13s3 10 8 13M16 3c5 3 8 7 8 13s-3 10-8 13" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  krakend: icon("krakend",
    '<circle cx="16" cy="16" r="12" fill="none" stroke="#1261b8" stroke-width="2"/><circle cx="16" cy="16" r="7" fill="none" stroke="#267dd4" stroke-width="1.8"/><path d="M4 16h8M20 16h8M16 4v8M16 20v8" stroke="#1261b8" stroke-width="1.6"/><circle cx="16" cy="16" r="2.5" fill="#267dd4"/><circle cx="7" cy="7" r="2" fill="#1261b8"/><circle cx="25" cy="25" r="2" fill="#1261b8"/>'),
  fx: icon("fx",
    '<circle cx="16" cy="16" r="14" fill="#3c4144"/><path d="m7 12 9 5 9-5v8l-9 5-9-5z" fill="#f3f5f4"/><path d="m10 9 6-3 6 3-6 3z" fill="#bbc3c4"/><path d="M16 17v8" stroke="#8f999b" stroke-width="1.5"/>'),
  goa: icon("goa",
    '<rect x="6" y="3" width="20" height="26" rx="2" fill="#f6f8fa" stroke="#7b8790" stroke-width="1.5"/><path d="M20 3v6h6" fill="#dce7ee" stroke="#7b8790" stroke-width="1.2"/><path d="M10 12h12M10 16h12M10 20h8M10 24h10" stroke="#48a4c5" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="8" r="1.4" fill="#efa956"/>'),
  iris: icon("iris",
    '<path d="M16 3 28 8v13c0 5-5 8-12 10C9 29 4 26 4 21V8z" fill="#007bbf"/><path d="M16 5 26 9v12c0 3.5-4 6-10 8" fill="#164c99"/><path d="M6 18c3-5 6-7 10-7s7 2 10 7c-3 5-6 7-10 7s-7-2-10-7z" fill="#f3c92d"/><circle cx="16" cy="18" r="4.2" fill="#fff"/><circle cx="16" cy="18" r="2.2" fill="#1085bd"/><circle cx="16" cy="18" r=".9" fill="#26364b"/>'),
  flamingo: icon("flamingo",
    '<path d="M16 2 28 9v14l-12 7L4 23V9z" fill="#2c3136"/><path d="M9 10h15v4H14v4h8v4h-8v5H9z" fill="#0c1013"/><path d="m16 3 11 6-11 6-11-6z" fill="#3d444b" opacity=".8"/>'),
};

export const goFrameworkIconOptions = [
  { id: "go-framework:echo", label: "Echo" },
  { id: "fiber", label: "Fiber" },
  { id: "go-framework:chi", label: "Chi" },
  { id: "go-framework:buffalo", label: "Buffalo" },
  { id: "go-framework:gin", label: "Gin" },
  { id: "go-framework:fyne", label: "Fyne" },
  { id: "hugo", label: "Hugo" },
  { id: "go-framework:gorilla", label: "Gorilla" },
  { id: "go-framework:beego", label: "Beego" },
  { id: "go-framework:revel", label: "Revel" },
  { id: "go-framework:gokit", label: "Go kit" },
  { id: "go-framework:krakend", label: "KrakenD" },
  { id: "go-framework:fx", label: "Fx" },
  { id: "go-framework:goa", label: "Goa" },
  { id: "go-framework:iris", label: "Iris" },
  { id: "go-framework:flamingo", label: "Flamingo" },
] as const;

const nameToIcon: Record<string, GoFrameworkIcon> = {
  echo: "echo", "echo framework": "echo", "labstack echo": "echo", "labstack/echo": "echo",
  chi: "chi", "go chi": "chi", "go-chi": "chi", "chi router": "chi", "chi introduction": "chi", "chi 👋 introduction": "chi",
  buffalo: "buffalo", gobuffalo: "buffalo", "go buffalo": "buffalo",
  gin: "gin", "gin web framework": "gin", "gin-gonic": "gin", "gin gonic": "gin",
  fyne: "fyne", "fyne gui": "fyne",
  gorilla: "gorilla", "gorilla toolkit": "gorilla", "gorilla web toolkit": "gorilla", "gorilla, the golang web toolkit": "gorilla",
  beego: "beego", "beego framework": "beego",
  revel: "revel", "revel go web framework": "revel", "revel - go web framework": "revel",
  "go kit": "gokit", "go-kit": "gokit", gokit: "gokit", "go kit - a toolkit for microservices": "gokit",
  krakend: "krakend", "krakend api gateway": "krakend",
  fx: "fx", "uber fx": "fx", "go fx": "fx",
  goa: "goa", "goa.design": "goa", "goa design": "goa",
  iris: "iris", "iris web framework": "iris", "iris web framework - the fastest http/2 go framework": "iris",
  flamingo: "flamingo", "flamingo documentations": "flamingo", "flamingo framework": "flamingo",
};

export const getGoFrameworkIconMarkup = (iconId: string) => {
  const brand = iconId.startsWith("go-framework:") ? iconId.slice("go-framework:".length) : "";
  return Object.hasOwn(marks, brand) ? marks[brand as GoFrameworkIcon] : undefined;
};

export const getAutomaticGoFrameworkIconMarkup = (name: string) => {
  const brand = nameToIcon[name];
  return brand ? marks[brand] : undefined;
};
