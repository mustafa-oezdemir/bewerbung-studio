import { useEffect, useState } from "react";
import { ChevronDown, LockKeyhole, ShieldCheck, ShieldOff } from "lucide-react";
import type { SecurityStatus } from "../shared/ipc";
import { useAppStore } from "../store/useAppStore";

type Action = "enable" | "change" | "rotate" | "disable" | null;

export function SecurityControls({ initial = false, onComplete }: { initial?: boolean; onComplete?: () => void }) {
  const settings = useAppStore((state) => state.workspace.settings);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const api = window.bewerbungsManager?.security;
  useEffect(() => { void api?.status().then(setStatus).catch((error: Error) => setMessage(error.message)); }, [api]);

  const clearFields = () => { setPassword(""); setNewPassword(""); setConfirmation(""); };
  const finish = () => {
    if (!acknowledged) return;
    setRecoveryKey("");
    setAcknowledged(false);
    setAction(null);
    onComplete?.();
  };
  const run = async () => {
    if (!api || !action) return;
    setMessage("");
    if ((action === "enable" || action === "change") && newPassword !== confirmation) {
      setMessage("Die Passwörter stimmen nicht überein."); return;
    }
    if ((action === "enable" || action === "change") && newPassword.length < 14) {
      setMessage("Das neue Master-Passwort muss mindestens 14 Zeichen haben."); return;
    }
    if (action === "disable" && !window.confirm("Wenn Sie die Verschlüsselung deaktivieren, werden Ihre Bewerbungsdaten wieder unverschlüsselt auf dem Datenträger gespeichert. Fortfahren?")) return;
    setBusy(true);
    try {
      if (action === "enable") setRecoveryKey(await api.enable(newPassword));
      if (action === "change") { await api.changePassword(password, newPassword); setMessage("Das Passwort wurde geändert."); setAction(null); }
      if (action === "rotate") setRecoveryKey(await api.rotateRecoveryKey(password));
      if (action === "disable") { await api.disable(password); window.location.reload(); }
      setStatus(await api.status());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Der Vorgang ist fehlgeschlagen."); }
    finally { clearFields(); setBusy(false); }
  };
  const strength = newPassword.length < 14 ? "Schwach" : newPassword.length < 20 ? "Mittel" : newPassword.length < 28 ? "Stark" : "Sehr stark";

  if (!api) return null;
  if (recoveryKey) return <div className="view-stack">
    <h3>Wiederherstellungsschlüssel</h3>
    <p>Bewahren Sie diesen Schlüssel sicher und getrennt von Ihrem Bewerbungsordner auf. Wenn Sie Passwort und Schlüssel verlieren, können Ihre Daten nicht wiederhergestellt werden.</p>
    <div className="path-box"><code style={{ overflowWrap: "anywhere" }}>{recoveryKey}</code></div>
    <div className="settings-action-grid">
      <button className="button secondary" type="button" onClick={() => void navigator.clipboard.writeText(recoveryKey).then(() => setMessage("Schlüssel kopiert."))}>Kopieren</button>
      <button className="button secondary" type="button" onClick={() => void api.saveRecoveryKey(recoveryKey).then((saved) => saved && setMessage(`Schlüssel gespeichert: ${saved}`)).catch((error: Error) => setMessage(error.message))}>Als TXT speichern</button>
    </div>
    <label className="checkbox-field"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>Ich habe den Wiederherstellungsschlüssel sicher gespeichert.</span></label>
    <button className="button primary" type="button" disabled={!acknowledged} onClick={finish}>Fertig</button>
    {message && <p role="alert">{message}</p>}
  </div>;

  return <div className={initial ? "view-stack" : "security-controls"}>
    {initial ? <>
      <h2>Datenschutz &amp; Sicherheit</h2>
      <p>Ihre Bewerbungsdaten enthalten persönliche und vertrauliche Informationen. Möchten Sie Ihren Datenbestand verschlüsseln?</p>
    </> : <>
      <div className="security-overview">
        <div className="security-status-row">
          {status ? <span className={`security-badge ${status.mode === "unlocked" ? "is-encrypted" : "is-plain"}`}>
            {status.mode === "unlocked" ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
            {status.mode === "unlocked" ? "Verschlüsselt" : status.mode === "plaintext" ? "Nicht verschlüsselt" : "Gesperrt"}
          </span> : <span className="security-badge">Sicherheitsstatus wird geladen …</span>}
          {status?.mode === "unlocked" && <span className="security-method">AES-256-GCM · Argon2id</span>}
        </div>
        {status?.mode === "unlocked" ? <p>Dateiinhalte sind verschlüsselt. Ordner- und Dateinamen können weiterhin sichtbar sein.</p> : status?.mode === "plaintext" ? <p>Ihre Bewerbungsdaten sind derzeit auf dem Datenträger lesbar.</p> : <p>Der Sicherheitsstatus wird ermittelt.</p>}
      </div>
    </>}
    {!action && status?.mode === "plaintext" && <div className={initial ? "settings-action-grid" : "settings-action-row security-action-row"}>
      <button className="button primary" type="button" onClick={() => setAction("enable")}>Daten verschlüsseln{initial ? " – empfohlen" : ""}</button>
      {initial && <button className="button secondary" type="button" onClick={() => void api.completeOnboarding().then(onComplete).catch((error: Error) => setMessage(error.message))}>Ohne Verschlüsselung fortfahren</button>}
    </div>}
    {initial && !action && <small>Später unter Einstellungen änderbar.</small>}
    {!initial && status?.mode === "unlocked" && !action && <>
      <div className="settings-action-row security-action-row">
        <button className="button primary" type="button" onClick={() => void api.lock()}><LockKeyhole size={17} /> Workspace sperren</button>
        <button className="button secondary" type="button" onClick={() => setAction("change")}>Passwort ändern</button>
      </div>
      <details className="settings-disclosure security-options">
        <summary>Weitere Optionen <ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="settings-disclosure-content">
          <label className="checkbox-field"><input type="checkbox" checked={status.rememberDevice} onChange={(event) => void api.setRememberDevice(event.target.checked).then(() => api.status()).then(setStatus).catch((error: Error) => setMessage(error.message))} /><span>Auf diesem Gerät merken (Betriebssystemschutz)</span></label>
          <small>Automatisches Entsperren hängt vom Schutz Ihres Betriebssystemkontos ab. Andere Personen mit Zugriff auf dieses Konto können den Datenbestand möglicherweise öffnen.</small>
          <label className="field"><span>Automatisch sperren nach</span><select value={status.autoLockMinutes} onChange={(event) => {
            const minutes = Number(event.target.value) as SecurityStatus["autoLockMinutes"];
            setStatus({ ...status, autoLockMinutes: minutes });
            void saveSettings({ ...settings, autoLockMinutes: minutes }).catch((error: Error) => setMessage(error.message));
          }}><option value={5}>5 Minuten</option><option value={15}>15 Minuten</option><option value={30}>30 Minuten</option><option value={60}>60 Minuten</option><option value={0}>Nie</option></select></label>
          <div className="settings-action-row">
            <button className="button secondary" type="button" onClick={() => setAction("rotate")}>Wiederherstellungsschlüssel erneuern</button>
            <button className="button secondary" type="button" onClick={() => setAction("disable")}>Verschlüsselung deaktivieren</button>
          </div>
          <small>Frühere unverschlüsselte Git-Versionen können erhalten bleiben. In externen Programmen geöffnete oder exportierte Dateien liegen dort unverschlüsselt vor.</small>
        </div>
      </details>
    </>}
    {action && <div className="view-stack security-action-form" onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        void run();
      }
    }}>
      <h3>{action === "enable" ? "Verschlüsselung aktivieren" : action === "change" ? "Passwort ändern" : action === "rotate" ? "Wiederherstellungsschlüssel erneuern" : "Verschlüsselung deaktivieren"}</h3>
      {action !== "enable" && <label className="field"><span>Aktuelles Master-Passwort</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      {(action === "enable" || action === "change") && <>
        <label className="field"><span>Neues Master-Passwort</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label className="field"><span>Passwort wiederholen</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <small>Passwortstärke: {strength}. Mindestens 14 Zeichen; Leerzeichen und Unicode sind erlaubt.</small>
      </>}
      <div className="settings-action-grid"><button className="button primary" type="button" disabled={busy} onClick={() => void run()}>{busy ? "Bitte warten …" : "Bestätigen"}</button><button className="button secondary" type="button" disabled={busy} onClick={() => { setAction(null); clearFields(); }}>Abbrechen</button></div>
    </div>}
    {message && <p role="alert" className="field-error">{message}</p>}
  </div>;
}
