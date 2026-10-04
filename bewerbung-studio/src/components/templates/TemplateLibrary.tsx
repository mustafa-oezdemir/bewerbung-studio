import { FilePlus2, Filter, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  templateSourceLabels,
  templateTypeLabels,
} from "../../features/templates/template.constants";
import { useTemplateStore } from "../../features/templates/template.store";
import type {
  DocumentTemplate,
  TemplateDocumentType,
} from "../../features/templates/template.types";
import { useAppStore } from "../../store/useAppStore";
import { TemplateCard } from "./TemplateCard";
import { TemplateTabs, type TemplateTab } from "./TemplateTabs";

export function TemplateLibrary() {
  const applications = useAppStore((state) => state.workspace.applications);
  const {
    templates,
    warnings,
    scannedAt,
    loading,
    error,
    notice,
    load,
    add,
    use,
    duplicate,
    copyToMuster,
    toggleFavorite,
    remove,
    open,
    openFolder,
    clearMessage,
  } = useTemplateStore();
  const [activeTab, setActiveTab] = useState<TemplateTab>("all");
  const [query, setQuery] = useState("");
  const [extension, setExtension] = useState("all");
  const [source, setSource] = useState("all");
  const [details, setDetails] = useState<DocumentTemplate>();
  const [useTemplate, setUseTemplate] = useState<DocumentTemplate>();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!error && !notice) return;
    const timeout = window.setTimeout(clearMessage, 4500);
    return () => window.clearTimeout(timeout);
  }, [clearMessage, error, notice]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    return templates.filter((template) => {
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "documents" &&
          template.source === "existing-document") ||
        (activeTab === "favorites" && template.isFavorite) ||
        template.documentType === activeTab;
      const haystack = [
        template.name,
        template.fileName,
        template.documentType,
        template.extension,
        template.source,
        ...template.tags,
      ]
        .join(" ")
        .toLocaleLowerCase("de-DE");
      return (
        matchesTab &&
        (!normalized || haystack.includes(normalized)) &&
        (extension === "all" || template.extension === extension) &&
        (source === "all" ||
          (source === "system" && template.isSystemTemplate) ||
          (source === "custom" &&
            (template.source === "muster-folder" ||
              template.source === "uploaded-word-template") &&
            !template.isSystemTemplate) ||
          (source === "documents" && template.source === "existing-document"))
      );
    });
  }, [activeTab, extension, query, source, templates]);

  const confirmRemove = (template: DocumentTemplate) => {
    if (
      window.confirm(
        `Eigene Vorlage „${template.name}“ wirklich löschen? Das Original eigener Anschreiben wird niemals gelöscht.`,
      )
    ) {
      void remove(template.id);
    }
  };

  return (
    <div className="template-library">
      <section className="surface template-library-toolbar">
        <div className="template-toolbar-title">
          <div>
            <p className="eyebrow">Lokale Word-Bibliothek</p>
            <h2>Vorlagen</h2>
            <p>Muster und vorhandene Anschreiben sicher wiederverwenden.</p>
          </div>
          <button
            className="button secondary"
            type="button"
            disabled={loading}
            onClick={() => void load()}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Vorlagen neu laden
          </button>
        </div>
        <div className="template-add-actions">
          {(
            [
              ["anschreiben", "Anschreiben hinzufügen"],
              ["deckblatt", "Deckblatt hinzufügen"],
              ["lebenslauf", "Lebenslauf hinzufügen"],
            ] as Array<[TemplateDocumentType, string]>
          ).map(([type, label]) => (
            <button
              className="button secondary small-button"
              type="button"
              key={type}
              onClick={() => void add(type)}>
              <FilePlus2 size={15} /> {label}
            </button>
          ))}
        </div>
        <TemplateTabs active={activeTab} onChange={setActiveTab} />
        <div className="template-search-filters">
          <label className="template-search">
            <Search size={16} />
            <input
              value={query}
              placeholder="Dateiname, Vorlage, Typ, Tag oder Quelle suchen …"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <Filter size={15} />
            <select
              value={extension}
              onChange={(event) => setExtension(event.target.value)}>
              <option value="all">Alle Formate</option>
              <option value=".docx">DOCX</option>
              <option value=".dotx">DOTX</option>
              <option value=".doc">DOC</option>
            </select>
          </label>
          <label>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}>
              <option value="all">Alle Quellen</option>
              <option value="system">Systemvorlagen</option>
              <option value="custom">Eigene Vorlagen</option>
              <option value="documents">Eigene Dokumente</option>
            </select>
          </label>
        </div>
      </section>

      {warnings.length ? (
        <section className="template-warning">
          <strong>Einige Dateien konnten nicht gelesen werden.</strong>
          {warnings.slice(0, 3).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </section>
      ) : null}

      <div className="template-library-status">
        <strong>{filtered.length} Vorlagen</strong>
        <span>
          {scannedAt
            ? `Zuletzt geladen: ${new Intl.DateTimeFormat("de-DE", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(scannedAt))}`
            : "Noch nicht geladen"}
        </span>
      </div>

      {filtered.length ? (
        <section className="managed-template-grid">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={() => setUseTemplate(template)}
              onDetails={() => setDetails(template)}
              onOpen={() => void open(template.id)}
              onOpenFolder={() => void openFolder(template.id)}
              onDuplicate={() => void duplicate(template.id)}
              onFavorite={() => void toggleFavorite(template.id)}
              onCopyToMuster={() => void copyToMuster(template.id)}
              onRemove={() => confirmRemove(template)}
            />
          ))}
        </section>
      ) : (
        <section className="surface managed-template-empty">
          <FilePlus2 size={32} />
          <h3>Keine Vorlagen gefunden</h3>
          <p>
            Passen Sie Suche und Filter an oder fügen Sie eine Word-Vorlage
            hinzu.
          </p>
        </section>
      )}

      {(error || notice) && (
        <button
          className={`toast ${error ? "error" : "success"}`}
          type="button"
          onClick={clearMessage}>
          {error || notice} <X size={15} />
        </button>
      )}
      {details ? (
        <TemplateDetailsDialog
          template={details}
          onClose={() => setDetails(undefined)}
          onUse={() => {
            setDetails(undefined);
            setUseTemplate(details);
          }}
        />
      ) : null}
      {useTemplate ? (
        <UseTemplateDialog
          template={useTemplate}
          applications={applications}
          onClose={() => setUseTemplate(undefined)}
          onUse={(applicationId, atsMode) => {
            void use(useTemplate.id, applicationId, atsMode);
            setUseTemplate(undefined);
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateDetailsDialog({
  template,
  onClose,
  onUse,
}: {
  template: DocumentTemplate;
  onClose: () => void;
  onUse: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal template-details-dialog"
        role="dialog"
        aria-modal="true">
        <header>
          <div>
            <p className="eyebrow">
              {templateTypeLabels[template.documentType]}
            </p>
            <h2>{template.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {template.previewDataUrl ? (
          <img
            src={template.previewDataUrl}
            alt={`${template.name} Vorschau`}
          />
        ) : null}
        <dl>
          <div>
            <dt>Datei</dt>
            <dd>{template.fileName}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{template.format.toUpperCase()}</dd>
          </div>
          <div>
            <dt>Quelle</dt>
            <dd>{templateSourceLabels[template.source]}</dd>
          </div>
          <div>
            <dt>Vorlagentyp</dt>
            <dd>{templateTypeLabels[template.documentType]}</dd>
          </div>
          <div>
            <dt>Geändert</dt>
            <dd>
              {template.modifiedAt
                ? new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(template.modifiedAt))
                : "Unbekannt"}
            </dd>
          </div>
        </dl>
        <footer>
          <button className="button secondary" type="button" onClick={onClose}>
            Schließen
          </button>
          <button className="button primary" type="button" onClick={onUse}>
            Vorlage verwenden
          </button>
        </footer>
      </section>
    </div>
  );
}

function UseTemplateDialog({
  template,
  applications,
  onClose,
  onUse,
}: {
  template: DocumentTemplate;
  applications: ReturnType<
    typeof useAppStore.getState
  >["workspace"]["applications"];
  onClose: () => void;
  onUse: (applicationId: string, atsMode: boolean) => void;
}) {
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [atsMode, setAtsMode] = useState(false);
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal use-template-dialog"
        role="dialog"
        aria-modal="true">
        <header>
          <div>
            <p className="eyebrow">Original bleibt unverändert</p>
            <h2>Vorlage verwenden</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <p>
          Aus „{template.name}“ wird eine neue Datei im Ordner der gewählten
          Bewerbung erstellt. Gefundene Platzhalter werden ersetzt.
        </p>
        <label className="field">
          <span>Bewerbung</span>
          <select
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}>
            {applications.map((application) => (
              <option value={application.id} key={application.id}>
                {application.company.name} · {application.job.title}
              </option>
            ))}
          </select>
        </label>
        {!applications.length ? (
          <small>Erstellen Sie zuerst eine Bewerbung.</small>
        ) : null}
        {template.supportsAtsMode ? (
          <label className="template-ats-option">
            <input
              type="checkbox"
              checked={atsMode}
              onChange={(event) => setAtsMode(event.target.checked)}
            />
            <span>
              <strong>ATS-Modus</strong>
              Einspaltige, besonders maschinenlesbare Word-Ausgabe ohne Foto und
              Seitenleiste erstellen.
            </span>
          </label>
        ) : null}
        <footer>
          <button className="button secondary" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!applicationId}
            onClick={() => onUse(applicationId, atsMode)}>
            Dokument erstellen
          </button>
        </footer>
      </section>
    </div>
  );
}
