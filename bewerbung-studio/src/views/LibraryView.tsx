import {
  ArrowDown,
  ArrowUp,
  Award,
  Eye,
  FileCheck2,
  FilePlus2,
  Files,
  PackageCheck,
  Save,
  Trash2,
} from "lucide-react";
import type { Attachment, AttachmentCategory } from "../shared/schema";
import { selectCurrentApplication, useAppStore } from "../store/useAppStore";

export function LibraryView() {
  const application = useAppStore(selectCurrentApplication);
  const attachments = useAppStore((state) => state.workspace.attachments);
  const addAttachment = useAppStore((state) => state.addAttachment);
  const saveAttachment = useAppStore((state) => state.saveAttachment);
  const moveAttachment = useAppStore((state) => state.moveAttachment);
  const removeAttachment = useAppStore((state) => state.removeAttachment);
  const openAttachment = useAppStore((state) => state.openAttachment);
  const selectedAttachments = application
    ? attachments.filter((item) => item.applicationId === application.id)
    : [];
  const includedPages = selectedAttachments.filter(
    (attachment) => attachment.includedInPackage,
  ).length;

  const byCategory = (category: AttachmentCategory) =>
    selectedAttachments
      .filter((attachment) => attachment.category === category)
      .sort((left, right) => left.order - right.order);

  return (
    <div className="view-stack">
      <section className="welcome-panel document-welcome">
        <div>
          <p className="eyebrow">Dokumentenablage</p>
          <h2>Zeugnisse & Zertifikate</h2>
          <p>
            PDF-Dateien werden sicher im zentralen Archiv abgelegt und mit der
            Bewerbung verknüpft.
          </p>
        </div>
        {application && (
          <div className="selected-context">
            <small>Ausgewählte Bewerbung</small>
            <strong>{application.company.name}</strong>
            <span>{application.job.title}</span>
          </div>
        )}
      </section>

      <section className="library-grid">
        <UploadCard
          icon={<FileCheck2 />}
          title="Zeugnis hinzufügen"
          description="Arbeits-, Ausbildungs- oder Abschlusszeugnis als PDF."
          disabled={!application}
          onClick={() =>
            application && void addAttachment(application.id, "Zeugnisse")
          }
        />
        <UploadCard
          icon={<Award />}
          title="Zertifikat hinzufügen"
          description="Weiterbildungen und fachliche Zertifizierungen als PDF."
          disabled={!application}
          onClick={() =>
            application && void addAttachment(application.id, "Zertifikate")
          }
        />
      </section>

      <section className="package-summary surface">
        <span className="large-icon">
          <PackageCheck />
        </span>
        <div>
          <p className="eyebrow">Komplette Bewerbungsmappe</p>
          <h3>
            {includedPages} zusätzliche PDF
            {includedPages === 1 ? "" : "s"} ausgewählt
          </h3>
          <p>
            Exportreihenfolge: Deckblatt, Anschreiben, Lebenslauf, Zeugnisse,
            Zertifikate.
          </p>
        </div>
      </section>

      {(["Zeugnisse", "Zertifikate"] as const).map((category) => {
        const documents = byCategory(category);
        return (
          <section className="surface document-category" key={category}>
            <header className="section-header">
              <div>
                <p className="eyebrow">PDF-Anlagen</p>
                <h3>
                  {category} <span>{documents.length}</span>
                </h3>
              </div>
            </header>
            {documents.length ? (
              <div className="managed-document-list">
                {documents.map((attachment, index) => (
                  <ManagedDocument
                    key={attachment.id}
                    attachment={attachment}
                    index={index}
                    length={documents.length}
                    onSave={saveAttachment}
                    onMove={moveAttachment}
                    onOpen={openAttachment}
                    onRemove={removeAttachment}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state compact">
                <Files size={22} />
                <p>
                  Noch keine {category.toLocaleLowerCase("de-DE")} zugeordnet.
                </p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function UploadCard({
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <article className="surface upload-card">
      <span className="large-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <button
        className="button secondary"
        disabled={disabled}
        onClick={onClick}>
        <FilePlus2 size={17} /> PDF auswählen
      </button>
    </article>
  );
}

function ManagedDocument({
  attachment,
  index,
  length,
  onSave,
  onMove,
  onOpen,
  onRemove,
}: {
  attachment: Attachment;
  index: number;
  length: number;
  onSave: (attachment: Attachment) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void onSave({
      ...attachment,
      fileName: String(data.get("fileName")),
      category: attachment.category,
      documentDate: String(data.get("documentDate")),
      description: String(data.get("description")),
      includedInPackage: data.get("includedInPackage") === "on",
    });
  };

  return (
    <form className="managed-document" onSubmit={submit}>
      <div className="document-order">
        <strong>{String(index + 1).padStart(2, "0")}</strong>
        <span>
          {attachment.category === "Zeugnisse" ? <FileCheck2 /> : <Award />}
        </span>
      </div>
      <div className="document-fields">
        <div className="form-grid">
          <label className="field">
            <span>Anzeigename</span>
            <input
              name="fileName"
              defaultValue={attachment.fileName}
              required
            />
          </label>
          <label className="field">
            <span>Kategorie</span>
            <input value={attachment.category} disabled />
          </label>
          <label className="field">
            <span>Dokumentdatum</span>
            <input
              name="documentDate"
              type="date"
              defaultValue={attachment.documentDate}
            />
          </label>
          <label className="field">
            <span>Beschreibung</span>
            <input
              name="description"
              defaultValue={attachment.description}
              placeholder="z. B. Arbeitszeugnis – letzte Position"
            />
          </label>
        </div>
        <label className="checkbox-field package-checkbox">
          <input
            name="includedInPackage"
            type="checkbox"
            defaultChecked={attachment.includedInPackage}
          />
          <span>In die komplette Bewerbungsmappe aufnehmen</span>
        </label>
      </div>
      <div className="document-actions">
        <button
          type="button"
          className="icon-button"
          aria-label="Dokument nach oben verschieben"
          disabled={index === 0}
          onClick={() => void onMove(attachment.id, -1)}>
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Dokument nach unten verschieben"
          disabled={index === length - 1}
          onClick={() => void onMove(attachment.id, 1)}>
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="PDF öffnen"
          onClick={() => void onOpen(attachment.id)}>
          <Eye size={16} />
        </button>
        <button
          className="icon-button"
          type="submit"
          aria-label="Dokument speichern">
          <Save size={16} />
        </button>
        <button
          type="button"
          className="icon-button danger"
          aria-label="Dokument löschen"
          onClick={() => {
            if (
              window.confirm(
                `„${attachment.fileName}“ aus der verwalteten Ablage löschen? Die ursprüngliche Quelldatei bleibt erhalten.`,
              )
            ) {
              void onRemove(attachment.id);
            }
          }}>
          <Trash2 size={16} />
        </button>
      </div>
    </form>
  );
}
