import {
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Mail,
  MapPin,
  Phone,
  Save,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  applicationStatuses,
  rejectionReasons,
  type Application,
  type ApplicationStatus,
  type RejectionReason,
} from "../shared/schema";
import { templates } from "../shared/templates";
import { applicationMatchesQuery } from "../lib/applicationSearch";
import {
  formatDate,
  fromDateInput,
  fromDateTimeInput,
  statusTone,
  toDateInput,
  toDateTimeInput,
} from "../lib/format";
import { selectCurrentApplication, useAppStore } from "../store/useAppStore";

type Filter = "active" | "interviews" | "rejections" | "offers" | "all";

export function ApplicationsView({
  initialFilter = "active",
  onOpenResume,
  onOpenCover,
}: {
  initialFilter?: Filter;
  onOpenResume?: () => void;
  onOpenCover?: () => void;
}) {
  const workspace = useAppStore((state) => state.workspace);
  const selected = useAppStore(selectCurrentApplication);
  const selectedId = useAppStore((state) => state.selectedApplicationId);
  const selectApplication = useAppStore((state) => state.selectApplication);
  const saveApplication = useAppStore((state) => state.saveApplication);
  const changeStatus = useAppStore((state) => state.changeStatus);
  const removeApplication = useAppStore((state) => state.removeApplication);
  const duplicateApplication = useAppStore(
    (state) => state.duplicateApplication,
  );
  const openFolder = useAppStore((state) => state.openFolder);
  const saving = useAppStore((state) => state.loading);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return workspace.applications.filter((application) => {
      if (!applicationMatchesQuery(application, query)) return false;
      if (filter === "active")
        return !["Absage", "Zurückgezogen", "Archiviert"].includes(
          application.status,
        );
      if (filter === "interviews")
        return ["Vorstellungsgespräch", "Zweites Gespräch"].includes(
          application.status,
        );
      if (filter === "rejections") return application.status === "Absage";
      if (filter === "offers") return application.status === "Zusage";
      return true;
    });
  }, [filter, query, workspace.applications]);

  const formData = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return new FormData(event.currentTarget);
  };

  const submitStatusAndDesign = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    const data = formData(event);
    if (!selected) return;
    const status = String(data.get("status")) as ApplicationStatus;
    const rejectionReason = String(data.get("rejectionReason") || "") as
      | RejectionReason
      | "";
    await saveApplication({
      ...selected,
      templateId: String(data.get("templateId")),
      accentColor: String(data.get("accentColor")),
      secondaryColor: String(data.get("secondaryColor")),
      rejectionReason: rejectionReason || undefined,
    });
    if (status !== selected.status) {
      await changeStatus(selected.id, status, rejectionReason || undefined);
    }
  };

  const submitCompanyAndPosition = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    const data = formData(event);
    if (!selected) return;
    await saveApplication({
      ...selected,
      company: {
        ...selected.company,
        name: String(data.get("company")),
        street: String(data.get("street")),
        postalCode: String(data.get("postalCode")),
        city: String(data.get("city")),
        website: String(data.get("website")),
      },
      job: {
        ...selected.job,
        title: String(data.get("role")),
        reference: String(data.get("jobReference")),
        url: String(data.get("jobUrl")),
        source: String(data.get("source")),
        salaryExpectation: String(data.get("salaryExpectation")),
      },
    });
  };

  const submitDates = async (event: React.FormEvent<HTMLFormElement>) => {
    const data = formData(event);
    if (!selected) return;
    await saveApplication({
      ...selected,
      sentAt: fromDateInput(String(data.get("sentAt"))),
      deadlineAt: fromDateInput(String(data.get("deadlineAt"))),
      interviewAt: fromDateTimeInput(String(data.get("interviewAt"))),
      secondInterviewAt: fromDateTimeInput(
        String(data.get("secondInterviewAt")),
      ),
      startAt: fromDateInput(String(data.get("startAt"))),
      contractEndAt: fromDateInput(String(data.get("contractEndAt"))),
      fixedTermEndAt: fromDateInput(String(data.get("fixedTermEndAt"))),
      probationEndAt: fromDateInput(String(data.get("probationEndAt"))),
    });
  };

  const submitContent = async (event: React.FormEvent<HTMLFormElement>) => {
    const data = formData(event);
    if (!selected) return;
    await saveApplication({
      ...selected,
      job: {
        ...selected.job,
        fullText: String(data.get("fullText")),
      },
      notes: String(data.get("notes")),
    });
  };

  return (
    <div className="manager-grid">
      <aside className="application-sidebar surface">
        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Firma, Ansprechpartner, Stelle oder Stadt suchen …"
          />
        </div>
        <div className="filter-tabs">
          {[
            ["active", "Aktiv"],
            ["interviews", "Gespräche"],
            ["rejections", "Absagen"],
            ["offers", "Zusagen"],
            ["all", "Alle"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value as Filter)}>
              {label}
            </button>
          ))}
        </div>
        <div className="application-list">
          {filtered.map((application) => (
            <button
              key={application.id}
              className={`application-item ${selectedId === application.id ? "active" : ""}`}
              onClick={() => selectApplication(application.id)}>
              <span className="company-mark">
                {application.company.name.slice(0, 2).toUpperCase()}
              </span>
              <span>
                <strong>{application.company.name}</strong>
                <small>{application.job.title}</small>
                <em className={statusTone(application.status)}>
                  {application.status}
                </em>
              </span>
              <small>{formatDate(application.updatedAt)}</small>
            </button>
          ))}
          {!filtered.length && (
            <div className="empty-state compact">
              <p>Keine passenden Bewerbungen.</p>
            </div>
          )}
        </div>
      </aside>
      {selected ? (
        <main className="detail-surface surface" key={selected.id}>
          <header className="detail-title">
            <div className="company-identity">
              <span>{selected.company.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <p className="eyebrow">Bewerbungsdetail</p>
                <h2>{selected.job.title}</h2>
                <p>
                  {selected.company.name} · {selected.company.city}
                </p>
              </div>
            </div>
            <div className="detail-actions">
              <button
                className="icon-button"
                title="Duplizieren"
                onClick={() => void duplicateApplication(selected.id)}>
                <Copy size={17} />
              </button>
              <button
                className="icon-button"
                title="Anschreiben-Ordner öffnen"
                aria-label="Anschreiben-Ordner öffnen"
                onClick={() => void openFolder(selected.id)}>
                <FolderOpen size={17} />
              </button>
              <button
                className="icon-button danger"
                title="Bewerbung löschen"
                onClick={() => {
                  if (
                    window.confirm(
                      "Bewerbung wirklich löschen? Alle zugehörigen Dateien in Anschreiben, Lebenslauf, Absagen und im Bewerbungsordner werden dauerhaft gelöscht. Die vollständigen Bewerbungsdaten werden zuvor im JSON-Archiv „Silinenler“ gespeichert. Dateien im zentralen Zeugnisse-/Zertifikate-Archiv bleiben erhalten.",
                    )
                  ) {
                    void removeApplication(selected.id);
                  }
                }}
                aria-label="Bewerbung und zugehörige Dateien löschen">
                <Trash2 size={17} />
              </button>
            </div>
          </header>
          <div className="contact-strip">
            <span>
              <MapPin size={15} /> {selected.company.city || "Ort offen"}
            </span>
            {[selected.contact, ...selected.additionalContacts].map(
              (contact, index) => {
                const name = [contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div
                    className="contact-strip-person"
                    key={`${index}-${contact.email}-${contact.phone}`}>
                    <span>
                      <UserRound size={15} /> {name || "Name offen"}
                    </span>
                    <span>
                      <Mail size={15} /> {contact.email || "E-Mail offen"}
                    </span>
                    <span>
                      <Phone size={15} /> {contact.phone || "Telefon offen"}
                    </span>
                  </div>
                );
              },
            )}
            {selected.job.url && (
              <button
                onClick={() =>
                  void window.bewerbungsManager.system.openExternal(
                    selected.job.url,
                  )
                }>
                <Link2 size={15} /> Stellenanzeige <ExternalLink size={13} />
              </button>
            )}
          </div>
          <div className="detail-form">
            {initialFilter === "active" && (onOpenResume || onOpenCover) ? (
              <nav
                className="detail-document-nav"
                aria-label="Bewerbungsunterlagen">
                {onOpenResume ? (
                  <button
                    className="button secondary detail-document-link"
                    type="button"
                    aria-label="Lebenslauf öffnen"
                    onClick={onOpenResume}>
                    <UserRound size={16} /> Lebenslauf
                  </button>
                ) : null}
                {onOpenCover ? (
                  <button
                    className="button secondary detail-document-link"
                    type="button"
                    aria-label="Anschreiben öffnen"
                    onClick={onOpenCover}>
                    <FileText size={16} /> Anschreiben
                  </button>
                ) : null}
              </nav>
            ) : null}
            <FormSection
              title="Status & Gestaltung"
              onSubmit={submitStatusAndDesign}
              saving={saving}>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={selected.status}>
                  {applicationStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Absagegrund</span>
                <select
                  name="rejectionReason"
                  defaultValue={selected.rejectionReason || ""}>
                  <option value="">Nicht gesetzt</option>
                  {rejectionReasons.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Vorlage</span>
                <select name="templateId" defaultValue={selected.templateId}>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Akzentfarbe</span>
                <input
                  name="accentColor"
                  type="color"
                  defaultValue={selected.accentColor}
                />
              </label>
              <label className="field">
                <span>Seiten-/Flächenfarbe</span>
                <input
                  name="secondaryColor"
                  type="color"
                  defaultValue={selected.secondaryColor}
                />
              </label>
            </FormSection>
            <FormSection
              title="Unternehmen & Position"
              onSubmit={submitCompanyAndPosition}
              saving={saving}>
              <label className="field">
                <span>Unternehmen</span>
                <input
                  name="company"
                  defaultValue={selected.company.name}
                  required
                />
              </label>
              <label className="field">
                <span>Position</span>
                <input name="role" defaultValue={selected.job.title} required />
              </label>
              <label className="field">
                <span>Kennziffer / Referenznummer</span>
                <input
                  name="jobReference"
                  defaultValue={selected.job.reference}
                />
              </label>
              <label className="field">
                <span>Straße</span>
                <input name="street" defaultValue={selected.company.street} />
              </label>
              <div className="split-fields">
                <label className="field">
                  <span>PLZ</span>
                  <input
                    name="postalCode"
                    defaultValue={selected.company.postalCode}
                  />
                </label>
                <label className="field">
                  <span>Ort</span>
                  <input name="city" defaultValue={selected.company.city} />
                </label>
              </div>
              <label className="field">
                <span>Website</span>
                <input
                  name="website"
                  type="url"
                  defaultValue={selected.company.website}
                />
              </label>
              <label className="field">
                <span>Stellen-URL</span>
                <input
                  name="jobUrl"
                  type="url"
                  defaultValue={selected.job.url}
                />
              </label>
              <label className="field">
                <span>Quelle</span>
                <input name="source" defaultValue={selected.job.source} />
              </label>
              <label className="field">
                <span>Gehaltsvorstellung</span>
                <input
                  name="salaryExpectation"
                  defaultValue={selected.job.salaryExpectation}
                />
              </label>
            </FormSection>
            <ContactFormSection
              application={selected}
              saveApplication={saveApplication}
              saving={saving}
            />
            <FormSection title="Termine" onSubmit={submitDates} saving={saving}>
              <label className="field">
                <span>Bewerbungsdatum</span>
                <input
                  name="sentAt"
                  type="date"
                  defaultValue={toDateInput(selected.sentAt)}
                />
              </label>
              <label className="field">
                <span>Bewerbungsfrist</span>
                <input
                  name="deadlineAt"
                  type="date"
                  defaultValue={toDateInput(selected.deadlineAt)}
                />
              </label>
              <label className="field">
                <span>Vorstellungsgespräch</span>
                <input
                  name="interviewAt"
                  type="datetime-local"
                  defaultValue={toDateTimeInput(selected.interviewAt)}
                />
              </label>
              <label className="field">
                <span>Zweites Gespräch</span>
                <input
                  name="secondInterviewAt"
                  type="datetime-local"
                  defaultValue={toDateTimeInput(selected.secondInterviewAt)}
                />
              </label>
              <label className="field">
                <span>Vertragsbeginn</span>
                <input
                  name="startAt"
                  type="date"
                  defaultValue={toDateInput(selected.startAt)}
                />
              </label>
              <label className="field">
                <span>Vertragsende</span>
                <input
                  name="contractEndAt"
                  type="date"
                  defaultValue={toDateInput(selected.contractEndAt)}
                />
              </label>
              <label className="field">
                <span>Befristungsende</span>
                <input
                  name="fixedTermEndAt"
                  type="date"
                  defaultValue={toDateInput(selected.fixedTermEndAt)}
                />
              </label>
              <label className="field">
                <span>Probezeitende</span>
                <input
                  name="probationEndAt"
                  type="date"
                  defaultValue={toDateInput(selected.probationEndAt)}
                />
              </label>
            </FormSection>
            <FormSection
              title="Inhalt"
              onSubmit={submitContent}
              saving={saving}>
              <label className="field full">
                <span>Vollständige Stellenanzeige</span>
                <textarea
                  name="fullText"
                  rows={8}
                  defaultValue={selected.job.fullText}
                />
              </label>
              <label className="field full">
                <span>Persönliche Notizen</span>
                <textarea name="notes" rows={4} defaultValue={selected.notes} />
              </label>
            </FormSection>
            <div className="save-bar detail-timestamp">
              <span>
                Zuletzt geändert: {formatDate(selected.updatedAt, true)}
              </span>
            </div>
          </div>
          <section className="history-section">
            <h3>Statusverlauf</h3>
            <div>
              {[...selected.statusHistory].reverse().map((entry) => (
                <article key={`${entry.at}-${entry.to}`}>
                  <i className={`status-dot ${statusTone(entry.to)}`} />
                  <span>
                    <strong>{entry.to}</strong>
                    <small>
                      {formatDate(entry.at, true)}
                      {entry.from ? ` · von ${entry.from}` : ""}
                    </small>
                  </span>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="surface empty-detail">
          <FileEmpty />
        </main>
      )}
    </div>
  );
}

const emptyContact: Application["contact"] = {
  salutation: "",
  firstName: "",
  lastName: "",
  position: "",
  email: "",
  phone: "",
};

function ContactFields({
  prefix,
  contact,
}: {
  prefix: string;
  contact: Application["contact"];
}) {
  return (
    <>
      <label className="field">
        <span>Anrede / Geschlecht</span>
        <select name={`${prefix}Salutation`} defaultValue={contact.salutation}>
          <option value="">Nicht angegeben</option>
          <option value="Frau">Frau</option>
          <option value="Herr">Herr</option>
          <option value="Divers">Divers</option>
        </select>
      </label>
      <label className="field">
        <span>Position / Funktion</span>
        <input name={`${prefix}Position`} defaultValue={contact.position} />
      </label>
      <label className="field">
        <span>Vorname</span>
        <input name={`${prefix}FirstName`} defaultValue={contact.firstName} />
      </label>
      <label className="field">
        <span>Nachname</span>
        <input name={`${prefix}LastName`} defaultValue={contact.lastName} />
      </label>
      <label className="field">
        <span>E-Mail</span>
        <input
          name={`${prefix}Email`}
          type="email"
          defaultValue={contact.email}
        />
      </label>
      <label className="field">
        <span>Telefon</span>
        <input name={`${prefix}Phone`} defaultValue={contact.phone} />
      </label>
    </>
  );
}

function ContactFormSection({
  application,
  saveApplication,
  saving,
}: {
  application: Application;
  saveApplication: (application: Application) => Promise<void>;
  saving: boolean;
}) {
  const savedSecondContact = application.additionalContacts[0];
  const [showSecondContact, setShowSecondContact] = useState(
    Boolean(savedSecondContact),
  );

  const submitContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const readContact = (prefix: string): Application["contact"] => ({
      salutation: String(
        data.get(`${prefix}Salutation`) || "",
      ) as Application["contact"]["salutation"],
      position: String(data.get(`${prefix}Position`) || ""),
      firstName: String(data.get(`${prefix}FirstName`) || ""),
      lastName: String(data.get(`${prefix}LastName`) || ""),
      email: String(data.get(`${prefix}Email`) || ""),
      phone: String(data.get(`${prefix}Phone`) || ""),
    });
    await saveApplication({
      ...application,
      contact: readContact("contact"),
      additionalContacts: showSecondContact
        ? [readContact("secondContact")]
        : [],
    });
  };

  return (
    <FormSection
      title="Ansprechpartner"
      onSubmit={submitContact}
      saving={saving}>
      <div className="contact-person-heading full">
        <strong>Erster Ansprechpartner</strong>
      </div>
      <ContactFields prefix="contact" contact={application.contact} />
      {showSecondContact ? (
        <>
          <div className="contact-person-heading full">
            <strong>Zweiter Ansprechpartner</strong>
            <button
              className="button secondary"
              type="button"
              onClick={() => setShowSecondContact(false)}>
              <UserMinus size={16} /> Entfernen
            </button>
          </div>
          <ContactFields
            prefix="secondContact"
            contact={savedSecondContact ?? emptyContact}
          />
        </>
      ) : (
        <div className="contact-person-add full">
          <button
            className="button secondary"
            type="button"
            onClick={() => setShowSecondContact(true)}>
            <UserPlus size={16} /> Zweiten Ansprechpartner hinzufügen
          </button>
        </div>
      )}
    </FormSection>
  );
}

function FormSection({
  title,
  children,
  onSubmit,
  saving,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  saving: boolean;
}) {
  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <fieldset className="form-section" disabled={saving}>
        <legend>{title}</legend>
        <div className="form-grid">{children}</div>
        <div className="section-save-bar">
          <button className="button primary" type="submit">
            <Save size={16} /> Bereich speichern
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function FileEmpty() {
  return (
    <div className="empty-state">
      <Search size={24} />
      <h3>Keine Bewerbung ausgewählt</h3>
      <p>Wählen Sie links eine Bewerbung aus oder legen Sie eine neue an.</p>
    </div>
  );
}
