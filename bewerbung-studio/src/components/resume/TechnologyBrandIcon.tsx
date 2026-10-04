import { getTechnologyBrandIconMarkup } from "../../shared/technologyBrand";

export function TechnologyBrandIcon({
  technology,
  iconId = "",
  className = "",
}: {
  technology: string;
  iconId?: string;
  className?: string;
}) {
  return (
    <span
      className={`technology-brand-icon ${className}`.trim()}
      data-technology={technology}
      style={iconId.startsWith("symbol:") ? { color: "inherit", background: "none" } : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: getTechnologyBrandIconMarkup(technology, iconId),
      }}
    />
  );
}
