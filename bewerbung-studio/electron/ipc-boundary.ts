import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AppError, type IpcResult } from "../src/shared/app-error";
import { TemplateError } from "../src/features/templates/template.errors";
import { ApplicationFolderLockedError } from "./file-management";
import { logDiagnostic } from "./diagnostics";

const nodeCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code : "";

// These messages are fixed strings authored by the app. Never pass an arbitrary
// Error.message across IPC: OS and library errors may contain paths or user data.
const knownMessages = new Map<string, { code: AppError["code"]; expected: boolean }>([
  ["Der Datenbestand ist gesperrt.", { code: "WORKSPACE_LOCKED", expected: true }],
  ["Kein Datenbestand geöffnet.", { code: "WORKSPACE_LOCKED", expected: true }],
  ["Kein Bewerbungsordner eingerichtet.", { code: "WORKSPACE_LOCKED", expected: true }],
  ["Der Datenbestand ist nicht gesperrt.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültige Entsperrmethode.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültige Eingabe.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültiges Passwort.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültiger Wiederherstellungsschlüssel.", { code: "VALIDATION_FAILED", expected: true }],
  ["Das Passwort ist nicht korrekt oder der Datenbestand konnte nicht entschlüsselt werden.", { code: "INVALID_CREDENTIALS", expected: true }],
  ["Das Passwort ist nicht korrekt.", { code: "INVALID_CREDENTIALS", expected: true }],
  ["Das bisherige Passwort ist nicht korrekt.", { code: "INVALID_CREDENTIALS", expected: true }],
  ["Der Wiederherstellungsschlüssel ist ungültig oder der Datenbestand ist beschädigt.", { code: "INVALID_CREDENTIALS", expected: true }],
  ["Der Wiederherstellungsschlüssel ist ungültig.", { code: "INVALID_CREDENTIALS", expected: true }],
  ["Vorlage wurde nicht gefunden.", { code: "RESOURCE_NOT_FOUND", expected: true }],
  ["Bewerbung wurde nicht gefunden.", { code: "RESOURCE_NOT_FOUND", expected: true }],
  ["Profil wurde nicht gefunden.", { code: "RESOURCE_NOT_FOUND", expected: true }],
  ["Termin wurde nicht gefunden.", { code: "RESOURCE_NOT_FOUND", expected: true }],
  ["Dokument wurde nicht gefunden.", { code: "RESOURCE_NOT_FOUND", expected: true }],
  ["Ungültiger Bewerbungsstatus.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültiger Dokumenttyp.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültiges Exportziel.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültige Speicherort-Aktion.", { code: "VALIDATION_FAILED", expected: true }],
  ["Vorlage und Bewerbung sind erforderlich.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültiger Bildtyp.", { code: "VALIDATION_FAILED", expected: true }],
  ["Das Bild darf höchstens 8 MB groß sein.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültige Dokumentkategorie.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültige Sortierrichtung.", { code: "VALIDATION_FAILED", expected: true }],
  ["Ungültige Passwortänderung.", { code: "VALIDATION_FAILED", expected: true }],
  ["Der sichere Gerätespeicher ist nicht verfügbar.", { code: "VALIDATION_FAILED", expected: true }],
  ["Bitte wählen Sie eine PDF-Datei aus.", { code: "VALIDATION_FAILED", expected: true }],
  ["Die PDF-Datei ist ungültig oder größer als 100 MB.", { code: "VALIDATION_FAILED", expected: true }],
  ["Die ausgewählte Datei ist keine gültige PDF-Datei.", { code: "VALIDATION_FAILED", expected: true }],
  ["Wählen Sie einen Speicherort außerhalb des verschlüsselten Bewerbungsordners.", { code: "VALIDATION_FAILED", expected: true }],
  ["Die verschlüsselte Vorlage kann über ‚Öffnen‘ in einem externen Programm angezeigt werden.", { code: "VALIDATION_FAILED", expected: true }],
  ["Kopieren Sie den verschlüsselten Datenbestand und öffnen Sie anschließend die Kopie über ‚Vorhandenen Datenbestand öffnen‘.", { code: "VALIDATION_FAILED", expected: true }],
  ["Der beschädigte Datenbestand wurde nicht geöffnet.", { code: "VALIDATION_FAILED", expected: true }],
]);

export const normalizeError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof ApplicationFolderLockedError)
    return new AppError("FILE_LOCKED", error.message, { expected: true, cause: error });
  if (error instanceof TemplateError) {
    const code = error.code === "NOT_FOUND" ? "RESOURCE_NOT_FOUND" :
      error.code === "LOCKED" ? "FILE_LOCKED" : "TEMPLATE_INVALID";
    return new AppError(code, error.message, { expected: true, cause: error });
  }
  if (error instanceof ZodError)
    return new AppError("VALIDATION_FAILED", "Die eingegebenen Daten sind ungültig.", { expected: true, cause: error });
  if (error instanceof Error) {
    const known = knownMessages.get(error.message);
    if (known) return new AppError(known.code, error.message, { expected: known.expected, cause: error });
  }
  if (["EBUSY", "EPERM", "EACCES"].includes(nodeCode(error)))
    return new AppError("FILE_LOCKED", "Die Datei wird von einem anderen Programm verwendet oder der Zugriff wurde verweigert.", { expected: true, cause: error });
  if (nodeCode(error) === "ENOENT")
    return new AppError("FILE_NOT_FOUND", "Die benötigte Datei wurde nicht gefunden.", { expected: true, cause: error });
  return new AppError("INTERNAL_ERROR", "Ein unerwarteter Fehler ist aufgetreten.", { cause: error });
};

export const runIpcOperation = async <T>(channel: string, operation: () => T | Promise<T>): Promise<IpcResult<T>> => {
  const operationId = randomUUID();
  const startedAt = performance.now();
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const appError = normalizeError(error);
    logDiagnostic(appError.expected ? "warn" : "error", {
      event: "ipc_failed",
      component: "ipc",
      operation: channel,
      operation_id: operationId,
      error_code: appError.code,
      error_type: error instanceof Error ? error.name : "Unknown",
      duration_ms: Math.round(performance.now() - startedAt),
    });
    return { ok: false, error: {
      code: appError.code,
      message: appError.message,
      operationId,
    } };
  }
};
