import {
  programmingLanguageBackgroundTokens,
  type DocumentBackgroundId,
} from "../../shared/documentDesign";
import { getTechnologyBrandIconMarkup } from "../../shared/technologyBrand";

export function DocumentBackgroundLayer({
  backgroundId,
  atsMode = false,
}: {
  backgroundId: DocumentBackgroundId;
  atsMode?: boolean;
}) {
  if (backgroundId !== "programming-languages-bg" || atsMode) return null;
  return (
    <div
      className="document-background-layer programming-languages-layer"
      aria-hidden="true"
    >
      {programmingLanguageBackgroundTokens.map((token) => (
        <span className="programming-language-token" key={token}>
          <i
            dangerouslySetInnerHTML={{
              __html: getTechnologyBrandIconMarkup(token),
            }}
          />
          <b>{token}</b>
        </span>
      ))}
    </div>
  );
}
