import path from "node:path";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";

export type DiagnosticLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type DiagnosticFields = {
  event: string;
  component: string;
  operation?: string;
  operation_id?: string;
  error_code?: string;
  error_type?: string;
  duration_ms?: number;
};

const maxBytes = 5 * 1024 * 1024;
const retainedFiles = 5;
let logDirectory: string | null = null;
let version = "unknown";
let development = false;

export const initializeDiagnostics = (directory: string, appVersion: string, isDevelopment: boolean) => {
  logDirectory = directory;
  version = appVersion;
  development = isDevelopment;
};

const safeIdentifier = (value: string) => /^[a-zA-Z0-9:_-]{1,80}$/.test(value) ? value : "invalid";

export const logDiagnostic = (level: DiagnosticLevel, fields: DiagnosticFields) => {
  if (level === "debug" && !development) return;
  // Construct a strict allowlist. Raw errors, stack traces and user data never enter the log.
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "bewerbungsmanager-desktop",
    version,
    environment: development ? "development" : "production",
    event: safeIdentifier(fields.event),
    component: safeIdentifier(fields.component),
    ...(fields.operation ? { operation: safeIdentifier(fields.operation) } : {}),
    ...(fields.operation_id ? { operation_id: safeIdentifier(fields.operation_id) } : {}),
    ...(fields.error_code ? { error_code: safeIdentifier(fields.error_code) } : {}),
    ...(fields.error_type ? { error_type: safeIdentifier(fields.error_type) } : {}),
    ...(Number.isFinite(fields.duration_ms) ? { duration_ms: Math.max(0, Math.round(fields.duration_ms!)) } : {}),
  };
  if (!logDirectory) return;
  try {
    mkdirSync(logDirectory, { recursive: true, mode: 0o700 });
    const current = path.join(logDirectory, "app.jsonl");
    const line = `${JSON.stringify(entry)}\n`;
    if (existsSync(current) && statSync(current).size + Buffer.byteLength(line) > maxBytes) {
      const oldest = path.join(logDirectory, `app.${retainedFiles - 1}.jsonl`);
      if (existsSync(oldest)) unlinkSync(oldest);
      for (let index = retainedFiles - 2; index >= 1; index -= 1) {
        const source = path.join(logDirectory, `app.${index}.jsonl`);
        if (existsSync(source)) renameSync(source, path.join(logDirectory, `app.${index + 1}.jsonl`));
      }
      renameSync(current, path.join(logDirectory, "app.1.jsonl"));
    }
    appendFileSync(current, line, { encoding: "utf8", mode: 0o600 });
  } catch {
    // Diagnostics must never interrupt document or workspace operations.
  }
};
