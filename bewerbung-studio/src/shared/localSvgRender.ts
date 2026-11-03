import { DOMParser } from "linkedom";

const unsafeTag = /^(script|foreignobject|iframe|object|embed)$/i;
const urlReference = /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi;
const colorPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const assertLocalReferences = (value: string, brand: string) => {
  if (/@import/i.test(value)) throw new Error(`Unsafe local SVG: ${brand}`);
  for (const match of value.matchAll(urlReference)) {
    if (!/^#[\w.-]+$/.test(match[2]!)) throw new Error(`Unsafe local SVG: ${brand}`);
  }
};

const luminance = (paint: string) => {
  const value = paint.slice(1);
  const rgb = value.length <= 4 ? value.slice(0, 3).split("").map((digit) => parseInt(digit + digit, 16))
    : [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  return rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
};

/** Parse local SVGs as XML so attributes, defs and references are handled as nodes. */
export const renderLocalSvg = (source: string, brand: string, variant: string, mode: "original" | "themed") => {
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(source)) throw new Error(`Unsafe local SVG: ${brand}`);
  const document = new DOMParser().parseFromString(source.replace(/<\?xml[^>]*>/g, ""), "image/svg+xml");
  const svg = document.documentElement;
  if (svg.localName !== "svg") throw new Error(`Invalid local SVG: ${brand}`);
  const nodes = [svg, ...Array.from(svg.querySelectorAll("*"))];
  for (const node of nodes) {
    if (unsafeTag.test(node.localName)) throw new Error(`Unsafe local SVG: ${brand}`);
    for (const attr of Array.from(node.attributes as NamedNodeMap)) {
      if (/^on/i.test(attr.name) || /^(?:href|src|xlink:href)$/i.test(attr.name) && !/^#[\w.-]+$/.test(attr.value))
        throw new Error(`Unsafe local SVG: ${brand}`);
      assertLocalReferences(attr.value, brand);
    }
  }
  const prefix = `${brand.replace(/[^a-zA-Z0-9_-]/g, "-")}-${variant.replace(/[^a-zA-Z0-9_-]/g, "-")}-${mode}-`;
  const ids = new Map(nodes.map((node) => node.getAttribute("id")).filter((id): id is string => Boolean(id)).map((id) => [id, `${prefix}${id}`]));
  for (const node of nodes) for (const attr of Array.from(node.attributes as NamedNodeMap)) {
    let value = attr.value;
    if (attr.name === "id" && ids.has(value)) value = ids.get(value)!;
    else for (const [id, namespaced] of ids) value = value.replaceAll(`url(#${id})`, `url(#${namespaced})`).replaceAll(`#${id}`, attr.name.endsWith("href") && value === `#${id}` ? `#${namespaced}` : `#${id}`);
    if (value !== attr.value) node.setAttribute(attr.name, value);
  }
  for (const style of Array.from(svg.querySelectorAll("style"))) {
    let css = style.textContent ?? "";
    assertLocalReferences(css, brand);
    for (const [id, namespaced] of ids) css = css.replaceAll(`url(#${id})`, `url(#${namespaced})`);
    style.textContent = css;
  }
  svg.setAttribute("class", `${svg.getAttribute("class") ?? ""} technology-brand-svg`.trim());
  svg.setAttribute("data-brand", brand);
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  if (mode === "original") return svg.outerHTML;

  const paints: string[] = [];
  for (const node of nodes) for (const property of ["fill", "stroke", "stop-color"]) {
    const paint = node.getAttribute(property);
    if (paint && colorPattern.test(paint)) paints.push(paint.toLowerCase());
  }
  const shades = [...new Set(paints)].filter((paint) => luminance(paint) < 0.96);
  const brightest = Math.max(...shades.map(luminance));
  const theme = (paint: string) => {
    if (!colorPattern.test(paint)) return paint;
    const value = luminance(paint);
    if (value >= 0.96) return paint;
    if (shades.length <= 1 || brightest - value < 0.13) return "currentColor";
    return "color-mix(in srgb, currentColor 70%, black)";
  };
  for (const node of nodes) {
    for (const property of ["fill", "stroke", "stop-color"]) {
      const paint = node.getAttribute(property);
      if (paint) node.setAttribute(property, theme(paint));
    }
    const style = node.getAttribute("style");
    if (style) node.setAttribute("style", style.replace(/\b(fill|stroke|stop-color)\s*:\s*(#[0-9a-f]{3,8})/gi,
      (_match: string, property: string, paint: string) => `${property}:${theme(paint)}`));
  }
  for (const style of Array.from(svg.querySelectorAll("style"))) style.textContent = (style.textContent ?? "")
    .replace(/\b(fill|stroke|stop-color)\s*:\s*(#[0-9a-f]{3,8})/gi,
      (_match: string, property: string, paint: string) => `${property}:${theme(paint)}`);
  return svg.outerHTML;
};
