import {
  Bell,
  ChevronDown,
  Copy,
  Database,
  Download,
  FileJson,
  FolderOpen,
  History,
  Moon,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../shared/schema";
import type { WorkspaceChangeMode } from "../shared/ipc";
import { useAppStore } from "../store/useAppStore";
import { SecurityControls } from "../components/SecurityControls";

export function SettingsView() {
  const settings = useAppStore((state) => state.workspace.settings);
  const workspace = useAppStore((state) => state.workspace);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const importBackup = useAppStore((state) => state.importBackup);
  const exportSettings = useAppStore((state) => state.exportSettings);
  const importSettings = useAppStore((state) => state.importSettings);
  const importLegacyData = useAppStore((state) => state.importLegacyData);
  const [dataPath, setDataPath] = useState("Wird geladen …");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [workspaceFile, setWorkspaceFile] = useState("");
  const [workspaceModifiedAt, setWorkspaceModifiedAt] = useState("");
  const [changeMode, setChangeMode] = useState<WorkspaceChangeMode>("move");
  const [feedback, setFeedback] = useState<{ section: "workspace" | "location" | "transfer"; text: string } | null>(null);
  const [changingWorkspace, setChangingWorkspace] = useState(false);
  const report = (section: "workspace" | "location" | "transfer", text: string) => setFeedback({ section, text });
  useEffect(() => {
    if (window.bewerbungsManager) {
      void window.bewerbungsManager.system.dataPath().then(setDataPath);
      void window.bewerbungsManager.system.workspaceStatus().then((status) => {
        if (status.state === "ready") setWorkspaceRoot(status.root);
      });
      void window.bewerbungsManager.system.workspaceDetails().then((details) => {
        setWorkspaceFile(details.filePath);
        setWorkspaceModifiedAt(details.modifiedAt);
      }).catch(() => undefined);
    }
  }, []);

  const changeWorkspace = async () => {
    setFeedback(null);
    setChangingWorkspace(true);
    try {
      const status =
        await window.bewerbungsManager.system.changeWorkspace(changeMode);
      if (status.state === "ready" && status.root !== workspaceRoot) {
        setWorkspaceRoot(status.root);
        window.location.reload();
      } else {
        report("location", "Der Speicherort wurde nicht geändert.");
      }
    } catch (error) {
      report("location",
        error instanceof Error
          ? error.message
          : "Der Speicherort konnte nicht geändert werden.",
      );
    } finally {
      setChangingWorkspace(false);
    }
  };

  const openExistingWorkspace = async () => {
    setFeedback(null);
    setChangingWorkspace(true);
    try {
      const status = await window.bewerbungsManager.system.openExistingWorkspace();
      if ((status.state === "ready" && status.root !== workspaceRoot) || status.state === "locked") window.location.reload();
      else report("workspace", "Der aktuelle Datenbestand bleibt geöffnet.");
    } catch (error) {
      report("workspace", error instanceof Error ? error.message : "Der Datenbestand konnte nicht geöffnet werden.");
    } finally {
      setChangingWorkspace(false);
    }
  };

  const copyWorkspace = async () => {
    setFeedback(null);
    setChangingWorkspace(true);
    try {
      const folder = await window.bewerbungsManager.system.copyWorkspace();
      if (folder) report("transfer", `Vollständiger Datenbestand kopiert: ${folder}`);
    } catch (error) {
      report("transfer", error instanceof Error ? error.message : "Der Datenbestand konnte nicht kopiert werden.");
    } finally {
      setChangingWorkspace(false);
    }
  };

  const backupWorkspace = async () => {
    setFeedback(null);
    try {
      const folder = await window.bewerbungsManager.system.backupWorkspace();
      report("transfer", `Vollständige Sicherung erstellt: ${folder}`);
    } catch (error) {
      report("transfer",
        error instanceof Error
          ? error.message
          : "Die Sicherung konnte nicht erstellt werden.",
      );
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const mode = String(data.get("followUp"));
    const next: AppSettings = {
      ...settings,
      followUpDays: mode === "off" ? null : Number(mode),
      notificationsEnabled: data.get("notificationsEnabled") === "on",
      archiveAccepted: data.get("archiveAccepted") === "on",
      theme: String(data.get("theme")) as AppSettings["theme"],
      autoBackupEnabled: data.get("autoBackupEnabled") === "on",
      backupRetention: Number(data.get("backupRetention")),
      autoSaveDelaySeconds: Number(data.get("autoSaveDelaySeconds")),
      autoLockMinutes: data.has("autoLockMinutes")
        ? Number(data.get("autoLockMinutes")) as AppSettings["autoLockMinutes"]
        : settings.autoLockMinutes,
    };
    await saveSettings(next);
  };

  return (
    <div className="settings-layout">
      <form className="view-stack" onSubmit={(event) => void submit(event)}>
        <section className="surface settings-section settings-card" aria-labelledby="settings-workspace-title">
          <header>
            <span className="large-icon"><FileJson /></span>
            <div><h3 id="settings-workspace-title">Datenbestand &amp; Workspace</h3><p>Welcher Bewerbungsdatenbestand aktuell geöffnet ist.</p></div>
          </header>
          <div className="settings-path-panel">
            <small>Aktive Workspace-Datei</small>
            <code title={workspaceFile}>{workspaceFile || "Wird geladen …"}</code>
          </div>
          <div className="settings-meta-row">
            <span>Zuletzt geändert: {workspaceModifiedAt ? new Date(workspaceModifiedAt).toLocaleString("de-DE") : "Wird geladen …"}</span>
            <span>{workspace.profiles.length} Profile · {workspace.applications.length} Bewerbungen</span>
          </div>
          <p className="settings-hint">Wählen Sie die <code>workspace.json</code> eines vorhandenen BewerbungsManager-Datenbestands aus.</p>
          <div className="settings-action-row">
            <button className="button primary" type="button" disabled={changingWorkspace} onClick={() => void openExistingWorkspace()}>
              <FileJson size={17} /> Workspace-Datei auswählen …
            </button>
            <button className="button secondary" type="button" title="Aktuelle Workspace-Datei im Explorer anzeigen" onClick={() => void window.bewerbungsManager.system.openWorkspaceFile().catch((error: Error) => report("workspace", error.message))}>
              Datei anzeigen
            </button>
          </div>
          {feedback?.section === "workspace" && <p className="settings-feedback" role="status">{feedback.text}</p>}
        </section>

        <section className="surface settings-section settings-card" aria-labelledby="settings-location-title">
          <header>
            <span className="large-icon"><FolderOpen /></span>
            <div><h3 id="settings-location-title">Speicherort</h3><p>Wo Bewerbungsdateien und Einstellungen liegen.</p></div>
          </header>
          <div className="settings-path-panel">
            <small>Aktiver Stammordner</small>
            <code title={workspaceRoot}>{workspaceRoot || "Wird geladen …"}</code>
          </div>
          <label className="field settings-mode-field">
            <span>Beim Wechsel des Speicherorts</span>
            <select value={changeMode} onChange={(event) => setChangeMode(event.target.value as WorkspaceChangeMode)}>
              <option value="move">Bestehende Daten in den neuen Ordner übernehmen</option>
              <option value="copy">Bestehende Daten kopieren</option>
              <option value="new">Nur neuen Speicherort verwenden</option>
            </select>
          </label>
          <p className="settings-hint">Vor dem Wechsel wird eine vollständige Sicherung erstellt. Der bisherige Ordner bleibt erhalten.</p>
          <div className="settings-action-row">
            <button className="button primary" type="button" disabled={changingWorkspace} onClick={() => void changeWorkspace()}>
              {changingWorkspace ? "Speicherort wird geändert …" : "Speicherort ändern …"}
            </button>
            <button className="button secondary" type="button" onClick={() => void window.bewerbungsManager.system.openWorkspace().catch((error: Error) => report("location", error.message))}>Ordner öffnen</button>
          </div>
          {feedback?.section === "location" && <p className="settings-feedback" role="status">{feedback.text}</p>}
        </section>

        <section className="surface settings-section settings-card" aria-labelledby="settings-transfer-title">
          <header>
            <span className="large-icon"><Copy /></span>
            <div><h3 id="settings-transfer-title">Übertragen &amp; Sicherung</h3><p>Sichern Sie Ihren Datenbestand oder übertragen Sie ihn vollständig auf einen anderen Computer.</p></div>
          </header>
          <p className="settings-hint">Für einen Computerwechsel wird der vollständige Bewerbungsordner kopiert. Auf dem neuen Computer wählen Sie anschließend die enthaltene <code>workspace.json</code> aus.</p>
          <div className="settings-action-row">
            <button className="button primary" type="button" disabled={changingWorkspace} onClick={() => void copyWorkspace()}><Copy size={17} /> Für anderen Computer kopieren …</button>
            <button className="button secondary" type="button" onClick={() => void backupWorkspace()}>Jetzt sichern</button>
            <button className="button secondary" type="button" onClick={() => void window.bewerbungsManager.system.openBackups().catch((error: Error) => report("transfer", error.message))}>Backup-Ordner öffnen</button>
          </div>
          {feedback?.section === "transfer" && <p className="settings-feedback" role="status">{feedback.text}</p>}
          <div className="settings-subsection">
            <h4>Automatische Sicherung</h4>
            <div className="form-grid">
              <label className="checkbox-field"><input type="checkbox" name="autoBackupEnabled" defaultChecked={settings.autoBackupEnabled} /><span>Tägliche automatische JSON-Sicherung</span></label>
              <label className="field"><span>Anzahl aufzubewahrender Sicherungen</span><input name="backupRetention" type="number" min="3" max="50" defaultValue={settings.backupRetention} /></label>
              <label className="field"><span>Automatisches Speichern nach Sekunden</span><input name="autoSaveDelaySeconds" type="number" min="1" max="30" defaultValue={settings.autoSaveDelaySeconds} /></label>
            </div>
          </div>
          <details className="settings-disclosure">
            <summary>Weitere Datenwerkzeuge <ChevronDown size={16} aria-hidden="true" /></summary>
            <div className="settings-disclosure-content">
              <div className="settings-path-panel"><small>Datenordner</small><code title={dataPath}>{dataPath}</code></div>
              <div className="settings-action-grid">
                <button className="button secondary" type="button" onClick={() => void exportBackup()}><Download size={17} /> JSON-Sicherung exportieren</button>
                <button className="button secondary" type="button" onClick={() => { if (window.confirm("Eine Sicherung wiederherstellen? Der aktuelle Stand wird vorher automatisch gesichert.")) void importBackup(); }}><History size={17} /> Sicherung wiederherstellen</button>
                <button className="button secondary" type="button" onClick={() => void exportSettings()}><Download size={17} /> Einstellungen exportieren</button>
                <button className="button secondary" type="button" onClick={() => void importSettings()}><Upload size={17} /> Einstellungen importieren</button>
                <button className="button secondary" type="button" onClick={() => void importLegacyData()}><Database size={17} /> Bisherigen data-Ordner migrieren</button>
              </div>
            </div>
          </details>
        </section>

        <section className="surface settings-section settings-card" aria-labelledby="settings-security-title">
          <header>
            <span className="large-icon"><ShieldCheck /></span>
            <div><h3 id="settings-security-title">Datensicherheit &amp; Verschlüsselung</h3><p>Schützen Sie persönliche Bewerbungsdaten mit einem Master-Passwort.</p></div>
          </header>
          <SecurityControls />
        </section>
        <section className="surface settings-section">
          <header>
            <span className="large-icon">
              <Bell />
            </span>
            <div>
              <h3>Erinnerungen</h3>
              <p>
                Automatische Nachfass-Termine und native
                Desktop-Benachrichtigungen.
              </p>
            </div>
          </header>
          <div className="form-grid">
            <label className="field">
              <span>Nach Bewerbung nachfassen</span>
              <select
                name="followUp"
                defaultValue={settings.followUpDays ?? "off"}>
                <option value="7">nach 7 Tagen</option>
                <option value="10">nach 10 Tagen</option>
                <option value="14">nach 14 Tagen</option>
                <option value="21">nach 21 Tagen</option>
                <option value="off">keine automatische Erinnerung</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="notificationsEnabled"
                defaultChecked={settings.notificationsEnabled}
              />
              <span>Desktop-Benachrichtigungen aktivieren</span>
            </label>
          </div>
        </section>
        <section className="surface settings-section">
          <header>
            <span className="large-icon">
              <Moon />
            </span>
            <div>
              <h3>Darstellung</h3>
              <p>Das Erscheinungsbild wird lokal gespeichert.</p>
            </div>
          </header>
          <div className="form-grid">
            <label className="field">
              <span>Farbschema</span>
              <select name="theme" defaultValue={settings.theme}>
                <option value="system">Systemeinstellung</option>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="archiveAccepted"
                defaultChecked={settings.archiveAccepted}
              />
              <span>Zusagen nach Abschluss archivieren</span>
            </label>
          </div>
        </section>
        <div className="save-bar sticky-save">
          <span>
            Änderungen gelten sofort für neue Status- und Kalenderereignisse.
          </span>
          <button className="button primary" type="submit">
            <Save size={17} /> Einstellungen speichern
          </button>
        </div>
      </form>
    </div>
  );
}
