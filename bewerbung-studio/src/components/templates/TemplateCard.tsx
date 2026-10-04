import {
  Copy,
  Eye,
  FileOutput,
  FileText,
  FolderOpen,
  Heart,
  LibraryBig,
  Trash2,
} from "lucide-react";
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
  templateTypeLabels,
  zeitgenoessischLebenslaufTemplateConfig,
  wordMusterTemplateConfig,
} from "../../features/templates/template.constants";
import type { DocumentTemplate } from "../../features/templates/template.types";

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function TemplateCard({
  template,
  onUse,
  onDetails,
  onOpen,
  onOpenFolder,
  onDuplicate,
  onFavorite,
  onCopyToMuster,
  onRemove,
}: {
  template: DocumentTemplate;
  onUse: () => void;
  onDetails: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onDuplicate: () => void;
  onFavorite: () => void;
  onCopyToMuster: () => void;
  onRemove: () => void;
}) {
  const sourceLabel = templateSourceLabels[template.source];
  const isWordMuster = template.id === wordMusterTemplateConfig.id;
  const isElegant =
    template.id === elegantLebenslaufTemplateConfig.id;
  const isZeitgenoessisch =
    template.id === zeitgenoessischLebenslaufTemplateConfig.id;
  const isKreativ =
    template.id === kreativLebenslaufTemplateConfig.id;
  const isIvyLeague =
    template.id === ivyLeagueLebenslaufTemplateConfig.id;
  const isKompakt =
    template.id === kompaktLebenslaufTemplateConfig.id;
  const isStilvoll =
    template.id === stilvollLebenslaufTemplateConfig.id;
  const isEinspaltig =
    template.id === einspaltigLebenslaufTemplateConfig.id;
  const isKlassisch =
    template.id === klassischLebenslaufTemplateConfig.id;
  const isGepflegt = template.id === gepflegtLebenslaufTemplateConfig.id;
  const showsManagedFacts =
    isWordMuster ||
    isElegant ||
    isZeitgenoessisch ||
    isKreativ ||
    isIvyLeague ||
    isKompakt ||
    isStilvoll ||
    isEinspaltig ||
    isKlassisch ||
    isGepflegt;
  const modifiedLabel = template.modifiedAt
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(template.modifiedAt))
    : "Unbekannt";

  return (
    <article className="surface managed-template-card">
      <button
        className="managed-template-preview"
        type="button"
        aria-label={`${template.name} Vorschau öffnen`}
        onClick={onDetails}>
        {template.previewDataUrl ? (
          <img
            src={template.previewDataUrl}
            alt={`${template.name} Vorschau`}
          />
        ) : (
          <span className="managed-template-preview-fallback">
            <FileOutput size={38} />
            <strong>{template.name}</strong>
            <small>
              {template.format.toUpperCase()} · {modifiedLabel}
            </small>
          </span>
        )}
        <span>{template.format.toUpperCase()}</span>
      </button>
      <div className="managed-template-body">
        <header>
          <div>
            <small>
              {templateTypeLabels[template.documentType]} · {sourceLabel}
            </small>
            <h3>{template.name}</h3>
          </div>
          <button
            className={`icon-button ${template.isFavorite ? "favorite" : ""}`}
            type="button"
            title={
              template.isFavorite
                ? "Aus Favoriten entfernen"
                : "Als Favorit markieren"
            }
            onClick={onFavorite}>
            <Heart
              size={17}
              fill={template.isFavorite ? "currentColor" : "none"}
            />
          </button>
        </header>
        <p>
          {template.description ||
            `${template.extension.toUpperCase()} · ${fileSize(template.fileSize)}`}
        </p>
        {showsManagedFacts ? (
          <dl className="managed-template-facts">
            <div>
              <dt>Format</dt>
              <dd>{template.format.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Quelle</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div>
              <dt>Vorlagentyp</dt>
              <dd>{templateTypeLabels[template.documentType]}</dd>
            </div>
          </dl>
        ) : null}
        {isElegant ? (
          <ul className="managed-template-highlights">
            {elegantLebenslaufTemplateConfig.cardHighlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        ) : null}
        {isZeitgenoessisch ? (
          <ul className="managed-template-highlights contemporary">
            {zeitgenoessischLebenslaufTemplateConfig.cardHighlights.map(
              (highlight) => (
                <li key={highlight}>{highlight}</li>
              ),
            )}
          </ul>
        ) : null}
        {isKreativ ? (
          <ul className="managed-template-highlights creative">
            {kreativLebenslaufTemplateConfig.cardHighlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        ) : null}
        {isIvyLeague ? (
          <ul className="managed-template-highlights contemporary">
            {ivyLeagueLebenslaufTemplateConfig.cardHighlights.map(
              (highlight) => (
                <li key={highlight}>{highlight}</li>
              ),
            )}
          </ul>
        ) : null}
        {isKompakt ? (
          <ul className="managed-template-highlights compact">
            {kompaktLebenslaufTemplateConfig.cardHighlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        ) : null}
        {isStilvoll ? (
          <ul className="managed-template-highlights contemporary">
            {stilvollLebenslaufTemplateConfig.cardHighlights.map(
              (highlight) => (
                <li key={highlight}>{highlight}</li>
              ),
            )}
          </ul>
        ) : null}
        {isEinspaltig ? (
          <ul className="managed-template-highlights contemporary">
            {einspaltigLebenslaufTemplateConfig.cardHighlights.map(
              (highlight) => (
                <li key={highlight}>{highlight}</li>
              ),
            )}
          </ul>
        ) : null}
        {isKlassisch ? (
          <ul className="managed-template-highlights contemporary">
            {klassischLebenslaufTemplateConfig.cardHighlights.map(
              (highlight) => (
                <li key={highlight}>{highlight}</li>
              ),
            )}
          </ul>
        ) : null}
        {isGepflegt ? (
          <ul className="managed-template-highlights contemporary">
            {gepflegtLebenslaufTemplateConfig.cardHighlights.map(
              (highlight) => (
                <li key={highlight}>{highlight}</li>
              ),
            )}
          </ul>
        ) : null}
        {template.tags.length ? (
          <div className="managed-template-tags">
            {template.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="managed-template-primary-actions">
          <button
            className="button primary small-button"
            type="button"
            onClick={onUse}>
            <FileOutput size={15} /> Vorlage verwenden
          </button>
        </div>
        <div className="managed-template-secondary-actions">
          <button type="button" onClick={onDetails}>
            <Eye size={14} /> Vorschau
          </button>
          <button type="button" onClick={onOpen}>
            <FileText size={14} />{" "}
            {template.editableInWord ? "In Word öffnen" : "Öffnen"}
          </button>
          <button type="button" onClick={onDuplicate}>
            <Copy size={14} /> Duplizieren
          </button>
          <button type="button" onClick={onOpenFolder}>
            <FolderOpen size={14} /> Dateipfad öffnen
          </button>
          {template.source === "existing-document" ? (
            <button type="button" onClick={onCopyToMuster}>
              <LibraryBig size={14} /> Zu Muster hinzufügen
            </button>
          ) : null}
          {template.source === "muster-folder" &&
          !template.isSystemTemplate &&
          !template.isProtected ? (
            <button className="danger-link" type="button" onClick={onRemove}>
              <Trash2 size={14} /> Löschen
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
