import { mkdir, readFile, rm, writeFile } from "../security/secure-fs";
import path from "node:path";
import type { ApplicationPaths } from "../../src/config/application-paths";
import {
  einspaltigLebenslaufTemplateConfig,
  elegantLebenslaufTemplateConfig,
  gepflegtLebenslaufTemplateConfig,
  ivyLeagueLebenslaufTemplateConfig,
  klassischLebenslaufTemplateConfig,
  kompaktLebenslaufTemplateConfig,
  kreativLebenslaufTemplateConfig,
  stilvollLebenslaufTemplateConfig,
  templateSourceLabels,
  zeitgenoessischLebenslaufTemplateConfig,
} from "../../src/features/templates/template.constants";
import type { DocumentTemplate } from "../../src/features/templates/template.types";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export class TemplatePreviewService {
  constructor(private readonly paths: ApplicationPaths) {}

  async generate(template: DocumentTemplate) {
    await mkdir(this.paths.previewCache, { recursive: true });
    const version = new Date(template.modifiedAt ?? 0).getTime();
    const managedPreviewConfig =
      template.id === elegantLebenslaufTemplateConfig.id
        ? elegantLebenslaufTemplateConfig
        : template.id === zeitgenoessischLebenslaufTemplateConfig.id
          ? zeitgenoessischLebenslaufTemplateConfig
          : template.id === kreativLebenslaufTemplateConfig.id
            ? kreativLebenslaufTemplateConfig
            : template.id === ivyLeagueLebenslaufTemplateConfig.id
              ? ivyLeagueLebenslaufTemplateConfig
            : template.id === kompaktLebenslaufTemplateConfig.id
              ? kompaktLebenslaufTemplateConfig
              : template.id === stilvollLebenslaufTemplateConfig.id
                ? stilvollLebenslaufTemplateConfig
                : template.id === einspaltigLebenslaufTemplateConfig.id
                  ? einspaltigLebenslaufTemplateConfig
                  : template.id === klassischLebenslaufTemplateConfig.id
                    ? klassischLebenslaufTemplateConfig
                      : template.id === gepflegtLebenslaufTemplateConfig.id
                      ? gepflegtLebenslaufTemplateConfig
                      : undefined;
    if (managedPreviewConfig && this.paths.bundledTemplatesRoot) {
      try {
        const preview = await readFile(
          path.join(
            this.paths.bundledTemplatesRoot,
            managedPreviewConfig.previewFileName,
          ),
        );
        const previewPath = path.join(
          this.paths.previewCache,
          `${template.id}-${version}.png`,
        );
        await writeFile(previewPath, preview);
        return {
          previewImagePath: previewPath,
          previewDataUrl: `data:image/png;base64,${preview.toString("base64")}`,
        };
      } catch {
        // The generic Word preview below remains a safe fallback.
      }
    }
    const fileName = `${template.id}-${version}.svg`;
    const previewPath = path.join(this.paths.previewCache, fileName);
    const typeLabel =
      template.documentType === "anschreiben"
        ? "ANSCHREIBEN"
        : template.documentType === "deckblatt"
          ? "DECKBLATT"
          : "LEBENSLAUF";
    const modifiedLabel = template.modifiedAt
      ? new Intl.DateTimeFormat("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(template.modifiedAt))
      : "Änderungsdatum unbekannt";
    const sourceLabel = templateSourceLabels[template.source];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594" viewBox="0 0 420 594">
      <rect width="420" height="594" rx="8" fill="#fff"/>
      <rect x="34" y="38" width="352" height="5" rx="2.5" fill="#2b579a"/>
      <text x="34" y="76" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#2b579a">${typeLabel}</text>
      <rect x="34" y="92" width="44" height="50" rx="4" fill="#2b579a"/>
      <text x="48" y="126" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#fff">W</text>
      <text x="92" y="116" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#1d2927">${escapeXml(template.name.slice(0, 23))}</text>
      <text x="92" y="138" font-family="Arial,sans-serif" font-size="11" fill="#71807c">${escapeXml(template.format.toUpperCase())} &#183; ${escapeXml(sourceLabel)}</text>
      <rect x="34" y="160" width="330" height="6" rx="3" fill="#e5ebe9"/>
      <rect x="34" y="174" width="310" height="6" rx="3" fill="#e5ebe9"/>
      <rect x="34" y="218" width="170" height="9" rx="4" fill="#9aaba6"/>
      ${Array.from({ length: 12 }, (_, index) => `<rect x="34" y="${246 + index * 20}" width="${index % 3 === 0 ? 330 : 300}" height="6" rx="3" fill="#e5ebe9"/>`).join("")}
      <text x="34" y="540" font-family="Arial,sans-serif" font-size="12" fill="#71807c">Geändert: ${escapeXml(modifiedLabel)}</text>
      <text x="34" y="560" font-family="Arial,sans-serif" font-size="12" fill="#71807c">${escapeXml(template.format.toUpperCase())} &#183; ${escapeXml(sourceLabel)}</text>
    </svg>`;
    try {
      await readFile(previewPath);
    } catch {
      await writeFile(previewPath, svg, "utf8");
      const files = await import("node:fs/promises").then((fs) =>
        fs.readdir(this.paths.previewCache),
      );
      await Promise.all(
        files
          .filter(
            (entry) =>
              entry.startsWith(`${template.id}-`) && entry !== fileName,
          )
          .map((entry) =>
            rm(path.join(this.paths.previewCache, entry), { force: true }),
          ),
      );
    }
    return {
      previewImagePath: previewPath,
      previewDataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    };
  }
}
