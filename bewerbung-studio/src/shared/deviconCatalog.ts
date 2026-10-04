const originalIcons = import.meta.glob(
  "/node_modules/devicon/icons/*/*-original.svg",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const plainIcons = import.meta.glob(
  "/node_modules/devicon/icons/*/*-plain.svg",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const iconNameFromPath = (path: string) =>
  path.match(/\/icons\/([^/]+)\/[^/]+-(?:original|plain)\.svg$/)?.[1] ?? "";

const readableIconName = (name: string) =>
  name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));

const namespaceSvgIds = (markup: string, iconName: string) => {
  const prefix = `devicon-${iconName}-`;
  const ids = Array.from(
    markup.matchAll(/\bid="([^"]+)"/g),
    (match) => match[1],
  );
  return ids.reduce(
    (current, id) =>
      current
        .replaceAll(`id="${id}"`, `id="${prefix}${id}"`)
        .replaceAll(`url(#${id})`, `url(#${prefix}${id})`)
        .replaceAll(`href="#${id}"`, `href="#${prefix}${id}"`),
    markup,
  );
};

const prepareSvg = (markup: string, iconName: string) =>
  namespaceSvgIds(markup, iconName)
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/<!--[^]*?-->/g, "")
    .trim()
    .replace(
      /<svg\b/,
      `<svg class="technology-brand-svg" data-brand="devicon:${iconName}"`,
    );

const iconMarkup = new Map<string, string>();

for (const [path, markup] of Object.entries(plainIcons)) {
  const name = iconNameFromPath(path);
  if (name) iconMarkup.set(name, prepareSvg(markup, name));
}

for (const [path, markup] of Object.entries(originalIcons)) {
  const name = iconNameFromPath(path);
  if (name) iconMarkup.set(name, prepareSvg(markup, name));
}

export const deviconOptions = Array.from(iconMarkup.keys())
  .sort((left, right) => left.localeCompare(right, "en"))
  .map((id) => ({ id, label: readableIconName(id) }));

export const getDeviconMarkup = (iconId: string) =>
  iconMarkup.get(iconId.trim().toLocaleLowerCase("en-US"));

export const hasDevicon = (iconId: string) => Boolean(getDeviconMarkup(iconId));
