import { isBulletSymbolId } from "../../shared/strengthSymbols";
import { useLocalSvgCatalog } from "../useLocalSvgCatalog";
import { getDeckblattTechnologyIconMarkup, getThemedTechnologyIconMarkup } from "../../shared/technologyBrand";

export function TechnologyBrandIcon({
  technology,
  iconId = "",
  className = "",
  mode = "themed",
}: {
  technology: string;
  iconId?: string;
  className?: string;
  mode?: "original" | "themed";
}) {
  useLocalSvgCatalog();
  return (
    <span
      className={`technology-brand-icon ${className}`.trim()}
      data-technology={technology}
      style={isBulletSymbolId(iconId) ? { color: "inherit", background: "none" } : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: mode === "original"
          ? getDeckblattTechnologyIconMarkup(technology, iconId)
          : getThemedTechnologyIconMarkup(technology, iconId),
      }}
    />
  );
}
