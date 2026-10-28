import aspnetSvg from "../assets/technology/aspnet.svg?raw";
import dotnetSvg from "../assets/technology/dotnet.svg?raw";

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

const iconLabels: Record<string, string> = {
  aspnet: "ASP.NET", blazor: "Blazor", csharp: "C#", dotnet: ".NET",
  dotnetcore: ".NET Core", entityframeworkcore: "Entity Framework Core",
  fsharp: "F#", nuget: "NuGet", visualbasic: "Visual Basic .NET",
  xamarin: "Xamarin",
};
const readableIconName = (name: string) =>
  iconLabels[name] ?? name
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

const prepareSvg = (markup: string, iconName: string, brand = `devicon:${iconName}`) =>
  namespaceSvgIds(markup, iconName)
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/<!--[^]*?-->/g, "")
    .trim()
    .replace(
      /<svg\b/,
      `<svg class="technology-brand-svg" data-brand="${brand}"`,
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

// Use the published Devicon shapes in one colour so CV template icon colours apply.
const themedDevicons = [
  "angular", "blazor", "csharp", "dotnetcore", "entityframeworkcore",
  "fsharp", "nuget", "visualbasic", "xamarin",
];
for (const name of themedDevicons) {
  const source = Object.entries(plainIcons).find(([path]) => iconNameFromPath(path) === name)?.[1]
    ?? Object.entries(originalIcons).find(([path]) => iconNameFromPath(path) === name)?.[1];
  if (source) {
    const monochrome = source
      .replace(/\b(fill|stroke)="#[0-9a-f]{3,8}"/gi, '$1="currentColor"')
      .replace(/<svg\b/, '<svg fill="currentColor"');
    iconMarkup.set(name, prepareSvg(monochrome, name));
  }
}

// Source: https://github.com/dotnet/brand/blob/main/logo/dotnet-logo.svg
// The original glyphs form cutouts in a theme-coloured square.
iconMarkup.set("dotnet", prepareSvg(dotnetSvg, "dotnet", "dotnet"));
// Source: https://www.svgrepo.com/svg/508894/aspnet (CC0 vector wordmark)
iconMarkup.set("aspnet", prepareSvg(aspnetSvg, "aspnet", "aspnet"));

export const deviconOptions = Array.from(iconMarkup.keys())
  .sort((left, right) => left.localeCompare(right, "en"))
  .map((id) => ({ id, label: readableIconName(id) }));

const dotnetIconIds = new Set([
  "aspnet", "blazor", "csharp", "dotnet", "dotnetcore",
  "entityframeworkcore", "fsharp", "nuget", "visualbasic", "xamarin",
]);
export const dotnetIconOptions = deviconOptions.filter((option) => dotnetIconIds.has(option.id));
export const otherDeviconOptions = deviconOptions.filter((option) => !dotnetIconIds.has(option.id));

export const getDeviconMarkup = (iconId: string) =>
  iconMarkup.get(iconId.trim().toLocaleLowerCase("en-US"));

export const hasDevicon = (iconId: string) => Boolean(getDeviconMarkup(iconId));
